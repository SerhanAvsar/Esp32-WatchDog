document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    
    // Otomatik giriş iptal edildi. Kullanıcı her seferinde giriş yapmak zorundadır.

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const usernameInput = document.getElementById('username');
            const passwordInput = document.getElementById('password');
            const errorMsg = document.getElementById('errorMessage');
            const loginBtn = document.getElementById('loginBtn');
            const btnText = loginBtn.querySelector('.btn-text');
            const spinner = loginBtn.querySelector('.spinner');

            // Reset UI
            errorMsg.textContent = '';
            btnText.classList.add('hidden');
            spinner.classList.remove('hidden');
            loginBtn.disabled = true;

            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: usernameInput.value,
                        password: passwordInput.value
                    })
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    // Save login state
                    localStorage.setItem('isLoggedIn', 'true');
                    localStorage.setItem('username', data.user.username);
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('isAdmin', data.user.is_admin === 1 ? 'true' : 'false');
                    
                    // Add success effect before redirecting
                    loginBtn.style.background = 'var(--success-color)';
                    spinner.classList.add('hidden');
                    btnText.classList.remove('hidden');
                    btnText.textContent = 'Başarılı!';
                    
                    setTimeout(() => {
                        window.location.href = 'dashboard.html';
                    }, 500);
                } else {
                    throw new Error(data.message || 'Giriş başarısız.');
                }
            } catch (error) {
                // Restore UI
                btnText.classList.remove('hidden');
                spinner.classList.add('hidden');
                loginBtn.disabled = false;
                
                // Show Error
                errorMsg.textContent = error.message;
                
                // Shake effect on form
                loginForm.style.transform = 'translateX(-10px)';
                setTimeout(() => loginForm.style.transform = 'translateX(10px)', 100);
                setTimeout(() => loginForm.style.transform = 'translateX(-10px)', 200);
                setTimeout(() => loginForm.style.transform = 'translateX(0)', 300);
            }
        });
    }
});
