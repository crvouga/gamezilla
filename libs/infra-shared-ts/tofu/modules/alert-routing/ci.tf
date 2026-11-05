# GitHub sends completion events even when checkout, secrets or verification
# failed before a workflow could send a notification. No fifth workflow and
# no notification credential exposed to pull-request code.
locals {
  ci_relevant = "payload.get('action') == 'completed' and payload.get('workflow_run', {}).get('head_branch') == 'main' and payload.get('workflow_run', {}).get('path') in ['.github/workflows/deploy.yml', '.github/workflows/verify-nightly.yml', '.github/workflows/health.yml', '.github/workflows/verify-pr.yml'] and payload.get('workflow_run', {}).get('event') in ['push', 'schedule', 'workflow_dispatch', 'workflow_call']"
  ci_failed   = "payload.get('workflow_run', {}).get('conclusion') in ['failure', 'timed_out', 'action_required', 'startup_failure']"
}

resource "grafana_oncall_integration" "ci" {
  name = "${var.brand_name} CI"
  type = "webhook"
  # Unmatched events (including GitHub's initial ping) never notify.
  default_route {}

  templates {
    # One incident per run: a later, unrelated green run cannot hide a failed
    # release. A successful rerun resolves the same incident. Progress and
    # cancellation events get their own resolved group and cannot clear it.
    grouping_key   = "{% if ${local.ci_relevant} and (${local.ci_failed} or payload.workflow_run.conclusion == 'success') %}{{ payload.repository.id }}-{{ payload.workflow_run.id }}{% else %}ignored-{{ payload.get('workflow_run', {}).get('id', 'ping') }}-{{ payload.get('action', 'ping') }}-{{ payload.get('workflow_run', {}).get('run_attempt', 0) }}{% endif %}"
    resolve_signal = "{{ not (${local.ci_relevant} and ${local.ci_failed}) }}"
    source_link    = "{{ payload.get('workflow_run', {}).get('html_url', '') }}"
    web {
      title   = "{{ payload.get('workflow_run', {}).get('name', 'CI') }}: {{ payload.get('workflow_run', {}).get('conclusion', 'ignored') }}"
      message = "{{ payload.get('repository', {}).get('full_name', '') }} main · {{ payload.get('workflow_run', {}).get('head_sha', '') }}\nRead the failed jobs and rerun after fixing the cause: {{ payload.get('workflow_run', {}).get('html_url', '') }}"
    }
    mobile_app {
      title   = "{{ payload.get('workflow_run', {}).get('name', 'CI') }} is red"
      message = "Read the failed jobs: {{ payload.get('workflow_run', {}).get('html_url', '') }}"
    }
  }
}

resource "grafana_oncall_route" "ci" {
  integration_id      = grafana_oncall_integration.ci.id
  escalation_chain_id = grafana_oncall_escalation_chain.push.id
  routing_type        = "jinja2"
  routing_regex       = "{{ ${local.ci_relevant} and (${local.ci_failed} or payload.workflow_run.conclusion == 'success') }}"
  position            = 0
}

output "ci_webhook_url" {
  value     = grafana_oncall_integration.ci.link
  sensitive = true
}
