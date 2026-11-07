# ---------- Amazon SES: notification emails from notifications@<domain_name> ----------
#
# Domain identity with Easy DKIM, a custom MAIL FROM (mail.<domain>) for SPF alignment and a
# monitoring-only DMARC record, all published in the Route 53 zone. New SES accounts start in the
# sandbox (they can only send to verified addresses); list test inboxes in ses_sandbox_recipients,
# and request production access once to email everyone (see infra/README.md).

locals {
  email_enabled = local.use_domain && var.route53_zone_id != ""
  email_from    = local.email_enabled ? "FreshShare <notifications@${var.domain_name}>" : ""
}

resource "aws_sesv2_configuration_set" "app" {
  count                  = local.email_enabled ? 1 : 0
  configuration_set_name = "${local.name}-app"

  reputation_options {
    reputation_metrics_enabled = true
  }

  # Never retry addresses that bounced or complained (protects the sending reputation).
  suppression_options {
    suppressed_reasons = ["BOUNCE", "COMPLAINT"]
  }
}

resource "aws_sesv2_email_identity" "domain" {
  count                  = local.email_enabled ? 1 : 0
  email_identity         = var.domain_name
  configuration_set_name = aws_sesv2_configuration_set.app[0].configuration_set_name
}

# Easy DKIM publishes exactly three CNAME tokens.
resource "aws_route53_record" "ses_dkim" {
  count   = local.email_enabled ? 3 : 0
  zone_id = var.route53_zone_id
  name    = "${aws_sesv2_email_identity.domain[0].dkim_signing_attributes[0].tokens[count.index]}._domainkey.${var.domain_name}"
  type    = "CNAME"
  ttl     = 1800
  records = ["${aws_sesv2_email_identity.domain[0].dkim_signing_attributes[0].tokens[count.index]}.dkim.amazonses.com"]
}

resource "aws_sesv2_email_identity_mail_from_attributes" "domain" {
  count                  = local.email_enabled ? 1 : 0
  email_identity         = aws_sesv2_email_identity.domain[0].email_identity
  mail_from_domain       = "mail.${var.domain_name}"
  behavior_on_mx_failure = "USE_DEFAULT_VALUE"
}

resource "aws_route53_record" "ses_mail_from_mx" {
  count   = local.email_enabled ? 1 : 0
  zone_id = var.route53_zone_id
  name    = "mail.${var.domain_name}"
  type    = "MX"
  ttl     = 1800
  records = ["10 feedback-smtp.${var.region}.amazonses.com"]
}

resource "aws_route53_record" "ses_mail_from_spf" {
  count   = local.email_enabled ? 1 : 0
  zone_id = var.route53_zone_id
  name    = "mail.${var.domain_name}"
  type    = "TXT"
  ttl     = 1800
  records = ["v=spf1 include:amazonses.com ~all"]
}

resource "aws_route53_record" "dmarc" {
  count   = local.email_enabled ? 1 : 0
  zone_id = var.route53_zone_id
  name    = "_dmarc.${var.domain_name}"
  type    = "TXT"
  ttl     = 1800
  records = ["v=DMARC1; p=none; adkim=r; aspf=r"]
}

# Sandbox only: each address gets a verification email from AWS and can then receive app emails.
resource "aws_sesv2_email_identity" "sandbox_recipient" {
  for_each       = local.email_enabled ? toset(var.ses_sandbox_recipients) : toset([])
  email_identity = each.value
}
