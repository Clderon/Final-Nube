# Microforum ECS + CI/CD

Repositorio con tres microservicios Node.js (`users`, `posts`, `threads`) basados en Koa. Se ejecutan en local con Docker Compose y en AWS ECS Fargate detras de un Application Load Balancer. La infraestructura y el pipeline de entrega continua estan definidos con Terraform y CodePipeline/CodeBuild/CodeDeploy.

## 1. Servicios

- `users`: endpoints de usuarios.
- `posts`: endpoints de publicaciones; este servicio usa despliegue blue/green con CodeDeploy.
- `threads`: endpoints de hilos.

Comun en todos:
- Puerto de contenedor: `3000`.
- Health check: `GET /health`.
- Rutas `/api/...` y rutas `/users`, `/posts`, `/threads` pensadas para el ALB.

## 2. Estructura del repositorio

- `users/`, `posts/`, `threads/`: `server.js`, `Dockerfile`, `db.json`, `package.json` de cada microservicio.
- `docker-compose.yml`: levanta los tres servicios en local, exponiendo 3001/3002/3003 hacia el puerto 3000 interno.
- `buildspecs/buildspec-microforum.yml`: Build de CodeBuild. Inicia sesion en ECR, construye y publica las imagenes de `users`, `posts`, `threads`, y genera `imagedefinitions.json`.
- `appspec.yaml` y `taskdef.json`: plantillas usadas por CodeDeploy (blue/green del servicio `posts`).
- `infra/terraform/`: VPC, subredes publicas/privadas, IGW, NAT, security groups, ALB con rutas por path, cluster ECS, task definitions, services, auto scaling, roles IAM, CloudWatch Logs y pipeline (CodeCommit + CodeBuild + CodeDeploy + CodePipeline).

## 3. Requisitos previos

- Docker y Docker Compose.
- AWS CLI configurado con credenciales.
- Terraform >= 1.3.
- Acceso a un registro ECR y permisos para crear los recursos definidos en Terraform.

## 4. Ejecucion local

```bash
docker compose up --build

curl http://localhost:3001/health   # users
curl http://localhost:3002/health   # posts
curl http://localhost:3003/health   # threads
```

Rutas principales en local (puertos publicados por Compose):

- `http://localhost:3001/users` y `http://localhost:3001/api/users`
- `http://localhost:3002/posts` y `http://localhost:3002/api/posts`
- `http://localhost:3003/threads` y `http://localhost:3003/api/threads`

## 5. Infraestructura con Terraform

```bash
cd infra/terraform
terraform init
terraform plan -out tf.plan
terraform apply tf.plan
```

Se provisiona:
- VPC con subredes publicas y privadas, IGW y NAT.
- Application Load Balancer con reglas por path (`/users*`, `/posts*`, `/threads*`).
- Target groups (blue/green para `posts` y uno dedicado para cada servicio restante).
- Cluster ECS Fargate, task definitions y services (puerto 3000, logs en CloudWatch).
- Auto Scaling de services (min 1, max 3 tareas).
- Roles IAM para ECS tasks, CodeBuild, CodePipeline y CodeDeploy.

Variables clave en `variables.tf`:
- `aws_region` (default `us-east-1`).
- `project_name` (default `microforum`).
- `container_images`: URIs ECR por servicio (default apuntan a la cuenta 172934159782 en `us-east-1`).

Outputs principales: `vpc_id`, `alb_dns_name`, `ecs_cluster_name`.

## 6. CI/CD (CodePipeline -> CodeBuild -> CodeDeploy)

- **Source**: repositorio CodeCommit `${project_name}-ecs-cicd`.
- **Build (CodeBuild)**: usa `buildspecs/buildspec-microforum.yml` para construir las imagenes, etiquetarlas con `IMAGE_TAG` (SHA corto) y `latest`, subir a ECR y generar `imagedefinitions.json`.
- **Deploy (CodeDeployToECS)**: consume `appspec.yaml` y `taskdef.json` del artefacto fuente. El deployment group definido en Terraform aplica blue/green sobre el servicio `posts` (`posts-blue` y `posts-green`).
- **ECS services**: `posts` usa `deployment_controller = CODE_DEPLOY`; `users` y `threads` usan el controlador ECS clasico.

## 7. Notas sobre los microservicios

- Framework: Koa 1.x con `koa-router`.
- Datos: `db.json` embebido (sin base de datos externa).
- Script: `npm start` ejecuta `node server.js`.
- Logging: middleware simple de request y health check en `/health`.

## 8. Pasos siguientes sugeridos

- Ajusta `container_images` a tus repositorios ECR antes de aplicar Terraform.
- Si usas GitHub en lugar de CodeCommit, cambia la etapa **Source** de CodePipeline.
- Si necesitas dominio propio, apunta Route 53 al `alb_dns_name` generado.
