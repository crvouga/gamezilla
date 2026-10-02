# The machine identity GitHub Actions uses to read and write Infisical: OIDC
# only (no stored credential), bound to this repository, admin on the project
# (deploys write secrets in every environment).

terraform {
  required_providers {
    infisical = { source = "infisical/infisical" }
  }
}

variable "org_id" {
  type = string
}

variable "project_id" {
  type = string
}

variable "name" {
  type = string
}

variable "github_subject_prefix" {
  type        = string
  description = "Immutable GitHub OIDC repo:owner@owner-id/repo@repo-id prefix."
}

variable "github_owner" {
  type = string
}

locals {
  github_issuer = "https://token.actions.githubusercontent.com"
}

resource "infisical_identity" "ci" {
  name   = var.name
  org_id = var.org_id
  role   = "no-access"
}

# Adopt the existing auth binding so recovery updates it in place.
moved {
  from = infisical_identity_oidc_auth.ci
  to   = infisical_identity_oidc_auth.github
}

resource "infisical_identity_oidc_auth" "github" {
  identity_id                 = infisical_identity.ci.id
  oidc_discovery_url          = local.github_issuer
  bound_issuer                = local.github_issuer
  bound_subject               = "${var.github_subject_prefix}:*"
  bound_audiences             = ["https://github.com/${var.github_owner}"]
  access_token_ttl            = 600
  access_token_max_ttl        = 600
  access_token_num_uses_limit = 0
}

resource "infisical_project_identity" "ci" {
  project_id     = var.project_id
  identity_id    = infisical_identity.ci.id
  adopt_existing = true
  roles          = [{ role_slug = "admin" }]
}

output "identity_id" {
  value = infisical_identity.ci.id
}
