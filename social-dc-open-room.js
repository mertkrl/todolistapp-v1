// ─── ÇALIŞMA ODASI ÖNİZLEME/AÇMA + DUYURU KANALI INPUT KİLİDİ + SAYFA
// YENİLEME RESTORASYONU (son açık sohbet/oda) ─────────────────────────────
// social.js dosyasından çıkarıldı (Faz H devamı, 2026-07-30). currentUser
// artık state/current-user-store.js üzerinden (bare closure değişkeni değil),
// currentChannelIsAnnouncement/dcSetMainView/dcOpenGroupPanel/showRoomLeaveBar
// gibi social.js'te kalan closure state/fonksiyonlara window.X köprüsüyle
// erişiliyor.
import { getCurrentUser } from './state/current-user-store.js';
import { getDB, getUser } from './social-misc-pure-utils.js';
import { dcChatEnabled } from './social-chat-gate.js';
import { getDcState } from './state/dc-state-store.js';
import { openDcGroupChannelSupabase, openDcDmRoom } from './social-dc-room-lifecycle.js';
import { getActiveChatTarget } from './state/active-chat-target-store.js';
import { getDcRestorePending, setDcRestorePending } from './state/dc-restore-pending-store.js';
import { getDcEnteredRoomKey, setDcEnteredRoomKey } from './state/dc-entered-room-key-store.js';
import { getDcEnteredRoomId, setDcEnteredRoomId } from './state/dc-entered-room-id-store.js';
import { setPendingClassroomSubtab } from './state/pending-classroom-subtab-store.js';
import { startRoomPresenceSupabase } from './social-room-presence.js';
import { showDcSkeleton } from './social-dc-scroll-skeleton.js';

// ─── ÇALIŞMA ODASI ÖNİZLEMESİ (girmeden okuma/yazma yok) ─
window.showDcRoomPreview = showDcRoomPreview; // social-server-tree.js için
export function showDcRoomPreview(groupCode, roomName, roomId, channelId, isLockedByRole) {
    getDcState().groupCode = groupCode;
    getDcState().roomId    = roomId;
    getDcState().chanId    = channelId || null;

    const titleEl    = document.getElementById('live-chat-target-title');
    const subtitleEl = document.getElementById('live-chat-target-desc');
    if (titleEl)    titleEl.textContent    = '# ' + roomName;
    if (subtitleEl) subtitleEl.textContent = isLockedByRole ? 'Bu oda kilitli — giriş izni yok' : 'Sohbeti görmek için odaya çift tıklayarak gir';

    const emptyEl  = document.getElementById('dc-chat-empty-state');
    const streamEl = document.getElementById('sidebar-chat-messages-stream');
    const headerEl = document.getElementById('dc-chat-header');
    const inputBar = document.querySelector('.dc-chat-input-bar');

    if (emptyEl)  emptyEl.style.display  = 'none';
    if (headerEl) headerEl.style.display = 'flex';
    if (inputBar) inputBar.style.display = 'none';
    if (streamEl) {
        streamEl.style.display = 'flex';
        streamEl.innerHTML = isLockedByRole ? `
            <div class="u-margin-auto_text-align-center_color-rgba2551181170p6_font-">
                <i class="fa-solid fa-lock u-font-size-30px_color-rgba2551181170p35_margin-bottom-12px_" ></i>
                <b># ${roomName}</b> çalışma odası kilitli.<br>Bu odaya girmek için yetkili biri tarafından kilidin açılması gerekiyor.
            </div>
        ` : `
            <div class="u-margin-auto_text-align-center_color-rgba2552552550p35_font">
                <i class="fa-solid fa-lock u-font-size-30px_color-rgba2552552550p12_margin-bottom-12px_" ></i>
                <b># ${roomName}</b> çalışma odasının sohbetini görmek ve mesaj yazabilmek için<br>odaya <b>çift tıklayarak</b> girmen gerekiyor.
            </div>
        `;
    }
}

// ─── SOHBET ODASINI AÇ (channelId opsiyonel) ────────
window.openDcChatRoom = (...args) => openDcChatRoom(...args);
export function openDcChatRoom(groupCode, roomName, roomId, channelId) {
    const user = getUser();
    if (!user) return;
    // Savunma katmanı: sohbet yetkisi yoksa grup kanalı hiç yüklenmez
    if (!dcChatEnabled()) { window.dcSetMainView('home'); return; }

    // ── Supabase-öncelikli yönlendirme ──────────────────────────────────
    // getDB() her zaman null döndürür (Firebase kaldırıldı).
    // Supabase grubuysa openDcGroupChannelSupabase'e devret.
    const currentUser = getCurrentUser();
    const supaGroup = (window.FocusSupabase && currentUser?.id)
        ? (typeof window.getMyGroupsDataCache === 'function' ? window.getMyGroupsDataCache()[groupCode] : null)
        : null;
    if (supaGroup?._supaId) {
        // "genel" / "general" → grup scope
        if (!channelId && (roomId === 'general' || roomId === 'genel')) {
            openDcGroupChannelSupabase(groupCode, supaGroup, { type: 'group', id: supaGroup._supaId }, '# genel');
            return;
        }
        // channelId varsa → kategori kanalı scope (eski sistem)
        if (channelId) {
            const isGenSub = (roomId === 'genel' || roomId === 'ch-general');
            const scopeType = isGenSub ? 'group_channel' : 'group_subchannel';
            openDcGroupChannelSupabase(groupCode, supaGroup, { type: scopeType, id: channelId }, '# ' + roomName);
            return;
        }
        // roomId bir Supabase UUID ise → alt-kanal scope
        if (/^[0-9a-f]{8}-/.test(roomId)) {
            openDcGroupChannelSupabase(groupCode, supaGroup, { type: 'group_subchannel', id: roomId }, '# ' + roomName);
            return;
        }
        // Fallback: grup scope
        openDcGroupChannelSupabase(groupCode, supaGroup, { type: 'group', id: supaGroup._supaId }, '# ' + (roomName || 'genel'));
        return;
    }

    // ── Firebase fallback (artık kullanılmıyor — Supabase group cache henüz dolmadıysa) ─
    const database = getDB();
    if (!database) {
        // Cache henüz dolmamış, Supabase'den async yükle sonra tekrar dene
        if (window.FocusSupabase && currentUser?.id && typeof window.getMyGroupsDataCache === 'function') {
            (async () => {
                const { data: rows } = await window.FocusSupabase
                    .from('group_members')
                    .select('group_id, groups(*)')
                    .eq('user_id', currentUser.id);
                for (const row of (rows || [])) {
                    const gr = row.groups;
                    if (!gr || gr.code !== groupCode) continue;
                    const { data: memberRows } = await window.FocusSupabase
                        .from('group_members')
                        .select('user_id, role, class_section_id, joined_at, profiles(id, username, display_name, avatar_color, custom_avatar, avatar_initials)')
                        .eq('group_id', gr.id);
                    const gd = await window._normalizeSupabaseGroup(gr, memberRows || []);
                    window.getMyGroupsDataCache()[groupCode] = gd;
                    openDcChatRoom(groupCode, roomName, roomId, channelId); // retry
                    return;
                }
            })();
        }
        return;
    }
}

// ─── SON AÇIK SOHBETİ HATIRLA (sayfa yenileme restorasyonu) ──
// Sayfa yenilenince kullanıcı DM/kanal/çalışma odası sohbetinden atılıp
// varsayılan görünüme düşüyordu. Açık sohbetin kimliğini localStorage'da
// tutup, yükleme sonrası (login + grup cache hazır olunca) geri açıyoruz.
// _dcPersistLastOpen/_dcClearLastOpen/_dcPersistEnteredRoom/_dcClearEnteredRoom
// → social-dc-last-open-storage.js'e taşındı (Faz O). Anahtar sabitleri
// (immutable string) aşağıdaki kalan fonksiyonların hâlâ ihtiyacı olduğu
// için BURADA DA tutuluyor (social.js'te de aynı değerle tanımlı — bilinçli
// küçük tekrar, mutable state değil).
const DC_LAST_OPEN_KEY = 'focusai_dc_last_open';
const DC_ENTERED_ROOM_KEY = 'focusai_dc_entered_room';

// Çalışma odası presence'ını (ve global "Odadasın" çubuğunu) sayfa
// yenilenince HER ZAMAN geri kurar — sohbet paneli restore'unun aksine
// (bkz. _dcRestoreLastOpenOnLoad) hangi sekmede yenilendiğine bakmaz,
// çünkü artık gösterge sosyal bölümün dışında da (global çubuk) görünüyor.
(function _dcRestoreEnteredRoomOnLoad() {
    let entered = null;
    try { entered = JSON.parse(localStorage.getItem(DC_ENTERED_ROOM_KEY) || 'null', window._safeJsonReviver); } catch (_) { console.warn('[FocusAI] sessiz hata:', _); }
    if (!entered || !entered.subId || !entered.groupCode) return;

    let attempts = 0;
    const timer = setInterval(() => {
        attempts++;
        if (attempts > 100) { clearInterval(timer); return; } // ~30 sn sonra vazgeç
        if (!getCurrentUser()) return;
        if (!dcChatEnabled()) { clearInterval(timer); return; }
        if (getDcEnteredRoomKey()) { clearInterval(timer); return; } // sohbet restore'u zaten kurdu
        clearInterval(timer);
        try {
            startRoomPresenceSupabase(entered.groupCode, entered.subId);
            if (typeof window.showRoomLeaveBar === 'function') window.showRoomLeaveBar(entered.roomName || '', getDB(), entered.groupCode, 'sub', entered.subId);
            setDcEnteredRoomId(entered.subId);
            setDcEnteredRoomKey(`${entered.groupCode}|sub|${entered.subId}`);
        } catch (e) { console.warn('[FocusAI] çalışma odası presence geri kurulamadı', e); }
    }, 300);
})();

(function _dcRestoreLastOpenOnLoad() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(DC_LAST_OPEN_KEY) || 'null', window._safeJsonReviver); } catch (_) { console.warn('[FocusAI] sessiz hata:', _); }
    if (!saved || !saved.fn) return;
    // Yalnızca sosyal bölümde yenilendiyse geri aç — başka sekmede
    // arka planda sohbet kurmanın anlamı yok.
    try {
        const lastTab = (typeof FocusStorage !== 'undefined') ? FocusStorage.get('lastActiveTab', 'bugun') : 'bugun';
        if (lastTab !== 'arkadaslar') return;
    } catch (_) { return; }

    // Restorasyon tamamlanana kadar otomatik görünüm değişikliklerini
    // (ör. dcOpenGroupPanel) engelle — "önce grup paneli, sonra sohbet"
    // zıplaması yaşanmasın.
    setDcRestorePending(true);
    // Restore tamamlandıktan sonra da kilidi bir süre tut: initDcArchitecture
    // (DOMContentLoaded+1200ms) gibi geç çalışan açılış kodları geri yüklenen
    // sohbeti ezmesin. 5 sn sonra normal davranışa dönülür.
    const finish = (opened) => {
        setTimeout(() => { setDcRestorePending(false); }, 5000);
        // Restore sohbet açmadan bittiyse geçici iskelet görünümünden
        // normal varsayılan görünüme (Arena/home) geri dön.
        if (!opened && !getActiveChatTarget()) {
            const emptyEl = document.getElementById('dc-chat-empty-state');
            if (emptyEl) emptyEl.style.display = 'flex';
            if (typeof window.dcSetMainView === 'function') window.dcSetMainView('home', { force: true });
        }
    };

    // Görsel zıplamayı önle: sohbet geri yüklenene kadar varsayılan açılış
    // görünümü (Arena/grup içerikleri) yerine sohbet alanında yükleme
    // iskeleti göster — restore bitince kaldığı yerden devam etmiş görünür.
    const _showRestoreSkeleton = () => {
        const area = document.getElementById('dc-chat-area');
        if (area) area.classList.remove('dc-view-home', 'dc-view-group-panel');
        const emptyEl  = document.getElementById('dc-chat-empty-state');
        const streamEl = document.getElementById('sidebar-chat-messages-stream');
        const headerEl = document.getElementById('dc-chat-header');
        if (headerEl) headerEl.style.display = 'none'; // "Kanal" placeholder başlığı görünmesin
        if (emptyEl) emptyEl.style.display = 'none';
        if (streamEl) {
            streamEl.style.display = 'flex';
            try { showDcSkeleton(streamEl); } catch (_) { console.warn('[FocusAI] sessiz hata:', _); }
        }
    };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => { if (getDcRestorePending()) _showRestoreSkeleton(); });
    } else {
        _showRestoreSkeleton();
    }

    let attempts = 0;
    const timer = setInterval(() => {
        attempts++;
        if (attempts > 100) { clearInterval(timer); finish(false); return; } // ~20 sn sonra vazgeç
        if (!getCurrentUser()) return;
        if (!dcChatEnabled()) { clearInterval(timer); finish(false); return; }
        // Kullanıcı bu arada kendisi bir sohbet açtıysa karışma
        if (getActiveChatTarget()) { clearInterval(timer); finish(true); return; }
        // Kullanıcı bu arada "Gruplarım"dan bir gruba tıklayıp Genel Bakış panelini
        // açtıysa da karışma — aksi halde restore, kullanıcı zaten bir grubun Genel
        // Bakış'ını açmışken üstüne son kalınan #genel sohbetini zorla açıyordu.
        if (document.getElementById('dc-chat-area')?.classList.contains('dc-view-group-panel')) {
            clearInterval(timer); finish(true); return;
        }

        if (saved.fn === 'dm') {
            clearInterval(timer);
            try { openDcDmRoom(saved.username, saved.name || saved.username); finish(true); }
            catch (e) { console.warn('[FocusAI] son DM geri açılamadı', e); finish(false); }
            return;
        }
        if (saved.fn === 'group') {
            const cache = (typeof window.getMyGroupsDataCache === 'function') ? window.getMyGroupsDataCache() : {};
            const gd = cache[saved.code];
            if (!gd) return; // grup cache'i dolana kadar bekle
            clearInterval(timer);
            try {
                openDcGroupChannelSupabase(saved.code, gd, saved.scope, saved.label || '# genel');
                _dcRestoreEnteredRoomIfNeeded(saved);
                finish(true);
            }
            catch (e) { console.warn('[FocusAI] son grup sohbeti geri açılamadı', e); finish(false); }
            return;
        }
        // Kullanıcı yenileme öncesi bir grubun panelinde (Genel Bakış / Sınıf
        // Paneli / Takvim / Geçmiş vb.) idiyse, sohbet yerine doğrudan aynı
        // grup panelini + aynı sekmeyi geri aç (bkz. showGroupDetails'teki
        // _persistGroupPanelTab ve renderClassroomTab'teki alt sekme kaydı).
        if (saved.fn === 'group-panel') {
            const cache = (typeof window.getMyGroupsDataCache === 'function') ? window.getMyGroupsDataCache() : {};
            if (!cache[saved.code]) return; // grup cache'i dolana kadar bekle
            clearInterval(timer);
            try {
                if (saved.gtab === 'classroom') setPendingClassroomSubtab(saved.subtab || null);
                // showGroupDetails artık _pendingGroupPanelGtab'ı okuyup paneli EN
                // BAŞTAN doğru sekmeyle (Genel Bakış'a hiç uğramadan, programatik
                // tıklama beklemeden) render ediyor — bu yüzden görünür bir sekme
                // geçişi/titreme (flash) hiç oluşmuyor, ayrı bir "sekmeyi bul ve
                // tıkla" bekleme döngüsüne de gerek kalmıyor.
                window._pendingGroupPanelGtab = saved.gtab || null;
                // Kilidi (_dcRestorePending) BIRAKMADAN paneli aç — kilit erken
                // bırakılınca geç çalışan açılış kodları (initDcArchitecture,
                // switchTab'ın Arena varsayılanı) restore edilen paneli ezip
                // kullanıcıyı Arena'ya fırlatabiliyordu. dcOpenGroupPanel'in
                // "otomatik çağrı" koruması bu meşru çağrı için bayrakla atlanır.
                window._dcRestoreInvoking = true;
                try { window.dcOpenGroupPanel(saved.code); } finally { window._dcRestoreInvoking = false; }
                finish(true);
            }
            catch (e) { console.warn('[FocusAI] son grup paneli geri açılamadı', e); finish(false); }
        }
    }, 200);
})();

// Sayfa yenilenmeden önce bir "çalışma odası"na (group_subchannel, çift
// tıkla girilen presence odası) girilmişse, sohbeti restore ettikten sonra
// presence'ı da geri kurup "Odadasın" çubuğunu tekrar gösterir — aksi
// halde yenileme kullanıcıyı sessizce odadan çıkarmış gibi davranıyordu.
function _dcRestoreEnteredRoomIfNeeded(saved) {
    let entered = null;
    try { entered = JSON.parse(localStorage.getItem(DC_ENTERED_ROOM_KEY) || 'null', window._safeJsonReviver); } catch (_) { console.warn('[FocusAI] sessiz hata:', _); }
    if (!entered || !entered.subId) return;
    if (entered.groupCode !== saved.code || entered.subId !== saved.scope?.id) return;
    const roomKey = `${entered.groupCode}|sub|${entered.subId}`;
    startRoomPresenceSupabase(entered.groupCode, entered.subId);
    if (typeof window.showRoomLeaveBar === 'function') window.showRoomLeaveBar(entered.roomName || '', getDB(), entered.groupCode, 'sub', entered.subId);
    setDcEnteredRoomId(entered.subId);
    setDcEnteredRoomKey(roomKey);
}

// 🛡️ Duyuru Kanalı Kontrolü ve Mesaj Alanını Kilitleme Fonksiyonu
window.updateChatInputStatus = updateChatInputStatus; // social-dc-room-lifecycle.js için
export function updateChatInputStatus() {
    const chatInputArea = document.querySelector('.dc-chat-input-area') || document.querySelector('.chat-input-row') || document.getElementById('dc-chat-form');
    if (!chatInputArea) return;

    // Duyuru kanalında sadece admin ve teacher yazabilir
    const _instRole = (window.currentUser?.institutionRole) || 'member';
    const _groupRole = window._focusCurrentGroupRole || 'member';
    const _canWriteAnnouncement = _groupRole === 'admin' || _groupRole === 'moderator' || _instRole === 'teacher' || _instRole === 'admin';
    const _isAnnouncement = (typeof window.__getCurrentChannelIsAnnouncement === 'function') ? window.__getCurrentChannelIsAnnouncement() : false;
    if (_isAnnouncement && !_canWriteAnnouncement) {
        if (!document.getElementById('chat-locked-notice')) {
            // Input alanlarını ve butonları gizle
            const elements = chatInputArea.querySelectorAll('input, textarea, button, .dc-chat-attachments');
            elements.forEach(el => el.style.display = 'none');

            // Kilitli mesaj kutusunu ekle
            const lockDiv = document.createElement('div');
            lockDiv.id = 'chat-locked-notice';
            lockDiv.className = 'chat-locked-container';
            lockDiv.innerHTML = '<i class="fa-solid fa-lock"></i> Bu bir duyuru kanalıdır. Sadece Yöneticiler mesaj yazabilir.';
            chatInputArea.appendChild(lockDiv);
        }
    } else {
        // Kilidi kaldır ve her şeyi eski haline getir
        const lockNotice = document.getElementById('chat-locked-notice');
        if (lockNotice) lockNotice.remove();
        const elements = chatInputArea.querySelectorAll('input, textarea, button, .dc-chat-attachments');
        elements.forEach(el => el.style.display = '');
    }
}
