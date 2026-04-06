variable "cloudflare_account_id" {
  description = "Cloudflare account ID"
  type        = string
}

variable "cloudflare_zone_id" {
  description = "Cloudflare zone ID for gamezilla.app"
  type        = string
}

variable "fly_org" {
  description = "Fly.io organization slug"
  type        = string
  default     = "personal"
}

variable "fly_region" {
  description = "Primary Fly.io region"
  type        = string
  default     = "iad"
}

variable "custom_domain" {
  description = "Enable custom domain DNS records"
  type        = bool
  default     = false
}
