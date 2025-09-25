const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { all, get } = require('../database/db');

const router = express.Router();

router.use(requireAuth);

// GET /api/stats/overview - Statistiques générales
router.get('/overview', async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    
    let stats;
    
    if (isAdmin) {
      // Statistiques globales pour l'admin
      stats = {
        users: {
          total: await get('SELECT COUNT(*) as count FROM users'),
          admins: await get('SELECT COUNT(*) as count FROM users WHERE role = "admin"'),
          locked: await get('SELECT COUNT(*) as count FROM users WHERE lockedUntil > datetime("now")')
        },
        projects: {
          total: await get('SELECT COUNT(*) as count FROM projects'),
          byStatus: await all(`
            SELECT 
              CASE 
                WHEN EXISTS(SELECT 1 FROM tasks WHERE projectId = projects.id AND status != 'done') THEN 'in_progress'
                WHEN EXISTS(SELECT 1 FROM tasks WHERE projectId = projects.id) THEN 'completed'
                ELSE 'no_tasks'
              END as status,
              COUNT(*) as count
            FROM projects
            GROUP BY status
          `)
        },
        tasks: {
          total: await get('SELECT COUNT(*) as count FROM tasks'),
          byStatus: await all('SELECT status, COUNT(*) as count FROM tasks GROUP BY status'),
          recentActivity: await all(`
            SELECT DATE(createdAt) as date, COUNT(*) as count 
            FROM tasks 
            WHERE createdAt >= datetime('now', '-30 days')
            GROUP BY DATE(createdAt)
            ORDER BY date DESC
            LIMIT 30
          `)
        }
      };
    } else {
      // Statistiques personnelles pour l'utilisateur
      stats = {
        projects: {
          total: await get('SELECT COUNT(*) as count FROM projects WHERE ownerId = ?', [req.user.id]),
          byStatus: await all(`
            SELECT 
              CASE 
                WHEN EXISTS(SELECT 1 FROM tasks WHERE projectId = projects.id AND status != 'done') THEN 'in_progress'
                WHEN EXISTS(SELECT 1 FROM tasks WHERE projectId = projects.id) THEN 'completed'
                ELSE 'no_tasks'
              END as status,
              COUNT(*) as count
            FROM projects
            WHERE ownerId = ?
            GROUP BY status
          `, [req.user.id])
        },
        tasks: {
          total: await get(`
            SELECT COUNT(*) as count 
            FROM tasks t 
            JOIN projects p ON t.projectId = p.id 
            WHERE p.ownerId = ?
          `, [req.user.id]),
          byStatus: await all(`
            SELECT t.status, COUNT(*) as count 
            FROM tasks t 
            JOIN projects p ON t.projectId = p.id 
            WHERE p.ownerId = ?
            GROUP BY t.status
          `, [req.user.id]),
          recentActivity: await all(`
            SELECT DATE(t.createdAt) as date, COUNT(*) as count 
            FROM tasks t
            JOIN projects p ON t.projectId = p.id 
            WHERE p.ownerId = ? AND t.createdAt >= datetime('now', '-30 days')
            GROUP BY DATE(t.createdAt)
            ORDER BY date DESC
            LIMIT 30
          `, [req.user.id])
        }
      };
    }
    
    // Formater les résultats
    const formatCount = (result) => result?.count || 0;
    const formatArray = (results) => results || [];
    
    const formattedStats = {
      users: isAdmin ? {
        total: formatCount(stats.users.total),
        admins: formatCount(stats.users.admins),
        locked: formatCount(stats.users.locked),
        regular: formatCount(stats.users.total) - formatCount(stats.users.admins)
      } : undefined,
      projects: {
        total: formatCount(stats.projects.total),
        byStatus: formatArray(stats.projects.byStatus).reduce((acc, item) => {
          acc[item.status] = item.count;
          return acc;
        }, { completed: 0, in_progress: 0, no_tasks: 0 })
      },
      tasks: {
        total: formatCount(stats.tasks.total),
        byStatus: formatArray(stats.tasks.byStatus).reduce((acc, item) => {
          acc[item.status] = item.count;
          return acc;
        }, { todo: 0, in_progress: 0, done: 0 }),
        recentActivity: formatArray(stats.tasks.recentActivity)
      }
    };
    
    res.json(formattedStats);
    
  } catch (err) {
    console.error('Erreur lors de la récupération des statistiques:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/stats/charts - Données pour les graphiques
router.get('/charts', async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    
    let chartData;
    
    if (isAdmin) {
      // Données globales pour l'admin
      chartData = {
        projectsStatus: await all(`
          SELECT 
            CASE 
              WHEN EXISTS(SELECT 1 FROM tasks WHERE projectId = projects.id AND status != 'done') THEN 'En cours'
              WHEN EXISTS(SELECT 1 FROM tasks WHERE projectId = projects.id) THEN 'Terminé'
              ELSE 'Pas de tâches'
            END as label,
            COUNT(*) as value
          FROM projects
          GROUP BY label
        `),
        tasksStatus: await all('SELECT status as label, COUNT(*) as value FROM tasks GROUP BY status'),
        userActivity: await all(`
          SELECT 
            u.name as label,
            COUNT(t.id) as value
          FROM users u
          LEFT JOIN projects p ON u.id = p.ownerId
          LEFT JOIN tasks t ON p.id = t.projectId
          GROUP BY u.id, u.name
          HAVING value > 0
          ORDER BY value DESC
          LIMIT 10
        `),
        monthlyProgress: await all(`
          SELECT 
            strftime('%Y-%m', createdAt) as month,
            COUNT(*) as tasks_created,
            SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as tasks_completed
          FROM tasks
          WHERE createdAt >= datetime('now', '-12 months')
          GROUP BY month
          ORDER BY month
        `)
      };
    } else {
      // Données personnelles pour l'utilisateur
      chartData = {
        projectsStatus: await all(`
          SELECT 
            CASE 
              WHEN EXISTS(SELECT 1 FROM tasks WHERE projectId = projects.id AND status != 'done') THEN 'En cours'
              WHEN EXISTS(SELECT 1 FROM tasks WHERE projectId = projects.id) THEN 'Terminé'
              ELSE 'Pas de tâches'
            END as label,
            COUNT(*) as value
          FROM projects
          WHERE ownerId = ?
          GROUP BY label
        `, [req.user.id]),
        tasksStatus: await all(`
          SELECT t.status as label, COUNT(*) as value 
          FROM tasks t 
          JOIN projects p ON t.projectId = p.id 
          WHERE p.ownerId = ?
          GROUP BY t.status
        `, [req.user.id]),
        projectActivity: await all(`
          SELECT 
            p.name as label,
            COUNT(t.id) as value
          FROM projects p
          LEFT JOIN tasks t ON p.id = t.projectId
          WHERE p.ownerId = ?
          GROUP BY p.id, p.name
          ORDER BY value DESC
        `, [req.user.id]),
        monthlyProgress: await all(`
          SELECT 
            strftime('%Y-%m', t.createdAt) as month,
            COUNT(*) as tasks_created,
            SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) as tasks_completed
          FROM tasks t
          JOIN projects p ON t.projectId = p.id
          WHERE p.ownerId = ? AND t.createdAt >= datetime('now', '-12 months')
          GROUP BY month
          ORDER BY month
        `, [req.user.id])
      };
    }
    
    // Formater les données pour les graphiques
    const formatChartData = (data, colors) => {
      return data.map((item, index) => ({
        label: item.label,
        value: item.value,
        color: colors[index % colors.length]
      }));
    };
    
    const statusColors = ['#10b981', '#f59e0b', '#ef4444']; // Vert, Orange, Rouge
    const activityColors = ['#3b82f6', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316'];
    
    const formattedChartData = {
      projectsStatus: formatChartData(chartData.projectsStatus || [], statusColors),
      tasksStatus: formatChartData(chartData.tasksStatus || [], statusColors),
      userActivity: isAdmin ? formatChartData(chartData.userActivity || [], activityColors) : undefined,
      projectActivity: !isAdmin ? formatChartData(chartData.projectActivity || [], activityColors) : undefined,
      monthlyProgress: chartData.monthlyProgress || []
    };
    
    res.json(formattedChartData);
    
  } catch (err) {
    console.error('Erreur lors de la récupération des données de graphiques:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;

