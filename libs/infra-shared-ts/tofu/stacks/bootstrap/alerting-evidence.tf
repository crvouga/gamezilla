# Read only by the main-branch operational check. Never emit this output to logs.
output "alert_delivery_check" {
  sensitive = true
  value = local.routing_ready ? {
    stackUrl          = module.trace_stack.url
    apiUrl            = local.irm_api_url
    token             = grafana_cloud_stack_service_account_token.alerting[0].key
    webhookUrl        = module.alert_routing[0].ci_webhook_url
    hookId            = tostring(github_repository_webhook.ci_alerts[0].id)
    integrationId     = module.alert_routing[0].ci_delivery_evidence.integration_id
    routeId           = module.alert_routing[0].ci_delivery_evidence.route_id
    responderId       = module.alert_routing[0].ci_delivery_evidence.responder_id
    responderUsername = var.alerting.irm_responder
  } : null
}
