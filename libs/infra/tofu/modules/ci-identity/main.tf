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

variable "github_repository" {
  type        = string
  description = "owner/repo whose workflows may authenticate."
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

resource "infisical_identity_oidc_auth" "github" {
  identity_id                 = infisical_identity.ci.id
  oidc_discovery_url          = local.github_issuer
  bound_issuer                = local.github_issuer
  bound_subject               = "repo:${var.github_repository}:*"
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
