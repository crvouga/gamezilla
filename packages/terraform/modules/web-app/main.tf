data "aws_caller_identity" "current" {}

locals {
  create_hosted_zone = var.custom_domain
  create_certificate = var.custom_domain && !var.custom_domain_bootstrap
  use_apex_redirect  = var.custom_domain && !var.custom_domain_bootstrap
  domain_names       = local.create_certificate ? ["www.${var.domain_name}", var.domain_name] : []
}

# ── S3 bucket ────────────────────────────────────────────────────────────────

resource "aws_s3_bucket" "web" {
  bucket_prefix = "${var.name_prefix}-web-"
  force_destroy = true

  tags = { Name = "${var.name_prefix}-web-app" }
}

resource "aws_s3_bucket_public_access_block" "web" {
  bucket = aws_s3_bucket.web.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "web" {
  bucket = aws_s3_bucket.web.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# ── CloudFront OAC ──────────────────────────────────────────────────────────

resource "aws_cloudfront_origin_access_control" "web" {
  name                              = "${var.name_prefix}-web-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# ── S3 bucket policy (allow CloudFront OAC) ──────────────────────────────────

resource "aws_s3_bucket_policy" "web" {
  bucket = aws_s3_bucket.web.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid    = "AllowCloudFrontOAC"
      Effect = "Allow"
      Principal = {
        Service = "cloudfront.amazonaws.com"
      }
      Action   = "s3:GetObject"
      Resource = "${aws_s3_bucket.web.arn}/*"
      Condition = {
        StringEquals = {
          "AWS:SourceArn" = aws_cloudfront_distribution.web.arn
        }
      }
    }]
  })
}

# ── CloudFront Function (SPA router) ────────────────────────────────────────

resource "aws_cloudfront_function" "spa_router" {
  name    = "${var.name_prefix}-spa-router"
  runtime = "cloudfront-js-2.0"
  publish = true
  code    = replace(file("${path.module}/spa-router.js"), "$${use_apex_redirect}", local.use_apex_redirect)
}

# ── Route 53 hosted zone (conditional) ───────────────────────────────────────

resource "aws_route53_zone" "this" {
  count = local.create_hosted_zone ? 1 : 0
  name  = var.domain_name

  tags = { Name = "${var.name_prefix}-hosted-zone" }
}

# ── ACM certificate (conditional) ───────────────────────────────────────────

resource "aws_acm_certificate" "this" {
  count             = local.create_certificate ? 1 : 0
  domain_name       = var.domain_name
  validation_method = "DNS"

  subject_alternative_names = ["www.${var.domain_name}"]

  tags = { Name = "${var.name_prefix}-web-cert" }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "cert_validation" {
  for_each = local.create_certificate ? {
    for dvo in aws_acm_certificate.this[0].domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  } : {}

  zone_id = aws_route53_zone.this[0].zone_id
  name    = each.value.name
  type    = each.value.type
  records = [each.value.record]
  ttl     = 60

  allow_overwrite = true
}

resource "aws_acm_certificate_validation" "this" {
  count                   = local.create_certificate ? 1 : 0
  certificate_arn         = aws_acm_certificate.this[0].arn
  validation_record_fqdns = [for r in aws_route53_record.cert_validation : r.fqdn]
}

# ── Response headers policy (COEP / COOP for SharedArrayBuffer) ──────────────

resource "aws_cloudfront_response_headers_policy" "web" {
  name = "${var.name_prefix}-web-response-headers"

  custom_headers_config {
    items {
      header   = "Cross-Origin-Embedder-Policy"
      value    = "credentialless"
      override = true
    }
    items {
      header   = "Cross-Origin-Opener-Policy"
      value    = "same-origin"
      override = true
    }
  }
}

# ── CloudFront distribution ─────────────────────────────────────────────────

resource "aws_cloudfront_distribution" "web" {
  comment             = "Web app: S3 + SPA router"
  enabled             = true
  default_root_object = "index.html"
  price_class         = "PriceClass_All"
  wait_for_deployment = false

  aliases = local.domain_names

  origin {
    domain_name              = aws_s3_bucket.web.bucket_regional_domain_name
    origin_id                = "s3"
    origin_access_control_id = aws_cloudfront_origin_access_control.web.id
  }

  default_cache_behavior {
    target_origin_id           = "s3"
    viewer_protocol_policy     = "redirect-to-https"
    compress                   = true
    response_headers_policy_id = aws_cloudfront_response_headers_policy.web.id

    allowed_methods = ["GET", "HEAD", "OPTIONS"]
    cached_methods  = ["GET", "HEAD", "OPTIONS"]

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.spa_router.arn
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = length(local.domain_names) == 0
    acm_certificate_arn            = local.create_certificate ? aws_acm_certificate_validation.this[0].certificate_arn : null
    ssl_support_method             = local.create_certificate ? "sni-only" : null
    minimum_protocol_version       = local.create_certificate ? "TLSv1.2_2021" : "TLSv1"
  }

  tags = { Name = "${var.name_prefix}-web-cdn" }
}

# ── Route 53 alias records (conditional) ─────────────────────────────────────

resource "aws_route53_record" "www" {
  count   = local.create_certificate ? 1 : 0
  zone_id = aws_route53_zone.this[0].zone_id
  name    = "www.${var.domain_name}"
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.web.domain_name
    zone_id                = aws_cloudfront_distribution.web.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "apex" {
  count   = local.create_certificate ? 1 : 0
  zone_id = aws_route53_zone.this[0].zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.web.domain_name
    zone_id                = aws_cloudfront_distribution.web.hosted_zone_id
    evaluate_target_health = false
  }
}
