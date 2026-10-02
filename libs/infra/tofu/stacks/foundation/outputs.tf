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
