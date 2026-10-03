import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import Database from 'better-sqlite3';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

/* ---------- Танзимот ---------- */
const root = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(root, 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const PUBLIC_DIR = path.join(root, 'public');
const CATEGORIES = ['Мошин', 'Телефон', 'Хона', 'Кор', 'Дигар'];
const MAX_IMAGE = 5 * 1024 * 1024;
const MAX_ADS_PER_USER = 50;

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Калиди JWT: аз муҳит, вагарна як маротиба тасодуфӣ сохта ва дар data/ нигоҳ дошта мешавад.
function loadSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  const file = path.join(DATA_DIR, '.jwt-secret');
  try { return fs.readFileSync(file, 'utf8').trim(); } catch { /* нест */ }
  const s = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(file, s, { mode: 0o600 });
  return s;
}
const SECRET = loadSecret();

/* ---------- База ---------- */
const db = new Database(path.join(DATA_DIR, 'elon-taj.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
// SQLite LIKE бо кириллица ҳассос ба регистр аст, бинобар ин худамон паст мекунем.
db.function('lower_u', { deterministic: true }, (s) => (s == null ? '' : String(s).toLowerCase()));

db.exec(`
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS ads(
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  price INTEGER NOT NULL DEFAULT 0,
  category TEXT NOT NULL,
  location TEXT NOT NULL,
  description TEXT DEFAULT '',
  image TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS favorites(
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ad_id INTEGER NOT NULL REFERENCES ads(id) ON DELETE CASCADE,
  PRIMARY KEY(user_id, ad_id)
);
CREATE INDEX IF NOT EXISTS idx_ads_user ON ads(user_id);
CREATE INDEX IF NOT EXISTS idx_ads_category ON ads(category);
`);

/* ---------- Ёрирасонҳо ---------- */
const normPhone = (v) => {
  let d = String(v ?? '').replace(/\D/g, '');
  if (d.length === 9) d = '992' + d; // рақами тоҷикӣ бе рамзи кишвар
  return d;
};
const validPhone = (d) => /^\d{11,15}$/.test(d);
const str = (v, max) => String(v ?? '').trim().slice(0, max);
const makeToken = (u) => jwt.sign({ id: u.id }, SECRET, { expiresIn: '30d' });
const publicUser = (u) => ({ id: u.id, name: u.name, phone: u.phone });
const httpError = (status, message) => Object.assign(new Error(message), { status });

function auth(req, res, next) {
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const { id } = jwt.verify(token, SECRET);
    const user = db.prepare('SELECT id,name,phone FROM users WHERE id=?').get(id);
    if (!user) throw new Error('no user');
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Воридшавӣ лозим аст' });
  }
}

function limiter(max, windowMs) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.every((t) => now - t > windowMs)) hits.delete(k);
  }, 10 * 60 * 1000).unref();
  return (req, res, next) => {
    const now = Date.now();
    const recent = (hits.get(req.ip) || []).filter((t) => now - t < windowMs);
    if (recent.length >= max) return res.status(429).json({ error: 'Кӯшишҳо хеле зиёданд. Баъдтар кӯшиш кунед' });
    recent.push(now);
    hits.set(req.ip, recent);
    next();
  };
}
const loginLimit = limiter(20, 15 * 60 * 1000);
const registerLimit = limiter(10, 60 * 60 * 1000);

// Санҷиши воқеии расм аз рӯи байтҳои аввал (на танҳо аз рӯи ном/навъи фиристодашуда).
function looksLikeImage(file) {
  const fd = fs.openSync(file, 'r');
  const b = Buffer.alloc(12);
  fs.readSync(fd, b, 0, 12, 0);
  fs.closeSync(fd);
  const s = b.toString('latin1');
  return (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) ||
    s.startsWith('\x89PNG') || s.startsWith('GIF8') ||
    (s.startsWith('RIFF') && s.slice(8, 12) === 'WEBP');
}
const removeUpload = (url) => {
  if (url) fs.rm(path.join(UPLOAD_DIR, path.basename(url)), { force: true }, () => {});
};

const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => cb(null, crypto.randomBytes(16).toString('hex') + EXT[file.mimetype]),
  }),
  limits: { fileSize: MAX_IMAGE, files: 1 },
  fileFilter: (req, file, cb) =>
    EXT[file.mimetype] ? cb(null, true) : cb(httpError(400, 'Танҳо расм (JPG, PNG, WEBP, GIF) қабул мешавад')),
});

/* ---------- Барнома ---------- */
const app = express();
if (process.env.TRUST_PROXY) app.set('trust proxy', process.env.TRUST_PROXY === '1' ? 1 : process.env.TRUST_PROXY);
app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '50kb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '30d', immutable: true }));
app.use(express.static(PUBLIC_DIR)); // танҳо папкаи public/ — на server.js ва на база

/* ---------- Аккаунт ---------- */
app.post('/api/register', registerLimit, async (req, res) => {
  const b = req.body || {};
  const name = str(b.name, 50);
  const phone = normPhone(b.phone);
  const password = String(b.password ?? '');
  if (name.length < 2) return res.status(400).json({ error: 'Ном хеле кӯтоҳ аст' });
  if (!validPhone(phone)) return res.status(400).json({ error: 'Рақами телефон нодуруст аст' });
  if (password.length < 6 || password.length > 72) return res.status(400).json({ error: 'Парол бояд 6–72 аломат бошад' });
  if (db.prepare('SELECT 1 FROM users WHERE phone=?').get(phone))
    return res.status(409).json({ error: 'Ин рақам аллакай сабт шудааст' });
  const hash = await bcrypt.hash(password, 10);
  try {
    const r = db.prepare('INSERT INTO users(name,phone,password) VALUES(?,?,?)').run(name, phone, hash);
    const user = { id: Number(r.lastInsertRowid), name, phone };
    res.json({ token: makeToken(user), user });
  } catch {
    res.status(409).json({ error: 'Ин рақам аллакай сабт шудааст' });
  }
});

app.post('/api/login', loginLimit, async (req, res) => {
  const b = req.body || {};
  const u = db.prepare('SELECT * FROM users WHERE phone=?').get(normPhone(b.phone));
  const ok = u && (await bcrypt.compare(String(b.password ?? ''), u.password));
  if (!ok) return res.status(401).json({ error: 'Рақам ё парол нодуруст аст' });
  res.json({ token: makeToken(u), user: publicUser(u) });
});

app.get('/api/me', auth, (req, res) => res.json({ user: req.user }));

/* ---------- Эълонҳо ---------- */
const AD_COLS = `a.id,a.user_id,a.title,a.price,a.category,a.location,a.description,a.image,a.created_at,u.name AS seller_name`;

app.get('/api/ads', (req, res) => {
  const q = str(req.query.q, 100).toLowerCase();
  const category = str(req.query.category, 30);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 24, 1), 60);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
  const where = [];
  const params = [];
  if (q) {
    const like = '%' + q.replace(/[\\%_]/g, '\\$&') + '%';
    where.push(`(lower_u(a.title) LIKE ? ESCAPE '\\' OR lower_u(a.location) LIKE ? ESCAPE '\\' OR lower_u(a.category) LIKE ? ESCAPE '\\' OR lower_u(a.description) LIKE ? ESCAPE '\\')`);
    params.push(like, like, like, like);
  }
  if (category && category !== 'Ҳама') {
    where.push('a.category=?');
    params.push(category);
  }
  const sql = `SELECT ${AD_COLS} FROM ads a JOIN users u ON u.id=a.user_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY a.id DESC LIMIT ? OFFSET ?`;
  res.json(db.prepare(sql).all(...params, limit, offset));
});

app.get('/api/ads/:id', (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  const ad = Number.isInteger(id) &&
    db.prepare(`SELECT ${AD_COLS},u.phone AS seller_phone FROM ads a JOIN users u ON u.id=a.user_id WHERE a.id=?`).get(id);
  if (!ad) return res.status(404).json({ error: 'Эълон ёфт нашуд' });
  res.json(ad);
});

app.post('/api/ads', auth, upload.single('image'), (req, res) => {
  const file = req.file;
  const fail = (status, error) => {
    if (file) fs.rm(file.path, { force: true }, () => {});
    return res.status(status).json({ error });
  };
  const b = req.body || {};
  const title = str(b.title, 100);
  const location = str(b.location, 80);
  const description = str(b.description, 2000);
  const category = str(b.category, 30);
  const price = Math.round(Number(b.price));

  if (title.length < 3) return fail(400, 'Номи мол хеле кӯтоҳ аст');
  if (!Number.isFinite(price) || price < 0 || price > 1e12) return fail(400, 'Нарх нодуруст аст');
  if (!CATEGORIES.includes(category)) return fail(400, 'Категорияро интихоб кунед');
  if (location.length < 2) return fail(400, 'Шаҳр ё ноҳияро ворид кунед');
  if (file && !looksLikeImage(file.path)) return fail(400, 'Файл расми дуруст нест');
  if (db.prepare('SELECT COUNT(*) c FROM ads WHERE user_id=?').get(req.user.id).c >= MAX_ADS_PER_USER)
    return fail(400, `Шумо аз ${MAX_ADS_PER_USER} эълон зиёд гузошта наметавонед`);

  const r = db.prepare('INSERT INTO ads(user_id,title,price,category,location,description,image) VALUES(?,?,?,?,?,?,?)')
    .run(req.user.id, title, price, category, location, description, file ? '/uploads/' + file.filename : '');
  res.status(201).json(db.prepare(`SELECT ${AD_COLS} FROM ads a JOIN users u ON u.id=a.user_id WHERE a.id=?`).get(r.lastInsertRowid));
});

app.get('/api/my-ads', auth, (req, res) =>
  res.json(db.prepare(`SELECT ${AD_COLS} FROM ads a JOIN users u ON u.id=a.user_id WHERE a.user_id=? ORDER BY a.id DESC`).all(req.user.id)));

app.delete('/api/ads/:id', auth, (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  const ad = db.prepare('SELECT id,image FROM ads WHERE id=? AND user_id=?').get(id, req.user.id);
  if (!ad) return res.status(404).json({ error: 'Эълон ёфт нашуд' });
  db.prepare('DELETE FROM ads WHERE id=?').run(ad.id);
  removeUpload(ad.image);
  res.json({ ok: true });
});

/* ---------- Избранное ---------- */
app.get('/api/favorites/ids', auth, (req, res) =>
  res.json(db.prepare('SELECT ad_id FROM favorites WHERE user_id=?').all(req.user.id).map((r) => r.ad_id)));

app.get('/api/favorites', auth, (req, res) =>
  res.json(db.prepare(`SELECT ${AD_COLS} FROM ads a JOIN users u ON u.id=a.user_id
    JOIN favorites f ON f.ad_id=a.id WHERE f.user_id=? ORDER BY a.id DESC`).all(req.user.id)));

app.post('/api/favorites/:id', auth, (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || !db.prepare('SELECT 1 FROM ads WHERE id=?').get(id))
    return res.status(404).json({ error: 'Эълон ёфт нашуд' });
  const had = db.prepare('DELETE FROM favorites WHERE user_id=? AND ad_id=?').run(req.user.id, id).changes > 0;
  if (!had) db.prepare('INSERT INTO favorites(user_id,ad_id) VALUES(?,?)').run(req.user.id, id);
  res.json({ favorite: !had });
});

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api', (req, res) => res.status(404).json({ error: 'Роҳ ёфт нашуд' }));

/* ---------- Хатоҳо ---------- */
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  let status = err.status || err.statusCode || 500;
  let message = status < 500 ? err.message : 'Хатои сервер';
  if (err instanceof multer.MulterError) {
    status = 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? 'Расм аз 5 МБ зиёд аст' : 'Боркунии файл муваффақ нашуд';
  } else if (err.type === 'entity.parse.failed' || err.type === 'entity.too.large') {
    status = 400;
    message = 'Маълумот нодуруст аст';
  }
  if (status >= 500) console.error(err);
  res.status(status).json({ error: message });
});

/* ---------- Маълумоти намунавӣ (танҳо бо `npm run demo`) ---------- */
if (process.argv.includes('--demo') && !db.prepare('SELECT 1 FROM ads LIMIT 1').get()) {
  const hash = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), 10);
  const uid = Number(db.prepare('INSERT OR IGNORE INTO users(name,phone,password) VALUES(?,?,?)').run('Elon Taj Demo', '992000000000', hash).lastInsertRowid) ||
    db.prepare('SELECT id FROM users WHERE phone=?').get('992000000000').id;
  const ins = db.prepare('INSERT INTO ads(user_id,title,price,category,location,description) VALUES(?,?,?,?,?,?)');
  ins.run(uid, 'iPhone 13', 4500, 'Телефон', 'Душанбе', 'Ҳолати хуб, 128 ГБ.');
  ins.run(uid, 'Toyota Camry', 145000, 'Мошин', 'Хуҷанд', 'Соли 2015, бе садама.');
  ins.run(uid, 'Хонаи 2 ҳуҷрагӣ', 350000, 'Хона', 'Душанбе', 'Марказ, таъмири нав.');
  ins.run(uid, 'Ноутбук Lenovo', 5200, 'Дигар', 'Душанбе', '16 ГБ RAM, SSD 512 ГБ.');
  console.log('Эълонҳои намунавӣ илова шуданд.');
}

app.listen(PORT, () => console.log('Elon Taj: http://localhost:' + PORT));
