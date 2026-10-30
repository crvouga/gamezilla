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
  lifecycle {
    destroy = false
  }

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
      # `route` decides who is told (routing.tf in the bootstrap stack's
      # alert-routing module): page, push or the daily digest.
      labels = merge(
        {
          environment = var.environment
          owner       = rule.value.owner
          severity    = rule.value.severity
          route       = rule.value.route
          capability  = rule.value.capability
        },
        rule.value.slo == "" ? tomap({}) : tomap({ slo = rule.value.slo }),
        rule.value.tier == "" ? tomap({}) : tomap({ tier = rule.value.tier })
      )
      annotations = merge(
        {
          summary             = rule.value.summary
          runbook_url         = rule.value.runbook_url
          investigate_command = rule.value.investigate_command
          logs_url            = "${var.grafana_url}${replace(rule.value.logs_path, "__ENVIRONMENT__", var.environment)}"
          traces_url          = "${var.grafana_url}${replace(rule.value.traces_path, "__ENVIRONMENT__", var.environment)}"
          dashboard_url       = lookup(local.slo_dashboards, rule.value.slo, local.folder_url)
        },
        rule.value.covers == "" ? tomap({}) : tomap({ covers = rule.value.covers }),
        # A split rule raises one alert per route group, check or probe; this
        # names the one that is failing.
        rule.value.slice_label == "" ? tomap({}) : tomap({
          slice = "{{ index $labels \"${rule.value.slice_label}\" }}"
        }),
        rule.value.slo == "" ? tomap({}) : tomap({
          burn_threshold   = "${rule.value.burn_threshold}x"
          budget_spent     = rule.value.budget_spent
          burn_rate        = "{{ with $values.A }}{{ printf \"%.1f\" .Value }}x{{ else }}n/a{{ end }}"
          budget_remaining = "{{ with $values.C }}{{ humanizePercentage .Value }}{{ else }}n/a{{ end }}"
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
      # The objective's error budget still left over its whole window.
      dynamic "data" {
        for_each = rule.value.budget_expr == "" ? [] : [rule.value.budget_expr]
        content {
          ref_id         = "C"
          datasource_uid = local.metrics_uid
          relative_time_range {
            from = 3600
            to   = 0
          }
          model = jsonencode({
            refId      = "C", expr = replace(data.value, "__ENVIRONMENT__", var.environment), instant = true, range = false,
            datasource = { type = "prometheus", uid = local.metrics_uid }
          })
        }
      }
      # A threshold, not a classic condition: every series A answers (one
      # per route group, check or probe of a split rule) is its own alert.
      data {
        ref_id         = "B"
        datasource_uid = "__expr__"
        relative_time_range {
          from = 0
          to   = 0
        }
        model = jsonencode({
          refId      = "B", type = "threshold", expression = "A",
          datasource = { type = "__expr__", uid = "__expr__" },
          conditions = [{ evaluator = { type = "gt", params = [0] } }]
        })
      }
    }
  }
}
