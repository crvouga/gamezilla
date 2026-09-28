# Plan gate for every `tofu apply` (scripts/tofu.ts runs it on
# `tofu show -json <plan>` and refuses to apply on any `deny`).
#
# Deletion is ALLOW-LISTED: only the resource types in `deletable` may ever be
# deleted or replaced. Everything else — buckets, the broker service, its
# Railway environments and their volumes, the Grafana stack, generated secrets, any Neon resource and any type
# added in the future — is protected by default, so forgetting to classify a
# new stateful resource cannot lose data. Retire such a resource with a
# `removed { lifecycle { destroy = false } }` block (a "forget", not a delete).
#
# The one exception is tearing a whole environment down on purpose
# (`bun run infra:destroy`): scripts/tofu.ts adds `input.teardown` with the
# environment's env-file protection to a destroy plan. A `standard`
# environment's teardown may delete anything; a `production` one never can.
package main

import rego.v1

# Stateless resource types: credentials, DNS, routing, connection config and
# derived secret copies. Replacing any of them loses no data.
deletable := {
	"cloudflare_account_token",
	"cloudflare_dns_record",
	"cloudflare_hyperdrive_config",
	"cloudflare_workers_custom_domain",
	"github_actions_variable",
	"grafana_cloud_access_policy",
	"grafana_cloud_access_policy_token",
	"infisical_secret",
	"infisical_secret_import",
	"railway_custom_domain",
	"railway_service_domain",
	"railway_variable",
	"terraform_data",
}

# An array, not a set: two identical change objects are still two changes.
managed_changes := [rc | some rc in input.resource_changes; rc.mode == "managed"]

deletes(rc) if "delete" in rc.change.actions

verb(rc) := "replace" if {
	"create" in rc.change.actions
	deletes(rc)
} else := "delete"

# A deliberate teardown of a non-production environment.
teardown if input.teardown.protection == "standard"

deny contains msg if {
	some rc in managed_changes
	deletes(rc)
	not rc.type in deletable
	not teardown
	msg := sprintf(
		"%s: refusing to %s a %s — it may hold data. Use a `removed { lifecycle { destroy = false } }` block to stop managing it.",
		[rc.address, verb(rc), rc.type],
	)
}

protection := input.variables.protection.value

deny contains msg if {
	input.teardown.protection == "production"
	msg := "refusing to tear down a production environment"
}

# Production brake: a plan that deletes most of a resource type is almost
# certainly a broken or truncated configuration, not an intended change.
deny contains msg if {
	protection == "production"
	some type in {rc.type | some rc in managed_changes}
	instances := [rc | some rc in managed_changes; rc.type == type]
	removed := [rc | some rc in instances; deletes(rc)]
	count(removed) >= 2
	count(removed) * 2 > count(instances)
	msg := sprintf(
		"%s: plan deletes %d of %d instances in a production environment; refusing a mass delete.",
		[type, count(removed), count(instances)],
	)
}
