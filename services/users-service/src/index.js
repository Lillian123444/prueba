require('dotenv').config();

const cors = require('cors');
const express = require('express');
const { pool, waitForDatabase, initDatabase } = require('./db');

const app = express();
const port = Number(process.env.PORT || 3002);
const allowedRoles = new Set(['admin', 'author', 'reader']);

app.use(cors());
app.use(express.json());

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizeRole(role, defaultRole = 'reader') {
  const normalized = String(role || defaultRole).trim().toLowerCase();
  return allowedRoles.has(normalized) ? normalized : null;
}

function mapUser(user, includeSecret = false) {
  if (!user) {
    return null;
  }

  const mapped = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    bio: user.bio,
    avatarUrl: user.avatar_url,
    createdAt: user.created_at,
    updatedAt: user.updated_at
  };

  if (includeSecret) {
    mapped.passwordHash = user.password_hash;
  }

  return mapped;
}

app.get('/health', async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ status: 'ok', service: 'users-service' });
});

app.post('/users', async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = normalizeEmail(req.body.email);
  const passwordHash = String(req.body.passwordHash || '');
  const role = normalizeRole(req.body.role);

  if (!name || !email || !passwordHash) {
    return res.status(400).json({ message: 'name, email and passwordHash are required' });
  }

  if (!role) {
    return res.status(400).json({ message: 'Role must be admin, author or reader' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name, email, passwordHash, role]
    );

    return res.status(201).json(mapUser(result.rows[0]));
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ message: 'Email already exists' });
    }

    console.error('POST /users error', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/users', async (_req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users ORDER BY created_at DESC');
    return res.json(result.rows.map((row) => mapUser(row)));
  } catch (error) {
    console.error('GET /users error', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/users/:id', async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: 'Invalid user id' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.json(mapUser(result.rows[0]));
  } catch (error) {
    console.error('GET /users/:id error', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/internal/users/by-email/:email', async (req, res) => {
  const email = normalizeEmail(decodeURIComponent(req.params.email));

  if (!email) {
    return res.status(400).json({ message: 'Invalid email' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.json(mapUser(result.rows[0], true));
  } catch (error) {
    console.error('GET /internal/users/by-email/:email error', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

app.patch('/users/:id', async (req, res) => {
  const id = Number(req.params.id);
  const name = req.body.name === undefined ? null : String(req.body.name || '').trim();
  const bio = req.body.bio === undefined ? null : String(req.body.bio || '').trim();
  const avatarUrl = req.body.avatarUrl === undefined ? null : String(req.body.avatarUrl || '').trim();

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: 'Invalid user id' });
  }

  try {
    const result = await pool.query(
      `UPDATE users
       SET
         name = COALESCE($1, name),
         bio = COALESCE($2, bio),
         avatar_url = COALESCE($3, avatar_url),
         updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [name, bio, avatarUrl, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.json(mapUser(result.rows[0]));
  } catch (error) {
    console.error('PATCH /users/:id error', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

app.delete('/users/:id', async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: 'Invalid user id' });
  }

  try {
    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(204).send();
  } catch (error) {
    console.error('DELETE /users/:id error', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

async function start() {
  try {
    await waitForDatabase();
    await initDatabase();

    app.listen(port, () => {
      console.log(`users-service running on port ${port}`);
    });
  } catch (error) {
    console.error('Unable to start users-service', error);
    process.exit(1);
  }
}

start();
