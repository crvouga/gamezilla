# Durable reference data, shared by local, test, CI and every deployed environment.
# Nothing expires it and no environment teardown owns it.
resource "cloudflare_r2_bucket" "shared_data" {
  account_id = var.shared_data.account_id
  name       = var.shared_data.bucket

  lifecycle {
    prevent_destroy = true
  }
}

data "cloudflare_account_api_token_permission_groups_list" "shared_data" {
  for_each   = toset(["Workers R2 Storage Bucket Item Read", "Workers R2 Storage Bucket Item Write"])
  account_id = var.shared_data.account_id
  name       = each.key

  lifecycle {
    postcondition {
      condition     = length(self.result) == 1
      error_message = "Expected one R2 object permission group."
    }
  }
}

resource "cloudflare_account_token" "shared_data" {
  account_id = var.shared_data.account_id
  name       = "${var.project}-shared-data"
  policies = [{
    effect            = "allow"
    permission_groups = [for group in data.cloudflare_account_api_token_permission_groups_list.shared_data : { id = group.result[0].id }]
    resources = jsonencode({
      "com.cloudflare.edge.r2.bucket.${var.shared_data.account_id}_default_${cloudflare_r2_bucket.shared_data.name}" = "*"
    })
  }]
}

data "infisical_secrets" "shared_data" {
  workspace_id = var.infisical.project_id
  env_slug     = var.infisical.shared_env
  folder_path  = "/"
}

locals {
  shared_data_names  = jsondecode(file("${path.module}/../foundation/secrets.json")).shared_derived
  stored_shared_data = data.infisical_secrets.shared_data.secrets
  # An imported token cannot return its one-time value. Keep the credential
  # already distributed to every environment, only for the matching token ID.
  shared_data_secret = cloudflare_account_token.shared_data.value == null ? try(local.stored_shared_data["SHARED_DATA_SECRET_ACCESS_KEY"].value, "") : sha256(cloudflare_account_token.shared_data.value)
  shared_data_values = {
    SHARED_DATA_BUCKET            = cloudflare_r2_bucket.shared_data.name
    SHARED_DATA_ENDPOINT          = "https://${var.shared_data.account_id}.r2.cloudflarestorage.com"
    SHARED_DATA_REGION            = "auto"
    SHARED_DATA_ACCESS_KEY_ID     = cloudflare_account_token.shared_data.id
    SHARED_DATA_SECRET_ACCESS_KEY = local.shared_data_secret
  }
}

resource "terraform_data" "shared_data_version" {
  for_each         = toset(local.shared_data_names)
  triggers_replace = sha256(local.shared_data_values[each.key])
  input            = parseint("${formatdate("YYYYMMDDhhmmss", plantimestamp())}0000", 10)
  lifecycle {
    ignore_changes = [input]
  }
}

# Every environment already imports the shared secrets environment.
resource "infisical_secret" "shared_data" {
  for_each         = toset(local.shared_data_names)
  workspace_id     = var.infisical.project_id
  env_slug         = var.infisical.shared_env
  folder_path      = "/"
  name             = each.key
  value_wo         = local.shared_data_values[each.key]
  value_wo_version = terraform_data.shared_data_version[each.key].output

  lifecycle {
    precondition {
      condition = cloudflare_account_token.shared_data.value != null || (
        cloudflare_account_token.shared_data.id == try(local.stored_shared_data["SHARED_DATA_ACCESS_KEY_ID"].value, "") &&
        length(local.shared_data_secret) > 0
      )
      error_message = "An imported shared-data token requires its matching saved S3 credential."
    }
  }
}
