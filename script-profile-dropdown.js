import { getCurrentUser } from './state/current-user-store.js';

(function() {
    const avatarEl  = document.getElementById('v2-user-avatar');
    const dropdown  = document.getElementById('profile-dropdown');
    if (!avatarEl || !dropdown) return;

    function updateProfileHeader() {
        const user = getCurrentUser();
        const nameEl  = document.getElementById('pdm-user-name');
        const emailEl = document.getElementById('pdm-user-email');
        const avEl    = document.getElementById('pdm-avatar-initials');
        if (user) {
            const name = user.displayName || user.username || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Kullanıcı';
            const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2);
            if (nameEl)  nameEl.textContent  = name;
            if (emailEl) emailEl.textContent = user.username ? `@${user.username}` : (user.email || '');
            if (avEl)    avEl.textContent    = initials;
            if (avatarEl) avatarEl.textContent = initials;
        }

        const upgradeBtn = document.getElementById('pdm-upgrade-btn');
        if (upgradeBtn) {
            const isFree = typeof window.dcChatEnabled === 'function' && !window.dcChatEnabled();
            upgradeBtn.style.display = isFree ? 'flex' : 'none';
        }
    }
    updateProfileHeader();

    avatarEl.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = !dropdown.classList.contains('is-hidden');
        dropdown.classList.toggle('is-hidden', isOpen);
        if (!isOpen) updateProfileHeader();
    });
    document.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target) && e.target !== avatarEl)
            dropdown.classList.add('is-hidden');
    });

    function closeDropdown() { dropdown.classList.add('is-hidden'); }
    window.closeDropdown = closeDropdown;
})();
