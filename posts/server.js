// posts/server.js

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
      CREATE TABLE IF NOT EXISTS posts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        thread INT,
        text TEXT,
        user INT
      )
    `);
    // Verificar si hay datos
    const [rows] = await connection.query('SELECT COUNT(*) as count FROM posts');
    if (rows[0].count === 0) {
      console.log('Tabla vacía. Insertando datos iniciales desde db.json...');
      for (const p of dbData.posts) {
        await connection.query('INSERT INTO posts (thread, text, user) VALUES (?, ?, ?)', [p.thread, p.text, p.user]);
      }
    }
    connection.release();
    console.log('Base de datos posts inicializada correctamente.');
  } catch (err) {
    console.error('Error inicializando DB:', err);
  }
}
initDb();

// Log requests
app.use(function *(next){
  const start = new Date;
  yield next;
  const ms = new Date - start;
  console.log('%s %s - %s ms', this.method, this.url, ms);
});

// -------------------------------------------
// Rutas
// -------------------------------------------

router.get('/health', function* () {
  this.body = { ok: true, service: "posts", uptime: process.uptime() };
});

//
// -------- API-style routes --------
//
router.get('/api/posts', function *() {
  const [rows] = yield pool.query('SELECT * FROM posts');
  this.body = rows;
});

router.get('/api/posts/in-thread/:threadId', function *() {
  const id = parseInt(this.params.threadId);
  const [rows] = yield pool.query('SELECT * FROM posts WHERE thread = ?', [id]);
  this.body = rows;
});

router.get('/api/posts/by-user/:userId', function *() {
  const id = parseInt(this.params.userId);
  const [rows] = yield pool.query('SELECT * FROM posts WHERE user = ?', [id]);
  this.body = rows;
});

router.get('/api/', function *() {
  this.body = "API ready to receive requests";
});

//
// -------- Friendly routes for ALB (/posts...) --------
//
router.get('/posts', function *() {
  const [rows] = yield pool.query('SELECT * FROM posts');
  this.body = rows;
});

router.get('/posts/in-thread/:threadId', function *() {
  const id = parseInt(this.params.threadId);
  const [rows] = yield pool.query('SELECT * FROM posts WHERE thread = ?', [id]);
  this.body = rows;
});

router.get('/posts/by-user/:userId', function *() {
  const id = parseInt(this.params.userId);
  const [rows] = yield pool.query('SELECT * FROM posts WHERE user = ?', [id]);
  this.body = rows;
});

// Registrar rutas
app.use(require('koa-bodyparser')());
app.use(router.routes());
app.use(router.allowedMethods());

app.listen(3000);
console.log("Posts worker started (port 3000)");
