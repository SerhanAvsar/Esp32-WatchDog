document.addEventListener('DOMContentLoaded', () => {
    // Check Authentication and Admin Status
    const token = localStorage.getItem('token');
    const isAdmin = localStorage.getItem('isAdmin');
    
    if (!token || isAdmin !== 'true') {
        alert('Bu sayfaya erişim yetkiniz yok!');
        window.location.href = 'dashboard.html';
        return;
    }

    const table = document.getElementById('usersTable');
    const tbody = document.getElementById('usersList');
    const loading = document.getElementById('loadingIndicator');
    
    // Modal Elements
    const modal = document.getElementById('userModal');
    const closeBtn = document.getElementById('closeModal');
    const addBtn = document.getElementById('addUserBtn');
    const form = document.getElementById('userForm');
    
    // Helper function for Auth fetches
    async function fetchWithAuth(url, options = {}) {
        options.headers = {
            ...options.headers,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
        const res = await fetch(url, options);
        if (res.status === 401 || res.status === 403) {
            localStorage.clear();
            alert('Oturum süreniz doldu veya yetkiniz reddedildi.');
            window.location.href = 'index.html';
            throw new Error('Yetkisiz erişim');
        }
        return res.json();
    }

    // Load Users
    async function loadUsers() {
        loading.classList.remove('hidden');
        table.classList.add('hidden');
        tbody.innerHTML = '';
        
        try {
            const data = await fetchWithAuth('/api/admin/users');
            if (data.success) {
                data.users.forEach(u => {
                    const tr = document.createElement('tr');
                    const roleBadge = u.is_admin === 1 ? '<span class="badge-admin">Admin</span>' : '<span class="badge-user">Standart</span>';
                    tr.innerHTML = `
                        <td>#${u.id}</td>
                        <td>${u.username}</td>
                        <td>${roleBadge}</td>
                        <td class="action-btns">
                            <button class="btn secondary-btn small-btn qr-btn" data-id="${u.id}" data-token="${u.qr_token}" data-username="${u.username}" style="background: rgba(49, 130, 206, 0.2); color: #63b3ed; border-color: rgba(49, 130, 206, 0.5);">QR Göster</button>
                            <button class="btn secondary-btn small-btn edit-btn" data-id="${u.id}" data-username="${u.username}" data-admin="${u.is_admin}">Düzenle</button>
                            <button class="btn small-btn delete-btn" data-id="${u.id}" style="background: rgba(229, 62, 62, 0.2); color: #fc8181; border-color: rgba(229, 62, 62, 0.5);">Sil</button>
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
                
                // Attach Event Listeners
                document.querySelectorAll('.qr-btn').forEach(btn => btn.addEventListener('click', showQrModal));
                document.querySelectorAll('.edit-btn').forEach(btn => btn.addEventListener('click', openEditModal));
                document.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', deleteUser));
                
                loading.classList.add('hidden');
                table.classList.remove('hidden');
            }
        } catch (err) {
            console.error(err);
        }
    }

    // --- Modal Logic ---
    const qrModal = document.getElementById('qrModal');
    const closeQrBtn = document.getElementById('closeQrModal');

    closeQrBtn.addEventListener('click', () => qrModal.style.display = 'none');
    
    let currentQrUserId = null;
    let currentQrUsername = null;

    function showQrModal(e) {
        const token = e.target.dataset.token;
        const username = e.target.dataset.username;
        const id = e.target.dataset.id;
        
        currentQrUserId = id;
        currentQrUsername = username;

        document.getElementById('qrModalTitle').textContent = username + " - QR";
        
        const qrcodeBox = document.getElementById('qrcodeBox');
        qrcodeBox.innerHTML = ""; // Önceki QR'ı temizle
        
        if (token && token !== "null") {
            new QRCode(qrcodeBox, {
                text: token,
                width: 150,
                height: 150,
                colorDark : "#000000",
                colorLight : "#ffffff",
                correctLevel : QRCode.CorrectLevel.H
            });
        } else {
            qrcodeBox.innerHTML = "<span style='color:black;'>Token bulunamadı.</span>";
        }
        
        qrModal.style.display = 'flex';
    }

    const resetQrBtn = document.getElementById('resetQrBtn');
    if (resetQrBtn) {
        resetQrBtn.addEventListener('click', async () => {
            if (!currentQrUserId) return;
            if (!confirm(`DİKKAT: ${currentQrUsername} adlı kullanıcının mevcut QR kodu geçersiz olacak ve yeni bir QR kod üretilecektir. Onaylıyor musunuz?`)) return;

            resetQrBtn.disabled = true;
            resetQrBtn.textContent = 'Yenileniyor...';

            try {
                const data = await fetchWithAuth(`/api/admin/users/${currentQrUserId}/reset-qr`, { method: 'POST' });
                if (data.success) {
                    // Refresh Modal QR
                    const qrcodeBox = document.getElementById('qrcodeBox');
                    qrcodeBox.innerHTML = "";
                    new QRCode(qrcodeBox, {
                        text: data.qr_token,
                        width: 150,
                        height: 150,
                        colorDark : "#000000",
                        colorLight : "#ffffff",
                        correctLevel : QRCode.CorrectLevel.H
                    });
                    
                    // Refresh Table in Background
                    loadUsers();
                    alert('QR Kod başarıyla yenilendi. Diğer yöneticilere bildirim gönderildi.');
                } else {
                    alert(data.message);
                }
            } catch (err) {
                alert('Yenileme başarısız oldu.');
            } finally {
                resetQrBtn.disabled = false;
                resetQrBtn.textContent = '🔄 Bu QR Kodu Yenile';
            }
        });
    }

    addBtn.addEventListener('click', () => {
        document.getElementById('modalTitle').textContent = 'Yeni Kullanıcı Ekle';
        document.getElementById('passwordHint').style.display = 'none';
        form.reset();
        document.getElementById('userId').value = '';
        document.getElementById('mPassword').required = true;
        document.getElementById('modalError').textContent = '';
        modal.style.display = 'flex';
    });

    closeBtn.addEventListener('click', () => modal.style.display = 'none');
    window.addEventListener('click', (e) => { 
        if (e.target === modal) modal.style.display = 'none'; 
        if (e.target === qrModal) qrModal.style.display = 'none';
    });

    function openEditModal(e) {
        const id = e.target.dataset.id;
        const username = e.target.dataset.username;
        const isAdmin = e.target.dataset.admin;

        document.getElementById('modalTitle').textContent = 'Kullanıcı Düzenle';
        document.getElementById('passwordHint').style.display = 'inline';
        document.getElementById('userId').value = id;
        document.getElementById('mUsername').value = username;
        document.getElementById('mPassword').value = '';
        document.getElementById('mPassword').required = false; // Parola değişmeyebilir
        document.getElementById('mRole').value = isAdmin;
        document.getElementById('modalError').textContent = '';
        
        modal.style.display = 'flex';
    }

    // Handle Submit (Create or Update)
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('userId').value;
        const username = document.getElementById('mUsername').value;
        const password = document.getElementById('mPassword').value;
        const is_admin = document.getElementById('mRole').value === '1';

        const payload = { username, is_admin };
        if (password) payload.password = password;

        try {
            const isUpdate = id !== '';
            const url = isUpdate ? `/api/admin/users/${id}` : '/api/admin/users';
            const method = isUpdate ? 'PUT' : 'POST';

            const data = await fetchWithAuth(url, {
                method,
                body: JSON.stringify(payload)
            });

            if (data.success) {
                modal.style.display = 'none';
                loadUsers();
            } else {
                document.getElementById('modalError').textContent = data.message;
            }
        } catch (err) {
            document.getElementById('modalError').textContent = 'Bir hata oluştu.';
        }
    });

    // Handle Delete
    async function deleteUser(e) {
        const id = e.target.dataset.id;
        if (confirm('Bu kullanıcıyı silmek istediğinize emin misiniz?')) {
            try {
                const data = await fetchWithAuth(`/api/admin/users/${id}`, { method: 'DELETE' });
                if (data.success) {
                    loadUsers();
                } else {
                    alert(data.message);
                }
            } catch (err) {
                alert('Silme işlemi başarısız.');
            }
        }
    }

    // Init
    loadUsers();
});
