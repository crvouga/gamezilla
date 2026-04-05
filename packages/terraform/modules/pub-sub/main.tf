data "aws_region" "current" {}

# ── Cloud Map ────────────────────────────────────────────────────────────────

resource "aws_service_discovery_private_dns_namespace" "this" {
  name = "app.local"
  vpc  = var.vpc_id

  tags = { Name = "${var.name_prefix}-pubsub-namespace" }
}

resource "aws_service_discovery_service" "emqx" {
  name = "emqx"

  dns_config {
    namespace_id = aws_service_discovery_private_dns_namespace.this.id

    dns_records {
      type = "A"
      ttl  = 10
    }

    routing_policy = "MULTIVALUE"
  }

  tags = { Name = "${var.name_prefix}-emqx-discovery" }
}

# ── ECS cluster ──────────────────────────────────────────────────────────────

resource "aws_ecs_cluster" "this" {
  name = "${var.name_prefix}-cluster"

  setting {
    name  = "containerInsights"
    value = "enhanced"
  }

  tags = { Name = "${var.name_prefix}-cluster" }
}

# ── Security group ───────────────────────────────────────────────────────────

resource "aws_security_group" "broker" {
  name_prefix = "${var.name_prefix}-emqx-"
  description = "Pub/sub MQTT broker"
  vpc_id      = var.vpc_id

  tags = { Name = "${var.name_prefix}-emqx-sg" }
}

resource "aws_security_group_rule" "broker_mqtt" {
  type              = "ingress"
  from_port         = 1883
  to_port           = 1883
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]
  security_group_id = aws_security_group.broker.id
  description       = "MQTT TCP (NLB)"
}

resource "aws_security_group_rule" "broker_ws" {
  type              = "ingress"
  from_port         = 8083
  to_port           = 8083
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]
  security_group_id = aws_security_group.broker.id
  description       = "MQTT WebSocket (NLB)"
}

resource "aws_security_group_rule" "broker_dashboard" {
  type              = "ingress"
  from_port         = 18083
  to_port           = 18083
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]
  security_group_id = aws_security_group.broker.id
  description       = "Dashboard (optional)"
}

resource "aws_security_group_rule" "broker_mqtt_vpc_clients" {
  count                    = length(var.vpc_client_security_group_ids)
  type                     = "ingress"
  from_port                = 1883
  to_port                  = 1883
  protocol                 = "tcp"
  security_group_id        = aws_security_group.broker.id
  source_security_group_id = var.vpc_client_security_group_ids[count.index]
  description              = "MQTT from VPC clients"
}

resource "aws_security_group_rule" "broker_egress" {
  type              = "egress"
  from_port         = 0
  to_port           = 0
  protocol          = "-1"
  cidr_blocks       = ["0.0.0.0/0"]
  security_group_id = aws_security_group.broker.id
  description       = "Allow all outbound"
}

# ── CloudWatch log group ─────────────────────────────────────────────────────

resource "aws_cloudwatch_log_group" "emqx" {
  name              = "/ecs/${var.name_prefix}/emqx"
  retention_in_days = 7

  tags = { Name = "${var.name_prefix}-emqx-logs" }
}

# ── IAM roles ────────────────────────────────────────────────────────────────

data "aws_iam_policy_document" "ecs_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "emqx_execution" {
  name_prefix        = "${var.name_prefix}-emqx-exec-"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json

  tags = { Name = "${var.name_prefix}-emqx-execution-role" }
}

resource "aws_iam_role_policy_attachment" "emqx_execution" {
  role       = aws_iam_role.emqx_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role" "emqx_task" {
  name_prefix        = "${var.name_prefix}-emqx-task-"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json

  tags = { Name = "${var.name_prefix}-emqx-task-role" }
}

# ECS Exec requires SSM permissions on the task role
resource "aws_iam_role_policy" "emqx_task_exec_command" {
  name = "ecs-exec"
  role = aws_iam_role.emqx_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "ssmmessages:CreateControlChannel",
        "ssmmessages:CreateDataChannel",
        "ssmmessages:OpenControlChannel",
        "ssmmessages:OpenDataChannel"
      ]
      Resource = "*"
    }]
  })
}

# ── Task definition ──────────────────────────────────────────────────────────

resource "aws_ecs_task_definition" "emqx" {
  family                   = "${var.name_prefix}-emqx"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 2048
  memory                   = 4096
  execution_role_arn       = aws_iam_role.emqx_execution.arn
  task_role_arn            = aws_iam_role.emqx_task.arn

  runtime_platform {
    cpu_architecture        = "X86_64"
    operating_system_family = "LINUX"
  }

  container_definitions = jsonencode([{
    name      = "emqx"
    image     = var.emqx_image
    essential = true

    portMappings = [
      { containerPort = 1883, protocol = "tcp" },
      { containerPort = 8083, protocol = "tcp" },
      { containerPort = 18083, protocol = "tcp" },
    ]

    environment = [
      { name = "EMQX_NODE__NAME", value = "emqx@127.0.0.1" },
      { name = "EMQX_LOG__CONSOLE__LEVEL", value = "info" },
      { name = "EMQX_LOG__CONSOLE__FORMATTER", value = "text" },
    ]

    healthCheck = {
      command     = ["CMD-SHELL", "curl -sf http://localhost:18083/status || exit 1"]
      interval    = 10
      timeout     = 5
      retries     = 3
      startPeriod = 30
    }

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.emqx.name
        "awslogs-region"        = data.aws_region.current.name
        "awslogs-stream-prefix" = "emqx"
      }
    }
  }])

  tags = { Name = "${var.name_prefix}-emqx-task" }
}

# ── ECS service ──────────────────────────────────────────────────────────────

resource "aws_ecs_service" "emqx" {
  name            = "${var.name_prefix}-emqx"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.emqx.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  enable_execute_command = true

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [aws_security_group.broker.id]
    assign_public_ip = false
  }

  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200
  health_check_grace_period_seconds  = 60

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  service_registries {
    registry_arn = aws_service_discovery_service.emqx.arn
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.mqtt.arn
    container_name   = "emqx"
    container_port   = 1883
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.ws.arn
    container_name   = "emqx"
    container_port   = 8083
  }

  tags = { Name = "${var.name_prefix}-emqx-service" }
}

# ── NLB ──────────────────────────────────────────────────────────────────────

resource "aws_lb" "nlb" {
  name               = "${var.name_prefix}-mqtt-nlb"
  load_balancer_type = "network"
  internal           = false
  subnets            = var.public_subnet_ids

  enable_cross_zone_load_balancing = true

  tags = { Name = "${var.name_prefix}-mqtt-nlb" }
}

# ── Target groups ────────────────────────────────────────────────────────────

resource "aws_lb_target_group" "mqtt" {
  name                 = "${var.name_prefix}-mqtt-1883"
  port                 = 1883
  protocol             = "TCP"
  vpc_id               = var.vpc_id
  target_type          = "ip"
  deregistration_delay = 30

  health_check {
    protocol            = "TCP"
    port                = "1883"
    interval            = 10
    healthy_threshold   = 2
    unhealthy_threshold = 2
  }

  tags = { Name = "${var.name_prefix}-mqtt-tg" }
}

resource "aws_lb_target_group" "ws" {
  name                 = "${var.name_prefix}-mqtt-8083"
  port                 = 8083
  protocol             = "TCP"
  vpc_id               = var.vpc_id
  target_type          = "ip"
  deregistration_delay = 30

  health_check {
    protocol            = "TCP"
    port                = "8083"
    interval            = 10
    healthy_threshold   = 2
    unhealthy_threshold = 2
  }

  tags = { Name = "${var.name_prefix}-mqtt-ws-tg" }
}

# ── Listeners ────────────────────────────────────────────────────────────────

resource "aws_lb_listener" "mqtt" {
  load_balancer_arn = aws_lb.nlb.arn
  port              = 1883
  protocol          = "TCP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.mqtt.arn
  }

  tags = { Name = "${var.name_prefix}-mqtt-listener" }
}

resource "aws_lb_listener" "ws" {
  load_balancer_arn = aws_lb.nlb.arn
  port              = 8083
  protocol          = "TCP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.ws.arn
  }

  tags = { Name = "${var.name_prefix}-ws-listener" }
}
