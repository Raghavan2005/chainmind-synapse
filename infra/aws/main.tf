terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.100"
    }
  }
}

provider "aws" {
  region = var.region
}

data "aws_caller_identity" "me" {}

resource "aws_ecr_repository" "synapse" {
  name                 = var.name
  image_tag_mutability = "MUTABLE"
  force_delete         = true
  image_scanning_configuration { scan_on_push = true }
}

resource "aws_secretsmanager_secret" "runtime" {
  name = "${var.name}/runtime"
}

resource "aws_secretsmanager_secret_version" "runtime" {
  secret_id = aws_secretsmanager_secret.runtime.id
  secret_string = jsonencode({
    SEPOLIA_RPC_URL          = var.sepolia_rpc_url
    AMOY_RPC_URL             = var.amoy_rpc_url
    CLAIM_SOURCE_SEPOLIA     = var.claim_source_sepolia
    CLAIM_SOURCE_AMOY        = var.claim_source_amoy
    IDENTITY_STATE_SEPOLIA   = var.identity_state_sepolia
    DEPLOYER_PRIVATE_KEY     = var.deployer_private_key
    OPERATOR_ADDRESS         = var.operator_address
    DEMO_SUBJECT             = var.demo_subject
    LLM_API_KEY              = var.llm_api_key
    LLM_BASE_URL             = var.llm_base_url
    LLM_MODEL                = var.llm_model
    REPLAY_BEARER            = var.replay_bearer
  })
}

resource "aws_iam_role" "apprunner" {
  name = "${var.name}-apprunner"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "build.apprunner.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "apprunner_ecr" {
  role       = aws_iam_role.apprunner.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess"
}

resource "aws_iam_role" "runtime" {
  name = "${var.name}-runtime"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "tasks.apprunner.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "runtime_secrets" {
  name = "${var.name}-secrets"
  role = aws_iam_role.runtime.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = [aws_secretsmanager_secret.runtime.arn]
    }]
  })
}

resource "aws_apprunner_service" "api" {
  service_name = var.name
  source_configuration {
    authentication_configuration {
      access_role_arn = aws_iam_role.apprunner.arn
    }
    image_repository {
      image_identifier      = "${aws_ecr_repository.synapse.repository_url}:latest"
      image_repository_type = "ECR"
      image_configuration {
        port = "8000"
        runtime_environment_secrets = {
          SEPOLIA_RPC_URL        = "${aws_secretsmanager_secret.runtime.arn}:SEPOLIA_RPC_URL::"
          AMOY_RPC_URL           = "${aws_secretsmanager_secret.runtime.arn}:AMOY_RPC_URL::"
          CLAIM_SOURCE_SEPOLIA   = "${aws_secretsmanager_secret.runtime.arn}:CLAIM_SOURCE_SEPOLIA::"
          CLAIM_SOURCE_AMOY      = "${aws_secretsmanager_secret.runtime.arn}:CLAIM_SOURCE_AMOY::"
          IDENTITY_STATE_SEPOLIA = "${aws_secretsmanager_secret.runtime.arn}:IDENTITY_STATE_SEPOLIA::"
          DEPLOYER_PRIVATE_KEY   = "${aws_secretsmanager_secret.runtime.arn}:DEPLOYER_PRIVATE_KEY::"
          OPERATOR_ADDRESS       = "${aws_secretsmanager_secret.runtime.arn}:OPERATOR_ADDRESS::"
          DEMO_SUBJECT           = "${aws_secretsmanager_secret.runtime.arn}:DEMO_SUBJECT::"
          LLM_API_KEY            = "${aws_secretsmanager_secret.runtime.arn}:LLM_API_KEY::"
          REPLAY_BEARER          = "${aws_secretsmanager_secret.runtime.arn}:REPLAY_BEARER::"
        }
      }
    }
    auto_deployments_enabled = true
  }
  instance_configuration {
    cpu               = "1 vCPU"
    memory            = "2 GB"
    instance_role_arn = aws_iam_role.runtime.arn
  }
  health_check_configuration {
    protocol            = "HTTP"
    path                = "/v1/health"
    interval            = 10
    timeout             = 5
    healthy_threshold   = 1
    unhealthy_threshold = 5
  }
}

resource "aws_iam_openid_connect_provider" "github" {
  count          = var.github_oidc ? 1 : 0
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
  thumbprint_list = [
    "6938fd4d98bab03faadb97b34396831e3780aea1",
    "1c58a3a8518e8759bf075b76b750d4f2df264fcd",
  ]
}

output "ecr_url" { value = aws_ecr_repository.synapse.repository_url }
output "service_url" { value = aws_apprunner_service.api.service_url }
output "service_arn" { value = aws_apprunner_service.api.arn }
output "secret_arn" { value = aws_secretsmanager_secret.runtime.arn }
