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
                                <button class="download-btn play-btn" data-filename="${record.name}" style="margin-right: 5px; cursor: pointer;">▶ İzle</button>
                                <a href="${fileUrl}" target="_blank" download class="download-btn">İndir</a>
                            </td>
                        </tr>
                    `;
                }).join('');

                // --- ADVANCED MJPEG PLAYER LOGIC ---
                const modal = document.getElementById('videoModal');
                const playerImg = document.getElementById('playerImg');
                const playerLoading = document.getElementById('playerLoading');
                const videoControls = document.getElementById('videoControls');
                const playPauseBtn = document.getElementById('playPauseBtn');
                const speedSelect = document.getElementById('speedSelect');
                const closeModalBtn = document.getElementById('closeModalBtn');
                const modalTitle = document.getElementById('modalTitle');

                let videoFrames = [];
                let currentFrameIdx = 0;
                let isPlaying = false;
                let playbackSpeed = 1.0;
                let playInterval = null;
                const baseFps = 15;
                let currentObjectURL = null;

                // Dinamik Hız Değişimi
                speedSelect.addEventListener('change', (e) => {
                    playbackSpeed = parseFloat(e.target.value);
                    if (isPlaying) {
                        pauseVideo();
                        playVideo();
                    }
                });

                // Oynat / Duraklat Butonu
                playPauseBtn.addEventListener('click', () => {
                    if (isPlaying) pauseVideo();
                    else playVideo();
                });

                function updateBtnState() {
                    playPauseBtn.textContent = isPlaying ? '⏸' : '▶';
                }

                function playVideo() {
                    if (isPlaying) return;
                    if (currentFrameIdx >= videoFrames.length - 1) {
                        currentFrameIdx = 0;
                    }
                    isPlaying = true;
                    updateBtnState();
                    
                    const intervalMs = (1000 / baseFps) / playbackSpeed;
                    
                    playInterval = setInterval(() => {
                        currentFrameIdx++;
                        renderFrame();
                    }, intervalMs);
                }

                function pauseVideo() {
                    if (!isPlaying) return;
                    isPlaying = false;
                    updateBtnState();
                    clearInterval(playInterval);
                }

                function renderFrame() {
                    if (videoFrames.length === 0) return;
                    if (currentFrameIdx >= videoFrames.length) {
                        pauseVideo();
                        return;
                    }
                    
                    const blob = videoFrames[currentFrameIdx];
                    const newUrl = URL.createObjectURL(blob);
                    
                    playerImg.src = newUrl;
                    
                    if (currentObjectURL) {
                        URL.revokeObjectURL(currentObjectURL);
                    }
                    currentObjectURL = newUrl;
                }

                async function loadAndPlay(filename) {
                    modalTitle.textContent = `▶ ${filename}`;
                    playerImg.style.display = 'none';
                    playerLoading.style.display = 'block';
                    videoControls.style.display = 'none';
                    modal.classList.remove('hidden');

                    try {
                        const response = await fetch(`/video_kayit/${filename}`);
                        const buffer = await response.arrayBuffer();
                        const bytes = new Uint8Array(buffer);
                        
                        videoFrames = [];
                        let start = -1;
                        
                        // JPEG SOI (FF D8) ve EOI (FF D9) markerlarını bul
                        for (let i = 0; i < bytes.length - 1; i++) {
                            if (bytes[i] === 0xFF && bytes[i+1] === 0xD8) {
                                start = i;
                            } else if (bytes[i] === 0xFF && bytes[i+1] === 0xD9 && start !== -1) {
                                videoFrames.push(new Blob([bytes.subarray(start, i + 2)], { type: 'image/jpeg' }));
                                start = -1;
                            }
                        }

                        if (videoFrames.length > 0) {
                            playerLoading.style.display = 'none';
                            playerImg.style.display = 'block';
                            videoControls.style.display = 'flex';
                            currentFrameIdx = 0;
                            speedSelect.value = "1.0";
                            playbackSpeed = 1.0;
                            playVideo();
                        } else {
                            playerLoading.textContent = 'Video kareleri okunamadı!';
                        }
                    } catch (err) {
                        console.error(err);
                        playerLoading.textContent = 'Video yüklenirken hata oluştu.';
                    }
                }

                // Buton Event Listeners
                document.querySelectorAll('.play-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const filename = e.target.getAttribute('data-filename');
                        loadAndPlay(filename);
                    });
                });

                closeModalBtn.addEventListener('click', () => {
                    pauseVideo();
                    modal.classList.add('hidden');
                    playerImg.src = ''; 
                    if (currentObjectURL) {
                        URL.revokeObjectURL(currentObjectURL);
                        currentObjectURL = null;
                    }
                    videoFrames = []; // Belleği temizle
                });
                
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
