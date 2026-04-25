document.addEventListener('DOMContentLoaded', () => {
    // 1. Oturum Kontrolü
    if (localStorage.getItem('isLoggedIn') !== 'true') {
        window.location.href = 'index.html';
        return;
    }

    const token = localStorage.getItem('token');
    const isAdmin = localStorage.getItem('isAdmin') === 'true';

    // 2. IP Adresi Güncelleme
    document.getElementById('updateIpBtn').addEventListener('click', () => {
        const newIp = document.getElementById('espIp').value;
        const streamImg = document.getElementById('stream');
        
        // Akışı yenile
        streamImg.src = '';
        setTimeout(() => {
            streamImg.src = newIp;
        }, 500);
    });

    // 3. Admin Kayıt Arayüzü Kontrolü
    const recordingPanel = document.getElementById('recordingPanel');
    const recordBtn = document.getElementById('recordBtn');
    const durationInput = document.getElementById('recordDuration');

    if (isAdmin && recordingPanel) {
        recordingPanel.classList.remove('hidden');
    }

    let isRecording = false;

    // 4. Kayıt Başlat/Durdur Mantığı
    if (recordBtn) {
        recordBtn.addEventListener('click', () => {
            const streamUrl = document.getElementById('espIp').value;
            const duration = parseInt(durationInput.value);

            if (isNaN(duration) || duration < 0) {
                alert('Lütfen geçerli bir süre girin.');
                return;
            }

            if (!isRecording) {
                // Kayıt Başlatma İsteği
                recordBtn.disabled = true;
                recordBtn.textContent = 'İşleniyor...';

                fetch('/api/record/start', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ streamUrl, duration })
                })
                .then(res => res.json())
                .then(data => {
                    recordBtn.disabled = false;
                    if (data.success) {
                        isRecording = true;
                        if (duration > 0) {
                            recordBtn.textContent = `Kaydediliyor... (${duration} dk)`;
                            recordBtn.style.backgroundColor = '#f59e0b'; // Turuncu (Süreli kilit)
                            recordBtn.disabled = true; // Süreli ise manuel durdurulamaz (isteye bağlı değiştirilebilir)
                            
                            // Süre bitiminde UI sıfırlansın
                            setTimeout(() => {
                                resetRecordUI();
                            }, duration * 60 * 1000);
                        } else {
                            recordBtn.textContent = 'Kaydı Durdur';
                            recordBtn.style.backgroundColor = '#ef4444'; // Kırmızı
                            recordBtn.style.boxShadow = '0 0 15px rgba(239, 68, 68, 0.8)';
                        }
                    } else {
                        alert('Kayıt başlatılamadı: ' + data.message);
                        resetRecordUI();
                    }
                })
                .catch(err => {
                    console.error('Kayıt hatası:', err);
                    alert('Sunucu ile bağlantı kurulamadı.');
                    resetRecordUI();
                });
            } else {
                // Kayıt Durdurma İsteği (Sadece süresiz kayıtlarda buraya düşer)
                recordBtn.disabled = true;
                recordBtn.textContent = 'Durduruluyor...';

                fetch('/api/record/stop', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                })
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        resetRecordUI();
                        alert('Kayıt başarıyla kaydedildi.');
                    } else {
                        alert('Kayıt durdurulamadı: ' + data.message);
                        recordBtn.disabled = false;
                        recordBtn.textContent = 'Kaydı Durdur';
                    }
                })
                .catch(err => {
                    console.error('Durdurma hatası:', err);
                    resetRecordUI();
                });
            }
        });
    }

    function resetRecordUI() {
        isRecording = false;
        recordBtn.disabled = false;
        recordBtn.textContent = 'Kayıt Başlat';
        recordBtn.style.backgroundColor = '#ef4444';
        recordBtn.style.boxShadow = '0 4px 14px 0 rgba(239, 68, 68, 0.39)';
    }

    // 5. QR Scanner Kontrolü
    const qrScannerPanel = document.getElementById('qrScannerPanel');
    const qrScannerBtn = document.getElementById('qrScannerBtn');
    const qrScannerStatus = document.getElementById('qrScannerStatus');
    let isScannerRunning = false;

    if (isAdmin && qrScannerPanel) {
        qrScannerPanel.classList.remove('hidden');
        
        // Status Check
        fetch('/api/admin/scanner/status', {
            headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(res => res.json())
        .then(data => {
            if (data.success && data.activeIps.length > 0) {
                isScannerRunning = true;
                updateScannerUI(true);
            }
        }).catch(err => console.log('Scanner status check failed.'));

        qrScannerBtn.addEventListener('click', () => {
            const streamUrl = document.getElementById('espIp').value;
            let cameraIp = '';
            try {
                const urlObj = new URL(streamUrl);
                cameraIp = urlObj.hostname;
            } catch(e) {
                alert('Geçersiz IP adresi formatı.');
                return;
            }

            const endpoint = isScannerRunning ? '/api/admin/scanner/stop' : '/api/admin/scanner/start';
            qrScannerBtn.disabled = true;

            fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ cameraIp })
            })
            .then(res => res.json())
            .then(data => {
                qrScannerBtn.disabled = false;
                if (data.success) {
                    isScannerRunning = !isScannerRunning;
                    updateScannerUI(isScannerRunning);
                } else {
                    alert(data.message);
                }
            })
            .catch(err => {
                qrScannerBtn.disabled = false;
                alert('İşlem başarısız oldu.');
            });
        });
    }

    function updateScannerUI(isRunning) {
        if (isRunning) {
            qrScannerBtn.textContent = 'Tarayıcıyı Durdur';
            qrScannerBtn.style.backgroundColor = '#e53e3e';
            qrScannerStatus.textContent = 'Aktif (Tarama Yapılıyor)';
            qrScannerStatus.style.color = '#48bb78';
        } else {
            qrScannerBtn.textContent = 'Tarayıcıyı Başlat';
            qrScannerBtn.style.backgroundColor = '#3182ce';
            qrScannerStatus.textContent = 'Kapalı';
            qrScannerStatus.style.color = '#a0aec0';
        }
    }
});
