# Every alert rule is generated: `alert-rules.generated.json` comes from the
# objective files (specs/**/*.openslo.yaml), the indicator catalog and the
# pipeline-health alerts in libs/observability-shared-ts. A test fails while it
# differs from its generator; rewrite it with
#   bun run libs/observability-shared-ts/scripts/slo-generate.ts
# An expression carries __ENVIRONMENT__, replaced below by the environment
# being applied, so every environment on the shared metrics stack gets its own
# rules. The Grafana instance may be archived, in which case none of this is
# created; the hourly Health job evaluates the same policies without it
# (README.md, "Service level objectives").
locals {
  alert_rules  = jsondecode(file("${path.module}/alert-rules.generated.json"))
  rule_groups  = { for group in local.alert_rules.groups : group.key => group }
  group_suffix = " — ${var.environment}"
}

# The first group keeps the address and name it had when it held the four
# hand-written rules, so applying this updates it in place.
moved {
  from = grafana_rule_group.this
  to   = grafana_rule_group.groups["fast"]
}

resource "grafana_rule_group" "groups" {
  for_each = local.rule_groups

  name             = "${each.value.name}${local.group_suffix}"
  folder_uid       = grafana_folder.this.uid
  interval_seconds = each.value.interval_seconds

  dynamic "rule" {
    for_each = each.value.rules
    content {
      name           = rule.value.name
      uid            = "${rule.value.key}-${var.environment}"
      condition      = "B"
      for            = rule.value.for
      no_data_state  = "OK"
      exec_err_state = "Error"
      labels = merge(
        {
          environment = var.environment
          owner       = rule.value.owner
          severity    = rule.value.severity
        },
        rule.value.slo == "" ? tomap({}) : tomap({ slo = rule.value.slo })
      )
      annotations = merge(
        {
          summary             = rule.value.summary
          runbook_url         = rule.value.runbook_url
          investigate_command = rule.value.investigate_command
        },
        rule.value.slo == "" ? tomap({}) : tomap({
          burn_threshold = "${rule.value.burn_threshold}x"
          budget_spent   = rule.value.budget_spent
          burn_rate      = "{{ with $values.A }}{{ printf \"%.1f\" .Value }}x{{ else }}n/a{{ end }}"
        })
      )
      data {
        ref_id         = "A"
        datasource_uid = local.metrics_uid
        relative_time_range {
          from = 3600
          to   = 0
        }
        model = jsonencode({
          refId      = "A", expr = replace(rule.value.expr, "__ENVIRONMENT__", var.environment), instant = true, range = false,
          datasource = { type = "prometheus", uid = local.metrics_uid }
        })
      }
      data {
        ref_id         = "B"
        datasource_uid = "-100"
        relative_time_range {
          from = 0
          to   = 0
        }
        model = jsonencode({
          refId      = "B", type = "classic_conditions",
          datasource = { type = "__expr__", uid = "-100" },
          conditions = [{ evaluator = { type = "gt", params = [0] },
            operator = { type = "and" }, query = { params = ["A"] },
          reducer = { type = "last", params = [] }, type = "query" }]
        })
      }
    }
  }
}
