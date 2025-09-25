document.addEventListener('DOMContentLoaded', async () => {
  App.ensureAuth();
  App.renderUserUi();

  const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
  const isAdmin = currentUser && currentUser.role === 'admin';

  // Masquer/afficher les éléments selon le rôle
  const usersNav = document.getElementById('users-nav');
  const usersStat = document.getElementById('users-stat');
  const userActivityChart = document.getElementById('user-activity-chart');
  const projectActivityChart = document.getElementById('project-activity-chart');

  if (!isAdmin && usersNav) {
    usersNav.style.display = 'none';
  }
  
  if (isAdmin) {
    usersStat.style.display = 'flex';
    userActivityChart.style.display = 'block';
  } else {
    projectActivityChart.style.display = 'block';
  }

  // Éléments DOM
  const refreshBtn = document.getElementById('refresh-charts');
  const totalProjectsSpan = document.getElementById('total-projects');
  const completedProjectsSpan = document.getElementById('completed-projects');
  const totalTasksSpan = document.getElementById('total-tasks');
  const totalUsersSpan = document.getElementById('total-users');

  let stats = null;
  let chartData = null;

  // Fonction pour créer un graphique en secteurs simple
  function createPieChart(canvas, data, title) {
    const ctx = canvas.getContext('2d');
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(canvas.width, canvas.height) / 2 - 40;

    // Effacer le canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!data || data.length === 0) {
      ctx.fillStyle = '#6b7280';
      ctx.font = '16px Inter';
      ctx.textAlign = 'center';
      ctx.fillText('Aucune donnée', centerX, centerY);
      return;
    }

    const total = data.reduce((sum, item) => sum + item.value, 0);
    let currentAngle = -Math.PI / 2; // Commencer en haut

    // Dessiner les secteurs
    data.forEach((item, index) => {
      if (item.value > 0) {
        const sliceAngle = (item.value / total) * 2 * Math.PI;
        
        // Dessiner le secteur
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
        ctx.closePath();
        ctx.fillStyle = item.color || getDefaultColor(index);
        ctx.fill();
        
        // Bordure
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Étiquette
        const labelAngle = currentAngle + sliceAngle / 2;
        const labelX = centerX + Math.cos(labelAngle) * (radius * 0.7);
        const labelY = centerY + Math.sin(labelAngle) * (radius * 0.7);
        
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px Inter';
        ctx.textAlign = 'center';
        ctx.fillText(item.value.toString(), labelX, labelY);
        
        currentAngle += sliceAngle;
      }
    });

    // Légende
    let legendY = 20;
    ctx.font = '12px Inter';
    ctx.textAlign = 'left';
    
    data.forEach((item, index) => {
      if (item.value > 0) {
        // Carré coloré
        ctx.fillStyle = item.color || getDefaultColor(index);
        ctx.fillRect(10, legendY, 12, 12);
        
        // Texte
        ctx.fillStyle = '#374151';
        ctx.fillText(`${item.label}: ${item.value}`, 28, legendY + 9);
        
        legendY += 20;
      }
    });
  }

  // Fonction pour créer un graphique en barres simple
  function createBarChart(canvas, data, title) {
    const ctx = canvas.getContext('2d');
    const padding = 40;
    const chartWidth = canvas.width - 2 * padding;
    const chartHeight = canvas.height - 2 * padding;

    // Effacer le canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!data || data.length === 0) {
      ctx.fillStyle = '#6b7280';
      ctx.font = '16px Inter';
      ctx.textAlign = 'center';
      ctx.fillText('Aucune donnée', canvas.width / 2, canvas.height / 2);
      return;
    }

    const maxValue = Math.max(...data.map(item => item.value));
    const barWidth = chartWidth / data.length - 10;

    data.forEach((item, index) => {
      const barHeight = (item.value / maxValue) * chartHeight;
      const x = padding + index * (barWidth + 10);
      const y = canvas.height - padding - barHeight;

      // Dessiner la barre
      ctx.fillStyle = item.color || getDefaultColor(index);
      ctx.fillRect(x, y, barWidth, barHeight);

      // Valeur au-dessus de la barre
      ctx.fillStyle = '#374151';
      ctx.font = '12px Inter';
      ctx.textAlign = 'center';
      ctx.fillText(item.value.toString(), x + barWidth / 2, y - 5);

      // Étiquette en bas
      ctx.fillText(item.label, x + barWidth / 2, canvas.height - 10);
    });
  }

  // Fonction pour créer un graphique linéaire simple
  function createLineChart(canvas, data, title) {
    const ctx = canvas.getContext('2d');
    const padding = 60;
    const chartWidth = canvas.width - 2 * padding;
    const chartHeight = canvas.height - 2 * padding;

    // Effacer le canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    console.log('Données pour le graphique mensuel:', data);

    if (!data || data.length === 0) {
      ctx.fillStyle = '#6b7280';
      ctx.font = '16px Inter';
      ctx.textAlign = 'center';
      ctx.fillText('Aucune donnée pour les 12 derniers mois', canvas.width / 2, canvas.height / 2);
      ctx.font = '12px Inter';
      ctx.fillText('Créez des tâches pour voir la progression', canvas.width / 2, canvas.height / 2 + 20);
      return;
    }

    // Générer des données de test si pas assez de données réelles
    let chartData = data;
    if (data.length < 3) {
      console.log('Génération de données de démonstration');
      const months = ['2024-01', '2024-02', '2024-03', '2024-04', '2024-05', '2024-06'];
      chartData = months.map((month, index) => ({
        month,
        tasks_created: Math.floor(Math.random() * 20) + 5,
        tasks_completed: Math.floor(Math.random() * 15) + 2
      }));
      
      // Ajouter les vraies données si elles existent
      data.forEach(realData => {
        const existingIndex = chartData.findIndex(d => d.month === realData.month);
        if (existingIndex >= 0) {
          chartData[existingIndex] = realData;
        } else {
          chartData.push(realData);
        }
      });
      
      chartData.sort((a, b) => a.month.localeCompare(b.month));
    }

    const maxCreated = Math.max(...chartData.map(item => item.tasks_created || 0));
    const maxCompleted = Math.max(...chartData.map(item => item.tasks_completed || 0));
    const maxValue = Math.max(maxCreated, maxCompleted, 10);

    // Dessiner les axes
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 2;
    
    // Axe Y
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, canvas.height - padding);
    ctx.stroke();
    
    // Axe X
    ctx.beginPath();
    ctx.moveTo(padding, canvas.height - padding);
    ctx.lineTo(canvas.width - padding, canvas.height - padding);
    ctx.stroke();

    // Graduations Y
    ctx.font = '11px Inter';
    ctx.fillStyle = '#6b7280';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 5; i++) {
      const value = Math.round((maxValue / 5) * i);
      const y = canvas.height - padding - (i / 5) * chartHeight;
      ctx.fillText(value.toString(), padding - 10, y + 4);
      
      // Ligne de grille
      if (i > 0) {
        ctx.strokeStyle = '#374151';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(canvas.width - padding, y);
        ctx.stroke();
      }
    }

    if (chartData.length > 0) {
      const stepX = chartWidth / Math.max(chartData.length - 1, 1);

      // Zone de fond pour les tâches créées
      ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
      ctx.beginPath();
      ctx.moveTo(padding, canvas.height - padding);
      chartData.forEach((item, index) => {
        const x = padding + index * stepX;
        const y = canvas.height - padding - ((item.tasks_created || 0) / maxValue) * chartHeight;
        ctx.lineTo(x, y);
      });
      ctx.lineTo(padding + (chartData.length - 1) * stepX, canvas.height - padding);
      ctx.closePath();
      ctx.fill();

      // Ligne des tâches créées
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 3;
      ctx.beginPath();
      chartData.forEach((item, index) => {
        const x = padding + index * stepX;
        const y = canvas.height - padding - ((item.tasks_created || 0) / maxValue) * chartHeight;
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();

      // Ligne des tâches terminées
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 3;
      ctx.beginPath();
      chartData.forEach((item, index) => {
        const x = padding + index * stepX;
        const y = canvas.height - padding - ((item.tasks_completed || 0) / maxValue) * chartHeight;
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();

      // Points et valeurs
      chartData.forEach((item, index) => {
        const x = padding + index * stepX;
        
        // Point créées
        const yCreated = canvas.height - padding - ((item.tasks_created || 0) / maxValue) * chartHeight;
        ctx.fillStyle = '#3b82f6';
        ctx.beginPath();
        ctx.arc(x, yCreated, 6, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Point terminées
        const yCompleted = canvas.height - padding - ((item.tasks_completed || 0) / maxValue) * chartHeight;
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(x, yCompleted, 6, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Étiquettes des mois
        ctx.fillStyle = '#6b7280';
        ctx.font = '10px Inter';
        ctx.textAlign = 'center';
        const monthLabel = item.month ? item.month.substring(5) : `M${index + 1}`;
        ctx.fillText(monthLabel, x, canvas.height - padding + 15);
      });
    }

    // Titre
    ctx.fillStyle = '#374151';
    ctx.font = 'bold 14px Inter';
    ctx.textAlign = 'center';
    ctx.fillText('Évolution mensuelle des tâches', canvas.width / 2, 25);

    // Légende
    ctx.font = '12px Inter';
    ctx.textAlign = 'left';
    
    const legendY = canvas.height - 15;
    
    // Créées
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(canvas.width / 2 - 100, legendY - 10, 12, 12);
    ctx.fillStyle = '#374151';
    ctx.fillText('Tâches créées', canvas.width / 2 - 82, legendY - 1);
    
    // Terminées
    ctx.fillStyle = '#10b981';
    ctx.fillRect(canvas.width / 2 + 10, legendY - 10, 12, 12);
    ctx.fillStyle = '#374151';
    ctx.fillText('Tâches terminées', canvas.width / 2 + 28, legendY - 1);
  }

  // Couleurs par défaut
  function getDefaultColor(index) {
    const colors = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#06b6d4'];
    return colors[index % colors.length];
  }

  // Charger les données
  async function loadData() {
    try {
      [stats, chartData] = await Promise.all([
        App.api('/stats/overview'),
        App.api('/stats/charts')
      ]);
      
      updateStats();
      renderCharts();
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
      alert('Erreur lors du chargement des données');
    }
  }

  // Mettre à jour les statistiques
  function updateStats() {
    if (!stats) return;

    totalProjectsSpan.textContent = stats.projects.total || 0;
    completedProjectsSpan.textContent = stats.projects.byStatus.completed || 0;
    totalTasksSpan.textContent = stats.tasks.total || 0;
    
    if (isAdmin && stats.users) {
      totalUsersSpan.textContent = stats.users.total || 0;
    }
  }

  // Rendre les graphiques
  function renderCharts() {
    if (!chartData) return;

    // Graphique des projets
    const projectsCanvas = document.getElementById('projects-chart');
    if (projectsCanvas) {
      projectsCanvas.width = 400;
      projectsCanvas.height = 300;
      
      const projectsData = [
        { label: 'Terminés', value: stats.projects.byStatus.completed || 0, color: '#10b981' },
        { label: 'En cours', value: stats.projects.byStatus.in_progress || 0, color: '#f59e0b' },
        { label: 'Pas de tâches', value: stats.projects.byStatus.no_tasks || 0, color: '#ef4444' }
      ];
      
      createPieChart(projectsCanvas, projectsData, 'Statut des Projets');
    }

    // Graphique des tâches
    const tasksCanvas = document.getElementById('tasks-chart');
    if (tasksCanvas) {
      tasksCanvas.width = 400;
      tasksCanvas.height = 300;
      
      const tasksData = [
        { label: 'Terminées', value: stats.tasks.byStatus.done || 0, color: '#10b981' },
        { label: 'En cours', value: stats.tasks.byStatus.in_progress || 0, color: '#f59e0b' },
        { label: 'À faire', value: stats.tasks.byStatus.todo || 0, color: '#ef4444' }
      ];
      
      createPieChart(tasksCanvas, tasksData, 'Répartition des Tâches');
    }

    // Graphique d'activité utilisateurs (admin)
    if (isAdmin && chartData.userActivity) {
      const userCanvas = document.getElementById('user-activity-canvas');
      if (userCanvas) {
        userCanvas.width = 600;
        userCanvas.height = 300;
        createBarChart(userCanvas, chartData.userActivity, 'Activité des Utilisateurs');
      }
    }

    // Graphique d'activité projets (utilisateur)
    if (!isAdmin && chartData.projectActivity) {
      const projectCanvas = document.getElementById('project-activity-canvas');
      if (projectCanvas) {
        projectCanvas.width = 600;
        projectCanvas.height = 300;
        createBarChart(projectCanvas, chartData.projectActivity, 'Activité par Projet');
      }
    }

    // Graphique de progression mensuelle
    const monthlyCanvas = document.getElementById('monthly-progress-chart');
    if (monthlyCanvas && chartData.monthlyProgress) {
      monthlyCanvas.width = 800;
      monthlyCanvas.height = 300;
      createLineChart(monthlyCanvas, chartData.monthlyProgress, 'Progression Mensuelle');
    }
  }

  // Event listener pour actualiser
  refreshBtn.addEventListener('click', loadData);

  // Charger les données au démarrage
  await loadData();
});
