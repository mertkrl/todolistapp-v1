// social-dc-profile-menu.js
// social-dc-init.js dosyasından çıkarıldı: profil zone context-menüsü
// (Profili Düzenle/Ayarlar/Çıkış Yap) — kendi DOM'unu kurup açan/kapayan
// izole bir fonksiyon, DC init/bağlama akışının geri kalanına bağımlı değil.
//
// Dış bağımlılıklar (window.* üzerinden): window._escapeHtml,
// window.openSetupModalAsEdit, window.openSettingsModal,
// window.showFocusaiConfirm, window.FocusSupabase, window.FocusAuth.
import { getCurrentUser } from '../state/current-user-store.js';

export function openProfileContextMenu(anchorEl) {
    document.querySelectorAll('.dc-profile-menu').forEach(m => m.remove());

    const user = (typeof getCurrentUser() !== 'undefined' && getCurrentUser()) ? getCurrentUser() : null;

    const esc = window._escapeHtml;

    // Kullanıcı yoksa sadece "Profil Oluştur" seçeneğiyle mini menü göster
    if (!user) {
        const menu = document.createElement('div');
        menu.className = 'dc-profile-menu';
        menu.innerHTML = `
            <div class="dc-profile-menu-header">
                <div class="si-min0">
                    <div class="dc-profile-menu-name">Misafir</div>
                    <div class="dc-profile-menu-tag">Henüz giriş yapılmadı</div>
                </div>
            </div>
            <button class="dc-profile-menu-item item-profile" id="_pm_register">
                <span class="pm-icon"><i class="fa-solid fa-user-plus"></i></span>
                Profil Oluştur
            </button>
        `;
        document.body.appendChild(menu);
        const rect = anchorEl.getBoundingClientRect();
        menu.style.position = 'fixed';
        menu.style.left = Math.max(8, rect.left) + 'px';
        menu.style.bottom = (window.innerHeight - rect.top + 8) + 'px';
        requestAnimationFrame(() => menu.classList.add('dc-profile-menu--open'));
        const closeMenu = () => { menu.classList.remove('dc-profile-menu--open'); setTimeout(() => menu.remove(), 180); };
        setTimeout(() => document.addEventListener('click', closeMenu, { once: true }), 0);
        menu.querySelector('#_pm_register').addEventListener('click', (ev) => {
            ev.stopPropagation(); closeMenu();
            document.getElementById('social-setup-modal')?.classList.remove('hidden');
        });
        return;
    }

    const color = (user.avatarColor || '6c5ce7').replace('#', '');
    const avatarUrl = user.customAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || user.username)}&background=${color}&color=fff`;

    const menu = document.createElement('div');
    menu.className = 'dc-profile-menu';
    menu.innerHTML = `
        <div class="dc-profile-menu-header">
            <div class="u-position-relative_flex-shrink-0">
                <img class="dc-profile-menu-avatar" src="${esc(avatarUrl)}" alt="">
                <span class="u-position-absolute_bottom-1px_right-1px_width-10px_height-1"></span>
            </div>
            <div class="si-min0">
                <div class="dc-profile-menu-name">${esc(user.displayName || user.username)}</div>
                <div class="dc-profile-menu-tag">@${esc(user.username)}</div>
            </div>
        </div>
        <button class="dc-profile-menu-item item-profile" id="_pm_profile">
            <span class="pm-icon"><i class="fa-solid fa-user-pen"></i></span>
            Profili Düzenle
        </button>
        <button class="dc-profile-menu-item item-settings" id="_pm_settings">
            <span class="pm-icon"><i class="fa-solid fa-sliders"></i></span>
            Ayarlar
        </button>
        <div class="dc-profile-menu-divider"></div>
        <button class="dc-profile-menu-item item-logout" id="_pm_logout">
            <span class="pm-icon"><i class="fa-solid fa-right-from-bracket"></i></span>
            Çıkış Yap
        </button>
    `;

    document.body.appendChild(menu);
    const rect = anchorEl.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.left     = Math.max(8, rect.left) + 'px';
    menu.style.top      = 'auto';
    menu.style.bottom   = (window.innerHeight - rect.top + 8) + 'px';

    // Animasyon
    requestAnimationFrame(() => menu.classList.add('dc-profile-menu--open'));

    const closeMenu = () => {
        menu.classList.remove('dc-profile-menu--open');
        setTimeout(() => menu.remove(), 180);
    };
    setTimeout(() => document.addEventListener('click', closeMenu, { once: true }), 0);

    menu.querySelector('#_pm_profile').addEventListener('click', (ev) => {
        ev.stopPropagation();
        closeMenu();
        if (typeof window.openSetupModalAsEdit === 'function') window.openSetupModalAsEdit();
    });

    menu.querySelector('#_pm_settings').addEventListener('click', (ev) => {
        ev.stopPropagation();
        closeMenu();
        window.openSettingsModal(user);
    });

    menu.querySelector('#_pm_logout').addEventListener('click', async (ev) => {
        ev.stopPropagation();
        closeMenu();
        const confirmed = await window.showFocusaiConfirm({
            title: 'Hesaptan Çıkış',
            desc: 'Hesabından çıkmak istediğine emin misin?<br>Tekrar giriş yapman gerekecek.',
            type: 'danger',
            icon: 'fa-right-from-bracket',
            confirmText: 'Çıkış Yap',
            cancelText: 'Vazgeç'
        });
        if (!confirmed) return;
        try {
            if (window.FocusSupabase && user?.id) {
                await window.FocusSupabase.from('profiles').update({ is_online: false, last_seen: new Date().toISOString() }).eq('id', user.id);
            }
        } catch (_) { console.warn('[FocusAI] sessiz hata:', _); }
        try {
            if (window.FocusAuth && typeof window.FocusAuth.signOut === 'function') {
                await window.FocusAuth.signOut();
            }
        } catch (_) { console.warn('[FocusAI] sessiz hata:', _); }
        localStorage.removeItem('focusai_social_user');
        localStorage.removeItem('focusai_friends');
        localStorage.removeItem('focusai_dev_test_email');
        location.reload();
    });
}
