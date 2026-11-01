package main

import rego.v1

strict_ruleset := {
	"enforcement": "active",
	"bypass_actors": [],
	"conditions": [{"ref_name": [{"include": ["refs/heads/main"], "exclude": []}]}],
	"rules": [{
		"deletion": true,
		"non_fast_forward": true,
		"pull_request": [{
			"required_approving_review_count": 1,
			"dismiss_stale_reviews_on_push": true,
			"require_last_push_approval": true,
			"required_review_thread_resolution": true,
		}],
		"required_status_checks": [{
			"strict_required_status_checks_policy": true,
			"required_check": [{"context": "verify:end", "integration_id": 15368}],
		}],
	}],
}

test_strict_main_allowed if {
	strict_main(strict_ruleset)
}

test_missing_review_gate_denied if {
	rules := object.union(strict_ruleset.rules[0], {"pull_request": []})
	not strict_main(object.union(strict_ruleset, {"rules": [rules]}))
}

test_admin_bypass_denied if {
	not strict_main(object.union(strict_ruleset, {"bypass_actors": [{"actor_id": 5}]}))
}

test_wrong_check_source_denied if {
	rules := object.union(strict_ruleset.rules[0], {"required_status_checks": [{
		"strict_required_status_checks_policy": true,
		"required_check": [{"context": "verify:end", "integration_id": 0}],
	}]})
	not strict_main(object.union(strict_ruleset, {"rules": [rules]}))
}

test_weak_repository_plan_denied if {
	count(deny) == 1 with input as {"resource_changes": [{
		"address": "module.repository.github_repository.this",
		"change": {"after": {"delete_branch_on_merge": false}},
	}]}
}

test_public_repository_requires_push_protection if {
	not scanning_enabled({"security_and_analysis": [{
		"secret_scanning": [{"status": "enabled"}],
		"secret_scanning_push_protection": [{"status": "disabled"}],
	}]})
	scanning_enabled({"security_and_analysis": [{
		"secret_scanning": [{"status": "enabled"}],
		"secret_scanning_push_protection": [{"status": "enabled"}],
	}]})
}
