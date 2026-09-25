# The Grafana Cloud stack every environment sends traces to (Grafana's free
# plan allows one stack per org; environments are told apart by the
# `deployment.environment.name` span attribute and hold their own
# write/read tokens — modules/observability).
#
# STATEFUL: the stack holds trace history. `delete_protection` on the Grafana
# side, `prevent_destroy` here, and the plan policy all refuse to delete it.

terraform {
  required_providers {
    grafana = { source = "grafana/grafana" }
  }
}

variable "slug" {
  type        = string
  description = "Globally unique stack slug → https://<slug>.grafana.net."
}

variable "region" {
  type = string
}

resource "grafana_cloud_stack" "this" {
  name              = var.slug
  slug              = var.slug
  region_slug       = var.region
  delete_protection = true

  lifecycle {
    prevent_destroy = true
    # The display name is edited in the Grafana UI; identity is the slug.
    ignore_changes = [name, description, labels]
  }
}
