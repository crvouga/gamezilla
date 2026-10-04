# The machine identity a CI provider uses to read and write Infisical: OIDC
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

variable "oidc_issuer" {
  type = string
}

variable "oidc_subject" {
  type = string
}

variable "oidc_audience" {
  type = string
}

resource "infisical_identity" "ci" {
  name   = var.name
  org_id = var.org_id
  role   = "no-access"
}

resource "infisical_identity_oidc_auth" "ci" {
  identity_id                 = infisical_identity.ci.id
  oidc_discovery_url          = var.oidc_issuer
  bound_issuer                = var.oidc_issuer
  bound_subject               = var.oidc_subject
  bound_audiences             = [var.oidc_audience]
  access_token_ttl            = 600
  access_token_max_ttl        = 600
  access_token_num_uses_limit = 0
}

moved {
  from = infisical_identity_oidc_auth.github
  to   = infisical_identity_oidc_auth.ci
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
