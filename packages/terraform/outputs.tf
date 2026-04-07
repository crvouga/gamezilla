output "web_app_url" {
  description = "Cloudflare Pages web app URL"
  value       = module.cloudflare_pages.url
}

output "pages_project_name" {
  description = "Cloudflare Pages project name (for wrangler deploy)"
  value       = module.cloudflare_pages.project_name
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
