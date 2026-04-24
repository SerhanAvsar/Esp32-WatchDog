const express = require('express');
const fs = require('fs');
const cors = require('cors');
const path = require('path');
const db = require('./database');
const jwt = require('jsonwebtoken');
const { verifyToken, requireAdmin, SECRET_KEY } = require('./middleware/auth');
const http = require('http');
const { Transform } = require('stream');

const app = express();
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server, { cors: { origin: '*' } });

// --- Socket.io Middleware (JWT Auth) ---
io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication error'));
    
    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) return next(new Error('Authentication error'));
        socket.user = decoded;
        next();
    });
});

io.on('connection', (socket) => {
    // Sadece adminler bildirim odasına girebilir
    if (socket.user && socket.user.is_admin === 1) {
        socket.join('admin_room');
        console.log(`[SOCKET] Admin connected: ${socket.user.username}`);
    } else {
        console.log(`[SOCKET] Unauthorized access attempt by ${socket.user ? socket.user.username : 'unknown'}, disconnecting.`);
        socket.disconnect();
    }
});
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
            // Token oluştur (24 saat geçerli)
            const token = jwt.sign(
                { id: row.id, username: row.username, is_admin: row.is_admin },
                SECRET_KEY,
                { expiresIn: '24h' }
            );
            res.json({ 
                success: true, 
                message: 'Giriş başarılı!', 
                token: token,
                user: { id: row.id, username: row.username, is_admin: row.is_admin } 
            });
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
            console.log(`[BAŞARILI] Mesafe verisi kaydedildi: ${distance} cm`);
            
            // Tüm adminleri bul ve bildirim kaydet
            db.all('SELECT id FROM users WHERE is_admin = 1', [], (err, admins) => {
                if (!err && admins) {
                    const stmt = db.prepare('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)');
                    admins.forEach(admin => {
                        stmt.run(admin.id, 'motion', 'Hareket Tespiti!', `Kapı sensöründe ${distance} cm mesafede hareket algılandı.`);
                    });
                    stmt.finalize();
                }
            });

            // Yalnızca admin odasındaki kullanıcılara anlık bildirim gönder
            io.to('admin_room').emit('notification', {
                type: 'motion',
                title: 'Hareket Tespiti!',
                message: `Kapı sensöründe ${distance} cm mesafede hareket algılandı.`,
                time: new Date().toLocaleTimeString('tr-TR')
            });

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

// API Endpoint: Receive Gas Sensor Data
app.post('/api/gas', (req, res) => {
    const { gas_value } = req.body;
    
    if (gas_value === undefined || gas_value === null) {
        return res.status(400).json({ success: false, message: 'Geçersiz veri.' });
    }

    const query = 'INSERT INTO gas_logs (gas_value) VALUES (?)';
    db.run(query, [gas_value], function(err) {
        if (err) {
            console.error('Error inserting gas log:', err.message);
            return res.status(500).json({ success: false, message: 'Veritabanı hatası.' });
        }
        console.log(`[BAŞARILI] Gaz alarmı kaydedildi: Seviye ${gas_value}`);
        
        // Tüm adminleri bul ve bildirim kaydet
        db.all('SELECT id FROM users WHERE is_admin = 1', [], (err, admins) => {
            if (!err && admins) {
                const stmt = db.prepare('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)');
                admins.forEach(admin => {
                    stmt.run(admin.id, 'gas', '🔥 DİKKAT: Gaz Sızıntısı!', `MQ-2 Sensöründe kritik duman/gaz algılandı (Seviye: ${gas_value})`);
                });
                stmt.finalize();
            }
        });

        // Yalnızca admin odasındaki kullanıcılara anlık bildirim gönder
        io.to('admin_room').emit('notification', {
            type: 'gas',
            title: '🔥 DİKKAT: Gaz Sızıntısı!',
            message: `MQ-2 Sensöründe kritik duman/gaz algılandı (Seviye: ${gas_value})`,
            time: new Date().toLocaleTimeString('tr-TR')
        });

        res.json({ success: true, message: 'Gaz/Duman alarmı eklendi.', id: this.lastID });
    });
});

// API Endpoint: Get Gas Logs
app.get('/api/gas_logs', (req, res) => {
    const query = 'SELECT * FROM gas_logs ORDER BY timestamp DESC LIMIT 100';
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Error fetching gas logs:', err.message);
            return res.status(500).json({ success: false, message: 'Veritabanı hatası.' });
        }
        res.json({ success: true, logs: rows });
    });
});

// API Endpoint: Get Unread Notifications
app.get('/api/notifications/unread', verifyToken, (req, res) => {
    const userId = req.user.id;
    const query = 'SELECT * FROM notifications WHERE user_id = ? AND is_read = 0 ORDER BY timestamp DESC';
    db.all(query, [userId], (err, rows) => {
        if (err) return res.status(500).json({ success: false, message: 'Veritabanı hatası.' });
        res.json({ success: true, notifications: rows });
    });
});

// API Endpoint: Mark Notifications as Read
app.post('/api/notifications/read', verifyToken, (req, res) => {
    const userId = req.user.id;
    const query = 'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0';
    db.run(query, [userId], function(err) {
        if (err) return res.status(500).json({ success: false, message: 'Veritabanı hatası.' });
        res.json({ success: true });
    });
});
app.get('/api/gas_logs', (req, res) => {
    const query = 'SELECT * FROM gas_logs ORDER BY timestamp DESC LIMIT 100';
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Error fetching gas logs:', err.message);
            return res.status(500).json({ success: false, message: 'Veritabanı hatası.' });
        }
        res.json({ success: true, logs: rows });
    });
});

// Sunucunun dinleyeceği Port ve (varsa) IP adresi. 
// "0.0.0.0" yazarsanız bilgisayarınızın tüm IP'lerinden gelen veriyi kabul eder (Varsayılan).
// Eğer sadece spesifik bir IP üzerinden (örneğin VPN, Hamachi veya statik IP) veri almak istiyorsanız,
// o IP'yi buraya yazabilirsiniz (örn: '192.168.220.1' veya '10.37.38.48').
const HOST = '0.0.0.0'; 

// --- Helper: Send Audit Notification ---
function sendAuditNotification(actorId, title, message) {
    db.all('SELECT id FROM users WHERE is_admin = 1 AND id != ?', [actorId], async (err, admins) => {
        if (!err && admins && admins.length > 0) {
            const stmt = db.prepare('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)');
            admins.forEach(admin => {
                stmt.run(admin.id, 'audit', title, message);
            });
            stmt.finalize();

            // Sadece diğer yöneticilerin socket'larına gönder
            try {
                const sockets = await io.in('admin_room').fetchSockets();
                for (const socket of sockets) {
                    if (socket.user && socket.user.id !== actorId) {
                        socket.emit('notification', {
                            type: 'audit',
                            title: title,
                            message: message,
                            time: new Date().toLocaleTimeString('tr-TR')
                        });
                    }
                }
            } catch (e) {
                console.error("Audit emit error:", e);
            }
        }
    });
}

// --- VIDEO RECORDING LOGIC ---
const recordsDir = path.join(__dirname, 'public', 'video_kayit');
if (!fs.existsSync(recordsDir)) {
    fs.mkdirSync(recordsDir, { recursive: true });
}
const activeRecordings = new Map(); // userId -> { request, response, fileStream, timeout, username }

function stopRecording(userId, manual = false) {
    if (activeRecordings.has(userId)) {
        const rec = activeRecordings.get(userId);
        if (rec.timeout) clearTimeout(rec.timeout);
        rec.request.destroy(); // Cancel HTTP GET request
        rec.fileStream.close(); // Close file
        activeRecordings.delete(userId);
        
        // Audit log
        sendAuditNotification(
            userId,
            '🛑 Kayıt Tamamlandı',
            `Yönetici (${rec.username}) tarafından başlatılan kamera kaydı ${manual ? 'manuel olarak durduruldu' : 'süresi dolduğu için tamamlandı'} ve diske kaydedildi.`
        );
        return true;
    }
    return false;
}

// POST /api/record/start
app.post('/api/record/start', verifyToken, requireAdmin, (req, res) => {
    const { streamUrl, duration } = req.body;
    const userId = req.user.id;

    if (!streamUrl) return res.status(400).json({ success: false, message: 'Stream URL zorunludur.' });
    if (activeRecordings.has(userId)) return res.status(400).json({ success: false, message: 'Zaten devam eden bir kaydınız var.' });

    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    const timestamp = `${day}-${month}-${year}_${hours}-${minutes}-${seconds}`;
    const filename = `${timestamp}.mjpeg`;
    const filepath = path.join(recordsDir, filename);

    const fileStream = fs.createWriteStream(filepath);
    const httpModule = streamUrl.startsWith('https') ? require('https') : require('http');

    const request = httpModule.get(streamUrl, (response) => {
        if (response.statusCode !== 200) {
            fileStream.close();
            if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
            return res.status(500).json({ success: false, message: 'Kamera yayınına bağlanılamadı. Kod: ' + response.statusCode });
        }

        response.pipe(fileStream);

        // Audit Log
        const durationText = duration > 0 ? `${duration} dakikalık` : `süresiz (manuel)`;
        sendAuditNotification(
            userId,
            '🎥 Video Kaydı Başladı',
            `Yönetici (${req.user.username}), Ana Giriş kamerasından ${durationText} bir kayıt başlattı.`
        );

        res.json({ success: true, message: 'Kayıt başladı.' });

        let timeout = null;
        if (duration > 0) {
            timeout = setTimeout(() => {
                stopRecording(userId, false);
            }, duration * 60 * 1000);
        }

        activeRecordings.set(userId, { request, response, fileStream, timeout, username: req.user.username });
        
        response.on('end', () => stopRecording(userId, false));
        response.on('error', () => stopRecording(userId, false));
    }).on('error', (err) => {
        fileStream.close();
        if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
        if (!res.headersSent) {
            res.status(500).json({ success: false, message: 'Kamera IP adresine ulaşılamadı.' });
        }
    });
});

// POST /api/record/stop
app.post('/api/record/stop', verifyToken, requireAdmin, (req, res) => {
    const userId = req.user.id;
    if (stopRecording(userId, true)) {
        res.json({ success: true, message: 'Kayıt başarıyla durduruldu.' });
    } else {
        res.status(400).json({ success: false, message: 'Devam eden bir kayıt bulunamadı.' });
    }
});

// GET /api/records
app.get('/api/records', verifyToken, requireAdmin, (req, res) => {
    fs.readdir(recordsDir, (err, files) => {
        if (err) return res.status(500).json({ success: false, message: 'Klasör okunamadı.' });
        
        const mjpegFiles = files.filter(f => f.endsWith('.mjpeg')).map(file => {
            const stats = fs.statSync(path.join(recordsDir, file));
            return {
                name: file,
                size: (stats.size / (1024 * 1024)).toFixed(2) + ' MB',
                time: stats.mtime
            };
        });
        
        // Yeniden eskiye sırala
        mjpegFiles.sort((a, b) => b.time - a.time);
        
        res.json({ success: true, records: mjpegFiles });
    });
});

// --- VIDEO PLAYBACK (THROTTLED STREAM) ---
class Throttle extends Transform {
    constructor(bytesPerSecond) {
        super();
        this.bytesPerSecond = bytesPerSecond;
    }
    _transform(chunk, encoding, callback) {
        const delay = (chunk.length / this.bytesPerSecond) * 1000;
        setTimeout(() => {
            this.push(chunk);
            callback();
        }, delay);
    }
}

app.get('/api/play/:filename', (req, res) => {
    const token = req.query.token;
    if (!token) return res.status(401).send('Yetkisiz erişim (Token Eksik)');
    
    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err || decoded.is_admin !== 1) return res.status(403).send('Yetkisiz erişim');
        
        const filename = req.params.filename;
        const filepath = path.join(recordsDir, filename);
        
        if (!fs.existsSync(filepath)) {
            return res.status(404).send('Kayıt bulunamadı');
        }

        const fd = fs.openSync(filepath, 'r');
        const buffer = Buffer.alloc(100);
        fs.readSync(fd, buffer, 0, 100, 0);
        fs.closeSync(fd);
        
        const str = buffer.toString('utf8');
        const match = str.match(/--([a-zA-Z0-9]+)/);
        const boundary = match ? match[1] : '123456789000000000000987654321';

        res.writeHead(200, {
            'Content-Type': `multipart/x-mixed-replace; boundary=${boundary}`,
            'Cache-Control': 'no-cache',
            'Connection': 'close',
            'Pragma': 'no-cache'
        });

        const readStream = fs.createReadStream(filepath);
        // Saniyede ~350 KB hızla gönder (Gerçek oynatma hızına yaklaşmak için)
        const throttle = new Throttle(350 * 1024);
        
        readStream.pipe(throttle).pipe(res);
        
        req.on('close', () => {
            readStream.destroy();
        });
    });
});

// --- ADMIN API ENDPOINTS ---
// GET /api/admin/users
app.get('/api/admin/users', verifyToken, requireAdmin, (req, res) => {
    const query = 'SELECT id, username, is_admin FROM users ORDER BY id ASC';
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ success: false, message: 'Veritabanı hatası.' });
        res.json({ success: true, users: rows });
    });
});

// POST /api/admin/users
app.post('/api/admin/users', verifyToken, requireAdmin, (req, res) => {
    const { username, password, is_admin } = req.body;
    if (!username || !password) return res.status(400).json({ success: false, message: 'Kullanıcı adı ve şifre zorunludur.' });
    
    const query = 'INSERT INTO users (username, password, is_admin) VALUES (?, ?, ?)';
    db.run(query, [username, password, is_admin ? 1 : 0], function(err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(400).json({ success: false, message: 'Bu kullanıcı adı zaten mevcut.' });
            }
            return res.status(500).json({ success: false, message: 'Veritabanı hatası.' });
        }
        
        // Audit Log
        sendAuditNotification(
            req.user.id, 
            '🛡️ Yeni Kullanıcı Eklendi', 
            `Yönetici (${req.user.username}), "${username}" adlı yeni bir kullanıcı oluşturdu.`
        );
        
        res.json({ success: true, message: 'Kullanıcı başarıyla oluşturuldu.' });
    });
});

// PUT /api/admin/users/:id
app.put('/api/admin/users/:id', verifyToken, requireAdmin, (req, res) => {
    const { id } = req.params;
    const { username, password, is_admin } = req.body;
    
    if (!username) return res.status(400).json({ success: false, message: 'Kullanıcı adı boş olamaz.' });
    
    // Güvenlik: Admin, diğer admini güncelleyemez. Sadece kendini güncelleyebilir.
    db.get('SELECT username, is_admin FROM users WHERE id = ?', [id], (err, row) => {
        if (err) return res.status(500).json({ success: false, message: 'Veritabanı hatası.' });
        if (!row) return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı.' });
        
        if (row.is_admin === 1 && parseInt(id) !== req.user.id) {
            // Audit Log: Blocked Edit Attempt
            sendAuditNotification(
                req.user.id,
                '⚠️ Yetkisiz İşlem Denemesi',
                `Yönetici (${req.user.username}), "${row.username}" adlı diğer bir yöneticinin profiline müdahale etmeye çalıştı ancak engellendi!`
            );
            return res.status(403).json({ success: false, message: 'Başka bir yöneticinin bilgilerini değiştiremezsiniz!' });
        }
        
        // Eğer şifre gönderilmişse şifreyi de güncelle, gönderilmemişse sadece username/yetki güncelle
        if (password && password.trim() !== '') {
            const query = 'UPDATE users SET username = ?, password = ?, is_admin = ? WHERE id = ?';
            db.run(query, [username, password, is_admin ? 1 : 0, id], function(err) {
                if (err) return res.status(500).json({ success: false, message: err.message });
                res.json({ success: true, message: 'Kullanıcı güncellendi.' });
            });
        } else {
            const query = 'UPDATE users SET username = ?, is_admin = ? WHERE id = ?';
            db.run(query, [username, is_admin ? 1 : 0, id], function(err) {
                if (err) return res.status(500).json({ success: false, message: err.message });
                res.json({ success: true, message: 'Kullanıcı güncellendi.' });
            });
        }
    });
});

// DELETE /api/admin/users/:id
app.delete('/api/admin/users/:id', verifyToken, requireAdmin, (req, res) => {
    const { id } = req.params;
    
    if (parseInt(id) === req.user.id) {
         return res.status(400).json({ success: false, message: 'Kendi hesabınızı silemezsiniz!' });
    }

    // Önce silinmek istenen kullanıcının admin olup olmadığını kontrol et
    db.get('SELECT username, is_admin FROM users WHERE id = ?', [id], (err, row) => {
        if (err) return res.status(500).json({ success: false, message: 'Veritabanı hatası.' });
        if (!row) return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı.' });
        
        if (row.is_admin === 1) {
            // Audit Log: Blocked Deletion Attempt
            sendAuditNotification(
                req.user.id,
                '⚠️ Yetkisiz İşlem Denemesi',
                `Yönetici (${req.user.username}), "${row.username}" adlı diğer bir yöneticiyi silmeye çalıştı ancak engellendi!`
            );
            return res.status(403).json({ success: false, message: 'Yetkisiz İşlem: Bir yönetici başka bir yöneticiyi silemez!' });
        }

        const query = 'DELETE FROM users WHERE id = ?';
        db.run(query, [id], function(deleteErr) {
            if (deleteErr) return res.status(500).json({ success: false, message: 'Veritabanı hatası.' });
            
            // Audit Log: Successful Deletion
            sendAuditNotification(
                req.user.id,
                '🗑️ Kullanıcı Silindi',
                `Yönetici (${req.user.username}), "${row.username}" adlı kullanıcıyı sistemden sildi.`
            );
            
            res.json({ success: true, message: 'Kullanıcı silindi.' });
        });
    });
});

// Start Server
server.listen(PORT, HOST, () => {
    console.log(`Server running at http://${HOST === '0.0.0.0' ? 'localhost (Tüm Ağlar)' : HOST}:${PORT}`);
});
