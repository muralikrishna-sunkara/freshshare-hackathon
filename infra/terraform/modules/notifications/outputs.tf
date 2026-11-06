output "ops_topic_arn" {
  value = aws_sns_topic.this["ops"].arn
}

output "app_topic_arn" {
  value = aws_sns_topic.this["app"].arn
}
