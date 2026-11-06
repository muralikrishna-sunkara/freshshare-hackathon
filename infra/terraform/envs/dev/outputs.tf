output "app_url" {
  description = "Open this to see the hello-world page."
  value       = local.app_url
}

output "alb_dns_name" {
  value = module.alb.dns_name
}

output "ecs_cluster_name" {
  value = module.ecs_cluster.cluster_name
}

output "ecs_services" {
  value = {
    api = { service = module.api.service_name, task_family = module.api.task_definition_family, log_group = module.api.log_group_name }
    web = { service = module.web.service_name, task_family = module.web.task_definition_family, log_group = module.web.log_group_name }
  }
}

output "ecr_repositories" {
  value = module.ecr.repository_urls
}

output "images_bucket" {
  value = module.storage.images_bucket_name
}

output "images_base_url" {
  value = module.storage.images_base_url
}

output "sns_topics" {
  value = {
    ops = module.notifications.ops_topic_arn
    app = module.notifications.app_topic_arn
  }
}

output "rds_endpoint" {
  value = "${module.rds.address}:${module.rds.port}"
}

output "app_secret_arn" {
  value = aws_secretsmanager_secret.app.arn
}

output "cloudwatch_dashboard" {
  value = "https://${var.region}.console.aws.amazon.com/cloudwatch/home?region=${var.region}#dashboards:name=${module.monitoring.dashboard_name}"
}
