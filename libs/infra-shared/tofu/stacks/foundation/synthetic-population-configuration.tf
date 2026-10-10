variable "population" {
  type = object({
    replicas  = optional(number, 1)
    capacity  = optional(number, 1)
    vcpus     = optional(number, 1)
    memory_gb = optional(number, 2)
    region    = optional(string, "us-west2")
  })
  default = {}
}
