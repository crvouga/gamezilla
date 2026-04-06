variable "name" {
  description = "Fly.io app name"
  type        = string
}

variable "fly_org" {
  description = "Fly.io organization slug"
  type        = string
}

variable "fly_region" {
  description = "Primary Fly.io region"
  type        = string
}

variable "custom_hostname" {
  description = "Custom hostname for TLS cert (empty to skip)"
  type        = string
  default     = ""
}
