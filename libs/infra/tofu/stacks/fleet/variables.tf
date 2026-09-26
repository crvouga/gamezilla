# global.tfvars.json only: the environments come from reading envs/ directly.

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

variable "neon_project" {
  type = any
}

variable "grafana" {
  type = any
}

variable "github" {
  type = any
}

variable "global_imports" {
  type = object({
    infisical_environments = optional(map(string), {})
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
