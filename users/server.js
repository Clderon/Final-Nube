const Koa = require('koa');
const Router = require('koa-router');
const bodyParser = require('koa-bodyparser');
const mysql = require('mysql2/promise');
const fs = require('fs');

const app = new Koa();
const router = new Router();

// 🔥 Variables vienen del Task Definition en ECS
const DB_HOST = process.env.DB_HOST;
const DB_USER = "admin";
const DB_PASS = process.env.DB_PASS;
const DB_NAME = "microforum";

let db;

// ----------------------
// Conexión MySQL
// ----------------------
async function initDB() {
  db = await mysql.createConnection({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASS,
    database: DB_NAME
  });

  console.log("📌 Conectado a MySQL RDS");

  // Crear tabla si no existe
  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(100),
      email VARCHAR(100)
    )
  `);

  console.log("📦 Tabla users lista");

  // Cargar JSON si la tabla está vacía
  const [rows] = await db.query("SELECT COUNT(*) AS total FROM users");
  if (rows[0].total === 0) {
    const seed = JSON.parse(fs.readFileSync('./db.json')).users || [];
    for (const u of seed) {
      await db.query("INSERT INTO users (name, email) VALUES (?, ?)", [u.name, u.email]);
    }
    console.log("🌱 Seed inicial insertado desde db.json");
  }
}

initDB();

// ---------------------- ROUTES ----------------------

router.get('/health', (ctx) => {
  ctx.body = { ok: true, service: "users", uptime: process.uptime() };
});

router.get('/users', async (ctx) => {
  const [rows] = await db.query("SELECT * FROM users");
  ctx.body = rows;
});

router.post('/users', async (ctx) => {
  const { name, email } = ctx.request.body;
  await db.query("INSERT INTO users (name, email) VALUES (?, ?)", [name, email]);
  ctx.body = { message: "Usuario creado" };
});

router.get('/', (ctx) => ctx.body = "Users service OK");

// ----------------------

app.use(bodyParser());
app.use(router.routes()).use(router.allowedMethods());

app.listen(3000, () => console.log("Users service running on port 3000"));
