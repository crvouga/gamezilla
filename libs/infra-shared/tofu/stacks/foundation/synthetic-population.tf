variable "railway" {
  type = object({ workspace_id = string })
}
module "population_service" {
  source       = "../../modules/synthetic-population-service"
  name         = "${var.project}-${var.env}-population"
  workspace_id = var.railway.workspace_id
  environment  = var.env
  api_origin   = "https://${var.hosts.api}"
  worker_token = module.secrets.generated["POPULATION_WORKER_TOKEN"]
  collector = {
    url         = module.observability.collector_url
    metrics_url = module.observability.metrics_collector_url
    user        = module.observability.collector_user
    token       = module.observability.collector_token
  }
  configuration = var.population
}
output "population_deployment" { value = module.population_service.deployment }
