# Traces: a Grafana Cloud stack, a write-only ingest policy and a read-only
# query policy, each with one token.
#
# STATEFUL: the stack holds trace history. `delete_protection` on the Grafana
# side, `prevent_destroy` here, and the plan policy all refuse to delete it.

terraform {
  required_providers {
    grafana = { source = "grafana/grafana" }
  }
}

variable "stack_slug" {
  type        = string
  description = "Globally unique stack slug → https://<slug>.grafana.net."
}

variable "region" {
  type = string
}

variable "write_policy_name" {
  type = string
}

variable "read_policy_name" {
  type = string
}

resource "grafana_cloud_stack" "this" {
  name              = var.stack_slug
  slug              = var.stack_slug
  region_slug       = var.region
  delete_protection = true

  lifecycle {
    prevent_destroy = true
    # The display name is edited in the Grafana UI; identity is the slug.
    ignore_changes = [name, description, labels]
  }
}

resource "grafana_cloud_access_policy" "write" {
  region = var.region
  name   = var.write_policy_name
  scopes = ["traces:write"]

  realm {
    type       = "stack"
    identifier = grafana_cloud_stack.this.id
  }
}

resource "grafana_cloud_access_policy" "read" {
  region = var.region
  name   = var.read_policy_name
  scopes = ["traces:read"]

  realm {
    type       = "stack"
    identifier = grafana_cloud_stack.this.id
  }
}

resource "grafana_cloud_access_policy_token" "write" {
  region           = var.region
  access_policy_id = grafana_cloud_access_policy.write.policy_id
  name             = "${var.write_policy_name}-token"
}

resource "grafana_cloud_access_policy_token" "read" {
  region           = var.region
  access_policy_id = grafana_cloud_access_policy.read.policy_id
  name             = "${var.read_policy_name}-token"
}

locals {
  otlp_base  = trimsuffix(trimsuffix(grafana_cloud_stack.this.otlp_url, "/"), "/otlp")
  tempo_base = trimsuffix(trimsuffix(grafana_cloud_stack.this.traces_url, "/"), "/tempo")
}

output "collector_url" {
  value = "${local.otlp_base}/otlp/v1/traces"
}

output "collector_user" {
  value = tostring(grafana_cloud_stack.this.id)
}

output "collector_token" {
  value     = grafana_cloud_access_policy_token.write.token
  sensitive = true
}

output "tempo_url" {
  value = "${local.tempo_base}/tempo"
}

output "tempo_user" {
  value = tostring(grafana_cloud_stack.this.traces_user_id)
}

output "tempo_token" {
  value     = grafana_cloud_access_policy_token.read.token
  sensitive = true
}
