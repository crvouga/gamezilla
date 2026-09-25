# Postgres. Every environment is a branch of ONE Neon project; the project
# and its branches hold the product's data and are created by a human in the
# Neon console, never by OpenTofu. They are ASSERTED by data sources whose
# postconditions fail the plan (and so block every apply) when the database
# is not what the environment claims. Inside the branch, OpenTofu owns only
# database-level configuration (extensions); tables are the app's migrations.

terraform {
  required_providers {
    neon       = { source = "kislerdm/neon" }
    postgresql = { source = "cyrilgdn/postgresql" }
  }
}

variable "neon_project_id" {
  type        = string
  description = "The one Neon project every environment branches from (global.tfvars.json)."
}

variable "neon_branch_id" {
  type        = string
  description = "This environment's branch (envs/<env>.tfvars.json)."
}

variable "database_url" {
  type        = string
  sensitive   = true
  description = "The DATABASE_URL secret this environment's Workers use."
}

locals {
  # The pooler host is the endpoint host with `-pooler` after its id.
  database_url_host = replace(try(regex("@([^/:?]+)", var.database_url)[0], ""), "-pooler.", ".")
}

data "neon_project" "this" {
  id = var.neon_project_id
}

data "neon_branch_endpoints" "this" {
  project_id = data.neon_project.this.id
  branch_id  = var.neon_branch_id

  lifecycle {
    postcondition {
      condition     = contains([for endpoint in self.endpoints : endpoint.host], local.database_url_host)
      error_message = "DATABASE_URL does not point at an endpoint of Neon branch ${var.neon_branch_id} (project ${var.neon_project_id}) — another environment's branch, or the wrong project."
    }
  }
}

# Slow-query statistics (`bun obs`, docs/adr/0001_OBSERVABILITY.md). Neon
# preloads the library; the extension must exist in the app database.
# CREATE EXTENSION IF NOT EXISTS — adopting an existing one is a no-op.
resource "postgresql_extension" "pg_stat_statements" {
  name = "pg_stat_statements"

  depends_on = [data.neon_branch_endpoints.this]
}

output "database_host" {
  value = local.database_url_host
}
