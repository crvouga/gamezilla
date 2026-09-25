# Adoption of what existed before OpenTofu (global.tfvars.json
# `global_imports`); entries are deleted once in state.

import {
  for_each = var.global_imports.infisical_environments
  to       = infisical_project_environment.this[each.key]
  id       = each.value
}

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

import {
  for_each = toset(var.global_imports.github_variables)
  to       = module.repository.github_actions_variable.this[each.value]
  id       = "${var.github.repo}:${each.value}"
}
