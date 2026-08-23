#!/usr/bin/env bash
# Validate (and optionally create) the cheap AWS pieces GitHub Actions needs.
# Does not create App Runner, Secrets Manager, or any billed service.
set -euo pipefail

REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-1}}"
REPO_NAME="${ECR_REPOSITORY:-chainmind-synapse}"
ROLE_NAME="${AWS_GHA_ROLE_NAME:-chainmind-synapse-gha}"
GITHUB_REPO="${GITHUB_REPOSITORY:-Raghavan2005/chainmind-synapse}"
OIDC_URL="https://token.actions.githubusercontent.com"
CREATE=0
TEARDOWN=0
CI_MODE=0
SKIP_IDENTITY=0

usage() {
  cat <<'EOF'
Usage: scripts/aws_preflight.sh [--create] [--teardown] [--ci] [--skip-identity]

  (default)   Check caller identity, OIDC provider, GHA role, ECR repo.
  --create    Create missing OIDC provider, GHA role, and ECR repository.
  --teardown  Delete the role/policy/ECR/OIDC objects this script creates.
  --ci        Fail if anything is missing (no create). Used by GitHub Actions.
  --skip-identity  Skip sts get-caller-identity (local checks before assume-role).
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --create) CREATE=1 ;;
    --teardown) TEARDOWN=1 ;;
    --ci) CI_MODE=1 ;;
    --skip-identity) SKIP_IDENTITY=1 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown flag: $1" >&2; usage; exit 2 ;;
  esac
  shift
done

need() {
  command -v "$1" >/dev/null 2>&1 || { echo "missing dependency: $1" >&2; exit 1; }
}

need aws
need python3

ACCOUNT="$(aws sts get-caller-identity --query Account --output text 2>/dev/null || true)"
if [[ -z "$ACCOUNT" && "$SKIP_IDENTITY" -eq 0 ]]; then
  echo "aws sts get-caller-identity failed" >&2
  exit 1
fi

OIDC_ARN="arn:aws:iam::${ACCOUNT:-unknown}:oidc-provider/token.actions.githubusercontent.com"
ROLE_ARN_DEFAULT="arn:aws:iam::${ACCOUNT:-unknown}:role/${ROLE_NAME}"
ROLE_ARN="${AWS_ROLE_ARN:-$ROLE_ARN_DEFAULT}"

if [[ "$SKIP_IDENTITY" -eq 0 ]]; then
  echo "caller=$(aws sts get-caller-identity --query Arn --output text)"
  echo "account=${ACCOUNT} region=${REGION}"
fi

if [[ "$TEARDOWN" -eq 1 ]]; then
  echo "tearing down preflight objects (not App Runner)"
  aws ecr delete-repository --repository-name "$REPO_NAME" --region "$REGION" --force >/dev/null 2>&1 || true
  aws iam delete-role-policy --role-name "$ROLE_NAME" --policy-name "${ROLE_NAME}-ecr" >/dev/null 2>&1 || true
  aws iam delete-role --role-name "$ROLE_NAME" >/dev/null 2>&1 || true
  aws iam delete-open-id-connect-provider --open-id-connect-provider-arn "$OIDC_ARN" >/dev/null 2>&1 || true
  echo "teardown attempted for ${REPO_NAME} / ${ROLE_NAME} / OIDC"
  exit 0
fi

check_oidc() {
  aws iam get-open-id-connect-provider --open-id-connect-provider-arn "$OIDC_ARN" >/dev/null 2>&1
}

check_role() {
  aws iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1
}

check_ecr() {
  aws ecr describe-repositories --repository-names "$REPO_NAME" --region "$REGION" >/dev/null 2>&1
}

if [[ "$CI_MODE" -eq 1 ]]; then
  # The GitHub OIDC role is ECR-only. Do not call iam:Get*.
  aws sts get-caller-identity --output json | python3 -c "import json,sys; d=json.load(sys.stdin); print(f\"assumed={d['Arn']}\")"
  if ! check_ecr; then
    echo "preflight failed: ECR ${REPO_NAME} missing in ${REGION}" >&2
    exit 1
  fi
  URI="$(aws ecr describe-repositories --repository-names "$REPO_NAME" --region "$REGION" --query 'repositories[0].repositoryUri' --output text)"
  echo "ECR ok: ${URI}"
  aws ecr get-login-password --region "$REGION" >/dev/null
  echo "ECR get-login-password ok"
  echo "preflight ok"
  exit 0
fi

MISSING=0
if ! check_oidc; then
  echo "OIDC provider missing: ${OIDC_ARN}"
  MISSING=1
else
  echo "OIDC provider ok"
fi
if ! check_role; then
  echo "IAM role missing: ${ROLE_NAME}"
  MISSING=1
else
  echo "IAM role ok: ${ROLE_ARN}"
fi
if ! check_ecr; then
  echo "ECR repository missing: ${REPO_NAME} (${REGION})"
  MISSING=1
else
  URI="$(aws ecr describe-repositories --repository-names "$REPO_NAME" --region "$REGION" --query 'repositories[0].repositoryUri' --output text)"
  echo "ECR ok: ${URI}"
fi

if [[ "$CREATE" -eq 0 ]]; then
  aws ecr get-login-password --region "$REGION" >/dev/null && echo "ECR get-login-password ok"
  if [[ "$MISSING" -eq 1 ]]; then
    echo "re-run with --create to make the missing cheap objects"
    exit 1
  fi
  echo "preflight ok"
  exit 0
fi

if ! check_oidc; then
  aws iam create-open-id-connect-provider \
    --url "$OIDC_URL" \
    --client-id-list sts.amazonaws.com \
    --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1 1c58a3a8518e8759bf075b76b750d4f2df264fcd \
    >/dev/null
  echo "created OIDC provider"
fi

# GitHub Actions OIDC sub is repo:OWNER/NAME:* and, on current GitHub,
# repo:OWNER@OWNER_ID/NAME@REPO_ID:* (see actions/oidc/customization/sub).
OWNER_LOGIN="${GITHUB_REPOSITORY_OWNER:-${GITHUB_REPO%%/*}}"
REPO_SLUG="${GITHUB_REPO#*/}"
OWNER_ID="${GITHUB_REPOSITORY_OWNER_ID:-}"
REPO_ID="${GITHUB_REPOSITORY_ID:-}"
if [[ -z "$OWNER_ID" || -z "$REPO_ID" ]] && command -v gh >/dev/null 2>&1; then
  OWNER_ID="$(gh api "repos/${GITHUB_REPO}" --jq .owner.id 2>/dev/null || true)"
  REPO_ID="$(gh api "repos/${GITHUB_REPO}" --jq .id 2>/dev/null || true)"
fi
TRUST="$(ACCOUNT="$ACCOUNT" GITHUB_REPO="$GITHUB_REPO" OWNER_LOGIN="$OWNER_LOGIN" REPO_SLUG="$REPO_SLUG" OWNER_ID="${OWNER_ID:-}" REPO_ID="${REPO_ID:-}" python3 - <<'PY'
import json, os
account = os.environ["ACCOUNT"]
repo = os.environ["GITHUB_REPO"]
owner = os.environ["OWNER_LOGIN"]
slug = os.environ["REPO_SLUG"]
owner_id = os.environ.get("OWNER_ID") or ""
repo_id = os.environ.get("REPO_ID") or ""
subs = [f"repo:{repo}:*"]
if owner_id and repo_id:
    subs.append(f"repo:{owner}@{owner_id}/{slug}@{repo_id}:*")
print(json.dumps({
    "Version": "2012-10-17",
    "Statement": [{
        "Effect": "Allow",
        "Principal": {
            "Federated": f"arn:aws:iam::{account}:oidc-provider/token.actions.githubusercontent.com"
        },
        "Action": "sts:AssumeRoleWithWebIdentity",
        "Condition": {
            "StringEquals": {
                "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
            },
            "StringLike": {
                "token.actions.githubusercontent.com:sub": subs
            },
        },
    }]
}))
PY
)"

if ! check_role; then
  aws iam create-role \
    --role-name "$ROLE_NAME" \
    --assume-role-policy-document "$TRUST" \
    --description "GitHub Actions OIDC deploy for ${GITHUB_REPO}" \
    >/dev/null
  echo "created role ${ROLE_NAME}"
else
  aws iam update-assume-role-policy --role-name "$ROLE_NAME" --policy-document "$TRUST" >/dev/null
  echo "updated role trust ${ROLE_NAME}"
fi

ECR_ARN="arn:aws:ecr:${REGION}:${ACCOUNT}:repository/${REPO_NAME}"
POLICY="$(ECR_ARN="$ECR_ARN" python3 - <<'PY'
import json, os
print(json.dumps({
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "EcrAuth",
            "Effect": "Allow",
            "Action": ["ecr:GetAuthorizationToken"],
            "Resource": "*",
        },
        {
            "Sid": "EcrPush",
            "Effect": "Allow",
            "Action": [
                "ecr:BatchCheckLayerAvailability",
                "ecr:GetDownloadUrlForLayer",
                "ecr:BatchGetImage",
                "ecr:DescribeRepositories",
                "ecr:DescribeImages",
                "ecr:ListImages",
                "ecr:PutImage",
                "ecr:InitiateLayerUpload",
                "ecr:UploadLayerPart",
                "ecr:CompleteLayerUpload",
            ],
            "Resource": os.environ["ECR_ARN"],
        },
    ],
}))
PY
)"
aws iam put-role-policy --role-name "$ROLE_NAME" --policy-name "${ROLE_NAME}-ecr" --policy-document "$POLICY" >/dev/null
echo "attached inline ECR policy"

if ! check_ecr; then
  aws ecr create-repository \
    --repository-name "$REPO_NAME" \
    --region "$REGION" \
    --image-scanning-configuration scanOnPush=true \
    --tags "Key=project,Value=chainmind-synapse" "Key=purpose,Value=gha-preflight" \
    >/dev/null
  echo "created ECR repository ${REPO_NAME}"
fi

aws ecr get-login-password --region "$REGION" >/dev/null
echo "ECR get-login-password ok"
echo "ROLE_ARN=arn:aws:iam::${ACCOUNT}:role/${ROLE_NAME}"
echo "ECR_REPOSITORY=${REPO_NAME}"
echo "AWS_REGION=${REGION}"
echo "preflight create ok"
