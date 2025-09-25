FROM node:20-slim

WORKDIR /app

# Installer les dépendances système nécessaires pour SQLite3
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
     python3 make g++ sqlite3 libsqlite3-dev ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Copier les fichiers de configuration du backend
COPY backend/package.json backend/package-lock.json* ./backend/

# Installer les dépendances du backend (incluant devDependencies pour nodemon)
RUN cd backend && npm ci && npm cache clean --force

# Copier le code source du backend et frontend
COPY backend ./backend
COPY frontend ./frontend

# Variables d'environnement
ENV NODE_ENV=production
ENV PORT=3000

# Exposer le port
EXPOSE 3000

# Changer vers le répertoire backend pour exécuter l'application
WORKDIR /app/backend

# Commande de démarrage avec nodemon en développement
CMD ["npm", "run", "dev"]


