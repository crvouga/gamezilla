# Bootstrap cannot apply a plan that weakens repository merge policy.
package main

import rego.v1

# The one break-glass actor: repository admins, through a pull request only.
admin_pull_request_bypass := {"actor_id": 5, "actor_type": "RepositoryRole", "bypass_mode": "pull_request"}

allowed_bypass(actor) if {
	actor.actor_id == admin_pull_request_bypass.actor_id
	actor.actor_type == admin_pull_request_bypass.actor_type
	actor.bypass_mode == admin_pull_request_bypass.bypass_mode
}

strict_main(after) if {
	after.enforcement == "active"
	every actor in object.get(after, "bypass_actors", []) {
		allowed_bypass(actor)
	}
	refs := after.conditions[0].ref_name[0]
	"refs/heads/main" in refs.include
	count(refs.exclude) == 0
	rules := after.rules[0]
	rules.deletion == true
	rules.non_fast_forward == true
	rules.required_linear_history == true
	pr := rules.pull_request[0]
	pr.dismiss_stale_reviews_on_push == true
	pr.required_review_thread_resolution == true

	# Up-to-date branches are not required; Release re-verifies main.
	checks := rules.required_status_checks[0]
	some check in checks.required_check
	check.context == "verify:end"
	check.integration_id == 15368
}

deny contains "main must require pull requests, verification, linear history, resolved conversations and no bypass beyond admin pull requests" if {
	some resource in input.resource_changes
	resource.address == "module.repository.github_repository_ruleset.main"
	resource.change.after != null
	not strict_main(resource.change.after)
}

deny contains "repository must delete merged branches and allow squash merges only" if {
	some resource in input.resource_changes
	resource.address == "module.repository.github_repository.this"
	after := resource.change.after
	after != null
	not strict_repository(after)
}

# Auto-merge is allowed: it only merges once the main ruleset's required
# checks and resolved conversations pass, so it cannot weaken the gate.
strict_repository(after) if {
	after.delete_branch_on_merge == true
	after.allow_merge_commit == false
	after.allow_squash_merge == true
	after.allow_rebase_merge == false
}

deny contains "public repositories must keep secret scanning and push protection enabled" if {
	some resource in input.resource_changes
	resource.address == "module.repository.github_repository.this"
	after := resource.change.after
	after.visibility == "public"
	not scanning_enabled(after)
}

scanning_enabled(after) if {
	security := after.security_and_analysis[0]
	security.secret_scanning[0].status == "enabled"
	security.secret_scanning_push_protection[0].status == "enabled"
}
