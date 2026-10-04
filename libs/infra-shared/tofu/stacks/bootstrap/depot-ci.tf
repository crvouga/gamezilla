# The native CI identity is separate from GitHub's during the branch rollout.
# Its trust pins both the Depot organization and the repository.
module "depot_ci_identity" {
  source        = "../../modules/ci-identity"
  org_id        = var.infisical.org_id
  project_id    = var.infisical.project_id
  name          = "${var.project}-depot-ci"
  oidc_issuer   = "https://identity.depot.dev"
  oidc_subject  = "spiffe://identity.depot.dev/org/${var.depot.org_id}/ci/github/${var.github.owner}/${var.github.repo}/*"
  oidc_audience = "https://github.com/${var.github.owner}"
}

locals {
  depot_ci_variables = {
    SECRETS_IDENTITY_ID = module.depot_ci_identity.identity_id
    SECRETS_PROJECT_ID  = var.infisical.project_slug
    AWS_ROLE_ARN        = module.aws_ci.role_arn
    AWS_HEALTH_ROLE_ARN = module.aws_ci.health_role_arn
  }
}

# Depot has no OpenTofu provider for CI variables. Keep their desired values
# in this stack; the pinned CLI applies only these non-secret coordinates.
resource "terraform_data" "depot_ci_variables" {
  input = {
    values     = local.depot_ci_variables
    repository = "${var.github.owner}/${var.github.repo}"
    org_id     = var.depot.org_id
  }
  triggers_replace = [local.depot_ci_variables, var.github.owner, var.github.repo, var.depot.org_id]

  # Creating several variables concurrently races Depot's repository setup.
  provisioner "local-exec" {
    command = <<-EOT
      set -eu
      for CI_VARIABLE_NAME in AWS_ROLE_ARN AWS_HEALTH_ROLE_ARN SECRETS_IDENTITY_ID SECRETS_PROJECT_ID; do
        CI_VARIABLE_VALUE="$(printf '%s' "$CI_VARIABLES" | jq -r --arg name "$CI_VARIABLE_NAME" '.[$name]')"
        depot ci vars set "$CI_VARIABLE_NAME" --value "$CI_VARIABLE_VALUE" --repo "$CI_REPOSITORY" --org "$CI_DEPOT_ORG"
      done
    EOT
    environment = {
      CI_VARIABLES  = jsonencode(self.input.values)
      CI_REPOSITORY = self.input.repository
      CI_DEPOT_ORG  = self.input.org_id
    }
  }
}
