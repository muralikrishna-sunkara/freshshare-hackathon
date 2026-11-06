variable "name" {
  description = "Service and container name, e.g. api or web."
  type        = string
}

variable "cluster_name" {
  type = string
}

variable "cluster_arn" {
  type = string
}

variable "capacity_provider_name" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "listener_arn" {
  type = string
}

variable "listener_rule_priority" {
  description = "Lower number = evaluated first. Put specific paths (/api/*) before the catch-all."
  type        = number
}

variable "path_patterns" {
  type = list(string)
}

variable "host_headers" {
  description = "Optional host header match (e.g. the app domain)."
  type        = list(string)
  default     = []
}

variable "image" {
  description = "Initial image. CI replaces it on every deploy."
  type        = string
}

variable "architecture" {
  type    = string
  default = "x86_64"
}

variable "command" {
  type    = list(string)
  default = null
}

variable "container_port" {
  type = number
}

variable "cpu" {
  description = "CPU units reserved for the container (1024 = 1 vCPU)."
  type        = number
  default     = 256
}

variable "memory" {
  description = "Hard memory limit in MiB."
  type        = number
  default     = 512
}

variable "memory_reservation" {
  description = "Soft memory reservation in MiB used for placement."
  type        = number
  default     = 256
}

variable "environment" {
  description = "Plain environment variables."
  type        = map(string)
  default     = {}
}

variable "secrets" {
  description = "Env var name => Secrets Manager / SSM ARN (JSON key suffix allowed)."
  type        = map(string)
  default     = {}
}

variable "execution_role_arn" {
  type = string
}

variable "task_role_arn" {
  type = string
}

variable "health_check_path" {
  type    = string
  default = "/"
}

variable "health_check_grace_period" {
  type    = number
  default = 60
}

variable "desired_count" {
  type    = number
  default = 1
}

variable "min_count" {
  type    = number
  default = 1
}

variable "max_count" {
  type    = number
  default = 4
}

variable "cpu_target" {
  type    = number
  default = 60
}

variable "memory_target" {
  type    = number
  default = 75
}

variable "enable_execute_command" {
  description = "Allow `aws ecs execute-command` into running containers."
  type        = bool
  default     = true
}

variable "log_retention_days" {
  type    = number
  default = 30
}
