# Every Grafana SLO is generated: `grafana-slos.generated.json` comes from the
# live objective files (specs/**/*.openslo.yaml) and the indicator catalog in
# libs/observability-shared-ts. A test fails while it differs from its
# generator, and while any `grafana_slo` is declared anywhere but here, so no
# SLO exists without an objective file. Rewrite it with
#   bun run libs/observability-shared-ts/scripts/slo-generate.ts
#
# Grafana SLO keeps each objective's budget and dashboards. It raises no
# alerts of its own (no `alerting` block): its rules cannot require a least
# amount of traffic or a check's cadence, so at today's volumes one failed
# request would page. alerts.tf raises the same fast and slow burn from the
# same OpenSLO policies instead.
locals {
  grafana_slos = jsondecode(file("${path.module}/grafana-slos.generated.json"))
  objectives   = { for slo in local.grafana_slos.slos : slo.key => slo }
}

resource "grafana_slo" "objectives" {
  lifecycle {
    destroy = false
  }

  for_each = local.objectives

  # Every environment on the shared stack has its own copy of each SLO.
  name        = "${each.value.name} — ${var.environment}"
  description = each.value.description
  folder_uid  = grafana_folder.this.uid

  query {
    type = "freeform"
    freeform {
      query = replace(each.value.query, "__ENVIRONMENT__", var.environment)
    }
  }

  objectives {
    value  = each.value.objective
    window = each.value.window
  }

  destination_datasource {
    uid = local.metrics_uid
  }

  dynamic "label" {
    for_each = merge(each.value.labels, { environment = var.environment })
    content {
      key   = label.key
      value = label.value
    }
  }
}

locals {
  # Grafana SLO names each objective's dashboard after the SLO's id.
  slo_dashboards = {
    for key, slo in grafana_slo.objectives :
    key => "${var.grafana_url}/d/grafana_slo_app-${slo.id}"
  }
  folder_url = "${var.grafana_url}/dashboards/f/${grafana_folder.this.uid}"
}
