# Adoption of what existed before OpenTofu (global.tfvars.json
# `global_imports`); entries are deleted once in state.

# Retire the previous CI provider without deleting its identities or trust.
removed {
  from = module.depot_ci_identity
  lifecycle {
    destroy = false
  }
}

removed {
  from = module.aws_ci.aws_iam_openid_connect_provider.depot
  lifecycle {
    destroy = false
  }
}

removed {
  from = terraform_data.depot_ci_variables
  lifecycle {
    destroy = false
  }
}

import {
  for_each = var.global_imports.aws_depot_oidc_provider == null ? toset([]) : toset([var.global_imports.aws_depot_oidc_provider])
  to       = module.aws_ci.aws_iam_openid_connect_provider.depot
  id       = each.value
}

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
