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

# These belong to fleet, so adding an env file provisions its Railway environment
# before foundation configures any services. Only a deliberate teardown deletes one.
resource "railway_environment" "this" {
  for_each = local.envs

  name                  = each.key
  project_id            = railway_project.this.id
  source_environment_id = railway_project.this.default_environment.id
}
