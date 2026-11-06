variable "name" {
  type = string
}

variable "region" {
  type = string
}

variable "alarm_topic_arn" {
  type = string
}

variable "alb_arn_suffix" {
  type = string
}

variable "target_group_arn_suffixes" {
  description = "Service name => target group ARN suffix."
  type        = map(string)
}

variable "ecs_cluster_name" {
  type = string
}

variable "ecs_service_names" {
  type = list(string)
}

variable "asg_name" {
  type = string
}

variable "rds_identifier" {
  type = string
}

variable "rds_max_connections_alarm" {
  description = "db.t4g.micro allows ~80 connections; alarm before that."
  type        = number
  default     = 60
}
