# The files CI jobs hand each other and the nightly profile's reports, instead
# of GitHub Actions artifacts, whose account quota stops every Verify run when
# it fills. Disposable: every object expires after `retention_days`, and losing
# the bucket loses only reports of past runs.
resource "cloudflare_r2_bucket" "ci_artifacts" {
  account_id = var.ci_artifacts.account_id
  name       = var.ci_artifacts.bucket
}

resource "cloudflare_r2_bucket_lifecycle" "ci_artifacts" {
  account_id  = var.ci_artifacts.account_id
  bucket_name = cloudflare_r2_bucket.ci_artifacts.name

  rules = [{
    id      = "expire-ci-artifacts"
    enabled = true
    conditions = {
      prefix = ""
    }
    delete_objects_transition = {
      condition = {
        type    = "Age"
        max_age = var.ci_artifacts.retention_days * 86400
      }
    }
  }]
}

data "cloudflare_account_api_token_permission_groups_list" "ci_artifacts" {
  for_each   = toset(["Workers R2 Storage Bucket Item Read", "Workers R2 Storage Bucket Item Write"])
  account_id = var.ci_artifacts.account_id
  name       = each.key

  lifecycle {
    postcondition {
      condition     = length(self.result) == 1
      error_message = "Expected one R2 object permission group."
    }
  }
}

# Stateless: a credential. Replacing it only rewrites the secrets below.
resource "cloudflare_account_token" "ci_artifacts" {
  account_id = var.ci_artifacts.account_id
  name       = "${var.project}-ci-artifacts"
  policies = [{
    effect            = "allow"
    permission_groups = [for group in data.cloudflare_account_api_token_permission_groups_list.ci_artifacts : { id = group.result[0].id }]
    resources = jsonencode({
      "com.cloudflare.edge.r2.bucket.${var.ci_artifacts.account_id}_default_${cloudflare_r2_bucket.ci_artifacts.name}" = "*"
    })
  }]
}

locals {
  ci_artifacts_names = jsondecode(file("${path.module}/../foundation/secrets.json")).ci_derived
  ci_artifacts_values = {
    CI_ARTIFACTS_BUCKET   = cloudflare_r2_bucket.ci_artifacts.name
    CI_ARTIFACTS_ENDPOINT = "https://${var.ci_artifacts.account_id}.r2.cloudflarestorage.com"
    CI_ARTIFACTS_REGION   = "auto"
    # R2's S3 credential: the token ID, and the SHA-256 of the token value.
    CI_ARTIFACTS_ACCESS_KEY_ID     = cloudflare_account_token.ci_artifacts.id
    CI_ARTIFACTS_SECRET_ACCESS_KEY = sha256(cloudflare_account_token.ci_artifacts.value)
  }
}

resource "terraform_data" "ci_artifacts_version" {
  for_each         = toset(local.ci_artifacts_names)
  triggers_replace = sha256(local.ci_artifacts_values[each.key])
  input            = parseint("${formatdate("YYYYMMDDhhmmss", plantimestamp())}0000", 10)
  lifecycle {
    ignore_changes = [input]
  }
}

# Every environment imports the shared secrets environment, so every CI job
# that authenticates to either one reads these.
resource "infisical_secret" "ci_artifacts" {
  for_each         = toset(local.ci_artifacts_names)
  workspace_id     = var.infisical.project_id
  env_slug         = var.infisical.shared_env
  folder_path      = "/"
  name             = each.key
  value_wo         = local.ci_artifacts_values[each.key]
  value_wo_version = terraform_data.ci_artifacts_version[each.key].output
}
