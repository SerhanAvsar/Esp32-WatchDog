document.addEventListener('DOMContentLoaded', () => {
    // Check if user is legally logged in
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    const username = localStorage.getItem('username');

    if (isLoggedIn !== 'true') {
        // Not logged in -> kick to index
        window.location.href = 'index.html';
        return;
    }

    // Greet user
    const userGreeting = document.getElementById('userGreeting');
    if (userGreeting && username) {
        userGreeting.textContent = `Merhaba, ${username}`;
    }

    // Show Admin & Records Card if user is Admin
    const isAdmin = localStorage.getItem('isAdmin');
    const adminCard = document.getElementById('adminCard');
    const recordsCard = document.getElementById('recordsCard');
    
    if (isAdmin === 'true') {
        if (adminCard) adminCard.style.display = 'flex';
        if (recordsCard) recordsCard.style.display = 'flex';
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

    // Handle My QR
    const myQrBtn = document.getElementById('myQrBtn');
    const myQrModal = document.getElementById('myQrModal');
    const closeMyQrModal = document.getElementById('closeMyQrModal');
    
    if (myQrBtn && myQrModal) {
        closeMyQrModal.addEventListener('click', () => myQrModal.style.display = 'none');
        window.addEventListener('click', (e) => { 
            if (e.target === myQrModal) myQrModal.style.display = 'none'; 
        });

        myQrBtn.addEventListener('click', async () => {
            const token = localStorage.getItem('token');
            try {
                const res = await fetch('/api/user/qr', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                
                if (data.success && data.qr_token) {
                    const qrcodeBox = document.getElementById('myQrcodeBox');
                    qrcodeBox.innerHTML = "";
                    new QRCode(qrcodeBox, {
                        text: data.qr_token,
                        width: 250,
                        height: 250,
                        colorDark : "#000000",
                        colorLight : "#ffffff",
                        correctLevel : QRCode.CorrectLevel.M
                    });
                    myQrModal.style.display = 'flex';
                } else {
                    alert('QR Kodunuz bulunamadı. Lütfen yöneticinizle iletişime geçin.');
                }
            } catch (err) {
                alert('QR Kodu alınırken hata oluştu.');
            }
        });
    }

    // Handle Settings
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsModal = document.getElementById('settingsModal');
    const closeSettingsModal = document.getElementById('closeSettingsModal');
    const settingsForm = document.getElementById('settingsForm');

    if (settingsBtn && settingsModal) {
        // Only show Admin setting if user is admin
        if (isAdmin !== 'true') {
            const adminSet = document.getElementById('adminNotificationSetting');
            if (adminSet) adminSet.style.display = 'none';
        }

        closeSettingsModal.addEventListener('click', () => settingsModal.style.display = 'none');
        window.addEventListener('click', (e) => { 
            if (e.target === settingsModal) settingsModal.style.display = 'none'; 
        });

        settingsBtn.addEventListener('click', async () => {
            const token = localStorage.getItem('token');
            try {
                const res = await fetch('/api/user/settings', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                
                if (data.success && data.settings) {
                    document.getElementById('emailInput').value = data.settings.email_address || '';
                    document.getElementById('notifyMotionCheck').checked = data.settings.notify_motion_sensor === 1;
                    document.getElementById('notifyAdminCheck').checked = data.settings.notify_admin_change === 1;
                    settingsModal.style.display = 'flex';
                } else {
                    alert('Ayarlar yüklenemedi.');
                }
            } catch (err) {
                alert('Ayarlar alınırken hata oluştu.');
            }
        });

        settingsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const token = localStorage.getItem('token');
            
            const payload = {
                email_address: document.getElementById('emailInput').value,
                notify_motion_sensor: document.getElementById('notifyMotionCheck').checked,
                notify_admin_change: document.getElementById('notifyAdminCheck').checked
            };

            try {
                const res = await fetch('/api/user/settings', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (data.success) {
                    alert('Ayarlarınız başarıyla kaydedildi!');
                    settingsModal.style.display = 'none';
                } else {
                    alert(data.message || 'Kayıt başarısız.');
                }
            } catch (err) {
                alert('Kayıt sırasında hata oluştu.');
            }
        });
    }

});
