import { ensureCommunityAccess } from './social.js';
import { renderNotificationsPanel } from './social-friends-notifications.js';


export function _setupFriendsGroupsListeners() {

    // Sohbet paneli tab geçişi
    document.querySelectorAll('.sb-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.sb-tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const tab = btn.dataset.sbTab;
            document.getElementById('sb-panel-contacts').style.display = tab === 'contacts' ? 'block' : 'none';
            document.getElementById('sb-panel-groups').style.display   = tab === 'groups'   ? 'block' : 'none';
        });
    });

    // "Ortak Alışkanlık Zincirleri" kartının sağ üstündeki tek buton — duruma göre
    // ya Alışkanlıklar sekmesine götürür ya da arkadaş ekleme modalını açar
    // (mod, renderBuddyHabitsSocial içinde data-mode olarak güncellenir)
    document.getElementById('buddy-create-habit-header-btn')?.addEventListener('click', (e) => {
        const mode = e.currentTarget.dataset.mode;
        if (mode === 'addfriend') {
            document.getElementById('open-add-friend-btn')?.click();
        } else {
            document.querySelector('.nav-links li[data-target="aliskanliklar"]')?.click();
        }
    });

    // Arkadaş ekle modal aç/kapat
    document.getElementById('open-add-friend-btn')?.addEventListener('click', async () => {
        if (!(await ensureCommunityAccess())) return;
        document.getElementById('add-friend-modal')?.classList.remove('hidden');
        document.getElementById('add-friend-result').innerHTML = '';
        if (document.getElementById('add-friend-input')) document.getElementById('add-friend-input').value = '';
    });

    document.getElementById('close-add-friend-modal')?.addEventListener('click', () => {
        document.getElementById('add-friend-modal')?.classList.add('hidden');
    });

    // Sidebar'daki global bildirim butonu — hangi sekmede olursak olalım bildirimlere ulaşabilelim
    document.getElementById('global-notif-btn')?.addEventListener('click', async () => {
        if (!(await ensureCommunityAccess())) return;
        renderNotificationsPanel();
        document.getElementById('friend-requests-modal')?.classList.remove('hidden');
    });
    document.getElementById('close-friend-requests-modal')?.addEventListener('click', () => {
        document.getElementById('friend-requests-modal')?.classList.add('hidden');
    });

    // Arkadaş ara
    document.getElementById('add-friend-search-btn')?.addEventListener('click', () => window.doFriendSearch());
    document.getElementById('add-friend-input')?.addEventListener('keypress', e => {
        if (e.key === 'Enter') window.doFriendSearch();
    });


    // KOD İLE GRUBA KATILMA
    document.getElementById('group-join-btn')?.addEventListener('click', () => {
        const input = document.getElementById('group-join-input');
        const code = input?.value;
        if (!code) return window.dcShowToast('Lütfen bir grup kodu girin.');
        window.joinGroupWithCode(code);
        if (input) { input.value = ''; _hubInputUpdate(''); }
    });

    // AKILLI INPUT — kod tespiti + keşfet filtresi
    const _hubInput = document.getElementById('group-join-input');
    const _hubJoinBtn = document.getElementById('group-join-btn');
    const _hubIcon = document.getElementById('group-smart-icon');
    const _hubInputRow = _hubInput?.closest('.groups-hub-input-row');

    function _hubInputUpdate(val) {
        const isCode = /^[A-Za-z0-9]{4,8}$/.test(val.trim()) && val.trim().length >= 4;
        if (_hubJoinBtn) _hubJoinBtn.classList.toggle('hidden', !isCode);
        if (_hubIcon) {
            _hubIcon.className = isCode
                ? 'fa-solid fa-arrow-right-to-bracket groups-hub-input-icon'
                : 'fa-solid fa-magnifying-glass groups-hub-input-icon';
        }
        if (_hubInputRow) _hubInputRow.classList.toggle('is-code', isCode);

        // Keşfet listesini filtrele
        const q = val.toLowerCase();
        document.querySelectorAll('#global-discover-groups > div').forEach(card => {
            const name = card.querySelector('h4')?.textContent?.toLowerCase() || '';
            card.style.display = (!q || name.includes(q)) ? '' : 'none';
        });
    }

    _hubInput?.addEventListener('input', e => _hubInputUpdate(e.target.value));
    _hubInput?.addEventListener('keydown', e => {
        if (e.key === 'Enter' && _hubJoinBtn && !_hubJoinBtn.classList.contains('hidden')) {
            _hubJoinBtn.click();
        }
    });
}
