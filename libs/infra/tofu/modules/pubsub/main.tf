# MQTT broker: EMQX on Railway behind a Cloudflare DNS name.
#
# STATEFUL: the Railway project and the service (which owns the
# `/opt/emqx/data` volume) are never destroyed or replaced.

terraform {
  required_providers {
    cloudflare = { source = "cloudflare/cloudflare" }
    railway    = { source = "terraform-community-providers/railway" }
    random     = { source = "hashicorp/random" }
  }
}

variable "project_name" {
  type = string
}

variable "workspace_id" {
  type = string
}

variable "github_repo" {
  type        = string
  description = "owner/repo the broker image builds from."
}

variable "root_directory" {
  type = string
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

variable "region" {
  type        = string
  default     = "us-west2"
  description = "Railway region; pinned so the broker never moves (its volume lives there)."
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

resource "railway_project" "this" {
  name         = var.project_name
  workspace_id = var.workspace_id

  lifecycle {
    prevent_destroy = true
  }
}

locals {
  environment_id = railway_project.this.default_environment.id
}

resource "railway_service" "emqx" {
  name               = "emqx"
  project_id         = railway_project.this.id
  source_repo        = var.github_repo
  source_repo_branch = "main"
  root_directory     = var.root_directory
  regions            = [{ region = var.region, num_replicas = 1 }]

  volume = {
    name       = "emqx-volume"
    mount_path = "/opt/emqx/data"
  }

  lifecycle {
    prevent_destroy = true
  }
}

locals {
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
  service_id     = railway_service.emqx.id
  name           = each.key
  value          = local.variables[each.key]
}

resource "railway_custom_domain" "broker" {
  environment_id = local.environment_id
  service_id     = railway_service.emqx.id
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
