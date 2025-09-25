const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const { all, get, run } = require('../database/db');

const router = express.Router();

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const projects = isAdmin
      ? await all('SELECT p.*, u.name as ownerName FROM projects p JOIN users u ON u.id = p.ownerId ORDER BY p.createdAt DESC')
      : await all('SELECT * FROM projects WHERE ownerId = ? ORDER BY createdAt DESC', [req.user.id]);
    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post(
  '/',
  [body('name').isString().isLength({ min: 2 }).trim(), body('description').optional().isString().trim()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { name, description } = req.body;
    try {
      const result = await run('INSERT INTO projects (name, description, ownerId) VALUES (?,?,?)', [
        name,
        description || '',
        req.user.id,
      ]);
      const project = await get('SELECT * FROM projects WHERE id = ?', [result.lastID]);
      res.status(201).json(project);
    } catch (err) {
      res.status(500).json({ error: 'Erreur serveur' });
    }
  }
);

router.get('/:id', [param('id').isInt()], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const id = parseInt(req.params.id, 10);
  try {
    const project = await get('SELECT * FROM projects WHERE id = ?', [id]);
    if (!project) return res.status(404).json({ error: 'Projet non trouvé' });
    const isAdmin = req.user.role === 'admin';
    if (!isAdmin && project.ownerId !== req.user.id) return res.status(403).json({ error: 'Accès refusé' });
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.put(
  '/:id',
  [param('id').isInt(), body('name').optional().isString().isLength({ min: 2 }), body('description').optional().isString()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const id = parseInt(req.params.id, 10);
    try {
      const project = await get('SELECT * FROM projects WHERE id = ?', [id]);
      if (!project) return res.status(404).json({ error: 'Projet non trouvé' });
      const isAdmin = req.user.role === 'admin';
      if (!isAdmin && project.ownerId !== req.user.id) return res.status(403).json({ error: 'Accès refusé' });
      const newName = req.body.name ?? project.name;
      const newDesc = req.body.description ?? project.description;
      await run('UPDATE projects SET name = ?, description = ? WHERE id = ?', [newName, newDesc, id]);
      const updated = await get('SELECT * FROM projects WHERE id = ?', [id]);
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
    const project = await get('SELECT * FROM projects WHERE id = ?', [id]);
    if (!project) return res.status(404).json({ error: 'Projet non trouvé' });
    const isAdmin = req.user.role === 'admin';
    if (!isAdmin && project.ownerId !== req.user.id) return res.status(403).json({ error: 'Accès refusé' });
    await run('DELETE FROM projects WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;



