resource "cloudflare_pages_project" "web" {
  account_id        = var.cloudflare_account_id
  name              = var.project_name
  production_branch = "main"

  deployment_configs = {
    production = {
      compatibility_date = "2024-01-01"
    }
    preview = {
      compatibility_date = "2024-01-01"
    }
  }
}

resource "cloudflare_pages_domain" "apex" {
  count        = var.custom_domain ? 1 : 0
  account_id   = var.cloudflare_account_id
  project_name = cloudflare_pages_project.web.name
  name         = var.domain
}

resource "cloudflare_pages_domain" "www" {
  count        = var.custom_domain ? 1 : 0
  account_id   = var.cloudflare_account_id
  project_name = cloudflare_pages_project.web.name
  name         = "www.${var.domain}"
}


resource "cloudflare_dns_record" "pages_apex" {
  count   = var.custom_domain ? 1 : 0
  zone_id = var.cloudflare_zone_id
  name    = "@"
  content = cloudflare_pages_project.web.subdomain
  type    = "CNAME"
  proxied = true
  ttl     = 1
}

resource "cloudflare_dns_record" "pages_www" {
  count   = var.custom_domain ? 1 : 0
  zone_id = var.cloudflare_zone_id
  name    = "www"
  content = cloudflare_pages_project.web.subdomain
  type    = "CNAME"
  proxied = true
  ttl     = 1
}

resource "cloudflare_ruleset" "redirect_apex_to_www" {
  count   = var.custom_domain ? 1 : 0
  zone_id = var.cloudflare_zone_id
  name    = "Redirect apex to www"
  kind    = "zone"
  phase   = "http_request_dynamic_redirect"

  rules = [{
    action = "redirect"
    action_parameters = {
      from_value = {
        status_code           = 301
        target_url            = {
          expression = "concat(\"https://www.${var.domain}\", http.request.uri.path)"
        }
        preserve_query_string = true
      }
    }
    expression  = "(http.host eq \"${var.domain}\")"
    description = "Redirect apex to www"
    enabled     = true
  }]
}
