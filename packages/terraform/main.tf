# -- Static web app (Cloudflare Pages) ----------------------------------------

module "cloudflare_pages" {
  source = "./modules/cloudflare-pages"

  cloudflare_account_id = var.cloudflare_account_id
  cloudflare_zone_id    = var.cloudflare_zone_id
  custom_domain         = var.custom_domain
}

# -- Req-res API (Fly.io) -----------------------------------------------------

module "fly_req_res" {
  source = "./modules/fly-app"

  name            = "gamezilla-req-res"
  fly_org         = var.fly_org
  fly_region      = var.fly_region
  custom_hostname = var.custom_domain ? "api.gamezilla.app" : ""
}

# -- Worker (Fly.io) ----------------------------------------------------------

module "fly_worker" {
  source = "./modules/fly-app"

  name       = "gamezilla-worker"
  fly_org    = var.fly_org
  fly_region = var.fly_region
}

# -- EMQX pub-sub broker (Fly.io + volume) ------------------------------------

module "fly_emqx" {
  source = "./modules/fly-emqx"

  name            = "gamezilla-emqx"
  fly_org         = var.fly_org
  fly_region      = var.fly_region
  custom_hostname = var.custom_domain ? "mqtt.gamezilla.app" : ""
}

# -- DNS records (Cloudflare -> Fly.io) ----------------------------------------

module "dns" {
  source = "./modules/dns"

  cloudflare_zone_id = var.cloudflare_zone_id
  enabled            = var.custom_domain

  req_res_ipv4 = module.fly_req_res.ipv4
  req_res_ipv6 = module.fly_req_res.ipv6
  emqx_ipv4    = module.fly_emqx.ipv4
  emqx_ipv6    = module.fly_emqx.ipv6
}
