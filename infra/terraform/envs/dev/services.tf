# Two ECS services behind one ALB:
#   /api/*  -> api  (Express, port 4000)
#   /*      -> web  (static SPA, port 80)
#
# Until the app exists, both run a hello-world nginx container so the whole
# path (ALB -> target groups -> ECS on EC2/ASG) can be verified end to end.

locals {
  hello_image = "public.ecr.aws/nginx/nginx:1.27-alpine"

  api_hello = var.api_image == null
  web_hello = var.web_image == null

  # nginx config written at container start; no image build needed
  hello_web_cmd = [
    "sh", "-c",
    <<-EOT
    cat > /usr/share/nginx/html/index.html <<'HTML'
    <!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>FreshShare</title><style>body{font-family:system-ui;margin:0;display:grid;place-items:center;min-height:100vh;background:#f4f8f2;color:#2d3b29}
    h1{color:#6b9f5e}span{color:#e89344}</style></head><body><main><h1>Hello from <span>FreshShare</span></h1>
    <p>Infrastructure is up: ALB &rarr; ECS on EC2 (ASG) &rarr; this container.</p><p>API check: <a href="/api/health">/api/health</a></p></main></body></html>
    HTML
    exec nginx -g 'daemon off;'
    EOT
  ]

  hello_api_cmd = [
    "sh", "-c",
    <<-EOT
    cat > /etc/nginx/conf.d/default.conf <<'CONF'
    server {
      listen 4000;
      default_type application/json;
      location = /api/health { return 200 '{"status":"ok","service":"api","mode":"hello-world"}'; }
      location /api/ { return 200 '{"message":"Hello from the FreshShare API placeholder"}'; }
      location / { return 404 '{"error":{"code":"not_found","message":"Not found"}}'; }
    }
    CONF
    exec nginx -g 'daemon off;'
    EOT
  ]

  host_headers = local.use_domain ? [var.domain_name] : []
}

module "api" {
  source = "../../modules/ecs_service"

  name                   = "api"
  cluster_name           = module.ecs_cluster.cluster_name
  cluster_arn            = module.ecs_cluster.cluster_arn
  capacity_provider_name = module.ecs_cluster.capacity_provider_name
  vpc_id                 = module.network.vpc_id
  architecture           = var.architecture

  listener_arn           = module.alb.listener_arn
  listener_rule_priority = 10
  path_patterns          = ["/api/*"]
  host_headers           = local.host_headers

  image             = local.api_hello ? local.hello_image : var.api_image
  command           = local.api_hello ? local.hello_api_cmd : null
  container_port    = 4000 # hello-world listens on 4000 too, so CI can swap images without touching the ALB wiring
  health_check_path = "/api/health"
  cpu               = 256
  memory            = 512

  environment = {
    NODE_ENV              = "production"
    PORT                  = "4000"
    APP_URL               = local.app_url
    S3_BUCKET             = module.storage.images_bucket_name
    PUBLIC_IMAGE_BASE_URL = coalesce(module.storage.images_base_url, "")
    SNS_NOTIFICATIONS_ARN = module.notifications.app_topic_arn
    STORAGE_DRIVER        = "s3"
    EMAIL_TRANSPORT       = local.email_enabled ? "ses" : "log"
    EMAIL_FROM            = local.email_from
  }

  secrets = {
    DATABASE_URL = "${aws_secretsmanager_secret.app.arn}:DATABASE_URL::"
    JWT_SECRET   = "${aws_secretsmanager_secret.app.arn}:JWT_SECRET::"
  }

  execution_role_arn = aws_iam_role.execution.arn
  task_role_arn      = aws_iam_role.api_task.arn

  desired_count      = var.api_desired_count
  min_count          = var.api_desired_count
  max_count          = 4
  log_retention_days = var.log_retention_days

  depends_on = [aws_secretsmanager_secret_version.app, aws_iam_role_policy.execution_secrets]
}

module "web" {
  source = "../../modules/ecs_service"

  name                   = "web"
  cluster_name           = module.ecs_cluster.cluster_name
  cluster_arn            = module.ecs_cluster.cluster_arn
  capacity_provider_name = module.ecs_cluster.capacity_provider_name
  vpc_id                 = module.network.vpc_id
  architecture           = var.architecture

  listener_arn           = module.alb.listener_arn
  listener_rule_priority = 100
  path_patterns          = ["/*"]
  host_headers           = local.host_headers

  image             = local.web_hello ? local.hello_image : var.web_image
  command           = local.web_hello ? local.hello_web_cmd : null
  container_port    = 80
  health_check_path = "/"
  cpu               = 128
  memory            = 256

  environment = {
    APP_DOMAIN = ":80" # Caddy: plain HTTP behind the ALB, TLS ends at the ALB
  }

  execution_role_arn = aws_iam_role.execution.arn
  task_role_arn      = aws_iam_role.web_task.arn

  desired_count      = var.web_desired_count
  min_count          = var.web_desired_count
  max_count          = 4
  log_retention_days = var.log_retention_days
}

module "monitoring" {
  source = "../../modules/monitoring"

  name            = local.name
  region          = var.region
  alarm_topic_arn = module.notifications.ops_topic_arn
  alb_arn_suffix  = module.alb.alb_arn_suffix
  target_group_arn_suffixes = {
    api = module.api.target_group_arn_suffix
    web = module.web.target_group_arn_suffix
  }
  ecs_cluster_name  = module.ecs_cluster.cluster_name
  ecs_service_names = [module.api.service_name, module.web.service_name]
  asg_name          = module.ecs_cluster.autoscaling_group_name
  rds_identifier    = module.rds.identifier
}
