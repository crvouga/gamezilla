locals {
  envs_dir = "${path.module}/../../envs"
  envs = {
    for file in fileset(local.envs_dir, "*.tfvars.json") :
    jsondecode(file("${local.envs_dir}/${file}")).env => jsondecode(file("${local.envs_dir}/${file}"))
  }
}

# STATEFUL: a secrets environment holds the environment's secrets.
resource "infisical_project_environment" "this" {
  for_each = local.envs

  project_id = var.infisical.project_id
  slug       = each.key
  name       = each.value.display_name

  lifecycle {
    prevent_destroy = true
  }
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
