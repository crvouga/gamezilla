variable "cloudflare_zone_id" {
  type = string
}

variable "enabled" {
  type    = bool
  default = false
}

variable "req_res_ipv4" {
  type = string
}

variable "req_res_ipv6" {
  type = string
}

variable "emqx_ipv4" {
  type = string
}

variable "emqx_ipv6" {
  type = string
}
