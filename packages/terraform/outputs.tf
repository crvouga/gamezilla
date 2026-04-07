output "web_app_url" {
  description = "Cloudflare Pages web app URL"
  value       = module.cloudflare_pages.url
}

output "pages_project_name" {
  description = "Cloudflare Pages project name (for wrangler deploy)"
  value       = module.cloudflare_pages.project_name
}

output "pages_subdomain" {
  description = "Cloudflare Pages subdomain"
  value       = module.cloudflare_pages.subdomain
}

output "cloudflare_nameservers" {
  description = "Set these nameservers in Squarespace Domains (one-time)"
  value       = join(", ", cloudflare_zone.main.name_servers)
}

output "api_url" {
  description = "API public URL (Workers custom domain)"
  value       = "https://api.gamezilla.app"
}

output "database_url" {
  description = "PlanetScale Postgres connection string for the Worker"
  sensitive   = true
  value       = "postgres://${planetscale_postgres_branch_role.app.username}:${planetscale_postgres_branch_role.app.password}@${planetscale_postgres_branch_role.app.access_host_url}/${planetscale_postgres_branch_role.app.database_name}"
}
