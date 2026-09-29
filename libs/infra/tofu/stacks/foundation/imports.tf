# Adoption of resources that existed before OpenTofu managed them. Each block
# is inert unless `var.imports` names an id for it (envs/<env>.tfvars.json);
# once a resource is in state its entry is deleted from the env file.

import {
  for_each = var.imports.foundation.r2_bucket == null ? toset([]) : toset([var.imports.foundation.r2_bucket])
  to       = module.object_store.cloudflare_r2_bucket.objects
  id       = each.value
}

# `project_id:name` — production's is the project's default environment.
import {
  for_each = var.imports.foundation.railway_environment == null ? toset([]) : toset([var.imports.foundation.railway_environment])
  to       = module.pubsub.railway_environment.default[0]
  id       = each.value
}

import {
  for_each = var.imports.foundation.railway_domain == null ? toset([]) : toset([var.imports.foundation.railway_domain])
  to       = module.pubsub.railway_custom_domain.broker
  id       = each.value
}

import {
  for_each = var.imports.foundation.broker_dns == null ? toset([]) : toset([var.imports.foundation.broker_dns])
  to       = module.pubsub.cloudflare_dns_record.broker
  id       = each.value
}

import {
  for_each = var.imports.foundation.broker_dns_verify == null ? toset([]) : toset([var.imports.foundation.broker_dns_verify])
  to       = module.pubsub.cloudflare_dns_record.broker_verification
  id       = each.value
}

import {
  for_each = var.imports.foundation.neon_branch == null ? toset([]) : toset([var.imports.foundation.neon_branch])
  to       = module.database.neon_branch.this[0]
  id       = each.value
}

import {
  for_each = var.imports.foundation.neon_endpoint == null ? toset([]) : toset([var.imports.foundation.neon_endpoint])
  to       = module.database.neon_endpoint.this
  id       = each.value
}

import {
  for_each = toset(var.imports.foundation.secrets)
  to       = module.secrets.infisical_secret.managed[each.value]
  id       = "write-only:${var.infisical.project_id}:${var.env}:/:${each.value}"
}

# The Railway project and the `emqx` service are shared by every environment
# and now belong to the fleet stack (modules/pubsub-project), which adopts
# them by id: forget, never delete. (Each environment used to own a project
# of its own; dev's old one is deleted by hand once dev runs in the shared
# project — docs/INFRA.md.)
removed {
  from = module.pubsub.railway_project.this
  lifecycle {
    destroy = false
  }
}

# Dev's first attempt at the shared project made an EMPTY environment here
# (no service instance, so its custom domain could never be created). Forget
# it: the module now clones the environment instead, and the empty one is
# deleted once by hand in the Railway dashboard (docs/INFRA.md).
removed {
  from = module.pubsub.railway_environment.this
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
