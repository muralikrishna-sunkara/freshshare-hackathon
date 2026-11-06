output "service_name" {
  value = aws_ecs_service.this.name
}

output "task_definition_family" {
  value = aws_ecs_task_definition.this.family
}

output "task_definition_arn" {
  value = aws_ecs_task_definition.this.arn
}

output "target_group_arn_suffix" {
  value = aws_lb_target_group.this.arn_suffix
}

output "log_group_name" {
  value = aws_cloudwatch_log_group.this.name
}
output "container_definitions" {
  description = "Rendered container definitions (used by tests)."
  value       = aws_ecs_task_definition.this.container_definitions
}
