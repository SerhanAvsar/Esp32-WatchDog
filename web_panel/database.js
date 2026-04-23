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
            password TEXT,
            is_admin INTEGER DEFAULT 0
        )`, (err) => {
            if (err) {
                console.error('Error creating users table', err.message);
            } else {
                db.run(`ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0`, (alterErr) => {
                    // Sadece kolon İLK DEFA eklendiğinde (alterErr null ise) eski kullanıcıları admin yap.
                    // Aksi takdirde (kolon zaten varsa hata döner) yeni eklenenleri elleme!
                    if (!alterErr) {
                        db.run(`UPDATE users SET is_admin = 1 WHERE is_admin IS NULL OR is_admin = 0`, (updateErr) => {
                            if (!updateErr) {
                                console.log('Legacy users upgraded to Admin successfully.');
                            }
                        });
                    }
                });

                // Insert default user as admin
                const insert = 'INSERT INTO users (username, password, is_admin) VALUES (?, ?, ?)';
                db.run(insert, ['123', '123', 1], (err) => {
                    if (err) {
                        // User might already exist, which is fine
                        if (!err.message.includes('UNIQUE constraint failed')) {
                            console.error('Error inserting default user', err.message);
                        }
                    } else {
                        console.log('Default user (123/123) successfully registered as Admin.');
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

        // Create gas_logs table
        db.run(`CREATE TABLE IF NOT EXISTS gas_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            gas_value INTEGER,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            if (err) {
                console.error('Error creating gas_logs table', err.message);
            } else {
                console.log('gas_logs table is ready.');
            }
        });

        // Create notifications table
        db.run(`CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            type TEXT,
            title TEXT,
            message TEXT,
            is_read INTEGER DEFAULT 0,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            if (err) {
                console.error('Error creating notifications table', err.message);
            } else {
                console.log('notifications table is ready.');
            }
        });
    }
});

module.exports = db;
