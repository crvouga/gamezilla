variable "name" {
  type    = string
  default = "gamezilla-emqx"
}

variable "fly_org" {
  type = string
}

variable "fly_region" {
  type = string
}

variable "volume_size_gb" {
  type    = number
  default = 1
}

variable "custom_hostname" {
  type    = string
  default = ""
}
