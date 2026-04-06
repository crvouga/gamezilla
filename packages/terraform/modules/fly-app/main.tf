resource "fly_app" "this" {
  name = var.name
  org  = var.fly_org
}

resource "fly_ip" "v4" {
  app  = fly_app.this.name
  type = "v4"
}

resource "fly_ip" "v6" {
  app  = fly_app.this.name
  type = "v6"
}

resource "fly_cert" "custom" {
  count    = var.custom_hostname != "" ? 1 : 0
  app      = fly_app.this.name
  hostname = var.custom_hostname
}
