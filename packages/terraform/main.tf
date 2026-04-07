# -- Static web app (Cloudflare Pages) ----------------------------------------

module "cloudflare_pages" {
  source = "./modules/cloudflare-pages"

  cloudflare_account_id = var.cloudflare_account_id
  cloudflare_zone_id    = var.cloudflare_zone_id
  custom_domain         = var.custom_domain
}

# -- DNS records (Cloudflare) -------------------------------------------------

module "dns" {
  source = "./modules/dns"

  cloudflare_zone_id = var.cloudflare_zone_id
  enabled            = var.custom_domain
}

# -- PlanetScale Postgres -----------------------------------------------------

resource "planetscale_postgres_branch" "main" {
  organization = var.planetscale_org
  database     = var.planetscale_database
  name         = "main"
}

resource "planetscale_postgres_branch_role" "app" {
  organization    = var.planetscale_org
  database        = var.planetscale_database
  branch          = planetscale_postgres_branch.main.id
  name            = "app"
  inherited_roles = ["pg_read_all_data", "pg_write_all_data"]
}
