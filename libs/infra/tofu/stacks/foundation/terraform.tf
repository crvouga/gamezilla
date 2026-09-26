# Backend, state encryption and provider pins for the foundation stack.
#
# State lives in an R2 bucket that a human created once (it cannot manage
# itself); one object per environment, so one environment's plan can never
# see or touch another's resources. Every state and plan file is encrypted.

terraform {
  required_version = "~> 1.12"

  required_providers {
    cloudflare = { source = "cloudflare/cloudflare", version = "~> 5.25" }
    railway    = { source = "terraform-community-providers/railway", version = "~> 0.6" }
    grafana    = { source = "grafana/grafana", version = "~> 4.46" }
    neon       = { source = "kislerdm/neon", version = "~> 0.18" }
    infisical  = { source = "infisical/infisical", version = "~> 0.19" }
    random     = { source = "hashicorp/random", version = "~> 3.9" }
    postgresql = { source = "cyrilgdn/postgresql", version = "~> 1.25" }
  }

  backend "s3" {
    bucket       = var.state.bucket
    key          = "foundation/${var.env}.tfstate"
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

# Credentials arrive as environment variables injected by `secrets-run`:
# CLOUDFLARE_API_TOKEN, RAILWAY_TOKEN, NEON_API_KEY,
# GRAFANA_CLOUD_ACCESS_POLICY_TOKEN (see scripts/tofu.ts).
provider "cloudflare" {}

provider "railway" {}

provider "grafana" {}

provider "neon" {}

provider "infisical" {
  auth = {
    token = var.infisical_token
  }
}

provider "random" {}

# The environment's own database, on its direct host (DDL does not go
# through the pooler).
provider "postgresql" {
  host            = module.database.connection.host
  port            = 5432
  database        = module.database.connection.database
  username        = module.database.connection.user
  password        = module.database.connection.password
  sslmode         = "require"
  superuser       = false
  connect_timeout = 15
}
