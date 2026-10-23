# Where every stack's encrypted state lives, and the credential that reads and
# writes it. STATEFUL: losing the bucket loses the record of what OpenTofu
# owns; losing the token mid-apply strands the state write. Both carry
# prevent_destroy (and the plan policy protects the bucket type).

terraform {
  required_providers {
    cloudflare = { source = "cloudflare/cloudflare" }
  }
}

variable "account_id" {
  type = string
}

variable "bucket" {
  type = string
}

resource "cloudflare_r2_bucket" "state" {
  account_id = var.account_id
  name       = var.bucket

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

resource "cloudflare_account_token" "state" {
  account_id = var.account_id
  name       = "${var.bucket}-access"

  policies = [{
    effect            = "allow"
    permission_groups = [{ id = data.cloudflare_account_api_token_permission_groups_list.bucket_item_write.result[0].id }]
    resources = jsonencode({
      "com.cloudflare.edge.r2.bucket.${var.account_id}_default_${cloudflare_r2_bucket.state.name}" = "*"
    })
  }]

  lifecycle {
    prevent_destroy = true
  }
}

output "access_key_id" {
  value = cloudflare_account_token.state.id
}

output "secret_access_key" {
  value     = sha256(cloudflare_account_token.state.value)
  sensitive = true
}
