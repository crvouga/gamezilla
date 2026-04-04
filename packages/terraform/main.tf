# ── Web app (S3 + CloudFront + optional Route 53/ACM) ────────────────────────

module "web_app" {
  source = "./modules/web-app"

  custom_domain           = var.custom_domain
  custom_domain_bootstrap = var.custom_domain_bootstrap
  name_prefix             = "gamezilla"
}

# ── VPC ──────────────────────────────────────────────────────────────────────

module "vpc" {
  source = "./modules/vpc"

  nat_gateways = 1
  name_prefix  = "gamezilla"
}

# ── Security groups (req-res tasks, worker) ──────────────────────────────────

resource "aws_security_group" "req_res_task" {
  name_prefix = "gamezilla-rr-task-"
  description = "Req-res tasks - reach Aurora and pub/sub broker"
  vpc_id      = module.vpc.vpc_id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "gamezilla-req-res-task-sg" }
}

resource "aws_security_group" "worker" {
  name_prefix = "gamezilla-worker-"
  description = "Worker tasks"
  vpc_id      = module.vpc.vpc_id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "gamezilla-worker-sg" }
}

# ── Database ─────────────────────────────────────────────────────────────────

module "database" {
  source = "./modules/database"

  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
  allowed_security_group_ids = [
    aws_security_group.req_res_task.id,
    aws_security_group.worker.id,
  ]
  name_prefix = "gamezilla"
}

# ── Pub/sub broker (EMQX on Fargate + NLB) ──────────────────────────────────

module "pub_sub" {
  source = "./modules/pub-sub"

  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
  public_subnet_ids  = module.vpc.public_subnet_ids
  vpc_client_security_group_ids = [
    aws_security_group.req_res_task.id,
    aws_security_group.worker.id,
  ]
  emqx_image  = var.emqx_image
  name_prefix = "gamezilla"
}

# ── Worker ───────────────────────────────────────────────────────────────────

module "worker" {
  source = "./modules/worker"

  vpc_id                 = module.vpc.vpc_id
  private_subnet_ids     = module.vpc.private_subnet_ids
  ecs_cluster_id         = module.pub_sub.ecs_cluster_id
  app_image              = var.app_image
  database_host          = module.database.cluster_endpoint
  database_secret_arn    = module.database.secret_arn
  pubsub_url             = module.pub_sub.internal_mqtt_url
  task_security_group_id = aws_security_group.worker.id
  name_prefix            = "gamezilla"
}

# ── Req-res (ALB + Fargate + CloudFront) ─────────────────────────────────────

module "req_res" {
  source = "./modules/req-res"

  vpc_id                 = module.vpc.vpc_id
  private_subnet_ids     = module.vpc.private_subnet_ids
  public_subnet_ids      = module.vpc.public_subnet_ids
  ecs_cluster_id         = module.pub_sub.ecs_cluster_id
  app_image              = var.app_image
  database_host          = module.database.cluster_endpoint
  database_secret_arn    = module.database.secret_arn
  pubsub_url             = module.pub_sub.internal_mqtt_url
  task_security_group_id = aws_security_group.req_res_task.id
  name_prefix            = "gamezilla"
}
