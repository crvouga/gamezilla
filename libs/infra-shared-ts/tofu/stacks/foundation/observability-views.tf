provider "grafana" {
  alias                     = "stack_management"
  cloud_access_policy_token = module.observability.management_token
}

# The provider waits ten minutes on the instance health URL before it creates
# a service account. An archived instance answers that URL with 404, so the
# account, its token, and the dashboards exist only while the instance is active.
resource "grafana_cloud_stack_service_account" "observability" {
  count = module.observability.grafana_instance_ready ? 1 : 0

  provider   = grafana.stack_management
  stack_slug = var.grafana.stack_slug
  name       = "${var.project}-${var.env}-observability"
  role       = "Editor"
}

resource "grafana_cloud_stack_service_account_token" "observability" {
  count = module.observability.grafana_instance_ready ? 1 : 0

  provider           = grafana.stack_management
  stack_slug         = var.grafana.stack_slug
  name               = "${var.project}-${var.env}-observability"
  service_account_id = grafana_cloud_stack_service_account.observability[0].id
}

provider "grafana" {
  alias = "views"
  url   = module.observability.grafana_url
  auth  = module.observability.grafana_instance_ready ? grafana_cloud_stack_service_account_token.observability[0].key : "instance-not-active"
}

module "observability_views" {
  count       = module.observability.grafana_instance_ready ? 1 : 0
  source      = "../../modules/observability-views"
  environment = var.env
  namespace   = var.project
  grafana_url = module.observability.grafana_url
  providers = {
    grafana = grafana.views
  }
}
