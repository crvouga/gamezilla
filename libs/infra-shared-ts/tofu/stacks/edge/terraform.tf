# Backend, state encryption and provider pins for the edge stack.
#
# State lives in an R2 bucket that a human created once (it cannot manage
# itself); one object per environment, so one environment's plan can never
# see or touch another's resources. Every state and plan file is encrypted.

terraform {
  required_version = "~> 1.12"

  required_providers {
    cloudflare = { source = "cloudflare/cloudflare", version = "~> 5.25" }
  }

  backend "s3" {
    bucket       = var.state.bucket
    key          = "edge/${var.env}.tfstate"
    region       = "auto"
    use_lockfile = true
    endpoints = {
      s3 = "https://${var.state.account_id}.r2.cloudflarestorage.com"
    }
    use_path_style              = true
    skip_credentials_validation = true
    skip_region_validation      = true
    skip_requesting_account_id  = true
    skip_metadata_api_check     = true
    skip_s3_checksum            = true
  }

  encryption {
    key_provider "pbkdf2" "state" {
      passphrase = var.state_passphrase
    }
    method "aes_gcm" "state" {
      keys = key_provider.pbkdf2.state
    }
    state {
      method   = method.aes_gcm.state
      enforced = true
    }
    plan {
      method   = method.aes_gcm.state
      enforced = true
    }
  }
}

# CLOUDFLARE_API_TOKEN arrives from `secrets-run` (see ../infra-server-ts/scripts/tofu.ts).
provider "cloudflare" {}
