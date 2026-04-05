# ── Security group ────────────────────────────────────────────────────────────

resource "aws_security_group" "db" {
  name_prefix = "${var.name_prefix}-db-"
  description = "Aurora PostgreSQL"
  vpc_id      = var.vpc_id

  tags = { Name = "${var.name_prefix}-db-sg" }
}

resource "aws_security_group_rule" "db_ingress" {
  count                    = length(var.allowed_security_group_ids)
  type                     = "ingress"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  security_group_id        = aws_security_group.db.id
  source_security_group_id = var.allowed_security_group_ids[count.index]
  description              = "Postgres from app clients"
}

# ── Subnet group ─────────────────────────────────────────────────────────────

resource "aws_db_subnet_group" "this" {
  name       = "${var.name_prefix}-aurora"
  subnet_ids = var.private_subnet_ids

  tags = { Name = "${var.name_prefix}-aurora-subnet-group" }
}

# ── Credentials ──────────────────────────────────────────────────────────────

resource "random_password" "db" {
  length  = 32
  special = false
}

resource "aws_secretsmanager_secret" "db" {
  name                    = "app/aurora-credentials"
  recovery_window_in_days = 7

  tags = { Name = "${var.name_prefix}-aurora-credentials" }
}

resource "aws_secretsmanager_secret_version" "db" {
  secret_id = aws_secretsmanager_secret.db.id
  secret_string = jsonencode({
    username = "app"
    password = random_password.db.result
    engine   = "postgres"
    port     = 5432
    host     = aws_rds_cluster.this.endpoint
    dbname   = "postgres"
  })
}

# ── Aurora cluster ───────────────────────────────────────────────────────────

resource "aws_rds_cluster" "this" {
  cluster_identifier = "${var.name_prefix}-aurora"
  engine             = "aurora-postgresql"
  engine_mode        = "provisioned"
  engine_version     = "16.6"

  database_name   = "postgres"
  master_username = "app"
  master_password = random_password.db.result

  db_subnet_group_name   = aws_db_subnet_group.this.name
  vpc_security_group_ids = [aws_security_group.db.id]

  storage_encrypted                   = true
  deletion_protection                 = true
  iam_database_authentication_enabled = true
  copy_tags_to_snapshot               = true

  # Mirrors CDK RemovalPolicy.SNAPSHOT
  final_snapshot_identifier = "${var.name_prefix}-aurora-final"
  skip_final_snapshot       = false

  serverlessv2_scaling_configuration {
    min_capacity = 0.5
    max_capacity = 4
  }

  tags = { Name = "${var.name_prefix}-aurora" }
}

resource "aws_rds_cluster_instance" "writer" {
  identifier         = "${var.name_prefix}-aurora-writer"
  cluster_identifier = aws_rds_cluster.this.id
  instance_class     = "db.serverless"
  engine             = aws_rds_cluster.this.engine
  engine_version     = aws_rds_cluster.this.engine_version

  tags = { Name = "${var.name_prefix}-aurora-writer" }
}
