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

    // Handle Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('isLoggedIn');
            localStorage.removeItem('username');
            window.location.href = 'index.html';
        });
    }
});
