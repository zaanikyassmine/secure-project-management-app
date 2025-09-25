const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const databaseFilePath = path.join(__dirname, 'data.sqlite');
const db = new sqlite3.Database(databaseFilePath);

function initDatabase() {
  db.serialize(() => {
    db.run('PRAGMA foreign_keys = ON');
    
    // Migrations pour ajouter les nouvelles colonnes si elles n'existent pas
    db.run(`ALTER TABLE users ADD COLUMN failedLoginAttempts INTEGER DEFAULT 0`, (err) => {
      // Ignorer l'erreur si la colonne existe déjà
    });
    db.run(`ALTER TABLE users ADD COLUMN lockedUntil DATETIME`, (err) => {
      // Ignorer l'erreur si la colonne existe déjà
    });

    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        passwordHash TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('admin','user')) DEFAULT 'user',
        failedLoginAttempts INTEGER DEFAULT 0,
        lockedUntil DATETIME,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        ownerId INTEGER NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(ownerId) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        projectId INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL CHECK(status IN ('todo','in_progress','done')) DEFAULT 'todo',
        dueDate DATETIME,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(projectId) REFERENCES projects(id) ON DELETE CASCADE
      )
    `);
  });
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

module.exports = {
  db,
  initDatabase,
  run,
  get,
  all,
};



