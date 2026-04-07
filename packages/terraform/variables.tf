variable "cloudflare_account_id" {
  description = "Cloudflare account ID"
  type        = string
}

variable "custom_domain" {
  description = "Enable custom domain DNS records"
  type        = bool
}

# -- PlanetScale ---------------------------------------------------------------

variable "planetscale_org" {
  description = "PlanetScale organization slug"
  type        = string
}

variable "planetscale_database" {
  description = "PlanetScale database name"
  type        = string
}
