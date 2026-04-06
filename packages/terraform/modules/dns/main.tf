resource "cloudflare_record" "api" {
  count   = var.enabled ? 1 : 0
  zone_id = var.cloudflare_zone_id
  name    = "api"
  content = var.req_res_ipv4
  type    = "A"
  proxied = true
}

resource "cloudflare_record" "api_v6" {
  count   = var.enabled ? 1 : 0
  zone_id = var.cloudflare_zone_id
  name    = "api"
  content = var.req_res_ipv6
  type    = "AAAA"
  proxied = true
}

resource "cloudflare_record" "mqtt" {
  count   = var.enabled ? 1 : 0
  zone_id = var.cloudflare_zone_id
  name    = "mqtt"
  content = var.emqx_ipv4
  type    = "A"
  proxied = false
}

resource "cloudflare_record" "mqtt_v6" {
  count   = var.enabled ? 1 : 0
  zone_id = var.cloudflare_zone_id
  name    = "mqtt"
  content = var.emqx_ipv6
  type    = "AAAA"
  proxied = false
}
