variable "cloudflare_account_id" {
  type = string
}

variable "cloudflare_zone_id" {
  type = string
}

variable "project_name" {
  type    = string
  default = "gamezilla-client"
}

variable "domain" {
  type    = string
  default = "gamezilla.app"
}

variable "custom_domain" {
  type    = bool
  default = false
}
