# Adoption of resources that existed before OpenTofu managed them. Each block
# is inert unless `var.imports` names an id for it (envs/<env>.tfvars.json);
# once a resource is in state its entry is deleted from the env file.

import {
  for_each = var.imports.foundation.r2_bucket == null ? toset([]) : toset([var.imports.foundation.r2_bucket])
  to       = module.object_store.cloudflare_r2_bucket.objects
  id       = each.value
}

import {
  for_each = var.imports.foundation.railway_project == null ? toset([]) : toset([var.imports.foundation.railway_project])
  to       = module.pubsub.railway_project.this
  id       = each.value
}

import {
  for_each = var.imports.foundation.railway_service == null ? toset([]) : toset([var.imports.foundation.railway_service])
  to       = module.pubsub.railway_service.emqx
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

# Broker variables already set on the adopted service (Railway upserts them,
# but importing keeps the first plan a pure no-op for existing values).
import {
  for_each = var.imports.foundation.railway_service == null ? toset([]) : toset(["PORT", "EMQX_API_KEY", "EMQX_API_SECRET", "EMQX_JWT_SECRET", "EMQX_DASHBOARD_PASSWORD"])
  to       = module.pubsub.railway_variable.broker[each.value]
  id       = "${var.imports.foundation.railway_service}:production:${each.value}"
}
