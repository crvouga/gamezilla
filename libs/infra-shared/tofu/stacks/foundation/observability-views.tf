provider "grafana" {
  alias                     = "stack_management"
  cloud_access_policy_token = module.observability.management_token
}

resource "grafana_cloud_stack_service_account" "observability" {
  provider   = grafana.stack_management
  stack_slug = var.grafana.stack_slug
  name       = "${var.project}-${var.env}-observability"
  role       = "Editor"
}

resource "grafana_cloud_stack_service_account_token" "observability" {
  provider           = grafana.stack_management
  stack_slug         = var.grafana.stack_slug
  name               = "${var.project}-${var.env}-observability"
  service_account_id = grafana_cloud_stack_service_account.observability.id
}

provider "grafana" {
  alias = "views"
  url   = module.observability.grafana_url
  auth  = grafana_cloud_stack_service_account_token.observability.key
}

module "observability_views" {
  source      = "../../modules/observability-views"
  environment = var.env
  stack_slug  = var.grafana.stack_slug
  providers = {
    grafana = grafana.views
  }
}
