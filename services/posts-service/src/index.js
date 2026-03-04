require('dotenv').config();

const axios = require('axios');
const cors = require('cors');
const express = require('express');
const { pool, waitForDatabase, initDatabase } = require('./db');

const app = express();
const port = Number(process.env.PORT || 3003);
const usersServiceUrl = process.env.USERS_SERVICE_URL || 'http://localhost:3002';
const allowedRoles = new Set(['admin', 'author', 'reader']);
const writerRoles = new Set(['admin', 'author']);

app.use(cors());
app.use(express.json());

function normalizeRole(role, fallback = 'reader') {
  const normalized = String(role || fallback).trim().toLowerCase();
  return allowedRoles.has(normalized) ? normalized : null;
}

function normalizeTagName(tag) {
  const normalized = String(tag || '')
    .trim()
    .toLowerCase()
    .replace(/^#+/, '')
    .replace(/[^a-z0-9-_\s]/g, '')
    .replace(/\s+/g, '-');

  if (!normalized) {
    return null;
  }

  return normalized.slice(0, 60);
}

function parseTagsInput(tagsInput) {
  let raw = [];

  if (Array.isArray(tagsInput)) {
    raw = tagsInput;
  } else if (typeof tagsInput === 'string') {
    raw = tagsInput.split(',');
  }

  const unique = new Set();
  for (const item of raw) {
    const normalized = normalizeTagName(item);
    if (normalized) {
      unique.add(normalized);
    }
    if (unique.size >= 15) {
      break;
    }
  }

  return [...unique];
}

function parsePagination(query) {
  const requestedPage = Number(query.page || 1);
  const requestedLimit = Number(query.limit || 10);

  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const limit = Number.isInteger(requestedLimit) && requestedLimit > 0
    ? Math.min(requestedLimit, 50)
    : 10;

  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

function parseViewerId(input) {
  const value = Number(input);
  if (!Number.isInteger(value) || value <= 0) {
    return null;
  }
  return value;
}

function mapPost(row) {
  return {
    id: row.id,
    authorId: row.author_id,
    title: row.title,
    content: row.content,
    imageUrl: row.image_url,
    tags: Array.isArray(row.tags) ? row.tags : [],
    likesCount: Number(row.likes_count || 0),
    likedByViewer: Boolean(row.liked_by_viewer),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function buildWhereClause(filters = {}) {
  const conditions = [];
  const params = [];

  if (Number.isInteger(filters.authorId) && filters.authorId > 0) {
    params.push(filters.authorId);
    conditions.push(`p.author_id = $${params.length}`);
  }

  if (filters.q) {
    params.push(`%${filters.q.toLowerCase()}%`);
    conditions.push(`LOWER(p.title) LIKE $${params.length}`);
  }

  if (filters.tags && filters.tags.length > 0) {
    params.push(filters.tags);
    conditions.push(`
      EXISTS (
        SELECT 1
        FROM post_tags pt
        INNER JOIN tags tg ON tg.id = pt.tag_id
        WHERE pt.post_id = p.id
          AND tg.name = ANY($${params.length}::text[])
      )
    `);
  }

  return {
    whereSql: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    params
  };
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

async function resolveTagIds(client, tags) {
  const ids = [];

  for (const tag of tags) {
    const result = await client.query(
      `INSERT INTO tags (name)
       VALUES ($1)
       ON CONFLICT (name)
       DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [tag]
    );

    ids.push(result.rows[0].id);
  }

  return ids;
}

async function setPostTags(client, postId, tags) {
  await client.query('DELETE FROM post_tags WHERE post_id = $1', [postId]);

  if (tags.length === 0) {
    return;
  }

  const tagIds = await resolveTagIds(client, tags);

  for (const tagId of tagIds) {
    await client.query(
      `INSERT INTO post_tags (post_id, tag_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [postId, tagId]
    );
  }
}

async function getPostById(postId, viewerId = null) {
  const result = await pool.query(
    `SELECT
       p.*,
       COALESCE(l.likes_count, 0)::int AS likes_count,
       COALESCE(t.tags, ARRAY[]::text[]) AS tags,
       CASE WHEN v.user_id IS NULL THEN FALSE ELSE TRUE END AS liked_by_viewer
     FROM posts p
     LEFT JOIN (
       SELECT post_id, COUNT(*)::int AS likes_count
       FROM post_likes
       GROUP BY post_id
     ) l ON l.post_id = p.id
     LEFT JOIN (
       SELECT pt.post_id, ARRAY_AGG(tg.name ORDER BY tg.name) AS tags
       FROM post_tags pt
       INNER JOIN tags tg ON tg.id = pt.tag_id
       GROUP BY pt.post_id
     ) t ON t.post_id = p.id
     LEFT JOIN LATERAL (
       SELECT pl.user_id
       FROM post_likes pl
       WHERE pl.post_id = p.id AND pl.user_id = $2
       LIMIT 1
     ) v ON TRUE
     WHERE p.id = $1`,
    [postId, viewerId]
  );

  if (result.rowCount === 0) {
    return null;
  }

  return mapPost(result.rows[0]);
}

async function listPosts(filters, pagination, viewerId) {
  const where = buildWhereClause(filters);

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total
     FROM posts p
     ${where.whereSql}`,
    where.params
  );

  const total = countResult.rows[0].total;
  const totalPages = Math.max(1, Math.ceil(total / pagination.limit));
  const viewerParamIndex = where.params.length + 1;
  const limitParamIndex = where.params.length + 2;
  const offsetParamIndex = where.params.length + 3;

  const listResult = await pool.query(
    `SELECT
       p.*,
       COALESCE(l.likes_count, 0)::int AS likes_count,
       COALESCE(t.tags, ARRAY[]::text[]) AS tags,
       CASE WHEN v.user_id IS NULL THEN FALSE ELSE TRUE END AS liked_by_viewer
     FROM posts p
     LEFT JOIN (
       SELECT post_id, COUNT(*)::int AS likes_count
       FROM post_likes
       GROUP BY post_id
     ) l ON l.post_id = p.id
     LEFT JOIN (
       SELECT pt.post_id, ARRAY_AGG(tg.name ORDER BY tg.name) AS tags
       FROM post_tags pt
       INNER JOIN tags tg ON tg.id = pt.tag_id
       GROUP BY pt.post_id
     ) t ON t.post_id = p.id
     LEFT JOIN LATERAL (
       SELECT pl.user_id
       FROM post_likes pl
       WHERE pl.post_id = p.id AND pl.user_id = $${viewerParamIndex}
       LIMIT 1
     ) v ON TRUE
     ${where.whereSql}
     ORDER BY p.created_at DESC
     LIMIT $${limitParamIndex}
     OFFSET $${offsetParamIndex}`,
    [...where.params, viewerId, pagination.limit, pagination.offset]
  );

  return {
    items: listResult.rows.map(mapPost),
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages
    }
  };
}

app.get('/health', async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ status: 'ok', service: 'posts-service' });
});

app.get('/posts', async (req, res) => {
  const q = String(req.query.q || '').trim();
  const rawTags = String(req.query.tags || req.query.tag || '').trim();
  const tags = parseTagsInput(rawTags);
  const pagination = parsePagination(req.query);
  const viewerId = parseViewerId(req.query.viewerId);

  try {
    const data = await listPosts({ q, tags }, pagination, viewerId);
    return res.json(data);
  } catch (error) {
    console.error('GET /posts error', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/posts/author/:authorId', async (req, res) => {
  const authorId = Number(req.params.authorId);
  const pagination = parsePagination(req.query);
  const viewerId = parseViewerId(req.query.viewerId);

  if (!Number.isInteger(authorId) || authorId <= 0) {
    return res.status(400).json({ message: 'Invalid author id' });
  }

  try {
    const data = await listPosts({ authorId }, pagination, viewerId);
    return res.json(data);
  } catch (error) {
    console.error('GET /posts/author/:authorId error', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/posts/:id', async (req, res) => {
  const id = Number(req.params.id);
  const viewerId = parseViewerId(req.query.viewerId);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: 'Invalid post id' });
  }

  try {
    const post = await getPostById(id, viewerId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    return res.json(post);
  } catch (error) {
    console.error('GET /posts/:id error', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/internal/posts/:id', async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: 'Invalid post id' });
  }

  try {
    const result = await pool.query('SELECT * FROM posts WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Post not found' });
    }

    return res.json({
      id: result.rows[0].id,
      authorId: result.rows[0].author_id,
      title: result.rows[0].title,
      content: result.rows[0].content,
      imageUrl: result.rows[0].image_url,
      createdAt: result.rows[0].created_at,
      updatedAt: result.rows[0].updated_at
    });
  } catch (error) {
    console.error('GET /internal/posts/:id error', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/posts', async (req, res) => {
  const authorId = Number(req.body.authorId);
  const role = normalizeRole(req.body.role);
  const title = String(req.body.title || '').trim();
  const content = String(req.body.content || '').trim();
  const imageUrl = String(req.body.imageUrl || '').trim() || null;
  const tags = parseTagsInput(req.body.tags);

  if (!Number.isInteger(authorId) || authorId <= 0 || !title || !content || !role) {
    return res.status(400).json({ message: 'authorId, role, title and content are required' });
  }

  if (!writerRoles.has(role)) {
    return res.status(403).json({ message: 'Only admin or author can create posts' });
  }

  const client = await pool.connect();

  try {
    const exists = await userExists(authorId);
    if (!exists) {
      return res.status(400).json({ message: 'Author does not exist' });
    }

    await client.query('BEGIN');

    const insertResult = await client.query(
      `INSERT INTO posts (author_id, title, content, image_url)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [authorId, title, content, imageUrl]
    );

    const postId = insertResult.rows[0].id;
    await setPostTags(client, postId, tags);

    await client.query('COMMIT');

    const created = await getPostById(postId, authorId);
    return res.status(201).json(created);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('POST /posts error', error.message);
    return res.status(500).json({ message: 'Internal server error' });
  } finally {
    client.release();
  }
});

app.put('/posts/:id', async (req, res) => {
  const id = Number(req.params.id);
  const authorId = Number(req.body.authorId);
  const role = normalizeRole(req.body.role);
  const hasTitle = Object.prototype.hasOwnProperty.call(req.body, 'title');
  const hasContent = Object.prototype.hasOwnProperty.call(req.body, 'content');
  const hasImageUrl = Object.prototype.hasOwnProperty.call(req.body, 'imageUrl');
  const hasTags = Object.prototype.hasOwnProperty.call(req.body, 'tags');

  const title = hasTitle ? String(req.body.title || '').trim() : null;
  const content = hasContent ? String(req.body.content || '').trim() : null;
  const imageUrlRaw = hasImageUrl ? String(req.body.imageUrl || '').trim() : null;
  const imageUrl = hasImageUrl ? (imageUrlRaw || null) : null;
  const tags = hasTags ? parseTagsInput(req.body.tags) : null;

  if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(authorId) || authorId <= 0 || !role) {
    return res.status(400).json({ message: 'Invalid post id, author id or role' });
  }

  if (!writerRoles.has(role)) {
    return res.status(403).json({ message: 'Only admin or author can edit posts' });
  }

  if (!hasTitle && !hasContent && !hasImageUrl && !hasTags) {
    return res.status(400).json({ message: 'At least one field to update is required' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const query = role === 'admin'
      ? `UPDATE posts
         SET
           title = CASE WHEN $1 THEN $2 ELSE title END,
           content = CASE WHEN $3 THEN $4 ELSE content END,
           image_url = CASE WHEN $5 THEN $6 ELSE image_url END,
           updated_at = NOW()
         WHERE id = $7
         RETURNING id`
      : `UPDATE posts
         SET
           title = CASE WHEN $1 THEN $2 ELSE title END,
           content = CASE WHEN $3 THEN $4 ELSE content END,
           image_url = CASE WHEN $5 THEN $6 ELSE image_url END,
           updated_at = NOW()
         WHERE id = $7 AND author_id = $8
         RETURNING id`;

    const params = role === 'admin'
      ? [hasTitle, title, hasContent, content, hasImageUrl, imageUrl, id]
      : [hasTitle, title, hasContent, content, hasImageUrl, imageUrl, id, authorId];

    const updateResult = await client.query(query, params);

    if (updateResult.rowCount === 0) {
      await client.query('ROLLBACK');
      const existing = await pool.query('SELECT id FROM posts WHERE id = $1', [id]);
      if (existing.rowCount === 0) {
        return res.status(404).json({ message: 'Post not found' });
      }

      return res.status(403).json({ message: 'You can only edit your own posts' });
    }

    if (hasTags) {
      await setPostTags(client, id, tags || []);
    }

    await client.query('COMMIT');

    const updated = await getPostById(id, authorId);
    return res.json(updated);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('PUT /posts/:id error', error);
    return res.status(500).json({ message: 'Internal server error' });
  } finally {
    client.release();
  }
});

app.delete('/posts/:id', async (req, res) => {
  const id = Number(req.params.id);
  const authorId = Number(req.body.authorId);
  const role = normalizeRole(req.body.role);

  if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(authorId) || authorId <= 0 || !role) {
    return res.status(400).json({ message: 'Invalid post id, author id or role' });
  }

  if (!writerRoles.has(role)) {
    return res.status(403).json({ message: 'Only admin or author can delete posts' });
  }

  try {
    const query = role === 'admin'
      ? 'DELETE FROM posts WHERE id = $1 RETURNING id'
      : 'DELETE FROM posts WHERE id = $1 AND author_id = $2 RETURNING id';

    const params = role === 'admin' ? [id] : [id, authorId];
    const result = await pool.query(query, params);

    if (result.rowCount === 0) {
      const existing = await pool.query('SELECT id FROM posts WHERE id = $1', [id]);
      if (existing.rowCount === 0) {
        return res.status(404).json({ message: 'Post not found' });
      }

      return res.status(403).json({ message: 'You can only delete your own posts' });
    }

    return res.status(204).send();
  } catch (error) {
    console.error('DELETE /posts/:id error', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/posts/:id/likes', async (req, res) => {
  const postId = Number(req.params.id);
  const userId = Number(req.body.userId);

  if (!Number.isInteger(postId) || postId <= 0 || !Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ message: 'Invalid post id or user id' });
  }

  try {
    const post = await pool.query('SELECT id FROM posts WHERE id = $1', [postId]);
    if (post.rowCount === 0) {
      return res.status(404).json({ message: 'Post not found' });
    }

    await pool.query(
      `INSERT INTO post_likes (post_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [postId, userId]
    );

    const count = await pool.query(
      'SELECT COUNT(*)::int AS likes_count FROM post_likes WHERE post_id = $1',
      [postId]
    );

    return res.json({
      postId,
      liked: true,
      likesCount: count.rows[0].likes_count
    });
  } catch (error) {
    console.error('POST /posts/:id/likes error', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

app.delete('/posts/:id/likes', async (req, res) => {
  const postId = Number(req.params.id);
  const userId = Number(req.body.userId);

  if (!Number.isInteger(postId) || postId <= 0 || !Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ message: 'Invalid post id or user id' });
  }

  try {
    const post = await pool.query('SELECT id FROM posts WHERE id = $1', [postId]);
    if (post.rowCount === 0) {
      return res.status(404).json({ message: 'Post not found' });
    }

    await pool.query(
      'DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2',
      [postId, userId]
    );

    const count = await pool.query(
      'SELECT COUNT(*)::int AS likes_count FROM post_likes WHERE post_id = $1',
      [postId]
    );

    return res.json({
      postId,
      liked: false,
      likesCount: count.rows[0].likes_count
    });
  } catch (error) {
    console.error('DELETE /posts/:id/likes error', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/tags', async (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();

  try {
    const result = await pool.query(
      `SELECT
         t.id,
         t.name,
         COUNT(pt.post_id)::int AS usage_count
       FROM tags t
       LEFT JOIN post_tags pt ON pt.tag_id = t.id
       WHERE ($1 = '' OR LOWER(t.name) LIKE '%' || $1 || '%')
       GROUP BY t.id
       ORDER BY t.name ASC`,
      [q]
    );

    return res.json(
      result.rows.map((row) => ({
        id: row.id,
        name: row.name,
        usageCount: row.usage_count
      }))
    );
  } catch (error) {
    console.error('GET /tags error', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

async function handleStats(_req, res) {
  try {
    const [postCount, likeCount, tagCount, topTags, topPosts] = await Promise.all([
      pool.query('SELECT COUNT(*)::int AS total_posts FROM posts'),
      pool.query('SELECT COUNT(*)::int AS total_likes FROM post_likes'),
      pool.query('SELECT COUNT(*)::int AS total_tags FROM tags'),
      pool.query(
        `SELECT
           t.name,
           COUNT(pt.post_id)::int AS usage_count
         FROM tags t
         LEFT JOIN post_tags pt ON pt.tag_id = t.id
         GROUP BY t.id
         ORDER BY usage_count DESC, t.name ASC
         LIMIT 5`
      ),
      pool.query(
        `SELECT
           p.id,
           p.title,
           COUNT(pl.user_id)::int AS likes_count
         FROM posts p
         LEFT JOIN post_likes pl ON pl.post_id = p.id
         GROUP BY p.id
         ORDER BY likes_count DESC, p.created_at DESC
         LIMIT 5`
      )
    ]);

    return res.json({
      totalPosts: postCount.rows[0].total_posts,
      totalLikes: likeCount.rows[0].total_likes,
      totalTags: tagCount.rows[0].total_tags,
      topTags: topTags.rows.map((row) => ({ name: row.name, usageCount: row.usage_count })),
      mostLikedPosts: topPosts.rows.map((row) => ({
        id: row.id,
        title: row.title,
        likesCount: row.likes_count
      }))
    });
  } catch (error) {
    console.error('GET /posts/stats error', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

app.get('/stats', handleStats);
app.get('/posts/stats', handleStats);

async function start() {
  try {
    await waitForDatabase();
    await initDatabase();

    app.listen(port, () => {
      console.log(`posts-service running on port ${port}`);
    });
  } catch (error) {
    console.error('Unable to start posts-service', error);
    process.exit(1);
  }
}

start();
