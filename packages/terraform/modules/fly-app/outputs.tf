output "app_name" {
  value = fly_app.this.name
}

output "app_id" {
  value = fly_app.this.id
}

output "ipv4" {
  value = fly_ip.v4.address
}

output "ipv6" {
  value = fly_ip.v6.address
}

output "internal_url" {
  description = "Fly.io internal DNS (app-name.internal)"
  value       = "${fly_app.this.name}.internal"
}

output "public_url" {
  value = "https://${fly_app.this.name}.fly.dev"
}
