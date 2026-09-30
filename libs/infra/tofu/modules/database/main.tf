# Postgres on PlanetScale Neki. Each environment is its own database
# (`<project>-<suffix>`, branch `main`), so a standard environment can be
# created and torn down without touching production, and Deploy can apply
# standard environments before production. A new database starts empty:
# `@libs/runtime#migrate` builds the schema. PlanetScale owns placement,
# routing, and resharding. The app only has a connection string.
#
# The API Worker reaches the router through Cloudflare Hyperdrive (pooling
# next to the database, query cache off). Migrations use a separate role
# that inherits `postgres`, because the app role can read and write rows
# and cannot change tables.
#
# Neki branches and roles are deleted only by tearing down a whole standard
# environment. Production's branch is deletion-protected and
# `prevent_destroy`. libs/infra/policy/stateful.rego refuses a production
# teardown and any ordinary delete of these types.

terraform {
  required_providers {
    cloudflare  = { source = "cloudflare/cloudflare" }
    planetscale = { source = "planetscale/planetscale" }
    postgresql  = { source = "cyrilgdn/postgresql" }
  }
}

variable "organization" {
  type        = string
  description = "PlanetScale organization slug (global.tfvars.json)."
}

variable "region" {
  type        = string
  description = "Neki region. Growth stays in this region; PlanetScale reshardes."
}

variable "database_name" {
  type        = string
  description = "This environment's Neki database. Creating the branch creates it."
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
  branch_name = "main"
  database    = "postgres"
  port        = 5432
}

resource "planetscale_neki_branch" "production" {
  count = var.production ? 1 : 0

  organization       = var.organization
  database           = var.database_name
  name               = local.branch_name
  region             = var.region
  deletion_protected = true

  lifecycle {
    prevent_destroy = true
  }
}

resource "planetscale_neki_branch" "standard" {
  count = var.production ? 0 : 1

  organization       = var.organization
  database           = var.database_name
  name               = local.branch_name
  region             = var.region
  deletion_protected = false
}

# DDL. `postgres` is the inherited role that may change tables.
resource "planetscale_neki_role" "migrate" {
  organization    = var.organization
  database        = var.database_name
  branch          = local.branch_name
  name            = "migrate"
  inherited_roles = ["postgres"]

  depends_on = [
    planetscale_neki_branch.production,
    planetscale_neki_branch.standard,
  ]
}

# The API Worker. Row access across shards; not DDL.
resource "planetscale_neki_role" "app" {
  organization    = var.organization
  database        = var.database_name
  branch          = local.branch_name
  name            = "app"
  inherited_roles = ["pg_read_all_data", "pg_write_all_data"]

  depends_on = [
    planetscale_neki_branch.production,
    planetscale_neki_branch.standard,
  ]
}

# `bun obs person`. pg_read_all_data covers SELECT; pg_monitor covers
# pg_stat_statements. The login name Neki issues may carry a branch suffix.
resource "planetscale_neki_role" "obs_read" {
  organization    = var.organization
  database        = var.database_name
  branch          = local.branch_name
  name            = "obs_read"
  inherited_roles = ["pg_read_all_data", "pg_monitor"]

  depends_on = [
    planetscale_neki_branch.production,
    planetscale_neki_branch.standard,
  ]
}

locals {
  migrate_host = regex(
    "^[^:/]+",
    replace(replace(planetscale_neki_role.migrate.access_host_url, "/^postgres(?:ql)?:\\/\\//", ""), "/^[^@/]+@/", ""),
  )
  app_host = regex(
    "^[^:/]+",
    replace(replace(planetscale_neki_role.app.access_host_url, "/^postgres(?:ql)?:\\/\\//", ""), "/^[^@/]+@/", ""),
  )
  obs_host = regex(
    "^[^:/]+",
    replace(replace(planetscale_neki_role.obs_read.access_host_url, "/^postgres(?:ql)?:\\/\\//", ""), "/^[^@/]+@/", ""),
  )
}

# Slow-query statistics (`bun obs`). Neki still needs the extension created
# in the database after the profile allows it. The default profile is
# created with the branch; this adopts an existing extension.
resource "postgresql_extension" "pg_stat_statements" {
  name = "pg_stat_statements"
}

# Hyperdrive pools connections from every Worker isolate to the Neki router.
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
    user     = planetscale_neki_role.app.username
    password = planetscale_neki_role.app.password
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
  value       = "postgresql://${urlencode(planetscale_neki_role.migrate.username)}:${urlencode(planetscale_neki_role.migrate.password)}@${local.migrate_host}:${local.port}/${local.database}?sslmode=verify-full"
  sensitive   = true
}

output "obs_readonly_database_url" {
  description = "SELECT-only URL for bun obs. Not the migrate role."
  value       = "postgresql://${urlencode(planetscale_neki_role.obs_read.username)}:${urlencode(planetscale_neki_role.obs_read.password)}@${local.obs_host}:${local.port}/${local.database}?sslmode=verify-full"
  sensitive   = true
}

output "connection" {
  description = "Coordinates for the PostgreSQL provider (DDL, extensions)."
  value = {
    host     = local.migrate_host
    user     = planetscale_neki_role.migrate.username
    password = planetscale_neki_role.migrate.password
    database = local.database
  }
  sensitive = true
}
