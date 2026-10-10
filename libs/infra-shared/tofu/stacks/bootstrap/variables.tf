# global.tfvars.json

variable "project" {
  type = string
}

variable "state" {
  type = object({
    account_id = string
    bucket     = string
  })
}

variable "infisical" {
  type = object({
    org_id       = string
    project_id   = string
    project_slug = string
    shared_env   = string
  })
}

variable "grafana" {
  type = object({
    stack_slug = string
    region     = string
  })
}

variable "planetscale" {
  type = any
}

variable "aws" {
  type = any
}

variable "github" {
  type = object({
    owner    = string
    owner_id = string
    repo     = string
    repo_id  = string
    settings = object({
      visibility      = string
      homepage_url    = string
      has_issues      = bool
      has_projects    = bool
      has_wiki        = bool
      has_discussions = bool
      allow_forking   = bool
    })
    environments = set(string)
  })
}

variable "auth_relay" {
  type        = any
  description = "Read by the fleet stack and TypeScript (apps/auth-relay)."
}



variable "global_imports" {
  type = object({
    infisical_environments = optional(map(string), {})
    github_repository      = optional(string)
    github_variables       = optional(list(string), [])
    grafana_stack          = optional(string)
  })
  default = {}
}

variable "state_passphrase" {
  type      = string
  sensitive = true
}

variable "infisical_token" {
  type      = string
  sensitive = true
}

variable "aws_access_key_id" {
  type        = string
  default     = ""
  sensitive   = true
  description = "AWS access key for the provider. A person's AWS login on the one bootstrap apply that creates the GitHub OIDC role. Not the R2 state key."
}

variable "aws_secret_access_key" {
  type        = string
  default     = ""
  sensitive   = true
  description = "AWS secret key paired with aws_access_key_id."
}

variable "aws_session_token" {
  type        = string
  default     = ""
  sensitive   = true
  description = "AWS session token when the access key is a temporary SSO credential."
}

variable "railway" { type = any }
