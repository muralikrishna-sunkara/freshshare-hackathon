data "aws_region" "current" {}

resource "aws_cloudwatch_log_group" "this" {
  name              = "/ecs/${var.cluster_name}/${var.name}"
  retention_in_days = var.log_retention_days
}

locals {
  environment = [for k, v in merge({ AWS_REGION = data.aws_region.current.name }, var.environment) : { name = k, value = v }]
  secrets     = [for k, v in var.secrets : { name = k, valueFrom = v }]

  container = {
    name              = var.name
    image             = var.image
    essential         = true
    cpu               = var.cpu
    memory            = var.memory
    memoryReservation = var.memory_reservation
    command           = var.command
    portMappings = [{
      containerPort = var.container_port
      hostPort      = 0 # dynamic host port (bridge networking)
      protocol      = "tcp"
    }]
    environment = local.environment
    secrets     = local.secrets
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.this.name
        awslogs-region        = data.aws_region.current.name
        awslogs-stream-prefix = var.name
      }
    }
    readonlyRootFilesystem = false
    linuxParameters = {
      initProcessEnabled = true
    }
  }
}

# Terraform creates the first revision; CI registers new revisions with new
# image tags (see .github/workflows/deploy.yml). The service ignores
# task_definition changes so terraform apply never rolls back a deploy.
resource "aws_ecs_task_definition" "this" {
  family                   = "${var.cluster_name}-${var.name}"
  requires_compatibilities = ["EC2"]
  network_mode             = "bridge"
  execution_role_arn       = var.execution_role_arn
  task_role_arn            = var.task_role_arn

  container_definitions = jsonencode([
    { for k, v in local.container : k => v if v != null }
  ])

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = upper(var.architecture) == "ARM64" ? "ARM64" : "X86_64"
  }
}

resource "aws_lb_target_group" "this" {
  name_prefix          = substr(var.name, 0, 6)
  port                 = var.container_port
  protocol             = "HTTP"
  target_type          = "instance"
  vpc_id               = var.vpc_id
  deregistration_delay = 30

  health_check {
    path                = var.health_check_path
    matcher             = "200-399"
    interval            = 15
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_lb_listener_rule" "this" {
  listener_arn = var.listener_arn
  priority     = var.listener_rule_priority

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.this.arn
  }

  condition {
    path_pattern {
      values = var.path_patterns
    }
  }

  dynamic "condition" {
    for_each = length(var.host_headers) > 0 ? [1] : []
    content {
      host_header {
        values = var.host_headers
      }
    }
  }
}

resource "aws_ecs_service" "this" {
  name                               = var.name
  cluster                            = var.cluster_arn
  task_definition                    = aws_ecs_task_definition.this.arn
  desired_count                      = var.desired_count
  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200
  health_check_grace_period_seconds  = var.health_check_grace_period
  enable_execute_command             = var.enable_execute_command
  propagate_tags                     = "SERVICE"

  capacity_provider_strategy {
    capacity_provider = var.capacity_provider_name
    weight            = 1
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  ordered_placement_strategy {
    type  = "spread"
    field = "attribute:ecs.availability-zone"
  }

  ordered_placement_strategy {
    type  = "binpack"
    field = "memory"
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.this.arn
    container_name   = var.name
    container_port   = var.container_port
  }

  lifecycle {
    ignore_changes = [task_definition, desired_count]
  }

  depends_on = [aws_lb_listener_rule.this]
}

# ---------- Service auto scaling ----------

resource "aws_appautoscaling_target" "this" {
  service_namespace  = "ecs"
  resource_id        = "service/${var.cluster_name}/${aws_ecs_service.this.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  min_capacity       = var.min_count
  max_capacity       = var.max_count
}

resource "aws_appautoscaling_policy" "cpu" {
  name               = "${var.name}-cpu"
  policy_type        = "TargetTrackingScaling"
  service_namespace  = aws_appautoscaling_target.this.service_namespace
  resource_id        = aws_appautoscaling_target.this.resource_id
  scalable_dimension = aws_appautoscaling_target.this.scalable_dimension

  target_tracking_scaling_policy_configuration {
    target_value       = var.cpu_target
    scale_in_cooldown  = 120
    scale_out_cooldown = 60

    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
  }
}

resource "aws_appautoscaling_policy" "memory" {
  name               = "${var.name}-memory"
  policy_type        = "TargetTrackingScaling"
  service_namespace  = aws_appautoscaling_target.this.service_namespace
  resource_id        = aws_appautoscaling_target.this.resource_id
  scalable_dimension = aws_appautoscaling_target.this.scalable_dimension

  target_tracking_scaling_policy_configuration {
    target_value       = var.memory_target
    scale_in_cooldown  = 120
    scale_out_cooldown = 60

    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageMemoryUtilization"
    }
  }
}
