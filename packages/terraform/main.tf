# -- Cloudflare zone (DNS delegated from Squarespace registrar) ----------------

resource "cloudflare_zone" "main" {
  account = {
    id = var.cloudflare_account_id
  }
  name = "gamezilla.app"
  type = "full"
}

# -- Static web app (Cloudflare Pages) ----------------------------------------

module "cloudflare_pages" {
  source = "./modules/cloudflare-pages"

  cloudflare_account_id = var.cloudflare_account_id
  cloudflare_zone_id    = cloudflare_zone.main.id
  custom_domain         = var.custom_domain
}

# -- Cloudflare D1 (SQLite database for the API worker) ----------------------

resource "cloudflare_d1_database" "main" {
  account_id = var.cloudflare_account_id
  name       = "gamezilla-db"

  read_replication = {
    mode = "disabled"
  }
}
