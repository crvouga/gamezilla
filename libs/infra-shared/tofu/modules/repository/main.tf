# Existing repository, adopted by bootstrap; never recreated or destroyed.
terraform {
  required_providers {
    github = { source = "integrations/github" }
  }
}

variable "name" {
  type = string
}

variable "settings" {
  type = object({
    visibility      = string
    homepage_url    = string
    has_issues      = bool
    has_projects    = bool
    has_wiki        = bool
    has_discussions = bool
    allow_forking   = bool
  })
}

variable "variables" {
  type = map(string)
}

variable "environments" {
  type        = set(string)
  description = "Existing deployment environments, adopted without new approval gates."
}

resource "github_repository" "this" {
  name                        = var.name
  visibility                  = var.settings.visibility
  homepage_url                = var.settings.homepage_url
  has_issues                  = var.settings.has_issues
  has_projects                = var.settings.has_projects
  has_wiki                    = var.settings.has_wiki
  has_discussions             = var.settings.has_discussions
  allow_forking               = var.settings.allow_forking
  archive_on_destroy          = true
  archived                    = false
  is_template                 = false
  allow_auto_merge            = false
  allow_update_branch         = true
  delete_branch_on_merge      = true
  allow_merge_commit          = false
  allow_squash_merge          = true
  allow_rebase_merge          = false
  squash_merge_commit_title   = "PR_TITLE"
  squash_merge_commit_message = "PR_BODY"
  web_commit_signoff_required = false

  # Preserve current secret-scanning settings. Version 6.13 advertises
  # code_security and secret_scanning_non_provider_patterns but omits them
  # from both read and write; declaring them would cause perpetual drift.
  # See README.md#infrastructure for the provider limitation.
  security_and_analysis {
    secret_scanning {
      status = "disabled"
    }
    secret_scanning_push_protection {
      status = "disabled"
    }
  }

  lifecycle {
    prevent_destroy = true
    # Descriptive metadata is outside policy. No policy settings are ignored.
    ignore_changes = [description, topics]
  }
}

resource "github_branch_default" "main" {
  repository = github_repository.this.name
  branch     = "main"
}

resource "github_repository_ruleset" "main" {
  name        = "main"
  repository  = github_repository.this.name
  target      = "branch"
  enforcement = "active"

  # Explicit main still stays protected if somebody changes the default
  # branch before OpenTofu restores it. No bypass actors, including CI/admins.
  conditions {
    ref_name {
      include = ["refs/heads/main"]
      exclude = []
    }
  }

  rules {
    deletion                = true
    non_fast_forward        = true
    required_linear_history = true

    pull_request {
      allowed_merge_methods             = ["squash"]
      required_approving_review_count   = 0
      require_code_owner_review         = false
      require_last_push_approval        = false
      dismiss_stale_reviews_on_push     = false
      required_review_thread_resolution = true
    }

  }

  lifecycle {
    prevent_destroy = true
  }
}

resource "github_actions_variable" "this" {
  for_each = var.variables

  repository    = github_repository.this.name
  variable_name = each.key
  value         = each.value
}
