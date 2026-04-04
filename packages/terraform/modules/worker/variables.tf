variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for Fargate tasks"
  type        = list(string)
}

variable "ecs_cluster_id" {
  description = "ECS cluster ID"
  type        = string
}

variable "app_image" {
  description = "Full ECR image URI for the application container"
  type        = string
}

variable "database_host" {
  description = "Aurora writer endpoint hostname"
  type        = string
}

variable "database_secret_arn" {
  description = "Secrets Manager secret ARN for database credentials"
  type        = string
}

variable "pubsub_url" {
  description = "VPC-internal MQTT URL"
  type        = string
}

variable "task_security_group_id" {
  description = "Security group ID for worker tasks"
  type        = string
}

variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
  default     = "gamezilla"
}
