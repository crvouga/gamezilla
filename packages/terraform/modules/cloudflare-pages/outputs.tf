output "project_name" {
  value = cloudflare_pages_project.web.name
}

output "url" {
  description = "Default Cloudflare Pages URL"
  value       = "https://${cloudflare_pages_project.web.subdomain}"
}

output "subdomain" {
  value = cloudflare_pages_project.web.subdomain
}
