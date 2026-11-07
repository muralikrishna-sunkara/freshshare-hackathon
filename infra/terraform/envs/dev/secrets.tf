# Runtime secrets for the API, injected into the container by ECS.
# Values live in Secrets Manager (and in the encrypted state file).

resource "random_password" "jwt" {
  length  = 48
  special = false
}

# Web push (T2.2): VAPID signing key. The api derives the public key from it; rotating it means every
# browser has to re-enable notifications, so it is generated once and kept in state.
resource "tls_private_key" "vapid" {
  algorithm   = "ECDSA"
  ecdsa_curve = "P256"
}

resource "aws_secretsmanager_secret" "app" {
  name                    = "${local.name}/app"
  description             = "FreshShare API runtime secrets"
  recovery_window_in_days = var.protect_data ? 30 : 0
}

resource "aws_secretsmanager_secret_version" "app" {
  secret_id = aws_secretsmanager_secret.app.id
  secret_string = jsonencode({
    DATABASE_URL          = "postgresql://${module.rds.username}:${module.rds.password}@${module.rds.address}:${module.rds.port}/${module.rds.database_name}?sslmode=require"
    JWT_SECRET            = random_password.jwt.result
    VAPID_PRIVATE_KEY_PEM = tls_private_key.vapid.private_key_pem_pkcs8
  })
}

# Photo autofill (K1): the Anthropic API key lives in its own secret, created by hand
# (aws secretsmanager create-secret --name freshshare-dev/ai --secret-string '{"AI_API_KEY":"sk-ant-..."}').
# Terraform only reads its ARN, so the key never sits in Terraform state or CI logs.
data "aws_secretsmanager_secret" "ai" {
  count = var.photo_autofill_secret_name != "" ? 1 : 0
  name  = var.photo_autofill_secret_name
}

locals {
  ai_secret_arns = [for s in data.aws_secretsmanager_secret.ai : s.arn]
}
