locals {
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

# STATEFUL: the account-wide credentials every environment imports (the
# fleet stack creates each environment and its import of this one).
resource "infisical_project_environment" "shared" {
  project_id = var.infisical.project_id
  slug       = var.infisical.shared_env
  name       = "Shared"

  lifecycle {
    prevent_destroy = true
  }
}

# Per-environment secrets environments moved to the fleet stack (it adopts
# them by id), and the per-environment copies of the state credential gave
# way to the one below: forget, never delete.
removed {
  from = infisical_project_environment.this
  lifecycle {
    destroy = false
  }
}

removed {
  from = infisical_secret.state_access
  lifecycle {
    destroy = false
  }
}

# The state credential, once, in the shared environment.
#
# Write-only (never in state). Its version must only ever grow, so it is a
# plan-time stamp frozen until the value's digest changes (see the secrets
# module for the full rationale).
resource "terraform_data" "state_shared_version" {
  for_each = toset(local.state_secret_names)

  triggers_replace = sha256(local.state_secret_values[each.key])
  input            = parseint("${formatdate("YYYYMMDDhhmmss", plantimestamp())}0000", 10)

  lifecycle {
    ignore_changes = [input]
  }
}

resource "infisical_secret" "state_shared" {
  for_each = toset(local.state_secret_names)

  workspace_id     = var.infisical.project_id
  env_slug         = infisical_project_environment.shared.slug
  folder_path      = "/"
  name             = each.key
  value_wo         = local.state_secret_values[each.key]
  value_wo_version = terraform_data.state_shared_version[each.key].output
}

module "trace_stack" {
  source = "../../modules/trace-stack"
  slug   = var.grafana.stack_slug
  region = var.grafana.region
}

module "ci_identity" {
  source                = "../../modules/ci-identity"
  org_id                = var.infisical.org_id
  project_id            = var.infisical.project_id
  name                  = "${var.project}-github-actions"
  github_owner          = var.github.owner
  github_subject_prefix = var.github.oidc_subject_prefix
}

module "aws_ci" {
  source                = "../../modules/aws-ci-identity"
  project               = var.project
  github_subject_prefix = var.github.oidc_subject_prefix
}

module "repository" {
  source          = "../../modules/repository"
  name            = var.github.repo
  required_checks = var.github.required_checks
  variables = {
    SECRETS_IDENTITY_ID = module.ci_identity.identity_id
    SECRETS_PROJECT_ID  = var.infisical.project_slug
    AWS_ROLE_ARN        = module.aws_ci.role_arn
    AWS_HEALTH_ROLE_ARN = module.aws_ci.health_role_arn
  }
}

output "state_access_key_id" {
  value = module.state.access_key_id
}

output "state_secret_access_key" {
  value     = module.state.secret_access_key
  sensitive = true
}
