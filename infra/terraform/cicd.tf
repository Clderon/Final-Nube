########################
# CI/CD – SHARED
########################

# Get current account ID so the S3 bucket name is globally unique
data "aws_caller_identity" "current" {}

# Artifact bucket for CodePipeline
resource "aws_s3_bucket" "codepipeline_artifacts" {
  bucket = "${var.project_name}-codepipeline-artifacts-${data.aws_caller_identity.current.account_id}"

  force_destroy = true

  tags = {
    Name = "${var.project_name}-codepipeline-artifacts"
  }
}

# Block all public access to the artifacts bucket
resource "aws_s3_bucket_public_access_block" "codepipeline_artifacts_block" {
  bucket = aws_s3_bucket.codepipeline_artifacts.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

########################
# CodeCommit (source)
########################

resource "aws_codecommit_repository" "microforum" {
  repository_name = "${var.project_name}-ecs-cicd"
  description     = "Microforum ECS CI/CD repo"

  # You can push your existing repo to this remote
}

########################
# IAM – CodeBuild
########################

data "aws_iam_policy_document" "codebuild_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["codebuild.amazonaws.com"]
    }
  }
}


resource "aws_iam_role" "codebuild_role" {
  name               = "${var.project_name}-codebuild-role"
  assume_role_policy = data.aws_iam_policy_document.codebuild_assume_role.json
}

# Attach basic permissions: logs, ECR, S3
resource "aws_iam_role_policy_attachment" "codebuild_logs" {
  role       = aws_iam_role.codebuild_role.name
  policy_arn = "arn:aws:iam::aws:policy/AWSCodeBuildDeveloperAccess"
}

resource "aws_iam_role_policy_attachment" "codebuild_ecr" {
  role       = aws_iam_role.codebuild_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryPowerUser"
}

resource "aws_iam_role_policy_attachment" "codebuild_s3" {
  role       = aws_iam_role.codebuild_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonS3FullAccess"
}

# Extra explicit permissions for CloudWatch Logs so CodeBuild can create log groups/streams
resource "aws_iam_role_policy" "codebuild_logs_inline" {
  name = "${var.project_name}-codebuild-logs-inline"
  role = aws_iam_role.codebuild_role.id

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogStreams"
        ],
        Resource = "*"
      }
    ]
  })
}

########################
# CodeBuild Project
########################

resource "aws_codebuild_project" "microforum_build" {
  name          = "${var.project_name}-build"
  description   = "Build Docker images for microforum users/posts/threads"
  service_role  = aws_iam_role.codebuild_role.arn
  build_timeout = 20

  artifacts {
    type = "CODEPIPELINE"
  }

  environment {
    compute_type                = "BUILD_GENERAL1_SMALL"
    image                       = "aws/codebuild/standard:7.0"
    type                        = "LINUX_CONTAINER"
    privileged_mode             = true # needed for Docker builds
    image_pull_credentials_type = "CODEBUILD"

    environment_variable {
      name  = "AWS_REGION"
      value = var.aws_region
    }
  }

  source {
    type      = "CODEPIPELINE"
    buildspec = "buildspecs/buildspec-microforum.yml"
  }

  logs_config {
    cloudwatch_logs {
      group_name  = "/aws/codebuild/${var.project_name}" # was /codebuild/...
      stream_name = "build"
    }
  }

  tags = {
    Name = "${var.project_name}-codebuild"
  }
}

########################
# IAM – CodePipeline
########################

data "aws_iam_policy_document" "codepipeline_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["codepipeline.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "codepipeline_role" {
  name               = "${var.project_name}-codepipeline-role"
  assume_role_policy = data.aws_iam_policy_document.codepipeline_assume_role.json
}

# Grant CodePipeline rights to CodeCommit, CodeBuild, S3, CodeDeploy, ECS, CloudWatch Logs, ECR, etc.
resource "aws_iam_role_policy" "codepipeline_policy" {
  name = "${var.project_name}-codepipeline-policy"
  role = aws_iam_role.codepipeline_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["codecommit:*"]
        Resource = [aws_codecommit_repository.microforum.arn]
      },
      {
        Effect   = "Allow"
        Action   = ["codebuild:*"]
        Resource = [aws_codebuild_project.microforum_build.arn]
      },
      {
        Effect = "Allow"
        Action = [
          "codedeploy:*",
          "ecs:*",
          "elasticloadbalancing:*",
          "iam:PassRole",
          "cloudwatch:*",
          "logs:*",
          "s3:*",
          "ecr:*"
        ]
        Resource = ["*"]
      }
    ]
  })
}

########################
# CodeDeploy – ECS Blue/Green (for ONE service, e.g. posts)
########################

# IAM role for CodeDeploy ECS
data "aws_iam_policy_document" "codedeploy_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["codedeploy.amazonaws.com"]
    }
  }
}

# Make CodeDeploy IAM role optional based on variable
resource "aws_iam_role" "codedeploy_role" {
  count              = var.enable_codedeploy ? 1 : 0
  name               = "${var.project_name}-codedeploy-role"
  assume_role_policy = data.aws_iam_policy_document.codedeploy_assume_role.json
}

resource "aws_iam_role_policy_attachment" "codedeploy_managed" {
  count      = var.enable_codedeploy ? 1 : 0
  role       = aws_iam_role.codedeploy_role[0].name
  policy_arn = "arn:aws:iam::aws:policy/AWSCodeDeployRoleForECS"
}

# CodeDeploy application for ECS
resource "aws_codedeploy_app" "microforum" {
  count            = var.enable_codedeploy ? 1 : 0
  name             = "${var.project_name}-ecs-app"
  compute_platform = "ECS"
}

# NOTE: For real blue/green, your ECS service must:
# - use deployment_controller { type = "CODE_DEPLOY" }
# - have two target groups (blue + green) behind the ALB for that service.
# Below assumes you have:
#   aws_ecs_service.service["posts"]
#   aws_lb_target_group.posts_blue
#   aws_lb_target_group.posts_green

resource "aws_codedeploy_deployment_group" "microforum" {
  count                   = var.enable_codedeploy ? 1 : 0
  app_name               = aws_codedeploy_app.microforum[0].name
  deployment_group_name  = "${var.project_name}-dg"
  service_role_arn       = aws_iam_role.codedeploy_role[0].arn
  deployment_config_name = "CodeDeployDefault.ECSAllAtOnce"

  deployment_style {
    deployment_type   = "BLUE_GREEN"
    deployment_option = "WITH_TRAFFIC_CONTROL"
  }

  auto_rollback_configuration {
    enabled = true
    events  = ["DEPLOYMENT_FAILURE"]
  }

  blue_green_deployment_config {
    terminate_blue_instances_on_deployment_success {
      action                           = "TERMINATE"
      termination_wait_time_in_minutes = 5
    }

    deployment_ready_option {
      action_on_timeout = "CONTINUE_DEPLOYMENT"
    }
  }

  ecs_service {
    cluster_name = aws_ecs_cluster.this.name
    service_name = aws_ecs_service.service["posts"].name
  }

  load_balancer_info {
    target_group_pair_info {
      prod_traffic_route {
        listener_arns = [aws_lb_listener.http.arn]
      }

      target_group {
        name = aws_lb_target_group.posts_blue.name
      }

      target_group {
        name = aws_lb_target_group.posts_green.name
      }
    }
  }
}

########################
# CodePipeline
########################

resource "aws_codepipeline" "microforum" {
  name     = "${var.project_name}-pipeline"
  role_arn = aws_iam_role.codepipeline_role.arn

  artifact_store {
    type     = "S3"
    location = aws_s3_bucket.codepipeline_artifacts.bucket
  }

  # -------- Stage 1: Source (CodeCommit) --------
  stage {
    name = "Source"

    action {
      name             = "Source"
      category         = "Source"
      owner            = "AWS"
      provider         = "CodeCommit"
      version          = "1"
      output_artifacts = ["SourceOutput"]

      configuration = {
        RepositoryName = aws_codecommit_repository.microforum.repository_name
        BranchName     = "main"
      }
    }
  }

  # -------- Stage 2: Build (CodeBuild) --------
  stage {
    name = "Build"

    action {
      name             = "BuildImages"
      category         = "Build"
      owner            = "AWS"
      provider         = "CodeBuild"
      version          = "1"
      input_artifacts  = ["SourceOutput"]
      output_artifacts = ["BuildOutput"]

      configuration = {
        ProjectName = aws_codebuild_project.microforum_build.name
      }
    }
  }

  # -------- Stage 3: Deploy (ECS Blue/Green via CodeDeploy) --------
  dynamic "stage" {
    for_each = var.enable_codedeploy ? [1] : []
    content {
      name = "Deploy"

      action {
        name     = "DeployToECSBlueGreen"
        category = "Deploy"
        owner    = "AWS"
        provider = "CodeDeployToECS"
        version  = "1"

        # We only need SourceOutput here for appspec.yaml + taskdef.json
        input_artifacts = ["SourceOutput"]

        configuration = {
          ApplicationName     = aws_codedeploy_app.microforum[0].name
          DeploymentGroupName = aws_codedeploy_deployment_group.microforum[0].deployment_group_name

          TaskDefinitionTemplateArtifact = "SourceOutput"
          TaskDefinitionTemplatePath     = "taskdef.json"

          AppSpecTemplateArtifact = "SourceOutput"
          AppSpecTemplatePath     = "appspec.yaml"
        }
      }
    }
  }

  tags = {
    Name = "${var.project_name}-pipeline"
  }
}
