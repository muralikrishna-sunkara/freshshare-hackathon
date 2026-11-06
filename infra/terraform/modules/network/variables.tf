variable "name" {
  description = "Name prefix for all network resources."
  type        = string
}

variable "region" {
  description = "AWS region (used for the S3 gateway endpoint service name)."
  type        = string
}

variable "cidr_block" {
  description = "VPC CIDR. Subnets are carved as /24s from it."
  type        = string
  default     = "10.20.0.0/16"
}

variable "az_count" {
  description = "Number of availability zones to spread subnets across (ALB and RDS need at least 2)."
  type        = number
  default     = 2

  validation {
    condition     = var.az_count >= 2 && var.az_count <= 3
    error_message = "az_count must be 2 or 3."
  }
}

variable "single_nat_gateway" {
  description = "Use one NAT gateway for all AZs (cheaper, not AZ-resilient)."
  type        = bool
  default     = true
}

variable "enable_flow_logs" {
  description = "Ship rejected VPC traffic to CloudWatch Logs."
  type        = bool
  default     = true
}

variable "log_retention_days" {
  type    = number
  default = 30
}
