# Main forgot these resources without deleting them (Deploy 38727630988).
# Adopt them at their original addresses; clear global_imports.shared_data
# after the first apply. Fresh installations leave that flag false.
import {
  for_each = var.global_imports.shared_data ? toset([var.shared_data.bucket]) : toset([])
  to       = cloudflare_r2_bucket.shared_data
  id       = "${var.shared_data.account_id}/${each.value}/default"
}

import {
  for_each = var.global_imports.shared_data ? toset(["existing"]) : toset([])
  to       = cloudflare_account_token.shared_data
  id       = "${var.shared_data.account_id}/${nonsensitive(local.stored_shared_data["SHARED_DATA_ACCESS_KEY_ID"].value)}"
}

import {
  for_each = var.global_imports.shared_data ? toset(local.shared_data_names) : toset([])
  to       = infisical_secret.shared_data[each.value]
  id       = "write-only:${var.infisical.project_id}:${var.infisical.shared_env}:/:${each.value}"
}
