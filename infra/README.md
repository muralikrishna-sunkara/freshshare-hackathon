# FreshShare infrastructure (AWS, Terraform)

Everything needed to run FreshShare on AWS, deployed from GitHub Actions with
OIDC (no AWS keys stored in GitHub). Today it deploys a **hello-world**
container on both ECS services; tomorrow the app pipeline swaps in the real
images without touching Terraform.

```
                    Internet
                       │
             ┌─────────▼─────────┐        ┌───────────────────┐
             │  ALB (public)     │        │ CloudFront (CDN)  │
             │  /api/* → api     │        └─────────┬─────────┘
             │  /*     → web     │                  │ OAC
             └───┬──────────┬────┘        ┌─────────▼─────────┐
     private     │          │             │ S3 food images    │
     subnets ┌───▼──────────▼────┐        │ (private)         │
             │ ECS cluster, EC2  │───────▶└───────────────────┘
             │ launch type, ASG  │        ┌───────────────────┐
             │ capacity provider │───────▶│ SNS: app + ops    │
             │  api :4000 web:80 │        └───────────────────┘
             └─────────┬─────────┘        ┌───────────────────┐
     db subnets        │ 5432 (TLS)       │ Secrets Manager   │
             ┌─────────▼─────────┐        │ DATABASE_URL, JWT │
             │ RDS PostgreSQL 16 │        └───────────────────┘
             └───────────────────┘   CloudWatch: logs, alarms → SNS ops, dashboard
```

## What gets created

| Area | Resources | Notes |
|---|---|---|
| Network | VPC `10.20.0.0/16`, 2 AZs, public / private / isolated DB subnets, NAT, S3 gateway endpoint, flow logs | `single_nat_gateway = true` in dev to save ~$35/month |
| Load balancing | ALB, HTTP (redirects to HTTPS when a cert is set), TLS 1.3 policy, access logs to S3 | Path rules: `/api/*` → api, everything else → web |
| Compute | ECS cluster, Auto Scaling Group of ECS-optimised AL2023 instances (`t3.small`), capacity provider with managed scaling + draining | IMDSv2 only, encrypted gp3, SSM Session Manager instead of SSH |
| Services | `api` and `web` ECS services (bridge networking, dynamic ports), circuit breaker with rollback, CPU/memory target-tracking autoscaling, ECS Exec | Hello-world nginx until real images ship |
| Registry | ECR `freshshare-dev/api`, `freshshare-dev/web` | Immutable tags, scan on push, lifecycle keeps 30 |
| Database | RDS PostgreSQL 16 `db.t4g.micro`, encrypted, `rds.force_ssl`, 7-day backups, Performance Insights | Only reachable from the ECS instances |
| Images | S3 bucket (private, versioned, TLS-only) + CloudFront with Origin Access Control | API task role can put/get/delete objects |
| Notifications | SNS `ops-alerts` (CloudWatch alarms → email) and `app-notifications` (app events) | API task role can publish |
| Secrets | Secrets Manager `freshshare-dev/app` with `DATABASE_URL` and `JWT_SECRET` | Injected into the api container by ECS |
| Observability | Log groups per service, alarms (ALB/target 5xx, unhealthy hosts, p95 latency, ECS CPU/memory, RDS CPU/storage/connections), dashboard | |
| CI/CD access | GitHub OIDC provider, plan / apply / deploy roles (in `bootstrap/`) | Scoped to this repo |

Rough dev cost: **about $90-100/month** in eu-central-1 (NAT ~$35, ALB ~$20, EC2 ~$17, RDS ~$17, rest small). Estimate only; run `terraform destroy` after the hackathon if you don't need it.

## Layout

```
infra/terraform/
├── bootstrap/          # one-time: state bucket + GitHub OIDC roles (run locally)
├── envs/dev/           # the environment root module (state in S3)
│   └── tests/          # offline terraform tests with mocked providers
└── modules/            # network, alb, ecs_cluster, ecs_service, ecr, rds,
                        # storage, notifications, monitoring
.github/workflows/
├── terraform.yml       # infra: checks + plan on PR, apply on main
└── app-deploy.yml      # app: build → ECR → migrate → ECS (dormant until apps/ exists)
```

## One-time setup (about 10 minutes)

### 1. Bootstrap AWS (locally, with admin credentials)

```bash
cd infra/terraform/bootstrap
terraform init
terraform apply
terraform output
```

This creates the state bucket and three IAM roles that only
`muralikrishna-sunkara/freshshare-hackathon` can assume via OIDC:

| Role | Who can assume it | Permissions |
|---|---|---|
| `freshshare-gha-terraform-plan` | Pull requests and branch pushes | ReadOnlyAccess + state bucket |
| `freshshare-gha-terraform-apply` | Jobs in the GitHub environment `dev` only | AdministratorAccess (tighten before production) |
| `freshshare-gha-deploy` | Jobs in the GitHub environment `dev` only | ECR push, ECS register/update/run-task, PassRole to `freshshare-*` |

If your account already has the GitHub OIDC provider, use
`terraform apply -var create_oidc_provider=false`.

The roles trust both GitHub OIDC subject formats: classic
(`repo:owner/name:...`) and immutable (`repo:owner@<id>/name@<id>:...`, used
when the repo or account has immutable subjects turned on). The numeric IDs
are the `github_owner_id` / `github_repository_id` variables. Check yours with
`gh api repos/<owner>/<repo>/actions/oidc/customization/sub`. Keep the bootstrap's local
`terraform.tfstate` somewhere safe.

### 2. Configure GitHub

**Settings → Environments → New environment `dev`.** Recommended: deployment
branches = `main` only, and yourself as a required reviewer (that gives you a
manual approval before every apply).

**Settings → Secrets and variables → Actions → Variables:**

| Variable | Where | Value |
|---|---|---|
| `TF_STATE_BUCKET` | Repository | `state_bucket` output |
| `AWS_PLAN_ROLE_ARN` | Repository | `plan_role_arn` output |
| `AWS_APPLY_ROLE_ARN` | Environment `dev` | `apply_role_arn` output |
| `AWS_DEPLOY_ROLE_ARN` | Environment `dev` | `deploy_role_arn` output |
| `AWS_REGION` | Repository (optional) | defaults to `eu-central-1` |
| `OPS_ALERT_EMAILS` | Repository (optional) | HCL list, e.g. `["you@example.com"]` |
| `APP_DOMAIN` | Repository (optional) | e.g. `app.dev.freshshare.food` |
| `ROUTE53_ZONE_ID` or `ACM_CERTIFICATE_ARN` | Repository (optional) | For HTTPS, see below |
| `APP_URL` | Environment `dev` (optional) | Public URL used by the app smoke test |

No secrets are needed: all AWS access is OIDC.

### 3. Deploy

Merge to `main` (or run **Actions → Infrastructure (Terraform) → Run workflow → apply**).
The workflow plans, waits for approval on the `dev` environment, applies, and
curls `/api/health` until the hello-world answers. The job summary shows the
URL (the ALB DNS name unless you set a domain).

Open it: the web page says "Hello from FreshShare" and `/api/health` returns
`{"status":"ok","service":"api","mode":"hello-world"}`.

If you subscribed an email to ops alerts, confirm the SNS email.

## HTTPS and a custom domain

- **DNS in Route 53:** set `APP_DOMAIN` and `ROUTE53_ZONE_ID`. Terraform issues
  and validates an ACM certificate and creates the alias record.
- **DNS elsewhere (e.g. Hetzner):** request an ACM certificate for the domain in
  eu-central-1, add its validation CNAME at your DNS provider, then set
  `APP_DOMAIN` and `ACM_CERTIFICATE_ARN`, and point a CNAME for the domain at
  the `alb_dns_name` output.

Do not point `dev.freshshare.food` itself at the ALB: the survey runs there.

## Tomorrow: switching to the real app

`app-deploy.yml` does nothing until `apps/api/Dockerfile` or
`apps/web/Dockerfile` exist. Once they do, every push to `main` touching
`apps/**` will:

1. Run `npm ci`, lint and tests against a Postgres service container.
2. Build `api` and `web` images (build context = repo root) and push to ECR tagged with the git SHA.
3. Register new task definitions from the current ones with the new image (and without the hello-world command).
4. Run `npx prisma migrate deploy` as a one-off ECS task and fail on a non-zero exit.
5. Update both services and wait until they're stable (the circuit breaker rolls back automatically on failure).
6. Curl `/api/health`.

Contract the app must follow so this works:

| | api | web |
|---|---|---|
| Listen port | `4000` (`PORT`) | `80` (Caddy with `APP_DOMAIN=:80`, plain HTTP; TLS ends at the ALB) |
| Health check | `GET /api/health` returns 200 | `GET /` returns 200 |
| Env provided | `DATABASE_URL`, `JWT_SECRET` (Secrets Manager), `S3_BUCKET`, `PUBLIC_IMAGE_BASE_URL`, `SNS_NOTIFICATIONS_ARN`, `APP_URL`, `AWS_REGION`, `STORAGE_DRIVER=s3` | `APP_DOMAIN` |
| AWS access | Task role: S3 put/get/delete on the images bucket, SNS publish | none |
| Image | `linux/amd64`, `npx prisma` available for migrations | |

So in the app, store photos with the AWS SDK (`@aws-sdk/client-s3`, credentials
come from the task role automatically) under `listings/<id>.webp` and build
public URLs as `${PUBLIC_IMAGE_BASE_URL}/listings/<id>.webp`. Keep the local
`/uploads` volume as the `STORAGE_DRIVER=local` fallback for docker compose.

Rollback: re-run the workflow for an older commit, or
`aws ecs update-service --cluster freshshare-dev --service api --task-definition freshshare-dev-api:<previous revision>`.

## Running Terraform locally

```bash
cd infra/terraform/envs/dev
cp backend.hcl.example backend.hcl          # fill in the state bucket
cp terraform.tfvars.example terraform.tfvars
terraform init -backend-config=backend.hcl
terraform plan
```

Offline checks (no AWS credentials, mocked providers):

```bash
terraform init -backend=false && terraform validate && terraform test
```

Commit the `.terraform.lock.hcl` files after your first `terraform init`
(`terraform providers lock -platform=linux_amd64 -platform=darwin_arm64` covers CI and a Mac).

Useful commands:

```bash
aws ecs execute-command --cluster freshshare-dev --task <task-id> --container api --interactive --command sh
aws logs tail /ecs/freshshare-dev/api --follow
aws ssm start-session --target <instance-id>     # shell on an ECS host
```

## Known trade-offs (fine for a hackathon, revisit for production)

- The apply role has AdministratorAccess. Replace with a scoped policy and a permissions boundary.
- The DB password and JWT secret are generated by Terraform, so they are also in the (encrypted, private) state file. For production, use RDS-managed master passwords and rotate.
- Single NAT gateway and single-AZ RDS. Set `single_nat_gateway = false` and `db_multi_az = true` for resilience.
- `protect_data = false` in dev: `terraform destroy` removes the database and buckets. Set it to `true` once there's real user data.
- Task definitions are created by Terraform and then owned by CI (`ignore_changes`). Changing env vars or secrets in Terraform affects new revisions only after the next app deploy.
