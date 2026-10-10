# Traces for one environment: a write-only ingest policy and a read-only
# query policy on the shared stack, each with its own token, so one
# environment's tokens are revoked or rotated without touching another's.
# Both are scoped to the whole (shared) stack; spans carry
# `deployment.environment.name` to tell environments apart.

terraform {
  required_providers {
    grafana = { source = "grafana/grafana" }
  }
}

variable "stack_slug" {
  type        = string
  description = "The shared stack (global.tfvars.json `grafana.stack_slug`)."
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

# The shared stack (bootstrap stack, modules/trace-stack): asserted, never
# managed here.
data "grafana_cloud_stack" "this" {
  slug = var.stack_slug

  lifecycle {
    postcondition {
      # The Grafana instance can be archived while hosted Tempo stays active.
      # This module uses tracing only; require its backend, and reject terminal
      # or unknown stack states without replacing any existing trace storage.
      condition     = contains(["active", "paused", "archived"], self.status) && self.traces_status == "active"
      error_message = "Grafana Cloud stack ${var.stack_slug} is ${self.status}, tracing is ${self.traces_status} — restore the existing tracing service before deploying."
    }
  }
}

resource "grafana_cloud_access_policy" "write" {
  region = var.region
  name   = var.write_policy_name
  scopes = ["traces:write", "logs:write", "metrics:write"]

  realm {
    type       = "stack"
    identifier = data.grafana_cloud_stack.this.id
  }
}

resource "grafana_cloud_access_policy" "read" {
  region = var.region
  name   = var.read_policy_name
  scopes = ["traces:read", "logs:read", "metrics:read"]

  realm {
    type       = "stack"
    identifier = data.grafana_cloud_stack.this.id
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
  otlp_base  = trimsuffix(trimsuffix(data.grafana_cloud_stack.this.otlp_url, "/"), "/otlp")
  tempo_base = trimsuffix(trimsuffix(data.grafana_cloud_stack.this.traces_url, "/"), "/tempo")
}

output "collector_url" {
  value = "${local.otlp_base}/otlp/v1/traces"
}

output "logs_url" {
  value = "${local.otlp_base}/otlp/v1/logs"
}

output "metrics_collector_url" {
  value = "${local.otlp_base}/otlp/v1/metrics"
}

output "collector_user" {
  value = tostring(data.grafana_cloud_stack.this.id)
}

output "collector_token" {
  value     = grafana_cloud_access_policy_token.write.token
  sensitive = true
}

output "tempo_url" {
  value = "${local.tempo_base}/tempo"
}

output "tempo_user" {
  value = tostring(data.grafana_cloud_stack.this.traces_user_id)
}

output "tempo_token" {
  value     = grafana_cloud_access_policy_token.read.token
  sensitive = true
}

# A stack-scoped management credential is kept in encrypted OpenTofu state.
# It is never published to application Workers or browsers.
resource "grafana_cloud_access_policy" "management" {
  region = var.region
  name   = "${var.write_policy_name}-management"
  scopes = ["stacks:read", "stack-service-accounts:write"]
  realm {
    type       = "stack"
    identifier = data.grafana_cloud_stack.this.id
  }
}

resource "grafana_cloud_access_policy_token" "management" {
  region           = var.region
  access_policy_id = grafana_cloud_access_policy.management.policy_id
  name             = "${var.write_policy_name}-management-token"
}

output "management_token" {
  value     = grafana_cloud_access_policy_token.management.token
  sensitive = true
}

output "grafana_url" {
  value = data.grafana_cloud_stack.this.url
}
