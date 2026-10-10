# Backend, state encryption and provider pins for the foundation stack.
#
# State lives in an R2 bucket that a human created once (it cannot manage
# itself); one object per environment, so one environment's plan can never
# see or touch another's resources. Every state and plan file is encrypted.

terraform {
  required_version = "~> 1.12"

  required_providers {
    cloudflare  = { source = "cloudflare/cloudflare", version = "~> 5.25" }
    grafana     = { source = "grafana/grafana", version = "~> 4.46" }
    planetscale = { source = "planetscale/planetscale", version = "~> 1.11" }
    aws         = { source = "hashicorp/aws", version = "~> 5.100" }
    archive     = { source = "hashicorp/archive", version = "~> 2.7" }
    infisical   = { source = "infisical/infisical", version = "~> 0.19" }
    random      = { source = "hashicorp/random", version = "~> 3.9" }
    railway     = { source = "jamesprnich/railway", version = "= 0.11.5" }
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
# CLOUDFLARE_API_TOKEN, PLANETSCALE_SERVICE_TOKEN_ID, PLANETSCALE_SERVICE_TOKEN,
# GRAFANA_CLOUD_ACCESS_POLICY_TOKEN. The AWS provider does not read
# AWS_ACCESS_KEY_ID: that name is the R2 state credential in this process
# (see ../infra-server/scripts/tofu.ts). GitHub Actions assumes AWS_ROLE_ARN; the wrapper
# passes that session as TF_VAR_aws_*. A laptop uses the AWS CLI the same way.
provider "cloudflare" {}

provider "grafana" {}

provider "planetscale" {}

provider "aws" {
  region     = var.aws.region
  access_key = var.aws_access_key_id
  secret_key = var.aws_secret_access_key
  token      = var.aws_session_token
}

provider "infisical" {
  auth = {
    token = var.infisical_token
  }
}

provider "random" {}

# One separate project per application environment; there are no shared Railway
# environments into which an unscoped service could leak.
provider "railway" { strict_env_scoping = false }
