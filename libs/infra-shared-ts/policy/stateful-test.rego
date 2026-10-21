package main

import rego.v1

change(type, actions) := {
	"address": sprintf("module.x.%s.this", [type]),
	"mode": "managed",
	"type": type,
	"change": {"actions": actions},
}

plan(changes, protection) := {
	"resource_changes": changes,
	"variables": {"protection": {"value": protection}},
}

test_bucket_delete_denied if {
	count(deny) == 1 with input as plan([change("cloudflare_r2_bucket", ["delete"])], "standard")
}

test_bucket_replace_denied if {
	count(deny) == 1 with input as plan([change("cloudflare_r2_bucket", ["delete", "create"])], "standard")
}

test_unknown_type_delete_denied if {
	count(deny) == 1 with input as plan([change("neon_project", ["delete"])], "standard")
}

test_railway_project_delete_denied if {
	count(deny) == 1 with input as plan([change("railway_project", ["delete"])], "standard")
}

test_railway_environment_replace_denied if {
	count(deny) == 1 with input as plan([change("railway_environment", ["delete", "create"])], "production")
}

test_token_replace_allowed if {
	count(deny) == 0 with input as plan([change("cloudflare_account_token", ["create", "delete"])], "standard")
}

test_bucket_update_allowed if {
	count(deny) == 0 with input as plan([change("cloudflare_r2_bucket", ["update"])], "production")
}

test_forget_allowed if {
	count(deny) == 0 with input as plan([change("railway_service", ["forget"])], "production")
}

test_data_source_ignored if {
	count(deny) == 0 with input as plan(
		[object.union(change("neon_project", ["delete"]), {"mode": "data"})],
		"production",
	)
}

test_production_mass_delete_denied if {
	changes := [
		change("cloudflare_dns_record", ["delete"]),
		change("cloudflare_dns_record", ["delete"]),
		change("cloudflare_dns_record", ["no-op"]),
	]
	count(deny) == 1 with input as plan(changes, "production")
}

test_production_mass_replace_allowed if {
	changes := [
		change("cloudflare_workers_custom_domain", ["delete", "create"]),
		change("cloudflare_workers_custom_domain", ["delete", "create"]),
		change("cloudflare_workers_custom_domain", ["create", "delete"]),
	]
	count(deny) == 0 with input as plan(changes, "production")
}

test_production_mass_replace_of_stateful_denied if {
	changes := [
		change("cloudflare_r2_bucket", ["delete", "create"]),
		change("cloudflare_r2_bucket", ["delete", "create"]),
	]
	count(deny) == 1 with input as plan(changes, "production")
}

test_standard_mass_delete_allowed if {
	changes := [
		change("cloudflare_dns_record", ["delete"]),
		change("cloudflare_dns_record", ["delete"]),
		change("cloudflare_dns_record", ["no-op"]),
	]
	count(deny) == 0 with input as plan(changes, "standard")
}

teardown_of(changes, protection) := object.union(
	plan(changes, protection),
	{"teardown": {"protection": protection}},
)

test_standard_teardown_deletes_stateful if {
	changes := [
		change("cloudflare_r2_bucket", ["delete"]),
		change("neon_branch", ["delete"]),
		change("railway_service", ["delete"]),
	]
	count(deny) == 0 with input as teardown_of(changes, "standard")
}

test_production_teardown_denied if {
	deny["refusing to tear down a production environment"] with input as teardown_of(
		[change("cloudflare_dns_record", ["delete"])],
		"production",
	)
}

test_production_teardown_never_deletes_stateful if {
	count(deny) == 2 with input as teardown_of([change("cloudflare_r2_bucket", ["delete"])], "production")
}
