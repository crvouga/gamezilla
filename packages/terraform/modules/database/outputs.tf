output "cluster_endpoint" {
  description = "Aurora writer endpoint hostname"
  value       = aws_rds_cluster.this.endpoint
}

output "cluster_port" {
  description = "Aurora cluster port"
  value       = aws_rds_cluster.this.port
}

output "secret_arn" {
  description = "Secrets Manager secret ARN for database credentials"
  value       = aws_secretsmanager_secret.db.arn
}

output "security_group_id" {
  description = "Database security group ID"
  value       = aws_security_group.db.id
}
