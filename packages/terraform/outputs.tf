output "req_res_url" {
  description = "Patch DB req-res base URL (HTTPS via CloudFront)"
  value       = module.req_res.url
}

output "database_cluster_endpoint" {
  description = "Aurora PostgreSQL writer hostname"
  value       = module.database.cluster_endpoint
}

output "pubsub_internal_mqtt_url" {
  description = "VPC-internal MQTT URL for req-res / worker"
  value       = module.pub_sub.internal_mqtt_url
}

output "pubsub_public_nlb_dns" {
  description = "Public NLB DNS: mqtt://host:1883 and tcp :8083 for WebSocket"
  value       = module.pub_sub.public_nlb_dns_name
}

output "web_app_bucket_name" {
  value = module.web_app.bucket_name
}

output "web_distribution_id" {
  value = module.web_app.distribution_id
}

output "web_app_url" {
  value = module.web_app.url
}

output "route53_nameservers" {
  description = "Set these nameservers at your domain registrar for gamezilla.app"
  value       = join(", ", module.web_app.hosted_zone_nameservers)
}
