variable "region" {
  type        = string
  default     = "us-east-1"
  description = "Must match the live ECR/OIDC account setup. Do not silently open eu-west-1."
}

variable "name" {
  type    = string
  default = "chainmind-synapse"
}

variable "github_oidc" {
  type    = bool
  default = true
}

variable "enable_runtime" {
  type        = bool
  default     = false
  description = "Create Secrets Manager + App Runner. Default false — see instructions/DEVOPS.html. Loud commit if you flip this."
}

variable "sepolia_rpc_url" {
  type    = string
  default = "https://ethereum-sepolia-rpc.publicnode.com"
}

variable "unichain_sepolia_rpc_url" {
  type    = string
  default = "https://sepolia.unichain.org"
}

variable "claim_source_sepolia" {
  type    = string
  default = ""
}

variable "claim_source_unichain_sepolia" {
  type    = string
  default = ""
}

variable "identity_state_sepolia" {
  type    = string
  default = ""
}

variable "deployer_private_key" {
  type      = string
  default   = ""
  sensitive = true
}

variable "operator_address" {
  type    = string
  default = ""
}

variable "demo_subject" {
  type    = string
  default = ""
}

variable "llm_api_key" {
  type      = string
  default   = ""
  sensitive = true
}

variable "llm_base_url" {
  type    = string
  default = ""
}

variable "llm_model" {
  type    = string
  default = "gpt-4.1-mini"
}

variable "replay_bearer" {
  type      = string
  default   = ""
  sensitive = true
}

variable "cors_origins" {
  type        = string
  default     = "*"
  description = "API CORS_ORIGINS. Set to the Vercel production origin before a public API."
}
