const API_BASE = '/api';
let authToken = localStorage.getItem('authToken') || '';
let currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');

const els = {
  authSection: document.getElementById('auth-section'),
  dashboard: document.getElementById('dashboard'),
  projects: document.getElementById('projects'),
  tasks: document.getElementById('tasks'),
  userInfo: document.getElementById('user-info'),
  logout: document.getElementById('logout-btn'),
  projectList: document.getElementById('project-list'),
  taskList: document.getElementById('task-list'),
  taskProjectFilter: document.getElementById('task-project-filter'),
  modal: document.getElementById('modal'),
  modalTitle: document.getElementById('modal-title'),
  modalBody: document.getElementById('modal-body'),
  modalClose: document.getElementById('modal-close'),
};

function show(view) {
  [els.authSection, els.dashboard, els.projects, els.tasks].forEach(v => v.classList.add('hidden'));
  view.classList.remove('hidden');
}

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) throw await res.json().catch(() => ({ error: 'Erreur' }));
  return res.json();
}

function renderUser() {
  if (currentUser) {
    els.userInfo.textContent = `${currentUser.name} (${currentUser.role})`;
  } else {
    els.userInfo.textContent = '';
  }
}

function requireAuthUI() {
  if (!currentUser) {
    show(els.authSection);
  } else {
    show(els.dashboard);
    refreshStats();
    refreshProjects();
    refreshTasks();
  }
}

async function refreshStats() {
  const projects = await api('/projects');
  const tasks = await api('/tasks');
  document.getElementById('stat-projects').textContent = projects.length;
  document.getElementById('stat-tasks').textContent = tasks.length;
  const todo = tasks.filter(t => t.status === 'todo').length;
  document.getElementById('stat-todo').textContent = todo;
}

async function refreshProjects() {
  if (!currentUser) return;
  const items = await api('/projects');
  els.projectList.innerHTML = '';
  els.taskProjectFilter.innerHTML = '<option value="">Tous</option>';
  items.forEach(p => {
    const row = document.createElement('div');
    row.className = 'item';
    row.innerHTML = `<div><strong>${escapeHtml(p.name)}</strong><div class="badge">#${p.id}</div><div>${escapeHtml(p.description || '')}</div></div>` +
      `<div class="actions">` +
      `<button data-edit="${p.id}" class="secondary">Modifier</button>` +
      `<button data-del="${p.id}" class="secondary">Supprimer</button>` +
      `</div>`;
    row.querySelector('[data-edit]')?.addEventListener('click', () => openProjectModal(p));
    row.querySelector('[data-del]')?.addEventListener('click', () => deleteProject(p.id));
    els.projectList.appendChild(row);
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    els.taskProjectFilter.appendChild(opt);
  });
}

async function refreshTasks() {
  if (!currentUser) return;
  const params = els.taskProjectFilter.value ? `?projectId=${els.taskProjectFilter.value}` : '';
  const items = await api(`/tasks${params}`);
  els.taskList.innerHTML = '';
  items.forEach(t => {
    const row = document.createElement('div');
    row.className = 'item';
    row.innerHTML = `<div><strong>${escapeHtml(t.title)}</strong><div class="badge">${t.status}</div><div>${escapeHtml(t.description || '')}</div></div>` +
      `<div class="actions">` +
      `<button data-edit="${t.id}" class="secondary">Modifier</button>` +
      `<button data-del="${t.id}" class="secondary">Supprimer</button>` +
      `</div>`;
    row.querySelector('[data-edit]')?.addEventListener('click', () => openTaskModal(t));
    row.querySelector('[data-del]')?.addEventListener('click', () => deleteTask(t.id));
    els.taskList.appendChild(row);
  });
}

function openModal(title, bodyHtml) {
  els.modalTitle.textContent = title;
  els.modalBody.innerHTML = bodyHtml;
  els.modal.classList.remove('hidden');
}
function closeModal() { els.modal.classList.add('hidden'); }

function openProjectModal(project) {
  openModal(project ? 'Modifier le projet' : 'Nouveau projet', `
    <form id="project-form">
      <label>Nom<input name="name" required minlength="2" value="${project ? escapeAttr(project.name) : ''}" /></label>
      <label>Description<textarea name="description">${project ? escapeHtml(project.description || '') : ''}</textarea></label>
      <button type="submit">${project ? 'Mettre à jour' : 'Créer'}</button>
    </form>
  `);
  document.getElementById('project-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const payload = { name: form.name.value, description: form.description.value };
    if (project) await api(`/projects/${project.id}`, { method: 'PUT', body: JSON.stringify(payload) });
    else await api('/projects', { method: 'POST', body: JSON.stringify(payload) });
    closeModal();
    refreshProjects();
    refreshStats();
  });
}

function openTaskModal(task) {
  const projectOptions = Array.from(els.taskProjectFilter.options).filter(o => o.value).map(o => `<option value="${o.value}">${escapeHtml(o.textContent)}</option>`).join('');
  openModal(task ? 'Modifier la tâche' : 'Nouvelle tâche', `
    <form id="task-form">
      <label>Projet<select name="projectId" required>${projectOptions}</select></label>
      <label>Titre<input name="title" required minlength="2" value="${task ? escapeAttr(task.title) : ''}" /></label>
      <label>Description<textarea name="description">${task ? escapeHtml(task.description || '') : ''}</textarea></label>
      <label>Statut<select name="status">
        <option value="todo" ${task && task.status==='todo'?'selected':''}>À faire</option>
        <option value="in_progress" ${task && task.status==='in_progress'?'selected':''}>En cours</option>
        <option value="done" ${task && task.status==='done'?'selected':''}>Fait</option>
      </select></label>
      <button type="submit">${task ? 'Mettre à jour' : 'Créer'}</button>
    </form>
  `);
  const form = document.getElementById('task-form');
  if (task) form.projectId.value = task.projectId;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      projectId: parseInt(form.projectId.value, 10),
      title: form.title.value,
      description: form.description.value,
      status: form.status.value,
    };
    if (task) await api(`/tasks/${task.id}`, { method: 'PUT', body: JSON.stringify(payload) });
    else await api('/tasks', { method: 'POST', body: JSON.stringify(payload) });
    closeModal();
    refreshTasks();
    refreshStats();
  });
}

async function deleteProject(id) {
  await api(`/projects/${id}`, { method: 'DELETE' });
  refreshProjects();
  refreshStats();
}
async function deleteTask(id) {
  await api(`/tasks/${id}`, { method: 'DELETE' });
  refreshTasks();
  refreshStats();
}

// Auth forms
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  try {
    const data = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: form.email.value, password: form.password.value })
    });
    authToken = data.token; currentUser = data.user;
    localStorage.setItem('authToken', authToken);
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    renderUser();
    requireAuthUI();
  } catch (err) {
    alert(err.error || 'Erreur de connexion');
  }
});

document.getElementById('register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  try {
    const data = await api('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name: form.name.value, email: form.email.value, password: form.password.value })
    });
    authToken = data.token; currentUser = data.user;
    localStorage.setItem('authToken', authToken);
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    renderUser();
    requireAuthUI();
  } catch (err) {
    alert(err.error || 'Erreur d\'inscription');
  }
});

// Nav
document.querySelectorAll('.nav-btn').forEach(btn => btn.addEventListener('click', () => {
  if (!currentUser) return requireAuthUI();
  const view = btn.dataset.view;
  if (view === 'dashboard') show(els.dashboard);
  if (view === 'projects') { show(els.projects); refreshProjects(); }
  if (view === 'tasks') { show(els.tasks); refreshTasks(); }
}));

document.getElementById('new-project-btn').addEventListener('click', () => openProjectModal(null));
document.getElementById('new-task-btn').addEventListener('click', () => openTaskModal(null));
els.taskProjectFilter.addEventListener('change', refreshTasks);
els.modalClose.addEventListener('click', closeModal);
els.logout.addEventListener('click', () => {
  authToken = '';
  currentUser = null;
  localStorage.removeItem('authToken');
  localStorage.removeItem('currentUser');
  renderUser();
  requireAuthUI();
});

function escapeHtml(str) {
  return String(str).replace(/[&<>\"]/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[s]));
}
function escapeAttr(str) { return escapeHtml(str).replace(/\"/g, '&quot;'); }

renderUser();
requireAuthUI();


