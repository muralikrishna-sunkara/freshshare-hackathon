data "aws_caller_identity" "current" {}

locals {
  name       = "${var.project}-${var.environment}"
  account_id = data.aws_caller_identity.current.account_id

  use_domain   = var.domain_name != ""
  create_cert  = var.certificate_arn == "" && var.route53_zone_id != "" && local.use_domain
  enable_https = var.certificate_arn != "" || local.create_cert

  app_url = local.use_domain ? "${local.enable_https ? "https" : "http"}://${var.domain_name}" : "http://${module.alb.dns_name}"
}

module "network" {
  source = "../../modules/network"

  name               = local.name
  region             = var.region
  cidr_block         = var.vpc_cidr
  az_count           = var.az_count
  single_nat_gateway = var.single_nat_gateway
  log_retention_days = var.log_retention_days
}

module "storage" {
  source = "../../modules/storage"

  name                 = local.name
  account_id           = local.account_id
  cors_allowed_origins = local.use_domain ? ["https://${var.domain_name}"] : ["*"]
  force_destroy        = !var.protect_data
  log_retention_days   = var.log_retention_days
}

module "alb" {
  source = "../../modules/alb"

  name                = local.name
  vpc_id              = module.network.vpc_id
  vpc_cidr_block      = module.network.vpc_cidr_block
  public_subnet_ids   = module.network.public_subnet_ids
  enable_https        = local.enable_https
  certificate_arn     = local.enable_https ? local.certificate_arn : null
  deletion_protection = var.protect_data
  access_logs_bucket  = module.storage.logs_bucket_name
}

module "ecr" {
  source = "../../modules/ecr"

  name         = local.name
  repositories = ["api", "web"]
  force_delete = !var.protect_data
}

module "ecs_cluster" {
  source = "../../modules/ecs_cluster"

  name                  = local.name
  vpc_id                = module.network.vpc_id
  private_subnet_ids    = module.network.private_subnet_ids
  alb_security_group_id = module.alb.security_group_id
  instance_type         = var.instance_type
  architecture          = var.architecture
  asg_min_size          = var.asg_min_size
  asg_max_size          = var.asg_max_size
}

module "rds" {
  source = "../../modules/rds"

  name                       = local.name
  vpc_id                     = module.network.vpc_id
  database_subnet_ids        = module.network.database_subnet_ids
  allowed_security_group_ids = { ecs = module.ecs_cluster.instance_security_group_id }
  instance_class             = var.db_instance_class
  multi_az                   = var.db_multi_az
  deletion_protection        = var.protect_data
}

module "notifications" {
  source = "../../modules/notifications"

  name             = local.name
  region           = var.region
  account_id       = local.account_id
  ops_alert_emails = var.ops_alert_emails
}
