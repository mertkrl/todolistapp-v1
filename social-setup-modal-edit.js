import { getCurrentUser } from './state/current-user-store.js';
import { avatarUploadEnabled } from './social-chat-gate.js';

window.openSetupModalAsEdit = openSetupModalAsEdit; // social-dc-init.js gibi ayrı script scope'larından erişim için
export function openSetupModalAsEdit() {
    const modal = document.getElementById('social-setup-modal');
    if (!modal) return;
    modal.dataset.mode = 'edit';

    // Başlık/subtitle güncelle
    const title = document.getElementById('setup-modal-title');
    const subtitle = document.getElementById('setup-modal-subtitle');
    if (title) title.textContent = 'Profili Düzenle';
    if (subtitle) subtitle.textContent = 'Görünen adını, durumunu ve fotoğrafını değiştir.';

    // Mevcut değerleri doldur
    const dnInput = document.getElementById('social-setup-displayname');
    if (dnInput && getCurrentUser()) dnInput.value = getCurrentUser().displayName || '';

    // Kullanıcı adı alanını gizle
    const unField = document.getElementById('setup-username-field');
    if (unField) unField.style.display = 'none';

    // Avatar yükleme alanını göster — sadece premium/kurumsal, ücretsizde kilit notu
    const avatarField = document.getElementById('setup-avatar-upload-field');
    const lockedNote = document.getElementById('setup-avatar-locked-note');
    const avatarPreview = document.getElementById('setup-avatar-preview');
    const uploadAllowed = avatarUploadEnabled();
    if (avatarField) avatarField.style.display = uploadAllowed ? 'block' : 'none';
    if (lockedNote) lockedNote.style.display = uploadAllowed ? 'none' : 'block';
    if (avatarPreview && getCurrentUser()) {
        avatarPreview.src = getCurrentUser().customAvatar || window.avatarSrc(getCurrentUser().avatarInitials || getCurrentUser().displayName, getCurrentUser().avatarColor);
    }
    const initialsInput = document.getElementById('setup-avatar-initials-input');
    if (initialsInput && getCurrentUser()) {
        initialsInput.value = getCurrentUser().avatarInitials || (getCurrentUser().displayName || getCurrentUser().username || 'U').trim().slice(0, 2).toUpperCase();
    }

    // Renk önizleme çerçevesini ayarla
    const ring = document.getElementById('avatar-color-preview-ring');
    if (ring && getCurrentUser()) {
        if (getCurrentUser().customAvatar) {
            ring.src = getCurrentUser().customAvatar;
        } else {
            ring.src = window.avatarSrc(getCurrentUser().displayName, getCurrentUser().avatarColor);
        }
        ring.style.borderColor = '#' + (getCurrentUser().avatarColor || '6c5ce7');
        ring.style.display = 'block';
    }

    // Durum seçiciyi göster
    const statusField = document.getElementById('setup-status-field');
    if (statusField) statusField.style.display = 'block';

    // Durum cümlesi alanını doldur
    const statusTextInput = document.getElementById('social-setup-status-text');
    const statusTextCount = document.getElementById('setup-status-text-count');
    if (statusTextInput && getCurrentUser()) {
        statusTextInput.value = getCurrentUser().statusText || '';
        if (statusTextCount) statusTextCount.textContent = `${(getCurrentUser().statusText || '').length}/80`;
    }
    if (statusTextInput && statusTextCount) {
        statusTextInput.oninput = () => {
            statusTextCount.textContent = `${statusTextInput.value.length}/80`;
        };
    }

    // Mevcut durumu seç
    const currentStatus = getCurrentUser()?.status || 'online';
    document.querySelectorAll('.status-opt-btn').forEach(btn => {
        btn.style.background = 'transparent';
        btn.style.color = 'var(--text-muted)';
        btn.style.borderColor = 'rgba(255,255,255,0.1)';
        if (btn.dataset.status === currentStatus) {
            btn.style.background = `rgba(${window.hexToRgb(btn.dataset.color)}, 0.15)`;
            btn.style.color = btn.dataset.color;
            btn.style.borderColor = btn.dataset.color;
        }
    });

    // Butonu güncelle
    const confirmBtn = document.getElementById('social-setup-confirm-btn');
    if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = '<i class="fa-solid fa-check"></i> Kaydet';
    }

    modal.classList.remove('hidden');
}

export function resetSetupModalToRegister() {
    const modal = document.getElementById('social-setup-modal');
    if (!modal) return;
    delete modal.dataset.mode;

    const title = document.getElementById('setup-modal-title');
    const subtitle = document.getElementById('setup-modal-subtitle');
    if (title) title.textContent = 'Topluluğa Katıl!';
    if (subtitle) subtitle.textContent = 'Arkadaşlarınla rekabet et, birlikte çalış.';

    const unField = document.getElementById('setup-username-field');
    if (unField) unField.style.display = 'block';
    const avatarField = document.getElementById('setup-avatar-upload-field');
    if (avatarField) avatarField.style.display = 'none';
    const statusField = document.getElementById('setup-status-field');
    if (statusField) statusField.style.display = 'none';

    const confirmBtn = document.getElementById('social-setup-confirm-btn');
    if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = '<i class="fa-solid fa-rocket"></i> Topluluğa Katıl';
    }
}
