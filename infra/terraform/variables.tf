variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Project / resource name prefix"
  type        = string
  default     = "microforum"
}

variable "container_images" {
  description = "ECR image URIs for each microservice"
  type        = map(string)

  default = {
    users   = "748699405709.dkr.ecr.us-east-1.amazonaws.com/microforum-users:latest"
    posts   = "748699405709.dkr.ecr.us-east-1.amazonaws.com/microforum-posts:latest"
    threads = "748699405709.dkr.ecr.us-east-1.amazonaws.com/microforum-threads:latest"
  }
}

variable "enable_codedeploy" {
  description = "Enable CodeDeploy-based blue/green deploy (posts). Set false if account lacks CodeDeploy subscription"
  type        = bool
  default     = false
}
