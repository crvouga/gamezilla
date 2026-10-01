# Environments that existed before this stack (created by bootstrap, which
# hands them over with a `removed` block); entries are deleted once in state.

import {
  for_each = var.global_imports.infisical_environments
  to       = infisical_project_environment.this[each.key]
  id       = each.value
}

# The shared Railway project and its EMQX service used to live here. Forget
# them: an apply must not delete the broker or its volume. A person deletes
# the project after IoT Core is healthy (docs/INFRA.md).
removed {
  from = module.pubsub_project.railway_project.this
  lifecycle {
    destroy = false
  }
}

removed {
  from = module.pubsub_project.railway_service.emqx
  lifecycle {
    destroy = false
  }
}
