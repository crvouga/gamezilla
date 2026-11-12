# Bug reports become issues in this repository. No API mints a fine-grained
# GitHub token and setup is code-only, so the intake reuses the repository
# admin token already entered once in the shared environment. Trade-off: the
# API Worker holds a token with repository admin rights. Every environment
# reads these through its import of the shared environment.
locals {
  feedback_names = jsondecode(file("${path.module}/../foundation/secrets.json")).feedback_derived
  feedback_values = {
    FEEDBACK_GITHUB_TOKEN      = try(local.stored_shared_data["GITHUB_ADMIN_TOKEN"].value, "")
    FEEDBACK_GITHUB_REPOSITORY = "${var.github.owner}/${var.github.repo}"
  }
}

resource "terraform_data" "feedback_version" {
  for_each         = toset(local.feedback_names)
  triggers_replace = sha256(local.feedback_values[each.key])
  input            = parseint("${formatdate("YYYYMMDDhhmmss", plantimestamp())}0000", 10)
  lifecycle {
    ignore_changes = [input]
  }
}

resource "infisical_secret" "feedback" {
  for_each         = toset(local.feedback_names)
  workspace_id     = var.infisical.project_id
  env_slug         = var.infisical.shared_env
  folder_path      = "/"
  name             = each.key
  value_wo         = local.feedback_values[each.key]
  value_wo_version = terraform_data.feedback_version[each.key].output

  lifecycle {
    precondition {
      condition     = length(local.feedback_values[each.key]) > 0
      error_message = "Bug reports need GITHUB_ADMIN_TOKEN in the shared secrets environment."
    }
  }
}
