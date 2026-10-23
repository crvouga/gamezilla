# Plan gate for every `tofu apply` (../infra-server-ts/scripts/tofu.ts runs it on
# `tofu show -json <plan>` and refuses to apply on any `deny`).
#
# Deletion is ALLOW-LISTED: only the resource types in `deletable` may ever be
# deleted or replaced. Everything else — buckets, Postgres branches and roles,
# the Grafana stack, generated secrets, and any type added in the future —
# is protected by default, so forgetting to classify a new stateful resource
# cannot lose data. Retire such a resource with a
# `removed { lifecycle { destroy = false } }` block (a "forget", not a delete),
# or, for one instance of a `for_each`, by naming it in `retired`.
#
# The one exception is tearing a whole environment down on purpose
# (`bun run infra:destroy`): ../infra-server-ts/scripts/tofu.ts adds `input.teardown` with the
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
	"cloudflare_r2_bucket_lifecycle",
	"cloudflare_r2_custom_domain",
	"cloudflare_workers_custom_domain",
	"github_actions_variable",
	"grafana_cloud_access_policy",
	"grafana_cloud_access_policy_token",
	# Only managed definitions/credentials; telemetry storage is not deleted.
	"grafana_cloud_stack_service_account",
	"grafana_cloud_stack_service_account_token",
	"infisical_secret",
	"infisical_secret_import",
	"terraform_data",
	"railway_service",
	"railway_service_instance",
	"railway_variable_collection",
	"aws_acm_certificate",
	"aws_acm_certificate_validation",
	"aws_cloudwatch_log_group",
	"aws_iam_access_key",
	"aws_iam_role",
	"aws_iam_role_policy",
	"aws_iam_role_policy_attachment",
	"aws_iam_user",
	"aws_iam_user_policy",
	"aws_iot_authorizer",
	"aws_iot_domain_configuration",
	"aws_lambda_function",
	"aws_lambda_permission",
	# Synthetic Population Workers hold only disposable client instances; identity, leases,
	# matchmaking and games remain in the existing durable services.
}

# Addresses an ordinary apply may delete even though their type is protected.
# A `removed` block cannot forget one `for_each` instance (OpenTofu refuses
# an address with a key), so that instance is named here. Drop an entry once
# every environment has applied without it.
retired := {
	# The reports bucket was deleted; retire its read/write credentials. They
	# account for most Cloudflare tokens, so exclude this intended removal
	# from the production mass-delete brake. The app's S3 token stays managed.
	"module.report_access.cloudflare_account_token.read",
	"module.report_access.cloudflare_account_token.write",
	# The old per-environment projects held only disposable population workers,
	# with no volumes. Recreate those workers in fleet's shared project, then
	# remove the old projects. Shared projects and environments stay protected.
	"module.population_service.railway_project.worker",
	# Sealed the Synthetic Users' sign-in secrets. They sign in with emailed
	# links now, and nothing is sealed for them. Deleting it loses no data.
	"module.secrets.random_password.generated_value[\"POPULATION_CREDENTIAL_SECRET\"]",
	# The Neki databases stay at PlanetScale. Foundation forgets these addresses
	# (`destroy = false`): a role drop returns 422 while the branch still
	# references the role, and Postgres cannot be created on the Neki database.
	# The indexed form stays here so a plan that still deletes one instance is
	# allowed. Drop the entries once both environments have applied without them.
	"module.database.planetscale_neki_branch.production[0]",
	"module.database.planetscale_neki_branch.standard[0]",
	"module.database.planetscale_neki_role.migrate",
	"module.database.planetscale_neki_role.app",
	"module.database.planetscale_neki_role.obs_read",
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
	not rc.address in retired
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

# A delete with no matching create: the configuration no longer declares it.
drops(rc) if {
	deletes(rc)
	not "create" in rc.change.actions
}

# Production brake: a plan that drops most of a resource type is almost
# certainly a broken or truncated configuration, not an intended change. A
# replace still declares the resource, so it is no evidence of truncation —
# and a replace of anything that may hold data is already denied above.
deny contains msg if {
	protection == "production"
	some type in {rc.type | some rc in managed_changes}

	# Retired addresses are an intentional one-off delete, not a truncated plan.
	instances := [rc | some rc in managed_changes; rc.type == type; not rc.address in retired]
	removed := [rc | some rc in instances; drops(rc)]
	count(removed) >= 2
	count(removed) * 2 > count(instances)
	msg := sprintf(
		"%s: plan deletes %d of %d instances in a production environment; refusing a mass delete.",
		[type, count(removed), count(instances)],
	)
}
