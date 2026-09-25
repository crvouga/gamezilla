# Consumed by `scripts/render-wrangler.ts` (Worker names) and the edge stack.

output "workers" {
  value = {
    api  = module.names.api_worker
    room = module.names.room_worker
    web  = module.names.web_worker
  }
}

output "hosts" {
  value = var.hosts
}

output "protection" {
  value = var.protection
}
