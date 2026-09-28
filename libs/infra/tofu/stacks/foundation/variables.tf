# Everything that varies between environments. Values come only from
# `tofu/envs/<env>.tfvars.json`; nothing in this stack or its modules names
# an environment.

# ---- global.tfvars.json (same for every environment) ----------------------

variable "project" {
  type = string
}

variable "state" {
  type = object({
    account_id = string
    bucket     = string
  })
  description = "Where encrypted state lives (the bootstrap stack owns this bucket)."
}

variable "infisical" {
  type = object({
    org_id       = string
    project_id   = string
    project_slug = string
  })
}

variable "neon_project" {
  type = object({
    project_id     = string
    root_branch_id = string
  })
  description = "The one Neon project every environment is a branch of, and its root branch (production's)."
}

variable "github" {
  type = any
}

variable "auth_relay" {
  type        = any
  description = "Read by the fleet stack and TypeScript (apps/auth-relay)."
}

variable "railway" {
  type = object({
    workspace_id = string
    project_id   = string
    service_id   = string
  })
  description = "The one broker project and its shared `emqx` service (owned by the fleet stack); each environment is a Railway environment of it."
}

variable "global_imports" {
  type    = any
  default = {}
}

# ---- envs/<env>.tfvars.json ---------------------------------------------------

variable "env" {
  type        = string
  description = "Secrets-store environment slug (Infisical env) — also the state key."
}

variable "suffix" {
  type        = string
  description = "Suffix for account-scoped resource names (Workers, buckets, policies)."
}

variable "display_name" {
  type = string
}

variable "protection" {
  type        = string
  description = "`production` enables the stricter plan policy (mass-delete brake)."
  validation {
    condition     = contains(["production", "standard"], var.protection)
    error_message = "protection must be `production` or `standard`."
  }
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
  type = object({
    stack_slug = string
    region     = string
  })
}

variable "secrets" {
  type = object({
    regenerate = optional(list(string), [])
  })
  default     = {}
  description = "Generated secrets whose stored value must not be adopted (e.g. copied from another environment); OpenTofu mints fresh ones."
}

variable "imports" {
  type = object({
    foundation = optional(object({
      r2_bucket           = optional(string)
      railway_environment = optional(string)
      railway_domain      = optional(string)
      broker_dns          = optional(string)
      broker_dns_verify   = optional(string)
      neon_branch         = optional(string)
      neon_endpoint       = optional(string)
      secrets             = optional(list(string), [])
    }), {})
    edge = optional(any)
  })
  default     = {}
  description = "Existing resource ids to adopt (import) instead of creating. Removed once adopted."
}

variable "state_passphrase" {
  type      = string
  sensitive = true
}

variable "infisical_token" {
  type      = string
  sensitive = true
}
