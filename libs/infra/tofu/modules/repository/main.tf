# The GitHub repository's settings, `main` protection and the Actions
# variables the workflows read. STATEFUL: the repository is the code; it is
# never destroyed (prevent_destroy, archive_on_destroy, plan policy).

terraform {
  required_providers {
    github = { source = "integrations/github" }
  }
}

variable "name" {
  type = string
}

variable "required_checks" {
  type        = list(string)
  description = "Gate jobs a PR must pass (each workflow's job named after it)."
}

variable "variables" {
  type = map(string)
}

resource "github_repository" "this" {
  name                   = var.name
  archive_on_destroy     = true
  allow_auto_merge       = false
  delete_branch_on_merge = true
  allow_merge_commit     = true
  allow_squash_merge     = false
  allow_rebase_merge     = false

  lifecycle {
    prevent_destroy = true
    # Metadata edited in the GitHub UI (description, topics, features) is not
    # policy; only the settings above are.
    ignore_changes = [
      description, homepage_url, topics, has_issues, has_projects, has_wiki,
      has_discussions, has_downloads, visibility, vulnerability_alerts,
      security_and_analysis, pages, template, is_template, auto_init,
      gitignore_template, license_template, allow_update_branch,
      merge_commit_message, merge_commit_title, squash_merge_commit_message,
      squash_merge_commit_title, web_commit_signoff_required, allow_forking,
    ]
  }
}

# `main` only moves through a PR whose required checks are green on the
# latest main. Admins included; no force pushes or deletion.
resource "github_branch_protection" "main" {
  repository_id       = github_repository.this.node_id
  pattern             = "main"
  enforce_admins      = true
  allows_deletions    = false
  allows_force_pushes = false

  required_pull_request_reviews {
    dismiss_stale_reviews           = false
    require_code_owner_reviews      = false
    required_approving_review_count = 0
  }

  required_status_checks {
    strict   = true
    contexts = var.required_checks
  }
}

resource "github_actions_variable" "this" {
  for_each = var.variables

  repository    = github_repository.this.name
  variable_name = each.key
  value         = each.value
}
