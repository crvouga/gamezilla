# The environment's secrets store (Infisical): asserts, generates and writes.
#
#   human     — entered by a person (`bun run secrets:seed`); ASSERTED present.
#               OpenTofu never writes or deletes them.
#   generated — minted once (random_password), then kept forever: a value
#               already in the store wins over the generator, so adopting an
#               existing environment never rotates it — unless the stored
#               value is a `placeholder` (committed to git, hence public),
#               which is replaced by the generator. Protected by the plan
#               policy: only a standard environment's teardown deletes them.
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

variable "placeholders" {
  type        = list(string)
  default     = []
  description = "Values committed to git (local sidecar credentials); a stored generated secret equal to one is never adopted."
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

resource "random_password" "generated_value" {
  for_each = toset(var.generated)

  length  = 43
  special = false
}

locals {
  stored = data.infisical_secrets.current.secrets

  stored_generated = {
    for name in var.generated : name => trimspace(try(local.stored[name].value, ""))
  }

  generated_values = {
    for name in var.generated : name => (
      !contains(var.regenerate, name)
      && length(local.stored_generated[name]) > 0
      && !contains(var.placeholders, local.stored_generated[name])
      ? local.stored[name].value
      : random_password.generated_value[name].result
    )
  }

  managed = merge(local.generated_values, var.derived)
}

# Write-only: the value is sent to Infisical but never stored in state. The
# provider requires `value_wo_version` to only ever grow (it refuses a lower
# one), so a digest of the value cannot serve as the version: a rotated value
# may hash lower than its predecessor. Instead each secret carries a stamp that
# is minted at plan time and frozen until the value's digest changes, which
# replaces the stamp with a newer one. An unchanged value never shows up as
# drift; a changed value is always written with a strictly greater version.
#
# The stamp is `YYYYMMDDhhmmss` followed by four zeros (~2e17): above any
# version the retired 12-hex-digit digest scheme could have produced (<2.9e14),
# so the first apply after the cut-over is an update, never a refusal.
resource "terraform_data" "version" {
  for_each = nonsensitive(toset(keys(local.managed)))

  triggers_replace = sha256(local.managed[each.key])
  input            = parseint("${formatdate("YYYYMMDDhhmmss", plantimestamp())}0000", 10)

  lifecycle {
    ignore_changes = [input]
  }
}

resource "infisical_secret" "managed" {
  for_each = nonsensitive(toset(keys(local.managed)))

  workspace_id     = var.workspace_id
  env_slug         = var.env_slug
  folder_path      = "/"
  name             = each.key
  value_wo         = local.managed[each.key]
  value_wo_version = terraform_data.version[each.key].output
}

output "generated" {
  value     = local.generated_values
  sensitive = true
}
