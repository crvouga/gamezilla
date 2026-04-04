output "bucket_name" {
  description = "S3 bucket name for static web assets"
  value       = aws_s3_bucket.web.bucket
}

output "distribution_id" {
  description = "CloudFront distribution ID"
  value       = aws_cloudfront_distribution.web.id
}

output "distribution_domain_name" {
  description = "CloudFront distribution domain name"
  value       = aws_cloudfront_distribution.web.domain_name
}

output "url" {
  description = "Web app URL"
  value       = "https://${aws_cloudfront_distribution.web.domain_name}"
}

output "hosted_zone_nameservers" {
  description = "Route 53 hosted zone nameservers (empty when custom_domain is false)"
  value       = local.create_hosted_zone ? aws_route53_zone.this[0].name_servers : []
}
