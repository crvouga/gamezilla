locals {
  envs_dir = "${path.module}/../../envs"
  # Every environment file in tofu/envs — a new replica is picked up here
  # without editing this stack.
  envs = {
    for file in fileset(local.envs_dir, "*.tfvars.json") :
    jsondecode(file("${local.envs_dir}/${file}")).env => jsondecode(file("${local.envs_dir}/${file}"))
  }
  state_secret_names = jsondecode(file("${path.module}/../foundation/secrets.json")).bootstrap
}

locals {
  state_secret_values = {
    TOFU_STATE_ACCESS_KEY_ID     = module.state.access_key_id
    TOFU_STATE_SECRET_ACCESS_KEY = module.state.secret_access_key
  }
}

module "state" {
  source     = "../../modules/state"
  account_id = var.state.account_id
  bucket     = var.state.bucket
}

# STATEFUL: a secrets environment holds every human-entered secret.
resource "infisical_project_environment" "this" {
  for_each = local.envs

  project_id = var.infisical.project_id
  slug       = each.key
  name       = each.value.display_name

  lifecycle {
    prevent_destroy = true
  }
}

# The state credential, in every environment: each deploy reads its own
# environment's secrets only.
resource "infisical_secret" "state_access" {
  for_each = {
    for pair in setproduct(keys(local.envs), local.state_secret_names) :
    "${pair[0]}/${pair[1]}" => { env = pair[0], name = pair[1] }
  }

  workspace_id = var.infisical.project_id
  env_slug     = infisical_project_environment.this[each.value.env].slug
  folder_path  = "/"
  name         = each.value.name
  value_wo     = local.state_secret_values[each.value.name]
  # Write-only (never in state); the digest version rewrites it on change.
  value_wo_version = parseint(substr(sha256(local.state_secret_values[each.value.name]), 0, 12), 16)
}

module "ci_identity" {
  source            = "../../modules/ci-identity"
  org_id            = var.infisical.org_id
  project_id        = var.infisical.project_id
  name              = "${var.project}-github-actions"
  github_owner      = var.github.owner
  github_repository = "${var.github.owner}/${var.github.repo}"
}

module "repository" {
  source          = "../../modules/repository"
  name            = var.github.repo
  required_checks = var.github.required_checks
  variables = {
    SECRETS_IDENTITY_ID = module.ci_identity.identity_id
    SECRETS_PROJECT_ID  = var.infisical.project_slug
  }
}

output "state_access_key_id" {
  value = module.state.access_key_id
}

output "state_secret_access_key" {
  value     = module.state.secret_access_key
  sensitive = true
}
