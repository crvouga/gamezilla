# One environment's S3 credentials for the shared spec reports bucket (owned
# by the fleet stack): a read-only one the API Worker serves `/api/reports`
# with, and a write one the Check workflow publishes with. Scoped to that one
# bucket. Stateless: replacing a token only means a new value in the secrets
# store and a Worker redeploy.

terraform {
  required_providers {
    cloudflare = { source = "cloudflare/cloudflare" }
  }
}

variable "account_id" {
  type = string
}

variable "bucket_name" {
  type        = string
  description = "The shared reports bucket (global.tfvars.json `reports.bucket`)."
}

variable "read_token_name" {
  type = string
}

variable "write_token_name" {
  type = string
}

data "cloudflare_account_api_token_permission_groups_list" "bucket_item_read" {
  account_id = var.account_id
  name       = "Workers R2 Storage Bucket Item Read"

  lifecycle {
    postcondition {
      condition     = length(self.result) == 1
      error_message = "Expected exactly one Cloudflare permission group named 'Workers R2 Storage Bucket Item Read'."
    }
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

locals {
  bucket_resource = jsonencode({
    "com.cloudflare.edge.r2.bucket.${var.account_id}_default_${var.bucket_name}" = "*"
  })
}

resource "cloudflare_account_token" "read" {
  account_id = var.account_id
  name       = var.read_token_name

  policies = [{
    effect            = "allow"
    permission_groups = [{ id = data.cloudflare_account_api_token_permission_groups_list.bucket_item_read.result[0].id }]
    resources         = local.bucket_resource
  }]
}

resource "cloudflare_account_token" "write" {
  account_id = var.account_id
  name       = var.write_token_name

  policies = [{
    effect            = "allow"
    permission_groups = [{ id = data.cloudflare_account_api_token_permission_groups_list.bucket_item_write.result[0].id }]
    resources         = local.bucket_resource
  }]
}

output "bucket" {
  value = var.bucket_name
}

output "endpoint" {
  value = "https://${var.account_id}.r2.cloudflarestorage.com"
}

output "read_access_key_id" {
  value = cloudflare_account_token.read.id
}

# R2's S3 secret key is the SHA-256 of the API token value.
output "read_secret_access_key" {
  value     = sha256(cloudflare_account_token.read.value)
  sensitive = true
}

output "write_access_key_id" {
  value = cloudflare_account_token.write.id
}

output "write_secret_access_key" {
  value     = sha256(cloudflare_account_token.write.value)
  sensitive = true
}
