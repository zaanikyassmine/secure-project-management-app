const express = require('express');
const { body, param, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const { requireAuth } = require('../middleware/auth');
const { all, get, run } = require('../database/db');

const router = express.Router();

// Middleware pour vérifier les droits admin
function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accès refusé - Droits administrateur requis' });
  }
  next();
}

router.use(requireAuth);

// GET /api/users - Lister tous les utilisateurs (admin seulement)
router.get('/', requireAdmin, async (req, res) => {
  try {
    const users = await all(`
      SELECT 
        id, 
        name, 
        email, 
        role, 
        failedLoginAttempts,
        lockedUntil,
        createdAt,
        (SELECT COUNT(*) FROM projects WHERE ownerId = users.id) as projectCount,
        (SELECT COUNT(*) FROM tasks t JOIN projects p ON t.projectId = p.id WHERE p.ownerId = users.id) as taskCount
      FROM users 
      ORDER BY createdAt DESC
    `);
    
    // Formater les données pour l'affichage
    const formattedUsers = users.map(user => ({
      ...user,
      isLocked: user.lockedUntil && new Date(user.lockedUntil) > new Date(),
      lockedUntil: user.lockedUntil ? new Date(user.lockedUntil).toISOString() : null,
      createdAt: new Date(user.createdAt).toISOString()
    }));
    
    res.json(formattedUsers);
  } catch (err) {
    console.error('Erreur lors de la récupération des utilisateurs:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/users/:id - Détails d'un utilisateur (admin seulement)
router.get('/:id', requireAdmin, [param('id').isInt()], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  
  try {
    const userId = parseInt(req.params.id, 10);
    const user = await get(`
      SELECT 
        id, 
        name, 
        email, 
        role, 
        failedLoginAttempts,
        lockedUntil,
        createdAt
      FROM users 
      WHERE id = ?
    `, [userId]);
    
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    // Récupérer les projets de l'utilisateur
    const projects = await all('SELECT id, name, description, createdAt FROM projects WHERE ownerId = ?', [userId]);
    
    // Récupérer les tâches de l'utilisateur
    const tasks = await all(`
      SELECT t.id, t.title, t.status, t.createdAt, p.name as projectName
      FROM tasks t 
      JOIN projects p ON t.projectId = p.id 
      WHERE p.ownerId = ? 
      ORDER BY t.createdAt DESC
    `, [userId]);
    
    const userDetails = {
      ...user,
      isLocked: user.lockedUntil && new Date(user.lockedUntil) > new Date(),
      lockedUntil: user.lockedUntil ? new Date(user.lockedUntil).toISOString() : null,
      createdAt: new Date(user.createdAt).toISOString(),
      projects: projects.map(p => ({
        ...p,
        createdAt: new Date(p.createdAt).toISOString()
      })),
      tasks: tasks.map(t => ({
        ...t,
        createdAt: new Date(t.createdAt).toISOString()
      })),
      stats: {
        projectCount: projects.length,
        taskCount: tasks.length,
        completedTasks: tasks.filter(t => t.status === 'done').length,
        pendingTasks: tasks.filter(t => t.status === 'todo').length,
        inProgressTasks: tasks.filter(t => t.status === 'in_progress').length
      }
    };
    
    res.json(userDetails);
  } catch (err) {
    console.error('Erreur lors de la récupération des détails utilisateur:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/users/:id - Modifier un utilisateur (admin seulement)
router.put('/:id', requireAdmin, [
  param('id').isInt(),
  body('name').optional().isString().isLength({ min: 2 }).trim(),
  body('email').optional().isEmail().normalizeEmail(),
  body('role').optional().isIn(['admin', 'user']),
  body('password').optional().isLength({ min: 8 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  
  try {
    const userId = parseInt(req.params.id, 10);
    const { name, email, role, password } = req.body;
    
    // Vérifier que l'utilisateur existe
    const existingUser = await get('SELECT * FROM users WHERE id = ?', [userId]);
    if (!existingUser) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    // Empêcher l'admin de se rétrograder lui-même
    if (userId === req.user.id && role && role !== 'admin') {
      return res.status(400).json({ error: 'Vous ne pouvez pas modifier votre propre rôle' });
    }
    
    // Construire la requête de mise à jour
    const updates = [];
    const values = [];
    
    if (name) {
      updates.push('name = ?');
      values.push(name);
    }
    
    if (email) {
      // Vérifier que l'email n'est pas déjà utilisé
      const emailExists = await get('SELECT id FROM users WHERE email = ? AND id != ?', [email, userId]);
      if (emailExists) {
        return res.status(409).json({ error: 'Cet email est déjà utilisé' });
      }
      updates.push('email = ?');
      values.push(email);
    }
    
    if (role) {
      updates.push('role = ?');
      values.push(role);
    }
    
    if (password) {
      // Validation du mot de passe (réutiliser la fonction de auth.js)
      const passwordHash = await bcrypt.hash(password, 10);
      updates.push('passwordHash = ?');
      values.push(passwordHash);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'Aucune modification fournie' });
    }
    
    values.push(userId);
    const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
    
    await run(sql, values);
    
    // Retourner l'utilisateur mis à jour
    const updatedUser = await get('SELECT id, name, email, role, createdAt FROM users WHERE id = ?', [userId]);
    res.json({
      ...updatedUser,
      createdAt: new Date(updatedUser.createdAt).toISOString()
    });
    
  } catch (err) {
    console.error('Erreur lors de la modification de l\'utilisateur:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/users/:id - Supprimer un utilisateur (admin seulement)
router.delete('/:id', requireAdmin, [param('id').isInt()], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  
  try {
    const userId = parseInt(req.params.id, 10);
    
    // Empêcher l'admin de se supprimer lui-même
    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte' });
    }
    
    // Vérifier que l'utilisateur existe
    const user = await get('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    // Supprimer l'utilisateur (les projets et tâches seront supprimés en cascade)
    await run('DELETE FROM users WHERE id = ?', [userId]);
    
    res.json({ message: 'Utilisateur supprimé avec succès' });
    
  } catch (err) {
    console.error('Erreur lors de la suppression de l\'utilisateur:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/users/:id/unlock - Déverrouiller un utilisateur (admin seulement)
router.post('/:id/unlock', requireAdmin, [param('id').isInt()], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  
  try {
    const userId = parseInt(req.params.id, 10);
    
    await run('UPDATE users SET failedLoginAttempts = 0, lockedUntil = NULL WHERE id = ?', [userId]);
    
    res.json({ message: 'Utilisateur déverrouillé avec succès' });
    
  } catch (err) {
    console.error('Erreur lors du déverrouillage:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/users - Créer un nouvel utilisateur (admin seulement)
router.post('/', requireAdmin, [
  body('name').isString().isLength({ min: 2 }).trim(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('role').optional().isIn(['admin', 'user']),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { name, email, password } = req.body;
  const role = req.body.role || 'user';
  
  try {
    // Validation avancée du mot de passe (réutiliser la fonction de auth.js)
    const bcrypt = require('bcryptjs');
    
    // Fonction de validation du mot de passe (copiée depuis auth.js)
    function validatePassword(password) {
      const minLength = 8;
      const hasLetter = /[a-zA-Z]/.test(password);
      const hasNumber = /\d/.test(password);
      const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
      
      const errors = [];
      if (password.length < minLength) {
        errors.push(`Le mot de passe doit contenir au moins ${minLength} caractères`);
      }
      if (!hasLetter) {
        errors.push('Le mot de passe doit contenir au moins une lettre');
      }
      if (!hasNumber) {
        errors.push('Le mot de passe doit contenir au moins un chiffre');
      }
      if (!hasSymbol) {
        errors.push('Le mot de passe doit contenir au moins un symbole (!@#$%^&*...)');
      }
      
      return { isValid: errors.length === 0, errors };
    }
    
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({ 
        error: 'Mot de passe invalide', 
        details: passwordValidation.errors 
      });
    }
    
    const passwordHash = await bcrypt.hash(password, 10);
    
    const result = await run(
      'INSERT INTO users (name, email, passwordHash, role) VALUES (?,?,?,?)',
      [name, email, passwordHash, role]
    );
    
    const newUser = await get('SELECT id, name, email, role, createdAt FROM users WHERE id = ?', [result.lastID]);
    
    res.status(201).json({
      ...newUser,
      createdAt: new Date(newUser.createdAt).toISOString()
    });
    
  } catch (err) {
    if (err && err.message && err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Cet email est déjà utilisé' });
    }
    console.error('Erreur lors de la création de l\'utilisateur:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
