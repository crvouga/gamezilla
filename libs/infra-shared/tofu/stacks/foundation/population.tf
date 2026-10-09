variable "railway" {
  type = object({ workspace_id = string })
}
module "population_service" {
  source        = "../../modules/population-service"
  name          = "${var.project}-${var.suffix}-population"
  workspace_id  = var.railway.workspace_id
  environment   = var.env
  api_origin    = "https://${var.hosts.api}"
  worker_token  = module.secrets.generated["POPULATION_WORKER_TOKEN"]
  configuration = var.population
}
output "population_deployment" { value = module.population_service.deployment }
