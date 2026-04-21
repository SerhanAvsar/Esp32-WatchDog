document.addEventListener('DOMContentLoaded', () => {
    // Check if user is legally logged in
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    if (isLoggedIn !== 'true') {
        window.location.href = 'index.html';
        return;
    }

    const gasTableBody = document.getElementById('gasTableBody');
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

    // Fetch gas logs
    async function fetchGasLogs() {
        try {
            gasTableBody.innerHTML = '<tr><td colspan="4" class="no-data">Veriler yükleniyor...</td></tr>';
            
            const response = await fetch('/api/gas_logs');
            const data = await response.json();

            if (data.success) {
                renderGasLogs(data.logs);
            } else {
                gasTableBody.innerHTML = `<tr><td colspan="4" class="no-data">Hata: ${data.message}</td></tr>`;
            }
        } catch (error) {
            console.error('Error fetching gas logs:', error);
            gasTableBody.innerHTML = '<tr><td colspan="4" class="no-data">Veriler yüklenemedi. Sunucu bağlantısını kontrol edin.</td></tr>';
        }
    }

    function renderGasLogs(logs) {
        if (!logs || logs.length === 0) {
            gasTableBody.innerHTML = '<tr><td colspan="4" class="no-data">Henüz hiçbir alarm kaydı bulunmuyor. Her şey yolunda.</td></tr>';
            return;
        }

        gasTableBody.innerHTML = '';
        
        logs.forEach(log => {
            const dateObj = new Date(log.timestamp);
            const dateStr = dateObj.toLocaleDateString('tr-TR');
            const timeStr = dateObj.toLocaleTimeString('tr-TR');

            const tr = document.createElement('tr');
            
            tr.innerHTML = `
                <td>#${log.id}</td>
                <td>${dateStr} - ${timeStr}</td>
                <td><span class="danger-badge">Seviye: ${log.gas_value}</span></td>
                <td><span style="color: #fc8181; font-weight: bold;">⚠️ TEHLİKE</span></td>
            `;
            
            gasTableBody.appendChild(tr);
        });
    }

    // Refresh button event
    if (refreshBtn) {
        refreshBtn.addEventListener('click', fetchGasLogs);
    }

    // Initial fetch
    fetchGasLogs();
    
    // Auto refresh every 5 seconds
    setInterval(fetchGasLogs, 5000);
});
