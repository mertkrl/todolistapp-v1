// ─── TEK PANEL: ANA GÖRÜNÜM YÖNETİCİSİ + GRUP/ANA SAYFA PANELLERİ ─────────────
// social.js dosyasından çıkarıldı (Faz H devamı, tam çıkarma turu — 2026-07-30).
// Bu küme eskiden "gerçek duvar" sayılıyordu çünkü dcActiveGroupCode/
// _dcSupabaseChannelTreeChannel/currentUser/sharedFocusMinimized gibi paylaşımlı
// closure değişkenlerine bağımlıydı — hepsi artık gerçek store'lara taşındı
// (state/dc-active-group-code-store.js, state/dc-channel-tree-store.js,
// state/current-user-store.js, state/shared-focus-minimized-store.js) ve
// social.js içindeki TÜM iç kullanım noktaları da (sadece bu kümedekiler değil)
// aynı store'lara çevrildi — bu yüzden küme artık köprüsüz taşınabiliyor.
// _dcLeaveBtnAC (showRoomLeaveBar'ın kendi AbortController'ı) tek okuyucu/
// yazıcısı bu dosya olduğu için modül-seviyesi yerel değişken olarak kaldı.
import { getCurrentUser } from '../state/current-user-store.js';
// renderLeaderboardFromCache/setupGroupRecentConversationsSupabase/renderRecentConversations
// bilinçli olarak window.* üzerinden çağrılıyor (statik import değil) — social-friends-
// notifications.js/social-dm-notifications.js'i inline-module-loader.js'in gerçek lazy
// chunk olarak yükleyebilmesi için (Faz Q, ana bundle küçültme).
import { getDcActiveGroupCode, setDcActiveGroupCode } from '../state/dc-active-group-code-store.js';
import { getDcChannelTreeChannel, setDcChannelTreeChannel } from '../state/dc-channel-tree-store.js';
import { getSharedFocusMinimized } from '../state/shared-focus-minimized-store.js';
import { getDcRestorePending } from '../state/dc-restore-pending-store.js';
import { getActiveChatTarget } from '../state/active-chat-target-store.js';
import { getDcState } from '../state/dc-state-store.js';
import { getDcCurrentOtherProfile } from '../state/dc-message-render-store.js';
import { getDcCurrentGroupScope } from '../state/dc-current-group-scope-store.js';
import { setPendingClassroomSubtab } from '../state/pending-classroom-subtab-store.js';
import { dcChatEnabled } from './social-chat-gate.js';
import { closeDcChat } from './social-dc-room-lifecycle.js';
import { showDcRoomPreview } from './social-dc-open-room.js';
import { loadDcMembers } from './social-room-presence.js';
import { _setArenaChipCurrent, _updateArenaChipActive } from './social-arena-chips.js';
import { _syncGlobalRoomBar } from './social-misc-isolated-utils.js';

// "Odadasın" çubuğundaki odaklanmaya dönüş butonu — sadece kullanıcı mevcut
// bir odaklanma oturumunu "Sadece Arayüzden Ayrıl" ile küçültüp (oturum
// arka planda canlı kalırken) başka bir yere baktığında görünür.
window._syncFocusReturnMiniBtn = _syncFocusReturnMiniBtn; // social.js için
export function _syncFocusReturnMiniBtn() {
    const btn = document.getElementById('dc-leave-bar-focus-return-btn');
    if (btn) btn.style.display = getSharedFocusMinimized() ? 'flex' : 'none';
}

// Paneldeki "Gruplarım" listesini mevcut Firebase listesiyle eşitleyen fonksiyon (Kilitlenme ve Takılma Önleyicili Güvenli Sürüm)
window.syncSidebarGroupList = syncSidebarGroupList;
export function syncSidebarGroupList() {
    const container = document.getElementById('sidebar-my-conversations-list');
    if (!container) return;

    if (window.FocusSupabase && getCurrentUser()?.id) {
        if (typeof window.setupGroupRecentConversationsSupabase === 'function') window.setupGroupRecentConversationsSupabase();
        return;
    }
    if (!getCurrentUser()) {
        container.innerHTML = '<div class="u-padding-10px_font-size-12px_color-var-text-muted_text-alig">Giriş bekleniyor...</div>';
        return;
    }
    // Firebase kaldırıldı — Supabase yolu yukarıda ele alındı; burada yapacak bir şey yok
}

// Aktif oda satırını vurgula
window.highlightActiveRoom = highlightActiveRoom;
export function highlightActiveRoom(gCode, roomId) {
    const roomsList = document.getElementById(`sidebar-rooms-${gCode}`);
    if (!roomsList) return;
    roomsList.querySelectorAll('.sb-room-item').forEach(el => {
        el.style.background = 'transparent';
        el.style.color = 'rgba(255,255,255,0.7)';
        el.style.fontWeight = '400';
    });
    // Aktif olanı bul ve vurgula
    roomsList.querySelectorAll('.sb-room-item').forEach(el => {
        const isGeneral = roomId === 'general' && !el.dataset.roomId;
        const isMatch = el.dataset.roomId === roomId;
        if (isGeneral || isMatch) {
            el.style.background = 'rgba(108,92,231,0.2)';
            el.style.color = '#a29bfe';
            el.style.fontWeight = '600';
        }
    });
}

window.showHomePanel = showHomePanel;
export function showHomePanel() {
    // Yenileme restorasyonu devam ederken açık (geri yüklenmiş) sohbeti
    // silme — restore penceresi kapanınca normal davranışa dönülür.
    // (Kullanıcının bilinçli kapatmaları closeDcChat üzerinden geldiği ve
    // closeDcChat _activeChatTarget'ı önce null'ladığı için engellenmez.)
    const _fromUserClick = typeof window.event !== 'undefined' && window.event && window.event.isTrusted;
    if (getDcRestorePending() && getActiveChatTarget() && !_fromUserClick) {
        console.warn('[FocusAI] showHomePanel: sohbet restorasyonu sırasında otomatik çağrı yoksayıldı.', new Error().stack);
        return;
    }
    const home  = document.getElementById('dc-home-panel');
    const guild = document.getElementById('dc-guild-panel');
    if (home)  home.style.display  = 'flex';
    if (guild) guild.style.display = 'none';
    // Sohbet alanını sıfırla
    const empty = document.getElementById('dc-chat-empty-state');
    const stream = document.getElementById('sidebar-chat-messages-stream');
    const header = document.getElementById('dc-chat-header');
    if (empty)  empty.style.display  = 'flex';
    if (stream) { stream.style.display = 'none'; stream.innerHTML = ''; }
    if (header) header.style.display = 'none';
    // Bir kanal/kişi seçilmeden mesaj yazılamasın
    const msgInputEl = document.getElementById('sidebar-chat-message-input');
    const msgSendBtn = document.getElementById('sidebar-chat-send-msg-btn');
    if (msgInputEl) { msgInputEl.disabled = true; msgInputEl.value = ''; }
    if (msgSendBtn) msgSendBtn.disabled = true;
    document.querySelectorAll('.dc-tree-group-header').forEach(el => el.classList.remove('active-group', 'open'));
    document.querySelectorAll('.dc-tree-channels').forEach(el => el.classList.remove('open'));
    document.querySelectorAll('.dc-tree-channel').forEach(el => el.classList.remove('active'));
    setDcActiveGroupCode(null);
    getDcState().groupCode = null;
    getDcState().roomId = 'general';
    getDcState().chanId = null;
    if (getDcChannelTreeChannel() && window.FocusSupabase) { window.FocusSupabase.removeChannel(getDcChannelTreeChannel()); setDcChannelTreeChannel(null); }
    if (typeof window.detachDcListeners === 'function') window.detachDcListeners();
}

// Bir gruptan ayrılındığında, o grubun sohbeti açık DC sidebar'da
// görüntüleniyorsa kapatır — başka bir grubun/DM'in sohbeti açıksa dokunmaz.
window.__dcCloseChatIfGroup = function(groupCode) {
    const openGroupCode = getDcState() && getDcState().groupCode;
    if (getDcActiveGroupCode() === groupCode || openGroupCode === groupCode) {
        window._leaveCurrentWorkRoom();
        if (typeof closeDcChat === 'function') closeDcChat();
        showHomePanel();
        return true;
    }
    return false;
};

// ─── TEK PANEL: ANA GÖRÜNÜM YÖNETİCİSİ ─────────────────────
// Chat alanının üç modu: 'chat' (mesajlaşma, varsayılan), 'home' (Ana Sayfa
// panosu) ve 'group-panel' (grup istatistik/seans paneli). Mod, #dc-chat-area
// üzerindeki class ile yönetilir; CSS chat çocuklarını gizleyip ilgili
// görünümü gösterir. Empty-state ve hc-focus-pane mantığına dokunulmaz —
// onlar yalnızca 'chat' modunun alt durumlarıdır.
window.dcSetMainView = dcSetMainView;
export function dcSetMainView(mode, opts) {
    // Sayfa yenileme restorasyonu (_dcRestoreLastOpenOnLoad) bir grup panelini
    // (ör. Sınıf Paneli > Sınıflar/Öğrenciler) geri açtıktan sonra hâlâ birkaç
    // saniye "kilit" tutuyor (bkz. dcOpenGroupPanel'deki aynı desen) — çünkü
    // DOMContentLoaded+1200ms gibi geç çalışan başka açılış kodları (ör. "Bireysel"
    // sekmesinin varsayılan görünümü) dcOpenGroupPanel'i değil DOĞRUDAN
    // dcSetMainView('home')'u çağırıyordu, bu da o guard'ı atlayıp geri yüklenen
    // paneli ezip kullanıcıyı Arena'ya fırlatıyordu. Gerçek (kullanıcı tıklamalı)
    // "home" çağrılarına ve finish()'in meşru başarısız-restore fallback'ine
    // ({force:true}) izin veriyoruz, otomatik/programatik olanları yoksayıyoruz.
    const _force = !!(opts && opts.force);
    if (mode === 'home' && getDcRestorePending() && !_force) {
        // Sadece gerçek bir TIKLAMA kullanıcı niyeti sayılır — DOMContentLoaded gibi
        // tarayıcı olayları da isTrusted olduğundan (switchTab restore akışı) yalnızca
        // isTrusted kontrolü guard'ı yanlışlıkla atlatıyordu.
        const _fromUserClick = typeof window.event !== 'undefined' && window.event && window.event.isTrusted && window.event.type === 'click';
        if (!_fromUserClick) {
            console.warn('[FocusAI] dcSetMainView(home): restorasyon beklenirken otomatik çağrı yoksayıldı.');
            return;
        }
    }
    // Faz 2: sohbet yetkisi olmayan kullanıcı chat görünümüne GEÇEMEZ —
    // hangi koddan çağrılırsa çağrılsın Arena'ya yönlenir.
    if (mode === 'chat' && !dcChatEnabled()) mode = 'home';
    const area = document.getElementById('dc-chat-area');
    if (!area) return;
    area.classList.toggle('dc-view-home', mode === 'home');
    area.classList.toggle('dc-view-group-panel', mode === 'group-panel');
    // Mobil: görünüm değişince açık sohbet listesi overlay'ini kapat
    document.getElementById('premium-social-sidebar')?.classList.remove('dc-mobile-list-open');
    if (typeof window._updateArenaChipActive === 'function') _updateArenaChipActive();
}

// Ana Sayfa nav öğesi (Kademe 2'de görünür olacak; işleyici şimdiden hazır)
// Özetim'e geçerken açık kalan bir DM/grup sohbeti varsa kapat — aksi halde
// getActiveChatTarget() o sohbete kilitli kalır ve karşıdan gelen yeni
// mesajlar hâlâ "o sohbeti izliyormuşsun" sanılıp sessizce okundu işaretlenir,
// Son Mesajlaşmalar'daki rozet hiç görünmez.
document.getElementById('dc-nav-home')?.addEventListener('click', () => {
    if (typeof closeDcChat === 'function') closeDcChat();
    dcSetMainView('home');
    if (typeof window.renderHomeSummary === 'function') window.renderHomeSummary();
});
document.getElementById('dc-chat-focus-invite-btn')?.addEventListener('click', () => {
    const target = getActiveChatTarget();
    if (!target) return;

    if (target.type === 'dm') {
        const titleEl = document.getElementById('live-chat-target-title');
        const targetName = (titleEl?.textContent || target.username).replace(/^@/, '');
        const targetColor = getDcCurrentOtherProfile()?.avatar_color || '6c5ce7';
        if (typeof window.openBuddyFocusSettingsModal === 'function') {
            window.openBuddyFocusSettingsModal(target.username, targetName, targetColor, null);
        }
        return;
    }

    // Grup/kanal sohbeti: göndermeden önce DM akışındaki aynı zamanlayıcı
    // ayarları modalını (süre/mola/tur) aç — onaylanınca sendGroupFocusInvite
    // oda kurar ve kanala davet kartı gönderir (bkz. _renderDcCwRoomInviteCard).
    if (target.type === 'group' && getDcCurrentGroupScope() && window.FocusSupabase && getCurrentUser()?.id) {
        if (typeof window.openGroupFocusSettingsModal === 'function') {
            window.openGroupFocusSettingsModal({ type: getDcCurrentGroupScope().type, id: getDcCurrentGroupScope().id });
        }
    }
});
document.getElementById('dc-leave-bar-focus-return-btn')?.addEventListener('click', () => {
    if (typeof window.restoreSharedFocusOverlay === 'function') window.restoreSharedFocusOverlay();
});
document.getElementById('dc-home-chats-btn')?.addEventListener('click', () => {
    document.getElementById('premium-social-sidebar')?.classList.toggle('dc-mobile-list-open');
});

// ─── TEK PANEL: GRUP PANELİ GÖRÜNÜMÜ ────────────────────────
// Grubun istatistik/seans/duyuru panelini (eski Gruplar sekmesi içeriği)
// chat alanındaki group-panel görünümünde açar. groupCode verilmezse
// aktif guild ya da cache'teki ilk grup kullanılır.
window.dcOpenGroupPanel = dcOpenGroupPanel;
export function dcOpenGroupPanel(groupCode) {
    // Sayfa yenileme restorasyonu bekliyorsa OTOMATİK çağrılar görünümü ele
    // geçiremez — kullanıcının kaldığı sohbet birazdan geri açılacak.
    // Gerçek bir kullanıcı tıklamasından geliyorsa (isTrusted) izin verilir.
    const _fromUserClick = typeof window.event !== 'undefined' && window.event && window.event.isTrusted && window.event.type === 'click';
    if (getDcRestorePending() && !_fromUserClick && !window._dcRestoreInvoking) {
        console.warn('[FocusAI] dcOpenGroupPanel: sohbet restorasyonu beklenirken otomatik çağrı yoksayıldı.', new Error().stack);
        return;
    }
    const cache = (typeof window.getMyGroupsDataCache === 'function') ? window.getMyGroupsDataCache() : {};
    const code = groupCode || getDcActiveGroupCode() || Object.keys(cache)[0] || null;
    if (!code || !cache[code]) {
        // Cache henüz dolmadıysa (ilk açılış) grup listesi yüklensin, bir kez tekrar dene
        if (!dcOpenGroupPanel._retried) {
            dcOpenGroupPanel._retried = true;
            setTimeout(() => { dcOpenGroupPanel(groupCode); dcOpenGroupPanel._retried = false; }, 900);
            return;
        }
        dcSetMainView('home');
        if (!code) window.dcShowToast('Henüz bir grubun yok — önce bir gruba katıl.', 'info');
        return;
    }
    if (typeof window.resetActiveGroupPanel === 'function') window.resetActiveGroupPanel();
    if (typeof window.showGroupDetails === 'function') window.showGroupDetails(code, cache[code]);
    _setArenaChipCurrent(code); // çip barında aktif grubu işaretle
    dcSetMainView('group-panel');
}
// "Ödevlerim" rozeti/popoveri ve ders planı bildirimleri için: grup panelini açıp
// doğrudan Sınıf/Ekip Paneli sekmesine, onun içinde de Ödevler/Ders Planı alt
// sekmesine düşürür. _pendingClassroomSubtab TEK BAŞINA yeterli değil — sadece
// Sınıf Paneli sekmesi zaten açıldıktan SONRA hangi alt sekmenin aktif olacağını
// belirler; ana "group-detail-tabs" varsayılan olarak "Genel Bakış" ile açılır,
// bu yüzden ayrıca classroom sekme butonuna programatik tıklamak gerekiyor.
// showGroupDetails senkron olarak hemen render olmayabilir (grup cache'i henüz
// dolmamışsa dcOpenGroupPanel içeride 900ms sonra tekrar dener) — bu yüzden
// kısa aralıklarla birkaç kez deneniyor.
window.dcOpenAssignmentTab = function(groupCode, innerTab) {
    setPendingClassroomSubtab('odevler');
    window._pendingAsgInnerTab = innerTab === 'planlar' ? 'planlar' : null;
    dcOpenGroupPanel(groupCode);
    const clickClassroomTab = (attempt) => {
        const btn = document.querySelector('.group-detail-tab-btn[data-gtab="classroom"]');
        if (btn) { btn.click(); return; }
        if (attempt < 4) setTimeout(() => clickClassroomTab(attempt + 1), 400);
    };
    setTimeout(() => clickClassroomTab(0), 50);
};

document.getElementById('dc-guild-panel-nav')?.addEventListener('click', () => {
    dcOpenGroupPanel(getDcActiveGroupCode());
});

// ─── TEK PANEL: SOSYAL BÖLÜM AÇILIŞ HOOK'U ──────────────────
// Ana menüden Sosyal'e her girişte sidebar verileri tazelenir.
// (Eski sekme sistemindeki sync çağrılarının yerini alır.)
document.querySelectorAll('.nav-links li[data-target="arkadaslar"], .di[data-target="arkadaslar"]').forEach(el => {
    el.addEventListener('click', () => {
        setTimeout(() => {
            const sidebar = document.getElementById('premium-social-sidebar');
            if (sidebar) sidebar.classList.remove('hidden-sidebar');
            if (typeof window.syncSidebarGroupList === 'function') window.syncSidebarGroupList();
            if (typeof window.syncDcContactList === 'function') window.syncDcContactList();
            if (typeof window.updateSbProfile === 'function') window.updateSbProfile();
            if (typeof window.loadUserGroupsForDc === 'function') window.loadUserGroupsForDc();
            if (typeof window.renderRecentConversations === 'function') window.renderRecentConversations();
            if (typeof window.renderLeaderboardFromCache === 'function') window.renderLeaderboardFromCache();
            if (typeof window.renderHomeSummary === 'function') window.renderHomeSummary();
        }, 60);
    });
});

window.showGuildPanel = showGuildPanel; // social-server-tree.js için
export function showGuildPanel(groupCode, groupName) {
    const home  = document.getElementById('dc-home-panel');
    const guild = document.getElementById('dc-guild-panel');
    if (home)  home.style.display  = 'none';
    if (guild) guild.style.display = 'flex';
    const nameEl = document.getElementById('dc-guild-name');
    if (nameEl) nameEl.textContent = groupName;
    setDcActiveGroupCode(groupCode);
    getDcState().groupCode = groupCode;
    window.loadDcChannels(groupCode);
    loadDcMembers(groupCode);
}

// ─── PREMIUM'A YÜKSELT (Madde 7-8, 2026-07-03) ──────────────────
// Eskiden Arena'da kilitli bir sohbet kartıydı (madde 7 ile kaldırıldı);
// aynı mesaj artık profil menüsündeki (#v2-user-avatar → #profile-dropdown,
// script.js) "Premium'a Yükselt" butonuna taşındı. Buton yalnızca ücretsiz
// planda görünür (script.js updateProfileHeader() dcChatEnabled()'a bakar);
// tıklanınca ödeme entegrasyonu (Faz 3b) gelene kadar bilgilendirme
// modalı gösterir.
document.getElementById('pdm-upgrade-btn')?.addEventListener('click', () => {
    const dropdown = document.getElementById('profile-dropdown');
    if (dropdown) dropdown.classList.add('is-hidden');
    if (typeof window.showFocusaiConfirm === 'function') {
        window.showFocusaiConfirm({
            title: 'Premium Yakında ⭐',
            desc: 'Premium plan: sohbet bölümü (özel mesajlar + grup kanalları), mesajlarda arama, 5 grup ve 30 üye kapasitesi. Ödeme sistemi hazırlanıyor — planlar şimdilik tanıtım aşamasında.',
            type: 'info',
            icon: 'fa-star',
            confirmText: 'Anladım',
            cancelText: 'Kapat'
        });
    } else {
        window.dcShowToast('Premium yakında: sohbet + genişletilmiş grup kapasiteleri.', 'info');
    }
});

// "Odadasın" göstergesi dock'taki Sosyal ikonu üzerinde gösterilir —
// ikon yeşile döner, üzerine gelince mini popup ile oda adı + ayrılma
// butonu açılır.
document.getElementById('dc-dock-leave-room-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (typeof window._leaveCurrentWorkRoom === 'function') window._leaveCurrentWorkRoom();
});

// Dock ikonu overflow:auto olan .dock içinde olduğundan CSS-only hover ile
// popup'ı absolute konumlandırmak kırpılıyordu — popup body seviyesinde
// fixed olarak tutulup JS ile ikonun konumuna göre yerleştiriliyor.
(function _setupDockRoomPopup() {
    const icon = document.getElementById('dock-sosyal-icon');
    const popup = document.getElementById('dc-dock-room-popup');
    if (!icon || !popup) return;
    let hideTimer = null;
    function positionPopup() {
        const r = icon.getBoundingClientRect();
        popup.style.left = (r.right + 10) + 'px';
        popup.style.top = (r.top + r.height / 2) + 'px';
        popup.style.transform = 'translateY(-50%)';
    }
    function show() {
        if (!icon.classList.contains('in-room')) return;
        clearTimeout(hideTimer);
        positionPopup();
        popup.classList.remove('hidden');
    }
    function scheduleHide() {
        clearTimeout(hideTimer);
        hideTimer = setTimeout(() => popup.classList.add('hidden'), 150);
    }
    icon.addEventListener('mouseenter', show);
    icon.addEventListener('mouseleave', scheduleHide);
    popup.addEventListener('mouseenter', () => clearTimeout(hideTimer));
    popup.addEventListener('mouseleave', scheduleHide);
})();

// ─── ALT ODA BIRAKMA ÇUBUĞU + BUTON ANİMASYONU ──────
let _dcLeaveBtnAC = null; // tek okuyucu/yazıcı bu dosya — social.js'e taşınmadı
window.showRoomLeaveBar = showRoomLeaveBar; // social-server-tree.js için
export function showRoomLeaveBar(roomName, database, groupCode, channelId, subId) {
    const bar    = document.getElementById('dc-room-leave-bar');
    const nameEl = document.getElementById('dc-room-leave-name');
    const btn    = document.getElementById('dc-leave-room-btn');
    const actionBtns = document.getElementById('dc-room-action-btns');
    if (!bar || !btn) return;

    if (nameEl) nameEl.textContent = roomName;
    bar.style.display = 'block'; // CSS animasyonu .dc-leave-bar üzerinden çalışır
    _syncFocusReturnMiniBtn();
    _syncGlobalRoomBar(roomName);

    // Yıldırım + ateş butonlarını animasyonla göster
    if (actionBtns) {
        actionBtns.classList.add('visible');
    }

    if (_dcLeaveBtnAC) _dcLeaveBtnAC.abort();
    _dcLeaveBtnAC = new AbortController();
    btn.addEventListener('click', () => {
        window._leaveCurrentWorkRoom();
        // Hâlâ bu odadaysak sohbeti kilitleyip önizlemeye düşür
        if (getDcState() && getDcState().roomId === subId && getDcState().groupCode === groupCode) {
            showDcRoomPreview(groupCode, roomName, subId, channelId);
        }
    }, { signal: _dcLeaveBtnAC.signal });
}
