variable "name" {
  type = string
}

variable "account_id" {
  description = "Appended to bucket names to keep them globally unique."
  type        = string
}

variable "enable_cdn" {
  description = "Serve images through CloudFront (recommended)."
  type        = bool
  default     = true
}

variable "cors_allowed_origins" {
  type    = list(string)
  default = ["*"]
}

variable "force_destroy" {
  description = "Allow terraform destroy to empty and delete buckets."
  type        = bool
  default     = false
}

variable "log_retention_days" {
  type    = number
  default = 30
}
