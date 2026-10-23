# Everything an environment needs before any Worker code ships: object
# storage, the invalidation broker, traces, the database and the secrets
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
    EMQX_WSS_URL                  = module.pubsub.wss_url
    IOT_DATA_ENDPOINT             = module.pubsub.data_endpoint
    IOT_ACCESS_KEY_ID             = module.pubsub.publisher_access_key_id
    IOT_SECRET_ACCESS_KEY         = module.pubsub.publisher_secret_access_key
    IOT_REGION                    = module.pubsub.region
    OBSERVABILITY_COLLECTOR_URL   = module.observability.collector_url
    OBSERVABILITY_LOGS_URL        = module.observability.logs_url
    OBSERVABILITY_METRICS_URL     = module.observability.metrics_collector_url
    OBSERVABILITY_COLLECTOR_USER  = module.observability.collector_user
    OBSERVABILITY_COLLECTOR_TOKEN = module.observability.collector_token
    OBS_TEMPO_URL                 = module.observability.tempo_url
    OBS_TEMPO_USER                = module.observability.tempo_user
    OBS_TEMPO_TOKEN               = module.observability.tempo_token
    OBS_LOKI_URL                  = module.observability.loki_url
    OBS_LOKI_USER                 = module.observability.loki_user
    OBS_PROMETHEUS_URL            = module.observability.prometheus_url
    OBS_PROMETHEUS_USER           = module.observability.prometheus_user
    OBS_READONLY_DATABASE_URL     = module.database.obs_readonly_database_url
  }
}

# This environment's IoT Core data plane, on the broker hostname. The token
# secret is the same HMAC secret the API uses to mint client tokens.
module "pubsub" {
  source     = "../../modules/pubsub"
  project    = var.project
  suffix     = var.suffix
  region     = var.aws.region
  hostname   = var.hosts.broker
  zone_id    = data.cloudflare_zone.this.zone_id
  jwt_secret = module.secrets.generated["EMQX_JWT_SECRET"]
}

module "database" {
  source          = "../../modules/database"
  organization    = var.planetscale.organization
  region          = var.planetscale.region
  database_name   = "${var.project}-${var.suffix}-pg"
  production      = var.protection == "production"
  account_id      = var.cloudflare.account_id
  hyperdrive_name = module.names.hyperdrive
}
