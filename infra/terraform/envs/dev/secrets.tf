# Runtime secrets for the API, injected into the container by ECS.
# Values live in Secrets Manager (and in the encrypted state file).

resource "random_password" "jwt" {
  length  = 48
  special = false
}

resource "aws_secretsmanager_secret" "app" {
  name                    = "${local.name}/app"
  description             = "FreshShare API runtime secrets"
  recovery_window_in_days = var.protect_data ? 30 : 0
}

resource "aws_secretsmanager_secret_version" "app" {
  secret_id = aws_secretsmanager_secret.app.id
  secret_string = jsonencode({
    DATABASE_URL = "postgresql://${module.rds.username}:${module.rds.password}@${module.rds.address}:${module.rds.port}/${module.rds.database_name}?sslmode=require"
    JWT_SECRET   = random_password.jwt.result
  })
}
