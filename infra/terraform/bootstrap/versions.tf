# One-time bootstrap, run locally with admin credentials:
#   terraform init && terraform apply
# Creates the remote state bucket and the GitHub Actions OIDC roles.
# Its own state stays local (commit nothing from .terraform/ or *.tfstate);
# keep terraform.tfstate somewhere safe or import later if needed.

terraform {
  required_version = ">= 1.10.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.80"
    }
  }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project   = var.project
      ManagedBy = "terraform-bootstrap"
    }
  }
}
