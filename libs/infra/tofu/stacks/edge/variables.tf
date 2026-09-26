# The subset of the environment file the edge stack reads. The env file is
# shared with the foundation stack, so every other key is declared too
# (OpenTofu rejects undeclared variables in a -var-file) but unused here.

# ---- global.tfvars.json (same for every environment) ----------------------

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
  type = any
}

variable "neon_project" {
  type = any
}

variable "github" {
  type = any
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

variable "railway" {
  type = any
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
