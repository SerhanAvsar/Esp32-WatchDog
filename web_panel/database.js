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
            is_admin INTEGER DEFAULT 0,
            qr_token TEXT UNIQUE
        )`, (err) => {
            if (err) {
                console.error('Error creating users table', err.message);
            } else {
                const { v4: uuidv4 } = require('uuid');
                
                db.run(`ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0`, (alterErr) => {
                    if (!alterErr) {
                        db.run(`UPDATE users SET is_admin = 1 WHERE is_admin IS NULL OR is_admin = 0`);
                    }
                    
                    db.run(`ALTER TABLE users ADD COLUMN qr_token TEXT`, (alterErr2) => {
                        // Sütun eklendiğinde veya önceden varsa (NULL olanları bul) uuid ata
                        db.all(`SELECT id FROM users WHERE qr_token IS NULL`, [], (err, rows) => {
                            if (!err && rows) {
                                const stmt = db.prepare(`UPDATE users SET qr_token = ? WHERE id = ?`);
                                rows.forEach(row => {
                                    stmt.run(uuidv4(), row.id);
                                });
                                stmt.finalize();
                                if(rows.length > 0) console.log(`${rows.length} kullanıcıya QR token atandı.`);
                            }
                        });

                        // Insert default user as admin
                        const insert = 'INSERT INTO users (username, password, is_admin, qr_token) VALUES (?, ?, ?, ?)';
                        db.run(insert, ['123', '123', 1, uuidv4()], (err) => {
                            if (err) {
                                if (!err.message.includes('UNIQUE constraint failed')) {
                                    console.error('Error inserting default user', err.message);
                                }
                            } else {
                                console.log('Default user (123/123) successfully registered as Admin.');
                            }
                        });
                    });
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
