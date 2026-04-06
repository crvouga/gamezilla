module "app" {
  source = "../fly-app"

  name            = var.name
  fly_org         = var.fly_org
  fly_region      = var.fly_region
  custom_hostname = var.custom_hostname
}

resource "fly_volume" "data" {
  app    = module.app.app_name
  name   = "emqx_data"
  size   = var.volume_size_gb
  region = var.fly_region
}
