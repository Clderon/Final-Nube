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
    users   = "172934159782.dkr.ecr.us-east-1.amazonaws.com/microforum-users:latest"
    posts   = "172934159782.dkr.ecr.us-east-1.amazonaws.com/microforum-posts:latest"
    threads = "172934159782.dkr.ecr.us-east-1.amazonaws.com/microforum-threads:latest"
  }
}
