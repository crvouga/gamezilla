# Public hostnames → Workers. Runs after `wrangler deploy` has created the
# scripts. Custom domains are stateless: Cloudflare re-issues their
# certificates on create.

terraform {
  required_providers {
    cloudflare = { source = "cloudflare/cloudflare" }
  }
}

variable "account_id" {
  type = string
}

variable "zone_id" {
  type = string
}

variable "domains" {
  type        = map(object({ hostname = string, service = string }))
  description = "Logical name → { hostname, Worker script name }."
}

resource "cloudflare_workers_custom_domain" "this" {
  for_each = var.domains

  account_id = var.account_id
  zone_id    = var.zone_id
  hostname   = each.value.hostname
  service    = each.value.service
}
