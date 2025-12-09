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
  this.body = { ok: true, service: 'posts', uptime: process.uptime() };
});

//
// -------- API-style routes --------
//
router.get('/api/posts', function *() {
  this.body = db.posts;
});

router.get('/api/posts/in-thread/:threadId', function *() {
  const id = parseInt(this.params.threadId);
  this.body = db.posts.filter((post) => post.thread == id);
});

router.get('/api/posts/by-user/:userId', function *() {
  const id = parseInt(this.params.userId);
  this.body = db.posts.filter((post) => post.user == id);
});

router.get('/api/', function *() {
  this.body = "API ready to receive requests";
});

//
// -------- Friendly routes for ALB (/posts...) --------
//
router.get('/posts', function *() {
  this.body = db.posts;
});

router.get('/posts/in-thread/:threadId', function *() {
  const id = parseInt(this.params.threadId);
  this.body = db.posts.filter((post) => post.thread == id);
});

router.get('/posts/by-user/:userId', function *() {
  const id = parseInt(this.params.userId);
  this.body = db.posts.filter((post) => post.user == id);
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

console.log('Posts worker started');
