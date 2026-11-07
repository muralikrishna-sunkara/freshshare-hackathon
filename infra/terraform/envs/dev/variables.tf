variable "project" {
  type    = string
  default = "freshshare"
}

variable "environment" {
  type    = string
  default = "dev"
}

variable "region" {
  description = "Frankfurt is closest to the Erlangen pilot area."
  type        = string
  default     = "eu-central-1"
}

# ---------- Network ----------

variable "vpc_cidr" {
  type    = string
  default = "10.20.0.0/16"
}

variable "az_count" {
  type    = number
  default = 2
}

variable "single_nat_gateway" {
  type    = bool
  default = true
}

# ---------- DNS / TLS (optional) ----------

variable "domain_name" {
  description = "App hostname, e.g. app.dev.freshshare.food. Empty = use the ALB DNS name over HTTP."
  type        = string
  default     = ""
}

variable "route53_zone_id" {
  description = "Hosted zone for domain_name. When set, an ACM cert is issued and validated and an alias record is created."
  type        = string
  default     = ""
}

variable "certificate_arn" {
  description = "Bring-your-own ACM certificate (e.g. DNS hosted outside Route 53). Takes precedence over route53_zone_id."
  type        = string
  default     = ""
}

# ---------- Compute ----------

variable "instance_type" {
  type    = string
  default = "t3.small"
}

variable "architecture" {
  type    = string
  default = "x86_64"
}

variable "asg_min_size" {
  type    = number
  default = 1
}

variable "asg_max_size" {
  type    = number
  default = 3
}

variable "api_image" {
  description = "API image URI. Null = hello-world placeholder (nginx). CI sets real images on deploy."
  type        = string
  default     = null
}

variable "web_image" {
  description = "Web image URI. Null = hello-world placeholder (nginx)."
  type        = string
  default     = null
}

variable "api_desired_count" {
  type    = number
  default = 1
}

variable "web_desired_count" {
  type    = number
  default = 1
}

# ---------- Database ----------

variable "db_instance_class" {
  type    = string
  default = "db.t4g.micro"
}

variable "db_multi_az" {
  type    = bool
  default = false
}

# ---------- Ops ----------

variable "ops_alert_emails" {
  description = "Emails for CloudWatch alarm notifications."
  type        = list(string)
  default     = []
}

variable "log_retention_days" {
  type    = number
  default = 30
}

variable "protect_data" {
  description = "Deletion protection on RDS / ALB and no force-destroy on buckets. Set true once real users exist."
  type        = bool
  default     = false
}

# ---------- Email (SES) ----------

variable "ses_sandbox_recipients" {
  description = "While the SES account is in the sandbox, it can only email verified addresses. List test inboxes here; AWS sends each a verification link."
  type        = list(string)
  default     = []
}

# ---------- Photo autofill (K1) ----------

variable "photo_autofill_secret_name" {
  description = "Existing Secrets Manager secret holding {\"AI_API_KEY\":\"sk-ant-...\"} for photo autofill. Created by hand so the key never passes through Terraform or CI. Empty string = feature off."
  type        = string
  default     = "freshshare-dev/ai"
}
