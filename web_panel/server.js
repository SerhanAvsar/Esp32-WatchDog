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

// Start Server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
