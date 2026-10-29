# Stack-wide alerting: Grafana Synthetic Monitoring and its checks of every
# environment, and the one notification policy and IRM integration every
# environment's rules route through. The stack is shared by every
# environment, so these live here, applied once by a person, rather than in
# each environment's foundation (which owns that environment's rules, SLOs and
# dashboards, modules/observability-views).

locals {
  envs           = var.envs
  production_env = one([for name, env in local.envs : name if env.protection == "production"])
  routing_ready = alltrue([
    for value in [var.alerting.irm_responder, var.alerting.digest_email] :
    value != null
  ])
}

# ---- Synthetic Monitoring -------------------------------------------------

resource "grafana_cloud_access_policy" "synthetic_monitoring" {
  region = var.grafana.region
  name   = "${var.project}-synthetic-monitoring"
  scopes = ["metrics:write", "logs:write", "traces:write", "stacks:read"]

  realm {
    type       = "stack"
    identifier = module.trace_stack.id
  }
}

resource "grafana_cloud_access_policy_token" "synthetic_monitoring" {
  region           = var.grafana.region
  access_policy_id = grafana_cloud_access_policy.synthetic_monitoring.policy_id
  name             = "${var.project}-synthetic-monitoring-token"
}

# STATEFUL in Grafana's sense (the stack's Synthetic Monitoring tenant):
# never deleted by an ordinary apply (policy/stateful.rego).
resource "grafana_synthetic_monitoring_installation" "this" {
  stack_id              = module.trace_stack.id
  metrics_publisher_key = grafana_cloud_access_policy_token.synthetic_monitoring.token
}

provider "grafana" {
  alias           = "synthetic_monitoring"
  sm_access_token = grafana_synthetic_monitoring_installation.this.sm_access_token
  sm_url          = grafana_synthetic_monitoring_installation.this.stack_sm_api_url
}

module "synthetic_monitoring" {
  source       = "../../modules/synthetic-monitoring"
  environments = local.envs
  probe        = var.alerting.probe
  brand_name   = var.brand_name
  providers = {
    grafana = grafana.synthetic_monitoring
  }
}

# ---- Routing: IRM and the notification policy -----------------------------
# Off until `alerting` in global.tfvars.json names the responder's IRM
# username and the digest address. Until then alerts keep the stack's
# existing notification policy. In Grafana Cloud the provider reaches IRM
# through the instance `url` and `auth`; no IRM address is needed.

resource "grafana_cloud_stack_service_account" "alerting" {
  count = local.routing_ready ? 1 : 0

  stack_slug = var.grafana.stack_slug
  name       = "${var.project}-alerting"
  role       = "Editor"
}

resource "grafana_cloud_stack_service_account_token" "alerting" {
  count = local.routing_ready ? 1 : 0

  stack_slug         = var.grafana.stack_slug
  name               = "${var.project}-alerting"
  service_account_id = grafana_cloud_stack_service_account.alerting[0].id
}

provider "grafana" {
  alias = "alerting"
  url   = module.trace_stack.url
  auth  = local.routing_ready ? grafana_cloud_stack_service_account_token.alerting[0].key : "routing-not-configured"
}

module "alert_routing" {
  count              = local.routing_ready ? 1 : 0
  source             = "../../modules/alert-routing"
  responder          = var.alerting.irm_responder
  digest_email       = var.alerting.digest_email
  paging_environment = local.production_env
  brand_name         = var.brand_name
  providers = {
    grafana = grafana.alerting
  }
}
