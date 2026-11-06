output "images_bucket_name" {
  value = aws_s3_bucket.images.bucket
}

output "images_bucket_arn" {
  value = aws_s3_bucket.images.arn
}

output "images_base_url" {
  description = "Public base URL for image objects (CloudFront when enabled)."
  value       = var.enable_cdn ? "https://${aws_cloudfront_distribution.images[0].domain_name}" : null
}

output "cdn_distribution_id" {
  value = var.enable_cdn ? aws_cloudfront_distribution.images[0].id : null
}

output "logs_bucket_name" {
  value = aws_s3_bucket.logs.bucket
}
