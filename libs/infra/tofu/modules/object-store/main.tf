# Object storage: one R2 bucket and an S3 credential scoped to it.
#
# STATEFUL: the bucket holds user data. It is never destroyed or replaced —
# `prevent_destroy` here, and `policy/stateful.rego` refuses any plan that
# deletes a `cloudflare_r2_bucket` even if this block is removed.

terraform {
  required_providers {
    cloudflare = { source = "cloudflare/cloudflare" }
  }
}

variable "account_id" {
  type = string
}

variable "bucket_name" {
  type = string
}

variable "token_name" {
  type = string
}

resource "cloudflare_r2_bucket" "objects" {
  account_id = var.account_id
  name       = var.bucket_name

  lifecycle {
    prevent_destroy = true
  }
}

data "cloudflare_account_api_token_permission_groups_list" "bucket_item_write" {
  account_id = var.account_id
  name       = "Workers R2 Storage Bucket Item Write"

  lifecycle {
    postcondition {
      condition     = length(self.result) == 1
      error_message = "Expected exactly one Cloudflare permission group named 'Workers R2 Storage Bucket Item Write'."
    }
  }
}

# Stateless: a credential. Replacing it only means a new value in the
# secrets store and a Worker redeploy.
resource "cloudflare_account_token" "s3" {
  account_id = var.account_id
  name       = var.token_name

  policies = [{
    effect            = "allow"
    permission_groups = [{ id = data.cloudflare_account_api_token_permission_groups_list.bucket_item_write.result[0].id }]
    resources = jsonencode({
      "com.cloudflare.edge.r2.bucket.${var.account_id}_default_${cloudflare_r2_bucket.objects.name}" = "*"
    })
  }]
}

output "bucket" {
  value = cloudflare_r2_bucket.objects.name
}

output "endpoint" {
  value = "https://${var.account_id}.r2.cloudflarestorage.com"
}

output "region" {
  value = "auto"
}

output "access_key_id" {
  value = cloudflare_account_token.s3.id
}

# R2's S3 secret key is the SHA-256 of the API token value.
output "secret_access_key" {
  value     = sha256(cloudflare_account_token.s3.value)
  sensitive = true
}
