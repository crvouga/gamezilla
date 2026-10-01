# Adoption of resources that existed before OpenTofu managed them. Each block
# is inert unless `var.imports` names an id for it (envs/<env>.tfvars.json);
# once a resource is in state its entry is deleted from the env file.

import {
  for_each = var.imports.foundation.r2_bucket == null ? toset([]) : toset([var.imports.foundation.r2_bucket])
  to       = module.object_store.cloudflare_r2_bucket.objects
  id       = each.value
}

import {
  for_each = var.imports.foundation.broker_dns == null ? toset([]) : toset([var.imports.foundation.broker_dns])
  to       = module.pubsub.cloudflare_dns_record.broker
  id       = each.value
}

import {
  for_each = toset(var.imports.foundation.secrets)
  to       = module.secrets.infisical_secret.managed[each.value]
  id       = "write-only:${var.infisical.project_id}:${var.env}:/:${each.value}"
}

# Neon and Railway stay in those vendors. An ordinary apply must not delete
# them: forget the addresses that were in this state. A person deletes the
# old project and the old broker after this path is healthy (README.md).
removed {
  from = module.database.neon_branch.this
  lifecycle {
    destroy = false
  }
}

removed {
  from = module.database.neon_endpoint.this
  lifecycle {
    destroy = false
  }
}

removed {
  from = module.database.neon_role.obs_read
  lifecycle {
    destroy = false
  }
}

removed {
  from = module.pubsub.railway_project.this
  lifecycle {
    destroy = false
  }
}

removed {
  from = module.pubsub.railway_environment.this
  lifecycle {
    destroy = false
  }
}

removed {
  from = module.pubsub.railway_environment.default
  lifecycle {
    destroy = false
  }
}

removed {
  from = module.pubsub.railway_service.emqx
  lifecycle {
    destroy = false
  }
}

removed {
  from = module.pubsub.railway_variable.broker
  lifecycle {
    destroy = false
  }
}

removed {
  from = module.pubsub.railway_custom_domain.broker
  lifecycle {
    destroy = false
  }
}

removed {
  from = module.pubsub.terraform_data.clone
  lifecycle {
    destroy = false
  }
}
