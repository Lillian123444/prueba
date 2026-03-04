(async () => {
  const { api, ensureAuth, escapeHtml, message, renderNavbar, roleLabel } = window.BlogApp;

  const user = await ensureAuth({ roles: ['admin'] });
  renderNavbar();
  if (!user) {
    return;
  }

  const tbody = document.getElementById('users-tbody');

  function setText(id, value) {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = String(value ?? 0);
    }
  }

  function listMarkup(items, emptyMessage, mapFn) {
    if (!Array.isArray(items) || items.length === 0) {
      return `<li class="rounded-md border border-dashed border-slate-300 p-2 text-slate-500">${escapeHtml(emptyMessage)}</li>`;
    }

    return items.map(mapFn).join('');
  }

  try {
    const [users, stats] = await Promise.all([
      api('/api/users'),
      api('/api/admin/stats')
    ]);

    setText('stat-total-users', stats.users?.totalUsers || 0);
    setText('stat-total-posts', stats.posts?.totalPosts || 0);
    setText('stat-total-likes', stats.posts?.totalLikes || 0);
    setText('stat-total-comments', stats.comments?.totalComments || 0);
    setText('stat-admin-count', stats.users?.byRole?.admin || 0);
    setText('stat-author-count', stats.users?.byRole?.author || 0);
    setText('stat-reader-count', stats.users?.byRole?.reader || 0);
    setText('stat-total-tags', stats.posts?.totalTags || 0);

    const topTagsList = document.getElementById('top-tags-list');
    topTagsList.innerHTML = listMarkup(
      stats.posts?.topTags,
      'No hay tags aun',
      (item) => `<li class="rounded-md border border-slate-200 bg-slate-50 px-3 py-2"><span class="font-semibold">#${escapeHtml(item.name)}</span> - ${item.usageCount} uso(s)</li>`
    );

    const topPostsList = document.getElementById('top-posts-list');
    topPostsList.innerHTML = listMarkup(
      stats.posts?.mostLikedPosts,
      'No hay likes aun',
      (item) => `<li class="rounded-md border border-slate-200 bg-slate-50 px-3 py-2"><span class="font-semibold">${escapeHtml(item.title)}</span> - ${item.likesCount} like(s)</li>`
    );

    if (users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="px-4 py-4 text-center text-sm text-slate-500">Sin usuarios</td></tr>';
      return;
    }

    tbody.innerHTML = users
      .map(
        (item) => `
          <tr class="border-t border-slate-200">
            <td class="px-4 py-3 text-sm text-slate-700">${item.id}</td>
            <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(item.name)}</td>
            <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(item.email)}</td>
            <td class="px-4 py-3 text-sm text-slate-700">${roleLabel(item.role)}</td>
          </tr>
        `
      )
      .join('');
  } catch (error) {
    message('page-message', error.message, 'error');
  }
})();
