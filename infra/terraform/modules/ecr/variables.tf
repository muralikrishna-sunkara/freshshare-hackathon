variable "name" {
  description = "Repository name prefix, e.g. freshshare-dev."
  type        = string
}

variable "repositories" {
  description = "Repository suffixes to create (one per container image)."
  type        = list(string)
  default     = ["api", "web"]
}

variable "keep_images" {
  description = "How many images to keep per repository (rollback window)."
  type        = number
  default     = 30
}

variable "force_delete" {
  description = "Allow terraform destroy to delete repositories that still contain images."
  type        = bool
  default     = false
}
