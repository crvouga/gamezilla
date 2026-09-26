# Adoption of what existed before OpenTofu (global.tfvars.json
# `global_imports`); entries are deleted once in state.

import {
  for_each = var.global_imports.github_repository == null ? toset([]) : toset([var.global_imports.github_repository])
  to       = module.repository.github_repository.this
  id       = each.value
}

import {
  for_each = var.global_imports.github_branch_protection == null ? toset([]) : toset([var.global_imports.github_branch_protection])
  to       = module.repository.github_branch_protection.main
  id       = each.value
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
