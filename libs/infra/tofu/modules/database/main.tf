# Postgres. Every environment is a branch of ONE Neon project (created once,
# by a human, with the project). The production environment runs on the
# project's root branch; every other environment gets its own branch of it,
# created here — so a new replica starts as a copy of production's data and
# needs no console step. OpenTofu also owns each branch's read-write endpoint
# and derives DATABASE_URL from them, plus the Hyperdrive config the API
# Worker connects through. Inside the branch, OpenTofu owns only
# database-level configuration (extensions); tables are the app's migrations.
#
# Neon resources are deleted only by tearing down a whole standard
# environment (`bun run infra:destroy`); libs/infra/policy/stateful.rego
# refuses it for production and in every ordinary apply.

terraform {
  required_providers {
    cloudflare = { source = "cloudflare/cloudflare" }
    neon       = { source = "kislerdm/neon" }
    postgresql = { source = "cyrilgdn/postgresql" }
  }
}

variable "neon_project_id" {
  type        = string
  description = "The one Neon project every environment branches from (global.tfvars.json)."
}

variable "root_branch_id" {
  type        = string
  description = "The project's root branch: production's database, every other branch's parent."
}

variable "production" {
  type        = bool
  description = "Runs on the root branch instead of a branch of its own."
}

variable "branch_name" {
  type = string
}

variable "account_id" {
  type        = string
  description = "Cloudflare account the Hyperdrive config lives in (the Workers' account)."
}

variable "hyperdrive_name" {
  type = string
}

locals {
  # The role and database every branch inherits from the root at creation.
  role     = "neondb_owner"
  database = "neondb"
}

resource "neon_branch" "this" {
  count = var.production ? 0 : 1

  project_id = var.neon_project_id
  parent_id  = var.root_branch_id
  name       = var.branch_name
}

locals {
  branch_id = var.production ? var.root_branch_id : neon_branch.this[0].id
}

resource "neon_endpoint" "this" {
  project_id               = var.neon_project_id
  branch_id                = local.branch_id
  type                     = "read_write"
  autoscaling_limit_min_cu = 0.25
  autoscaling_limit_max_cu = 8
  suspend_timeout_seconds  = 0
}

data "neon_branch_role_password" "owner" {
  project_id = var.neon_project_id
  branch_id  = local.branch_id
  role_name  = local.role

  depends_on = [neon_endpoint.this]
}

# Slow-query statistics (`bun obs`, docs/OBSERVABILITY.md). Neon
# preloads the library; the extension must exist in the app database.
# CREATE EXTENSION IF NOT EXISTS — adopting an existing one is a no-op.
resource "postgresql_extension" "pg_stat_statements" {
  name = "pg_stat_statements"
}

# Hyperdrive: the API Worker's connection to the branch. It keeps warm
# connections to the direct (unpooled) endpoint next to the database and
# pools them for every Worker isolate, so a request never pays a TLS + auth
# handshake to Neon. Query caching is off: sync hydration must read its own
# writes, and a cached `SELECT` would serve a snapshot from before them.
# Stateless: replacing it only changes the id the next Worker deploy binds.
resource "cloudflare_hyperdrive_config" "this" {
  account_id = var.account_id
  name       = var.hyperdrive_name

  origin = {
    scheme   = "postgres"
    host     = neon_endpoint.this.host
    port     = 5432
    database = local.database
    user     = local.role
    password = data.neon_branch_role_password.owner.password
  }

  caching = {
    disabled = true
  }
}

output "hyperdrive_id" {
  description = "Bound into the API Worker as HYPERDRIVE (wrangler render)."
  value       = cloudflare_hyperdrive_config.this.id
}

output "database_url" {
  description = "Migrations, tooling and the non-production URL policy connect with this: the pooled host. Workers go through Hyperdrive."
  value       = "postgresql://${local.role}:${data.neon_branch_role_password.owner.password}@${neon_endpoint.this.host_pooling}/${local.database}?sslmode=require&channel_binding=require"
  sensitive   = true
}

output "connection" {
  description = "Direct (unpooled) coordinates for DDL."
  value = {
    host     = neon_endpoint.this.host
    user     = local.role
    password = data.neon_branch_role_password.owner.password
    database = local.database
  }
  sensitive = true
}
