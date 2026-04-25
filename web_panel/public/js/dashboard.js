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
                        width: 150,
                        height: 150,
                        colorDark : "#000000",
                        colorLight : "#ffffff",
                        correctLevel : QRCode.CorrectLevel.H
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

});
