output "service_name" {
  description = "ECS service name"
  value       = aws_ecs_service.req_res.name
}

output "alb_dns_name" {
  description = "ALB DNS name"
  value       = aws_lb.alb.dns_name
}

output "distribution_domain_name" {
  description = "CloudFront distribution domain name"
  value       = aws_cloudfront_distribution.api.domain_name
}

output "distribution_id" {
  description = "CloudFront distribution ID"
  value       = aws_cloudfront_distribution.api.id
}

output "url" {
  description = "HTTPS URL for the req-res API"
  value       = "https://${aws_cloudfront_distribution.api.domain_name}"
}
