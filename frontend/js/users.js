document.addEventListener('DOMContentLoaded', async () => {
  App.ensureAuth();
  App.renderUserUi();

  // Vérifier les droits admin (sécurité côté client)
  const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
  if (!currentUser || currentUser.role !== 'admin') {
    alert('🚫 Accès refusé - Cette page est réservée aux administrateurs');
    window.location.href = '/dashboard.html';
    return;
  }

  // Vérification supplémentaire côté serveur
  try {
    await App.api('/users'); // Test d'accès à l'API
  } catch (error) {
    if (error.error && error.error.includes('refusé')) {
      alert('🚫 Vos droits d\'accès ont été révoqués. Reconnectez-vous.');
      localStorage.removeItem('authToken');
      localStorage.removeItem('currentUser');
      window.location.href = '/index.html';
      return;
    }
  }

  const tableBody = document.getElementById('users-table-body');
  const totalUsersSpan = document.getElementById('total-users');
  const lockedUsersSpan = document.getElementById('locked-users');
  const createUserBtn = document.getElementById('create-user-btn');
  
  // Modals
  const userModal = document.getElementById('user-modal');
  const userModalTitle = document.getElementById('user-modal-title');
  const userModalBody = document.getElementById('user-modal-body');
  const userModalClose = document.getElementById('user-modal-close');
  
  const createModal = document.getElementById('create-modal');
  const createModalClose = document.getElementById('create-modal-close');
  const createUserForm = document.getElementById('create-user-form');
  const cancelCreate = document.getElementById('cancel-create');
  
  const editModal = document.getElementById('edit-modal');
  const editModalTitle = document.getElementById('edit-modal-title');
  const editModalClose = document.getElementById('edit-modal-close');
  const editUserForm = document.getElementById('edit-user-form');
  const cancelEdit = document.getElementById('cancel-edit');

  let users = [];
  let currentEditingUserId = null;

  // Event listeners pour les modals
  userModalClose.addEventListener('click', () => userModal.classList.add('hidden'));
  createModalClose.addEventListener('click', () => createModal.classList.add('hidden'));
  cancelCreate.addEventListener('click', () => createModal.classList.add('hidden'));
  editModalClose.addEventListener('click', () => editModal.classList.add('hidden'));
  cancelEdit.addEventListener('click', () => editModal.classList.add('hidden'));
  
  // Event listener pour le bouton de création
  createUserBtn.addEventListener('click', () => {
    createUserForm.reset();
    createModal.classList.remove('hidden');
  });

  // Charger les utilisateurs
  async function loadUsers() {
    try {
      users = await App.api('/users');
      renderUsers();
      updateStats();
    } catch (error) {
      console.error('Erreur lors du chargement des utilisateurs:', error);
      alert('Erreur lors du chargement des utilisateurs');
    }
  }

  // Afficher les utilisateurs
  function renderUsers() {
    tableBody.innerHTML = '';
    
    users.forEach(user => {
      const row = document.createElement('tr');
      row.className = user.isLocked ? 'user-locked' : '';
      
      const statusBadge = user.isLocked 
        ? '<span class="status-badge locked">🔒 Verrouillé</span>'
        : user.failedLoginAttempts > 0 
          ? `<span class="status-badge warning">${user.failedLoginAttempts} échecs</span>`
          : '<span class="status-badge active">✅ Actif</span>';
      
      row.innerHTML = `
        <td>
          <div class="user-info">
            <span class="user-name">${App.escapeHtml(user.name)}</span>
            ${user.role === 'admin' ? '<span class="role-badge admin">👑 Admin</span>' : ''}
          </div>
        </td>
        <td>${App.escapeHtml(user.email)}</td>
        <td>
          <span class="role-badge ${user.role}">${user.role === 'admin' ? 'Admin' : 'Utilisateur'}</span>
        </td>
        <td><span class="count-badge">${user.projectCount || 0}</span></td>
        <td><span class="count-badge">${user.taskCount || 0}</span></td>
        <td>${statusBadge}</td>
        <td>${new Date(user.createdAt).toLocaleDateString('fr-FR')}</td>
        <td>
          <div class="action-buttons">
            <button class="action-btn view" data-user-id="${user.id}" title="Voir détails">👁️</button>
            <button class="action-btn edit" data-user-id="${user.id}" title="Modifier">✏️</button>
            ${user.isLocked ? 
              `<button class="action-btn unlock" data-user-id="${user.id}" title="Déverrouiller">🔓</button>` : ''}
            ${user.id !== currentUser.id ? 
              `<button class="action-btn delete" data-user-id="${user.id}" title="Supprimer">🗑️</button>` : ''}
          </div>
        </td>
      `;
      
      tableBody.appendChild(row);
    });

    // Ajouter les event listeners
    document.querySelectorAll('.action-btn.view').forEach(btn => {
      btn.addEventListener('click', (e) => showUserDetails(parseInt(e.target.dataset.userId)));
    });
    
    document.querySelectorAll('.action-btn.edit').forEach(btn => {
      btn.addEventListener('click', (e) => editUser(parseInt(e.target.dataset.userId)));
    });
    
    document.querySelectorAll('.action-btn.unlock').forEach(btn => {
      btn.addEventListener('click', (e) => unlockUser(parseInt(e.target.dataset.userId)));
    });
    
    document.querySelectorAll('.action-btn.delete').forEach(btn => {
      btn.addEventListener('click', (e) => deleteUser(parseInt(e.target.dataset.userId)));
    });
  }

  // Mettre à jour les statistiques
  function updateStats() {
    const totalUsers = users.length;
    const lockedUsers = users.filter(u => u.isLocked).length;
    
    totalUsersSpan.textContent = `${totalUsers} utilisateur${totalUsers > 1 ? 's' : ''}`;
    lockedUsersSpan.textContent = `${lockedUsers} verrouillé${lockedUsers > 1 ? 's' : ''}`;
    
    if (lockedUsers === 0) {
      lockedUsersSpan.classList.remove('warning');
      lockedUsersSpan.classList.add('success');
    } else {
      lockedUsersSpan.classList.remove('success');
      lockedUsersSpan.classList.add('warning');
    }
  }

  // Afficher les détails d'un utilisateur
  async function showUserDetails(userId) {
    try {
      const userDetails = await App.api(`/users/${userId}`);
      
      userModalTitle.textContent = `Détails - ${userDetails.name}`;
      
      userModalBody.innerHTML = `
        <div class="user-details-grid">
          <div class="user-basic-info">
            <h4>Informations générales</h4>
            <div class="info-item">
              <label>Nom:</label>
              <span>${App.escapeHtml(userDetails.name)}</span>
            </div>
            <div class="info-item">
              <label>Email:</label>
              <span>${App.escapeHtml(userDetails.email)}</span>
            </div>
            <div class="info-item">
              <label>Rôle:</label>
              <span class="role-badge ${userDetails.role}">${userDetails.role === 'admin' ? 'Administrateur' : 'Utilisateur'}</span>
            </div>
            <div class="info-item">
              <label>Statut:</label>
              <span class="status-badge ${userDetails.isLocked ? 'locked' : 'active'}">
                ${userDetails.isLocked ? '🔒 Verrouillé' : '✅ Actif'}
              </span>
            </div>
            <div class="info-item">
              <label>Tentatives échouées:</label>
              <span>${userDetails.failedLoginAttempts || 0}</span>
            </div>
            <div class="info-item">
              <label>Membre depuis:</label>
              <span>${new Date(userDetails.createdAt).toLocaleDateString('fr-FR')}</span>
            </div>
          </div>
          
          <div class="user-stats">
            <h4>Statistiques</h4>
            <div class="stats-grid">
              <div class="stat-card">
                <span class="stat-number">${userDetails.stats.projectCount}</span>
                <span class="stat-label">Projets</span>
              </div>
              <div class="stat-card">
                <span class="stat-number">${userDetails.stats.taskCount}</span>
                <span class="stat-label">Tâches total</span>
              </div>
              <div class="stat-card">
                <span class="stat-number">${userDetails.stats.completedTasks}</span>
                <span class="stat-label">Terminées</span>
              </div>
              <div class="stat-card">
                <span class="stat-number">${userDetails.stats.inProgressTasks}</span>
                <span class="stat-label">En cours</span>
              </div>
            </div>
          </div>
        </div>
        
        <div class="user-projects">
          <h4>Projets récents</h4>
          <div class="projects-list">
            ${userDetails.projects.length > 0 ? 
              userDetails.projects.slice(0, 5).map(project => `
                <div class="project-item">
                  <span class="project-name">${App.escapeHtml(project.name)}</span>
                  <span class="project-date">${new Date(project.createdAt).toLocaleDateString('fr-FR')}</span>
                </div>
              `).join('') : 
              '<p class="no-data">Aucun projet</p>'
            }
          </div>
        </div>
        
        <div class="user-tasks">
          <h4>Tâches récentes</h4>
          <div class="tasks-list">
            ${userDetails.tasks.length > 0 ? 
              userDetails.tasks.slice(0, 5).map(task => `
                <div class="task-item">
                  <span class="task-title">${App.escapeHtml(task.title)}</span>
                  <span class="task-project">${App.escapeHtml(task.projectName)}</span>
                  <span class="task-status status-${task.status}">${task.status}</span>
                </div>
              `).join('') : 
              '<p class="no-data">Aucune tâche</p>'
            }
          </div>
        </div>
      `;
      
      userModal.classList.remove('hidden');
    } catch (error) {
      console.error('Erreur lors du chargement des détails:', error);
      alert('Erreur lors du chargement des détails utilisateur');
    }
  }

  // Modifier un utilisateur
  function editUser(userId) {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    
    currentEditingUserId = userId;
    editModalTitle.textContent = `Modifier - ${user.name}`;
    
    // Pré-remplir le formulaire
    editUserForm.name.value = user.name;
    editUserForm.email.value = user.email;
    editUserForm.role.value = user.role;
    editUserForm.password.value = '';
    
    editModal.classList.remove('hidden');
  }

  // Sauvegarder les modifications
  editUserForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!currentEditingUserId) return;
    
    const formData = new FormData(editUserForm);
    const data = {};
    
    // Construire l'objet avec seulement les champs modifiés
    if (formData.get('name')) data.name = formData.get('name');
    if (formData.get('email')) data.email = formData.get('email');
    if (formData.get('role')) data.role = formData.get('role');
    if (formData.get('password')) data.password = formData.get('password');
    
    try {
      await App.api(`/users/${currentEditingUserId}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
      
      editModal.classList.add('hidden');
      await loadUsers();
      alert('Utilisateur modifié avec succès');
    } catch (error) {
      console.error('Erreur lors de la modification:', error);
      alert(`Erreur: ${error.error || error.message || 'Erreur inconnue'}`);
    }
  });

  // Déverrouiller un utilisateur
  async function unlockUser(userId) {
    const user = users.find(u => u.id === userId);
    if (!user || !confirm(`Déverrouiller le compte de ${user.name} ?`)) return;
    
    try {
      await App.api(`/users/${userId}/unlock`, { method: 'POST' });
      await loadUsers();
      alert('Utilisateur déverrouillé avec succès');
    } catch (error) {
      console.error('Erreur lors du déverrouillage:', error);
      alert('Erreur lors du déverrouillage');
    }
  }

  // Supprimer un utilisateur
  async function deleteUser(userId) {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    
    const confirmMessage = `Êtes-vous sûr de vouloir supprimer l'utilisateur "${user.name}" ?\n\nCette action supprimera également tous ses projets et tâches.\nCette action est irréversible.`;
    
    if (!confirm(confirmMessage)) return;
    
    try {
      await App.api(`/users/${userId}`, { method: 'DELETE' });
      await loadUsers();
      alert('Utilisateur supprimé avec succès');
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      alert('Erreur lors de la suppression');
    }
  }

  // Gestion de la création d'utilisateur
  createUserForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(createUserForm);
    const password = formData.get('password');
    const confirmPassword = formData.get('confirmPassword');
    
    // Vérifier que les mots de passe correspondent
    if (password !== confirmPassword) {
      alert('Les mots de passe ne correspondent pas');
      return;
    }
    
    const data = {
      name: formData.get('name'),
      email: formData.get('email'),
      role: formData.get('role'),
      password: password
    };
    
    try {
      await App.api('/users', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      
      createModal.classList.add('hidden');
      await loadUsers();
      alert('Utilisateur créé avec succès');
    } catch (error) {
      console.error('Erreur lors de la création:', error);
      
      // Afficher les erreurs de validation
      if (error.details && Array.isArray(error.details)) {
        const errorMessages = error.details.join('\n');
        alert(`Erreur de validation:\n${errorMessages}`);
      } else {
        alert(`Erreur: ${error.error || error.message || 'Erreur inconnue'}`);
      }
    }
  });

  // Charger les données au démarrage
  await loadUsers();
});
