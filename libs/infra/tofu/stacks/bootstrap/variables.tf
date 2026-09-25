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

variable "global_imports" {
  type = object({
    infisical_environments   = optional(map(string), {})
    github_repository        = optional(string)
    github_branch_protection = optional(string)
    github_variables         = optional(list(string), [])
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
