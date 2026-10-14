# Fleet creates the project and environments before any foundation deploy.
data "railway_project" "this" {
  name = var.project
}
data "railway_environment" "this" {
  name       = var.env
  project_id = data.railway_project.this.id
}
variable "railway" { type = any }
module "population_service" {
  source         = "../../modules/synthetic-population-service"
  project_id     = data.railway_project.this.id
  environment_id = data.railway_environment.this.id
  environment    = var.env
  api_origin     = "https://${var.hosts.api}"
  worker_token   = module.secrets.generated["POPULATION_WORKER_TOKEN"]
  collector = {
    url         = module.observability.collector_url
    metrics_url = module.observability.metrics_collector_url
    user        = module.observability.collector_user
    token       = module.observability.collector_token
  }
  configuration = var.population
}
output "population_deployment" { value = module.population_service.deployment }
