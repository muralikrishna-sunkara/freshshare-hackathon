variable "name" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "alb_security_group_id" {
  type = string
}

variable "instance_type" {
  description = "EC2 type for container instances."
  type        = string
  default     = "t3.small"
}

variable "architecture" {
  description = "x86_64 or arm64. Must match instance_type and the images CI builds."
  type        = string
  default     = "x86_64"

  validation {
    condition     = contains(["x86_64", "arm64"], var.architecture)
    error_message = "architecture must be x86_64 or arm64."
  }
}

variable "asg_min_size" {
  type    = number
  default = 1
}

variable "asg_max_size" {
  type    = number
  default = 4
}

variable "target_capacity" {
  description = "Capacity provider target utilisation in percent (100 = pack tightly)."
  type        = number
  default     = 100
}

variable "root_volume_size" {
  type    = number
  default = 30
}

variable "container_insights" {
  type    = bool
  default = true
}
