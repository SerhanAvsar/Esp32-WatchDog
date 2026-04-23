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

    // Show Admin Card if user is Admin
    const isAdmin = localStorage.getItem('isAdmin');
    const adminCard = document.getElementById('adminCard');
    if (isAdmin === 'true' && adminCard) {
        adminCard.style.display = 'flex';
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

    // Handle Video Recordings Card click for Standard Users
    const videoCard = document.querySelector('.video-icon').parentElement;
    if (videoCard) {
        videoCard.addEventListener('click', (e) => {
            e.preventDefault();
            if (isAdmin !== 'true') {
                alert('Yetkisiz Giriş: Standart kullanıcıların video kayıtlarına erişim izni yoktur.');
            } else {
                alert('Video kayıtları modülü henüz yapım aşamasındadır.');
            }
        });
    }
});
