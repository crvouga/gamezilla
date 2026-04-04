variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for the DB subnet group"
  type        = list(string)
}

variable "allowed_security_group_ids" {
  description = "Security group IDs allowed to connect on port 5432"
  type        = list(string)
}

variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
  default     = "gamezilla"
}
