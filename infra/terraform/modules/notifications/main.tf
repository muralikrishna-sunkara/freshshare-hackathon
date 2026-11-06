data "aws_iam_policy_document" "topic" {
  for_each = local.topics

  statement {
    sid       = "AllowAccountPublish"
    actions   = ["sns:Publish"]
    resources = ["arn:aws:sns:${var.region}:${var.account_id}:${each.value}"]
    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::${var.account_id}:root"]
    }
  }

  # CloudWatch alarms publish to the ops topic
  statement {
    sid       = "AllowCloudWatchAlarms"
    actions   = ["sns:Publish"]
    resources = ["arn:aws:sns:${var.region}:${var.account_id}:${each.value}"]
    principals {
      type        = "Service"
      identifiers = ["cloudwatch.amazonaws.com"]
    }
    condition {
      test     = "ArnLike"
      variable = "aws:SourceArn"
      values   = ["arn:aws:cloudwatch:${var.region}:${var.account_id}:alarm:*"]
    }
  }
}

locals {
  topics = {
    ops = "${var.name}-ops-alerts"        # infrastructure alarms -> on-call email
    app = "${var.name}-app-notifications" # app events: new listing near you, claim confirmed, ...
  }
}

resource "aws_sns_topic" "this" {
  for_each = local.topics
  name     = each.value
  # The AWS-managed SNS key cannot be used by CloudWatch alarms, so only the
  # app topic is encrypted. Switch to a customer-managed key if needed.
  kms_master_key_id = each.key == "app" ? "alias/aws/sns" : null
  policy            = data.aws_iam_policy_document.topic[each.key].json
}

resource "aws_sns_topic_subscription" "ops_email" {
  for_each  = toset(var.ops_alert_emails)
  topic_arn = aws_sns_topic.this["ops"].arn
  protocol  = "email"
  endpoint  = each.value
}
