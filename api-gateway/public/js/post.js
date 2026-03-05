(async () => {
  const {
    api,
    clearMessage,
    ensureAuth,
    escapeHtml,
    formatDateTime,
    message,
    parsePositiveInt,
    renderNavbar
  } = window.BlogApp;

  const user = await ensureAuth();
  renderNavbar();
  if (!user) {
    return;
  }

  const articleSlot = document.getElementById('article-slot');
  const commentsList = document.getElementById('comments-list');

  const params = new URLSearchParams(window.location.search);
  const postId = parsePositiveInt(params.get('id'));

  if (!postId) {
    message('page-message', 'ID de articulo invalido', 'error');
    articleSlot.innerHTML = '<p class="empty-note">No se encontro el articulo solicitado.</p>';
    return;
  }

  let currentPost = null;

  function renderLikeButtonContent(liked, count) {
    const heart = liked ? '❤' : '♡';
    return `<span class="engage-icon">${heart}</span><span>${Number(count || 0)} likes</span>`;
  }

  function commentItemMarkup(comment, depth = 0) {
    const replies = Array.isArray(comment.replies) ? comment.replies : [];
    const safeDepth = Math.min(depth, 6);
    const marginLeft = safeDepth * 16;

    return `
      <div class="comment-bubble" style="margin-left:${marginLeft}px">
        <p class="comment-text">${escapeHtml(comment.content)}</p>
        <div class="comment-meta">
          <span>💬 Autor ${comment.authorId}</span>
          <span>${formatDateTime(comment.createdAt)}</span>
        </div>
      </div>
      ${replies.map((reply) => commentItemMarkup(reply, depth + 1)).join('')}
    `;
  }

  function renderPost(post) {
    const tags = Array.isArray(post.tags) ? post.tags : [];
    const liked = Boolean(post.likedByViewer);
    const likesCount = Number(post.likesCount || 0);

    articleSlot.innerHTML = `
      <header class="post-header">
        <div>
          <h1 class="post-title article-title">${escapeHtml(post.title)}</h1>
          <p class="post-meta">Autor ${post.authorId} · ${formatDateTime(post.createdAt)}</p>
        </div>
        <div class="tag-cloud">
          ${
            tags.length > 0
              ? tags.map((tag) => `<span class="tag-pill">#${escapeHtml(tag)}</span>`).join('')
              : '<span class="muted">Sin tags</span>'
          }
        </div>
      </header>

      ${
        post.imageUrl
          ? `<img src="${escapeHtml(post.imageUrl)}" alt="Imagen del articulo" class="post-image" />`
          : ''
      }

      <div class="engagement-strip compact-engagement">
        <button
          class="engage-chip engage-chip-action ${liked ? 'engage-liked' : ''}"
          data-action="toggle-like"
          data-post-id="${post.id}"
          data-liked="${liked ? 'true' : 'false'}"
        >
          ${renderLikeButtonContent(liked, likesCount)}
        </button>
      </div>

      <p class="post-content article-content">${escapeHtml(post.content)}</p>
    `;
  }

  async function loadPost() {
    const post = await api(`/api/posts/${postId}`);
    currentPost = post;
    renderPost(post);
  }

  async function loadComments() {
    commentsList.innerHTML = '<p class="empty-note">Cargando comentarios...</p>';

    try {
      const comments = await api(`/api/comments/post/${postId}?nested=true`);
      if (!Array.isArray(comments) || comments.length === 0) {
        commentsList.innerHTML = '<p class="empty-note">Aun no hay comentarios.</p>';
        return;
      }

      commentsList.innerHTML = comments.map((comment) => commentItemMarkup(comment)).join('');
    } catch (error) {
      commentsList.innerHTML = '<p class="empty-note">No se pudieron cargar los comentarios.</p>';
      message('page-message', `Error cargando comentarios: ${error.message}`, 'error');
    }
  }

  articleSlot.addEventListener('click', async (event) => {
    const likeButton = event.target.closest('button[data-action="toggle-like"]');
    if (!likeButton || !currentPost) {
      return;
    }

    clearMessage('page-message');
    const liked = likeButton.dataset.liked === 'true';

    try {
      const response = liked
        ? await api(`/api/posts/${postId}/likes`, { method: 'DELETE' })
        : await api(`/api/posts/${postId}/likes`, { method: 'POST' });

      const isLiked = Boolean(response.liked);
      const likesCount = Number(response.likesCount || 0);

      likeButton.dataset.liked = isLiked ? 'true' : 'false';
      likeButton.classList.toggle('engage-liked', isLiked);
      likeButton.innerHTML = renderLikeButtonContent(isLiked, likesCount);

      currentPost.likedByViewer = isLiked;
      currentPost.likesCount = likesCount;
    } catch (error) {
      message('page-message', error.message, 'error');
    }
  });

  try {
    await Promise.all([loadPost(), loadComments()]);
  } catch (error) {
    message('page-message', error.message, 'error');
    articleSlot.innerHTML = '<p class="empty-note">No se pudo cargar el articulo.</p>';
  }
})();
