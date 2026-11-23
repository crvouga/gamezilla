# The retired CI artifacts bucket. CI hands files between jobs as GitHub
# Actions artifacts again: the repository is public, so their storage is free,
# while the bucket's storage and writes were billed. Its token and the
# `CI_ARTIFACTS_*` secrets are destroyed.
#
# A bucket is stateful, so it leaves state without being deleted, and so does
# its expiry rule: the rule keeps running and empties the bucket a week after
# the last upload, after which it costs nothing.
removed {
  from = cloudflare_r2_bucket.ci_artifacts
  lifecycle {
    destroy = false
  }
}

removed {
  from = cloudflare_r2_bucket_lifecycle.ci_artifacts
  lifecycle {
    destroy = false
  }
}
