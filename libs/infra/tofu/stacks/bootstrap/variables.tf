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

variable "neon_project" {
  type = any
}

variable "github" {
  type = object({
    owner           = string
    repo            = string
    required_checks = list(string)
  })
}

variable "auth_relay" {
  type        = any
  description = "Read by the fleet stack and TypeScript (apps/auth-relay)."
}

variable "railway" {
  type        = any
  description = "Read by the fleet and foundation stacks."
}

variable "global_imports" {
  type = object({
    infisical_environments   = optional(map(string), {})
    github_repository        = optional(string)
    github_branch_protection = optional(string)
    github_variables         = optional(list(string), [])
    grafana_stack            = optional(string)
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
