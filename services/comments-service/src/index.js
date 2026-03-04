require('dotenv').config();

const axios = require('axios');
const cors = require('cors');
const express = require('express');
const { pool, waitForDatabase, initDatabase } = require('./db');

const app = express();
const port = Number(process.env.PORT || 3004);
const usersServiceUrl = process.env.USERS_SERVICE_URL || 'http://localhost:3002';
const postsServiceUrl = process.env.POSTS_SERVICE_URL || 'http://localhost:3003';
const allowedRoles = new Set(['admin', 'author', 'reader']);

app.use(cors());
app.use(express.json());

function mapComment(row) {
  return {
    id: row.id,
    postId: row.post_id,
    authorId: row.author_id,
    parentCommentId: row.parent_comment_id,
    content: row.content,
    createdAt: row.created_at
  };
}

function normalizeRole(role, fallback = 'reader') {
  const normalized = String(role || fallback).trim().toLowerCase();
  return allowedRoles.has(normalized) ? normalized : null;
}

function buildNestedComments(rows) {
  const byId = new Map();
  const roots = [];

  for (const row of rows) {
    const node = {
      ...mapComment(row),
      replies: []
    };
    byId.set(node.id, node);
  }

  for (const row of rows) {
    const node = byId.get(row.id);
    if (row.parent_comment_id && byId.has(row.parent_comment_id)) {
      byId.get(row.parent_comment_id).replies.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

async function userExists(userId) {
  try {
    await axios.get(`${usersServiceUrl}/users/${userId}`);
    return true;
  } catch (error) {
    if (error.response?.status === 404) {
      return false;
    }
    throw error;
  }
}

async function postExists(postId) {
  try {
    await axios.get(`${postsServiceUrl}/internal/posts/${postId}`);
    return true;
  } catch (error) {
    if (error.response?.status === 404) {
      return false;
    }
    throw error;
  }
}

app.get('/health', async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ status: 'ok', service: 'comments-service' });
});

app.get('/comments/post/:postId', async (req, res) => {
  const postId = Number(req.params.postId);
  const nested = String(req.query.nested || 'false').toLowerCase() === 'true';

  if (!Number.isInteger(postId) || postId <= 0) {
    return res.status(400).json({ message: 'Invalid post id' });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM comments WHERE post_id = $1 ORDER BY created_at ASC',
      [postId]
    );

    if (nested) {
      return res.json(buildNestedComments(result.rows));
    }

    return res.json(result.rows.map(mapComment));
  } catch (error) {
    console.error('GET /comments/post/:postId error', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/comments', async (req, res) => {
  const postId = Number(req.body.postId);
  const authorId = Number(req.body.authorId);
  const role = normalizeRole(req.body.role);
  const parentCommentIdRaw = req.body.parentCommentId;
  const hasParent = parentCommentIdRaw !== undefined && parentCommentIdRaw !== null && parentCommentIdRaw !== '';
  const parentCommentId = hasParent ? Number(parentCommentIdRaw) : null;
  const content = String(req.body.content || '').trim();

  if (!Number.isInteger(postId) || postId <= 0 || !Number.isInteger(authorId) || authorId <= 0 || !content || !role) {
    return res.status(400).json({ message: 'postId, authorId, role and content are required' });
  }

  if (hasParent && (!Number.isInteger(parentCommentId) || parentCommentId <= 0)) {
    return res.status(400).json({ message: 'Invalid parentCommentId' });
  }

  try {
    const [validUser, validPost] = await Promise.all([
      userExists(authorId),
      postExists(postId)
    ]);

    if (!validUser) {
      return res.status(400).json({ message: 'Author does not exist' });
    }

    if (!validPost) {
      return res.status(400).json({ message: 'Post does not exist' });
    }

    if (hasParent) {
      const parentResult = await pool.query(
        'SELECT id, post_id FROM comments WHERE id = $1',
        [parentCommentId]
      );

      if (parentResult.rowCount === 0) {
        return res.status(400).json({ message: 'Parent comment does not exist' });
      }

      if (Number(parentResult.rows[0].post_id) !== postId) {
        return res.status(400).json({ message: 'Parent comment belongs to another post' });
      }
    }

    const result = await pool.query(
      `INSERT INTO comments (post_id, author_id, parent_comment_id, content)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [postId, authorId, parentCommentId, content]
    );

    return res.status(201).json(mapComment(result.rows[0]));
  } catch (error) {
    console.error('POST /comments error', error.message);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

app.delete('/comments/:id', async (req, res) => {
  const id = Number(req.params.id);
  const authorId = Number(req.body.authorId);
  const role = normalizeRole(req.body.role);

  if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(authorId) || authorId <= 0 || !role) {
    return res.status(400).json({ message: 'Invalid comment id, author id or role' });
  }

  try {
    const query = role === 'admin'
      ? 'DELETE FROM comments WHERE id = $1 RETURNING id'
      : 'DELETE FROM comments WHERE id = $1 AND author_id = $2 RETURNING id';

    const params = role === 'admin' ? [id] : [id, authorId];
    const result = await pool.query(query, params);

    if (result.rowCount === 0) {
      const existing = await pool.query('SELECT id FROM comments WHERE id = $1', [id]);
      if (existing.rowCount === 0) {
        return res.status(404).json({ message: 'Comment not found' });
      }

      return res.status(403).json({ message: 'You can only delete your own comments' });
    }

    return res.status(204).send();
  } catch (error) {
    console.error('DELETE /comments/:id error', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/comments/stats', async (_req, res) => {
  try {
    const [totalResult, rootResult, replyResult] = await Promise.all([
      pool.query('SELECT COUNT(*)::int AS total_comments FROM comments'),
      pool.query('SELECT COUNT(*)::int AS root_comments FROM comments WHERE parent_comment_id IS NULL'),
      pool.query('SELECT COUNT(*)::int AS reply_comments FROM comments WHERE parent_comment_id IS NOT NULL')
    ]);

    return res.json({
      totalComments: totalResult.rows[0].total_comments,
      rootComments: rootResult.rows[0].root_comments,
      replyComments: replyResult.rows[0].reply_comments
    });
  } catch (error) {
    console.error('GET /comments/stats error', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

async function start() {
  try {
    await waitForDatabase();
    await initDatabase();

    app.listen(port, () => {
      console.log(`comments-service running on port ${port}`);
    });
  } catch (error) {
    console.error('Unable to start comments-service', error);
    process.exit(1);
  }
}

start();
