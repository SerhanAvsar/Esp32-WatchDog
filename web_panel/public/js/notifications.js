document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    const isAdmin = localStorage.getItem('isAdmin');

    // Sadece Adminler bildirim sistemine bağlanabilir
    if (!token || isAdmin !== 'true') return;

    // 1. DİNAMİK DROPDOWN OLUŞTURMA
    const bellContainer = document.querySelector('.notification-bell');
    if (!bellContainer) return; // Çan yoksa devam etme

    // Çan kapsayıcısını relative yapalım ki dropdown ona göre konumlansın
    bellContainer.parentNode.style.position = 'relative';

    // Dropdown HTML'ini oluştur ve ekle
    const dropdownHtml = `
        <div class="notification-dropdown" id="notificationDropdown">
            <div class="dropdown-header">
                <h4>Bildirimler</h4>
                <button class="mark-read-btn" id="markReadBtn">Tümünü Okundu İşaretle</button>
            </div>
            <div class="dropdown-body" id="dropdownBody">
                <div class="empty-notifications">Yükleniyor...</div>
            </div>
        </div>
    `;
    bellContainer.insertAdjacentHTML('afterend', dropdownHtml);

    // Çanın tıklama (yönlendirme) özelliğini iptal et ve dropdown açılır yap
    bellContainer.removeAttribute('onclick');
    const dropdown = document.getElementById('notificationDropdown');
    const dropdownBody = document.getElementById('dropdownBody');
    const badge = document.getElementById('notificationBadge');
    
    let unreadCount = 0;
    let unreadData = [];

    bellContainer.addEventListener('click', () => {
        dropdown.classList.toggle('show');
        if (dropdown.classList.contains('show') && unreadCount > 0) {
            markAsRead();
        }
    });

    // Sayfa dışına tıklayınca dropdown'u kapat
    document.addEventListener('click', (e) => {
        if (!bellContainer.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove('show');
        }
    });

    document.getElementById('markReadBtn').addEventListener('click', markAsRead);

    // 2. SUNUCUDAN OKUNMAMIŞ BİLDİRİMLERİ ÇEK
    function fetchUnread() {
        fetch('/api/notifications/unread', {
            headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                unreadData = data.notifications;
                unreadCount = unreadData.length;
                updateBadge();
                renderDropdown();
            }
        })
        .catch(err => console.error('Bildirimler çekilemedi:', err));
    }

    // 3. EKRANA ÇİZ
    function updateBadge() {
        if (unreadCount > 0) {
            badge.textContent = unreadCount;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }

    function renderDropdown() {
        if (unreadData.length === 0) {
            dropdownBody.innerHTML = '<div class="empty-notifications">Okunmamış bildiriminiz yok.</div>';
            return;
        }

        dropdownBody.innerHTML = unreadData.map(n => {
            const isGas = n.type === 'gas';
            const isAudit = n.type === 'audit';
            
            let icon = '⚠️';
            let link = 'logs.html';
            
            if (isGas) {
                icon = '🔥';
                link = 'gas_logs.html';
            } else if (isAudit) {
                icon = '🛡️';
                link = 'admin.html';
            }
            
            // Sunucudan gelen timestamp'i düzgün gösterelim
            const time = new Date(n.timestamp).toLocaleString('tr-TR');
            
            return `
                <a href="${link}" class="dropdown-item unread">
                    <div style="font-size: 20px;">${icon}</div>
                    <div>
                        <h4 style="margin:0; font-size:14px; color:white;">${n.title}</h4>
                        <p style="margin:2px 0 0 0; font-size:12px; color:#cbd5e1;">${n.message}</p>
                        <span style="font-size:10px; color:#64748b;">${time}</span>
                    </div>
                </a>
            `;
        }).join('');
    }

    // 4. OKUNDU İŞARETLE
    function markAsRead() {
        if (unreadCount === 0) return;

        fetch('/api/notifications/read', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                unreadCount = 0;
                updateBadge();
                // Arkadan dropdown listesindeki sarımtırak okunmadı arka planlarını temizle
                document.querySelectorAll('.dropdown-item').forEach(el => el.classList.remove('unread'));
            }
        });
    }

    // 5. SOCKET BAĞLANTISI (ANLIK BİLDİRİMLER İÇİN)
    const socket = io({
        auth: { token: token }
    });

    socket.on('notification', (data) => {
        // Yeni bildirim geldi, sayacı ve listeyi güncelle
        unreadCount++;
        updateBadge();
        bellContainer.classList.add('shake');
        setTimeout(() => bellContainer.classList.remove('shake'), 500);

        // Listeye en üste ekle
        unreadData.unshift({
            type: data.type,
            title: data.title,
            message: data.message,
            timestamp: new Date() // Şimdi
        });
        renderDropdown();
        
        // Ekranda Toast mesajı göster
        showToast(data);
    });

    function showToast(data) {
        let container = document.getElementById('toastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toastContainer';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        const isGas = data.type === 'gas';
        const isAudit = data.type === 'audit';
        
        let toastClass = 'toast-warning';
        let toastIcon = '⚠️';
        
        if (isGas) {
            toastClass = 'toast-danger';
            toastIcon = '🔥';
        } else if (isAudit) {
            toastClass = 'toast-info';
            toastIcon = '🛡️';
        }
        
        const toast = document.createElement('div');
        toast.className = `toast fade-in-up ${toastClass}`;
        toast.innerHTML = `
            <div class="toast-icon">${toastIcon}</div>
            <div class="toast-content">
                <h4>${data.title}</h4>
                <p>${data.message}</p>
                <span class="toast-time">${data.time}</span>
            </div>
            <button class="toast-close">&times;</button>
        `;

        container.appendChild(toast);

        toast.querySelector('.toast-close').addEventListener('click', () => {
            toast.style.animation = 'slideOutRight 0.3s forwards';
            setTimeout(() => toast.remove(), 300);
        });

        setTimeout(() => {
            if (document.body.contains(toast)) {
                toast.style.animation = 'slideOutRight 0.3s forwards';
                setTimeout(() => toast.remove(), 300);
            }
        }, 5000);
    }

    // Başlangıçta eski okunmamışları çek
    fetchUnread();
});
