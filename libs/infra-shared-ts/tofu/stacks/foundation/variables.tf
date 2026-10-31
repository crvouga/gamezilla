# Everything that varies between environments. Values come only from
# `tofu/envs/<env>.tfvars.json`; nothing in this stack or its modules names
# an environment.

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
  description = "Where encrypted state lives (the bootstrap stack owns this bucket)."
}

variable "infisical" {
  type = object({
    org_id       = string
    project_id   = string
    project_slug = string
  })
}

variable "planetscale" {
  type = object({
    organization = string
    region       = string
  })
  description = "PlanetScale organization slug and the Postgres region every environment's database lives in."
}

variable "aws" {
  type = object({
    region = string
  })
  description = "AWS region for IoT Core. One region: growth does not add regions to operate."
}

variable "github" {
  type = any
}

variable "auth_relay" {
  type        = any
  description = "Read by the fleet stack and TypeScript (apps/auth-relay-ts)."
}

variable "aws_access_key_id" {
  type        = string
  default     = ""
  sensitive   = true
  description = "AWS access key for this provider (TF_VAR_aws_access_key_id). GitHub OIDC session or a local AWS login. Not the R2 state key."
}

variable "aws_secret_access_key" {
  type        = string
  default     = ""
  sensitive   = true
  description = "AWS secret key paired with aws_access_key_id. Not the R2 state key."
}

variable "aws_session_token" {
  type        = string
  default     = ""
  sensitive   = true
  description = "AWS session token when aws_access_key_id is a temporary OIDC or SSO credential. Empty for long-lived keys."
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
      r2_bucket  = optional(string)
      broker_dns = optional(string)
      secrets    = optional(list(string), [])
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
