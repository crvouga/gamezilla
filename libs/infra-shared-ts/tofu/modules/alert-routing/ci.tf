# GitHub sends completion events even when checkout, secrets or verification
# failed before a workflow could send a notification. No fifth workflow and
# no notification credential exposed to pull-request code.
# Health is left out: what it finds reaches IRM through the Grafana alert
# rules on its check results, so a red hourly run would only repeat them.
locals {
  ci_relevant = "payload.get('action') == 'completed' and payload.get('workflow_run', {}).get('head_branch') == 'main' and payload.get('workflow_run', {}).get('path') in ['.github/workflows/deploy.yml', '.github/workflows/verify-nightly.yml', '.github/workflows/verify-pr.yml'] and payload.get('workflow_run', {}).get('event') in ['push', 'schedule', 'workflow_dispatch', 'workflow_call']"
  ci_failed   = "payload.get('workflow_run', {}).get('conclusion') in ['failure', 'timed_out', 'action_required', 'startup_failure']"
  # Shared by the web and mobile messages. Every line is `key: value` and
  # every link is absolute, so a person on a phone and an agent reading the
  # alert group through the IRM API both land on the root problem: the run,
  # its commit, the failed-job logs, and the playbook for getting CI green.
  ci_run      = "{% set run = payload.get('workflow_run', {}) %}{% set repo = payload.get('repository', {}) %}"
  ci_message = join("\n", [
    "${local.ci_run}**{{ run.get('name', 'CI') }} {{ run.get('conclusion', 'ignored') }}** on {{ repo.get('full_name', '') }} {{ run.get('head_branch', '') }} ({{ run.get('event', '') }}, attempt {{ run.get('run_attempt', 1) }})",
    "run: {{ run.get('html_url', '') }}",
    "commit: {{ repo.get('html_url', '') }}/commit/{{ run.get('head_sha', '') }}",
    "workflow_file: {{ repo.get('html_url', '') }}/blob/main/{{ run.get('path', '') }}",
    "playbook: {{ repo.get('html_url', '') }}/blob/main/.agents/skills/ci-workflows-green/SKILL.md",
    "",
    "next (copy and run):",
    "1. gh run view {{ run.get('id', '') }} --repo {{ repo.get('full_name', '') }} --json jobs --jq '.jobs[] | select(.conclusion == \"failure\") | {name, url}'",
    "2. gh run view {{ run.get('id', '') }} --repo {{ repo.get('full_name', '') }} --log-failed | tail -200",
    "3. Fix the root cause on a branch from main. A successful rerun (gh run rerun {{ run.get('id', '') }} --repo {{ repo.get('full_name', '') }} --failed) resolves this alert.",
  ])
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
      message = local.ci_message
    }
    mobile_app {
      title   = "{{ payload.get('workflow_run', {}).get('name', 'CI') }} is red"
      message = "${local.ci_run}Failed jobs: {{ run.get('html_url', '') }} · commit {{ repo.get('html_url', '') }}/commit/{{ run.get('head_sha', '') }}"
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
