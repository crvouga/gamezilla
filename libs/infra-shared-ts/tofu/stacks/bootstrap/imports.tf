# Adoption of what existed before OpenTofu (global.tfvars.json
# `global_imports`); entries are deleted once in state.

import {
  for_each = var.global_imports.github_repository == null ? toset([]) : toset([var.global_imports.github_repository])
  to       = module.repository.github_repository.this
  id       = each.value
}

# The transferred repository has no legacy protection to adopt. Forget a
# stale state address without deleting safeguards if another state has one.
removed {
  from = module.repository.github_branch_protection.main
  lifecycle {
    destroy = false
  }
}

# The previous CI provider's AWS issuer is still in state. No role trusts it
# once the roles above are updated: forget it, never delete it.
removed {
  from = module.aws_ci.aws_iam_openid_connect_provider.depot
  lifecycle {
    destroy = false
  }
}

# These settings already exist. Import blocks are idempotent once adopted.
import {
  to = module.repository.github_branch_default.main
  id = var.github.repo
}

import {
  to = module.repository.github_actions_repository_permissions.this
  id = var.github.repo
}

import {
  to = module.repository.github_workflow_repository_permissions.this
  id = var.github.repo
}

import {
  to = module.repository.github_repository_vulnerability_alerts.this
  id = var.github.repo
}

import {
  to = module.repository.github_repository_dependabot_security_updates.this
  id = var.github.repo
}

import {
  for_each = var.github.environments
  to       = module.repository.github_repository_environment.this[each.value]
  id       = "${var.github.repo}:${each.value}"
}

# Created through the API on 2026-10-28, when the repository became public.
import {
  to = module.repository.github_repository_environment_deployment_policy.main["production"]
  id = "${var.github.repo}:production:64748019"
}

# The org's one free-plan stack, created in the Grafana UI before OpenTofu.
import {
  for_each = var.global_imports.grafana_stack == null ? toset([]) : toset([var.global_imports.grafana_stack])
  to       = module.trace_stack.grafana_cloud_stack.this
  id       = each.value
}

import {
  for_each = toset(var.global_imports.github_variables)
  to       = module.repository.github_actions_variable.this[each.value]
  id       = "${var.github.repo}:${each.value}"
}
