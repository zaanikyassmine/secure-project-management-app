const API_BASE = '/api';
let authToken = localStorage.getItem('authToken') || '';
let currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) throw await res.json().catch(() => ({ error: 'Erreur' }));
  return res.json();
}

function ensureAuth() {
  if (!currentUser || !authToken) {
    window.location.href = '/index.html';
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s]));
}
function escapeAttr(str) { return escapeHtml(str).replace(/"/g, '&quot;'); }

function renderUserUi() {
  const el = document.getElementById('user-info');
  if (el && currentUser) {
    el.innerHTML = `
      <div style="font-weight: 600;">${escapeHtml(currentUser.name)}</div>
      <div style="font-size: 12px; opacity: 0.7; text-transform: uppercase;">${currentUser.role === 'admin' ? '👑 Admin' : '👤 Utilisateur'}</div>
    `;
  }
  
  // Afficher/masquer les éléments admin
  const adminElements = document.querySelectorAll('.admin-only');
  adminElements.forEach(element => {
    if (currentUser && currentUser.role === 'admin') {
      element.style.display = element.tagName.toLowerCase() === 'a' ? 'flex' : 'block';
    } else {
      element.style.display = 'none';
    }
  });
  
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', () => {
    authToken = '';
    currentUser = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    window.location.href = '/index.html';
  });
}

window.App = { api, ensureAuth, escapeHtml, escapeAttr, renderUserUi };





