// threads/server.js

const app = require('koa')();
const router = require('koa-router')();
const dbData = require('./db.json');
const mysql = require('mysql2/promise');

// Configuración de la conexión a Base de Datos (RDS)
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Inicialización: Crea la tabla y carga datos si está vacía
async function initDb() {
  try {
    const connection = await pool.getConnection();
    // Crear tabla si no existe
    await connection.query(`
      CREATE TABLE IF NOT EXISTS threads (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title TEXT,
        createdBy INT
      )
    `);
    // Verificar si hay datos
    const [rows] = await connection.query('SELECT COUNT(*) as count FROM threads');
    if (rows[0].count === 0) {
      console.log('Tabla threads vacía. Insertando datos iniciales desde db.json...');
      for (const t of dbData.threads) {
        await connection.query('INSERT INTO threads (id, title, createdBy) VALUES (?, ?, ?)', [t.id, t.title, t.createdBy]);
      }
    }
    connection.release();
    console.log('Base de datos threads inicializada correctamente.');
  } catch (err) {
    console.error('Error inicializando DB:', err);
  }
}
initDb();

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

//
// -------- API-style routes --------
//
router.get('/api/threads', function *() {
  const [rows] = yield pool.query('SELECT * FROM threads');
  this.body = rows;
});

router.get('/api/threads/:threadId', function *() {
  const id = parseInt(this.params.threadId);
  const [rows] = yield pool.query('SELECT * FROM threads WHERE id = ?', [id]);
  this.body = rows[0];
});

router.get('/api/', function *() {
  this.body = "API ready to receive requests";
});

//
// -------- Friendly routes for ALB (/threads...) --------
//
router.get('/threads', function *() {
  const [rows] = yield pool.query('SELECT * FROM threads');
  this.body = rows;
});

router.get('/threads/:threadId', function *() {
  const id = parseInt(this.params.threadId);
  const [rows] = yield pool.query('SELECT * FROM threads WHERE id = ?', [id]);
  this.body = rows[0];
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
