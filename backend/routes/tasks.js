const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const { all, get, run } = require('../database/db');

const router = express.Router();

router.use(requireAuth);

async function userCanAccessProject(user, projectId) {
  const project = await get('SELECT * FROM projects WHERE id = ?', [projectId]);
  if (!project) return false;
  if (user.role === 'admin') return true;
  return project.ownerId === user.id;
}

router.get('/', [query('projectId').optional().isInt()], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const isAdmin = req.user.role === 'admin';
  const { projectId } = req.query;
  try {
    if (projectId) {
      const can = await userCanAccessProject(req.user, parseInt(projectId, 10));
      if (!can) return res.status(403).json({ error: 'Accès refusé' });
      const tasks = await all('SELECT * FROM tasks WHERE projectId = ? ORDER BY createdAt DESC', [projectId]);
      return res.json(tasks);
    }
    if (isAdmin) {
      const tasks = await all('SELECT * FROM tasks ORDER BY createdAt DESC');
      return res.json(tasks);
    }
    const tasks = await all(
      `SELECT t.* FROM tasks t
       JOIN projects p ON p.id = t.projectId
       WHERE p.ownerId = ?
       ORDER BY t.createdAt DESC`,
      [req.user.id]
    );
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post(
  '/',
  [
    body('projectId').isInt(),
    body('title').isString().isLength({ min: 2 }).trim(),
    body('description').optional().isString().trim(),
    body('status').optional().isIn(['todo', 'in_progress', 'done']),
    body('dueDate').optional().isISO8601().toDate(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { projectId, title, description, status, dueDate } = req.body;
    try {
      const can = await userCanAccessProject(req.user, parseInt(projectId, 10));
      if (!can) return res.status(403).json({ error: 'Accès refusé' });
      const result = await run(
        'INSERT INTO tasks (projectId, title, description, status, dueDate) VALUES (?,?,?,?,?)',
        [projectId, title, description || '', status || 'todo', dueDate || null]
      );
      const task = await get('SELECT * FROM tasks WHERE id = ?', [result.lastID]);
      res.status(201).json(task);
    } catch (err) {
      res.status(500).json({ error: 'Erreur serveur' });
    }
  }
);

router.put(
  '/:id',
  [
    param('id').isInt(),
    body('title').optional().isString().isLength({ min: 2 }),
    body('description').optional().isString(),
    body('status').optional().isIn(['todo', 'in_progress', 'done']),
    body('dueDate').optional().isISO8601().toDate(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const id = parseInt(req.params.id, 10);
    try {
      const task = await get('SELECT * FROM tasks WHERE id = ?', [id]);
      if (!task) return res.status(404).json({ error: 'Tâche non trouvée' });
      const can = await userCanAccessProject(req.user, task.projectId);
      if (!can) return res.status(403).json({ error: 'Accès refusé' });
      const newTitle = req.body.title ?? task.title;
      const newDesc = req.body.description ?? task.description;
      const newStatus = req.body.status ?? task.status;
      const newDue = req.body.dueDate ?? task.dueDate;
      await run('UPDATE tasks SET title = ?, description = ?, status = ?, dueDate = ? WHERE id = ?', [
        newTitle,
        newDesc,
        newStatus,
        newDue,
        id,
      ]);
      const updated = await get('SELECT * FROM tasks WHERE id = ?', [id]);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: 'Erreur serveur' });
    }
  }
);

router.delete('/:id', [param('id').isInt()], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const id = parseInt(req.params.id, 10);
  try {
    const task = await get('SELECT * FROM tasks WHERE id = ?', [id]);
    if (!task) return res.status(404).json({ error: 'Tâche non trouvée' });
    const can = await userCanAccessProject(req.user, task.projectId);
    if (!can) return res.status(403).json({ error: 'Accès refusé' });
    await run('DELETE FROM tasks WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Endpoint spécifique pour le drag & drop (mise à jour rapide du statut)
router.patch('/:id/status', 
  [
    param('id').isInt(),
    body('status').isIn(['todo', 'in_progress', 'done'])
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    
    const id = parseInt(req.params.id, 10);
    const { status } = req.body;
    
    try {
      const task = await get('SELECT * FROM tasks WHERE id = ?', [id]);
      if (!task) return res.status(404).json({ error: 'Tâche non trouvée' });
      
      const can = await userCanAccessProject(req.user, task.projectId);
      if (!can) return res.status(403).json({ error: 'Accès refusé' });
      
      await run('UPDATE tasks SET status = ? WHERE id = ?', [status, id]);
      const updated = await get('SELECT * FROM tasks WHERE id = ?', [id]);
      
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: 'Erreur serveur' });
    }
  }
);

module.exports = router;


