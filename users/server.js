const Koa = require('koa');
const Router = require('koa-router');
const { PrismaClient } = require('@prisma/client');

const app = new Koa();
const router = new Router();
const prisma = new PrismaClient();

// Log de requests
app.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  console.log(`${ctx.method} ${ctx.url} - ${Date.now() - start}ms`);
});

// Health check
router.get('/health', (ctx) => {
  ctx.body = { ok: true, service: 'users', uptime: process.uptime() };
});

// Obtener todos los usuarios
router.get('/users', async (ctx) => {
  ctx.body = await prisma.user.findMany();
});

// Obtener usuario por ID
router.get('/users/:userId', async (ctx) => {
  ctx.body = await prisma.user.findUnique({
    where: { id: Number(ctx.params.userId) }
  });
});

// Crear usuario
router.post('/users', async (ctx) => {
  const data = ctx.request.body; // requiere bodyparser
  ctx.body = await prisma.user.create({ data });
});

// Root
router.get('/', (ctx) => {
  ctx.body = "Users Service - OK";
});

app
  .use(require('koa-bodyparser')())
  .use(router.routes())
  .use(router.allowedMethods());

app.listen(3000, () => console.log('Users service running on port 3000'));
