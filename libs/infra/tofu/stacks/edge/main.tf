# Public hostnames onto the Workers `wrangler deploy` just shipped. Runs after
# the Worker deploys (`@libs/infra#apply:edge`) because a custom domain needs
# its script to exist.

module "names" {
  source  = "../../modules/naming"
  project = var.project
  suffix  = var.suffix
}

data "cloudflare_zone" "this" {
  filter = {
    name    = var.cloudflare.zone_name
    account = { id = var.cloudflare.account_id }
  }
}

module "edge" {
  source     = "../../modules/edge"
  account_id = var.cloudflare.account_id
  zone_id    = data.cloudflare_zone.this.zone_id
  domains = {
    api  = { hostname = var.hosts.api, service = module.names.api_worker }
    web  = { hostname = var.hosts.web, service = module.names.web_worker }
    apex = { hostname = var.hosts.apex, service = module.names.web_worker }
  }
}

import {
  for_each = var.imports.edge.custom_domains
  to       = module.edge.cloudflare_workers_custom_domain.this[each.key]
  id       = each.value
}
