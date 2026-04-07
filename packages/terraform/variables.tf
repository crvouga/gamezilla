variable "cloudflare_account_id" {
  description = "Cloudflare account ID"
  type        = string
}

variable "cloudflare_zone_id" {
  description = "Cloudflare zone ID for gamezilla.app"
  type        = string
}

variable "custom_domain" {
  description = "Enable custom domain DNS records"
  type        = bool
  default     = false
}

# -- PlanetScale ---------------------------------------------------------------

variable "planetscale_org" {
  description = "PlanetScale organization slug"
  type        = string
}

variable "planetscale_database" {
  description = "PlanetScale database name (must already exist)"
  type        = string
  default     = "gamezilla"
}
