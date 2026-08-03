import { syncSidebarGroupList } from './social-dc-panel-view.js';
import { updateDcBottomProfile } from './social-dc-init.js';

function _openFullPanel() {
    // Sohbet artık tab içinde — arkadaslar bölümüne git + Sohbet tabını aç
    const arkadaslarNav = document.querySelector('.nav-links li[data-target="arkadaslar"], .di[data-target="arkadaslar"]');
    if (arkadaslarNav) arkadaslarNav.click();

    setTimeout(() => {
        _switchToSohbetTab();
    }, 80);
}

function _switchToSohbetTab() {
    const sohbetBtn = document.getElementById('social-tab-sohbet-btn');
    if (sohbetBtn) {
        sohbetBtn.click();
    } else {
        // Fallback: manuel tab geçişi
        document.querySelectorAll('.social-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.social-content').forEach(c => c.classList.remove('active'));
        document.getElementById('tab-sohbet')?.classList.add('active');
    }
    // Panel verilerini güncelle
    const premiumSidebar = document.getElementById('premium-social-sidebar');
    if (premiumSidebar) premiumSidebar.classList.remove('hidden-sidebar');
    syncSidebarGroupList();
    if (typeof window.syncDcContactList === 'function') window.syncDcContactList();
    window.updateSbProfile?.();
    if (typeof window.loadUserGroupsForDc === 'function') window.loadUserGroupsForDc();
    if (typeof updateDcBottomProfile === 'function') updateDcBottomProfile();
    // Sohbet modunda maksimum alan
    const _sec = document.getElementById('arkadaslar');
    if (_sec) _sec.classList.add('sohbet-active');
}

export { _openFullPanel, _switchToSohbetTab };
