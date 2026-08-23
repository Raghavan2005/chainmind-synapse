variable "github_repository" {
  type        = string
  default     = "Raghavan2005/chainmind-synapse"
  description = "GitHub repo allowed to assume the Actions OIDC role."
}

resource "aws_iam_role" "github_actions" {
  count = var.github_oidc ? 1 : 0
  name  = "${var.name}-gha"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Federated = aws_iam_openid_connect_provider.github[0].arn
      }
      Action = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
        }
        StringLike = {
          "token.actions.githubusercontent.com:sub" = [
            "repo:${var.github_repository}:*",
            "repo:Raghavan2005@78393373/chainmind-synapse@1343319008:*",
          ]
        }
      }
    }]
  })
}

resource "aws_iam_role_policy" "github_actions_ecr" {
  count = var.github_oidc ? 1 : 0
  name  = "${var.name}-gha-ecr"
  role  = aws_iam_role.github_actions[0].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "EcrAuth"
        Effect   = "Allow"
        Action   = ["ecr:GetAuthorizationToken"]
        Resource = "*"
      },
      {
        Sid    = "EcrPush"
        Effect = "Allow"
        Action = [
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
        ]
        Resource = aws_ecr_repository.synapse.arn
      },
    ]
  })
}

output "github_actions_role_arn" {
  value = try(aws_iam_role.github_actions[0].arn, null)
}
