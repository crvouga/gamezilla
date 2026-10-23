# The bootstrap stack: what every other stack (and CI itself) stands on —
# the state bucket and its credential, the secrets environments, the CI
# identity and the repository settings. Global, not per environment.
#
# Its state lives in the bucket it creates. The very first apply cannot use a
# bucket that does not exist yet, so `../infra-server-ts/scripts/tofu.ts bootstrap` runs that
# one apply against a local backend and then migrates the state into the
# bucket (`tofu init -migrate-state`). Every later run is an ordinary S3 run.

terraform {
  required_version = "~> 1.12"

  required_providers {
    cloudflare = { source = "cloudflare/cloudflare", version = "~> 5.25" }
    infisical  = { source = "infisical/infisical", version = "~> 0.19" }
    github     = { source = "integrations/github", version = "~> 6.0" }
    grafana    = { source = "grafana/grafana", version = "~> 4.46" }
    aws        = { source = "hashicorp/aws", version = "~> 5.100" }
  }

  backend "s3" {
    bucket       = var.state.bucket
    key          = "bootstrap/global.tfstate"
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

# CLOUDFLARE_API_TOKEN, GRAFANA_CLOUD_ACCESS_POLICY_TOKEN and GITHUB_TOKEN (a
# repository admin token) arrive from
# `secrets-run`; see ../infra-server-ts/scripts/tofu.ts.
provider "cloudflare" {}

provider "grafana" {}

provider "github" {
  owner = var.github.owner
}

provider "infisical" {
  auth = {
    token = var.infisical_token
  }
}

# Same split as the foundation stack: AWS_ACCESS_KEY_ID in this process is
# the R2 state key. The person's AWS login (or a later OIDC session) arrives
# as TF_VAR_aws_*.
provider "aws" {
  region     = var.aws.region
  access_key = var.aws_access_key_id
  secret_key = var.aws_secret_access_key
  token      = var.aws_session_token
}
