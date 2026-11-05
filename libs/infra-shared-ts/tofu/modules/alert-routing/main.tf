# Who is told about an alert, and how: one notification policy and one
# Grafana IRM integration for the whole stack, shared by every environment.
# Every generated rule carries a `route` label (libs/observability-shared-ts
# `routeOf`, from the objective's tier and the alert's severity):
#
# | route  | goes to                                                    |
# | ------ | ---------------------------------------------------------- |
# | page   | IRM, paging chain (important notification rules), prd only |
# | push   | IRM, push chain (default notification rules, never pages)  |
#
# A `page` from any environment but production is pushed, not paged.
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
  description = "The only environment whose `page` alerts page."
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

resource "grafana_oncall_integration" "alerts" {
  name = "${var.brand_name} alerts"
  type = "grafana_alerting"
  default_route {
    escalation_chain_id = grafana_oncall_escalation_chain.push.id
  }
}

resource "grafana_oncall_route" "page" {
  integration_id      = grafana_oncall_integration.alerts.id
  escalation_chain_id = grafana_oncall_escalation_chain.page.id
  routing_type        = "jinja2"
  routing_regex       = "{{ payload.commonLabels.route == \"page\" and payload.commonLabels.environment == \"${var.paging_environment}\" }}"
  position            = 0
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
