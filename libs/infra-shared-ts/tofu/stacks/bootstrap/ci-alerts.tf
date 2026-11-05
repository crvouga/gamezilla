# Secret-bearing IRM URL stays in encrypted OpenTofu state, never Actions
# variables or workflow logs. GitHub itself delivers workflow results.
resource "github_repository_webhook" "ci_alerts" {
  count      = local.routing_ready ? 1 : 0
  repository = var.github.repo
  active     = true
  events     = ["workflow_run"]

  configuration {
    url          = module.alert_routing[0].ci_webhook_url
    content_type = "json"
    insecure_ssl = false
  }
}
