# The one Railway project every environment's MQTT broker runs in, and the
# `emqx` service they share. Each environment is a Railway environment of
# this project (modules/pubsub, per env stack), a duplicate of production so
# it holds an instance of this service (a new empty environment does not).
# The build and placement below are set on the service; whether a later change
# reaches an already-duplicated environment is Railway's behavior, not
# something this stack guarantees — check `bun health` after changing them.
#
# STATEFUL and global: the project and the service (whose volume holds
# `/opt/emqx/data` in each environment) are never destroyed or replaced — not
# even by an environment's teardown, which removes only its own Railway
# environment.

terraform {
  required_providers {
    railway = { source = "terraform-community-providers/railway" }
  }
}

variable "project_name" {
  type = string
}

variable "workspace_id" {
  type = string
}

variable "github_repo" {
  type        = string
  description = "owner/repo the broker image builds from."
}

variable "root_directory" {
  type = string
}

variable "region" {
  type        = string
  default     = "us-west2"
  description = "Railway region; pinned so the broker never moves (its volume lives there)."
}

resource "railway_project" "this" {
  name         = var.project_name
  workspace_id = var.workspace_id

  lifecycle {
    prevent_destroy = true
  }
}

resource "railway_service" "emqx" {
  name               = "emqx"
  project_id         = railway_project.this.id
  source_repo        = var.github_repo
  source_repo_branch = "main"
  root_directory     = var.root_directory
  regions            = [{ region = var.region, num_replicas = 1 }]

  volume = {
    name       = "emqx-volume"
    mount_path = "/opt/emqx/data"
  }

  lifecycle {
    prevent_destroy = true
  }
}

output "project_id" {
  value = railway_project.this.id
}

output "service_id" {
  value = railway_service.emqx.id
}
