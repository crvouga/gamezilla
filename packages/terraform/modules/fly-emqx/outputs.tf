output "app_name" {
  value = module.app.app_name
}

output "internal_mqtt_url" {
  description = "Fly private network MQTT URL"
  value       = "mqtt://${module.app.internal_url}:1883"
}

output "public_url" {
  value = module.app.public_url
}

output "volume_name" {
  value = fly_volume.data.name
}

output "ipv4" {
  value = module.app.ipv4
}

output "ipv6" {
  value = module.app.ipv6
}
