const app = require('koa')();
const router = require('koa-router')();
const db = require('./db.json');

// Log requests
app.use(function *(next){
  const start = new Date;
  yield next;
  const ms = new Date - start;
  console.log('%s %s - %s', this.method, this.url, ms);
});

// Health check
router.get('/health', function *() {
  this.status = 200;
  this.body = { ok: true, service: 'users', uptime: process.uptime() };
});

//
// -------- API-style routes --------
//
router.get('/api/users', function *() {
  this.body = db.users;
});

router.get('/api/users/:userId', function *() {
  const id = parseInt(this.params.userId);
  this.body = db.users.find((user) => user.id == id);
});

router.get('/api/', function *() {
  this.body = "API ready to receive requests";
});

//
// -------- Friendly routes for ALB (/users...) --------
//
router.get('/users', function *() {
  this.body = db.users;
});

router.get('/users/:userId', function *() {
  const id = parseInt(this.params.userId);
  this.body = db.users.find((user) => user.id == id);
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