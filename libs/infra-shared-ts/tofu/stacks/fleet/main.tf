locals {
  envs = var.envs
}

# STATEFUL: a secrets environment holds the environment's secrets. Deleting
# an env file alone never deletes it (the plan policy refuses); tearing the
# environment down first (`bun run infra:destroy`) does.
resource "infisical_project_environment" "this" {
  for_each = local.envs

  project_id = var.infisical.project_id
  slug       = each.key
  name       = each.value.display_name
}

# Account-wide credentials (stacks/foundation/secrets.json `shared`) live once
# in the shared environment (created by bootstrap); every environment reads
# them through this import. A local copy of one would shadow the import —
# `secrets-reconcile-shared` removes those.
resource "infisical_secret_import" "shared" {
  for_each = local.envs

  project_id              = var.infisical.project_id
  environment_slug        = infisical_project_environment.this[each.key].slug
  folder_path             = "/"
  import_environment_slug = var.infisical.shared_env
  import_folder_path      = "/"
  # A live link (not a one-time copy): rotating a shared value reaches every env.
  is_replication = false
}

# The one OAuth callback relay every environment signs in through
# (`apps/auth-relay-ts`, deployed by the Release workflow's fleet job just before
# this apply). Global: its forwarding targets are every env file, so it lives
# beside the per-env secrets environments rather than in any one env.
data "cloudflare_zone" "auth_relay" {
  filter = {
    name    = var.auth_relay.zone_name
    account = { id = var.auth_relay.account_id }
  }
}

module "auth_relay_edge" {
  source     = "../../modules/edge"
  account_id = var.auth_relay.account_id
  zone_id    = data.cloudflare_zone.auth_relay.zone_id
  domains = {
    auth = { hostname = var.auth_relay.hostname, service = var.auth_relay.worker }
  }
}
