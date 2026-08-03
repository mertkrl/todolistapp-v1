import { getCurrentUser } from './state/current-user-store.js';
import { avatarUploadEnabled } from './social-chat-gate.js';
import { openAuthModal } from './auth-ui.js';
import { updateProfileHeader } from './social-profile-header.js';
import { openSetupModalAsEdit, resetSetupModalToRegister } from './social-setup-modal-edit.js';
import { ensureCommunityAccess, openCommunitySetupModal, startAllSocialListeners, saveUser, registerUser, syncXP } from './social.js';

export function _setupProfileModalListeners() {

    // Renk seçici
    document.querySelectorAll('.social-color-opt').forEach(opt => {
        opt.addEventListener('click', () => {
            document.querySelectorAll('.social-color-opt').forEach(o => {
                o.style.border = 'none'; o.style.transform = 'scale(1)';
                o.classList.remove('selected');
            });
            opt.style.border = '3px solid #fff';
            opt.style.transform = 'scale(1.1)';
            opt.classList.add('selected');

            // Önizleme çerçevesini güncelle (sadece özel fotoğraf yoksa)
            const ring = document.getElementById('avatar-color-preview-ring');
            const hasCustom = getCurrentUser() && getCurrentUser().customAvatar;
            if (ring) {
                ring.style.borderColor = '#' + opt.dataset.color;
                if (!hasCustom) {
                    // Renk değişince ui-avatars önizlemesini de güncelle
                    const dn = document.getElementById('social-setup-displayname')?.value || (getCurrentUser()?.displayName || 'U');
                    ring.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(dn)}&background=${opt.dataset.color}&color=fff`;
                    ring.style.display = 'block';
                }
            }
        });
    });

    // Arkadaşlar sekmesine tıklanınca (henüz kullanıcı yoksa giriş/kurulum modalı aç)
    document.querySelectorAll('[data-target="arkadaslar"]').forEach(el => {
        el.addEventListener('click', () => {
            if (!getCurrentUser()) {
                setTimeout(() => { ensureCommunityAccess(); }, 350);
            }
        });
    });

    // Topluluk profili henüz tamamlanmamış (oturum var ama username boş) —
    // initSocial/loadCommunityProfile tarafından tetiklenir.
    window.addEventListener('focusai:needs-community-profile', (e) => {
        openCommunitySetupModal((e.detail) || {});
    });

    // Profil düzenle butonu — edit modu
    document.getElementById('social-change-profile-btn')?.addEventListener('click', () => {
        openSetupModalAsEdit();
    });

    // Setup modal kapat butonu
    document.getElementById('social-setup-close-btn')?.addEventListener('click', () => {
        document.getElementById('social-setup-modal')?.classList.add('hidden');
        if (!getCurrentUser()) return; // kayıt modundaysa sadece kapat
        resetSetupModalToRegister();
    });

    // Avatar fotoğraf seçimi — DB'ye ham base64 yazmak yerine (egress/boyut
    // maliyeti, bkz. 121_avatar_storage_bucket.sql) önizlemeden önce görsel
    // küçültülür; asıl Storage yüklemesi kaydet butonunda yapılır.
    let _pendingAvatarBlob = null;
    document.getElementById('setup-avatar-file-input')?.addEventListener('change', async function() {
        const file = this.files[0];
        if (!file) return;
        try {
            _pendingAvatarBlob = await window._resizeImageToBlob(file);
            const preview = document.getElementById('setup-avatar-preview');
            if (preview) preview.src = URL.createObjectURL(_pendingAvatarBlob);
        } catch (err) {
            console.error('[FocusAI Social] avatar küçültme hatası:', err);
        }
    });

    // Durum seçici butonları
    document.querySelectorAll('.status-opt-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.status-opt-btn').forEach(b => {
                b.style.background = 'transparent';
                b.style.color = 'var(--text-muted)';
                b.style.borderColor = 'rgba(255,255,255,0.1)';
            });
            btn.style.background = `rgba(${window.hexToRgb(btn.dataset.color)}, 0.15)`;
            btn.style.color = btn.dataset.color;
            btn.style.borderColor = btn.dataset.color;
        });
    });

   // Kayıt ol / Güncelle butonu
   document.getElementById('social-setup-confirm-btn')?.addEventListener('click', async () => {
    const isEditMode = document.getElementById('social-setup-modal')?.dataset.mode === 'edit';
    const displayName = document.getElementById('social-setup-displayname')?.value?.trim();
    const colorOpt = document.querySelector('.social-color-opt.selected') || document.querySelector('.social-color-opt');
    const avatarColor = colorOpt ? colorOpt.dataset.color : '6c5ce7';

    if (!displayName || displayName.length < 2) { window.dcShowToast('Görünen ad en az 2 karakter olmalı.'); return; }

    const btn = document.getElementById('social-setup-confirm-btn');

    if (isEditMode && getCurrentUser()) {
        // Durum güncelle
        const activeStatusBtn = document.querySelector('.status-opt-btn[style*="rgba"]');
        const statusVal = activeStatusBtn ? activeStatusBtn.dataset.status : (getCurrentUser().status || 'online');
        const statusColor = activeStatusBtn ? activeStatusBtn.dataset.color : '#2ed573';

        // Yeni bir avatar seçildiyse Storage'a yükle, public URL'i al —
        // seçilmediyse (veya ui-avatars fallback'e dönüldüyse) mevcut değeri koru.
        const avatarPreview = document.getElementById('setup-avatar-preview');
        let customAvatar = getCurrentUser().customAvatar || null;
        if (_pendingAvatarBlob && !avatarUploadEnabled()) {
            _pendingAvatarBlob = null; // ücretsiz kullanıcı UI'ı atlayıp seçmiş olsa bile yükleme yapılmaz
        }
        if (_pendingAvatarBlob && window.FocusSupabase && getCurrentUser().id) {
            const path = `${getCurrentUser().id}/avatar.jpg`;
            const { error: upErr } = await window.FocusSupabase.storage
                .from('avatars')
                .upload(path, _pendingAvatarBlob, { upsert: true, contentType: 'image/jpeg', cacheControl: '3600' });
            if (upErr) {
                console.error('[FocusAI Social] avatar yükleme hatası:', upErr.message);
            } else {
                const { data } = window.FocusSupabase.storage.from('avatars').getPublicUrl(path);
                customAvatar = `${data.publicUrl}?v=${Date.now()}`;
            }
            _pendingAvatarBlob = null;
        } else if (avatarPreview && avatarPreview.src && avatarPreview.src.includes('ui-avatars.com')) {
            customAvatar = null; // kullanıcı fallback ikona döndü
        }

        const statusText = (document.getElementById('social-setup-status-text')?.value || '').trim().slice(0, 80);
        const avatarInitials = (document.getElementById('setup-avatar-initials-input')?.value || '').trim().toUpperCase().slice(0, 2) || null;

        getCurrentUser().displayName = displayName;
        getCurrentUser().avatarColor = avatarColor;
        getCurrentUser().status = statusVal;
        getCurrentUser().statusColor = statusColor;
        getCurrentUser().statusText = statusText;
        getCurrentUser().customAvatar = customAvatar;
        getCurrentUser().avatarInitials = avatarInitials;

        saveUser(getCurrentUser());
        // Profil değişikliklerini Supabase'e yaz (kimlik kaynağı)
        if (window.FocusSupabase && getCurrentUser().id) {
            window.FocusSupabase.from('profiles').update({
                display_name: displayName,
                avatar_color: avatarColor,
                custom_avatar: getCurrentUser().customAvatar || null,
                avatar_initials: avatarInitials,
                status: statusVal,
                status_color: statusColor,
                status_text: statusText
            }).eq('id', getCurrentUser().id).then(({ error }) => {
                if (error) console.error('[FocusAI Social] profil güncelleme hatası:', error.message);
            });
        }

        document.getElementById('social-setup-modal')?.classList.add('hidden');
            resetSetupModalToRegister();
            updateProfileHeader();
            window.updateSbProfile?.();
            syncXP();
            // Profil/durum değişikliği anında tüm modüllere (sohbet alt-profili, liderlik
            // tablosu, arkadaş listeleri vb.) yayılsın — Firebase güncellemesini beklemeden
            window.dispatchEvent(new CustomEvent('focusai:profile-updated'));
            return;
    }

    // Yeni kayıt
    const username = document.getElementById('social-setup-username')?.value?.trim();
    if (!username || username.length < 3) { window.dcShowToast('Kullanıcı adı en az 3 karakter olmalı.'); return; }
    if (!/^[a-z0-9_]+$/.test(username)) { window.dcShowToast('Kullanıcı adı sadece küçük harf, rakam ve _ içerebilir.'); return; }

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Kontrol ediliyor...';

    const result = await registerUser(username, displayName, avatarColor);

    if (result.success) {
        document.getElementById('social-setup-modal')?.classList.add('hidden');
        updateProfileHeader();
        window.startPresence(); syncXP();
        startAllSocialListeners(); // Arkadaşlık istekleri, DM bildirimleri ve son mesajlaşmalar sayfayı yenilemeden de canlı gelsin
        // Akış içerik kararı (2026-07-05): kaldırıldı, belirsiz/düşük sinyal.
        if (typeof showPremiumModal === 'function') {
            showPremiumModal({ title: '🎉 Hoş Geldin!', message: `@${username} olarak topluluğa katıldın. Arkadaş ekleyerek yarışmaya başla!`, type: 'success' });
        }
    } else {
        window.dcShowToast(result.error);
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-rocket"></i> Topluluğa Katıl';
    }
});

    // "Oturum yok" banner'ındaki "Giriş Yap" butonu — hesap/giriş modalını açar
    document.getElementById('social-not-configured-login-btn')?.addEventListener('click', () => {
        openAuthModal();
    });
}
