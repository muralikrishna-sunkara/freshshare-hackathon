variable "name" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "vpc_cidr_block" {
  type = string
}

variable "public_subnet_ids" {
  type = list(string)
}

variable "enable_https" {
  description = "Create an HTTPS listener and redirect HTTP to it. Requires certificate_arn."
  type        = bool
  default     = false
}

variable "certificate_arn" {
  description = "ACM certificate for the HTTPS listener."
  type        = string
  default     = null
}

variable "deletion_protection" {
  type    = bool
  default = false
}

variable "access_logs_bucket" {
  description = "S3 bucket for ALB access logs. Null disables them."
  type        = string
  default     = null
}
