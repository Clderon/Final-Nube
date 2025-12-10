// threads/server.js

const app = require('koa')();
const router = require('koa-router')();
const mysql = require('mysql2/promise');
const fs = require('fs');

// Variables desde ECS / Terraform
const DB_HOST = process.env.DB_HOST;
const DB_USER = process.env.DB_USER || "admin";
const DB_PASS = process.env.DB_PASS;
const DB_NAME = process.env.DB_NAME || "microforum";
const DB_PORT = process.env.DB_PORT || 3306;

let db;

// -------------------------------------------
// Conexión MySQL + tabla + seed
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

    console.log("📌 Conectado a MySQL RDS (THREADS)");

    await db.execute(`
      CREATE TABLE IF NOT EXISTS threads (
        id INT PRIMARY KEY AUTO_INCREMENT,
        title VARCHAR(200),
        author VARCHAR(100)
      )
    `);

    console.log("📦 Tabla 'threads' lista");

    // Seed inicial
    const [rows] = await db.query("SELECT COUNT(*) AS total FROM threads");
    if (rows[0].total === 0) {
      const seed = JSON.parse(fs.readFileSync('./db.json')).threads || [];
      for (const t of seed) {
        await db.query("INSERT INTO threads (title, author) VALUES (?, ?)", [
          t.title,
          t.author
        ]);
      }
      console.log("🌱 Seed inicial de threads insertado");
    } else {
      console.log(`ℹ Tabla threads ya tiene ${rows[0].total} registros`);
    }

  } catch (err) {
    console.error("❌ Error conectando MySQL (threads):", err);
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
  this.body = { ok: true, service: "threads", uptime: process.uptime() };
});

router.get('/threads', function* () {
  if (!db) {
    this.status = 500;
    this.body = { error: "DB no inicializada" };
    return;
  }

  const [rows] = yield db.query("SELECT * FROM threads");
  this.body = rows;
});

router.post('/threads', function* () {
  const { title, author } = this.request.body;
  yield db.query(
    "INSERT INTO threads (title, author) VALUES (?, ?)",
    [title, author]
  );

  this.body = { message: "Thread creado" };
});

router.get('/', function* () {
  this.body = "Threads service OK (MySQL RDS)";
});

// Registrar rutas
app.use(require('koa-bodyparser')());
app.use(router.routes());
app.use(router.allowedMethods());

app.listen(3000);
console.log("Threads worker started (port 3000)");
