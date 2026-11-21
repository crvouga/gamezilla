# Alerts remain visible in IRM without notifying any person.
# Health, Release and Verify Nightly upsert GitHub issues for failures.

terraform {
  required_providers {
    grafana = { source = "grafana/grafana" }
  }
}

variable "brand_name" {
  type        = string
  description = "The name people see in the integration."
}

# What a notification says. Every generated rule carries its links as
# annotations (observability-views/alerts.tf): runbook, dashboard, error logs
# and failed traces in Grafana Explore, plus a `bun obs` command. These lines
# put them in front of whoever answers, a person or an agent
# reading the alert group through the IRM API: `key: value` lines, absolute
# links, and the first thing to run.
locals {
  alert_first = "{% if payload.get('alerts') %}{% set a = payload.alerts[0] %}{% else %}{% set a = {} %}{% endif %}{% if a.get('annotations') %}{% set ann = a.annotations %}{% else %}{% set ann = payload.get('commonAnnotations', {}) %}{% endif %}{% if a.get('labels') %}{% set lab = a.labels %}{% else %}{% set lab = payload.get('commonLabels', {}) %}{% endif %}"
  alert_title = "${local.alert_first}[{{ lab.get('environment', 'unknown') }}] {{ lab.get('alertname', payload.get('title', 'Alert')) }}{% if ann.get('slice') %} · {{ ann.slice }}{% endif %}"
  alert_message = join("\n", [
    "${local.alert_first}**{{ ann.get('summary', payload.get('message', '')) }}**",
    "status: {{ payload.get('status', a.get('status', '')) }} · firing: {{ payload.get('alerts', []) | length }}",
    "environment: {{ lab.get('environment', '') }} · capability: {{ lab.get('capability', '') }} · owner: {{ lab.get('owner', '') }} · severity: {{ lab.get('severity', '') }} · route: {{ lab.get('route', '') }}",
    "{% if lab.get('slo') %}objective: {{ lab.slo }} (tier {{ lab.get('tier', '') }}) · burn_rate: {{ ann.get('burn_rate', 'n/a') }} (fires at {{ ann.get('burn_threshold', 'n/a') }}) · budget_remaining: {{ ann.get('budget_remaining', 'n/a') }}{% endif %}{% if ann.get('covers') %}covers: {{ ann.covers }}{% endif %}{% if ann.get('slice') %} · slice: {{ ann.slice }}{% endif %}{{ '' }}",
    "runbook: {{ ann.get('runbook_url', '') }}",
    "dashboard: {{ ann.get('dashboard_url', a.get('dashboardURL', '')) }}",
    "error_logs: {{ ann.get('logs_url', '') }}",
    "failed_traces: {{ ann.get('traces_url', '') }}",
    "alert_rule: {{ a.get('generatorURL', '') }}",
    "silence: {{ a.get('silenceURL', '') }}",
    "started: {{ a.get('startsAt', '') }}",
    "",
    "next (copy and run):",
    "1. {{ ann.get('investigate_command', 'bun obs last --errors') }}",
    "2. Follow the runbook section above; it names the checks and fixes for this alert.",
  ])
  alert_link = "${local.alert_first}{{ ann.get('dashboard_url') or ann.get('runbook_url') or a.get('generatorURL', '') }}"
}

resource "grafana_oncall_integration" "alerts" {
  name = "${var.brand_name} alerts"
  type = "grafana_alerting"
  # Every alert stays in the web inbox; no escalation chain delivers it.
  default_route {}

  templates {
    source_link = local.alert_link
    web {
      title   = local.alert_title
      message = local.alert_message
    }
  }
}

resource "grafana_contact_point" "irm" {
  name = "Grafana IRM"
  oncall {
    url = grafana_oncall_integration.alerts.link
  }
}

resource "grafana_notification_policy" "this" {
  contact_point = grafana_contact_point.irm.name
  group_by      = ["alertname", "environment"]

  policy {
    matcher {
      label = "route"
      match = "=~"
      value = "page|push"
    }
    contact_point = grafana_contact_point.irm.name
    # Group related repeats without hiding a different failing capability.
    group_by        = ["environment", "route", "capability", "alertname"]
    group_wait      = "0s"
    group_interval  = "1m"
    repeat_interval = "4h"
  }
}
