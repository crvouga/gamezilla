# Environments that existed before this stack (created by bootstrap, which
# hands them over with a `removed` block); entries are deleted once in state.

import {
  for_each = var.global_imports.infisical_environments
  to       = infisical_project_environment.this[each.key]
  id       = each.value
}

# The broker project and service are always adopted by the ids the
# environments are given (global.tfvars.json `railway`), so the two can never
# disagree. An import of a resource already in state is a no-op.
import {
  to = module.pubsub_project.railway_project.this
  id = var.railway.project_id
}

import {
  to = module.pubsub_project.railway_service.emqx
  id = var.railway.service_id
}
