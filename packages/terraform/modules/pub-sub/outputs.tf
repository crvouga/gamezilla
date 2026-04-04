output "ecs_cluster_id" {
  description = "ECS cluster ID (shared with worker and req-res)"
  value       = aws_ecs_cluster.this.id
}

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = aws_ecs_cluster.this.name
}

output "internal_mqtt_url" {
  description = "VPC-internal MQTT URL (mqtt://emqx.app.local:1883)"
  value       = "mqtt://emqx.${aws_service_discovery_private_dns_namespace.this.name}:1883"
}

output "public_nlb_dns_name" {
  description = "Public NLB DNS name for MQTT 1883 and WebSocket 8083"
  value       = aws_lb.nlb.dns_name
}

output "broker_security_group_id" {
  description = "EMQX broker security group ID"
  value       = aws_security_group.broker.id
}
