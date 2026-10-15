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

# A feature branch provisioned shared data in fleet state before its
# declarations reached main. Preserve the bucket AND its access credentials;
# main must not delete either while it does not manage this storage. A branch
# taking ownership again must adopt the existing resources, not recreate them.
removed {
  from = cloudflare_r2_bucket.shared_data
  lifecycle {
    destroy = false
  }
}

removed {
  from = cloudflare_account_token.shared_data
  lifecycle {
    destroy = false
  }
}

removed {
  from = infisical_secret.shared_data
  lifecycle {
    destroy = false
  }
}

removed {
  from = terraform_data.shared_data_version
  lifecycle {
    destroy = false
  }
}
