locals {
  environment_filter  = " * on(job, instance) group_left target_info{deployment_environment_name=\"${var.environment}\"}"
  runbooks            = "https://github.com/crvouga/gamezilla/blob/main/libs/observability-shared/README.md"
  correctness_runbook = "https://github.com/crvouga/gamezilla/blob/main/README.md#correctness-machinery"
  # Counts in a window, for counters that carry the environment on each point.
  # A Worker isolate's series starts at its first count, and a short-lived
  # isolate may report a single sample, which `increase` cannot see. Growth of
  # series that already existed plus the first value of series that appeared
  # in the window counts each event once, and one rule raises one alert.
  counters = {
    outbox_exhausted         = { selector = "outbox_deliveries_exhausted_total{deployment_environment_name=\"${var.environment}\"}", window = "1h" }
    outbox_drain_failures    = { selector = "outbox_drain_runs_total{deployment_environment_name=\"${var.environment}\",app_outcome=\"failure\"}", window = "15m" }
    billing_callback_refused = { selector = "billing_callbacks_total{deployment_environment_name=\"${var.environment}\",app_outcome=~\"unverified|failed\"}", window = "1h" }
  }
  windowed_count = {
    for name, counter in local.counters : name => "((sum(increase(${counter.selector}[${counter.window}])) or vector(0)) + (sum(min_over_time(${counter.selector}[${counter.window}]) unless min_over_time(${counter.selector}[${counter.window}] offset ${counter.window})) or vector(0)))"
  }
  alert_queries = {
    api_error_burn = {
      name     = "API availability fast burn"
      expr     = "(sum(rate(http_server_requests_total{job=\"gamezilla-server\",app_http_status_class=\"5xx\"}[5m])${local.environment_filter}) / sum(rate(http_server_requests_total{job=\"gamezilla-server\"}[5m])${local.environment_filter}) > 0.144) and (sum(rate(http_server_requests_total{job=\"gamezilla-server\",app_http_status_class=\"5xx\"}[1h])${local.environment_filter}) / sum(rate(http_server_requests_total{job=\"gamezilla-server\"}[1h])${local.environment_filter}) > 0.144) and (sum(increase(http_server_requests_total{job=\"gamezilla-server\"}[1h])${local.environment_filter}) > 100)"
      owner    = "runtime"
      severity = "critical"
      summary  = "The API is consuming the provisional 99% availability budget at more than 14.4 times its sustainable rate. Compare the current release, request failures and correlated database/dependency traces."
      runbook  = local.correctness_runbook
    }
    event_export_failures = {
      name     = "Reliable event exports repeatedly fail"
      expr     = "sum(increase(telemetry_business_event_export_attempts_total{telemetry_outcome=\"failure\"}[15m])${local.environment_filter}) > 10"
      owner    = "observability"
      severity = "warning"
      summary  = "Check OTLP credential scopes, ingestion responses and pending/exhausted telemetry outbox deliveries. Business operations are committed; preserve event identities when replaying."
      runbook  = local.correctness_runbook
    }
    schema_rejections = {
      name     = "Telemetry contract violations"
      expr     = "sum(increase(telemetry_logs_schema_violations_total[15m])${local.environment_filter}) > 0"
      owner    = "observability"
      severity = "warning"
      summary  = "Compare the producing release with its registered event contracts. Investigate undeclared event names, required attributes and incompatible schema versions before replaying."
      runbook  = local.correctness_runbook
    }
    pipeline_absent = {
      name     = "Telemetry heartbeat is absent"
      expr     = "(sum(count_over_time(telemetry_pipeline_heartbeat_total{deployment_environment_name=\"${var.environment}\"}[15m])) or vector(0)) == bool 0"
      owner    = "observability"
      severity = "critical"
      summary  = "The scheduled server heartbeat has not reached Grafana for fifteen minutes. Check scheduled Worker execution, OTLP authentication, metrics ingestion and the latest deployment."
      runbook  = local.correctness_runbook
    }
    outbox_exhausted = {
      name     = "Outbox deliveries exhausted their retries"
      expr     = "${local.windowed_count.outbox_exhausted} > 0"
      owner    = "runtime"
      severity = "warning"
      summary  = "Background work gave up after its last attempt and is parked, so its effect (a notice, an erasure, a match step) has not happened. Find the consumer and error in the logs; do not edit or delete the parked rows."
      runbook  = "${local.runbooks}#outbox-deliveries-exhausted-their-retries"
    }
    outbox_drain_failing = {
      name     = "Scheduled outbox drain keeps failing"
      expr     = "${local.windowed_count.outbox_drain_failures} >= 3"
      owner    = "runtime"
      severity = "critical"
      summary  = "The scheduled drain failed at least three times in fifteen minutes while the schedule still runs, so background work and telemetry export are stalled. Check the drain error, database reachability and the latest deployment."
      runbook  = "${local.runbooks}#scheduled-outbox-drain-keeps-failing"
    }
    billing_callbacks_refused = {
      name     = "Billing provider callbacks are being refused"
      expr     = "${local.windowed_count.billing_callback_refused} >= 3"
      owner    = "billing"
      severity = "critical"
      summary  = "At least three provider callbacks in an hour failed their signature check or processing, so payment and membership changes may not reach accounts. Compare the webhook signing secret with the provider and check the latest deployment; the provider retries refused deliveries."
      runbook  = "${local.runbooks}#billing-provider-callbacks-are-being-refused"
    }
  }
}

resource "grafana_rule_group" "this" {
  name             = "Business observability — ${var.environment}"
  folder_uid       = grafana_folder.this.uid
  interval_seconds = 60

  dynamic "rule" {
    for_each = local.alert_queries
    content {
      name           = rule.value.name
      uid            = "${replace(rule.key, "_", "-")}-${var.environment}"
      condition      = "B"
      for            = "5m"
      no_data_state  = "OK"
      exec_err_state = "Error"
      labels = {
        environment = var.environment
        owner       = rule.value.owner
        severity    = rule.value.severity
      }
      annotations = {
        summary     = rule.value.summary
        runbook_url = rule.value.runbook
      }
      data {
        ref_id         = "A"
        datasource_uid = local.metrics_uid
        relative_time_range {
          from = 3600
          to   = 0
        }
        model = jsonencode({
          refId      = "A", expr = rule.value.expr, instant = true, range = false,
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
