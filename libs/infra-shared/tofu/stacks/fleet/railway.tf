# One Railway project for the application. Keep core empty: forking it creates
# isolated environments without copying another environment's services or secrets.
resource "railway_project" "this" {
  name                = var.project
  workspace_id        = var.railway.workspace_id
  private             = true
  has_pr_deploys      = false
  default_environment = { name = "core" }

  lifecycle {
    prevent_destroy = true
  }
}

# Foundation reads this ID from encrypted fleet state. The provider's project
# name listing is not scoped to the workspace that owns this resource.
output "railway_project_id" { value = railway_project.this.id }

locals {
  # Railway admits one environment creation per 30 seconds per workspace, and
  # OpenTofu would otherwise create every environment at once. Each environment
  # waits its sorted position times this interval (with margin) before creating.
  railway_environment_interval_seconds = 35
  railway_environment_position         = { for index, env in sort(keys(local.envs)) : env => index }
}

# Only runs when an environment is first provisioned; the wait is not repeated.
resource "terraform_data" "railway_environment_pacing" {
  for_each = local.envs

  provisioner "local-exec" {
    command = "sleep ${local.railway_environment_position[each.key] * local.railway_environment_interval_seconds}"
  }
}

# These belong to fleet, so adding an env file provisions its Railway environment
# before foundation configures any services. Only a deliberate teardown deletes one.
resource "railway_environment" "this" {
  for_each = local.envs

  name                  = each.key
  project_id            = railway_project.this.id
  source_environment_id = railway_project.this.default_environment.id

  depends_on = [terraform_data.railway_environment_pacing]
}
