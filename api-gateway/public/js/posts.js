(async () => {
  const {
    api,
    clearMessage,
    clearSession,
    ensureAuth,
    escapeHtml,
    hasRole,
    message,
    renderNavbar
  } = window.BlogApp;

  const user = await ensureAuth();
  renderNavbar();
  if (!user) {
    return;
  }

  const state = {
    page: 1,
    limit: 10,
    q: '',
    tag: '',
    totalPages: 1,
    total: 0
  };

  const createSection = document.getElementById('create-post-section');
  const createForm = document.getElementById('create-post-form');
  const uploadStatus = document.getElementById('upload-status');
  const postsList = document.getElementById('posts-list');
  const filtersForm = document.getElementById('filters-form');
  const searchInput = document.getElementById('search-input');
  const tagFilter = document.getElementById('tag-filter');
  const limitSelect = document.getElementById('limit-select');
  const pageInfo = document.getElementById('page-info');
  const prevPageBtn = document.getElementById('prev-page');
  const nextPageBtn = document.getElementById('next-page');
  const clearFiltersBtn = document.getElementById('clear-filters-btn');

  const canWrite = hasRole(user, ['admin', 'author']);
  createSection.classList.toggle('hidden', !canWrite);

  function buildPostsUrl() {
    const params = new URLSearchParams();
    params.set('page', String(state.page));
    params.set('limit', String(state.limit));

    if (state.q) {
      params.set('q', state.q);
    }

    if (state.tag) {
      params.set('tag', state.tag);
    }

    return `/api/posts?${params.toString()}`;
  }

  function parseTags(input) {
    return String(input || '')
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 15);
  }

  function canEditPost(post) {
    return user.role === 'admin' || (user.role === 'author' && Number(post.authorId) === Number(user.sub));
  }

  function canDeleteComment(comment) {
    return user.role === 'admin' || Number(comment.authorId) === Number(user.sub);
  }

  function likeLabel(liked, count) {
    return liked ? `Quitar Like (${count})` : `Dar Like (${count})`;
  }

  async function uploadImageIfNeeded() {
    const fileInput = document.getElementById('create-image-file');
    const urlInput = document.getElementById('create-image-url');

    if (!fileInput.files || fileInput.files.length === 0) {
      return String(urlInput.value || '').trim() || null;
    }

    uploadStatus.textContent = 'Subiendo imagen...';

    const formData = new FormData();
    formData.append('image', fileInput.files[0]);

    const uploadResult = await api('/api/uploads', {
      method: 'POST',
      body: formData
    });

    uploadStatus.textContent = `Imagen subida: ${uploadResult.filename}`;
    return uploadResult.url;
  }

  async function loadTagOptions() {
    try {
      const tags = await api('/api/tags');
      const current = tagFilter.value;

      tagFilter.innerHTML = '<option value="">Todos</option>';
      tags.forEach((tag) => {
        const option = document.createElement('option');
        option.value = tag.name;
        option.textContent = `${tag.name} (${tag.usageCount})`;
        tagFilter.appendChild(option);
      });

      if (current) {
        tagFilter.value = current;
      }
    } catch (error) {
      message('page-message', `No se pudieron cargar tags: ${error.message}`, 'error');
    }
  }

  function commentItemMarkup(comment, postId, depth = 0) {
    const safeDepth = Math.min(depth, 6);
    const margin = safeDepth * 18;
    const replies = Array.isArray(comment.replies) ? comment.replies : [];

    return `
      <div class="rounded-lg border border-slate-200 bg-slate-50 p-3" style="margin-left:${margin}px">
        <p class="text-sm text-slate-700">${escapeHtml(comment.content)}</p>
        <div class="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span>Autor ${comment.authorId}</span>
          <span>${new Date(comment.createdAt).toLocaleString()}</span>
          <button data-action="reply-comment" data-post-id="${postId}" data-comment-id="${comment.id}" class="rounded-md border border-slate-300 bg-white px-2 py-1 font-semibold text-slate-700 hover:bg-slate-100">Responder</button>
          ${
            canDeleteComment(comment)
              ? `<button data-action="delete-comment" data-post-id="${postId}" data-comment-id="${comment.id}" class="rounded-md bg-red-600 px-2 py-1 font-semibold text-white hover:bg-red-700">Eliminar</button>`
              : ''
          }
        </div>
      </div>
      ${replies.map((reply) => commentItemMarkup(reply, postId, depth + 1)).join('')}
    `;
  }

  async function loadComments(postId) {
    const container = document.querySelector(`[data-comments-for="${postId}"]`);
    if (!container) {
      return;
    }

    try {
      const comments = await api(`/api/comments/post/${postId}?nested=true`);
      if (!Array.isArray(comments) || comments.length === 0) {
        container.innerHTML = '<p class="text-sm text-slate-500">Sin comentarios.</p>';
        return;
      }

      container.innerHTML = comments.map((comment) => commentItemMarkup(comment, postId)).join('');
    } catch (error) {
      message('page-message', `Error cargando comentarios: ${error.message}`, 'error');
    }
  }

  function postCardMarkup(post) {
    const tags = Array.isArray(post.tags) ? post.tags : [];
    const tagsMarkup = tags.length > 0
      ? tags.map((tag) => `<span class="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">#${escapeHtml(tag)}</span>`).join('')
      : '<span class="text-xs text-slate-400">Sin tags</span>';

    return `
      <article class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 class="text-xl font-semibold text-slate-900">${escapeHtml(post.title)}</h3>
            <p class="mt-1 text-xs text-slate-500">Autor ${post.authorId} | ${new Date(post.createdAt).toLocaleString()}</p>
          </div>
          <div class="flex flex-wrap gap-1">${tagsMarkup}</div>
        </div>

        ${post.imageUrl ? `<img src="${escapeHtml(post.imageUrl)}" alt="Imagen del post" class="mt-3 max-h-80 w-full rounded-lg object-cover" />` : ''}

        <p class="mt-3 whitespace-pre-wrap text-slate-700">${escapeHtml(post.content)}</p>

        <div class="mt-4 flex flex-wrap items-center gap-2">
          <button data-action="toggle-like" data-post-id="${post.id}" data-liked="${post.likedByViewer ? 'true' : 'false'}" class="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
            ${likeLabel(Boolean(post.likedByViewer), Number(post.likesCount || 0))}
          </button>
          <button data-action="toggle-comments" data-post-id="${post.id}" class="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Ver comentarios</button>
          ${
            canEditPost(post)
              ? `<button data-action="edit-post" data-post-id="${post.id}" data-post-title="${encodeURIComponent(post.title || '')}" data-post-content="${encodeURIComponent(post.content || '')}" data-post-image-url="${encodeURIComponent(post.imageUrl || '')}" data-post-tags="${encodeURIComponent((post.tags || []).join(', '))}" class="rounded-md bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700">Editar</button>
                 <button data-action="delete-post" data-post-id="${post.id}" class="rounded-md bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700">Eliminar</button>`
              : ''
          }
        </div>

        <form data-action="new-comment" data-post-id="${post.id}" class="mt-4 flex gap-2">
          <input name="content" required placeholder="Escribe un comentario" class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none" />
          <button class="rounded-md bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-700">Comentar</button>
        </form>

        <div data-comments-for="${post.id}" class="mt-4 space-y-2"></div>
      </article>
    `;
  }

  function updatePaginationUi() {
    pageInfo.textContent = `Pagina ${state.page} de ${state.totalPages} (${state.total} resultados)`;
    prevPageBtn.disabled = state.page <= 1;
    nextPageBtn.disabled = state.page >= state.totalPages;

    prevPageBtn.classList.toggle('opacity-50', prevPageBtn.disabled);
    nextPageBtn.classList.toggle('opacity-50', nextPageBtn.disabled);
  }

  async function loadPosts() {
    clearMessage('page-message');

    try {
      const data = await api(buildPostsUrl());
      const items = Array.isArray(data) ? data : data.items || [];
      const pagination = data.pagination || {
        page: state.page,
        limit: state.limit,
        total: items.length,
        totalPages: 1
      };

      state.page = Number(pagination.page || state.page);
      state.limit = Number(pagination.limit || state.limit);
      state.total = Number(pagination.total || 0);
      state.totalPages = Math.max(1, Number(pagination.totalPages || 1));
      updatePaginationUi();

      if (items.length === 0) {
        postsList.innerHTML = '<p class="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">No hay publicaciones para ese filtro.</p>';
        return;
      }

      postsList.innerHTML = items.map(postCardMarkup).join('');
    } catch (error) {
      message('page-message', error.message, 'error');
    }
  }

  filtersForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    state.q = String(searchInput.value || '').trim();
    state.tag = String(tagFilter.value || '').trim();
    state.limit = Number(limitSelect.value || 10);
    state.page = 1;
    await loadPosts();
  });

  clearFiltersBtn.addEventListener('click', async () => {
    searchInput.value = '';
    tagFilter.value = '';
    limitSelect.value = '10';

    state.q = '';
    state.tag = '';
    state.limit = 10;
    state.page = 1;

    await loadPosts();
  });

  prevPageBtn.addEventListener('click', async () => {
    if (state.page <= 1) {
      return;
    }

    state.page -= 1;
    await loadPosts();
  });

  nextPageBtn.addEventListener('click', async () => {
    if (state.page >= state.totalPages) {
      return;
    }

    state.page += 1;
    await loadPosts();
  });

  createForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearMessage('page-message');

    try {
      const imageUrl = await uploadImageIfNeeded();

      await api('/api/posts', {
        method: 'POST',
        body: JSON.stringify({
          title: createForm.title.value,
          content: createForm.content.value,
          imageUrl,
          tags: parseTags(createForm.tags.value)
        })
      });

      uploadStatus.textContent = '';
      createForm.reset();
      message('page-message', 'Post creado correctamente', 'success');
      await loadTagOptions();
      await loadPosts();
    } catch (error) {
      uploadStatus.textContent = '';
      message('page-message', error.message, 'error');
    }
  });

  postsList.addEventListener('click', async (event) => {
    const button = event.target.closest('button');
    if (!button) {
      return;
    }

    const action = button.dataset.action;
    const postId = Number(button.dataset.postId);
    clearMessage('page-message');

    if (action === 'toggle-comments') {
      await loadComments(postId);
      return;
    }

    if (action === 'toggle-like') {
      const liked = button.dataset.liked === 'true';

      try {
        const response = liked
          ? await api(`/api/posts/${postId}/likes`, { method: 'DELETE' })
          : await api(`/api/posts/${postId}/likes`, { method: 'POST' });

        button.dataset.liked = response.liked ? 'true' : 'false';
        button.textContent = likeLabel(Boolean(response.liked), Number(response.likesCount || 0));
      } catch (error) {
        message('page-message', error.message, 'error');
      }
      return;
    }

    if (action === 'delete-post') {
      if (!window.confirm('Deseas eliminar este post?')) {
        return;
      }

      try {
        await api(`/api/posts/${postId}`, { method: 'DELETE' });
        message('page-message', 'Post eliminado', 'success');
        await loadTagOptions();
        await loadPosts();
      } catch (error) {
        if (String(error.message).toLowerCase().includes('invalid token')) {
          clearSession();
          window.location.replace('/login.html');
          return;
        }

        message('page-message', error.message, 'error');
      }
      return;
    }

    if (action === 'edit-post') {
      const currentTitle = decodeURIComponent(button.dataset.postTitle || '');
      const currentContent = decodeURIComponent(button.dataset.postContent || '');
      const currentTags = decodeURIComponent(button.dataset.postTags || '');
      const currentImage = decodeURIComponent(button.dataset.postImageUrl || '');

      const title = window.prompt('Nuevo titulo', currentTitle);
      if (title === null) {
        return;
      }

      const content = window.prompt('Nuevo contenido', currentContent);
      if (content === null) {
        return;
      }

      const tags = window.prompt('Tags (coma separada)', currentTags);
      if (tags === null) {
        return;
      }

      const imageUrl = window.prompt('URL de imagen (deja vacio para quitar)', currentImage);
      if (imageUrl === null) {
        return;
      }

      try {
        await api(`/api/posts/${postId}`, {
          method: 'PUT',
          body: JSON.stringify({
            title,
            content,
            tags: parseTags(tags),
            imageUrl: imageUrl.trim()
          })
        });

        message('page-message', 'Post actualizado', 'success');
        await loadTagOptions();
        await loadPosts();
      } catch (error) {
        message('page-message', error.message, 'error');
      }
      return;
    }

    if (action === 'delete-comment') {
      const commentId = Number(button.dataset.commentId);
      try {
        await api(`/api/comments/${commentId}`, { method: 'DELETE' });
        message('page-message', 'Comentario eliminado', 'success');
        await loadComments(postId);
      } catch (error) {
        message('page-message', error.message, 'error');
      }
      return;
    }

    if (action === 'reply-comment') {
      const parentCommentId = Number(button.dataset.commentId);
      const content = window.prompt('Escribe la respuesta');
      if (!content || !content.trim()) {
        return;
      }

      try {
        await api('/api/comments', {
          method: 'POST',
          body: JSON.stringify({
            postId,
            content,
            parentCommentId
          })
        });

        message('page-message', 'Respuesta publicada', 'success');
        await loadComments(postId);
      } catch (error) {
        message('page-message', error.message, 'error');
      }
    }
  });

  postsList.addEventListener('submit', async (event) => {
    const form = event.target.closest('form[data-action="new-comment"]');
    if (!form) {
      return;
    }

    event.preventDefault();
    clearMessage('page-message');

    const postId = Number(form.dataset.postId);

    try {
      await api('/api/comments', {
        method: 'POST',
        body: JSON.stringify({
          postId,
          content: form.content.value
        })
      });

      form.reset();
      message('page-message', 'Comentario agregado', 'success');
      await loadComments(postId);
    } catch (error) {
      message('page-message', error.message, 'error');
    }
  });

  await loadTagOptions();
  await loadPosts();
})();
