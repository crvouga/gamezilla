# Vanilla PlanetScale Postgres. Each environment is its own database
# (`<project>-<suffix>`, branch `main`), so a standard environment can be
# created and torn down without touching production, and Deploy can apply
# standard environments before production. A new database starts empty:
# `@libs/runtime#migrate` builds the schema. The app only has a connection
# string. This is not Neki: no routers, no shards, no admin service.
#
# The branch is `PS_DEV_AWS_ARM`, the smallest single-node Postgres this
# provider can create. In us-east that is one node at $5/month. PS-5
# single-node is the same price (1/16 vCPU, 512 MB), but
# `planetscale_postgres_branch.replicas` is read-only through provider 1.12
# (planetscale/terraform-provider-planetscale#293), so `PS_5_AWS_ARM` comes
# up as a 3-node HA cluster at $15. PS-DEV is PlanetScale's development
# branch size: one node, no replicas, and it cannot be a default branch.
# This database's only branch is `main`.
#
# The API Worker reaches Postgres through Cloudflare Hyperdrive (pooling
# next to the database, query cache off). Migrations use a separate role
# that inherits `postgres`, because the app role can read and write rows
# and cannot change tables.
#
# Branches and roles are deleted only by tearing down a whole standard
# environment. Production's branch is deletion-protected and
# `prevent_destroy`. libs/infra-shared/policy/stateful.rego refuses a production
# teardown and any ordinary delete of these types. The previous Neki
# databases are listed in that policy's `retired` set so this replacement
# can delete them.

terraform {
  required_providers {
    cloudflare  = { source = "cloudflare/cloudflare" }
    planetscale = { source = "planetscale/planetscale" }
  }
}

variable "organization" {
  type        = string
  description = "PlanetScale organization slug (global.tfvars.json)."
}

variable "region" {
  type        = string
  description = "PlanetScale region slug. Both databases stay in this region."
}

variable "database_name" {
  type        = string
  description = "This environment's Postgres database. Creating the branch creates it."
}

variable "production" {
  type        = bool
  description = "Production's branch cannot be destroyed or replaced by OpenTofu."
}

variable "account_id" {
  type        = string
  description = "Cloudflare account the Hyperdrive config lives in."
}

variable "hyperdrive_name" {
  type = string
}

locals {
  branch_name  = "main"
  database     = "postgres"
  port         = 5432
  cluster_size = "PS_DEV_AWS_ARM"
}

resource "planetscale_postgres_branch" "production" {
  count = var.production ? 1 : 0

  organization       = var.organization
  database           = var.database_name
  name               = local.branch_name
  region             = var.region
  cluster_size       = local.cluster_size
  deletion_protected = true

  lifecycle {
    prevent_destroy = true
  }
}

resource "planetscale_postgres_branch" "standard" {
  count = var.production ? 0 : 1

  organization       = var.organization
  database           = var.database_name
  name               = local.branch_name
  region             = var.region
  cluster_size       = local.cluster_size
  deletion_protected = false
}

# DDL. `postgres` is the inherited role that may change tables.
resource "planetscale_postgres_branch_role" "migrate" {
  organization    = var.organization
  database        = var.database_name
  branch          = local.branch_name
  name            = "migrate"
  inherited_roles = ["postgres"]

  depends_on = [
    planetscale_postgres_branch.production,
    planetscale_postgres_branch.standard,
  ]
}

# The API Worker. Row access; not DDL.
resource "planetscale_postgres_branch_role" "app" {
  organization    = var.organization
  database        = var.database_name
  branch          = local.branch_name
  name            = "app"
  inherited_roles = ["pg_read_all_data", "pg_write_all_data"]

  depends_on = [
    planetscale_postgres_branch.production,
    planetscale_postgres_branch.standard,
  ]
}

# `bun obs person`. pg_read_all_data covers SELECT; pg_monitor covers
# pg_stat_statements. The login name PlanetScale issues may carry a branch suffix.
resource "planetscale_postgres_branch_role" "obs_read" {
  organization    = var.organization
  database        = var.database_name
  branch          = local.branch_name
  name            = "obs_read"
  inherited_roles = ["pg_read_all_data", "pg_monitor"]

  depends_on = [
    planetscale_postgres_branch.production,
    planetscale_postgres_branch.standard,
  ]
}

locals {
  migrate_host = regex(
    "^[^:/]+",
    replace(replace(planetscale_postgres_branch_role.migrate.access_host_url, "/^postgres(?:ql)?:\\/\\//", ""), "/^[^@/]+@/", ""),
  )
  app_host = regex(
    "^[^:/]+",
    replace(replace(planetscale_postgres_branch_role.app.access_host_url, "/^postgres(?:ql)?:\\/\\//", ""), "/^[^@/]+@/", ""),
  )
  obs_host = regex(
    "^[^:/]+",
    replace(replace(planetscale_postgres_branch_role.obs_read.access_host_url, "/^postgres(?:ql)?:\\/\\//", ""), "/^[^@/]+@/", ""),
  )
}

# Hyperdrive pools connections from every Worker isolate to Postgres.
# Query caching is off: sync hydration must read its own writes.
# Replacing it only changes the id the next Worker deploy binds.
resource "cloudflare_hyperdrive_config" "this" {
  account_id = var.account_id
  name       = var.hyperdrive_name

  origin = {
    scheme   = "postgres"
    host     = local.app_host
    port     = local.port
    database = local.database
    user     = planetscale_postgres_branch_role.app.username
    password = planetscale_postgres_branch_role.app.password
  }

  caching = {
    disabled = true
  }
}

output "hyperdrive_id" {
  description = "Bound into the API Worker as HYPERDRIVE."
  value       = cloudflare_hyperdrive_config.this.id
}

output "database_url" {
  description = "Migrations and tooling. The Worker uses Hyperdrive and the app role."
  value       = "postgresql://${urlencode(planetscale_postgres_branch_role.migrate.username)}:${urlencode(planetscale_postgres_branch_role.migrate.password)}@${local.migrate_host}:${local.port}/${local.database}?sslmode=verify-full"
  sensitive   = true
}

output "obs_readonly_database_url" {
  description = "SELECT-only URL for bun obs. Not the migrate role."
  value       = "postgresql://${urlencode(planetscale_postgres_branch_role.obs_read.username)}:${urlencode(planetscale_postgres_branch_role.obs_read.password)}@${local.obs_host}:${local.port}/${local.database}?sslmode=verify-full"
  sensitive   = true
}
