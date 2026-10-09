# Disposable Population Workers. Accounts, leases and games live in the backend.
terraform {
  required_providers {
    railway = { source = "jamesprnich/railway" }
  }
}
variable "name" { type = string }
variable "workspace_id" { type = string }
variable "environment" { type = string }
variable "api_origin" { type = string }
variable "worker_token" {
  type      = string
  sensitive = true
}
variable "configuration" {
  type = object({ replicas = number, capacity = number, vcpus = number, memory_gb = number, region = string })
}

# Each application environment owns a separate project with just one Railway
# environment, so service creation cannot leak into a neighbouring environment.
resource "railway_project" "worker" {
  name                = var.name
  workspace_id        = var.workspace_id
  private             = true
  has_pr_deploys      = false
  default_environment = { name = var.environment }
}
resource "railway_service" "worker" {
  name           = "population-worker"
  project_id     = railway_project.worker.id
  environment_id = railway_project.worker.default_environment.id
}
resource "railway_variable_collection" "worker" {
  service_id     = railway_service.worker.id
  environment_id = railway_project.worker.default_environment.id
  variables = [
    { name = "SECRETS_ENV", value = var.environment },
    { name = "DEPLOYMENT_ENVIRONMENT", value = var.environment },
    { name = "POPULATION_API_ORIGIN", value = var.api_origin },
    { name = "POPULATION_WORKER_TOKEN", value = var.worker_token },
    { name = "POPULATION_CAPACITY", value = tostring(var.configuration.capacity) },
    { name = "POPULATION_SHUTDOWN_MS", value = "110000" },
    { name = "PORT", value = "8080" },
  ]
}
resource "railway_service_instance" "worker" {
  service_id          = railway_service.worker.id
  environment_id      = railway_project.worker.default_environment.id
  num_replicas        = var.configuration.replicas
  region              = var.configuration.region
  vcpus               = var.configuration.vcpus
  memory_gb           = var.configuration.memory_gb
  healthcheck_path    = "/ready"
  healthcheck_timeout = 300
  overlap_seconds     = 120
  draining_seconds    = 120
  restart_policy_type = "ALWAYS"
  sleep_application   = false
  depends_on          = [railway_variable_collection.worker]
}
output "deployment" {
  value = {
    project_id     = railway_project.worker.id
    service_id     = railway_service.worker.id
    environment_id = railway_project.worker.default_environment.id
  }
}
