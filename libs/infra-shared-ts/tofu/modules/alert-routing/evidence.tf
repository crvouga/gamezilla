output "ci_delivery_evidence" {
  value = {
    integration_id = grafana_oncall_integration.ci.id
    route_id       = grafana_oncall_route.ci.id
    responder_id   = data.grafana_oncall_user.responder.id
  }
}
