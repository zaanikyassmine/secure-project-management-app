document.addEventListener('DOMContentLoaded', async () => {
  App.ensureAuth();
  App.renderUserUi();

  const list = document.getElementById('project-list');
  const modal = document.getElementById('modal');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  document.getElementById('modal-close').addEventListener('click', () => modal.classList.add('hidden'));

  async function refresh() {
    list.innerHTML = '';
    const items = await App.api('/projects');
    items.forEach(p => {
      const row = document.createElement('div');
      row.className = 'item';
      row.innerHTML = `<div><strong>${App.escapeHtml(p.name)}</strong><div class="badge">#${p.id}</div><div>${App.escapeHtml(p.description || '')}</div></div>` +
        `<div class="actions">` +
        `<button data-edit="${p.id}" class="secondary">Modifier</button>` +
        `<button data-del="${p.id}" class="secondary">Supprimer</button>` +
        `</div>`;
      row.querySelector('[data-edit]')?.addEventListener('click', () => openModal(p));
      row.querySelector('[data-del]')?.addEventListener('click', async () => { await App.api(`/projects/${p.id}`, { method: 'DELETE' }); refresh(); });
      list.appendChild(row);
    });
  }

  function openModal(project) {
    modalTitle.textContent = project ? 'Modifier le projet' : 'Nouveau projet';
    modalBody.innerHTML = `
      <form id="project-form">
        <label>Nom<input name="name" required minlength="2" value="${project ? App.escapeAttr(project.name) : ''}" /></label>
        <label>Description<textarea name="description">${project ? App.escapeHtml(project.description || '') : ''}</textarea></label>
        <button type="submit">${project ? 'Mettre à jour' : 'Créer'}</button>
      </form>
    `;
    modal.classList.remove('hidden');
    document.getElementById('project-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      const payload = { name: form.name.value, description: form.description.value };
      if (project) await App.api(`/projects/${project.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      else await App.api('/projects', { method: 'POST', body: JSON.stringify(payload) });
      modal.classList.add('hidden');
      refresh();
    });
  }

  document.getElementById('new-project-btn').addEventListener('click', () => openModal(null));
  refresh();
});





