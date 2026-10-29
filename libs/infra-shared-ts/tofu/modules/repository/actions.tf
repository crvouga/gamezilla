# Any action may run, but only pinned to a full commit SHA: in a public
# repository a moved tag would run new code with the workflow's OIDC token
# (libs/tools-harness-ts/scripts/workflow-pinning.test.ts checks every
# reference). Workflows specify elevated permissions where needed. Do not
# grant repository-wide writes.
resource "github_actions_repository_permissions" "this" {
  repository           = github_repository.this.name
  enabled              = true
  allowed_actions      = "all"
  sha_pinning_required = true
}

resource "github_workflow_repository_permissions" "this" {
  repository                       = github_repository.this.name
  default_workflow_permissions     = "read"
  can_approve_pull_request_reviews = false
}

# Inventory: no repository or environment secrets. Credentials stay in
# Infisical and reach workflows through OIDC, never plaintext HCL or state.
resource "github_repository_environment" "this" {
  for_each = var.environments

  repository          = github_repository.this.name
  environment         = each.value
  wait_timer          = 0
  can_admins_bypass   = true
  prevent_self_review = false
  # No reviewers: Release ships every push to main unattended. An environment
  # in main_only_environments accepts deployments from `main` alone, so a
  # workflow on another branch can never take its OIDC subject
  # (`environment:production`), which the AWS deploy role trusts.
  dynamic "deployment_branch_policy" {
    for_each = contains(var.main_only_environments, each.value) ? [true] : []
    content {
      protected_branches     = false
      custom_branch_policies = true
    }
  }

  lifecycle {
    prevent_destroy = true
  }
}

resource "github_repository_environment_deployment_policy" "main" {
  for_each = var.main_only_environments

  repository     = github_repository.this.name
  environment    = github_repository_environment.this[each.value].environment
  branch_pattern = "main"
}

# Dependabot alerts for known-vulnerable dependencies, and security-update
# pull requests for them (.github/dependabot.yml), using dedicated resources
# rather than deprecated github_repository arguments. Security updates need
# the alerts.
resource "github_repository_vulnerability_alerts" "this" {
  repository = github_repository.this.name
  enabled    = true
}

resource "github_repository_dependabot_security_updates" "this" {
  repository = github_repository.this.name
  enabled    = true

  depends_on = [github_repository_vulnerability_alerts.this]
}
