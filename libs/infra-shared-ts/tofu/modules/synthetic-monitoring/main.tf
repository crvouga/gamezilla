# Grafana Synthetic Monitoring's checks of every environment, from outside.
# They feed specs/runtime/always-reachable.openslo.yaml (reachable, opens
# quickly, never hangs) and specs/spaces/spaces-and-live-updates.openslo.yaml
# (live updates can connect). The checks are the ones the indicator catalog
# names (libs/observability-shared-ts/src/synthetic-monitoring.ts
# `PROBE_CHECKS`), and each runs under the job `<check>-<environment>`: a
# check's own labels reach every metric only on migrated tenants, the job
# always does.
#
# | check     | target                       | passes when                      |
# | --------- | ---------------------------- | -------------------------------- |
# | app-shell | https://<web>/               | 200 and the app's own page       |
# | api-ready | https://<api>/api/health/ready | 200 "pass": the API and its database answer |
# | broker    | https://<broker>/mqtt        | the 426 the broker gives a browser about to upgrade to live updates |
#
# The free plan allows 100k API runs a month for the stack (a run is a minute
# of check time per probe). Production's app-shell and api-ready every minute
# are 2 x 44.6k in a 31-day month; its broker every ten minutes 4.5k; every
# other environment's three checks hourly 2.2k: about 96k.
#
# Stateless: a check's results stay in the metrics backend if it is replaced.

terraform {
  required_providers {
    grafana = { source = "grafana/grafana" }
  }
}

variable "environments" {
  description = "Each environment's env file (envs/<env>.tfvars.json), by name."
  type = map(object({
    hosts                = object({ web = string, api = string, broker = string })
    synthetic_monitoring = optional(object({ every_seconds = number }), { every_seconds = 3600 })
  }))
}

variable "probe" {
  type        = string
  description = "The public probe the checks run from."
}

variable "brand_name" {
  type        = string
  description = "The name people see: the app shell's own page carries it as its title."
}

data "grafana_synthetic_monitoring_probes" "public" {}

locals {
  # The broker is checked every ten minutes at most: it is the most an
  # environment checked every minute can afford alongside its other checks.
  broker_every_seconds = 600

  checks = merge([
    for env, file in var.environments : {
      "${env}-app-shell" = {
        env    = env
        job    = "app-shell-${env}"
        target = "https://${file.hosts.web}/"
        every  = file.synthetic_monitoring.every_seconds
        status = [200]
        # The app's own page, not an error page or a parked domain.
        body = "<title>${var.brand_name}</title>"
        # A fresh query string each run, so a cached copy at the edge cannot
        # hide a broken deployment behind it.
        bust = "sm-run"
      }
      "${env}-api-ready" = {
        env    = env
        job    = "api-ready-${env}"
        target = "https://${file.hosts.api}/api/health/ready"
        every  = file.synthetic_monitoring.every_seconds
        status = [200]
        # Readiness reads the database (libs/app-root-server-ts/src/health-route.ts).
        body = "\"status\":\"pass\""
        bust = ""
      }
      "${env}-broker" = {
        env    = env
        job    = "broker-${env}"
        target = "https://${file.hosts.broker}/mqtt"
        every  = max(file.synthetic_monitoring.every_seconds, local.broker_every_seconds)
        # The broker answers a plain request with 426, the answer a browser
        # gets just before it upgrades to live updates: DNS, TLS and the
        # broker itself are up.
        status = [426]
        body   = "Websockets protocol"
        bust   = ""
      }
    }
  ]...)
}

resource "grafana_synthetic_monitoring_check" "http" {
  for_each = local.checks

  job       = each.value.job
  target    = each.value.target
  enabled   = true
  probes    = [data.grafana_synthetic_monitoring_probes.public.probes[var.probe]]
  frequency = each.value.every * 1000
  # Long enough to measure a slow answer (the latency objectives' 2.5 s),
  # short enough to fail a hung one.
  timeout = 10000
  labels = {
    deployment_environment_name = each.value.env
  }

  settings {
    http {
      method                          = "GET"
      ip_version                      = "V4"
      valid_status_codes              = each.value.status
      fail_if_body_not_matches_regexp = [each.value.body]
      fail_if_not_ssl                 = true
      cache_busting_query_param_name  = each.value.bust == "" ? null : each.value.bust
    }
  }
}
