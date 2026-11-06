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

variable "github_owner_id" {
  description = "Numeric GitHub user/org ID of the repo owner, for GitHub's immutable OIDC subject format (repo:owner@id/name@id:...). Empty = classic format only."
  type        = string
  default     = "50740270"
}

variable "github_repository_id" {
  description = "Numeric GitHub repository ID, for the immutable OIDC subject format."
  type        = string
  default     = "1441757152"
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
