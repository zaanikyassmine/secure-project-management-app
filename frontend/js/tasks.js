document.addEventListener('DOMContentLoaded', async () => {
  App.ensureAuth();
  App.renderUserUi();

  const list = document.getElementById('task-list');
  const filter = document.getElementById('task-project-filter');
  const modal = document.getElementById('modal');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  document.getElementById('modal-close').addEventListener('click', () => modal.classList.add('hidden'));

  // Éléments pour les vues
  const listView = document.getElementById('list-view');
  const kanbanView = document.getElementById('kanban-view');
  const listViewBtn = document.getElementById('list-view-btn');
  const kanbanViewBtn = document.getElementById('kanban-view-btn');
  
  // État actuel de la vue
  let currentView = 'list';
  let tasks = [];

  async function loadProjects() {
    filter.innerHTML = '';
    const items = await App.api('/projects');
    const all = document.createElement('option'); all.value = ''; all.textContent = 'Tous'; filter.appendChild(all);
    items.forEach(p => { const o = document.createElement('option'); o.value = p.id; o.textContent = p.name; filter.appendChild(o); });
  }

  // Fonctions pour basculer entre les vues
  function switchToListView() {
    currentView = 'list';
    listView.classList.remove('hidden');
    kanbanView.classList.add('hidden');
    listViewBtn.classList.add('active');
    kanbanViewBtn.classList.remove('active');
  }

  function switchToKanbanView() {
    currentView = 'kanban';
    listView.classList.add('hidden');
    kanbanView.classList.remove('hidden');
    listViewBtn.classList.remove('active');
    kanbanViewBtn.classList.add('active');
    renderKanbanView();
  }

  // Event listeners pour les boutons de vue
  listViewBtn.addEventListener('click', switchToListView);
  kanbanViewBtn.addEventListener('click', switchToKanbanView);

  function renderListView() {
    list.innerHTML = '';
    tasks.forEach(t => {
      const row = document.createElement('div');
      row.className = 'item';
      row.innerHTML = `<div><strong>${App.escapeHtml(t.title)}</strong><div class="badge">${t.status}</div><div>${App.escapeHtml(t.description || '')}</div></div>` +
        `<div class="actions">` +
        `<button data-edit="${t.id}" class="secondary">Modifier</button>` +
        `<button data-del="${t.id}" class="secondary">Supprimer</button>` +
        `</div>`;
      row.querySelector('[data-edit]')?.addEventListener('click', () => openModal(t));
      row.querySelector('[data-del]')?.addEventListener('click', async () => { await App.api(`/tasks/${t.id}`, { method: 'DELETE' }); refresh(); });
      list.appendChild(row);
    });
  }

  function renderKanbanView() {
    // Vider les colonnes
    ['todo', 'in_progress', 'done'].forEach(status => {
      const column = document.getElementById(`${status}-tasks`);
      const count = document.getElementById(`${status}-count`);
      column.innerHTML = '';
      
      const statusTasks = tasks.filter(t => t.status === status);
      count.textContent = statusTasks.length;
      
      statusTasks.forEach(task => {
        const taskElement = createKanbanTask(task);
        column.appendChild(taskElement);
      });
    });
  }

  function createKanbanTask(task) {
    const taskEl = document.createElement('div');
    taskEl.className = 'kanban-task';
    taskEl.draggable = true;
    taskEl.dataset.taskId = task.id;
    
    taskEl.innerHTML = `
      <div class="kanban-task-title">${App.escapeHtml(task.title)}</div>
      <div class="kanban-task-description">${App.escapeHtml(task.description || '')}</div>
      <div class="kanban-task-meta">
        <span>${task.dueDate ? new Date(task.dueDate).toLocaleDateString('fr-FR') : ''}</span>
        <div class="kanban-task-actions">
          <button class="kanban-task-action" data-edit="${task.id}">✏️</button>
          <button class="kanban-task-action" data-del="${task.id}">🗑️</button>
        </div>
      </div>
    `;

    // Event listeners pour les actions
    taskEl.querySelector('[data-edit]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      openModal(task);
    });
    taskEl.querySelector('[data-del]')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm('Supprimer cette tâche ?')) {
        await App.api(`/tasks/${task.id}`, { method: 'DELETE' });
        refresh();
      }
    });

    // Drag and drop events
    taskEl.addEventListener('dragstart', handleDragStart);
    taskEl.addEventListener('dragend', handleDragEnd);

    return taskEl;
  }

  // Drag and Drop handlers
  let draggedTask = null;

  function handleDragStart(e) {
    draggedTask = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.outerHTML);
  }

  function handleDragEnd(e) {
    this.classList.remove('dragging');
    draggedTask = null;
  }

  // Setup drop zones
  function setupDropZones() {
    const dropZones = document.querySelectorAll('.kanban-tasks');
    
    dropZones.forEach(zone => {
      zone.addEventListener('dragover', handleDragOver);
      zone.addEventListener('drop', handleDrop);
      zone.addEventListener('dragenter', handleDragEnter);
      zone.addEventListener('dragleave', handleDragLeave);
    });
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  function handleDragEnter(e) {
    e.preventDefault();
    this.classList.add('drag-over');
  }

  function handleDragLeave(e) {
    if (!this.contains(e.relatedTarget)) {
      this.classList.remove('drag-over');
    }
  }

  async function handleDrop(e) {
    e.preventDefault();
    this.classList.remove('drag-over');
    
    if (draggedTask) {
      const newStatus = this.id.replace('-tasks', '');
      const taskId = draggedTask.dataset.taskId;
      
      try {
        console.log(`Déplacement de la tâche ${taskId} vers ${newStatus}`);
        
        // Mettre à jour le statut via l'API
        const response = await App.api(`/tasks/${taskId}/status`, { 
          method: 'PATCH', 
          body: JSON.stringify({ status: newStatus }),
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        console.log('Déplacement réussi, rafraîchissement de la vue...');
        
        // Rafraîchir la vue
        await refresh();
        
        // Animation pour la nouvelle position
        const newTaskElement = document.querySelector(`[data-task-id="${taskId}"]`);
        if (newTaskElement) {
          newTaskElement.classList.add('task-added');
          setTimeout(() => newTaskElement.classList.remove('task-added'), 300);
        }
        
      } catch (error) {
        console.error('Erreur détaillée lors du déplacement de la tâche:', error);
        console.error('Type d\'erreur:', typeof error);
        console.error('Propriétés de l\'erreur:', Object.keys(error));
        
        let errorMessage = 'Erreur inconnue';
        if (error.error) {
          errorMessage = error.error;
        } else if (error.message) {
          errorMessage = error.message;
        } else if (typeof error === 'string') {
          errorMessage = error;
        }
        
        alert(`Erreur lors du déplacement de la tâche: ${errorMessage}`);
      }
    }
  }

  async function refresh() {
    const params = filter.value ? `?projectId=${filter.value}` : '';
    tasks = await App.api(`/tasks${params}`);
    
    if (currentView === 'list') {
      renderListView();
    } else {
      renderKanbanView();
    }
  }

  function openModal(task) {
    modalTitle.textContent = task ? 'Modifier la tâche' : 'Nouvelle tâche';
    const projectOptions = Array.from(filter.options).filter(o => o.value).map(o => `<option value="${o.value}">${App.escapeHtml(o.textContent)}</option>`).join('');
    modalBody.innerHTML = `
      <form id="task-form">
        <label>Projet<select name="projectId" required>${projectOptions}</select></label>
        <label>Titre<input name="title" required minlength="2" value="${task ? App.escapeAttr(task.title) : ''}" /></label>
        <label>Description<textarea name="description">${task ? App.escapeHtml(task.description || '') : ''}</textarea></label>
        <label>Statut<select name="status">
          <option value="todo" ${task && task.status==='todo'?'selected':''}>À faire</option>
          <option value="in_progress" ${task && task.status==='in_progress'?'selected':''}>En cours</option>
          <option value="done" ${task && task.status==='done'?'selected':''}>Fait</option>
        </select></label>
        <button type="submit">${task ? 'Mettre à jour' : 'Créer'}</button>
      </form>
    `;
    modal.classList.remove('hidden');
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
      if (task) await App.api(`/tasks/${task.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      else await App.api('/tasks', { method: 'POST', body: JSON.stringify(payload) });
      modal.classList.add('hidden');
      refresh();
    });
  }

  document.getElementById('new-task-btn').addEventListener('click', () => openModal(null));
  filter.addEventListener('change', refresh);
  await loadProjects();
  setupDropZones(); // Initialiser les zones de drop
  refresh();
});





