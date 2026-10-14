# The fleet stack: what every environment needs before its first deploy can
# even read its secrets — its secrets environment, and the import that gives
# it the account-wide credentials held once in the shared environment — plus
# the hostname of the OAuth callback relay they all sign in through, and
# the shared Railway project with an isolated Railway environment per env file.
# Global (one state object), driven by the env files: a new
# `envs/<env>.tfvars.json` is picked up here with no edit. The Deploy
# workflow applies it before any environment deploys.

terraform {
  required_version = "~> 1.12"

  required_providers {
    infisical  = { source = "infisical/infisical", version = "~> 0.19" }
    cloudflare = { source = "cloudflare/cloudflare", version = "~> 5.25" }
    railway    = { source = "jamesprnich/railway", version = "= 0.11.5" }
  }

  backend "s3" {
    bucket       = var.state.bucket
    key          = "fleet/global.tfstate"
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

# CLOUDFLARE_API_TOKEN arrives from `secrets-run` (see ../infra-server/scripts/tofu.ts).
provider "cloudflare" {}

provider "railway" { strict_env_scoping = true }

provider "infisical" {
  auth = {
    token = var.infisical_token
  }
}
