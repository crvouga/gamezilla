terraform {
  required_providers {
    grafana = { source = "grafana/grafana" }
  }
}

variable "environment" {
  type = string
}

variable "stack_slug" {
  type = string
}

data "grafana_data_source" "metrics" {
  name = "grafanacloud-${var.stack_slug}-prom"
}

data "grafana_data_source" "logs" {
  name = "grafanacloud-${var.stack_slug}-logs"
}

resource "grafana_folder" "this" {
  title = "Business observability — ${var.environment}"
  uid   = "business-observability-${var.environment}"
}

resource "grafana_dashboard" "this" {
  for_each = fileset(path.module, "dashboards/*.json.tftpl")
  folder   = grafana_folder.this.uid
  config_json = templatefile("${path.module}/${each.value}", {
    environment = var.environment
    metrics_uid = data.grafana_data_source.metrics.uid
    logs_uid    = data.grafana_data_source.logs.uid
  })
}
