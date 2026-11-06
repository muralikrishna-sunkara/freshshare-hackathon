variable "project" {
  type    = string
  default = "freshshare"
}

variable "region" {
  type    = string
  default = "eu-central-1"
}

variable "github_repository" {
  description = "owner/repo allowed to assume the CI roles."
  type        = string
  default     = "muralikrishna-sunkara/freshshare-hackathon"
}

variable "github_environments" {
  description = "GitHub environments allowed to run terraform apply (protect them with required reviewers / branch rules)."
  type        = list(string)
  default     = ["dev"]
}

variable "create_oidc_provider" {
  description = "Set false if the account already has the token.actions.githubusercontent.com provider."
  type        = bool
  default     = true
}
