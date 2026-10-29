import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db } from '../db/index.js';
import { liveSync } from '../websocket/liveSync.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dominatee_secret_jwt_key_local_2026';

interface UserRow {
  id: string;
  name: string;
  email: string;
  phone?: string;
  password_hash: string;
  role: string;
  default_room_id?: string;
  theme_preference: string;
  favorites_json: string;
  created_at: string;
  last_login_at?: string;
}

export function getUserFromToken(token?: string): UserRow | null {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { id: string };
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.id) as UserRow | undefined;
    return user || null;
  } catch (_) {
    return null;
  }
}

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
    if (existing) {
      return res.status(409).json({ error: 'A user with this email already exists' });
    }

    // Check if this is the very first user created
    const userCount = (db.prepare('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number }).cnt;
    const role = userCount === 0 ? 'admin' : 'member';

    const id = `usr_${crypto.randomBytes(6).toString('hex')}`;
    const password_hash = await bcrypt.hash(password, 10);
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO users (id, name, email, phone, password_hash, role, created_at, last_login_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, name.trim(), cleanEmail, phone || '', password_hash, role, now, now);

    const token = jwt.sign({ id, email: cleanEmail, role }, JWT_SECRET, { expiresIn: '30d' });

    res.cookie('token', token, {
      httpOnly: true,
      secure: false, // allow local network http/https
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    // Notify clients of user list update
    liveSync.broadcast('bootstrap_updated');

    return res.json({
      ok: true,
      user: {
        id,
        name: name.trim(),
        email: cleanEmail,
        phone: phone || '',
        role,
        favorites_json: '[]',
      },
      token,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(cleanEmail) as UserRow | undefined;
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const now = new Date().toISOString();
    db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(now, user.id);

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '30d' });

    res.cookie('token', token, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    return res.json({
      ok: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        default_room_id: user.default_room_id,
        theme_preference: user.theme_preference,
        favorites_json: user.favorites_json,
      },
      token,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Me
router.get('/me', (req, res) => {
  const token = req.cookies?.token || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);
  const user = getUserFromToken(token);
  if (!user) {
    return res.status(401).json({ authenticated: false });
  }

  return res.json({
    authenticated: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      default_room_id: user.default_room_id,
      theme_preference: user.theme_preference,
      favorites_json: user.favorites_json,
    },
  });
});

// Logout
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  return res.json({ ok: true });
});

// Verify HomeKey
router.post('/verify-home-key', (req, res) => {
  const { homeKey } = req.body;
  if (!homeKey) {
    return res.status(400).json({ error: 'HomeKey is required' });
  }

  const config = db.prepare('SELECT home_key_hash, require_home_key FROM building_config WHERE id = 1').get() as any;
  if (!config || !config.require_home_key) {
    return res.json({ valid: true });
  }

  const hash = crypto.createHash('sha256').update(homeKey.trim()).digest('hex');
  const valid = hash === config.home_key_hash;

  return res.json({ valid });
});

// Update Favorites
router.post('/favorites', (req, res) => {
  const token = req.cookies?.token || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);
  const user = getUserFromToken(token);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { favorites } = req.body;
  const jsonStr = JSON.stringify(Array.isArray(favorites) ? favorites : []);
  db.prepare('UPDATE users SET favorites_json = ? WHERE id = ?').run(jsonStr, user.id);

  return res.json({ ok: true, favorites });
});

export default router;
