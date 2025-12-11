const app = require('koa')();
const router = require('koa-router')();
const dbData = require('./db.json');
const mysql = require('mysql2/promise'); // Necesitas instalar este módulo: npm install mysql2/promise

// Configuración de la conexión a Base de Datos (RDS)
// Las credenciales son inyectadas como variables de entorno por ECS.
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
        
        // 1. Crear tabla 'users' si no existe
        await connection.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username TEXT,
                name TEXT,
                bio TEXT
            )
        `);
        
        // 2. Verificar si hay datos
        const [rows] = await connection.query('SELECT COUNT(*) as count FROM users');
        
        if (rows[0].count === 0) {
            console.log('Tabla users vacía. Insertando datos iniciales desde db.json...');
            for (const u of dbData.users) {
                // Insertar usuarios desde el JSON
                await connection.query('INSERT INTO users (id, username, name, bio) VALUES (?, ?, ?, ?)', [u.id, u.username, u.name, u.bio]);
            }
        }
        
        connection.release();
        console.log('Base de datos users inicializada correctamente.');
    } catch (err) {
        console.error('Error inicializando DB:', err);
        // En caso de error crítico de conexión o tabla, el worker debe fallar.
        process.exit(1); 
    }
}
initDb();

// Log requests
app.use(function *(next){
    const start = new Date;
    yield next;
    const ms = new Date - start;
    console.log('%s %s - %s', this.method, this.url, ms);
});

// Health check
router.get('/health', function *() {
    // Intenta hacer una consulta simple para verificar la salud de la DB (opcional, pero buena práctica)
    try {
        yield pool.query('SELECT 1');
        this.status = 200;
        this.body = { ok: true, service: 'users', uptime: process.uptime(), db_status: 'ok' };
    } catch (e) {
        this.status = 503; // Service Unavailable si la DB falla
        this.body = { ok: false, service: 'users', db_status: 'fail', error: e.message };
    }
});

//
// -------- API-style routes --------
//
router.get('/api/users', function *() {
    const [rows] = yield pool.query('SELECT * FROM users');
    this.body = rows;
});

router.get('/api/users/:userId', function *() {
    const id = parseInt(this.params.userId);
    const [rows] = yield pool.query('SELECT * FROM users WHERE id = ?', [id]);
    this.body = rows[0]; // Devuelve el primer resultado (el usuario)
});

router.get('/api/', function *() {
    this.body = "API ready to receive requests";
});

//
// -------- Friendly routes for ALB (/users...) --------
//
router.get('/users', function *() {
    const [rows] = yield pool.query('SELECT * FROM users');
    this.body = rows;
});

router.get('/users/:userId', function *() {
    const id = parseInt(this.params.userId);
    const [rows] = yield pool.query('SELECT * FROM users WHERE id = ?', [id]);
    this.body = rows[0]; // Devuelve el primer resultado (el usuario)
});

//
// -------- Root --------
//
router.get('/', function *() {
    this.body = "Ready to receive requests";
});

app.use(router.routes());
app.use(router.allowedMethods());

app.listen(3000);

console.log('Users worker started');