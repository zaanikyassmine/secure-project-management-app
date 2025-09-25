const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { get, run } = require('../database/db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

// Fonction de validation du mot de passe
function validatePassword(password) {
  // Au moins 8 caractères, avec lettres, nombres et symboles
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

// Fonction pour vérifier si un compte est verrouillé
function isAccountLocked(user) {
  if (!user.lockedUntil) return false;
  return new Date(user.lockedUntil) > new Date();
}

// Fonction pour verrouiller un compte
async function lockAccount(email) {
  const lockUntil = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
  await run('UPDATE users SET lockedUntil = ? WHERE email = ?', [lockUntil.toISOString(), email]);
}

// Fonction pour réinitialiser les tentatives échouées
async function resetFailedAttempts(email) {
  await run('UPDATE users SET failedLoginAttempts = 0, lockedUntil = NULL WHERE email = ?', [email]);
}

// Fonction pour incrémenter les tentatives échouées
async function incrementFailedAttempts(email) {
  const result = await run('UPDATE users SET failedLoginAttempts = failedLoginAttempts + 1 WHERE email = ?', [email]);
  const user = await get('SELECT failedLoginAttempts FROM users WHERE email = ?', [email]);
  
  if (user && user.failedLoginAttempts >= 3) {
    await lockAccount(email);
    return true; // Compte verrouillé
  }
  return false; // Pas encore verrouillé
}

// Rate limiting spécifique pour la route login
const loginLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 15 minutes
    max: 5, // limite à 5 tentatives de login par IP
    message: { error: 'Trop de tentatives de connexion, réessayez dans 5 minutes.' },
    skipSuccessfulRequests: true,
});

// Endpoint de santé pour Docker healthcheck
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

router.post(
  '/register',
  [
    body('name').isString().isLength({ min: 2 }).trim(),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }), // Augmenté à 8 caractères minimum
    body('role').optional().isIn(['admin', 'user']),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, email, password } = req.body;
    const role = req.body.role || 'user';
    
    // Validation avancée du mot de passe
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({ 
        error: 'Mot de passe invalide', 
        details: passwordValidation.errors 
      });
    }
    
    const passwordHash = await bcrypt.hash(password, 10);
    try {
      const result = await run(
        'INSERT INTO users (name, email, passwordHash, role) VALUES (?,?,?,?)',
        [name, email, passwordHash, role]
      );
      const userId = result.lastID;
      const token = jwt.sign({ id: userId, name, email, role }, JWT_SECRET, { expiresIn: '1d' });
      return res.status(201).json({ token, user: { id: userId, name, email, role } });
    } catch (err) {
      if (err && err.message && err.message.includes('UNIQUE')) {
        return res.status(409).json({ error: 'Email déjà utilisé' });
      }
      return res.status(500).json({ error: 'Erreur serveur' });
    }
  }
);

router.post(
  '/login',
  loginLimiter, // Appliquer le rate limiting spécifiquement sur login
  [body('email').isEmail().normalizeEmail(), body('password').isString().isLength({ min: 8 })],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { email, password } = req.body;
    try {
      const user = await get('SELECT * FROM users WHERE email = ?', [email]);
      if (!user) return res.status(401).json({ error: 'Identifiants invalides' });
      
      // Vérifier si le compte est verrouillé
      if (isAccountLocked(user)) {
        const unlockTime = new Date(user.lockedUntil);
        const remainingMinutes = Math.ceil((unlockTime - new Date()) / (1000 * 60));
        return res.status(423).json({ 
          error: `Compte temporairement verrouillé. Réessayez dans ${remainingMinutes} minute(s).` 
        });
      }
      
      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) {
        // Incrémenter les tentatives échouées
        const isLocked = await incrementFailedAttempts(email);
        if (isLocked) {
          return res.status(423).json({ 
            error: 'Trop de tentatives incorrectes. Compte verrouillé pendant 5 minutes.' 
          });
        } else {
          const attemptsLeft = 3 - (user.failedLoginAttempts + 1);
          return res.status(401).json({ 
            error: `Identifiants invalides. ${attemptsLeft} tentative(s) restante(s) avant verrouillage.` 
          });
        }
      }
      
      // Connexion réussie - réinitialiser les tentatives échouées
      await resetFailedAttempts(email);
      
      const token = jwt.sign(
        { id: user.id, name: user.name, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: '1d' }
      );
      return res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    } catch (err) {
      console.error('Erreur login:', err);
      return res.status(500).json({ error: 'Erreur serveur' });
    }
  }
);

// Endpoint pour promouvoir un utilisateur en admin (nécessite d'être admin)
router.put('/promote/:userId', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Token manquant' });
    
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Vérifier que l'utilisateur actuel est admin
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Accès refusé - Admin requis' });
    }
    
    const { userId } = req.params;
    const { role } = req.body;
    
    if (!['admin', 'user'].includes(role)) {
      return res.status(400).json({ error: 'Rôle invalide' });
    }
    
    await run('UPDATE users SET role = ? WHERE id = ?', [role, userId]);
    res.json({ message: `Utilisateur ${userId} promu au rôle ${role}` });
  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Token invalide' });
    }
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Endpoint pour créer le premier admin (seulement si aucun admin n'existe)
router.post('/create-first-admin', async (req, res) => {
  try {
    // Vérifier s'il y a déjà un admin
    const existingAdmin = await get('SELECT id FROM users WHERE role = "admin" LIMIT 1');
    if (existingAdmin) {
      return res.status(400).json({ error: 'Un admin existe déjà' });
    }
    
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nom, email et mot de passe requis' });
    }
    
    // Validation avancée du mot de passe
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
      [name, email, passwordHash, 'admin']
    );
    
    const userId = result.lastID;
    const token = jwt.sign({ id: userId, name, email, role: 'admin' }, JWT_SECRET, { expiresIn: '1d' });
    
    res.status(201).json({ 
      message: 'Premier admin créé avec succès',
      token, 
      user: { id: userId, name, email, role: 'admin' }
    });
  } catch (err) {
    if (err && err.message && err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Email déjà utilisé' });
    }
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;



