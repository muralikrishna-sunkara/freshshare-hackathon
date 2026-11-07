# Offline tests: no AWS credentials needed (mocked providers).
#   terraform init -backend=false && terraform test

mock_provider "aws" {
  mock_data "aws_caller_identity" {
    defaults = { account_id = "123456789012" }
  }
  mock_data "aws_availability_zones" {
    defaults = { names = ["eu-central-1a", "eu-central-1b", "eu-central-1c"] }
  }
  mock_data "aws_region" {
    defaults = { name = "eu-central-1" }
  }
  mock_data "aws_iam_policy_document" {
    defaults = { json = "{\"Version\":\"2012-10-17\",\"Statement\":[]}" }
  }
  mock_data "aws_ssm_parameter" {
    defaults = { value = "ami-0123456789abcdef0" }
  }
  mock_resource "aws_secretsmanager_secret" {
    defaults = { arn = "arn:aws:secretsmanager:eu-central-1:123456789012:secret:freshshare-dev/app-AbCdEf" }
  }
  mock_resource "aws_lb_listener" {
    defaults = { arn = "arn:aws:elasticloadbalancing:eu-central-1:123456789012:listener/app/freshshare-dev/abc/def" }
  }
  mock_resource "aws_lb" {
    defaults = {
      arn        = "arn:aws:elasticloadbalancing:eu-central-1:123456789012:loadbalancer/app/freshshare-dev/abc"
      arn_suffix = "app/freshshare-dev/abc"
      dns_name   = "freshshare-dev-123.eu-central-1.elb.amazonaws.com"
    }
  }
  mock_resource "aws_lb_target_group" {
    defaults = {
      arn        = "arn:aws:elasticloadbalancing:eu-central-1:123456789012:targetgroup/tg/abc"
      arn_suffix = "targetgroup/tg/abc"
    }
  }
  mock_resource "aws_sesv2_email_identity" {
    defaults = {
      arn                     = "arn:aws:ses:eu-central-1:123456789012:identity/freshshare.de"
      dkim_signing_attributes = [{ tokens = ["tok1", "tok2", "tok3"] }]
    }
  }
  mock_resource "aws_sesv2_configuration_set" {
    defaults = { arn = "arn:aws:ses:eu-central-1:123456789012:configuration-set/freshshare-dev-app" }
  }
  mock_resource "aws_iam_role" {
    defaults = { arn = "arn:aws:iam::123456789012:role/mock" }
  }
  mock_resource "aws_iam_instance_profile" {
    defaults = { arn = "arn:aws:iam::123456789012:instance-profile/mock" }
  }
  mock_resource "aws_sns_topic" {
    defaults = { arn = "arn:aws:sns:eu-central-1:123456789012:mock" }
  }
  mock_resource "aws_ecs_cluster" {
    defaults = { arn = "arn:aws:ecs:eu-central-1:123456789012:cluster/freshshare-dev" }
  }
  mock_resource "aws_autoscaling_group" {
    defaults = { arn = "arn:aws:autoscaling:eu-central-1:123456789012:autoScalingGroup:abc:autoScalingGroupName/mock" }
  }
  mock_resource "aws_ecs_task_definition" {
    defaults = { arn = "arn:aws:ecs:eu-central-1:123456789012:task-definition/mock:1" }
  }
  mock_resource "aws_s3_bucket" {
    defaults = { arn = "arn:aws:s3:::mock-bucket", bucket_regional_domain_name = "mock-bucket.s3.eu-central-1.amazonaws.com" }
  }
  mock_resource "aws_cloudfront_distribution" {
    defaults = { arn = "arn:aws:cloudfront::123456789012:distribution/MOCK", domain_name = "d111111abcdef8.cloudfront.net" }
  }
  mock_resource "aws_cloudwatch_log_group" {
    defaults = { arn = "arn:aws:logs:eu-central-1:123456789012:log-group:mock" }
  }
  mock_resource "aws_launch_template" {
    defaults = { id = "lt-0123456789abcdef0", latest_version = 1 }
  }
  mock_data "aws_elb_service_account" {
    defaults = { arn = "arn:aws:iam::054676820928:root" }
  }
}

mock_provider "aws" {
  alias = "us_east_1"
}

mock_provider "random" {}

run "hello_world_defaults" {
  command = apply # mocked providers: nothing is created in AWS

  assert {
    condition     = module.api.task_definition_family == "freshshare-dev-api"
    error_message = "unexpected api task family"
  }

  assert {
    condition     = strcontains(jsondecode(module.api.container_definitions)[0].image, "nginx")
    error_message = "api should run the hello-world nginx image by default"
  }

  assert {
    condition     = jsondecode(module.api.container_definitions)[0].portMappings[0].containerPort == 4000
    error_message = "hello-world api listens on 4000 like the real API"
  }

  assert {
    condition     = !module.alb.https_enabled
    error_message = "HTTPS should be off without a domain"
  }
}

run "real_images_and_byo_certificate" {
  command = apply # mocked providers: nothing is created in AWS

  variables {
    api_image       = "123456789012.dkr.ecr.eu-central-1.amazonaws.com/freshshare-dev/api:abc123"
    web_image       = "123456789012.dkr.ecr.eu-central-1.amazonaws.com/freshshare-dev/web:abc123"
    domain_name     = "app.dev.freshshare.food"
    certificate_arn = "arn:aws:acm:eu-central-1:123456789012:certificate/11111111-2222-3333-4444-555555555555"
  }

  assert {
    condition     = jsondecode(module.api.container_definitions)[0].portMappings[0].containerPort == 4000
    error_message = "real api listens on 4000"
  }

  assert {
    condition     = module.alb.https_enabled
    error_message = "HTTPS should be on with a certificate"
  }

  assert {
    condition     = output.app_url == "https://app.dev.freshshare.food"
    error_message = "app_url should use the domain over HTTPS"
  }
}

run "notification_email_via_ses" {
  command = apply # mocked providers: nothing is created in AWS

  variables {
    api_image              = "123456789012.dkr.ecr.eu-central-1.amazonaws.com/freshshare-dev/api:abc123"
    web_image              = "123456789012.dkr.ecr.eu-central-1.amazonaws.com/freshshare-dev/web:abc123"
    domain_name            = "freshshare.de"
    route53_zone_id        = "Z0000000000000000000"
    ses_sandbox_recipients = ["tester@example.com"]
  }

  assert {
    condition     = length(aws_route53_record.ses_dkim) == 3 && aws_route53_record.ses_dkim[0].records == toset(["tok1.dkim.amazonses.com"])
    error_message = "three Easy DKIM CNAMEs should be published"
  }

  assert {
    condition     = aws_sesv2_email_identity_mail_from_attributes.domain[0].mail_from_domain == "mail.freshshare.de"
    error_message = "custom MAIL FROM should be mail.<domain>"
  }

  assert {
    condition     = contains([for e in jsondecode(module.api.container_definitions)[0].environment : "${e.name}=${e.value}"], "EMAIL_TRANSPORT=ses")
    error_message = "api should send email through SES when a domain and zone are set"
  }

  assert {
    condition     = contains([for e in jsondecode(module.api.container_definitions)[0].environment : "${e.name}=${e.value}"], "EMAIL_FROM=FreshShare <notifications@freshshare.de>")
    error_message = "api should send from notifications@<domain>"
  }

  assert {
    condition     = length(aws_sesv2_email_identity.sandbox_recipient) == 1
    error_message = "sandbox recipients should be verified identities"
  }
}
