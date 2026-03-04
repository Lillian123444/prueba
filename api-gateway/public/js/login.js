(async () => {
  const { api, clearMessage, ensureGuest, message, renderNavbar, setSession } = window.BlogApp;

  renderNavbar();
  const canContinue = await ensureGuest('/posts.html');
  if (!canContinue) {
    return;
  }

  const form = document.getElementById('login-form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearMessage('form-message');

    try {
      const response = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: form.email.value,
          password: form.password.value
        })
      });

      setSession(response.token, {
        sub: response.user.id,
        name: response.user.name,
        email: response.user.email,
        role: response.user.role
      });

      window.location.replace('/posts.html');
    } catch (error) {
      message('form-message', error.message, 'error');
    }
  });
})();
