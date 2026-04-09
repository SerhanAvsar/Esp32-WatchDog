const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// API Endpoint: Login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Lütfen kullanıcı adı ve şifre girin.' });
    }

    const query = 'SELECT * FROM users WHERE username = ? AND password = ?';
    db.get(query, [username, password], (err, row) => {
        if (err) {
            console.error(err.message);
            return res.status(500).json({ success: false, message: 'Veritabanı hatası.' });
        }
        
        if (row) {
            res.json({ success: true, message: 'Giriş başarılı!', user: { id: row.id, username: row.username } });
        } else {
            res.status(401).json({ success: false, message: 'Hatalı kullanıcı adı veya şifre.' });
        }
    });
});

// API Endpoint: Receive Sensor Data
app.post('/api/sensor', (req, res) => {
    const { distance } = req.body;
    
    if (distance === undefined || distance === null) {
        return res.status(400).json({ success: false, message: 'Geçersiz veri.' });
    }

    // In Arduino code we only send when distance is between 10 and 100,
    // but let's double check here just in case.
    if (distance >= 10 && distance <= 100) {
        const query = 'INSERT INTO entry_logs (distance) VALUES (?)';
        db.run(query, [distance], function(err) {
            if (err) {
                console.error('Error inserting log:', err.message);
                return res.status(500).json({ success: false, message: 'Veritabanı hatası.' });
            }
            res.json({ success: true, message: 'Kayıt eklendi.', id: this.lastID });
        });
    } else {
        res.status(400).json({ success: false, message: 'Mesafe sınırların dışında (10cm - 1m).' });
    }
});

// API Endpoint: Get Logs
app.get('/api/logs', (req, res) => {
    const query = 'SELECT * FROM entry_logs ORDER BY timestamp DESC LIMIT 100';
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Error fetching logs:', err.message);
            return res.status(500).json({ success: false, message: 'Veritabanı hatası.' });
        }
        res.json({ success: true, logs: rows });
    });
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
