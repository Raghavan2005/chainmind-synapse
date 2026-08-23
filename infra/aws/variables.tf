variable "region" {
  type    = string
  default = "eu-west-1"
}

variable "name" {
  type    = string
  default = "chainmind-synapse"
}

variable "github_oidc" {
  type    = bool
  default = true
}

variable "sepolia_rpc_url" {
  type    = string
  default = "https://ethereum-sepolia-rpc.publicnode.com"
}

variable "amoy_rpc_url" {
  type    = string
  default = "https://polygon-amoy-bor-rpc.publicnode.com"
}

variable "claim_source_sepolia" {
  type    = string
  default = ""
}

variable "claim_source_amoy" {
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
