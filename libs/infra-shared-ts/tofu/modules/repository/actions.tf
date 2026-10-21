# Preserve the existing action-source policy; workflows already specify
# elevated permissions where needed. Do not grant repository-wide writes.
resource "github_actions_repository_permissions" "this" {
  repository           = github_repository.this.name
  enabled              = true
  allowed_actions      = "all"
  sha_pinning_required = false
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
  # No reviewers or deployment_branch_policy: preserve existing deployment
  # behavior. Admin bypass here has no gates to bypass; it does not bypass main.

  lifecycle {
    prevent_destroy = true
  }
}

# Adopt and preserve the current Dependabot settings, using dedicated
# resources rather than deprecated github_repository arguments.
resource "github_repository_vulnerability_alerts" "this" {
  repository = github_repository.this.name
  enabled    = false
}

resource "github_repository_dependabot_security_updates" "this" {
  repository = github_repository.this.name
  enabled    = false
}
