#!/usr/bin/env bash
# Create (or reprint) the read-only App Runner service after ECR has :latest.
# No operator key. No Secrets Manager. Spec: instructions/DEVOPS.html
set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
NAME="${APPRUNNER_SERVICE_NAME:-chainmind-synapse}"
IMAGE="${ACCOUNT}.dkr.ecr.${REGION}.amazonaws.com/${ECR_REPOSITORY:-chainmind-synapse}:latest"
ACCESS_ROLE="arn:aws:iam::${ACCOUNT}:role/chainmind-synapse-apprunner"
CORS="${CORS_ORIGINS:-https://chainmind-synapse.vercel.app}"

EXISTING="$(aws apprunner list-services --region "$REGION" --query "ServiceSummaryList[?ServiceName=='${NAME}'].ServiceArn" --output text)"
if [[ -n "$EXISTING" && "$EXISTING" != "None" ]]; then
  echo "service exists: ${EXISTING}"
  aws apprunner describe-service --region "$REGION" --service-arn "$EXISTING" \
    --query 'Service.{Status:Status,Url:ServiceUrl,Arn:ServiceArn}' --output json
  exit 0
fi

# Fail if the image is not there yet.
aws ecr describe-images --region "$REGION" --repository-name "${ECR_REPOSITORY:-chainmind-synapse}" \
  --image-ids imageTag=latest >/dev/null

CFG="$(mktemp)"
python3 - "$CFG" "$IMAGE" "$ACCESS_ROLE" "$CORS" <<'PY'
import json, sys
cfg, image, role, cors = sys.argv[1:]
payload = {
    "ServiceName": "chainmind-synapse",
    "SourceConfiguration": {
        "AuthenticationConfiguration": {"AccessRoleArn": role},
        "AutoDeploymentsEnabled": True,
        "ImageRepository": {
            "ImageIdentifier": image,
            "ImageRepositoryType": "ECR",
            "ImageConfiguration": {
                "Port": "8000",
                "RuntimeEnvironmentVariables": {
                    "SEPOLIA_RPC_URL": "https://ethereum-sepolia-rpc.publicnode.com",
                    "UNICHAIN_SEPOLIA_RPC_URL": "https://sepolia.unichain.org",
                    "SEPOLIA_RPC_URL_FALLBACK": "https://1rpc.io/sepolia",
                    "UNICHAIN_SEPOLIA_RPC_URL_FALLBACK": "https://unichain-sepolia.drpc.org",
                    "BASE_SEPOLIA_RPC_URL": "https://sepolia.base.org",
                    "OP_SEPOLIA_RPC_URL": "https://sepolia.optimism.io",
                    "INK_SEPOLIA_RPC_URL": "https://rpc-gel-sepolia.inkonchain.com",
                    "MODE_SEPOLIA_RPC_URL": "https://sepolia.mode.network",
                    "SONEIUM_MINATO_RPC_URL": "https://rpc.minato.soneium.org",
                    "CLAIM_SOURCE_SEPOLIA": "0x16366eaeEddB90C990704ee6d12C43B30D9CF614",
                    "CLAIM_SOURCE_UNICHAIN_SEPOLIA": "0x5c2749F63fC6f50C600DA04f0Fd87bF8299c2c59",
                    "CLAIM_SOURCE_BASE_SEPOLIA": "0x5c2749F63fC6f50C600DA04f0Fd87bF8299c2c59",
                    "CLAIM_SOURCE_OP_SEPOLIA": "0x5c2749F63fC6f50C600DA04f0Fd87bF8299c2c59",
                    "CLAIM_SOURCE_INK_SEPOLIA": "0x5c2749F63fC6f50C600DA04f0Fd87bF8299c2c59",
                    "CLAIM_SOURCE_MODE_SEPOLIA": "0x5c2749F63fC6f50C600DA04f0Fd87bF8299c2c59",
                    "CLAIM_SOURCE_SONEIUM_MINATO": "0x5c2749F63fC6f50C600DA04f0Fd87bF8299c2c59",
                    "IDENTITY_STATE_SEPOLIA": "0xE11CD3Bb815ED4CA95692907ABa6fB3180F84894",
                    "OPERATOR_ADDRESS": "0x30C80ce55Ea8a8055DFa3B6D9Be303bD6b01F16a",
                    "DEMO_SUBJECT": "0x5cCBd2Ef7DBC744AbFF179F5C5B8180B182B1221",
                    "HOSTED_INGEST": "1",
                    "CORS_ORIGINS": cors,
                },
            },
        },
    },
    "InstanceConfiguration": {"Cpu": "1 vCPU", "Memory": "2 GB"},
    "HealthCheckConfiguration": {
        "Protocol": "HTTP",
        "Path": "/v1/health",
        "Interval": 10,
        "Timeout": 5,
        "HealthyThreshold": 1,
        "UnhealthyThreshold": 5,
    },
}
open(cfg, "w", encoding="utf-8").write(json.dumps(payload))
PY

aws apprunner create-service --region "$REGION" --cli-input-json "file://${CFG}"
rm -f "$CFG"
echo "created App Runner ${NAME}"
echo "set GitHub var APPRUNNER_SERVICE_ARN after Status=RUNNING"
