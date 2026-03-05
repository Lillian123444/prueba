(() => {
  const ROLE_LABELS = {
    admin: 'Administrador',
    author: 'Autor',
    reader: 'Lector'
  };

  function getToken() {
    return localStorage.getItem('blog_token') || '';
  }

  function getUser() {
    const raw = localStorage.getItem('blog_user');
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw);
    } catch (_error) {
      localStorage.removeItem('blog_user');
      return null;
    }
  }

  function setSession(token, user) {
    localStorage.setItem('blog_token', token);
    localStorage.setItem('blog_user', JSON.stringify(user));
  }

  function clearSession() {
    localStorage.removeItem('blog_token');
    localStorage.removeItem('blog_user');
  }

  async function api(path, options = {}) {
    const isFormData = options.body instanceof FormData;
    const headers = {
      ...(options.headers || {})
    };

    if (!isFormData && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const token = getToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(path, {
      ...options,
      headers
    });

    if (response.status === 204) {
      return null;
    }

    let data = {};
    try {
      data = await response.json();
    } catch (_error) {
      data = {};
    }

    if (!response.ok) {
      throw new Error(data.message || 'Request failed');
    }

    return data;
  }

  async function verifySession() {
    const token = getToken();
    if (!token) {
      return null;
    }

    try {
      const result = await api('/api/auth/verify');
      const payload = result.user || {};
      const current = getUser() || {};
      const merged = {
        sub: payload.sub,
        name: payload.name || current.name || '',
        email: payload.email || current.email || '',
        role: payload.role || current.role || 'reader'
      };

      localStorage.setItem('blog_user', JSON.stringify(merged));
      return merged;
    } catch (_error) {
      clearSession();
      return null;
    }
  }

  function roleLabel(role) {
    return ROLE_LABELS[role] || role;
  }

  function hasRole(user, roles) {
    return Boolean(user && roles.includes(user.role));
  }

  async function ensureAuth(options = {}) {
    const { roles = [], redirectTo = '/login.html' } = options;
    const user = await verifySession();

    if (!user) {
      window.location.replace(redirectTo);
      return null;
    }

    if (roles.length > 0 && !hasRole(user, roles)) {
      window.location.replace('/posts.html');
      return null;
    }

    return user;
  }

  async function ensureGuest(redirectTo = '/posts.html') {
    const user = await verifySession();
    if (user) {
      window.location.replace(redirectTo);
      return false;
    }

    return true;
  }

  function navLink(href, label, isActive) {
    const activeClasses = isActive
      ? 'bg-cyan-500/20 text-cyan-200 ring-1 ring-cyan-400/40'
      : 'text-slate-300 hover:text-cyan-200';
    return `<a href="${href}" class="rounded-full px-3 py-1.5 text-sm font-semibold transition ${activeClasses}">${label}</a>`;
  }

  function renderNavbar(targetId = 'nav-slot') {
    const target = document.getElementById(targetId);
    if (!target) {
      return;
    }

    const user = getUser();
    const pathname = window.location.pathname.toLowerCase();
    const isActive = (href) => pathname === href.toLowerCase();

    const publicLinks = [
      navLink('/login.html', 'Login', isActive('/login.html')),
      navLink('/register.html', 'Registro', isActive('/register.html'))
    ];

    const privateLinks = [
      navLink('/posts.html', 'Posts', isActive('/posts.html'))
    ];

    if (user && hasRole(user, ['admin', 'author'])) {
      privateLinks.push(navLink('/my-posts.html', 'Mis posts', isActive('/my-posts.html')));
    }

    privateLinks.push(navLink('/profile.html', 'Perfil', isActive('/profile.html')));

    if (user?.role === 'admin') {
      privateLinks.push(navLink('/admin.html', 'Admin', isActive('/admin.html')));
    }

    const links = user ? privateLinks : publicLinks;

    target.innerHTML = `
      <div class="w-full border-b border-slate-700/60 bg-slate-950/90 backdrop-blur">
        <div class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <a href="/posts.html" class="text-lg font-bold text-slate-100">Blog Microservicios</a>
          <div class="flex flex-wrap items-center gap-2">
            ${links.join('')}
            ${
              user
                ? `<span class="rounded-full bg-cyan-500/15 px-3 py-1 text-xs font-semibold text-cyan-200 ring-1 ring-cyan-400/30">${roleLabel(user.role)}</span>
                   <button id="logout-btn" class="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-100 hover:border-cyan-400/50 hover:text-cyan-200">Salir</button>`
                : ''
            }
          </div>
        </div>
      </div>
    `;

    const logoutButton = document.getElementById('logout-btn');
    if (logoutButton) {
      logoutButton.addEventListener('click', () => {
        clearSession();
        window.location.replace('/login.html');
      });
    }
  }

  function escapeHtml(text) {
    return String(text)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function formatDateTime(value, options = {}) {
    const {
      locale = 'es-BO',
      dateStyle = 'medium',
      timeStyle = 'short'
    } = options;

    try {
      return new Date(value).toLocaleString(locale, { dateStyle, timeStyle });
    } catch (_error) {
      return String(value || '');
    }
  }

  function parsePositiveInt(rawValue) {
    const parsed = Number(rawValue);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return null;
    }
    return parsed;
  }

  function message(targetId, text, variant = 'info') {
    const element = document.getElementById(targetId);
    if (!element) {
      return;
    }

    const styles = {
      info: 'bg-cyan-500/10 text-cyan-200 border-cyan-400/30',
      error: 'bg-red-500/10 text-red-200 border-red-400/35',
      success: 'bg-emerald-500/10 text-emerald-200 border-emerald-400/35'
    };

    element.className = `rounded-lg border px-3 py-2 text-sm ${styles[variant] || styles.info}`;
    element.textContent = text;
    element.classList.remove('hidden');
  }

  function clearMessage(targetId) {
    const element = document.getElementById(targetId);
    if (!element) {
      return;
    }

    element.classList.add('hidden');
    element.textContent = '';
  }

  window.BlogApp = {
    api,
    clearMessage,
    clearSession,
    ensureAuth,
    ensureGuest,
    escapeHtml,
    formatDateTime,
    getToken,
    getUser,
    hasRole,
    message,
    parsePositiveInt,
    renderNavbar,
    roleLabel,
    setSession,
    verifySession
  };
})();
