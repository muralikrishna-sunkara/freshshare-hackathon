output "state_bucket" {
  description = "Put this in envs/dev/backend.hcl and the TF_STATE_BUCKET GitHub variable."
  value       = aws_s3_bucket.state.bucket
}

output "plan_role_arn" {
  description = "GitHub variable AWS_PLAN_ROLE_ARN."
  value       = aws_iam_role.plan.arn
}

output "apply_role_arn" {
  description = "GitHub environment variable AWS_APPLY_ROLE_ARN (environment: dev)."
  value       = aws_iam_role.apply.arn
}

output "deploy_role_arn" {
  description = "GitHub environment variable AWS_DEPLOY_ROLE_ARN, for the app pipeline."
  value       = aws_iam_role.deploy.arn
}
