provider "grafana" {
  alias                     = "stack_management"
  cloud_access_policy_token = module.observability.management_token
}

locals {
  views_account = "${var.project}-${var.env}-observability-views"
}

# Grafana 13 gives a folder created through the API no permissions beyond the
# Admin role's, so an Editor account can create the views folder and then
# cannot read it back (403 folders:read, Release 42779170490), nor see a folder
# Grafana kept while archived. The account that manages the views is an Admin.
#
# The provider waits ten minutes on the instance health URL before it creates
# a service account. An archived instance answers that URL with 404, so the
# account, its token, and the dashboards exist only while the instance is active.
resource "grafana_cloud_stack_service_account" "views" {
  lifecycle {
    destroy = false
  }

  count = module.observability.grafana_instance_ready ? 1 : 0

  provider   = grafana.stack_management
  stack_slug = var.grafana.stack_slug
  name       = local.views_account
  role       = "Admin"
}

resource "grafana_cloud_stack_service_account_token" "views" {
  # Tokens cannot be imported, and the account kept while archived still
  # holds the old one: each new token gets a name of its own, kept as created.
  lifecycle {
    destroy        = false
    ignore_changes = [name]
  }

  count = module.observability.grafana_instance_ready ? 1 : 0

  provider           = grafana.stack_management
  stack_slug         = var.grafana.stack_slug
  name               = "${local.views_account}-${formatdate("YYYYMMDDhhmmss", plantimestamp())}"
  service_account_id = grafana_cloud_stack_service_account.views[0].id
}

# The Editor account the views used before. A role change forces a new
# account (bootstrap's alerting provisioner did the same). Like every retired
# address it is forgotten, never deleted: deleting it would wait on the
# instance health URL and fail whenever the instance is archived.
removed {
  from = grafana_cloud_stack_service_account_token.observability
  lifecycle {
    destroy = false
  }
}

removed {
  from = grafana_cloud_stack_service_account.observability
  lifecycle {
    destroy = false
  }
}

provider "grafana" {
  alias = "views"
  url   = module.observability.grafana_url
  auth  = module.observability.grafana_instance_ready ? grafana_cloud_stack_service_account_token.views[0].key : "instance-not-active"
}

module "observability_views" {
  count       = module.observability.grafana_instance_ready ? 1 : 0
  source      = "../../modules/observability-views"
  environment = var.env
  namespace   = var.project
  grafana_url = module.observability.grafana_url
  providers = {
    grafana = grafana.views
  }
}

# Restoring an archived instance (README.md, "When Grafana archives its
# instance"). While archived, the account and views were forgotten from state
# but kept in Grafana, which refuses a second account of the same name (400)
# and a second folder of the same uid. The release wrapper adopts what was
# kept in two passes: "account" imports the account (a token follows), then
# "views" uses that token to import the views that still exist. The views pass
# imports only the addresses in var.grafana_adopt: the ones the release's
# state-only plan would create, since importing an address already in state
# is an error. Outside a restore none of these lookups run.
locals {
  restore_account = module.observability.grafana_instance_ready && var.grafana_restore == "account"
  restore_views   = module.observability.grafana_instance_ready && var.grafana_restore == "views"
  view_keys       = local.restore_views ? module.observability_views[0].adoption_keys : null
}

data "http" "kept_account" {
  count = local.restore_account ? 1 : 0
  url   = "https://grafana.com/api/instances/${var.grafana.stack_slug}/api/serviceaccounts/search?perpage=100&query=${urlencode(local.views_account)}"
  request_headers = {
    Accept        = "application/json"
    Authorization = "Bearer ${module.observability.management_token}"
  }
  lifecycle {
    postcondition {
      condition     = self.status_code == 200
      error_message = "Grafana Cloud service account search answered ${self.status_code}."
    }
  }
}

import {
  for_each = toset(local.restore_account ? [
    for account in jsondecode(data.http.kept_account[0].response_body).serviceAccounts :
    tostring(account.id) if account.name == local.views_account
  ] : [])
  to = grafana_cloud_stack_service_account.views[0]
  id = "${var.grafana.stack_slug}:${each.value}"
}

data "grafana_folders" "kept" {
  count    = local.restore_views ? 1 : 0
  provider = grafana.views
}

data "grafana_dashboards" "kept" {
  count       = local.restore_views ? 1 : 0
  provider    = grafana.views
  folder_uids = [local.view_keys.folder_uid]
  limit       = 5000
}

data "http" "kept_rules" {
  count = local.restore_views ? 1 : 0
  url   = "${module.observability.grafana_url}/api/v1/provisioning/alert-rules"
  request_headers = {
    Accept        = "application/json"
    Authorization = "Bearer ${grafana_cloud_stack_service_account_token.views[0].key}"
  }
  lifecycle {
    postcondition {
      condition     = self.status_code == 200
      error_message = "Grafana alert rule listing answered ${self.status_code}."
    }
  }
}

data "grafana_slos" "kept" {
  count    = local.restore_views ? 1 : 0
  provider = grafana.views
}

locals {
  kept_folder = local.restore_views ? contains([
    for folder in data.grafana_folders.kept[0].folders : folder.uid
  ], local.view_keys.folder_uid) : false
  kept_dashboards = local.restore_views ? toset([
    for dashboard in data.grafana_dashboards.kept[0].dashboards : dashboard.uid
  ]) : toset([])
  kept_rule_groups = local.restore_views ? toset([
    for rule in jsondecode(data.http.kept_rules[0].response_body) :
    rule.ruleGroup if rule.folderUID == local.view_keys.folder_uid
  ]) : toset([])
  kept_slos = local.restore_views ? {
    for slo in data.grafana_slos.kept[0].slos : slo.name => slo.uuid
  } : {}
}

import {
  for_each = local.kept_folder && contains(var.grafana_adopt, "module.observability_views[0].grafana_folder.this") ? toset([local.view_keys.folder_uid]) : toset([])
  to       = module.observability_views[0].grafana_folder.this
  id       = each.value
}

import {
  for_each = { for file, uid in local.restore_views ? local.view_keys.dashboard_uids : {} : file => uid if contains(local.kept_dashboards, uid) && contains(var.grafana_adopt, format("module.observability_views[0].grafana_dashboard.this[%q]", file)) }
  to       = module.observability_views[0].grafana_dashboard.this[each.key]
  id       = each.value
}

import {
  for_each = { for key, name in local.restore_views ? local.view_keys.rule_group_names : {} : key => name if contains(local.kept_rule_groups, name) && contains(var.grafana_adopt, format("module.observability_views[0].grafana_rule_group.groups[%q]", key)) }
  to       = module.observability_views[0].grafana_rule_group.groups[each.key]
  id       = "${local.view_keys.folder_uid}:${each.value}"
}

import {
  for_each = { for key, name in local.restore_views ? local.view_keys.slo_names : {} : key => local.kept_slos[name] if contains(keys(local.kept_slos), name) && contains(var.grafana_adopt, format("module.observability_views[0].grafana_slo.objectives[%q]", key)) }
  to       = module.observability_views[0].grafana_slo.objectives[each.key]
  id       = each.value
}
