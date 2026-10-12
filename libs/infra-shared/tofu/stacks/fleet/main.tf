locals {
  envs_dir = "${path.module}/../../envs"
  envs = {
    for file in fileset(local.envs_dir, "*.tfvars.json") :
    jsondecode(file("${local.envs_dir}/${file}")).env => jsondecode(file("${local.envs_dir}/${file}"))
  }
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
# (`apps/auth-relay`, deployed by the Deploy workflow's fleet job just before
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

# The spec reports of every commit (`bun check` publishes; layout in
# `@crvouga/atlas/reports`): CI writes `spec-reports/commits/<sha>/…`, and every
# Atlas host reads it with its configured credential (the foundation stack's
# `report_access`). Private: no public
# hostname, nothing reads it but those credentials. Reports are build output,
# not user data. CI keeps only the latest report of each existing branch.
resource "cloudflare_r2_bucket" "reports" {
  account_id = var.reports.account_id
  name       = var.reports.bucket
}

resource "cloudflare_r2_bucket_lifecycle" "reports" {
  account_id  = var.reports.account_id
  bucket_name = cloudflare_r2_bucket.reports.name

  # Age-based expiry can delete a branch's current report. Cleanup is driven
  # by GitHub branch state in Check, Deploy and scheduled Health instead.
  rules = []
}
