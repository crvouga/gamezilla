variable "custom_domain" {
  description = "Enable Route 53 hosted zone and ACM certificate for gamezilla.app"
  type        = bool
  default     = false
}

variable "custom_domain_bootstrap" {
  description = "When true, create the hosted zone but skip the ACM certificate"
  type        = bool
  default     = false
}

variable "domain_name" {
  description = "Root domain name"
  type        = string
  default     = "gamezilla.app"
}

variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
  default     = "gamezilla"
}
