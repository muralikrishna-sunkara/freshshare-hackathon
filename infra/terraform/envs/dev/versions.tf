terraform {
  required_version = ">= 1.10.0" # S3 native state locking (use_lockfile)

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.80"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
  }

  # Partial config: bucket/region come from backend.hcl (see backend.hcl.example),
  # written by `make bootstrap` locally or by the workflow in CI.
  backend "s3" {
    key          = "freshshare/dev/terraform.tfstate"
    encrypt      = true
    use_lockfile = true
  }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project     = var.project
      Environment = var.environment
      ManagedBy   = "terraform"
      Repository  = "muralikrishna-sunkara/freshshare-hackathon"
    }
  }
}

# CloudFront/ACM certificates for CloudFront must live in us-east-1 (kept for later use)
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}
