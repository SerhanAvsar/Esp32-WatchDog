const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        
        // Create users table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password TEXT
        )`, (err) => {
            if (err) {
                console.error('Error creating users table', err.message);
            } else {
                // Insert default user
                const insert = 'INSERT INTO users (username, password) VALUES (?, ?)';
                db.run(insert, ['123', '123'], (err) => {
                    if (err) {
                        // User might already exist, which is fine
                        if (!err.message.includes('UNIQUE constraint failed')) {
                            console.error('Error inserting default user', err.message);
                        }
                    } else {
                        console.log('Default user (123/123) successfully registered.');
                    }
                });
            }
        });

        // Create entry_logs table
        db.run(`CREATE TABLE IF NOT EXISTS entry_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            distance REAL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            if (err) {
                console.error('Error creating entry_logs table', err.message);
            } else {
                console.log('entry_logs table is ready.');
            }
        });
    }
});

module.exports = db;
