# Physical names for one environment. Pure: no resources, no providers.
#
# The patterns live in patterns.json so `@libs/infra`'s TypeScript
# (render-wrangler, the env-file tests) derives exactly the same names from
# the same file. Names are a function of (project, suffix) only — never of a
# hard-coded environment.

variable "project" {
  type        = string
  description = "Project slug shared by every resource name (e.g. `gamezilla`)."
}

variable "suffix" {
  type        = string
  description = "Environment suffix appended to account-scoped names (e.g. `production`)."
}

locals {
  patterns = jsondecode(file("${path.module}/patterns.json"))
  names = {
    for key, pattern in local.patterns :
    key => replace(replace(pattern, "{project}", var.project), "{suffix}", var.suffix)
  }
}

output "api_worker" {
  value = local.names.api_worker
}

output "room_worker" {
  value = local.names.room_worker
}

output "web_worker" {
  value = local.names.web_worker
}

output "bucket" {
  value = local.names.bucket
}

output "s3_token" {
  value = local.names.s3_token
}

output "reports_read_token" {
  value = local.names.reports_read_token
}

output "reports_write_token" {
  value = local.names.reports_write_token
}

output "traces_write_policy" {
  value = local.names.traces_write_policy
}

output "traces_read_policy" {
  value = local.names.traces_read_policy
}

output "hyperdrive" {
  value = local.names.hyperdrive
}
