data "aws_iam_policy_document" "ecs_tasks_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [local.account_id]
    }
  }
}

# ---------- Execution role: used by the ECS agent (pull image, logs, secrets) ----------

resource "aws_iam_role" "execution" {
  name               = "${local.name}-ecs-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json
}

resource "aws_iam_role_policy_attachment" "execution" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

data "aws_iam_policy_document" "execution_secrets" {
  statement {
    actions   = ["secretsmanager:GetSecretValue"]
    resources = concat([aws_secretsmanager_secret.app.arn], local.ai_secret_arns)
  }
}

resource "aws_iam_role_policy" "execution_secrets" {
  name   = "read-app-secrets"
  role   = aws_iam_role.execution.id
  policy = data.aws_iam_policy_document.execution_secrets.json
}

# ---------- API task role: what the app code itself may do ----------

resource "aws_iam_role" "api_task" {
  name               = "${local.name}-api-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json
}

data "aws_iam_policy_document" "api_task" {
  statement {
    sid       = "FoodImages"
    actions   = ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"]
    resources = ["${module.storage.images_bucket_arn}/*"]
  }

  statement {
    sid       = "ListImages"
    actions   = ["s3:ListBucket"]
    resources = [module.storage.images_bucket_arn]
  }

  statement {
    sid       = "AppNotifications"
    actions   = ["sns:Publish"]
    resources = [module.notifications.app_topic_arn]
  }

  # Direct SMS / email-to-phone via SNS for claim notifications
  statement {
    sid       = "SmsNotifications"
    actions   = ["sns:Publish"]
    resources = ["*"]
    condition {
      test     = "Null"
      variable = "sns:Protocol"
      values   = ["true"]
    }
  }

  # ECS Exec (aws ecs execute-command) for debugging
  statement {
    sid = "EcsExec"
    actions = [
      "ssmmessages:CreateControlChannel",
      "ssmmessages:CreateDataChannel",
      "ssmmessages:OpenControlChannel",
      "ssmmessages:OpenDataChannel",
    ]
    resources = ["*"]
  }

  # Notification emails, only from our own domain identity and only as notifications@<domain>
  dynamic "statement" {
    for_each = local.email_enabled ? [1] : []
    content {
      sid     = "SendNotificationEmail"
      actions = ["ses:SendEmail", "ses:SendRawEmail"]
      resources = concat(
        [aws_sesv2_email_identity.domain[0].arn, aws_sesv2_configuration_set.app[0].arn],
        [for r in aws_sesv2_email_identity.sandbox_recipient : r.arn],
      )
      condition {
        test     = "StringEquals"
        variable = "ses:FromAddress"
        values   = ["notifications@${var.domain_name}"]
      }
    }
  }
}

resource "aws_iam_role_policy" "api_task" {
  name   = "api"
  role   = aws_iam_role.api_task.id
  policy = data.aws_iam_policy_document.api_task.json
}

# ---------- Web task role: static site, only needs ECS Exec ----------

resource "aws_iam_role" "web_task" {
  name               = "${local.name}-web-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json
}

data "aws_iam_policy_document" "web_task" {
  statement {
    sid = "EcsExec"
    actions = [
      "ssmmessages:CreateControlChannel",
      "ssmmessages:CreateDataChannel",
      "ssmmessages:OpenControlChannel",
      "ssmmessages:OpenDataChannel",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "web_task" {
  name   = "web"
  role   = aws_iam_role.web_task.id
  policy = data.aws_iam_policy_document.web_task.json
}
