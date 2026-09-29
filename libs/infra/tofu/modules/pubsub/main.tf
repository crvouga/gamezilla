# MQTT broker: this environment's instance of the shared EMQX service
# (modules/pubsub-project) — a Railway environment of the one project, its
# credentials and its hostname — behind a Cloudflare DNS name.
#
# STATEFUL: the Railway environment (the broker instance and its
# `/opt/emqx/data` volume) is never destroyed or replaced outside a standard
# environment's teardown (policy/stateful.rego).
#
# Production adopts the project's default `production` environment. Every other
# environment is a duplicate of it (`clone_from`): the provider's
# `railway_environment` can only make an EMPTY environment, which holds no
# instance of the `emqx` service, so a custom domain there fails with
# "ServiceInstance not found" (clone-environment.sh).

terraform {
  required_providers {
    cloudflare = { source = "cloudflare/cloudflare" }
    railway    = { source = "terraform-community-providers/railway" }
    random     = { source = "hashicorp/random" }
    http       = { source = "hashicorp/http" }
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

variable "clone_from" {
  type        = string
  default     = null
  description = "Railway environment to duplicate into `environment_name`; null adopts `environment_name` as an existing environment (production's default one)."
}

variable "railway_token" {
  type        = string
  sensitive   = true
  description = "Railway API token: reads the environment ids of the project (the provider has no data source for them)."
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

locals {
  cloned      = var.clone_from != null
  graphql_url = "https://backboard.railway.com/graphql/v2"
}

# Production: the project's default environment, adopted by import.
resource "railway_environment" "default" {
  count = local.cloned ? 0 : 1

  name       = var.environment_name
  project_id = var.project_id
}

# Everything else: a duplicate of `clone_from`, which carries the service's
# instance (build, region, volume). Deleted with the environment's teardown.
resource "terraform_data" "clone" {
  count = local.cloned ? 1 : 0

  triggers_replace = [var.project_id, var.environment_name, var.clone_from]
  input = {
    project_id = var.project_id
    name       = var.environment_name
    source     = var.clone_from
  }

  provisioner "local-exec" {
    command = "${path.module}/clone-environment.sh create"
    environment = {
      PROJECT_ID = var.project_id
      NAME       = var.environment_name
      SOURCE     = var.clone_from
    }
  }

  # RAILWAY_TOKEN comes from the process environment (`secrets-run`).
  provisioner "local-exec" {
    when    = destroy
    command = "${path.module}/clone-environment.sh delete"
    environment = {
      PROJECT_ID = self.input.project_id
      NAME       = self.input.name
      SOURCE     = self.input.source
    }
  }
}

# The clone's id, read back from Railway (read-only, so drift checks run it
# too). Unknown until the clone exists, which orders everything below after it.
data "http" "environments" {
  count = local.cloned ? 1 : 0

  url    = local.graphql_url
  method = "POST"
  request_headers = {
    Authorization  = "Bearer ${var.railway_token}"
    "Content-Type" = "application/json"
  }
  request_body = jsonencode({
    query     = "query($id: String!) { project(id: $id) { environments { edges { node { id name } } } } }"
    variables = { id = var.project_id }
  })

  depends_on = [terraform_data.clone]

  lifecycle {
    postcondition {
      condition     = self.status_code == 200 && can(jsondecode(self.response_body).data.project.environments.edges)
      error_message = "Railway did not list the project's environments (HTTP ${self.status_code}): ${self.response_body}"
    }
  }
}

locals {
  environment_ids = local.cloned ? {
    for e in jsondecode(data.http.environments[0].response_body).data.project.environments.edges : e.node.name => e.node.id
  } : {}
  environment_id = local.cloned ? local.environment_ids[var.environment_name] : railway_environment.default[0].id
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
