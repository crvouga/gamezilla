# Everything an environment needs before any Worker code ships: object
# storage, the MQTT broker, traces, the database assertion and the secrets
# the Workers read. Runs first in the deploy chain (`@libs/infra#apply:foundation`).

locals {
  secret_names = jsondecode(file("${path.module}/secrets.json"))
}

module "names" {
  source  = "../../modules/naming"
  project = var.project
  suffix  = var.suffix
}

data "cloudflare_zone" "this" {
  filter = {
    name    = var.cloudflare.zone_name
    account = { id = var.cloudflare.account_id }
  }
}

module "object_store" {
  source      = "../../modules/object-store"
  account_id  = var.cloudflare.account_id
  bucket_name = module.names.bucket
  token_name  = module.names.s3_token
}

module "observability" {
  source            = "../../modules/observability"
  stack_slug        = var.grafana.stack_slug
  region            = var.grafana.region
  write_policy_name = module.names.traces_write_policy
  read_policy_name  = module.names.traces_read_policy
}

module "secrets" {
  source        = "../../modules/secrets"
  workspace_id  = var.infisical.project_id
  env_slug      = var.env
  human         = local.secret_names.human
  generated     = local.secret_names.generated
  regenerate    = var.secrets.regenerate
  placeholders  = local.secret_names.placeholders
  derived_names = local.secret_names.derived
  derived = {
    DATABASE_URL                  = module.database.database_url
    HYPERDRIVE_ID                 = module.database.hyperdrive_id
    API_URL                       = "https://${var.hosts.api}"
    VITE_API_URL                  = "https://${var.hosts.api}"
    S3_BUCKET                     = module.object_store.bucket
    S3_ENDPOINT                   = module.object_store.endpoint
    S3_REGION                     = module.object_store.region
    S3_ACCESS_KEY_ID              = module.object_store.access_key_id
    S3_SECRET_ACCESS_KEY          = module.object_store.secret_access_key
    EMQX_API_URL                  = module.pubsub.api_url
    EMQX_WSS_URL                  = module.pubsub.wss_url
    OBSERVABILITY_COLLECTOR_URL   = module.observability.collector_url
    OBSERVABILITY_COLLECTOR_USER  = module.observability.collector_user
    OBSERVABILITY_COLLECTOR_TOKEN = module.observability.collector_token
    OBS_TEMPO_URL                 = module.observability.tempo_url
    OBS_TEMPO_USER                = module.observability.tempo_user
    OBS_TEMPO_TOKEN               = module.observability.tempo_token
  }
}

# This environment's Railway environment of the one broker project (the
# fleet stack owns the project and the service); named after the suffix.
# Production's is the project's default `production` environment; every other
# environment is a duplicate of it (modules/pubsub explains why).
module "pubsub" {
  source           = "../../modules/pubsub"
  project_id       = var.railway.project_id
  service_id       = var.railway.service_id
  environment_name = var.suffix
  clone_from       = var.protection == "production" ? null : "production"
  railway_token    = var.railway_token
  hostname         = var.hosts.broker
  zone_id          = data.cloudflare_zone.this.zone_id
  zone_name        = var.cloudflare.zone_name
  credentials = {
    api_key            = module.secrets.generated["EMQX_API_KEY"]
    api_secret         = module.secrets.generated["EMQX_API_SECRET"]
    jwt_secret         = module.secrets.generated["EMQX_JWT_SECRET"]
    dashboard_password = module.secrets.generated["EMQX_DASHBOARD_PASSWORD"]
  }
}

module "database" {
  source          = "../../modules/database"
  neon_project_id = var.neon_project.project_id
  root_branch_id  = var.neon_project.root_branch_id
  production      = var.protection == "production"
  branch_name     = var.suffix
  account_id      = var.cloudflare.account_id
  hyperdrive_name = module.names.hyperdrive
}
