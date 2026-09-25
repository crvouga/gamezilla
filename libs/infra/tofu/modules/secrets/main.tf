# The environment's secrets store (Infisical): asserts, generates and writes.
#
#   human     — entered by a person (`bun run secrets:seed`); ASSERTED present.
#               OpenTofu never writes or deletes them.
#   generated — minted once (random_password), then kept forever: a value
#               already in the store wins over the generator, so adopting an
#               existing environment never rotates it. STATEFUL.
#   derived   — outputs of other resources (tokens, URLs); rewritten whenever
#               their producer changes.
#
# The name lists live in JSON beside the stacks so `@libs/secrets`'s registry
# can be checked against them in `bun check` (libs/infra/tests).

terraform {
  required_providers {
    infisical = { source = "infisical/infisical" }
    random    = { source = "hashicorp/random" }
  }
}

variable "workspace_id" {
  type        = string
  description = "Infisical project id."
}

variable "env_slug" {
  type = string
}

variable "human" {
  type        = list(string)
  description = "Secret names a person must have entered; the plan fails if any is empty."
}

variable "generated" {
  type        = list(string)
  description = "Secret names minted once and never rotated."
}

variable "regenerate" {
  type        = list(string)
  default     = []
  description = "Generated names whose stored value is never adopted (it came from another environment)."
}

variable "derived_names" {
  type        = list(string)
  description = "The exact set of names `derived` must provide (secrets.json)."
}

variable "derived" {
  type        = map(string)
  sensitive   = true
  description = "Secret name → value produced by another resource."
}

data "infisical_secrets" "current" {
  workspace_id = var.workspace_id
  env_slug     = var.env_slug
  folder_path  = "/"

  lifecycle {
    postcondition {
      condition = alltrue([
        for name in var.human : length(trimspace(try(self.secrets[name].value, ""))) > 0
      ])
      error_message = "A required human secret is missing in Infisical env '${var.env_slug}'. Run `bun run secrets:seed` (required: ${join(", ", var.human)})."
    }
  }
}

resource "terraform_data" "derived_names" {
  input = sort(var.derived_names)

  lifecycle {
    precondition {
      condition     = toset(nonsensitive(keys(var.derived))) == toset(var.derived_names)
      error_message = "The derived secret map does not match secrets.json `derived`."
    }
  }
}

resource "random_password" "generated" {
  for_each = toset(var.generated)

  length  = 43
  special = false

  lifecycle {
    prevent_destroy = true
  }
}

locals {
  stored = data.infisical_secrets.current.secrets

  generated_values = {
    for name in var.generated : name => (
      !contains(var.regenerate, name) && length(trimspace(try(local.stored[name].value, ""))) > 0
      ? local.stored[name].value
      : random_password.generated[name].result
    )
  }

  managed = merge(local.generated_values, var.derived)
}

# Write-only: the value is sent to Infisical but never stored in state. The
# version is a digest of the value, so a changed value is always written and
# an unchanged one never shows up as drift.
resource "infisical_secret" "managed" {
  for_each = nonsensitive(toset(keys(local.managed)))

  workspace_id     = var.workspace_id
  env_slug         = var.env_slug
  folder_path      = "/"
  name             = each.key
  value_wo         = local.managed[each.key]
  value_wo_version = parseint(substr(sha256(local.managed[each.key]), 0, 12), 16)
}

output "generated" {
  value     = local.generated_values
  sensitive = true
}

output "database_url" {
  value     = try(local.stored["DATABASE_URL"].value, "")
  sensitive = true
}
