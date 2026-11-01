# Bootstrap cannot apply a plan that weakens repository merge policy.
package main

import rego.v1

strict_main(after) if {
	after.enforcement == "active"
	count(object.get(after, "bypass_actors", [])) == 0
	refs := after.conditions[0].ref_name[0]
	"refs/heads/main" in refs.include
	count(refs.exclude) == 0
	rules := after.rules[0]
	rules.deletion == true
	rules.non_fast_forward == true
	pr := rules.pull_request[0]
	pr.required_approving_review_count >= 1
	pr.dismiss_stale_reviews_on_push == true
	pr.require_last_push_approval == true
	pr.required_review_thread_resolution == true
	checks := rules.required_status_checks[0]
	checks.strict_required_status_checks_policy == true
	some check in checks.required_check
	check.context == "verify:end"
	check.integration_id == 15368
}

deny contains "main must require current verification, independent approval, resolved conversations and no bypass" if {
	some resource in input.resource_changes
	resource.address == "module.repository.github_repository_ruleset.main"
	resource.change.after != null
	not strict_main(resource.change.after)
}

deny contains "repository must delete merged branches and prohibit automatic, squash and rebase merges" if {
	some resource in input.resource_changes
	resource.address == "module.repository.github_repository.this"
	after := resource.change.after
	after != null
	not strict_repository(after)
}

strict_repository(after) if {
	after.delete_branch_on_merge == true
	after.allow_auto_merge == false
	after.allow_merge_commit == true
	after.allow_squash_merge == false
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
