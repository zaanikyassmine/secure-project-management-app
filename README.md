# 🏢 Management Project

Un système de gestion de projets et tâches avec authentification.

## 🚀 **Démarrage Ultra-Rapide (2 minutes)**

### 1. **Prérequis** (Installation unique)
- **Docker Desktop** : [Télécharger ici](https://www.docker.com/products/docker-desktop/)
- Démarrer Docker Desktop après installation

### 2. **Lancer l'application**
```bash
# Ouvrir un terminal dans le dossier du projet
# Puis exécuter :
docker-compose up --build
```

### 3. **Accéder à l'application**
- 🌐 **Interface web** : http://localhost:3000
- ⚡ **API Status** : http://localhost:3000/api/auth/health

### 4. **Créer le premier administrateur**
```powershell
# Sur Windows PowerShell :
.\create-admin.ps1

# Ou manuellement via l'interface web à :
# http://localhost:3000 → S'inscrire
```

### 5. **Arrêter l'application**
```bash
# Dans le terminal :
Ctrl + C
# Puis :
docker-compose down
```

---

## 📱 **Utilisation**

### Fonctionnalités disponibles :
- ✅ **Authentification** (inscription/connexion)
- ✅ **Gestion des projets**
- ✅ **Gestion des tâches**
- ✅ **Gestion des utilisateurs** (admin)
- ✅ **Tableau de bord** avec statistiques
- ✅ **Analytics** et rapports

### Pages disponibles :
- **Accueil** : http://localhost:3000
- **Projets** : http://localhost:3000/projects.html
- **Tâches** : http://localhost:3000/tasks.html
- **Utilisateurs** : http://localhost:3000/users.html (admin)
- **Analytics** : http://localhost:3000/analytics.html

---

## 🔧 **Développement**

### Mode développement (rechargement automatique)
```bash
docker-compose up
```
✅ Les modifications de code sont automatiquement prises en compte !

### Voir les logs
```bash
docker-compose logs -f
```

### Reconstruire (seulement si nécessaire)
```bash
docker-compose up --build
```

---

## 🐛 **Dépannage**

### L'application ne démarre pas ?
1. **Vérifier Docker** : Docker Desktop doit être démarré
2. **Port occupé** : Changer le port dans `docker-compose.yml` (ligne 5) : `"3001:3000"`
3. **Redémarrage complet** :
   ```bash
   docker-compose down
   docker-compose up --build
   ```

### Erreur de base de données ?
```bash
# Supprimer la base de données (perte de données !)
rm backend/database/data.sqlite
docker-compose up --build
```

---

## 📁 **Structure du projet**

```
management-project/
├── 🖥️  frontend/          # Interface web (HTML/CSS/JS)
├── ⚙️  backend/           # API Node.js + Express
│   ├── database/         # Base SQLite
│   ├── routes/          # Routes API
│   └── middleware/      # Auth & sécurité
├── 🐳 docker-compose.yml # Configuration Docker
└── 📋 README.md         # Ce fichier
```

---

## 🔒 **Sécurité**

L'application inclut :
- **Helmet.js** - Protection des en-têtes
- **Rate limiting** - Protection contre les attaques
- **JWT** - Authentification sécurisée
- **bcrypt** - Hachage des mots de passe
- **Validation** - Validation des données

---



1. Documentation complète : Voir `README-DOCKER.md`

---


