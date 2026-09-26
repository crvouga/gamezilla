# Environments that existed before this stack (created by bootstrap, which
# hands them over with a `removed` block); entries are deleted once in state.

import {
  for_each = var.global_imports.infisical_environments
  to       = infisical_project_environment.this[each.key]
  id       = each.value
}
