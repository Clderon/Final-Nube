// users/server.js

const app = require('koa')();           // Koa v1 estilo original
const router = require('koa-router')(); // koa-router v1: función, no clase
const mysql = require('mysql2/promise');
const fs = require('fs');

// 🔐 La URL viene desde el Task Definition (ECS) via Terraform:
// DATABASE_URL = mysql://admin:TU_PASSWORD@microforum-db...:3306/microforum
const DATABASE_URL = process.env.DATABASE_URL;

let db;

// ----------------------
// Conexión MySQL + seed desde db.json
// ----------------------
async function initDB() {
  if (!DATABASE_URL) {
    console.error("❌ DATABASE_URL no está definido en las variables de entorno");
    return;
  }

  try {
    db = await mysql.createConnection(DATABASE_URL);
    console.log("📌 Conectado a MySQL RDS");

    // Crear tabla si no existe
    await db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100),
        email VARCHAR(100)
      )
    `);

    console.log("📦 Tabla 'users' lista");

    // Seed inicial desde db.json si la tabla está vacía
    const [rows] = await db.query("SELECT COUNT(*) AS total FROM users");
    if (rows[0].total === 0) {
      console.log("🌱 Insertando seed desde db.json...");
      const seed = JSON.parse(fs.readFileSync('./db.json')).users || [];
      for (const u of seed) {
        await db.query(
          "INSERT INTO users (name, email) VALUES (?, ?)",
          [u.name, u.email]
        );
      }
      console.log("✅ Seed inicial insertado");
    } else {
      console.log(`ℹ Tabla users ya tiene ${rows[0].total} registros, no se inserta seed`);
    }
  } catch (err) {
    console.error("❌ Error inicializando DB:", err);
  }
}

initDB(); // Se ejecuta al arrancar el contenedor

// ----------------------
// Middleware de log (Koa v1: function * y this)
// ----------------------
app.use(function* (next) {
  const start = new Date;
  yield next;
  const ms = new Date - start;
  console.log('%s %s - %s ms', this.method, this.url, ms);
});

// ----------------------
// Rutas
// ----------------------

// Health check
router.get('/health', function* () {
  this.status = 200;
  this.body = { ok: true, service: 'users', uptime: process.uptime() };
});

// Obtener todos los usuarios
router.get('/users', function* () {
  if (!db) {
    this.status = 500;
    this.body = { error: 'DB no inicializada' };
    return;
  }

  const [rows] = yield db.query("SELECT * FROM users");
  this.body = rows;
});

// Raíz del servicio users
router.get('/', function* () {
  this.body = "Users service OK (MySQL RDS)";
});

// ----------------------
// Registrar rutas y levantar servidor
// ----------------------
app.use(router.routes());
app.use(router.allowedMethods());

app.listen(3000);
console.log('Users worker started (port 3000)');
