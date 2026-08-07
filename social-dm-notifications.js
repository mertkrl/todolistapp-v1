import { _resolveProfileById, _normalizeSupabaseGroupMessage } from './social-dc-profile-resolve.js';
import {
    renderNotificationsPanel, openNotificationsPanel,
    __getPendingDmRequestsSupabaseRef, __getDmRequestsInitialLoadDoneSupabaseRef, __setDmRequestsInitialLoadDoneSupabaseRef
} from './social-friends-notifications.js';
import {
    isChatPinned, toggleChatPinned, isChatMuted, toggleChatMuted,
    loadDismissedRecentConvos, removeRecentConvo
} from './social-chat-list-actions.js';
import { getCurrentUser } from './state/current-user-store.js';
import { getActiveChatTarget, setActiveChatTarget } from './state/active-chat-target-store.js';
import { setLastAvatarClick } from './state/last-avatar-click-store.js';
import { getDcState } from './state/dc-state-store.js';
import { getDcEnteredRoomKey } from './state/dc-entered-room-key-store.js';
import { showGenericNotifToast } from './social-dm-notifications-toasts.js';
export { showGenericNotifToast };
import { showRecentConvoContextMenu } from './social-dm-notifications-context-menu.js';
// social-dm-notifications.js
// social.js'ten çıkarıldı (Faz E, 2026-07-23): DM/grup sohbet mesajı geldiğinde
// toast/ses tetikleyici mantığı + "TEK KAYNAK" okunmamış mesaj rozet motoru
// ("Son Mesajlaşmalar" listesi + DM/grup/çalışma-odası okunmamış sayaçları).
// Kaynakta showRoleChangeToast/showGenericNotifToast fiziksel olarak bu bloğun
// içinde duruyordu ama genel amaçlı toast yardımcıları — social.js'in başka
// bölgelerinden (örn. grup hedefi kutlaması) de kullanılıyor, bilinçli olarak
// burada bırakıldı ve window.* ile köprülendi.
//
// Dış bağımlılıklar (social.js'in geri kalanından, window.* üzerinden):
// getCurrentUser(), window.avatarImgHtml, window.timeAgo, window._escapeHtml,
// window._resolveProfileById, window.dcChatEnabled, window.playNotificationSound,
// window.maybeShowDesktopNotification, window.showChatNotificationToast,
// window.openDcDmRoom, window.openDcChatRoom, window.showGuildPanel.
// Paylaşılan state: window._dcGetBlockedByOthers/_dcSetBlockedByOthers
// (getter+setter, social-friends-notifications.js ile çift yönlü).
// ──────────────────────────────────────────────────────
    // SOHBET MESAJI BİLDİRİMLERİ (Grup + Özel Mesaj)
    // ──────────────────────────────────────────────────────
    let _chatNotifRefs = [];

    // Şu an açık olan sohbeti takip eder — açık sohbete gelen mesaj için bildirim/ses tekrarlanmaz
    setActiveChatTarget(null);

    function isChatContextActive(ctx) {
        const active = getActiveChatTarget();
        if (!active) return false;
        if (ctx.type === 'dm') {
            return active.type === 'dm' && active.username === ctx.username;
        }
        if (active.type !== 'group' || active.code !== ctx.code) return false;
        // chatPath, 'genel'/'general' gibi takma adlardan bağımsız tek doğru
        // kıyaslamadır — ikisi de mevcutsa onunla karşılaştır.
        if (active.chatPath && ctx.chatPath) return active.chatPath === ctx.chatPath;
        return active.roomId === ctx.roomId
            && (active.channelId || null) === (ctx.channelId || null);
    }

    async function handleIncomingChatMessage(m, ctx) {
        if (!m || !getCurrentUser()) return;

        // Çalışma odası şu anda girilmiş durumdaysa, gönderen kim olursa olsun
        // (kendi mesajımız dahil) "Son Mesajlaşmalar"daki önizlemeyi güncelle
        if (ctx.isWorkRoom && ctx.chatPath) {
            const roomKey = `${ctx.code}|${ctx.channelId}|${ctx.roomId}`;
            if (getDcEnteredRoomKey() === roomKey) {
                updateWorkRoomRecentConvo(m, ctx);
            }
        }

        if (m.username === getCurrentUser().username) return; // kendi mesajımız
        // Engellenen kullanıcılardan gelen DM'ler için bildirim/ses gösterme
        if (ctx.type === 'dm' && typeof window.isBlockedEitherWay === 'function' && window.isBlockedEitherWay(ctx.username)) return;
        if (ctx.type === 'group' && typeof window.isBlockedEitherWay === 'function' && window.isBlockedEitherWay(m.username)) return;
        const isMentioned = ctx.type === 'group' && Array.isArray(m.mentions) && m.mentions.includes(getCurrentUser().username);
        if (!isMentioned) {
            // Çalışma odalarındaki mesajlar — kullanıcı o odaya girmemişse bildirim gösterme
            if (ctx.isWorkRoom) {
                const roomKey = `${ctx.code}|${ctx.channelId}|${ctx.roomId}`;
                if (getDcEnteredRoomKey() !== roomKey) return;
            }
            if (localStorage.getItem('focusai_chat_notif_sound') === 'false') return;
            // Sessize alınmış DM'ler için bildirim/ses gösterme
            if (ctx.type === 'dm' && typeof window.isChatMuted === 'function' && isChatMuted(ctx.username)) return;
            // Sessize alınmış grup kanalları için bildirim/ses gösterme
            if (ctx.type === 'group' && ctx.chatPath && typeof window.isChatMuted === 'function' && isChatMuted(ctx.chatPath)) return;

            // Bu sohbet zaten açıksa VE sekme/pencere görünürdeyse, kullanıcı mesajı
            // canlı görüyor — ses/bildirim/toast gösterme. Fakat sohbet açık olsa da
            // sekme/pencere arka plana alınmışsa (küçültülmüşse) bildirim göstermeye
            // devam et — aksi halde kullanıcı odadaki yeni mesajdan haberdar olmaz.
            if (isChatContextActive(ctx) && !document.hidden) return;
        }

        window.playNotificationSound(isMentioned ? 'alert' : 'message');

        const senderName = m.displayName || m.username || 'Bir kullanıcı';
        const title = isMentioned
            ? `🔔 ${senderName} seni etiketledi`
            : ctx.type === 'dm'
                ? `💬 ${senderName}`
                : `# ${ctx.roomId === 'general' ? 'genel' : ctx.roomId} • ${ctx.groupName || ctx.code}`;

        let msgText = m.text || '';
        if (ctx.type === 'dm' && m.enc) {
            const plain = await window.decryptDmText(ctx.username, m.enc);
            if (plain !== null) msgText = plain;
        }

        const body = ctx.type === 'dm'
            ? msgText
            : `${senderName}: ${msgText}`;

        const avatarHtml = window.avatarImgHtml({ displayName: senderName, avatarColor: m.avatarColor, username: m.username, customAvatar: m.customAvatar }, 36);

        const toastKey = ctx.type === 'dm'
            ? `dm:${ctx.username}`
            : `group:${ctx.code}:${ctx.roomId}:${ctx.channelId || ''}`;

        window.showChatNotificationToast({
            key: toastKey, avatarHtml, title, body,
            onClick: () => {
                if (ctx.type === 'dm') {
                    if (typeof window.openDcDmRoom === 'function') window.openDcDmRoom(ctx.username, senderName);
                } else if (typeof window.openDcChatRoom === 'function') {
                    window.openDcChatRoom(ctx.code, ctx.roomId, ctx.roomId, ctx.channelId || null);
                }
            }
        });

        window.maybeShowDesktopNotification(title, body);
    }

    export function setupChatMessageNotifications() {
        // Supabase mesaj bildirimleri setupRecentConversationsSupabase içinde yönetiliyor
    }

    // ──────────────────────────────────────────────────────
    // SON MESAJLAŞMALAR + OKUNMAMIŞ MESAJ ROZETLERİ
    // ──────────────────────────────────────────────────────
    let _recentConvos    = {}; // username -> { username, displayName, avatarColor, customAvatar, text, fromMe, lastTimestamp }
    export const _dcGetRecentConvo = (key) => _recentConvos[key];
    let _recentConvoRefs = [];
    // Çevrimiçi listesinde avatara art arda tıklanırsa (çift tık) sohbeti aç
    // (social-online-friends.js ile paylaşılıyor, bu yüzden window üzerinde)
    setLastAvatarClick({ username: null, time: 0 });
    let _friendInfoCache = {};

    function loadDmLastRead() {
        try { return JSON.parse(localStorage.getItem('focusai_dm_last_read') || '{}', window._safeJsonReviver); }
        catch { return {}; }
    }
    function saveDmLastRead(map) {
        localStorage.setItem('focusai_dm_last_read', JSON.stringify(map));
    }
    let _dmLastRead = loadDmLastRead();

    // Bir kullanıcıyla olan DM'yi "okundu" olarak işaretle (sohbeti açtığında çağrılır).
    // floorTs: en az bu zaman damgasına kadar okundu say — cihaz saati sunucudan
    // geride kalsa bile son mesaj "okunmamış" olarak geri gelmesin diye
    // sohbetteki son mesajın zamanı da hesaba katılır.
    export function markDmRead(username, floorTs) {
        const convoTs = (_recentConvos[username] && _recentConvos[username].lastTimestamp) || 0;
        // Date.now() burada MAX'a dahil edilmiyordu diye eskiden dahil edilmişti, ama cihaz
        // saati sunucudan (biraz) ileride olduğunda, hemen ardından gelen gerçek bir mesajın
        // sunucu zaman damgası bu "gelecekteki" client now'ı hiçbir zaman geçemiyor ve o mesaj
        // sonsuza dek "okunmuş" görünüyordu. Sadece bilinen mesaj zaman damgalarını kullan;
        // hiçbiri yoksa (boş sohbet) now'a düş.
        _dmLastRead[username] = Math.max(convoTs, floorTs || 0) || Date.now();
        saveDmLastRead(_dmLastRead);
        // Tam liste yenilemesi yerine sadece bu kişinin rozetini güncelle —
        // tam yenileme avatar görsellerini yeniden oluşturup titremeye sebep oluyordu
        updateRecentConvoUnread(username);
        updateContactUnreadDot(username);
        updateOnlineFriendUnreadDot(username);
        if (window.FocusSupabase && getCurrentUser()?.id) {
            const conv = _recentConvos[username];
            if (conv && conv.conversationId) registerDmUnreadTracking(username, conv.conversationId);
        } else if (db && getCurrentUser()) {
        }
    }

    // Bir kullanıcıyla olan son "okundu" zaman damgasını döndürür (sohbet açılırken
    // "Yeni mesajlar" ayıracının nereye konacağını belirlemek için kullanılır)
    export function getDmLastRead(username) {
        return _dmLastRead[username] || 0;
    }

    // Grup/kanal sohbetleri için "son okuma" zamanı (okunmamış ayıracı için, yerel)
    function loadGroupLastRead() {
        try { return JSON.parse(localStorage.getItem('focusai_group_last_read') || '{}', window._safeJsonReviver); }
        catch { return {}; }
    }
    function saveGroupLastRead(map) {
        localStorage.setItem('focusai_group_last_read', JSON.stringify(map));
    }
    let _groupLastRead = loadGroupLastRead();
    function getGroupLastRead(chatPath) {
        return _groupLastRead[chatPath] || 0;
    }
    export function markGroupRead(chatPath) {
        _groupLastRead[chatPath] = Date.now();
        saveGroupLastRead(_groupLastRead);
        // "Son Mesajlaşmalar" listesindeki bu kanalın okunmamış rozetini de güncelle
        if (_recentConvos[chatPath]) {
            _recentConvos[chatPath].unread = false;
            _recentConvos[chatPath].unreadCount = 0;
            if (typeof renderRecentConversations === 'function') renderRecentConversations();
            if (typeof window.renderFloatingChatBadge === 'function') window.renderFloatingChatBadge();
        }
    }
    // Farklı (kardeş) IIFE kapsamındaki Supabase grup sohbeti kodu için global erişim
    window.markGroupRead = markGroupRead;

    // loadJsonList/saveJsonList burada kalıyor (Engelle özelliği gibi başka
    // yerlerde de kullanılıyor) — social-chat-list-actions.js gibi ayrılan
    // modüllerin erişebilmesi için köprülendi.
    export function loadJsonList(key) {
        try { return JSON.parse(localStorage.getItem(key) || '[]', window._safeJsonReviver); }
        catch { return []; }
    }
    export function saveJsonList(key, list) {
        localStorage.setItem(key, JSON.stringify(list));
    }

    // ─── SABİTLE / SESSİZE AL / SON MESAJLAŞMALARDAN KALDIR —
    // social-chat-list-actions.js dosyasına taşındı (Faz 2, 2026-07-19).
    // window.isChatPinned/toggleChatPinned/isChatMuted/toggleChatMuted/
    // removeRecentConvo üzerinden erişiliyor.

    // ─── ENGELLE — social-block-users.js dosyasına taşındı (Faz 2,
    // 2026-07-19). window.isUserBlocked/isBlockedEitherWay/
    // toggleUserBlocked/isBlockedByUser/refreshBlockSensitiveUI/
    // updateDcBlockedBanner/renderBlockedUsersSettings üzerinden erişiliyor.

    // Beni engelleyen kullanıcıların listesi — social-friends-notifications.js'teki
    // _startBlocksListenerSupabase() dinleyicisi tarafından canlı tutulur (2026-07-23:
    // o dosyada bare referans olarak bırakılmıştı, setter köprüsü eklendi).
    let _blockedByOthers = new Set();
    export const _dcGetBlockedByOthers = () => _blockedByOthers;
    export const _dcSetBlockedByOthers = (v) => { _blockedByOthers = v; };


    export function hasUnreadDm(username) {
        const c = _recentConvos[username];
        if (!c || !c.lastTimestamp || c.fromMe) return false;
        return c.lastTimestamp > (_dmLastRead[username] || 0);
    }
    window.hasUnreadDm = hasUnreadDm;

    // Listeyi tamamen yeniden çizmeden, tek bir kişinin "okunmamış mesaj" rozetini
    // güncelle — tam liste yenilemesi diğer kartların/profillerin titremesine sebep oluyordu
    function updateContactUnreadDot(username) {
        const card = document.getElementById(`sb-contact-${username}`);
        if (!card) return;
        const avatar = card.querySelector('.sb-contact-avatar');
        if (!avatar) return;
        // Dot'u avatar'dan kaldır (eski yerleşim), kart sağına taşı
        const oldDot = avatar.querySelector('.dc-unread-dot');
        if (oldDot) oldDot.remove();
        let pill = card.querySelector('.dc-unread-pill');
        if (hasUnreadDm(username)) {
            if (!pill) {
                pill = document.createElement('span');
                pill.className = 'dc-unread-pill';
                card.appendChild(pill);
            }
        } else if (pill) {
            pill.remove();
        }
    }

    function updateOnlineFriendUnreadDot(username) {
        const listEl = document.getElementById('online-friends-list');
        if (!listEl) return;
        const zone = listEl.querySelector(`.sb-friend-avatar-zone[data-username="${username}"]`);
        if (!zone) return;
        let dot = zone.querySelector('.dc-unread-dot');
        if (hasUnreadDm(username)) {
            if (!dot) {
                dot = document.createElement('span');
                dot.className = 'dc-unread-dot';
                zone.appendChild(dot);
            }
        } else if (dot) {
            dot.remove();
        }
    }

    function getFriendInfo(username) {
        if (_friendInfoCache[username]) return Promise.resolve(_friendInfoCache[username]);
        if (!window.FocusSupabase) return Promise.resolve({});
        return window.FocusSupabase.from('profiles').select('username, display_name, avatar_color, custom_avatar, avatar_initials').eq('username', username).maybeSingle().then(({ data }) => {
            const u = data ? { displayName: data.display_name, avatarColor: data.avatar_color, customAvatar: data.custom_avatar, avatarInitials: data.avatar_initials || null } : {};
            _friendInfoCache[username] = u;
            return u;
        });
    }

    // ─── YÜZEN SOHBET BUTONUNDA OKUNMAMIŞ MESAJ SAYACI ──────────
    // Not: Önceden her DM konuşması için ayrı "count" sorgusu + ayrı realtime
    // kanalı açılıyordu (N konuşma = N sorgu + N kanal). Artık tek bir toplu
    // sorgu ve tek bir realtime kanal üzerinden hesaplanıyor.
    let _unreadCounts    = {};
    let _dmConvoIdByUsername = {};
    let _unreadAggregateChannel = null;
    let _unreadAggregateRefreshTimer = null;

    function _scheduleUnreadAggregateRefresh() {
        if (_unreadAggregateRefreshTimer) return;
        _unreadAggregateRefreshTimer = setTimeout(() => {
            _unreadAggregateRefreshTimer = null;
            refreshAllDmUnreadCounts();
        }, 150);
    }

    // Tüm DM'lerin okunmamış mesaj sayısını TEK sorguda hesaplar.
    async function refreshAllDmUnreadCounts() {
        const entries = Object.entries(_dmConvoIdByUsername);
        if (!entries.length || !window.FocusSupabase || !getCurrentUser()?.id) return;
        const idToUsername = {};
        let earliestThreshold = Infinity;
        entries.forEach(([username, conversationId]) => {
            idToUsername[conversationId] = username;
            const threshold = _dmLastRead[username] || 0;
            if (threshold < earliestThreshold) earliestThreshold = threshold;
        });
        const conversationIds = entries.map(([, id]) => id);
        const { data, error } = await window.FocusSupabase
            .from('messages')
            .select('scope_id, created_at')
            .eq('scope_type', 'dm')
            .in('scope_id', conversationIds)
            .neq('sender_id', getCurrentUser().id)
            .gt('created_at', new Date(earliestThreshold === Infinity ? 0 : earliestThreshold).toISOString());
        if (error) { console.error('[DM] okunmamış sayısı hesaplanamadı (toplu sorgu)', error); return; }
        const counts = {};
        (data || []).forEach(row => {
            const username = idToUsername[row.scope_id];
            if (!username) return;
            const threshold = _dmLastRead[username] || 0;
            if (new Date(row.created_at).getTime() > threshold) {
                counts[username] = (counts[username] || 0) + 1;
            }
        });
        entries.forEach(([username]) => { _unreadCounts[username] = counts[username] || 0; });
        window.renderFloatingChatBadge();
        // "Son Mesajlaşmalar" rozetindeki sayı bu toplu sorgudan (_unreadCounts) besleniyor,
        // ama önceden burada yeniden çizim tetiklenmiyordu — mesaj geldiğinde önce (henüz eski
        // sayıyla) tek seferlik bir render zaten oluyordu (_refreshDmConvoEntry), bu debounce'lu
        // sorgu bittiğinde ise ekran hiç güncellenmiyordu. Sonuç: art arda gelen 2. mesajda pill
        // "1" yazıp kalıyordu. Artık gerçek sayı hesaplanır hesaplanmaz liste de tazeleniyor.
        if (typeof renderRecentConversations === 'function') renderRecentConversations();
        entries.forEach(([username]) => {
            if (typeof updateContactUnreadDot === 'function') updateContactUnreadDot(username);
            if (typeof updateOnlineFriendUnreadDot === 'function') updateOnlineFriendUnreadDot(username);
        });
    }

    // Sekmeler arası geçişte veya tarayıcı sekmesi arka plandan öne gelince
    // çağrılır — arka planda kaçırılmış olabilecek bir realtime olayını telafi
    // etmek için tüm DM konuşmalarını ve okunmamış sayılarını Supabase'den
    // baştan çeker. Realtime kanalları teoride arka planda da açık kalıyor,
    // ama tarayıcı sekme arka plandayken WebSocket olaylarını erteleyebiliyor —
    // bu yüzden geri dönüşte tazeleme "hard reset" ihtiyacını ortadan kaldırır.
    let _dmResyncInFlight = false;
    export async function resyncRecentConversationsAndUnread() {
        if (_dmResyncInFlight || !window.FocusSupabase || !getCurrentUser()?.id) return;
        _dmResyncInFlight = true;
        try {
            const { data: conversations, error } = await window.FocusSupabase
                .from('conversations')
                .select('*')
                .or(`user_a.eq.${getCurrentUser().id},user_b.eq.${getCurrentUser().id}`);
            if (!error) {
                await Promise.all((conversations || []).map(c => _refreshDmConvoEntry(c)));
            }
            await refreshAllDmUnreadCounts();
        } finally {
            _dmResyncInFlight = false;
        }
    }
    window.resyncRecentConversationsAndUnread = resyncRecentConversationsAndUnread;

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) resyncRecentConversationsAndUnread();
    });

    function _ensureUnreadAggregateChannel() {
        if (_unreadAggregateChannel || !window.FocusSupabase) return;
        _unreadAggregateChannel = window.FocusSupabase
            .channel('dm-unread-aggregate')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: 'scope_type=eq.dm' }, () => {
                _scheduleUnreadAggregateRefresh();
            })
            .subscribe();
    }

    // Bir DM konuşmasını okunmamış-sayacı takibine ekler/günceller ve toplu
    // sorguyu (debounce ile) tetikler — eskiden burada her konuşma için ayrı
    // ayrı attachUnreadCountListenerSupabase(username, conversationId) çağrılırdı.
    function registerDmUnreadTracking(username, conversationId) {
        if (!username || !conversationId) return;
        _dmConvoIdByUsername[username] = conversationId;
        _ensureUnreadAggregateChannel();
        _scheduleUnreadAggregateRefresh();
    }

    // Tüm sohbetlerdeki toplam okunmamış mesaj sayısını yüzen sohbet
    // butonunun rozetinde gösterir (9'dan sonrası "9+" olarak yazılır)
    // TEK KAYNAK: DM + grup okunmamış mesaj toplamları. Tüm rozetler buradan beslenir.
    export function dcUnreadTotals() {
        const dmTotal = Object.values(_unreadCounts).reduce((a, b) => a + b, 0);
        const groupTotal = Object.values(_recentConvos)
            .filter(c => (c.type === 'group' || c.type === 'workroom') && c.unread)
            .reduce((a, c) => a + (c.unreadCount || 1), 0);
        return { dmTotal, groupTotal, total: dmTotal + groupTotal };
    }
    window.dcUnreadTotals = dcUnreadTotals;

    function _renderFloatingChatBadgeImpl() {
        const badge = document.getElementById('floating-chat-unread-badge');
        if (!badge) return;
        // Sayı sadece DM'ler için; grup hareketliliği sessiz nokta olarak görünür.
        const { dmTotal, groupTotal } = dcUnreadTotals();
        if (dmTotal > 0) {
            badge.textContent = dmTotal > 9 ? '9+' : String(dmTotal);
            badge.classList.remove('is-dot');
            badge.style.display = 'flex';
        } else if (groupTotal > 0) {
            badge.textContent = '';
            badge.classList.add('is-dot');
            badge.style.display = 'flex';
        } else {
            badge.classList.remove('is-dot');
            badge.style.display = 'none';
        }
    }
    window.renderFloatingChatBadge = _renderFloatingChatBadgeImpl;

    // Tüm arkadaşların DM'lerindeki son mesajı dinler — "Son Mesajlaşmalar" listesini ve
    // okunmamış mesaj rozetlerini besler
    export function setupRecentConversations() {
        setupRecentConversationsSupabase();
    }

    // ─── M2b-1 #6: "SON MESAJLAŞMALAR" + DM İSTEKLERİ (SUPABASE) ──────────
    // Firebase direct_messages/dm_requests yerine conversations+messages
    // tablolarından besler. Okunmamış mesaj takibi (_dmLastRead, localStorage)
    // ve _recentConvos/_unreadCounts paylaşılan yapıları AYNEN korunur —
    // sadece veri kaynağı değişir, hasUnreadDm/renderFloatingChatBadge/
    // renderRecentConversations dokunulmadan kullanılabilir.
    let _recentConvoSupaChannels = [];
    let _recentConvoChannelSeq = 0;

    function teardownRecentConvoSupabase() {
        _recentConvoSupaChannels.forEach(ch => {
            try { window.FocusSupabase.removeChannel(ch); } catch (_) { console.warn('[FocusAI] sessiz hata:', _); }
        });
        _recentConvoSupaChannels = [];
    }

    // Tek bir konuşma satırından _recentConvos / __getPendingDmRequestsSupabaseRef()
    // girişini günceller (son mesajı çekip önizleme metnini hesaplar).
    async function _refreshDmConvoEntry(conversation) {
        const otherId = conversation.user_a === getCurrentUser().id ? conversation.user_b : conversation.user_a;
        const otherProfile = await _resolveProfileById(otherId);
        if (!otherProfile || !otherProfile.username) return;
        const otherUsername = otherProfile.username;

        if (typeof window.isBlockedEitherWay === 'function' && window.isBlockedEitherWay(otherUsername)) {
            delete _recentConvos[otherUsername];
            delete __getPendingDmRequestsSupabaseRef()[otherUsername];
            renderRecentConversations();
            renderNotificationsPanel();
            return;
        }

        const { data: rows } = await window.FocusSupabase
            .from('messages')
            .select('*')
            .eq('scope_type', 'dm')
            .eq('scope_id', conversation.id)
            .order('created_at', { ascending: false })
            .limit(1);
        const lastMsg = rows && rows[0];

        if (!lastMsg) {
            delete _recentConvos[otherUsername];
            delete __getPendingDmRequestsSupabaseRef()[otherUsername];
            renderRecentConversations();
            renderNotificationsPanel();
            return;
        }

        const lastTimestamp = new Date(lastMsg.created_at).getTime();

        // İlk yüklemede mevcut son mesajı "okundu" kabul et — sadece bundan
        // sonra gelenler okunmamış olarak işaretlensin
        if (_dmLastRead[otherUsername] === undefined) {
            _dmLastRead[otherUsername] = lastTimestamp;
            saveDmLastRead(_dmLastRead);
        }

        registerDmUnreadTracking(otherUsername, conversation.id);

        let previewText = lastMsg.text || '';
        if (lastMsg.enc) {
            const plain = await window.decryptDmText(otherUsername, lastMsg.enc);
            if (plain !== null) previewText = plain;
        }

        _recentConvos[otherUsername] = {
            type: 'dm',
            key: otherUsername,
            username: otherUsername,
            displayName: otherProfile.display_name || otherUsername,
            avatarColor: otherProfile.avatar_color,
            customAvatar: otherProfile.custom_avatar, avatarInitials: otherProfile.avatar_initials || null,
            text: previewText,
            fromMe: lastMsg.sender_id === getCurrentUser().id,
            lastTimestamp,
            conversationId: conversation.id
        };

        // Bu DM şu an açıksa gelen mesaj zaten görülüyor demektir — listede
        // "okunmamış" rozeti göstermeden okundu olarak işaretle
        if (getActiveChatTarget()?.type === 'dm' && getActiveChatTarget().username === otherUsername
            && lastMsg.sender_id !== getCurrentUser().id && typeof markDmRead === 'function') {
            markDmRead(otherUsername, lastTimestamp);
        }

        // Bana gönderilmiş ve henüz kabul edilmemiş mesaj istekleri
        // bildirimler panelinde gösterilsin
        if (conversation.status === 'pending' && conversation.requested_by !== getCurrentUser().id) {
            const isNew = !__getPendingDmRequestsSupabaseRef()[otherUsername];
            __getPendingDmRequestsSupabaseRef()[otherUsername] = {
                fromName: otherProfile.display_name || otherUsername,
                fromColor: otherProfile.avatar_color,
                fromCustomAvatar: otherProfile.custom_avatar,
                lastText: previewText,
                timestamp: lastTimestamp,
                conversationId: conversation.id
            };
            if (isNew && __getDmRequestsInitialLoadDoneSupabaseRef()) {
                window.playNotificationSound('alert');
                window.maybeShowDesktopNotification('Yeni Mesaj İsteği', `${otherProfile.display_name || otherUsername} sana mesaj gönderdi.`);
                showGenericNotifToast({
                    icon: 'fa-envelope',
                    accent: '#74b9ff',
                    title: 'Yeni Mesaj İsteği',
                    body: `<b>${window._escapeHtml(otherProfile.display_name || otherUsername)}</b> sana mesaj gönderdi.`,
                    onClick: openNotificationsPanel
                });
            }
        } else {
            delete __getPendingDmRequestsSupabaseRef()[otherUsername];
        }

        renderRecentConversations();
        renderNotificationsPanel();
        updateContactUnreadDot(otherUsername);
        updateOnlineFriendUnreadDot(otherUsername);
    }

    async function setupRecentConversationsSupabase() {
        // Eski Firebase dinleyicilerini/kanallarını temizle
        _recentConvoRefs.forEach(ref => ref.off());
        _recentConvoRefs = [];
        Object.keys(_recentConvos).forEach(key => {
            if (_recentConvos[key].type !== 'group') delete _recentConvos[key];
        });
        if (_unreadAggregateChannel) {
            try { window.FocusSupabase.removeChannel(_unreadAggregateChannel); } catch (_) { console.warn('[FocusAI] sessiz hata:', _); }
            _unreadAggregateChannel = null;
        }
        _dmConvoIdByUsername = {};
        _unreadCounts = {};
        window.renderFloatingChatBadge();
        teardownRecentConvoSupabase();

        const { data: conversations, error } = await window.FocusSupabase
            .from('conversations')
            .select('*')
            .or(`user_a.eq.${getCurrentUser().id},user_b.eq.${getCurrentUser().id}`);
        if (error) { console.error('[Son Mesajlaşmalar] conversations okunamadı', error); return; }

        await Promise.all((conversations || []).map(_refreshDmConvoEntry));
        __setDmRequestsInitialLoadDoneSupabaseRef(true);

        if (!(conversations || []).length) { renderRecentConversations(); renderNotificationsPanel(); }

        const refreshAll = () => {
            window.FocusSupabase
                .from('conversations')
                .select('*')
                .or(`user_a.eq.${getCurrentUser().id},user_b.eq.${getCurrentUser().id}`)
                .then(({ data }) => (data || []).forEach(c => _refreshDmConvoEntry(c)));
        };

        // Kanal adına benzersiz bir sayaç ekliyoruz: setupRecentConversationsSupabase
        // arka arkaya birden çok kez çağrılabiliyor (örn. arkadaş listesi değişince),
        // ve removeChannel() asenkron tamamlanmadan aynı isimli kanal yeniden
        // oluşturulunca "cannot add postgres_changes callbacks after subscribe()" hatası oluyordu.
        _recentConvoChannelSeq = (_recentConvoChannelSeq || 0) + 1;
        const channelSuffix = `${getCurrentUser().id}-${_recentConvoChannelSeq}`;
        const msgChannel = window.FocusSupabase
            .channel(`recent-dm-messages-${channelSuffix}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: 'scope_type=eq.dm' }, refreshAll)
            .subscribe();
        const convoChannel = window.FocusSupabase
            .channel(`recent-dm-conversations-${channelSuffix}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, refreshAll)
            .subscribe();
        _recentConvoSupaChannels = [msgChannel, convoChannel];
    }

    // ─── M2d: ÜYE OLUNAN SUPABASE GRUPLARININ "#genel" KANALI DA
    // "SON MESAJLAŞMALAR"A VE OKUNMAMIŞ ROZETİNE DÜŞSÜN ──────────
    let _groupConvoSupaChannels = [];
    let _groupConvoSupaSeq = 0;

    function teardownGroupRecentConversationsSupabase() {
        _groupConvoSupaChannels.forEach(ch => { try { window.FocusSupabase.removeChannel(ch); } catch (_) { console.warn('[FocusAI] sessiz hata:', _); } });
        _groupConvoSupaChannels = [];
    }

    export async function setupGroupRecentConversationsSupabase() {
        if (!window.FocusSupabase || !getCurrentUser()?.id) return;
        teardownGroupRecentConversationsSupabase();

        const { data: memberRows, error } = await window.FocusSupabase
            .from('group_members')
            .select('group_id, groups(id, code, name)')
            .eq('user_id', getCurrentUser().id);
        if (error) { console.error('[Grup Son Mesajlaşmalar] group_members okunamadı', error); return; }

        const myGroups = (memberRows || []).map(r => r.groups).filter(Boolean);
        const myGroupIds = new Set(myGroups.map(g => g.id));

        // Artık üye olunmayan Supabase gruplarına ait girişleri temizle
        Object.keys(_recentConvos).forEach(key => {
            const c = _recentConvos[key];
            if (c.type === 'group' && c._supaGroupId && !myGroupIds.has(c._supaGroupId)) {
                delete _recentConvos[key];
            }
        });

        const refreshScopeEntry = async (group, scope, displayName, roomName) => {
            const chatPath = `supabase_group_${scope.type}_${scope.id}`;
            const { data: rows } = await window.FocusSupabase
                .from('messages')
                .select('*')
                .eq('scope_type', scope.type)
                .eq('scope_id', scope.id)
                .order('created_at', { ascending: false })
                .limit(20);
            const lastRow = rows && rows[0];
            if (!lastRow) { delete _recentConvos[chatPath]; renderRecentConversations(); window.renderFloatingChatBadge(); return; }
            const m = await _normalizeSupabaseGroupMessage(lastRow);
            const fromMe = lastRow.sender_id === getCurrentUser().id;
            _recentConvos[chatPath] = {
                type: 'group',
                key: chatPath,
                chatPath,
                groupCode: group.code,
                groupName: group.name,
                roomId: 'general',
                channelId: null,
                roomName,
                displayName,
                fromMe,
                fromName: m.displayName || m.username || '',
                text: m.text || (m.enc ? (m.decryptedText || '') : ''),
                lastTimestamp: m.timestamp || 0,
                unread: !fromMe && (m.timestamp || 0) > getGroupLastRead(chatPath),
                unreadCount: (() => {
                    const lastRead = getGroupLastRead(chatPath);
                    return (rows || []).filter(r =>
                        r.sender_id !== getCurrentUser().id &&
                        new Date(r.created_at).getTime() > lastRead
                    ).length;
                })(),
                _supaGroupId: group.id,
                _supaScope: scope
            };
            renderRecentConversations();
            window.renderFloatingChatBadge();
        };

        // groupId -> group, ve scope_id -> {group, scope, displayName, roomName} eşlemeleri.
        // M2d: sadece #genel (scope_type='group') değil, gruptaki TÜM kategori
        // kanalları (group_channel) ve alt-kanalları (group_subchannel) da
        // "Son Mesajlaşmalar"a/okunmamış rozetine düşsün.
        const scopeEntries = []; // { group, scope, displayName, roomName }
        const groupChannelScopeMap = {};    // channelId -> scopeEntry
        const groupSubchannelScopeMap = {}; // subId -> scopeEntry

        await Promise.all(myGroups.map(async group => {
            scopeEntries.push({ group, scope: { type: 'group', id: group.id }, displayName: `${group.name} • #genel`, roomName: 'genel' });

            const { data: channels } = await window.FocusSupabase
                .from('group_channels')
                .select('id, name')
                .eq('group_id', group.id);
            for (const channel of (channels || [])) {
                const chEntry = {
                    group,
                    scope: { type: 'group_channel', id: channel.id },
                    displayName: `${group.name} • # ${channel.name} › genel`,
                    roomName: `${channel.name} › genel`
                };
                scopeEntries.push(chEntry);
                groupChannelScopeMap[channel.id] = chEntry;

                const { data: subs } = await window.FocusSupabase
                    .from('group_subchannels')
                    .select('id, name')
                    .eq('channel_id', channel.id);
                for (const sub of (subs || [])) {
                    const subEntry = {
                        group,
                        scope: { type: 'group_subchannel', id: sub.id },
                        displayName: `${group.name} • # ${channel.name} › ${sub.name}`,
                        roomName: `${channel.name} › ${sub.name}`
                    };
                    scopeEntries.push(subEntry);
                    groupSubchannelScopeMap[sub.id] = subEntry;
                }
            }
        }));

        await Promise.all(scopeEntries.map(e => refreshScopeEntry(e.group, e.scope, e.displayName, e.roomName)));

        if (!scopeEntries.length) { renderRecentConversations(); window.renderFloatingChatBadge(); }

        _groupConvoSupaSeq = (_groupConvoSupaSeq || 0) + 1;
        const seq = `${getCurrentUser().id}-${_groupConvoSupaSeq}`;
        if (myGroups.length) {
            const channels = [];
            const groupMsgChannel = window.FocusSupabase
                .channel(`recent-group-messages-${seq}`)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: 'scope_type=eq.group' }, payload => {
                    const gid = (payload.new || payload.old || {}).scope_id;
                    const group = myGroups.find(g => g.id === gid);
                    if (group) refreshScopeEntry(group, { type: 'group', id: gid }, `${group.name} • #genel`, 'genel');
                })
                .subscribe();
            channels.push(groupMsgChannel);

            const channelMsgChannel = window.FocusSupabase
                .channel(`recent-group-channel-messages-${seq}`)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: 'scope_type=eq.group_channel' }, payload => {
                    const cid = (payload.new || payload.old || {}).scope_id;
                    const entry = groupChannelScopeMap[cid];
                    if (entry) refreshScopeEntry(entry.group, entry.scope, entry.displayName, entry.roomName);
                })
                .subscribe();
            channels.push(channelMsgChannel);

            const subchannelMsgChannel = window.FocusSupabase
                .channel(`recent-group-subchannel-messages-${seq}`)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: 'scope_type=eq.group_subchannel' }, payload => {
                    const sid = (payload.new || payload.old || {}).scope_id;
                    const entry = groupSubchannelScopeMap[sid];
                    if (entry) refreshScopeEntry(entry.group, entry.scope, entry.displayName, entry.roomName);
                })
                .subscribe();
            channels.push(subchannelMsgChannel);

            _groupConvoSupaChannels = channels;
        }
    }
    window.setupGroupRecentConversationsSupabase = setupGroupRecentConversationsSupabase;

    // ─── ÜYE OLUNAN GRUPLARDAKİ KANAL SOHBETLERİ DE "SON MESAJLAŞMALAR"A DÜŞSÜN ───
    // (Çalışma odaları/alt-kanallar hariç — onlar kanal içinde özel olarak yazılan mesajlar)
    let _myGroupsConvoRef = null;
    let _myGroupsConvoCb  = null;
    let _groupChannelConvoRefs = {}; // chatPath -> ref
    let _groupChannelConvoCbs  = {}; // chatPath -> callback
    let _groupConvoBaselineKey = {}; // chatPath -> dinleyici kurulmadan ÖNCE oradaki son mesajın key'i

    function teardownGroupChannelConvoListeners() {
        Object.keys(_groupChannelConvoRefs).forEach(chatPath => {
            const ref = _groupChannelConvoRefs[chatPath];
            const cb = _groupChannelConvoCbs[chatPath];
            if (ref && typeof ref.off === 'function' && cb) ref.off('value', cb);
        });
        _groupChannelConvoRefs = {};
        _groupChannelConvoCbs  = {};
        _groupConvoBaselineKey = {};
    }

    // Kullanıcının ilgili gruba KATILDIĞI tarihi (groups/{code}/members/{username}/joinedAt)
    // önbellekler — gruba katılmadan önceki mesajlar hiçbir yerde (sohbet ekranı, Son
    // Mesajlaşmalar, bildirimler) gösterilmesin diye kullanılır.
    let _myGroupJoinedAtCache = {};
    function getMyGroupJoinedAt(groupCode) {
        if (_myGroupJoinedAtCache[groupCode] !== undefined) return Promise.resolve(_myGroupJoinedAtCache[groupCode]);
        return Promise.resolve(0);
    }
    // Bir gruba (yeniden) katılınca önbelleği temizle — bir sonraki sorguda taze joinedAt alınsın
    function invalidateMyGroupJoinedAt(groupCode) {
        delete _myGroupJoinedAtCache[groupCode];
    }

    function renderGroupConvoEntry(chatPath, meta, lastMsg) {
            const fromMe = lastMsg.username === getCurrentUser().username;
            _recentConvos[chatPath] = {
                type: 'group',
                key: chatPath,
                chatPath,
                groupCode: meta.groupCode,
                groupName: meta.groupName,
                roomId: meta.roomId,
                channelId: meta.channelId,
                roomName: meta.roomName,
                displayName: `${meta.groupName} • #${meta.roomName}`,
                fromMe,
                fromName: lastMsg.displayName || lastMsg.username || '',
                text: lastMsg.text || (lastMsg.enc ? (lastMsg.decryptedText || '') : ''),
                lastTimestamp: lastMsg.timestamp || 0,
                unread: !fromMe && (lastMsg.timestamp || 0) > getGroupLastRead(chatPath),
                unreadCount: (!fromMe && (lastMsg.timestamp || 0) > getGroupLastRead(chatPath)) ? 1 : 0
            };
            renderRecentConversations();
            window.renderFloatingChatBadge();
    }

    // "Son Mesajlaşmalar"daki bir grup kanalına tıklayınca o gruba/kanala geçer
    function goToGroupChat(groupCode, roomName, roomId, channelId, chatPath) {
        const sidebar = document.getElementById('premium-social-sidebar');
        if (sidebar) sidebar.classList.remove('hidden-sidebar');

        const c = _recentConvos[chatPath];
        const groupName = (c && c.groupName) || roomName || groupCode;

        if (typeof window.showGuildPanel === 'function') window.showGuildPanel(groupCode, groupName);

        // M2d: "Son Mesajlaşmalar"daki bir Supabase kategori/alt-kanal girişine
        // tıklanınca o kanala/alt-kanala gitsin (sadece #genel'e değil).
        if (c && c._supaScope && typeof window.openGroupMentionNotif === 'function') {
            window.openGroupMentionNotif(groupCode, c._supaScope.type, c._supaScope.id, '# ' + (c.roomName || roomName || 'genel'));
        } else if (typeof window.openDcChatRoom === 'function') {
            window.openDcChatRoom(groupCode, roomName || 'genel', roomId || 'general', channelId || null);
        }

        setTimeout(() => {
            document.getElementById('sidebar-chat-message-input')?.focus();
        }, 150);
    }

    // ─── ÇALIŞMA ODASINA ÇİFT TIKLAYIP GİRİLDİKTEN SONRA, ODADAN AYRILANA KADAR
    //     O ODADAKİ YENİ MESAJLAR "SON MESAJLAŞMALAR"A VE ROZETE DÜŞSÜN ───
    let _workRoomConvoRef = null;
    let _workRoomConvoCb  = null;
    let _workRoomConvoKey = null; // şu an dinlenen odanın chatPath'i
    let _workRoomConvoRefreshTimer = null;

    export function teardownWorkRoomConvoListener() {
        if (_workRoomConvoRefreshTimer) {
            clearInterval(_workRoomConvoRefreshTimer);
            _workRoomConvoRefreshTimer = null;
        }
        if (_workRoomConvoRef && _workRoomConvoCb) {
            _workRoomConvoRef.off('value', _workRoomConvoCb);
        }
        _workRoomConvoRef = null;
        _workRoomConvoCb  = null;
        if (_workRoomConvoKey && _recentConvos[_workRoomConvoKey] && _recentConvos[_workRoomConvoKey].type === 'workroom') {
            delete _recentConvos[_workRoomConvoKey];
            renderRecentConversations();
            window.renderFloatingChatBadge();
        }
        _workRoomConvoKey = null;
    }

    // Firebase kaldırıldı — Supabase yolu kendi work-room dinleyicisini kurar
    function _refreshWorkRoomConvoListener() {}

    // Firebase kaldırıldı — Supabase yolu kendi work-room dinleyicisini kurar; bu stub no-op
    function attachWorkRoomConvoListener(groupCode, channelId, subId, channelName, roomName) {}

    // Çalışma odasındayken (girilmiş durumdayken) gelen/gönderilen her mesaj için
    // "Son Mesajlaşmalar" önizlemesini günceller — handleIncomingChatMessage'tan çağrılır
    function updateWorkRoomRecentConvo(m, ctx) {
        if (!m || !ctx || !ctx.chatPath) return;
        const fromMe = m.username === getCurrentUser().username;
        const st = getDcState() || {};
        const isViewingNow = st.groupCode === ctx.code && st.chanId === ctx.channelId && st.roomId === ctx.roomId;
        _recentConvos[ctx.chatPath] = {
            type: 'workroom',
            key: ctx.chatPath,
            chatPath: ctx.chatPath,
            groupCode: ctx.code,
            groupName: ctx.groupName,
            roomId: ctx.roomId,
            channelId: ctx.channelId,
            roomName: ctx.roomName || ctx.roomId,
            displayName: `${ctx.groupName} • #${ctx.roomName || ctx.roomId}`,
            fromMe,
            fromName: m.displayName || m.username || '',
            text: m.text || (m.enc ? (m.decryptedText || '') : ''),
            lastTimestamp: m.timestamp || Date.now(),
            unread: !fromMe && !isViewingNow,
            unreadCount: (!fromMe && !isViewingNow)
                ? ((_recentConvos[ctx.chatPath]?.unreadCount || 0) + 1)
                : 0
        };
        renderRecentConversations();
        window.renderFloatingChatBadge();
    }

    // "Son Mesajlaşmalar" bölümünü en güncel mesajına göre sıralayıp çizer
    export function renderRecentConversations() {
        const container = document.getElementById('sidebar-recent-conversations');
        const header    = document.getElementById('dc-recent-convos-header');
        if (!container) return;

        const dismissedMap = loadDismissedRecentConvos();
        const entries = Object.values(_recentConvos)
            .filter(c => c.lastTimestamp)
            .filter(c => c.type === 'group' || c.type === 'workroom' || !(typeof window.isBlockedEitherWay === 'function' && window.isBlockedEitherWay(c.username)))
            .filter(c => !(dismissedMap[c.key] && c.lastTimestamp <= dismissedMap[c.key]))
            .sort((a, b) => {
                const pinnedA = isChatPinned(a.key) ? 1 : 0;
                const pinnedB = isChatPinned(b.key) ? 1 : 0;
                if (pinnedA !== pinnedB) return pinnedB - pinnedA;
                return b.lastTimestamp - a.lastTimestamp;
            })
            .slice(0, 5);

        if (!entries.length) {
            container.innerHTML = '';
            if (header) header.style.display = 'none';
            return;
        }
        if (header) header.style.display = 'flex';

        const esc = window._escapeHtml;
        container.innerHTML = entries.map(c => {
            const isGroup = c.type === 'group' || c.type === 'workroom';
            const unread = isGroup ? !!c.unread : hasUnreadDm(c.username);
            // Sayılı rozet sadece DM'lerde (doğrudan sana yazılmış). Grup
            // hareketliliği sessiz noktaya iner — "N mesaj kaçırdın, geri dön"
            // baskısı kişisel olana indirgenir (bağımlılık deseni azaltma).
            const unreadCount = isGroup ? 0 : (_unreadCounts[c.username] || 0);
            const pillHtml = unread
                ? (unreadCount > 0
                    ? `<span class="dc-unread-pill has-count">${unreadCount > 9 ? '9+' : unreadCount}</span>`
                    : '<span class="dc-unread-pill"></span>')
                : '';
            const pinned = isChatPinned(c.key);
            const muted  = isChatMuted(c.key);
            const previewPrefix = c.fromMe ? 'Sen: ' : (isGroup ? `${esc(c.fromName || '')}: ` : '');
            const avatarHtml = isGroup
                ? `<div class="dc-recent-convo-avatar dc-recent-convo-avatar--group"><i class="fa-solid ${c.type === 'workroom' ? 'fa-door-open' : 'fa-hashtag'}"></i></div>`
                : `<div class="dc-recent-convo-avatar">${window.avatarImgHtml(c, 36)}</div>`;
            return `
                <div class="dc-recent-convo-item${unread ? ' has-unread' : ''}${pinned ? ' is-pinned' : ''}" data-key="${esc(c.key)}" data-type="${isGroup ? 'group' : 'dm'}" data-username="${esc(c.username || '')}" data-name="${esc(c.displayName)}" data-group-code="${esc(c.groupCode || '')}" data-room-id="${esc(c.roomId || '')}" data-channel-id="${esc(c.channelId || '')}" data-room-name="${esc(c.roomName || '')}">
                    ${avatarHtml}
                    <div class="dc-recent-convo-info">
                        <div class="dc-recent-convo-name">
                            ${pinned ? '<i class="fa-solid fa-thumbtack dc-recent-convo-pin-icon"></i>' : ''}
                            ${esc(c.displayName)}
                            ${muted ? '<i class="fa-solid fa-bell-slash dc-recent-convo-mute-icon"></i>' : ''}
                        </div>
                        <div class="dc-recent-convo-preview">${esc(previewPrefix + c.text)}</div>
                    </div>
                    <div class="dc-recent-convo-meta">
                        <div class="dc-recent-convo-time">${window.timeAgo(c.lastTimestamp)}</div>
                        ${pillHtml}
                    </div>
                </div>`;
        }).join('');

        container.querySelectorAll('.dc-recent-convo-item').forEach(item => {
            item.addEventListener('click', () => {
                if (item.dataset.type === 'group') {
                    goToGroupChat(item.dataset.groupCode, item.dataset.roomName, item.dataset.roomId, item.dataset.channelId || null, item.dataset.key);
                } else {
                    goToDmChat(item.dataset.username, item.dataset.name);
                }
            });
            item.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                showRecentConvoContextMenu(e, item.dataset.username, item.dataset.name, item.dataset.key, item.dataset.type);
            });
        });
    }
    window.renderRecentConversations = renderRecentConversations;

    // showRecentConvoContextMenu → social-dm-notifications-context-menu.js dosyasına
    // çıkarıldı (Faz W, 2026-08-03): sadece zaten import edilmiş social-chat-list-actions.js
    // yardımcılarına ve DOM'a bağlıydı, bu dosyanın paylaşılan state'ine dokunmuyordu.

    // Listeyi yeniden oluşturmadan, tek bir "Son Mesajlaşmalar" satırının
    // okunmamış rozetini günceller (avatarların yeniden yüklenip titremesini önler)
    function updateRecentConvoUnread(username) {
        const container = document.getElementById('sidebar-recent-conversations');
        if (!container) return;
        const item = container.querySelector(`.dc-recent-convo-item[data-username="${username}"]`);
        if (!item) return;

        const unread = hasUnreadDm(username);
        item.classList.toggle('has-unread', unread);

        const avatarZone = item.querySelector('.dc-recent-convo-avatar');
        if (!avatarZone) return;
        let dot = avatarZone.querySelector('.dc-unread-dot');
        if (unread && !dot) {
            dot = document.createElement('span');
            dot.className = 'dc-unread-dot';
            avatarZone.appendChild(dot);
        } else if (!unread && dot) {
            dot.remove();
        }
    }

    // showRoleChangeToast/showGenericNotifToast → social-dm-notifications-toasts.js
    // dosyasına çıkarıldı (Faz W, 2026-08-03): ikisi de sadece DOM + window._escapeHtml/
    // ensureHushedNotifQueue'ya bağlıydı, bu dosyanın paylaşılan state'ine (_recentConvos vb.) dokunmuyordu.
    window.showGenericNotifToast = showGenericNotifToast; // social-gamification.js gibi ayrı script scope'larından erişim için

// Diğer social-*.js modüllerinin import edebilmesi için ince sarmalayıcı export'lar.
// renderFloatingChatBadge, social-floating-chat-badge.js tarafından monkey-patch
// edildiği için (window.renderFloatingChatBadge = function(){...}), bilinçli
// olarak window köprüsü + shim export ile bırakıldı — gerçek fonksiyona
// doğrudan export eklenirse tüketiciler patch'lenmiş sürümü değil orijinali alır.
export const renderFloatingChatBadge = window.renderFloatingChatBadge;
