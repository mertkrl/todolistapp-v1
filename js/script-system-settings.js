// Sistem Ayarları + Veriyi Yedekle/Yükle + Çıkış Yap → script.js'ten taşındı.
document.addEventListener('DOMContentLoaded', () => {

    // ── Sistem Ayarları ──────────────────────────────────────
    const settingsModal = document.getElementById('system-settings-modal');

    function openSystemSettings() {
        closeDropdown();
        if (!settingsModal) return;
        loadSystemSettings();
        settingsModal.classList.remove('hidden');
    }

    document.getElementById('profile-dropdown-settings')?.addEventListener('click', openSystemSettings);
    document.getElementById('close-system-settings-btn')?.addEventListener('click', () => {
        settingsModal?.classList.add('hidden');
    });
    settingsModal?.addEventListener('click', (e) => {
        if (e.target === settingsModal) settingsModal.classList.add('hidden');
    });

    // Ayarları yükle & toggle'ları başlat
    function loadSystemSettings() {
        const cfg = FocusStorage.get('system_settings', {
            theme: 'dark', quickadd: true, ghostmode: true,
            tasksound: true, notif: false, streak: true
        });

        // Hayalet Mod
        const ghostToggle = document.getElementById('ss-toggle-ghostmode');
        if (ghostToggle) {
            ghostToggle.checked = cfg.ghostmode !== false;
            ghostToggle.onchange = () => {
                cfg.ghostmode = ghostToggle.checked;
                FocusStorage.set('ghost_mode_enabled', ghostToggle.checked);
                saveSettings(cfg);
            };
        }

        // Görev Tamamlama Sesi
        const soundToggle = document.getElementById('ss-toggle-tasksound');
        if (soundToggle) {
            soundToggle.checked = cfg.tasksound !== false;
            soundToggle.onchange = () => {
                cfg.tasksound = soundToggle.checked;
                FocusStorage.set('task_sound_enabled', soundToggle.checked);
                saveSettings(cfg);
            };
        }

        // Bildirimler
        const notifToggle = document.getElementById('ss-toggle-notif');
        if (notifToggle) {
            notifToggle.checked = !!cfg.notif;
            notifToggle.onchange = async () => {
                if (notifToggle.checked) {
                    if ('Notification' in window) {
                        const perm = await Notification.requestPermission();
                        notifToggle.checked = perm === 'granted';
                        cfg.notif = perm === 'granted';
                    } else {
                        notifToggle.checked = false;
                        cfg.notif = false;
                    }
                } else {
                    cfg.notif = false;
                }
                saveSettings(cfg);
            };
        }

        // Streak Rozeti
        const streakToggle = document.getElementById('ss-toggle-streak');
        if (streakToggle) {
            streakToggle.checked = cfg.streak !== false;
            streakToggle.onchange = () => {
                cfg.streak = streakToggle.checked;
                const badge = document.getElementById('streak-badge');
                if (badge) badge.style.display = streakToggle.checked ? '' : 'none';
                saveSettings(cfg);
            };
        }
    }

    function saveSettings(cfg) {
        FocusStorage.set('system_settings', cfg);
    }

    // Uygulama başlarken kayıtlı ayarları uygula
    (function applyBootSettings() {
        const cfg = FocusStorage.get('system_settings', {});
        if (cfg.quickadd === false) {
            const btn = document.getElementById('floating-quick-add-btn');
            if (btn) btn.style.display = 'none';
        }
        if (cfg.streak === false) {
            const badge = document.getElementById('streak-badge');
            if (badge) badge.style.display = 'none';
        }
    })();

    // ── Veriyi Yedekle ──────────────────────────────────────
    document.getElementById('ss-export-btn')?.addEventListener('click', () => {
        if (typeof DataManager !== 'undefined') DataManager.exportData();
    });

    // ── Yedek Yükle ─────────────────────────────────────────
    function triggerImport(fileInputId) {
        const fileInput = document.getElementById(fileInputId);
        if (!fileInput) return;
        fileInput.value = '';
        fileInput.click();
        fileInput.onchange = async () => {
            const file = fileInput.files[0];
            if (!file) return;
            try {
                const exportDate = await DataManager.importData(file);
                showPremiumModal({
                    title: 'Yedek Yüklendi ✅',
                    message: `Yedek (${exportDate}) başarıyla yüklendi. Sayfa yenilenecek.`,
                    type: 'success',
                    showCancel: false,
                    onConfirm: () => location.reload()
                });
            } catch(e) {
                showPremiumModal({ title: 'Hata', message: 'Yedek dosyası okunamadı.', type: 'warning' });
            }
        };
    }

    document.getElementById('ss-import-btn')?.addEventListener('click', (e) => {
        if (e.target.tagName === 'INPUT') return;
        triggerImport('ss-import-file');
    });

    // ── Çıkış Yap ───────────────────────────────────────────
    document.getElementById('profile-dropdown-signout')?.addEventListener('click', async () => {
        closeDropdown();
        // GERÇEK BUG DÜZELTMESİ (2026-08-06): test hesabının (devTestLogin,
        // bkz. app-login-gate.js/social-auth-bootstrap.js) gerçek bir
        // Supabase oturumu YOK — FocusAuth.signOut() bu durumda hiçbir
        // 'SIGNED_OUT' etkisi doğurmuyor (çıkacak gerçek oturum zaten yok),
        // bu yüzden bu buton test hesabında TIKLANINCA HİÇBİR ŞEY OLMUYORDU.
        // Ayrıca gerçek hesaplarda bile 'focusai_social_user'/'focusai_friends'
        // localStorage'ı temizlenmiyordu (bkz. social-dc-profile-menu.js'teki
        // aynı buton için zaten var olan doğru davranış). İkisini de burada
        // hizaladık ve sayfayı yeniliyoruz ki kapı garanti görünsün.
        localStorage.removeItem('focusai_dev_test_email');
        localStorage.removeItem('focusai_social_user');
        localStorage.removeItem('focusai_friends');
        if (window.FocusAuth && typeof window.FocusAuth.signOut === 'function') {
            await window.FocusAuth.signOut();
        }
        location.reload();
    });

    // Ghost mode ayarını timer'a bildir
    FocusStorage.set('ghost_mode_enabled',
        FocusStorage.get('system_settings', { ghostmode: true }).ghostmode !== false);

});
