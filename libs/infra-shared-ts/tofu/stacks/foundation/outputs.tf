# Consumed by `scripts/render-wrangler.ts` (Worker names) and the edge stack.

output "worker" {
  value = var.worker.name
}

output "hosts" {
  value = var.hosts
}

output "protection" {
  value = var.protection
}

output "grafana_alert_rule_quotas" {
  value = module.observability.grafana_instance_ready ? [
    for quota in jsondecode(data.http.alert_rule_quotas[0].response_body) : quota
    if quota.target == "alert_rule"
  ] : []
}
