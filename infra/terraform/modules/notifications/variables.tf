variable "name" {
  type = string
}

variable "region" {
  type = string
}

variable "account_id" {
  type = string
}

variable "ops_alert_emails" {
  description = "Emails subscribed to infrastructure alarms (each must confirm the subscription)."
  type        = list(string)
  default     = []
}
