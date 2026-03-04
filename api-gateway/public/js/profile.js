(async () => {
  const { api, clearMessage, ensureAuth, message, renderNavbar, roleLabel } = window.BlogApp;

  const user = await ensureAuth();
  renderNavbar();
  if (!user) {
    return;
  }

  const form = document.getElementById('profile-form');
  const roleBox = document.getElementById('profile-role');
  roleBox.textContent = roleLabel(user.role);

  try {
    const profile = await api('/api/users/me');
    form.name.value = profile.name || '';
    form.bio.value = profile.bio || '';
    form.avatarUrl.value = profile.avatarUrl || '';
    document.getElementById('profile-email').textContent = profile.email || '';
  } catch (error) {
    message('page-message', error.message, 'error');
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearMessage('page-message');

    try {
      await api('/api/users/me', {
        method: 'PATCH',
        body: JSON.stringify({
          name: form.name.value,
          bio: form.bio.value,
          avatarUrl: form.avatarUrl.value
        })
      });

      message('page-message', 'Perfil actualizado', 'success');
    } catch (error) {
      message('page-message', error.message, 'error');
    }
  });
})();
