const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const path = require('path');
const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const taskRoutes = require('./routes/tasks');
const userRoutes = require('./routes/users');
const statsRoutes = require('./routes/stats');
const { initDatabase } = require('./database/db');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialiser la base de données
initDatabase();

// Middlewares de sécurité - DÉSACTIVÉ pour l'accès réseau local
// En production, réactivez Helmet avec une configuration appropriée
if (process.env.NODE_ENV === 'production') {
    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'", "https:"],
                scriptSrc: ["'self'"],
                imgSrc: ["'self'", "data:", "https:"],
                fontSrc: ["'self'", "https:", "data:"],
                connectSrc: ["'self'"],
                objectSrc: ["'none'"],
                frameAncestors: ["'none'"],
            },
        },
    }));
} else {
    console.log('🔓 Mode développement : Helmet désactivé pour l\'accès réseau local');
}

// Configuration CORS - Autoriser l'accès depuis le réseau local
app.use(cors({ 
    origin: function (origin, callback) {
        // Autoriser les requêtes sans origine (applications mobiles, Postman, etc.)
        if (!origin) return callback(null, true);
        
        // Autoriser localhost et les adresses IP locales
        const allowedOrigins = [
            /^https?:\/\/localhost(:\d+)?$/,
            /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
            /^https?:\/\/192\.168\.\d+\.\d+(:\d+)?$/,
            /^https?:\/\/10\.\d+\.\d+\.\d+(:\d+)?$/,
            /^https?:\/\/172\.(1[6-9]|2\d|3[01])\.\d+\.\d+(:\d+)?$/
        ];
        
        const isAllowed = allowedOrigins.some(pattern => pattern.test(origin));
        callback(null, isAllowed);
    },
    credentials: true 
}));

// Rate limiting global pour toutes les API
const globalLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 200, // limite à 200 requêtes par IP par minute (raisonnable)
    message: { error: 'Trop de requêtes depuis cette IP, réessayez dans 1 minute.' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        // Exclure les fichiers statiques du rate limiting
        return req.url.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg)$/) || !req.url.startsWith('/api');
    }
});

// Le rate limiting spécifique pour login est maintenant géré dans routes/auth.js

app.use(globalLimiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Middleware pour forcer HTTP et éviter les redirections HTTPS
app.use((req, res, next) => {
    // Empêcher les redirections HTTPS automatiques et annuler HSTS
    res.setHeader('Strict-Transport-Security', 'max-age=0; includeSubDomains; preload');
    
    // Désactiver toutes les politiques cross-origin problématiques
    res.setHeader('Cross-Origin-Opener-Policy', 'unsafe-none');
    res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    
    // Forcer le cache à ne pas utiliser HTTPS
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // En-têtes pour éviter les problèmes d'agent cluster
    res.removeHeader('Origin-Agent-Cluster');
    
    console.log(`📡 Requête HTTP reçue: ${req.method} ${req.url} depuis ${req.ip}`);
    next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/users', userRoutes);
app.use('/api/stats', statsRoutes);


// Servir les fichiers statiques du frontend (multi-pages)
app.use(express.static(path.join(__dirname, '../frontend')));

// Gestion des erreurs globale
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Une erreur interne du serveur s\'est produite' });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Serveur démarré sur le port ${PORT} et accessible depuis toutes les interfaces réseau`);
});
