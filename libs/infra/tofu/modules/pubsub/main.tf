# MQTT broker: this environment's instance of the shared EMQX service
# (modules/pubsub-project) — a Railway environment of the one project, its
# credentials and its hostname — behind a Cloudflare DNS name.
#
# STATEFUL: the Railway environment (the broker instance and its
# `/opt/emqx/data` volume) is never destroyed or replaced outside a standard
# environment's teardown (policy/stateful.rego).

terraform {
  required_providers {
    cloudflare = { source = "cloudflare/cloudflare" }
    railway    = { source = "terraform-community-providers/railway" }
    random     = { source = "hashicorp/random" }
  }
}

variable "project_id" {
  type        = string
  description = "The shared Railway project (modules/pubsub-project, fleet stack)."
}

variable "service_id" {
  type        = string
  description = "The shared `emqx` service in that project."
}

variable "environment_name" {
  type        = string
  description = "This environment's Railway environment; production is the project's default one."
}

variable "hostname" {
  type = string
}

variable "zone_id" {
  type = string
}

variable "zone_name" {
  type = string
}

variable "target_port" {
  type    = number
  default = 8080
}

variable "credentials" {
  type = object({
    api_key            = string
    api_secret         = string
    jwt_secret         = string
    dashboard_password = string
  })
  sensitive   = true
  description = "Broker credentials (resolved by the secrets module: kept once minted)."
}

# Not a fork: Railway gives it an instance of every service in the project
# (with its own volume) and keeps that instance's build and region in step
# with the shared service.
resource "railway_environment" "this" {
  name       = var.environment_name
  project_id = var.project_id
}

locals {
  environment_id = railway_environment.this.id
  variables = {
    PORT                    = tostring(var.target_port)
    EMQX_API_KEY            = var.credentials.api_key
    EMQX_API_SECRET         = var.credentials.api_secret
    EMQX_JWT_SECRET         = var.credentials.jwt_secret
    EMQX_DASHBOARD_PASSWORD = var.credentials.dashboard_password
  }
}

# Variables: importing cannot read Railway's stored values, so the first
# apply re-sends them (same values, except any regenerated) and Railway
# redeploys the broker once; MQTT clients reconnect with backoff.
resource "railway_variable" "broker" {
  for_each = nonsensitive(toset(keys(local.variables)))

  environment_id = local.environment_id
  service_id     = var.service_id
  name           = each.key
  value          = local.variables[each.key]
}

resource "railway_custom_domain" "broker" {
  environment_id = local.environment_id
  service_id     = var.service_id
  domain         = var.hostname
  target_port    = var.target_port
}

resource "cloudflare_dns_record" "broker" {
  zone_id = var.zone_id
  name    = var.hostname
  type    = "CNAME"
  content = railway_custom_domain.broker.dns_record_value
  proxied = false
  ttl     = 1
  comment = "OpenTofu: libs/infra pubsub"
}

resource "cloudflare_dns_record" "broker_verification" {
  zone_id = var.zone_id
  name    = "${railway_custom_domain.broker.verification_host_label}.${var.zone_name}"
  type    = "TXT"
  content = railway_custom_domain.broker.verification_record_value
  ttl     = 1
  comment = "OpenTofu: libs/infra pubsub"
}

output "api_url" {
  value = "https://${var.hostname}"
}

output "wss_url" {
  value = "wss://${var.hostname}/mqtt"
}
