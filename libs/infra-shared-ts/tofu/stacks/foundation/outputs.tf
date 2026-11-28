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

locals {
  grafana_rules_by_group = module.observability.grafana_instance_ready ? {
    for rule in jsondecode(data.http.kept_rules[0].response_body) :
    "${rule.folderUID}/${rule.ruleGroup}" => rule.uid...
  } : {}
}

output "grafana_alert_rule_groups" {
  value = {
    for group, rules in local.grafana_rules_by_group : group => length(rules)
  }
}
