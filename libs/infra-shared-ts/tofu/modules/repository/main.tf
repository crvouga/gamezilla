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
  allow_forking          = var.owner_is_organization ? var.settings.allow_forking : null
  archive_on_destroy     = true
  archived               = false
  is_template            = false
  allow_auto_merge       = true
  allow_update_branch    = true
  delete_branch_on_merge = true
  # Squash only: one PR is one commit on main, titled by the PR title
  # (Conventional Commits) with the PR body as its message.
  allow_merge_commit = false
  allow_squash_merge = true
  allow_rebase_merge = false
  # GitHub retains these values when merge commits are disabled; provider
  # defaults otherwise produce a plan that an apply cannot reconcile.
  merge_commit_title          = "PR_TITLE"
  merge_commit_message        = "PR_BODY"
  squash_merge_commit_title   = "PR_TITLE"
  squash_merge_commit_message = "PR_BODY"
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

locals {
  required_checks = [for check_file in fileset("${path.module}/required-checks", "*.json") : jsondecode(file("${path.module}/required-checks/${check_file}"))]
}

resource "github_repository_ruleset" "main" {
  name        = "main"
  repository  = github_repository.this.name
  target      = "branch"
  enforcement = "active"

  # Explicit main still stays protected if somebody changes the default
  # branch before OpenTofu restores it.
  conditions {
    ref_name {
      include = ["refs/heads/main"]
      exclude = []
    }
  }

  # Break glass: a repository admin (the maintainer) may merge a PR whose
  # checks are red, but can never push to main directly. Agents, CI and apps
  # are never bypass actors. GitHub refuses the Actions integration as an
  # actor on a user-owned repository anyway.
  bypass_actors {
    actor_id    = 5
    actor_type  = "RepositoryRole"
    bypass_mode = "pull_request"
  }

  # Every change goes through a verified PR. A PR need not be up to
  # date with main to merge: many concurrent agent branches made strict mode a
  # constant update-and-rerun loop. Verify PR checks the merge commit at push
  # time, and Release reruns the full gate on main before shipping.
  # The repository has one maintainer, who cannot approve their own PRs, so
  # approvals are not required (regression: repository-ruleset-solo-approval).
  rules {
    creation                = true
    deletion                = true
    non_fast_forward        = true
    required_linear_history = true

    pull_request {
      required_approving_review_count   = 0
      dismiss_stale_reviews_on_push     = true
      require_last_push_approval        = false
      required_review_thread_resolution = true
      require_code_owner_review         = false
      allowed_merge_methods             = ["squash"]
    }

    required_status_checks {
      strict_required_status_checks_policy = false
      dynamic "required_check" {
        for_each = { for check in local.required_checks : check.context => check }
        content {
          context        = required_check.value.context
          integration_id = required_check.value.integration_id
        }
      }
    }
  }

  lifecycle {
    prevent_destroy = true
  }
}

# Release tags (`release-<run>`) are history: never moved or deleted. GitHub
# refuses the Actions integration as a bypass actor on a user-owned
# repository, so creation stays open; Release creates them with its token.
resource "github_repository_ruleset" "release_tags" {
  name        = "release-tags"
  repository  = github_repository.this.name
  target      = "tag"
  enforcement = "active"

  conditions {
    ref_name {
      include = ["refs/tags/release-*"]
      exclude = []
    }
  }

  bypass_actors {
    actor_id    = 5
    actor_type  = "RepositoryRole"
    bypass_mode = "always"
  }

  rules {
    deletion = true
    update   = true
  }
}

# One file per label (labels/<slug>.json), so concurrent PRs never edit one
# shared list. Labels outside this set, such as the dated `overnight:<date>`
# labels /overnight creates, are left alone: an authoritative set would delete
# them on every apply.
locals {
  labels = { for label_file in fileset("${path.module}/labels", "*.json") : jsondecode(file("${path.module}/labels/${label_file}")).name => jsondecode(file("${path.module}/labels/${label_file}")) }
}

resource "github_issue_label" "this" {
  for_each = local.labels

  repository  = github_repository.this.name
  name        = each.key
  color       = each.value.color
  description = each.value.description
}


resource "github_actions_variable" "this" {
  for_each = var.variables

  repository    = github_repository.this.name
  variable_name = each.key
  value         = each.value
}
