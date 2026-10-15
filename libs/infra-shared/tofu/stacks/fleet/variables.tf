# global.tfvars.json only: the environments come from reading envs/ directly.

variable "project" {
  type = string
  validation {
    condition     = length(var.project) >= 1 && length(var.project) <= 32
    error_message = "Railway project names must be between 1 and 32 characters."
  }
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

variable "planetscale" {
  type = any
}

variable "aws" {
  type = any
}

variable "grafana" {
  type = any
}

variable "github" {
  type = any
}

variable "auth_relay" {
  type = object({
    account_id = string
    zone_name  = string
    hostname   = string
    worker     = string
  })
}

variable "reports" {
  type = object({
    account_id = string
    bucket     = string
  })
  description = "The private bucket every environment's API reads the per-commit spec reports from."
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

variable "railway" { type = object({ workspace_id = string }) }

# The fleet owns durable data shared across every environment.
variable "shared_data" {
  type = object({ account_id = string, bucket = string })
}
