# Disposable Synthetic Population Workers. Accounts, leases and games live in the backend.
terraform {
  required_providers {
    railway = { source = "jamesprnich/railway" }
  }
}
variable "project_id" { type = string }
variable "environment_id" { type = string }
variable "environment" { type = string }
variable "api_origin" { type = string }
variable "worker_token" {
  type      = string
  sensitive = true
}
variable "collector" {
  type      = object({ url = string, metrics_url = string, user = string, token = string })
  sensitive = true
}
variable "configuration" {
  type = object({ replicas = number, capacity = number, vcpus = number, memory_gb = number, region = string })
}

# Railway service names are unique across the project, including fork environments.
resource "railway_service" "worker" {
  name           = "${var.environment}-synthetic-population-worker"
  project_id     = var.project_id
  environment_id = var.environment_id
}
resource "railway_variable_collection" "worker" {
  service_id     = railway_service.worker.id
  environment_id = var.environment_id
  variables = [
    { name = "SECRETS_ENV", value = var.environment },
    { name = "DEPLOYMENT_ENVIRONMENT", value = var.environment },
    { name = "POPULATION_API_ORIGIN", value = var.api_origin },
    { name = "POPULATION_WORKER_TOKEN", value = var.worker_token },
    { name = "POPULATION_CAPACITY", value = tostring(var.configuration.capacity) },
    { name = "POPULATION_SHUTDOWN_MS", value = "110000" },
    { name = "OBSERVABILITY_COLLECTOR_URL", value = var.collector.url },
    { name = "OBSERVABILITY_METRICS_COLLECTOR_URL", value = var.collector.metrics_url },
    { name = "OBSERVABILITY_COLLECTOR_USER", value = var.collector.user },
    { name = "OBSERVABILITY_COLLECTOR_TOKEN", value = var.collector.token },
    { name = "PORT", value = "8080" },
  ]
}
resource "railway_service_instance" "worker" {
  service_id          = railway_service.worker.id
  environment_id      = var.environment_id
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
    project_id     = var.project_id
    service_id     = railway_service.worker.id
    environment_id = var.environment_id
  }
}
