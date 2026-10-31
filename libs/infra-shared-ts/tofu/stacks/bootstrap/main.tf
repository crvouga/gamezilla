locals {
  github_subject_prefix = "repo:${var.github.owner}@${var.github.owner_id}/${var.github.repo}@${var.github.repo_id}"
  state_secret_names    = jsondecode(file("${path.module}/../foundation/secrets.json")).bootstrap
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
  source        = "../../modules/ci-identity"
  org_id        = var.infisical.org_id
  project_id    = var.infisical.project_id
  name          = "${var.project}-github-actions"
  oidc_issuer   = "https://token.actions.githubusercontent.com"
  oidc_subject  = "${local.github_subject_prefix}:*"
  oidc_audience = "https://github.com/${var.github.owner}"
}

module "aws_ci" {
  source                = "../../modules/aws-ci-identity"
  project               = var.project
  github_subject_prefix = local.github_subject_prefix
}

module "repository" {
  source                = "../../modules/repository"
  name                  = var.github.repo
  owner_is_organization = var.github.owner_is_organization
  settings              = var.github.settings
  environments          = var.github.environments
  # Release's production deploy and main's Health checks; the AWS deploy role
  # trusts this environment's OIDC subject.
  main_only_environments = ["production"]
  variables = {
    SECRETS_IDENTITY_ID = module.ci_identity.identity_id
    SECRETS_PROJECT_ID  = var.infisical.project_slug
    AWS_ROLE_ARN        = module.aws_ci.role_arn
    AWS_HEALTH_ROLE_ARN = module.aws_ci.health_role_arn
    # Set by the same apply that lets the read-only AWS role trust pull
    # requests: until then Verify PR cannot plan the foundation stack.
    INFRA_PLAN_ON_PULL_REQUEST = "true"
  }
}

output "state_access_key_id" {
  value = module.state.access_key_id
}

output "state_secret_access_key" {
  value     = module.state.secret_access_key
  sensitive = true
}
