const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, ".env") });

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is missing from backend/.env");
}

const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet());
app.use(cors({
  origin: [
    "http://localhost:5173",
    "https://trust-vault-sable.vercel.app"
  ]
}));
app.use(express.json({ limit: "1mb" }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

const db = new Database(path.join(__dirname, "trustvault.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

function authenticateToken(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ")
    ? header.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({ error: "Please log in first." });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Session expired. Log in again." });
  }
}

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", app: "TrustVault API" });
});

app.post("/api/auth/register", authLimiter, async (req, res) => {
  try {
    const { username, email, password } = req.body || {};

    if (
      typeof username !== "string" ||
      username.trim().length < 3 ||
      username.trim().length > 80
    ) {
      return res.status(400).json({
        error: "Username must be between 3 and 80 characters.",
      });
    }

    if (
      typeof email !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ) {
      return res.status(400).json({ error: "Enter a valid email address." });
    }

    if (typeof password !== "string" || password.length < 12) {
      return res.status(400).json({
        error: "Password must be at least 12 characters.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = db
      .prepare("SELECT id FROM users WHERE email = ?")
      .get(normalizedEmail);

    if (existing) {
      return res.status(409).json({ error: "Email is already registered." });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = db.prepare(`
      INSERT INTO users (username, email, password_hash)
      VALUES (?, ?, ?)
    `).run(username.trim(), normalizedEmail, passwordHash);

    return res.status(201).json({
      message: "Account created successfully.",
      user: {
        id: result.lastInsertRowid,
        username: username.trim(),
        email: normalizedEmail,
      },
    });
  } catch (error) {
    console.error("Registration error:", error.message);
    return res.status(500).json({ error: "Could not create account." });
  }
});

app.post("/api/auth/login", authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (typeof email !== "string" || typeof password !== "string") {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const user = db.prepare(`
      SELECT id, username, email, password_hash
      FROM users WHERE email = ?
    `).get(email.trim().toLowerCase());

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    return res.json({
      message: "Login successful.",
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Login error:", error.message);
    return res.status(500).json({ error: "Could not log in." });
  }
});

app.get("/api/auth/me", authenticateToken, (req, res) => {
  const user = db.prepare(`
    SELECT id, username, email, created_at
    FROM users WHERE id = ?
  `).get(req.user.id);

  if (!user) {
    return res.status(404).json({ error: "User not found." });
  }

  res.json({ user });
});

app.listen(PORT, () => {
  console.log(`TrustVault API running at http://localhost:${PORT}`);
});