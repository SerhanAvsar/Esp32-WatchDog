document.addEventListener('DOMContentLoaded', () => {
    // Check if user is legally logged in
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    const isAdmin = localStorage.getItem('isAdmin');
    if (isLoggedIn !== 'true') {
        window.location.href = 'index.html';
        return;
    }

    if (isAdmin !== 'true') {
        document.querySelector('main').innerHTML = `
            <div style="text-align: center; margin-top: 80px;">
                <div style="font-size: 5rem; margin-bottom: 20px;">🚫</div>
                <h2 style="color: #fc8181; font-size: 2.5rem; margin-bottom: 15px;">Yetkisiz Giriş!</h2>
                <p style="color: #a0aec0; font-size: 1.2rem;">Standart kullanıcı hesabı ile sistem loglarına erişim yetkiniz bulunmamaktadır.<br>Lütfen yalnızca size izin verilen "Canlı Kamera" modülünü kullanın.</p>
            </div>
        `;
        return;
    }

    const logsTableBody = document.getElementById('logsTableBody');
    const refreshBtn = document.getElementById('refreshBtn');
    const logoutBtn = document.getElementById('logoutBtn');

    // Logout handler
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('isLoggedIn');
            localStorage.removeItem('username');
            window.location.href = 'index.html';
        });
    }

    // Fetch logs
    async function fetchLogs() {
        try {
            logsTableBody.innerHTML = '<tr><td colspan="4" class="no-data">Veriler yükleniyor...</td></tr>';
            
            const response = await fetch('/api/logs');
            const data = await response.json();

            if (data.success) {
                renderLogs(data.logs);
            } else {
                logsTableBody.innerHTML = `<tr><td colspan="4" class="no-data">Hata: ${data.message}</td></tr>`;
            }
        } catch (error) {
            console.error('Error fetching logs:', error);
            logsTableBody.innerHTML = '<tr><td colspan="4" class="no-data">Veriler yüklenemedi. Sunucu bağlantısını kontrol edin.</td></tr>';
        }
    }

    function renderLogs(logs) {
        if (!logs || logs.length === 0) {
            logsTableBody.innerHTML = '<tr><td colspan="4" class="no-data">Henüz hiçbir sensör kaydı bulunmuyor.</td></tr>';
            return;
        }

        logsTableBody.innerHTML = '';
        
        logs.forEach(log => {
            const dateObj = new Date(log.timestamp);
            const dateStr = dateObj.toLocaleDateString('tr-TR');
            const timeStr = dateObj.toLocaleTimeString('tr-TR');

            const tr = document.createElement('tr');
            
            // Format distance (e.g. 15.5 cm)
            const distanceText = parseFloat(log.distance).toFixed(1) + ' cm';
            
            tr.innerHTML = `
                <td>#${log.id}</td>
                <td>${dateStr} - ${timeStr}</td>
                <td><span class="distance-badge">${distanceText}</span></td>
                <td><span style="color: #4fd1c5;">Kayıt Eklendi</span></td>
            `;
            
            logsTableBody.appendChild(tr);
        });
    }

    // Refresh button event
    if (refreshBtn) {
        refreshBtn.addEventListener('click', fetchLogs);
    }

    // Initial fetch
    fetchLogs();
    
    // Auto refresh every 5 seconds
    setInterval(fetchLogs, 5000);
});
