terraform {
  required_providers {
    grafana = { source = "grafana/grafana" }
  }
}

variable "environment" {
  type = string
}

variable "namespace" {
  type        = string
  description = "The technical namespace telemetry service names start with (`<namespace>-server`)."
}

variable "grafana_url" {
  type        = string
  description = "The Grafana instance (https://<stack>.grafana.net): alert links point into it."
}

# Grafana Cloud provisions these ids on every stack. The slug-qualified names
# (grafanacloud-<slug>-prom, grafanacloud-<slug>-logs) are a different field.
# Reading them with data.grafana_data_source needs the views provider, whose
# auth is the service account token this same apply creates. The Grafana
# provider then has no client and the first plan fails.
locals {
  metrics_uid = "grafanacloud-prom"
  logs_uid    = "grafanacloud-logs"
}

resource "grafana_folder" "this" {
  lifecycle {
    destroy = false
  }

  title = "Business observability — ${var.environment}"
  uid   = "business-observability-${var.environment}"
}

resource "grafana_dashboard" "this" {
  lifecycle {
    destroy = false
  }

  for_each = fileset(path.module, "dashboards/*.json.tftpl")
  folder   = grafana_folder.this.uid
  config_json = templatefile("${path.module}/${each.value}", {
    environment = var.environment
    namespace   = var.namespace
    metrics_uid = local.metrics_uid
    logs_uid    = local.logs_uid
  })
}
