variable "region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "custom_domain" {
  description = "Enable Route 53 hosted zone and ACM certificate for gamezilla.app"
  type        = bool
  default     = false
}

variable "custom_domain_bootstrap" {
  description = "When true, create the hosted zone but skip the ACM certificate (for initial NS delegation)"
  type        = bool
  default     = false
}

variable "app_image" {
  description = "Full ECR image URI (repo:tag) for the application container"
  type        = string
}

variable "emqx_image" {
  description = "Full ECR image URI (repo:tag) for the EMQX broker container"
  type        = string
}
