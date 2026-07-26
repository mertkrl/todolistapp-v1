// ── PROFİL DÜZENLE → script.js'ten taşındı ──────────────────────────────
import { escapeHtml } from './storage-manager.js';

document.addEventListener('DOMContentLoaded', () => {

    const profileEditModal = document.getElementById('profile-edit-modal');
    let _peAvatarColor = 'linear-gradient(135deg,#D4900E,#c97c18)';
    let _peAvatarUrl   = null;

    function openProfileEdit() {
        closeDropdown();
        if (!profileEditModal) return;
        profileEditModal.classList.remove('hidden');
        loadProfileData();
    }

    document.getElementById('profile-dropdown-edit')?.addEventListener('click', openProfileEdit);
    document.getElementById('close-profile-edit-btn')?.addEventListener('click', () => profileEditModal?.classList.add('hidden'));
    profileEditModal?.addEventListener('click', e => { if (e.target === profileEditModal) profileEditModal.classList.add('hidden'); });

    async function loadProfileData() {
        const peStatus = document.getElementById('pe-status');
        if (peStatus) { peStatus.textContent = ''; peStatus.style.color = ''; }

        try {
            const session = window.FocusAuth ? await window.FocusAuth.getSession() : null;
            const user = session?.user;

            // E-postayı doldur
            const emailEl = document.getElementById('pe-email');
            if (emailEl && user?.email) emailEl.value = user.email;

            // Profil verilerini çek
            let profile = null;
            if (user && window.FocusAuth?.getProfile) {
                profile = await window.FocusAuth.getProfile(user.id);
            }

            const displayNameEl = document.getElementById('pe-display-name');
            const usernameEl    = document.getElementById('pe-username');
            const avatarPreview = document.getElementById('pe-avatar-preview');
            const pdmAvatar     = document.getElementById('pdm-avatar-initials');

            if (profile) {
                if (displayNameEl) displayNameEl.value = profile.display_name || '';
                if (usernameEl)    usernameEl.value    = profile.username    || '';
                if (profile.avatar_color) {
                    _peAvatarColor = profile.avatar_color;
                    if (avatarPreview) avatarPreview.style.background = profile.avatar_color;
                }
                if (profile.avatar_url) {
                    _peAvatarUrl = profile.avatar_url;
                    if (avatarPreview) avatarPreview.innerHTML = `<img src="${escapeHtml(profile.avatar_url)}" alt="avatar">`;
                } else {
                    const initials = (profile.display_name || profile.username || user?.email || 'U')
                        .split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2);
                    if (avatarPreview) avatarPreview.textContent = initials;
                }
            } else if (user) {
                const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'U';
                if (displayNameEl) displayNameEl.value = name;
                const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2);
                if (avatarPreview) { avatarPreview.textContent = initials; avatarPreview.style.background = _peAvatarColor; }
            }

            // Renk seçici aktif rengi işaretle
            document.querySelectorAll('.pe-color-btn').forEach(btn => {
                btn.classList.toggle('selected', btn.dataset.color === _peAvatarColor);
            });

        } catch(e) {
            if (peStatus) { peStatus.textContent = 'Profil yüklenemedi.'; peStatus.style.color = '#ff4757'; }
        }
    }

    // Renk seçimi
    document.querySelectorAll('.pe-color-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            _peAvatarColor  = btn.dataset.color;
            _peAvatarUrl    = null;
            document.querySelectorAll('.pe-color-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            const prev = document.getElementById('pe-avatar-preview');
            if (prev) { prev.style.background = _peAvatarColor; prev.innerHTML = prev.textContent || 'U'; }
        });
    });

    // Kullanıcı adı validasyon
    document.getElementById('pe-username')?.addEventListener('input', function() {
        this.value = this.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
        const hint = document.getElementById('pe-username-hint');
        if (hint) {
            if (this.value.length > 0 && this.value.length < 3) {
                hint.textContent = 'En az 3 karakter olmalı.';
                hint.style.color = '#ff4757';
            } else {
                hint.textContent = 'Harf, rakam ve alt çizgi kullanabilirsin.';
                hint.style.color = '';
            }
        }
    });

    // Şifre göster/gizle
    document.getElementById('pe-pw-toggle')?.addEventListener('click', () => {
        const inp = document.getElementById('pe-password');
        const icon = document.querySelector('#pe-pw-toggle i');
        if (!inp) return;
        const isText = inp.type === 'text';
        inp.type = isText ? 'password' : 'text';
        if (icon) icon.className = isText ? 'fa-solid fa-eye' : 'fa-solid fa-eye-slash';
    });

    // Avatar fotoğraf yükleme
    document.getElementById('pe-avatar-photo-btn')?.addEventListener('click', () => {
        document.getElementById('pe-avatar-file')?.click();
    });
    document.getElementById('pe-avatar-file')?.addEventListener('change', function() {
        const file = this.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = e => {
            const prev = document.getElementById('pe-avatar-preview');
            if (prev) prev.innerHTML = `<img src="${escapeHtml(e.target.result)}" alt="avatar">`;
            _peAvatarUrl = 'pending'; // Kaydet sırasında yüklenecek
        };
        reader.readAsDataURL(file);
    });

    // Kaydet
    document.getElementById('pe-save-btn')?.addEventListener('click', async () => {
        const saveBtn  = document.getElementById('pe-save-btn');
        const peStatus = document.getElementById('pe-status');
        const displayName = document.getElementById('pe-display-name')?.value.trim();
        const username    = document.getElementById('pe-username')?.value.trim();
        const email       = document.getElementById('pe-email')?.value.trim();
        const password    = document.getElementById('pe-password')?.value;
        const passwordCnf = document.getElementById('pe-password-confirm')?.value;

        if (peStatus) { peStatus.textContent = ''; peStatus.style.color = ''; }

        // Validasyonlar
        if (!displayName) {
            if (peStatus) { peStatus.textContent = 'Görünen ad boş olamaz.'; peStatus.style.color = '#ff4757'; }
            return;
        }
        if (username && username.length < 3) {
            if (peStatus) { peStatus.textContent = 'Kullanıcı adı en az 3 karakter olmalı.'; peStatus.style.color = '#ff4757'; }
            return;
        }
        if (password && password.length < 6) {
            if (peStatus) { peStatus.textContent = 'Şifre en az 6 karakter olmalı.'; peStatus.style.color = '#ff4757'; }
            return;
        }
        if (password && password !== passwordCnf) {
            if (peStatus) { peStatus.textContent = 'Şifreler eşleşmiyor.'; peStatus.style.color = '#ff4757'; }
            return;
        }

        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Kaydediliyor...';

        try {
            const session = window.FocusAuth ? await window.FocusAuth.getSession() : null;
            const user    = session?.user;
            if (!user) throw new Error('Oturum açık değil.');

            // 1. Avatar fotoğraf yükle (eğer yeni dosya seçildiyse)
            const avatarFileEl = document.getElementById('pe-avatar-file');
            const avatarFile   = avatarFileEl?.files?.[0];
            let finalAvatarUrl = _peAvatarUrl === 'pending' ? null : (_peAvatarUrl || null);
            if (avatarFile && window.FocusAuth?.uploadAvatar) {
                try {
                    finalAvatarUrl = await window.FocusAuth.uploadAvatar(user.id, avatarFile);
                } catch(uploadErr) {
                    console.warn('[Profile] Avatar yükleme başarısız, renk kullanılacak:', uploadErr.message);
                    finalAvatarUrl = null;
                }
            }

            // 2. Profiles tablosunu güncelle
            // _peAvatarColor renk seçicideki "linear-gradient(135deg,#6c5ce7,#a29bfe)" gibi bir
            // CSS gradient string'i olabilir — sohbet tarafında avatar_color düz hex bekleniyor,
            // gradient ham haliyle kaydedilirse ui-avatars.com'daki avatar görseli siyaha düşüyor.
            // Gradient içindeki ilk hex rengi çıkarıp onu kaydediyoruz.
            const hexMatch = (_peAvatarColor || '').match(/#[0-9a-fA-F]{3,8}/);
            const cleanAvatarColor = hexMatch ? hexMatch[0].slice(1) : (_peAvatarColor || '6c5ce7');
            const profileFields = {
                display_name: displayName,
                ...(username && { username }),
                avatar_color: cleanAvatarColor,
                ...(finalAvatarUrl && { avatar_url: finalAvatarUrl }),
            };
            if (window.FocusAuth?.updateProfile) {
                await window.FocusAuth.updateProfile(user.id, profileFields);
            }

            // 3. Auth email güncelle (farklıysa)
            const authUpdates = {};
            if (email && email !== user.email) authUpdates.email = email;
            if (password) authUpdates.password = password;
            if (Object.keys(authUpdates).length > 0 && window.FocusAuth?.updateAuthUser) {
                await window.FocusAuth.updateAuthUser(authUpdates);
            }

            // 4. UI'ı güncelle
            const nameEl    = document.getElementById('pdm-user-name');
            const emailEl   = document.getElementById('pdm-user-email');
            const avEl      = document.getElementById('pdm-avatar-initials');
            const topAvEl   = document.getElementById('v2-user-avatar');
            const initials  = displayName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2);

            if (nameEl)  nameEl.textContent  = displayName;
            if (emailEl && email) emailEl.textContent = email;
            if (avEl)  { avEl.textContent = initials; avEl.style.background = _peAvatarColor; }
            if (topAvEl) { topAvEl.textContent = initials; topAvEl.style.background = _peAvatarColor; }
            if (finalAvatarUrl && avEl) avEl.innerHTML = `<img src="${escapeHtml(finalAvatarUrl)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" alt="av">`;

            if (peStatus) { peStatus.textContent = '✓ Profil başarıyla güncellendi.'; peStatus.style.color = '#2ed573'; }
            document.getElementById('pe-password').value        = '';
            document.getElementById('pe-password-confirm').value = '';
            if (avatarFileEl) avatarFileEl.value = '';

            if (email && email !== user.email) {
                if (peStatus) peStatus.textContent += ' E-posta doğrulama linki gönderildi.';
            }

        } catch(e) {
            if (peStatus) { peStatus.textContent = 'Hata: ' + (e.message || 'Kaydedilemedi.'); peStatus.style.color = '#ff4757'; }
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Kaydet';
        }
    });

});
