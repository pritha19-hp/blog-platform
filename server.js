const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'super_secret_blog_key_123';
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
const db = new sqlite3.Database('./blog.db', (err) => {
  if (err) console.error('Database connection error:', err.message);
  else console.log('Connected to SQLite database.');
});
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      author_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (author_id) REFERENCES users (id)
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      post_id INTEGER NOT NULL,
      author_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE,
      FOREIGN KEY (author_id) REFERENCES users (id)
    )
  `);
});
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required.' });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token.' });
    req.user = user;
    next();
  });
}
app.post('/api/auth/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) return res.status(400).json({ error: 'All fields required.' });
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    db.run(`INSERT INTO users (username, email, password) VALUES (?, ?, ?)`, [username, email, hashedPassword], function (err) {
      if (err) return res.status(400).json({ error: 'Username or Email already exists.' });
      res.status(201).json({ message: 'User registered successfully!' });
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error during registration.' });
  }
});
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
    if (err || !user) return res.status(400).json({ error: 'Invalid credentials.' });
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ error: 'Invalid credentials.' });
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: { id: user.id, username: user.username, email: user.email } });
  });
});
app.get('/api/posts', (req, res) => {
  const sql = `SELECT posts.*, users.username as author_name FROM posts JOIN users ON posts.author_id = users.id ORDER BY created_at DESC`;
  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});
app.get('/api/posts/:id', (req, res) => {
  const postId = req.params.id;
  db.get(`SELECT posts.*, users.username as author_name FROM posts JOIN users ON posts.author_id = users.id WHERE posts.id = ?`, [postId], (err, post) => {
    if (err || !post) return res.status(404).json({ error: 'Post not found.' });
    db.all(`SELECT comments.*, users.username as author_name FROM comments JOIN users ON comments.author_id = users.id WHERE post_id = ? ORDER BY created_at ASC`, [postId], (err, comments) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ...post, comments });
    });
  });
});
app.post('/api/posts', authenticateToken, (req, res) => {
  const { title, content } = req.body;
  db.run(`INSERT INTO posts (title, content, author_id) VALUES (?, ?, ?)`, [title, content, req.user.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ id: this.lastID, title, content, author_id: req.user.id });
  });
});
app.delete('/api/posts/:id', authenticateToken, (req, res) => {
  db.get(`SELECT * FROM posts WHERE id = ?`, [req.params.id], (err, post) => {
    if (err || !post) return res.status(404).json({ error: 'Post not found.' });
    if (post.author_id !== req.user.id) return res.status(403).json({ error: 'Unauthorized.' });
    db.run(`DELETE FROM posts WHERE id = ?`, [req.params.id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Post deleted successfully.' });
    });
  });
});
app.post('/api/posts/:id/comments', authenticateToken, (req, res) => {
  const { content } = req.body;
  db.run(`INSERT INTO comments (content, post_id, author_id) VALUES (?, ?, ?)`, [content, req.params.id, req.user.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ id: this.lastID, content, post_id: req.params.id, author_id: req.user.id, author_name: req.user.username });
  });
});
app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
