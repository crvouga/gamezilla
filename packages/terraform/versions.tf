terraform {
  required_version = ">= 1.5"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.0"
    }
    planetscale = {
      source  = "planetscale/planetscale"
      version = "~> 1.0"
    }
  }
}
