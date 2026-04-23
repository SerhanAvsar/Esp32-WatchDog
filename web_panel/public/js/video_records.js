document.addEventListener('DOMContentLoaded', () => {
    // Check session
    if (localStorage.getItem('isLoggedIn') !== 'true') {
        window.location.href = 'index.html';
        return;
    }

    const token = localStorage.getItem('token');
    const isAdmin = localStorage.getItem('isAdmin') === 'true';

    // Sadece adminler girebilir
    if (!isAdmin) {
        alert("Bu sayfaya erişim yetkiniz yok!");
        window.location.href = 'dashboard.html';
        return;
    }

    const username = localStorage.getItem('username');
    const userGreeting = document.getElementById('userGreeting');
    if (userGreeting && username) {
        userGreeting.textContent = `Merhaba, ${username}`;
    }

    // Handle Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('isLoggedIn');
            localStorage.removeItem('username');
            localStorage.removeItem('token');
            localStorage.removeItem('isAdmin');
            window.location.href = 'index.html';
        });
    }

    // Fetch Records
    fetchRecords();

    function fetchRecords() {
        fetch('/api/records', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
        .then(res => {
            if (res.status === 401 || res.status === 403) {
                window.location.href = 'dashboard.html';
                throw new Error('Yetkisiz erişim');
            }
            return res.json();
        })
        .then(data => {
            const tbody = document.getElementById('recordsTableBody');
            if (data.success) {
                if (data.records.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="4" class="no-data">Henüz kaydedilmiş bir video bulunmamaktadır.</td></tr>';
                    return;
                }

                tbody.innerHTML = data.records.map(record => {
                    const date = new Date(record.time).toLocaleString('tr-TR');
                    // URL format for downloading
                    const fileUrl = `/video_kayit/${record.name}`;
                    return `
                        <tr>
                            <td style="font-family: monospace; color: #e2e8f0;">${record.name}</td>
                            <td><span class="danger-badge" style="background: rgba(49, 130, 206, 0.2); color: #63b3ed; border-color: rgba(49, 130, 206, 0.5);">${record.size}</span></td>
                            <td>${date}</td>
                            <td>
                                <a href="${fileUrl}" target="_blank" download class="download-btn">İndir / Oynat</a>
                            </td>
                        </tr>
                    `;
                }).join('');
            } else {
                tbody.innerHTML = `<tr><td colspan="4" class="no-data" style="color:#ef4444">${data.message}</td></tr>`;
            }
        })
        .catch(err => {
            console.error('Error fetching records:', err);
            document.getElementById('recordsTableBody').innerHTML = 
                '<tr><td colspan="4" class="no-data" style="color:#ef4444">Sunucu ile bağlantı kurulamadı.</td></tr>';
        });
    }
});
