variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for Fargate tasks"
  type        = list(string)
}

variable "public_subnet_ids" {
  description = "Public subnet IDs for the NLB"
  type        = list(string)
}

variable "vpc_client_security_group_ids" {
  description = "Security group IDs allowed to reach the MQTT broker on 1883 inside the VPC"
  type        = list(string)
}

variable "emqx_image" {
  description = "Full ECR image URI for the EMQX container"
  type        = string
}

variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
  default     = "gamezilla"
}
