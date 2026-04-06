output "web_app_url" {
  description = "Cloudflare Pages web app URL"
  value       = module.cloudflare_pages.url
}

output "pages_project_name" {
  description = "Cloudflare Pages project name (for wrangler deploy)"
  value       = module.cloudflare_pages.project_name
}

output "req_res_url" {
  description = "Req-res API public URL"
  value       = var.custom_domain ? "https://api.gamezilla.app" : module.fly_req_res.public_url
}

output "req_res_app_name" {
  description = "Fly.io app name for req-res"
  value       = module.fly_req_res.app_name
}

output "worker_app_name" {
  description = "Fly.io app name for worker"
  value       = module.fly_worker.app_name
}

output "emqx_app_name" {
  description = "Fly.io app name for EMQX"
  value       = module.fly_emqx.app_name
}

output "pubsub_internal_mqtt_url" {
  description = "Fly internal network MQTT URL for req-res and worker"
  value       = module.fly_emqx.internal_mqtt_url
}

output "pubsub_public_url" {
  description = "Public EMQX URL"
  value       = var.custom_domain ? "mqtt://mqtt.gamezilla.app:1883" : module.fly_emqx.public_url
}
