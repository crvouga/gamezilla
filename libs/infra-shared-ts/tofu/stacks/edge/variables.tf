# The subset of the environment file the edge stack reads. The env file is
# shared with the foundation stack, so every other key is declared too
# (OpenTofu warns on an undeclared variable in a -var-file) but unused here.

# ---- global.tfvars.json (same for every environment) ----------------------

variable "project" {
  type = string
}

variable "brand_name" {
  type        = string
  description = "Read by the bootstrap stack (stacks/bootstrap/alerting.tf)."
}

variable "state" {
  type = object({
    account_id = string
    bucket     = string
  })
}

variable "infisical" {
  type = any
}

variable "planetscale" {
  type = any
}

variable "aws" {
  type = any
}

variable "github" {
  type = any
}

variable "auth_relay" {
  type        = any
  description = "Read by the fleet stack and TypeScript (apps/auth-relay-ts)."
}

variable "global_imports" {
  type    = any
  default = {}
}

# ---- envs/<env>.tfvars.json ---------------------------------------------------

variable "env" {
  type = string
}

variable "display_name" {
  type = string
}

variable "suffix" {
  type = string
}

variable "worker" {
  type = object({
    name                = string
    transfer_rooms_from = optional(string)
    room_namespace_resolution = optional(object({
      source_id = string
      target_id = string
    }))
    retire                          = optional(list(string), [])
    puzzle_manager_account_ids      = optional(list(string), [])
    population_operator_account_ids = optional(list(string), [])
  })
}

variable "secrets" {
  type    = any
  default = {}
}

variable "protection" {
  type = string
}

variable "cloudflare" {
  type = object({
    account_id = string
    zone_name  = string
  })
}

variable "hosts" {
  type = object({
    apex   = string
    web    = string
    api    = string
    broker = string
  })
}

variable "billing" {
  type        = any
  description = "Read by TypeScript only: rendered into the API Worker (BILLING_PROVIDER)."
}

variable "grafana" {
  type = any
}

variable "imports" {
  type = object({
    foundation = optional(any)
    edge = optional(object({
      custom_domains = optional(map(string), {})
    }), {})
  })
  default = {}
}

variable "state_passphrase" {
  type      = string
  sensitive = true
}

variable "railway" { type = any }

# The fleet owns durable data shared across every environment.
variable "shared_data" {
  type = object({ account_id = string, bucket = string })
}

variable "alerting" {
  type        = any
  description = "Read by the bootstrap stack (stacks/bootstrap/alerting.tf)."
}

variable "synthetic_monitoring" {
  type        = any
  description = "Read by the bootstrap stack from every env file (modules/synthetic-monitoring)."
}

variable "ci_artifacts" {
  type = object({ account_id = string, bucket = string, retention_days = number })
}
