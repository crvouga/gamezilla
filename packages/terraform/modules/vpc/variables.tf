variable "nat_gateways" {
  description = "Number of NAT gateways (1 for cost savings, 2 for HA)"
  type        = number
  default     = 1
}

variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
  default     = "gamezilla"
}
