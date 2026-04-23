const jwt = require('jsonwebtoken');

// Güvenlik anahtarı (Gerçek projelerde .env dosyasında saklanmalıdır)
const SECRET_KEY = 'super_secret_esp32_key_123!';

// Token doğrulama (Herhangi bir kayıtlı kullanıcı girebilir)
const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    
    if (!authHeader) {
        return res.status(403).json({ success: false, message: 'Erişim reddedildi. Token bulunamadı.' });
    }

    const token = authHeader.split(' ')[1]; // "Bearer TOKEN" formatından ayır
    
    if (!token) {
        return res.status(403).json({ success: false, message: 'Erişim reddedildi. Hatalı token formatı.' });
    }

    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) {
            return res.status(401).json({ success: false, message: 'Geçersiz veya süresi dolmuş token.' });
        }
        
        req.user = decoded; // Token içindeki {id, username, is_admin} verisini req objesine ekle
        next();
    });
};

// Sadece Admin yetkisi olanların girmesini sağlayan ek filtre
const requireAdmin = (req, res, next) => {
    // Önce verifyToken çalıştırıldığı için req.user dolu olmalı
    if (!req.user || req.user.is_admin !== 1) {
        return res.status(403).json({ success: false, message: 'Yetkisiz Erişim. Sadece yöneticiler bu işlemi yapabilir.' });
    }
    next();
};

module.exports = {
    verifyToken,
    requireAdmin,
    SECRET_KEY
};
