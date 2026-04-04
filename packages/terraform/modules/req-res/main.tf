data "aws_region" "current" {}

# ── CloudWatch log group ─────────────────────────────────────────────────────

resource "aws_cloudwatch_log_group" "req_res" {
  name              = "/ecs/${var.name_prefix}/req-res"
  retention_in_days = 7

  tags = { Name = "${var.name_prefix}-req-res-logs" }
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
  name_prefix        = "${var.name_prefix}-rr-exec-"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json

  tags = { Name = "${var.name_prefix}-req-res-execution-role" }
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
  name_prefix        = "${var.name_prefix}-rr-task-"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json

  tags = { Name = "${var.name_prefix}-req-res-task-role" }
}

# ── ALB ──────────────────────────────────────────────────────────────────────

resource "aws_security_group" "alb" {
  name_prefix = "${var.name_prefix}-rr-alb-"
  description = "Req-res ALB"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTP from internet"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.name_prefix}-rr-alb-sg" }
}

resource "aws_lb" "alb" {
  name               = "${var.name_prefix}-req-res-alb"
  load_balancer_type = "application"
  internal           = false
  subnets            = var.public_subnet_ids
  security_groups    = [aws_security_group.alb.id]

  tags = { Name = "${var.name_prefix}-req-res-alb" }
}

resource "aws_lb_target_group" "app" {
  name                 = "${var.name_prefix}-rr-tg"
  port                 = 8080
  protocol             = "HTTP"
  vpc_id               = var.vpc_id
  target_type          = "ip"
  deregistration_delay = 30

  health_check {
    path                = "/health"
    matcher             = "200"
    interval            = 10
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 8
  }

  tags = { Name = "${var.name_prefix}-rr-tg" }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.alb.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }

  tags = { Name = "${var.name_prefix}-rr-http-listener" }
}

# ── Task definition ──────────────────────────────────────────────────────────

resource "aws_ecs_task_definition" "req_res" {
  family                   = "${var.name_prefix}-req-res"
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
    name      = "req-res"
    image     = var.app_image
    essential = true
    command   = ["bun", "run", "packages/app/src/req-res.ts"]

    portMappings = [
      { containerPort = 8080, protocol = "tcp" }
    ]

    environment = [
      { name = "DATABASE_HOST", value = var.database_host },
      { name = "DATABASE_PORT", value = "5432" },
      { name = "DATABASE_NAME", value = "postgres" },
      { name = "PUBSUB_URL", value = var.pubsub_url },
      { name = "PORT", value = "8080" },
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
        "awslogs-group"         = aws_cloudwatch_log_group.req_res.name
        "awslogs-region"        = data.aws_region.current.name
        "awslogs-stream-prefix" = "req-res"
      }
    }
  }])

  tags = {
    Name    = "${var.name_prefix}-req-res-task"
    Service = "req-res"
  }
}

# ── ECS service ──────────────────────────────────────────────────────────────

resource "aws_ecs_service" "req_res" {
  name            = "${var.name_prefix}-req-res"
  cluster         = var.ecs_cluster_id
  task_definition = aws_ecs_task_definition.req_res.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.task_security_group_id]
    assign_public_ip = false
  }

  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200
  health_check_grace_period_seconds  = 420

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.app.arn
    container_name   = "req-res"
    container_port   = 8080
  }

  tags = {
    Name    = "${var.name_prefix}-req-res-service"
    Service = "req-res"
  }
}

# ── CloudFront distribution (HTTPS in front of ALB) ─────────────────────────

resource "aws_cloudfront_distribution" "api" {
  comment             = "Req res: HTTPS via CloudFront, origin ECS/ALB"
  enabled             = true
  price_class         = "PriceClass_100"
  wait_for_deployment = false

  origin {
    domain_name = aws_lb.alb.dns_name
    origin_id   = "alb"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    target_origin_id       = "alb"
    viewer_protocol_policy = "redirect-to-https"

    allowed_methods = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods  = ["GET", "HEAD", "OPTIONS"]

    forwarded_values {
      query_string = true
      headers      = ["*"]

      cookies {
        forward = "all"
      }
    }

    min_ttl     = 0
    default_ttl = 0
    max_ttl     = 0
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = { Name = "${var.name_prefix}-req-res-cdn" }
}
