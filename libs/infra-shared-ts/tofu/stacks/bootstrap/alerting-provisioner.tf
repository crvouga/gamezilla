# Cloud service-account roles force replacement. A dedicated provisioner grants
# IRM administration without deleting the live delivery check's Editor account.
resource "grafana_cloud_stack_service_account" "alerting_provisioner" {
  count = local.routing_ready ? 1 : 0

  provider   = grafana.alerting_management
  stack_slug = var.grafana.stack_slug
  name       = "${var.project}-alerting-provisioner"
  role       = "Admin"
}

resource "grafana_cloud_stack_service_account_token" "alerting_provisioner" {
  count = local.routing_ready ? 1 : 0

  provider           = grafana.alerting_management
  stack_slug         = var.grafana.stack_slug
  name               = "${var.project}-alerting-provisioner"
  service_account_id = grafana_cloud_stack_service_account.alerting_provisioner[0].id
}
