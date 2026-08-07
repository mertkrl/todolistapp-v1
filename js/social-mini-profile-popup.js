// social-mini-profile-popup.js
// social.js'ten çıkarıldı: detaylı mini profil popup'ını açan
// openDetailedMiniProfile. Rol kontrolü artık state/current-user-role-store.js
// getter'ı (getCurrentUserRole) üzerinden yapılıyor.

import { getCurrentUserRole } from '../state/current-user-role-store.js';

window.openDetailedMiniProfile = function(userId, userName) {
    const modal = document.getElementById('user-detail-modal');
    if (!modal) return;

    // Varsayılan yükleniyor değerlerini ata
    document.getElementById('detail-user-name').innerText = userName || "Kullanıcı";
    document.getElementById('detail-user-avatar').innerText = (userName || "U").charAt(0).toUpperCase();
    document.getElementById('detail-user-status').innerText = "Durum bilgisi yükleniyor...";

    const badgeContainer = document.getElementById('detail-user-role-badge-container');
    badgeContainer.innerHTML = '';

    // Admin kontrolü: İsteyen herkes rol değiştiremesin, sadece admin değiştirebilsin
    const adminArea = document.getElementById('detail-admin-action-area');
    const saveBtn = document.getElementById('btn-save-user-detail-role');

    if (getCurrentUserRole() === 'admin') {
        if(adminArea) adminArea.style.display = 'block';
        if(saveBtn) saveBtn.style.display = 'inline-block';
    } else {
        if(adminArea) adminArea.style.display = 'none';
        if(saveBtn) saveBtn.style.display = 'none';
    }

    // Firebase rol/durum sorgusu kaldırıldı — rol yönetimi Supabase üzerinden yapılır
    document.getElementById('detail-user-status').innerText = "Şu an aktif bir odağı veya aktivitesi yok.";

    // Modalı görünür yap
    modal.classList.remove('hidden');
};

export function openDetailedMiniProfile(...args) { return window.openDetailedMiniProfile(...args); }
