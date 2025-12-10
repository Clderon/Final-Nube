// users/server.js

const app = require('koa')();
const router = require('koa-router')();
const mysql = require('mysql2/promise');
const fs = require('fs');

// Variables enviadas desde ECS Task Definition
const DB_HOST = process.env.DB_HOST;
const DB_USER = process.env.DB_USER || "admin";
const DB_PASS = process.env.DB_PASS;
const DB_NAME = process.env.DB_NAME || "microforum";
const DB_PORT = process.env.DB_PORT || 3306;

let db;

// -------------------------------------------
// Conexión MySQL (sin DATABASE_URL)
// -------------------------------------------
async function initDB() {

  if (!DB_HOST || !DB_PASS) {
    console.error("❌ Variables de entorno incompletas:", {
      DB_HOST, DB_PASS
    });
    return;
  }

  try {
    db = await mysql.createConnection({
      host: DB_HOST,
      user: DB_USER,
      password: DB_PASS,
      database: DB_NAME,
      port: DB_PORT
    });

    console.log("📌 Conectado a MySQL RDS");

    await db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100),
        email VARCHAR(100)
      )
    `);

    console.log("📦 Tabla 'users' lista");

    // Seed inicial
    const [rows] = await db.query("SELECT COUNT(*) AS total FROM users");
    if (rows[0].total === 0) {
      const seed = JSON.parse(fs.readFileSync('./db.json')).users || [];
      for (const u of seed) {
        await db.query("INSERT INTO users (name, email) VALUES (?, ?)", [u.name, u.email]);
      }
      console.log("🌱 Seed inicial insertado");
    } else {
      console.log(`ℹ Tabla users ya tiene ${rows[0].total} registros`);
    }

  } catch (err) {
    console.error("❌ Error conectando a MySQL:", err);
  }
}

initDB();

// -------------------------------------------
// Middleware log
// -------------------------------------------
app.use(function* (next) {
  const start = new Date;
  yield next;
  const ms = new Date - start;
  console.log('%s %s - %s ms', this.method, this.url, ms);
});

// -------------------------------------------
// Rutas
// -------------------------------------------

router.get('/health', function* () {
  this.body = { ok: true, service: "users", uptime: process.uptime() };
});

router.get('/users', function* () {
  if (!db) {
    this.status = 500;
    this.body = { error: "DB no inicializada" };
    return;
  }
  const [rows] = yield db.query("SELECT * FROM users");
  this.body = rows;
});

router.get('/', function* () {
  this.body = "Users service OK (MySQL RDS)";
});

// Registrar rutas
app.use(router.routes());
app.use(router.allowedMethods());

app.listen(3000);
console.log("Users worker started (port 3000)");
