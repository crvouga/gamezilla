data "aws_region" "current" {}

# ── CloudWatch log group ─────────────────────────────────────────────────────

resource "aws_cloudwatch_log_group" "worker" {
  name              = "/ecs/${var.name_prefix}/worker"
  retention_in_days = 7

  tags = { Name = "${var.name_prefix}-worker-logs" }
}

# ── IAM ──────────────────────────────────────────────────────────────────────

data "aws_iam_policy_document" "ecs_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "execution" {
  name_prefix        = "${var.name_prefix}-wkr-exec-"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json

  tags = { Name = "${var.name_prefix}-worker-execution-role" }
}

resource "aws_iam_role_policy_attachment" "execution_base" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "execution_secrets" {
  name = "secrets-read"
  role = aws_iam_role.execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = [var.database_secret_arn]
    }]
  })
}

resource "aws_iam_role" "task" {
  name_prefix        = "${var.name_prefix}-wkr-task-"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json

  tags = { Name = "${var.name_prefix}-worker-task-role" }
}

# ── Task definition ──────────────────────────────────────────────────────────

resource "aws_ecs_task_definition" "worker" {
  family                   = "${var.name_prefix}-worker"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  runtime_platform {
    cpu_architecture        = "X86_64"
    operating_system_family = "LINUX"
  }

  container_definitions = jsonencode([{
    name      = "worker"
    image     = var.app_image
    essential = true
    command   = ["bun", "run", "packages/app/src/worker.ts"]

    environment = [
      { name = "PORT", value = "8080" },
      { name = "DATABASE_HOST", value = var.database_host },
      { name = "DATABASE_PORT", value = "5432" },
      { name = "DATABASE_NAME", value = "postgres" },
      { name = "PUBSUB_URL", value = var.pubsub_url },
      { name = "NODE_ENV", value = "production" },
    ]

    secrets = [
      {
        name      = "DATABASE_USERNAME"
        valueFrom = "${var.database_secret_arn}:username::"
      },
      {
        name      = "DATABASE_PASSWORD"
        valueFrom = "${var.database_secret_arn}:password::"
      },
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.worker.name
        "awslogs-region"        = data.aws_region.current.name
        "awslogs-stream-prefix" = "worker"
      }
    }
  }])

  tags = {
    Name    = "${var.name_prefix}-worker-task"
    Service = "worker"
  }
}

# ── ECS service ──────────────────────────────────────────────────────────────

resource "aws_ecs_service" "worker" {
  name                 = "${var.name_prefix}-worker"
  cluster              = var.ecs_cluster_id
  task_definition      = aws_ecs_task_definition.worker.arn
  desired_count        = 1
  launch_type          = "FARGATE"
  force_new_deployment = true

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.task_security_group_id]
    assign_public_ip = false
  }

  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  tags = {
    Name    = "${var.name_prefix}-worker-service"
    Service = "worker"
  }
}
