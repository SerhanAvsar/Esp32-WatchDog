require('dotenv').config();
const express = require('express');
const fs = require('fs');
const cors = require('cors');
const path = require('path');
const db = require('./database');
const jwt = require('jsonwebtoken');
const { verifyToken, requireAdmin, SECRET_KEY } = require('./middleware/auth');
const http = require('http');
const { Transform } = require('stream');
const nodemailer = require('nodemailer');

// --- E-posta Gönderici (Nodemailer) Ayarı ---
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 465,
    secure: true,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

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
            
            // Tüm adminleri bul ve bildirim kaydet, e-posta ayarı açık olanlara mail gönder
            db.all('SELECT id, is_admin, email_address, notify_motion_sensor FROM users', [], (err, users) => {
                if (!err && users) {
                    const stmt = db.prepare('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)');
                    users.forEach(user => {
                        if (user.is_admin === 1) {
                            stmt.run(user.id, 'motion', 'Hareket Tespiti!', `Kapı sensöründe ${distance} cm mesafede hareket algılandı.`);
                        }
                        if (user.notify_motion_sensor === 1 && user.email_address) {
                            transporter.sendMail({
                                from: process.env.SMTP_USER,
                                to: user.email_address,
                                subject: 'Sistem Uyarı: Hareket Tespiti!',
                                text: `Kapı sensöründe ${distance} cm mesafede hareket algılandı.\nTarih: ${new Date().toLocaleString('tr-TR')}`
                            }).catch(e => console.error("Mail error:", e));
                        }
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

// API Endpoint: Get User QR
app.get('/api/user/qr', verifyToken, (req, res) => {
    const userId = req.user.id;
    db.get('SELECT qr_token FROM users WHERE id = ?', [userId], (err, row) => {
        if (err || !row) return res.status(500).json({ success: false, message: 'Kullanıcı bulunamadı.' });
        res.json({ success: true, qr_token: row.qr_token });
    });
});

// API Endpoint: Get User Settings
app.get('/api/user/settings', verifyToken, (req, res) => {
    const userId = req.user.id;
    db.get('SELECT email_address, notify_motion_sensor, notify_admin_change FROM users WHERE id = ?', [userId], (err, row) => {
        if (err || !row) return res.status(500).json({ success: false, message: 'Kullanıcı bulunamadı.' });
        res.json({ success: true, settings: row });
    });
});

// API Endpoint: Update User Settings
app.put('/api/user/settings', verifyToken, (req, res) => {
    const userId = req.user.id;
    const { email_address, notify_motion_sensor, notify_admin_change } = req.body;
    
    const query = 'UPDATE users SET email_address = ?, notify_motion_sensor = ?, notify_admin_change = ? WHERE id = ?';
    db.run(query, [email_address, notify_motion_sensor ? 1 : 0, notify_admin_change ? 1 : 0, userId], function(err) {
        if (err) return res.status(500).json({ success: false, message: 'Veritabanı hatası.' });
        res.json({ success: true, message: 'Ayarlar güncellendi.' });
    });
});

// --- QR SCANNER LOGIC (Background Worker) ---
const jsQR = require('jsqr');
const { Jimp } = require('jimp');
const activeScanners = new Map(); // ip -> boolean (is active)
const scanningLock = new Map(); // ip -> boolean (is processing)

function processQR(ip) {
    if (!activeScanners.get(ip)) return;
    if (scanningLock.get(ip)) return;
    
    scanningLock.set(ip, true);

    const httpModule = require('http');
    const captureUrl = `http://${ip}/capture`;
    
    const request = httpModule.get(captureUrl, { timeout: 3000 }, (response) => {
        if (response.statusCode !== 200) {
            console.log(`[QR SCANNER] Failed to get capture from ${ip}. Status: ${response.statusCode}`);
            scanningLock.set(ip, false);
            setTimeout(() => processQR(ip), 500);
            return;
        }
        
        const chunks = [];
        response.on('data', chunk => chunks.push(chunk));
        response.on('end', async () => {
            try {
                const buffer = Buffer.concat(chunks);
                // Görüntü ön işleme: Siyah beyaz yap, kontrast artır ki kameranın zayıflığını telafi edelim
                const image = await Jimp.read(buffer);
                image.greyscale();
                // Jimp v1'de contrast(value) (-1 to 1) 0.5 ile %50 arttırılır. Yeni sürüm için test:
                try { image.contrast(0.5); } catch(e){} 

                const code = jsQR(image.bitmap.data, image.bitmap.width, image.bitmap.height, { inversionAttempts: "attemptBoth" });
                
                if (code) {
                    console.log(`[QR SCANNER] Raw QR detected: ${code.data}`);
                    const qrToken = code.data;
                    db.get('SELECT id, username, is_admin FROM users WHERE qr_token = ?', [qrToken], (err, user) => {
                        if (!err && user) {
                            // Eşleşen kullanıcı bulundu!
                            console.log(`[QR ACCESS] Başarılı Giriş: ${user.username}`);

                            // 1. ESP32 Sensörünü Kapat (1 Dakika)
                            const disableUrl = `http://${ip}/disable_sensor?duration=60`;
                            httpModule.get(disableUrl, (res) => {
                                res.on('data', () => {});
                                res.on('end', () => console.log(`[QR SCANNER] ESP32 Sensörü 1 dk kapatıldı.`));
                            }).on('error', (e) => console.log('[QR SCANNER] Disable Sensor Hatası:', e.message));
                            
                            // 2. Audit Log & E-posta Bildirimi Gönder (Adminlere)
                            db.all('SELECT id, email_address FROM users WHERE is_admin = 1', [], (err, admins) => {
                                if (!err && admins) {
                                    const stmt = db.prepare('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)');
                                    
                                    const notifyTitle = '✅ QR ile Giriş!';
                                    const notifyMessage = `${user.username} isimli kullanıcı QR okuttu. Kapı hareket sensörü 1 dakika deaktif edildi.`;

                                    admins.forEach(admin => {
                                        // DB içi bildirim (Tüm adminlere düşer)
                                        stmt.run(admin.id, 'access', notifyTitle, notifyMessage);

                                        // Mail kuralı: Kendi hesabına giriş yapıyorsa kendine mail atma, sadece DİĞER adminlere at.
                                        // Admin olmayan biri giriyorsa TÜM adminlere at.
                                        if (admin.id !== user.id && admin.email_address && process.env.SMTP_USER) {
                                            const mailOptions = {
                                                from: `"Güvenlik Paneli" <${process.env.SMTP_USER}>`,
                                                to: admin.email_address,
                                                subject: '🚨 QR Erişim Uyarısı',
                                                text: `Sistem Bilgisi: ${user.username} isimli kullanıcı QR kod okutarak giriş yaptı.\nTarih: ${new Date().toLocaleString('tr-TR')}\nKapı/Hareket sensörü 1 dakika boyunca devre dışı bırakıldı.`
                                            };
                                            transporter.sendMail(mailOptions).catch(e => console.log('[MAIL ERROR]', e.message));
                                        }
                                    });
                                    stmt.finalize();
                                }
                            });
                            
                            io.to('admin_room').emit('notification', {
                                type: 'access',
                                title: '✅ QR ile Giriş!',
                                message: `${user.username} isimli kullanıcı QR okuttu. Kapı hareket sensörü 1 dakika deaktif edildi.`,
                                time: new Date().toLocaleTimeString('tr-TR')
                            });
                        } else {
                            console.log(`[QR SCANNER] Geçiçersiz veya veritabanında bulunmayan QR: ${qrToken}`);
                        }
                    });
                } else {
                    console.log(`[QR SCANNER] Frame okundu ama QR bulunamadı. (Boyut: ${image.bitmap.width}x${image.bitmap.height})`);
                }
            } catch (e) {
                console.log(`[QR SCANNER] Decode/Jimp Hatası:`, e.message);
            } finally {
                scanningLock.set(ip, false);
                setTimeout(() => processQR(ip), 500);
            }
        });
    });

    request.on('timeout', () => {
        console.log(`[QR SCANNER] Timeout! ESP32 cevap vermiyor.`);
        request.destroy();
        scanningLock.set(ip, false);
        setTimeout(() => processQR(ip), 1000);
    });

    request.on('error', (err) => {
        console.log(`[QR SCANNER] HTTP Request Hatası:`, err.message);
        scanningLock.set(ip, false);
        setTimeout(() => processQR(ip), 1000);
    });
}

app.post('/api/admin/scanner/start', verifyToken, requireAdmin, (req, res) => {
    const { cameraIp } = req.body;
    if (!cameraIp) return res.status(400).json({ success: false, message: 'Kamera IP zorunludur.' });
    if (activeScanners.has(cameraIp)) return res.status(400).json({ success: false, message: 'Bu kamera için tarayıcı zaten aktif.' });

    // Cihazı yormamak ve hızlı okumak için recursive döngü kullanıyoruz
    activeScanners.set(cameraIp, true);
    processQR(cameraIp);
    res.json({ success: true, message: 'Arka plan QR Tarayıcı başlatıldı.' });
});

app.post('/api/admin/scanner/stop', verifyToken, requireAdmin, (req, res) => {
    const { cameraIp } = req.body;
    if (activeScanners.has(cameraIp)) {
        activeScanners.delete(cameraIp);
        scanningLock.delete(cameraIp);
        res.json({ success: true, message: 'QR Tarayıcı durduruldu.' });
    } else {
        res.status(400).json({ success: false, message: 'Tarayıcı zaten kapalı.' });
    }
});

app.get('/api/admin/scanner/status', verifyToken, requireAdmin, (req, res) => {
    res.json({ success: true, activeIps: Array.from(activeScanners.keys()) });
});


// --- Helper: Send Audit Notification ---
function sendAuditNotification(actorId, title, message) {
    db.all('SELECT id, email_address, notify_admin_change FROM users WHERE is_admin = 1 AND id != ?', [actorId], async (err, admins) => {
        if (!err && admins && admins.length > 0) {
            const stmt = db.prepare('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)');
            admins.forEach(admin => {
                stmt.run(admin.id, 'audit', title, message);
                
                if (admin.notify_admin_change === 1 && admin.email_address) {
                    transporter.sendMail({
                        from: process.env.SMTP_USER,
                        to: admin.email_address,
                        subject: `Sistem Güncellemesi: ${title}`,
                        text: `${message}\n\nTarih: ${new Date().toLocaleString('tr-TR')}`
                    }).catch(e => console.error("Admin mail error:", e));
                }
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



// --- ADMIN API ENDPOINTS ---
// GET /api/admin/users
app.get('/api/admin/users', verifyToken, requireAdmin, (req, res) => {
    const query = 'SELECT id, username, is_admin, qr_token FROM users ORDER BY id ASC';
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ success: false, message: 'Veritabanı hatası.' });
        res.json({ success: true, users: rows });
    });
});

// POST /api/admin/users
app.post('/api/admin/users', verifyToken, requireAdmin, (req, res) => {
    const { username, password, is_admin } = req.body;
    if (!username || !password) return res.status(400).json({ success: false, message: 'Kullanıcı adı ve şifre zorunludur.' });
    
    const { v4: uuidv4 } = require('uuid');
    const qr_token = uuidv4();

    const query = 'INSERT INTO users (username, password, is_admin, qr_token) VALUES (?, ?, ?, ?)';
    db.run(query, [username, password, is_admin ? 1 : 0, qr_token], function(err) {
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
                
                sendAuditNotification(
                    req.user.id,
                    '🔄 Kullanıcı Güncellendi',
                    `Yönetici (${req.user.username}), "${row.username}" adlı kullanıcının bilgilerini ve şifresini güncelledi.`
                );
                
                res.json({ success: true, message: 'Kullanıcı güncellendi.' });
            });
        } else {
            const query = 'UPDATE users SET username = ?, is_admin = ? WHERE id = ?';
            db.run(query, [username, is_admin ? 1 : 0, id], function(err) {
                if (err) return res.status(500).json({ success: false, message: err.message });
                
                sendAuditNotification(
                    req.user.id,
                    '🔄 Kullanıcı Güncellendi',
                    `Yönetici (${req.user.username}), "${row.username}" adlı kullanıcının bilgilerini güncelledi.`
                );
                
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

// POST /api/admin/users/:id/reset-qr
app.post('/api/admin/users/:id/reset-qr', verifyToken, requireAdmin, (req, res) => {
    const { id } = req.params;
    
    db.get('SELECT username FROM users WHERE id = ?', [id], (err, row) => {
        if (err || !row) return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı.' });
        
        const { v4: uuidv4 } = require('uuid');
        const new_qr_token = uuidv4();
        
        db.run('UPDATE users SET qr_token = ? WHERE id = ?', [new_qr_token, id], function(updateErr) {
            if (updateErr) return res.status(500).json({ success: false, message: 'Veritabanı hatası.' });
            
            // Audit Log: QR Reset
            sendAuditNotification(
                req.user.id,
                '🔄 QR Kodu Yenilendi',
                `Yönetici (${req.user.username}), "${row.username}" adlı kullanıcının QR kodunu yeniledi.`
            );
            
            res.json({ success: true, qr_token: new_qr_token, message: 'QR Kodu başarıyla yenilendi.' });
        });
    });
});

// Start Server
server.listen(PORT, HOST, () => {
    console.log(`Server running at http://${HOST === '0.0.0.0' ? 'localhost (Tüm Ağlar)' : HOST}:${PORT}`);
});
