# Existing repository, adopted by bootstrap; never recreated or destroyed.
terraform {
  required_providers {
    github = { source = "integrations/github" }
  }
}

variable "name" {
  type = string
}

variable "owner_is_organization" {
  type        = bool
  description = "True when GitHub will accept a change to allow_forking. A user-owned private repository returns HTTP 422 for that field."
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

variable "main_only_environments" {
  type        = set(string)
  description = "Environments (a subset of environments) that only the main branch may deploy to."
}

resource "github_repository" "this" {
  name            = var.name
  visibility      = var.settings.visibility
  homepage_url    = var.settings.homepage_url
  has_issues      = var.settings.has_issues
  has_projects    = var.settings.has_projects
  has_wiki        = var.settings.has_wiki
  has_discussions = var.settings.has_discussions
  # integrations/github 6.13 sends allow_forking only when the argument
  # changes. GitHub rejects that change on a user-owned private repository
  # (422 Allow forks setting can only be changed on org-owned private
  # repositories). Leave it unset so the refresh value stays put; an
  # organization still applies var.settings.allow_forking.
  allow_forking               = var.owner_is_organization ? var.settings.allow_forking : null
  archive_on_destroy          = true
  archived                    = false
  is_template                 = false
  allow_auto_merge            = false
  allow_update_branch         = true
  delete_branch_on_merge      = true
  allow_merge_commit          = true
  allow_squash_merge          = false
  allow_rebase_merge          = false
  merge_commit_title          = "PR_TITLE"
  merge_commit_message        = "PR_BODY"
  web_commit_signoff_required = false

  # A public repository gets GitHub's secret scanning of every push and the
  # whole history, and push protection that refuses a push adding a
  # credential (both free there; a private repository needs paid Secret
  # Protection, so it keeps them off). Making the repository public is the
  # one edit `visibility` in global.tfvars.json, and the same apply turns
  # these on. The required verification's gitleaks scan runs either way.
  # Version 6.13 advertises code_security and
  # secret_scanning_non_provider_patterns but omits them from both read and
  # write; declaring them would cause perpetual drift. See
  # README.md#infrastructure for the provider limitation.
  security_and_analysis {
    secret_scanning {
      status = var.settings.visibility == "public" ? "enabled" : "disabled"
    }
    secret_scanning_push_protection {
      status = var.settings.visibility == "public" ? "enabled" : "disabled"
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

  # Every change is reviewed and verified against the current main. No bypass.
  rules {
    deletion         = true
    non_fast_forward = true

    pull_request {
      required_approving_review_count   = 1
      dismiss_stale_reviews_on_push     = true
      require_last_push_approval        = true
      required_review_thread_resolution = true
    }

    required_status_checks {
      strict_required_status_checks_policy = true
      required_check {
        context        = "verify:end"
        integration_id = 15368 # GitHub Actions; other actors cannot spoof the gate.
      }
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
