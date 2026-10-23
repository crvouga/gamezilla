# Environments that existed before this stack (created by bootstrap, which
# hands them over with a `removed` block); entries are deleted once in state.

import {
  for_each = var.global_imports.infisical_environments
  to       = infisical_project_environment.this[each.key]
  id       = each.value
}

# The shared Railway EMQX project used to live here. It is deleted.
# Forget the addresses so an apply does not recreate the broker (README.md).
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

# The reports bucket was deleted outside OpenTofu. Forget both addresses so
# the next apply neither recreates the bucket nor updates its lifecycle.
removed {
  from = cloudflare_r2_bucket.reports
  lifecycle {
    destroy = false
  }
}

removed {
  from = cloudflare_r2_bucket_lifecycle.reports
  lifecycle {
    destroy = false
  }
}
