output "cluster_name" {
  value = aws_ecs_cluster.this.name
}

output "cluster_arn" {
  value = aws_ecs_cluster.this.arn
}

output "capacity_provider_name" {
  value = aws_ecs_capacity_provider.this.name
}

output "instance_security_group_id" {
  value = aws_security_group.instances.id
}

output "autoscaling_group_name" {
  value = aws_autoscaling_group.this.name
}
