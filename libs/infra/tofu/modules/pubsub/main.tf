# Query invalidation for one environment: AWS IoT Core, MQTT over WebSocket
# on this environment's existing broker hostname. AWS owns the connections,
# the fan-out, and the brokers. The app owns topics (game id, query hash,
# actor id). A missed message is recovered by the sync engine; this broker
# is not a source of truth, so every resource here is replaceable.
#
# Clients connect with the same HMAC token the API already mints. An
# unsigned custom authorizer checks it and turns the token's acl claim into
# an IoT session policy. The Worker publishes with SigV4; it has no instance
# role, so it uses an IAM user key written into the secret store.

terraform {
  required_providers {
    aws        = { source = "hashicorp/aws" }
    archive    = { source = "hashicorp/archive" }
    cloudflare = { source = "cloudflare/cloudflare" }
  }
}

variable "project" {
  type = string
}

variable "suffix" {
  type = string
}

variable "region" {
  type = string
}

variable "hostname" {
  type = string
}

variable "zone_id" {
  type = string
}

variable "jwt_secret" {
  type      = string
  sensitive = true
}

locals {
  authorizer_name = "${var.project}-iot-${var.suffix}"
  function_name   = "${var.project}-iot-auth-${var.suffix}"
  domain_name     = "${var.project}-iot-domain-${var.suffix}"
  publisher_name  = "${var.project}-iot-pub-${var.suffix}"
  role_name       = "${var.project}-iot-auth-role-${var.suffix}"
}

data "aws_caller_identity" "current" {}

data "aws_iot_endpoint" "data" {
  endpoint_type = "iot:Data-ATS"
}

data "archive_file" "authorizer" {
  type        = "zip"
  source_file = "${path.module}/authorizer/index.mjs"
  output_path = "${path.module}/authorizer.zip"
}

resource "aws_cloudwatch_log_group" "authorizer" {
  name              = "/aws/lambda/${local.function_name}"
  retention_in_days = 14
}

resource "aws_iam_role" "authorizer" {
  name = local.role_name
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = "sts:AssumeRole"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "authorizer_logs" {
  role       = aws_iam_role.authorizer.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_lambda_function" "authorizer" {
  function_name    = local.function_name
  role             = aws_iam_role.authorizer.arn
  runtime          = "nodejs22.x"
  handler          = "index.handler"
  filename         = data.archive_file.authorizer.output_path
  source_code_hash = data.archive_file.authorizer.output_base64sha256
  timeout          = 5
  memory_size      = 128

  environment {
    variables = {
      TOKEN_SECRET   = var.jwt_secret
      AWS_ACCOUNT_ID = data.aws_caller_identity.current.account_id
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.authorizer,
    aws_iam_role_policy_attachment.authorizer_logs,
  ]
}

resource "aws_lambda_permission" "iot" {
  statement_id  = "AllowIoTInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.authorizer.function_name
  principal     = "iot.amazonaws.com"
  source_arn    = "arn:aws:iot:${var.region}:${data.aws_caller_identity.current.account_id}:authorizer/${local.authorizer_name}"
}

resource "aws_iot_authorizer" "this" {
  name                    = local.authorizer_name
  authorizer_function_arn = aws_lambda_function.authorizer.arn
  signing_disabled        = true
  status                  = "ACTIVE"
  enable_caching          = false

  depends_on = [aws_lambda_permission.iot]
}

resource "aws_acm_certificate" "broker" {
  domain_name       = var.hostname
  validation_method = "DNS"
}

resource "cloudflare_dns_record" "cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.broker.domain_validation_options :
    dvo.domain_name => {
      name  = dvo.resource_record_name
      type  = dvo.resource_record_type
      value = dvo.resource_record_value
    }
  }

  zone_id = var.zone_id
  name    = trimsuffix(each.value.name, ".")
  type    = each.value.type
  content = trimsuffix(each.value.value, ".")
  proxied = false
  ttl     = 1
  comment = "OpenTofu: libs/infra pubsub certificate"
}

resource "aws_acm_certificate_validation" "broker" {
  certificate_arn = aws_acm_certificate.broker.arn
  validation_record_fqdns = [
    for record in cloudflare_dns_record.cert_validation : record.name
  ]
}

resource "aws_iot_domain_configuration" "broker" {
  name                    = local.domain_name
  domain_name             = var.hostname
  service_type            = "DATA"
  application_protocol    = "MQTT_WSS"
  authentication_type     = "CUSTOM_AUTH"
  server_certificate_arns = [aws_acm_certificate_validation.broker.certificate_arn]

  authorizer_config {
    allow_authorizer_override = false
    default_authorizer_name   = aws_iot_authorizer.this.name
  }
}

resource "cloudflare_dns_record" "broker" {
  zone_id = var.zone_id
  name    = var.hostname
  type    = "CNAME"
  content = data.aws_iot_endpoint.data.endpoint_address
  proxied = false
  ttl     = 1
  comment = "OpenTofu: libs/infra pubsub"
}

resource "aws_iam_user" "publisher" {
  name = local.publisher_name
}

resource "aws_iam_user_policy" "publisher" {
  name = local.publisher_name
  user = aws_iam_user.publisher.name
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "iot:Publish"
      Resource = "arn:aws:iot:${var.region}:${data.aws_caller_identity.current.account_id}:topic/*"
    }]
  })
}

resource "aws_iam_access_key" "publisher" {
  user = aws_iam_user.publisher.name
}

output "wss_url" {
  value = "wss://${var.hostname}/mqtt"
}

output "data_endpoint" {
  description = "IoT data-plane hostname. The Worker signs HTTPS publishes to it."
  value       = data.aws_iot_endpoint.data.endpoint_address
}

output "region" {
  value = var.region
}

output "publisher_access_key_id" {
  value     = aws_iam_access_key.publisher.id
  sensitive = true
}

output "publisher_secret_access_key" {
  value     = aws_iam_access_key.publisher.secret
  sensitive = true
}
