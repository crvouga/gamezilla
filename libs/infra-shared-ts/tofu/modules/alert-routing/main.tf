# Who is told about an alert, and how: one notification policy and one
# Grafana IRM integration for the whole stack, shared by every environment.
# Every generated rule carries a `route` label (libs/observability-shared-ts
# `routeOf`, from the objective's tier and the alert's severity):
#
# | route  | goes to                                                    |
# | ------ | ---------------------------------------------------------- |
# | page   | IRM, paging chain (important notification rules), prd only |
# | push   | IRM, push chain (default notification rules), prd only     |
#
# Only production notifies anyone. An alert from any other environment
# (dev) still opens an alert group in IRM, visible on the web, but no phone
# is told: dev is for building, and nobody needs to act on it.
#
# Stateless: alert history stays in Grafana and IRM if any of this is replaced.

terraform {
  required_providers {
    grafana = { source = "grafana/grafana" }
  }
}

variable "responder" {
  type        = string
  description = "The IRM username of the person on call."
}

variable "paging_environment" {
  type        = string
  description = "The only environment whose alerts notify anyone: its `page` alerts page, its `push` alerts push."
}

variable "brand_name" {
  type        = string
  description = "The name people see in the integration."
}

data "grafana_oncall_user" "responder" {
  username = var.responder
}

resource "grafana_oncall_escalation_chain" "page" {
  name = "Page the person on call"
}

resource "grafana_oncall_escalation" "page" {
  escalation_chain_id = grafana_oncall_escalation_chain.page.id
  type                = "notify_persons"
  persons_to_notify   = [data.grafana_oncall_user.responder.id]
  important           = true
  position            = 0
}

resource "grafana_oncall_escalation_chain" "push" {
  name = "Push to the person on call"
}

resource "grafana_oncall_escalation" "push" {
  escalation_chain_id = grafana_oncall_escalation_chain.push.id
  type                = "notify_persons"
  persons_to_notify   = [data.grafana_oncall_user.responder.id]
  important           = false
  position            = 0
}

# What a notification says. Every generated rule carries its links as
# annotations (observability-views/alerts.tf): runbook, dashboard, error logs
# and failed traces in Grafana Explore, plus a `bun obs` command. These lines
# put them in front of whoever answers, a person on a phone or an agent
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
  # Unmatched alerts (any environment but production) notify nobody.
  default_route {}

  templates {
    source_link = local.alert_link
    web {
      title   = local.alert_title
      message = local.alert_message
    }
    mobile_app {
      title   = local.alert_title
      message = "${local.alert_first}{{ ann.get('summary', '') }} Runbook: {{ ann.get('runbook_url', '') }} · Dashboard: {{ ann.get('dashboard_url', '') }}"
    }
  }
}

resource "grafana_oncall_route" "page" {
  integration_id      = grafana_oncall_integration.alerts.id
  escalation_chain_id = grafana_oncall_escalation_chain.page.id
  routing_type        = "jinja2"
  routing_regex       = "{{ payload.commonLabels.route == \"page\" and payload.commonLabels.environment == \"${var.paging_environment}\" }}"
  position            = 0
}

resource "grafana_oncall_route" "push" {
  integration_id      = grafana_oncall_integration.alerts.id
  escalation_chain_id = grafana_oncall_escalation_chain.push.id
  routing_type        = "jinja2"
  routing_regex       = "{{ payload.commonLabels.environment == \"${var.paging_environment}\" }}"
  position            = 1
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

# Personal rules are required as well as the contact point: an IRM alert
# does not reach a phone unless its responder has a mobile notification step.
resource "grafana_oncall_user_notification_rule" "mobile" {
  user_id  = data.grafana_oncall_user.responder.id
  position = 0
  type     = "notify_by_mobile_app"
}

# Give mobile delivery its measured minute before any existing fallback rule.
# Existing email/phone rules are preserved after this position, not deleted.
resource "grafana_oncall_user_notification_rule" "mobile_wait" {
  depends_on = [grafana_oncall_user_notification_rule.mobile]
  user_id    = data.grafana_oncall_user.responder.id
  position   = 1
  type       = "wait"
  duration   = 60
}

resource "grafana_oncall_user_notification_rule" "important_mobile" {
  user_id   = data.grafana_oncall_user.responder.id
  important = true
  position  = 0
  type      = "notify_by_mobile_app_critical"
}

resource "grafana_oncall_user_notification_rule" "important_wait" {
  depends_on = [grafana_oncall_user_notification_rule.important_mobile]
  user_id    = data.grafana_oncall_user.responder.id
  important  = true
  position   = 1
  type       = "wait"
  duration   = 60
}

resource "grafana_oncall_user_notification_rule" "important_repeat" {
  depends_on = [grafana_oncall_user_notification_rule.important_wait]
  user_id    = data.grafana_oncall_user.responder.id
  important  = true
  position   = 2
  type       = "notify_by_mobile_app_critical"
}
