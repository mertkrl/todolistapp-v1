// social-friends-notifications.js
// social.js'ten çıkarıldı (Faz 5): arkadaşlık çekirdeği (getFriends/saveFriends/
// markFriendSince/sendFriendRequest), friendships+user_blocks realtime dinleyicileri,
// DM konuşması bul/oluştur, arkadaşlık istekleri + Supabase `notifications` dinleme
// sistemi ve bildirim türü başına toast/ses dispatcher'ı (_handleNewNotif).
//
// Köprüler (ARCHITECTURE.md'ye de eklenmeli):
//  - renderNotificationsPanel/openNotificationsPanel: social.js'te tanımlı (bildirim
//    paneli render kodu, leaderboard koduyla iç içe geçmiş bölgede — henüz taşınmadı),
//    window.* ile çağrılıyor.
//  - _throttleAction/dcChatEnabled/setupChatMessageNotifications/setupRecentConversations:
//    social.js'te zaten window'a atanmıştı.
//  - getFriends/saveFriends/markFriendSince/sendFriendRequest/listenForFriendRequests/
//    _startFriendsListenerSupabase/_startBlocksListenerSupabase/_resolveOrCreateConversation/
//    _resolveProfileId/_syncFriendAcceptToSupabase/_syncFriendRemoveToSupabase/
//    _handleCollabPlanInvite/_fetchNotifications: BU modülde tanımlı, social.js'in
//    geri kalanından window.* ile çağrılabilmesi için dışa açıldı.
//  - _pendingFriendRequests/_notificationsSupabase/_pendingDmRequestsSupabase/
//    _reactionNotifications/_pendingDmRequests/_profileIdByUsername: BU modülde
//    tanımlı state nesneleri, social.js'in kalan kodu (bildirim paneli render/kabul/red
//    handler'ları) tarafından hâlâ property bazlı mutate ediliyor — getter köprüsü.
//  - _dmRequestsInitialLoadDoneSupabase/_friendAcceptSupaChannel: social.js'in kalan
//    kodu tarafından REASSIGN ediliyor — getter+setter köprüsü.
import { _refreshMyAssignmentsBadge } from './social-assignments-badge.js';
import { setupChatMessageNotifications, setupRecentConversations, _dcSetBlockedByOthers, saveJsonList } from './social-dm-notifications.js';

import { _leagueWeekStartIso, applyRankingsCardTheme, getMyWeeklyXP, leagueOf, renderStreakRace } from './social-gamification.js';
import { openSavedGroupPreview } from './social-group-discover.js';
import { getCurrentUser } from '../state/current-user-store.js';
import { getMyServerXP } from '../state/my-server-xp-store.js';
import { getMyLeagueState } from '../state/my-league-state-store.js';
import { buildNotificationItemHtml } from './social-friends-notifications-item-html.js';
import { renderMostImprovedBadge, computeRankDeltas, renderLeaderboard } from './social-friends-notifications-leaderboard-render.js';
import { _wireNotificationsPanelEvents } from './social-friends-notifications-panel-events.js';
import { TEACHER_NOTIF_ACCENT, _handleNewNotif } from './social-friends-notifications-dispatch.js';
export { TEACHER_NOTIF_ACCENT };

    // Arkadaş listesi her sekme için bellekte tutulur — localStorage paylaşım çakışmasını
    // önler. Eskiden social.js'te tanımlıydı (Faz 5 çıkarmasında bu dosyaya taşındı,
    // ancak kendi bildirimi unutulmuştu — bare ReferenceError'a yol açıyordu).
    let _friendsCache = null;  // null = henüz yüklenmedi, [] = yüklendi ama boş
    // GERÇEK BUG DÜZELTMESİ (2026-08-06): _friendsCache ile AYNI hikaye —
    // social.js'te kendi ayrı bir kopyası var ama BU dosyada (markFriendSince/
    // ensureFriendsSinceForAll/_startFriendsListenerSupabase) hiç
    // tanımlanmamıştı, bare atama strict-mode ES modülünde ReferenceError
    // fırlatıp _startFriendsListenerSupabase'in arkadaş listesi senkronunu
    // (ve onu çağıran startAllSocialListeners zincirini) kesiyordu (canlı
    // testte doğrulandı).
    let _friendsSinceCache = null;
    // bindFriendsChangedListener()'ın birden fazla kez dinleyici bağlamasını önler.
    let _friendsChangedBound = false;
    // Liderlik tablosu için son çekilen kullanıcı anlık görüntüsü (username -> veri).
    // Bu dosya ES modülüne dönüştüğünde (her zaman strict mode) bare `_lastUsersSnapshot =`
    // ataması ReferenceError fırlatıp _refreshLeaderboardFromSupabase'i ve dolayısıyla
    // tüm Sıralama/Seri render zincirini kesiyordu — modül-seviyesinde tanımlandı.
    // NOT: social-home-summary.js'in kendi ayrı closure-local kopyası var (bilinçli,
    // önceden de senkron değildi — bkz. o dosyadaki not), buna dokunulmadı.
    let _lastUsersSnapshot = {};

    export function getFriends() {
        // Bellek içi önbellek varsa onu kullan — localStorage'ı tarayıcı sekmeleri paylaştığından
        // aynı tarayıcıda iki hesap test edildiğinde çakışmayı önler.
        if (_friendsCache !== null) return _friendsCache;
        try { return JSON.parse(localStorage.getItem('focusai_friends') || '[]', window._safeJsonReviver); }
        catch { return []; }
    }

    // script-schedule-conflict-utils.js'in getHabitsForDate filtrelemesi için
    // (Faz Q: gerçek import yerine window.* — main bundle'a statik olarak çekilmesin diye)
    export { getFriends as getFriendsForFilter };
    window.getFriendsForFilter = getFriends;

    export function saveFriends(arr) {
        _friendsCache = arr || [];
        localStorage.setItem('focusai_friends', JSON.stringify(_friendsCache));
        window.dispatchEvent(new CustomEvent('focusai:friends-changed'));
    }

    // ──────────────────────────────────────────────────────
    // SUPABASE: friendships / user_blocks gerçek zamanlı dinleyiciler
    // ──────────────────────────────────────────────────────
    let _profileIdByUsername = {};
    let _friendsListenerChannel = null;
    let _blocksListenerChannel = null;

    export async function _startFriendsListenerSupabase() {
        if (!window.FocusSupabase || !getCurrentUser()?.id) return;

        const _apply = async () => {
            const { data } = await window.FocusSupabase
                .from('friendships')
                .select(`*, requester:profiles!requester_id(id, username, display_name, avatar_color), addressee:profiles!addressee_id(id, username, display_name, avatar_color)`)
                .or(`requester_id.eq.${getCurrentUser().id},addressee_id.eq.${getCurrentUser().id}`)
                .eq('status', 'accepted');

            const friendUsernames = [];
            const sinceMap = {};
            (data || []).forEach(row => {
                const other = row.requester_id === getCurrentUser().id ? row.addressee : row.requester;
                if (!other?.username) return;
                friendUsernames.push(other.username);
                if (row.accepted_at) sinceMap[other.username] = new Date(row.accepted_at).getTime();
                // profile önbelleğini de güncelle
                if (other.id) _profileIdByUsername[other.username] = other.id;
            });

            _friendsCache = friendUsernames;
            localStorage.setItem('focusai_friends', JSON.stringify(_friendsCache));
            _friendsSinceCache = { ...(_friendsSinceCache || {}), ...sinceMap };
            ensureFriendsSinceForAll();

            window.dispatchEvent(new CustomEvent('focusai:friends-changed'));
            if (window.dcChatEnabled()) {
                setupChatMessageNotifications();
                setupRecentConversations();
            }
        };

        await _apply();

        if (_friendsListenerChannel) window.FocusSupabase.removeChannel(_friendsListenerChannel);
        _friendsListenerChannel = window.FocusSupabase
            .channel(`friendships-${getCurrentUser().id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships', filter: `requester_id=eq.${getCurrentUser().id}` }, _apply)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships', filter: `addressee_id=eq.${getCurrentUser().id}` }, _apply)
            .subscribe();
    }

    export async function _startBlocksListenerSupabase() {
        if (!window.FocusSupabase || !getCurrentUser()?.id) return;

        const _apply = async () => {
            const { data } = await window.FocusSupabase.from('user_blocks').select('*')
                .or(`blocker_id.eq.${getCurrentUser().id},blocked_id.eq.${getCurrentUser().id}`);

            const myBlockedIds   = (data || []).filter(r => r.blocker_id === getCurrentUser().id).map(r => r.blocked_id);
            const blockedByIds   = (data || []).filter(r => r.blocked_id  === getCurrentUser().id).map(r => r.blocker_id);
            const allIds = [...new Set([...myBlockedIds, ...blockedByIds])];

            if (!allIds.length) {
                saveJsonList('focusai_blocked_users', []);
                _dcSetBlockedByOthers(new Set());
                window.refreshBlockSensitiveUI();
                return;
            }

            const { data: profiles } = await window.FocusSupabase.from('profiles').select('id, username').in('id', allIds);
            const idToUsername = {};
            (profiles || []).forEach(p => { idToUsername[p.id] = p.username; });

            saveJsonList('focusai_blocked_users', myBlockedIds.map(id => idToUsername[id]).filter(Boolean));
            _dcSetBlockedByOthers(new Set(blockedByIds.map(id => idToUsername[id]).filter(Boolean)));
            window.refreshBlockSensitiveUI();
        };

        await _apply();

        if (_blocksListenerChannel) window.FocusSupabase.removeChannel(_blocksListenerChannel);
        _blocksListenerChannel = window.FocusSupabase
            .channel(`user-blocks-${getCurrentUser().id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'user_blocks', filter: `blocker_id=eq.${getCurrentUser().id}` }, _apply)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'user_blocks', filter: `blocked_id=eq.${getCurrentUser().id}` }, _apply)
            .subscribe();
    }
    export async function _resolveProfileId(username) {
        if (!username) return null;
        if (_profileIdByUsername[username]) return _profileIdByUsername[username];
        if (!window.FocusSupabase) return null;
        try {
            const { data, error } = await window.FocusSupabase
                .from('profiles').select('id').eq('username', username).maybeSingle();
            if (error || !data) return null;
            _profileIdByUsername[username] = data.id;
            return data.id;
        } catch { return null; }
    }

    async function _syncFriendRequestToSupabase(targetUsername) {
        if (!window.FocusSupabase || !getCurrentUser()?.id) return;
        try {
            const targetId = await _resolveProfileId(targetUsername);
            if (!targetId) return;
            await window.FocusSupabase.from('friendships').insert({
                requester_id: getCurrentUser().id,
                addressee_id: targetId
            });
        } catch (e) { /* zaten istek/arkadaşlık var (unique constraint) — yut */ }
    }

    async function _syncFriendAcceptToSupabase(otherUsername) {
        if (!window.FocusSupabase || !getCurrentUser()?.id) return;
        try {
            const otherId = await _resolveProfileId(otherUsername);
            if (!otherId) return;
            await window.FocusSupabase.from('friendships')
                .update({ status: 'accepted', accepted_at: new Date().toISOString() })
                .eq('requester_id', otherId).eq('addressee_id', getCurrentUser().id)
                .eq('status', 'pending');
        } catch (e) { console.warn('[FocusAI] sessiz hata:', e); }
    }

    async function _syncFriendRemoveToSupabase(otherUsername) {
        if (!window.FocusSupabase || !getCurrentUser()?.id) return;
        try {
            const otherId = await _resolveProfileId(otherUsername);
            if (!otherId) return;
            await window.FocusSupabase.from('friendships')
                .delete()
                .or(`and(requester_id.eq.${getCurrentUser().id},addressee_id.eq.${otherId}),and(requester_id.eq.${otherId},addressee_id.eq.${getCurrentUser().id})`);
        } catch (e) { console.warn('[FocusAI] sessiz hata:', e); }
    }

    export async function _syncBlockToSupabase(targetUsername, blocked) {
        if (!window.FocusSupabase || !getCurrentUser()?.id) return;
        try {
            const targetId = await _resolveProfileId(targetUsername);
            if (!targetId) return;
            if (blocked) {
                await window.FocusSupabase.from('user_blocks').insert({ blocker_id: getCurrentUser().id, blocked_id: targetId });
            } else {
                await window.FocusSupabase.from('user_blocks').delete().eq('blocker_id', getCurrentUser().id).eq('blocked_id', targetId);
            }
        } catch (e) { console.warn('[FocusAI] sessiz hata:', e); }
    }
    // ──────────────────────────────────────────────────────
    // SUPABASE: conversations (DM kanalı) bul/oluştur — M2b-1 hazırlığı.
    // `user_a < user_b` (UUID sıralı) ile her kullanıcı çifti için tek satır
    // garanti edilir. Arkadaşsa status='accepted', değilse 'pending'
    // (RLS, pending durumda istek sahibinin sadece 1 mesaj göndermesine izin verir).
    // ──────────────────────────────────────────────────────
    export async function _resolveOrCreateConversation(otherUsername) {
        if (!window.FocusSupabase || !getCurrentUser()?.id) return null;
        const otherId = await _resolveProfileId(otherUsername);
        if (!otherId || otherId === getCurrentUser().id) return null;

        const userA = getCurrentUser().id < otherId ? getCurrentUser().id : otherId;
        const userB = getCurrentUser().id < otherId ? otherId : getCurrentUser().id;

        const { data: existing, error: selectError } = await window.FocusSupabase
            .from('conversations')
            .select('*')
            .eq('user_a', userA).eq('user_b', userB)
            .maybeSingle();
        if (selectError) { console.error('[Conversation] okuma hatası', selectError); return null; }
        if (existing) return existing;

        const isFriend = getFriends().includes(otherUsername);
        const { data: created, error: insertError } = await window.FocusSupabase
            .from('conversations')
            .insert({
                user_a: userA,
                user_b: userB,
                status: isFriend ? 'accepted' : 'pending',
                requested_by: getCurrentUser().id
            })
            .select('*')
            .single();
        if (insertError) {
            // Çakışma (başka sekme aynı anda oluşturmuş olabilir) — yeniden oku
            const { data: retry } = await window.FocusSupabase
                .from('conversations')
                .select('*')
                .eq('user_a', userA).eq('user_b', userB)
                .maybeSingle();
            return retry || null;
        }
        return created;
    }

    // Bir kullanıcıyla arkadaş olduğumuz anı kaydeder — aktivite akışında bu
    // kullanıcının SADECE bundan SONRAKİ aktiviteleri gösterilir.
    // ÖNEMLİ: İstemci saatleri (Date.now()) cihazlar arasında farklı olabileceğinden
    // (saat kayması), bu kayıt aktivite zaman damgalarıyla AYNI saat dilimine
    // (Firebase sunucu saati) göre tutulmalı — yoksa karşılaştırma hep yanlış çıkar.
    export function markFriendSince(username) {
        if (!getCurrentUser() || !username) return;
        _friendsSinceCache = _friendsSinceCache || {};
        if (_friendsSinceCache[username]) return;
        _friendsSinceCache[username] = Date.now();
    }
    // GERÇEK BUG DÜZELTMESİ (2026-08-06): markFriendSince window.* üzerinden
    // çağrılıyordu (bu dosyada 2, social-friends-notifications-panel-events.js'te
    // 2 yerde) ama hiçbir zaman window'a atanmamıştı — "window.markFriendSince
    // is not a function" hatasına yol açıyordu (canlı testte doğrulandı).
    window.markFriendSince = markFriendSince;

    // ensureFriendsSinceForAll yazma işlemi devam ederken aynı kullanıcı için tekrar
    // yazmayı engeller — friendsSince dinleyicisi henüz sonuçla dönmeden ikinci bir
    // çağrı gelirse (örn. friends ve friendsSince dinleyicileri art arda tetiklenince)
    // sunucu zaman damgası her seferinde "şimdi"yi yazıp eşiği ileri kaydırmasın.
    let _pendingFriendsSince = new Set();

    // Mevcut arkadaş listesindeki, henüz "friendsSince" kaydı olmayan kullanıcılar için
    // (örn. bu özellik eklenmeden önce arkadaş olunmuş kişiler) şu anı başlangıç kabul eder —
    // böylece arkadaşlık öncesi eski aktiviteleri akışa düşmez, bundan sonrakiler düşer.
    function ensureFriendsSinceForAll() {
        if (!getCurrentUser()) return;
        const friends = getFriends();
        _friendsSinceCache = _friendsSinceCache || {};
        friends.forEach(f => {
            if (!_friendsSinceCache[f]) _friendsSinceCache[f] = Date.now();
        });
    }

    // Yeni İstekli Arkadaşlık Sistemi Fonksiyonları
    export async function sendFriendRequest(targetUsername) {
        if (!getCurrentUser()) return { success: false, error: 'Giriş yapılmadı.' };
        if (!window._throttleAction(`friend_request_${getCurrentUser().username}`, 3000)) {
            return { success: false, error: 'Çok hızlı istek gönderiyorsunuz, lütfen birkaç saniye bekleyin.' };
        }
        try {
            const targetId = await _resolveProfileId(targetUsername);
            if (!targetId) return { success: false, error: 'Kullanıcı bulunamadı.' };
            const { error } = await window.FocusSupabase.from('friendships').insert({
                requester_id: getCurrentUser().id,
                addressee_id: targetId
            });
            if (error) return { success: false, error: error.message };
            // Akış gürültüsü kararı (2026-07-05): istek gönderme bir başarı değil, ara
            // adım — kabul edilince zaten "arkadaş oldu" olayı düşüyor, bu yüzden kaldırıldı.
            return { success: true };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    let _pendingFriendRequests = {};
    let _friendReqSupaChannel = null;  // M5a: Supabase Realtime arkadaşlık istekleri kanalı
    let _friendAcceptSupaChannel = null; // M5a: Supabase Realtime kabul bildirimleri kanalı
    let _reactionNotifications = {};
    // M2c: Supabase `notifications` tablosundan beslenen bildirimler
    // (reaction/mention/group_slot_open) — `_reactionNotifications`'ın
    // Supabase karşılığı, id (uuid) -> {type, timestamp, ...payload}
    let _notificationsSupabase = {};
    let _notifSupabaseChannel = null;
    let _pendingDmRequests = {};
    // M2b-1 #6: Supabase `conversations` tablosundan beslenen, bana gönderilmiş
    // ve henüz kabul edilmemiş ("pending") DM istekleri — _pendingDmRequests'in
    // Supabase karşılığı (Firebase dm_requests yerine).
    let _pendingDmRequestsSupabase = {};
    let _dmRequestsInitialLoadDoneSupabase = false;

    export function listenForFriendRequests() {
        if (window.FocusSupabase && getCurrentUser()?.id) listenForNotificationsSupabase();

        if (window.FocusSupabase && getCurrentUser()?.id) {
            // Supabase yolu: bekleyen istekleri yükle + Realtime dinle
            window.FocusSupabase
                .from('friendships')
                .select('id, requester_id, created_at, profiles!requester_id(username, display_name, avatar_color)')
                .eq('addressee_id', getCurrentUser().id)
                .eq('status', 'pending')
                .then(({ data }) => {
                    _pendingFriendRequests = {};
                    (data || []).forEach(row => {
                        const p = row.profiles;
                        if (!p) return;
                        if (typeof window.isBlockedEitherWay === 'function' && window.isBlockedEitherWay(p.username)) return;
                        _pendingFriendRequests[p.username] = {
                            fromName: p.display_name || p.username,
                            fromColor: p.avatar_color || '6c5ce7',
                            timestamp: new Date(row.created_at).getTime(),
                            _supaId: row.id
                        };
                    });
                    renderNotificationsPanel();
                });

            if (_friendReqSupaChannel) { window.FocusSupabase.removeChannel(_friendReqSupaChannel); _friendReqSupaChannel = null; }
            _friendReqSupaChannel = window.FocusSupabase
                .channel(`friend-requests-${getCurrentUser().id}`)
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'friendships', filter: `addressee_id=eq.${getCurrentUser().id}` }, async ({ new: row }) => {
                    const { data: p } = await window.FocusSupabase.from('profiles').select('username, display_name, avatar_color').eq('id', row.requester_id).single();
                    if (!p) return;
                    if (typeof window.isBlockedEitherWay === 'function' && window.isBlockedEitherWay(p.username)) return;
                    _pendingFriendRequests[p.username] = {
                        fromName: p.display_name || p.username,
                        fromColor: p.avatar_color || '6c5ce7',
                        timestamp: new Date(row.created_at).getTime(),
                        _supaId: row.id
                    };
                    renderNotificationsPanel();
                    playNotificationSound('alert');
                    maybeShowDesktopNotification('Yeni Arkadaşlık İsteği', `${p.display_name || p.username} sana arkadaşlık isteği gönderdi.`);
                    showGenericNotifToast({
                        icon: 'fa-user-plus', accent: '#6c5ce7',
                        title: 'Yeni Arkadaşlık İsteği',
                        body: `<b>${_escapeHtml(p.display_name || p.username)}</b> sana arkadaşlık isteği gönderdi.`,
                        onClick: window.openNotificationsPanel
                    });
                })
                .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'friendships', filter: `addressee_id=eq.${getCurrentUser().id}` }, ({ old: row }) => {
                    // İstek iptal edildi
                    const entry = Object.entries(_pendingFriendRequests).find(([, v]) => v._supaId === row.id);
                    if (entry) { delete _pendingFriendRequests[entry[0]]; renderNotificationsPanel(); }
                })
                .subscribe();
        }
    }

    // M2c: Aktivite tepkileri, @bahsetmeler ve "grupta yer açıldı" bildirimleri için
    // Supabase `notifications` tablosunu okuyup canlı dinler.
    let _notifReconnectTimer = null;

    export async function _fetchNotifications() {
        if (!window.FocusSupabase || !getCurrentUser()?.id) return;
        const { data, error } = await window.FocusSupabase
            .from('notifications')
            .select('*')
            .eq('user_id', getCurrentUser().id)
            .order('created_at', { ascending: false })
            .limit(30);
        if (error) { console.warn('[Bildirim] yükleme hatası', error.message); return; }
        _notificationsSupabase = {};
        (data || []).forEach(row => { _notificationsSupabase[row.id] = _normalizeNotifRow(row); });
        renderNotificationsPanel();
    }

    function _normalizeNotifRow(row) {
        return { type: row.type, timestamp: new Date(row.created_at).getTime(), ...row.payload };
    }

    // TEACHER_NOTIF_ACCENT/_handleNewNotif/_handleCollabPlanInvite/_handleCollabGoalDeleted/
    // _goToLessonPlanTab/_refreshOpenLessonPlanTrackers: social-friends-notifications-dispatch.js'e
    // çıkarıldı (Faz H devamı, 2. tur), aşağıda import ediliyor.

    function _subscribeNotifChannel() {
        if (!window.FocusSupabase || !getCurrentUser()?.id) return;
        if (_notifSupabaseChannel) window.FocusSupabase.removeChannel(_notifSupabaseChannel);

        _notifSupabaseChannel = window.FocusSupabase
            .channel(`notifications-${getCurrentUser().id}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${getCurrentUser().id}` }, payload => {
                const info = _normalizeNotifRow(payload.new);
                _notificationsSupabase[payload.new.id] = info;
                _handleNewNotif(info);
            })
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'notifications', filter: `user_id=eq.${getCurrentUser().id}` }, payload => {
                delete _notificationsSupabase[payload.old.id];
                renderNotificationsPanel();
            })
            .subscribe((status, err) => {
                if (status === 'SUBSCRIBED') {
                    clearTimeout(_notifReconnectTimer);
                } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                    console.warn('[Bildirim] kanal koptu, 5sn sonra yeniden bağlanılıyor…', status, err?.message);
                    clearTimeout(_notifReconnectTimer);
                    _notifReconnectTimer = setTimeout(() => {
                        _fetchNotifications();
                        _subscribeNotifChannel();
                    }, 5000);
                }
            });
    }

    let _notifVisibilityListenerAdded = false;
    async function listenForNotificationsSupabase() {
        if (!window.FocusSupabase || !getCurrentUser()?.id) return;
        await _fetchNotifications();
        _subscribeNotifChannel();

        // Sekme arka plandan öne gelince kaçılan bildirimleri çek (sadece bir kez kayıt ol)
        if (!_notifVisibilityListenerAdded) {
            _notifVisibilityListenerAdded = true;
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') _fetchNotifications();
            });
        }
    }


// ── Bildirim paneli çekirdeği (Faz 5, ikinci artırım — social.js:2246-2991'den taşındı) ──
    // Bildirim panelini açar (sidebar'daki global bildirim butonuyla aynı davranış) —
    // toast'lara tıklandığında ilgili bildirimi görmek için kullanılır
    export function openNotificationsPanel() {
        renderNotificationsPanel();
        document.getElementById('friend-requests-modal')?.classList.remove('hidden');
    }

    // Bildirim öğesini "Sosyal" (arkadaşlık/DM/tepki) veya "Gruplar" (bahsetme,
    // rol değişikliği, kaydedilen grupta yer açılması) kategorisine ayırır
    function getNotifCategory(item) {
        if (item.kind === 'request' || item.kind === 'dmRequest') return 'social';
        const type = item.info && item.info.type;
        // DM @bahsetmeleri "Sosyal" sayılır, grup @bahsetmeleri "Gruplar"
        if (type === 'mention') return item.info.conversationId ? 'social' : 'groups';
        if (type === 'role_change' || type === 'group_slot_open' || type === 'group_invite' || type === 'group_goal_reached' || type === 'institution_invite' || type === 'classroom_weekly_digest' || type === 'focus_reminder' || type === 'assignment_reminder' || type === 'assignment_new' || type === 'collab_plan_invite' || type === 'lesson_plan_reminder' || type === 'lesson_plan_new' || type === 'lesson_plan_accepted' || type === 'lesson_plan_revision_requested' || type === 'lesson_plan_rejected') return 'groups';
        return 'social'; // tepki bildirimleri
    }

    let _notifFilter = 'all';
    function setupNotifFilterTabs() {
        const tabsEl = document.getElementById('notif-filter-tabs');
        if (!tabsEl || tabsEl.dataset.bound) return;
        tabsEl.dataset.bound = '1';
        tabsEl.querySelectorAll('.notif-filter-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                _notifFilter = tab.dataset.filter;
                tabsEl.querySelectorAll('.notif-filter-tab').forEach(t => {
                    const active = t === tab;
                    t.classList.toggle('active', active);
                    t.style.background = active ? 'rgba(108,92,231,0.18)' : 'rgba(255,255,255,0.03)';
                    t.style.color = active ? '#a29bfe' : 'var(--text-muted)';
                });
                renderNotificationsPanel();
            });
        });
    }

    function _applyDynStyles(root) {
        if (!root) return;
        root.querySelectorAll('[data-dyn-bg]').forEach(el => { el.style.backgroundColor = el.getAttribute('data-dyn-bg'); });
        root.querySelectorAll('[data-dyn-color]').forEach(el => { el.style.color = el.getAttribute('data-dyn-color'); });
        root.querySelectorAll('[data-dyn-bdc]').forEach(el => { el.style.borderLeftColor = el.getAttribute('data-dyn-bdc'); });
        root.querySelectorAll('[data-dyn-mt]').forEach(el => { el.style.marginTop = el.getAttribute('data-dyn-mt'); });
        root.querySelectorAll('[data-dyn-w]').forEach(el => { el.style.width = el.getAttribute('data-dyn-w'); });
        root.querySelectorAll('[data-dyn-delay]').forEach(el => { el.style.animationDelay = el.getAttribute('data-dyn-delay'); });
        root.querySelectorAll('[data-dyn-bordercolor]').forEach(el => { el.style.borderColor = el.getAttribute('data-dyn-bordercolor'); });
    }

    // Bildirim öğesi HTML üreticileri: social-friends-notifications-item-html.js'e
    // çıkarıldı (Faz H/O devamı) — buildNotificationItemHtml aşağıda import ediliyor.

    // renderNotificationsPanel'den ayrılan: bildirim listesindeki tüm buton/tıklama olaylarını bağlar.
    // Faz S devamı, dev fonksiyon refactoru.
    // Faz Dev-Dosya-Bölme: _wireNotificationsPanelEvents'in 12 bağımsız bildirim-türü
    // wiring bloğu module-seviyeye taşındı — her biri kendi CSS seçicisiyle sınırlı,
    // aralarında paylaşılan mutable state yok (sadece 'cp-plan-invite-notif' bloğu
    // `items`'a ihtiyaç duyuyor). Davranış birebir aynı.
    // _wireNotificationsPanelEvents ve 12 alt-wiring fonksiyonu
    // social-friends-notifications-panel-events.js'e çıkarıldı (Faz H devamı, 2. tur).

    export function renderNotificationsPanel() {
        const listEl = document.getElementById('friend-requests-list');
        const badgeEl = document.getElementById('friend-requests-badge');

        setupNotifFilterTabs();

        const requestEntries = Object.entries(window.__getPendingFriendRequestsRef()).map(([fromUser, info]) => ({
            kind: 'request', key: fromUser, fromUser, info, timestamp: info.timestamp || 0
        }));
        const reactionEntries = (window.FocusSupabase && getCurrentUser() && getCurrentUser().id)
            ? Object.entries(window.__getNotificationsSupabaseRef()).map(([id, info]) => ({
                kind: 'reaction', key: id, info, timestamp: info.timestamp || 0
            }))
            : Object.entries(window.__getReactionNotificationsRef()).map(([id, info]) => ({
                kind: 'reaction', key: id, info, timestamp: info.timestamp || 0
            }));
        const dmRequestEntries = (window.FocusSupabase && getCurrentUser() && getCurrentUser().id)
            ? Object.entries(__getPendingDmRequestsSupabaseRef()).map(([fromUser, info]) => ({
                kind: 'dmRequest', key: fromUser, fromUser, info, timestamp: info.timestamp || 0
            }))
            : Object.entries(window.__getPendingDmRequestsRef())
                .filter(([, info]) => info && info.status === 'pending')
                .map(([fromUser, info]) => ({
                    kind: 'dmRequest', key: fromUser, fromUser, info, timestamp: info.timestamp || 0
                }));

        const allItems = [...requestEntries, ...reactionEntries, ...dmRequestEntries].sort((a, b) => b.timestamp - a.timestamp);
        const items = _notifFilter === 'all' ? allItems : allItems.filter(item => getNotifCategory(item) === _notifFilter);

        // Sidebar'daki global bildirim butonu — tüm sekmelerden erişilebilsin diye
        const globalBadgeEl = document.getElementById('global-notif-badge');

        [badgeEl, globalBadgeEl].forEach(el => {
            if (!el) return;
            if (allItems.length > 0) {
                el.textContent = allItems.length > 9 ? '9+' : String(allItems.length);
                el.classList.remove('hidden');
            } else {
                el.classList.add('hidden');
            }
        });

        if (!listEl) return;

        if (!items.length) {
            listEl.innerHTML = `<div class="u-text-align-center_color-var-text-muted_font-size-13px_padd">${_notifFilter === 'all' ? 'Henüz bir bildirimin yok.' : 'Bu kategoride bildirim yok.'}</div>`;
            return;
        }

        listEl.innerHTML = items.map(buildNotificationItemHtml).join('');
        _applyDynStyles(listEl);

        _wireNotificationsPanelEvents(listEl, items);
    }

// social-dm-notifications.js'e gerçek ES import ile dışa açılıyor (Faz P8).

export function __getPendingDmRequestsSupabaseRef() { return _pendingDmRequestsSupabase; }
export function __getProfileIdByUsernameRef() { return _profileIdByUsername; }
export function __getDmRequestsInitialLoadDoneSupabaseRef() { return _dmRequestsInitialLoadDoneSupabase; }
export function __setDmRequestsInitialLoadDoneSupabaseRef(v) { _dmRequestsInitialLoadDoneSupabase = v; }
// GERÇEK BUG DÜZELTMESİ (2026-08-06): listenForFriendAcceptances()
// window.__getFriendAcceptSupaChannelRef/__setFriendAcceptSupaChannelRef'i
// çağırıyordu ama bu köprüler hiç TANIMLANMAMIŞTI — her çağrıda
// "TypeError: ... is not a function" fırlatıp loadCommunityProfile'ın
// (social-auth-bootstrap.js) try/catch'ini tetikliyor, bu da BAŞARIYLA
// yüklenmiş profili "başarısız" sayıp "Topluluk Özellikleri için Oturum
// Gerekiyor" banner'ını gereksiz yere geri gösteriyordu (canlı testte
// doğrulandı). Diğer köprülerle aynı desende eksik tanım eklendi.
export function __getFriendAcceptSupaChannelRef() { return _friendAcceptSupaChannel; }
export function __setFriendAcceptSupaChannelRef(v) { _friendAcceptSupaChannel = v; }
window.__getFriendAcceptSupaChannelRef = __getFriendAcceptSupaChannelRef;
window.__setFriendAcceptSupaChannelRef = __setFriendAcceptSupaChannelRef;

// GERÇEK BUG DÜZELTMESİ (2026-08-06): _friendAcceptSupaChannel ile AYNI
// hikaye — renderNotificationsPanel() ve social-friends-notifications-
// panel-events.js window.__getPendingFriendRequestsRef()'i çağırıyordu ama
// hiç tanımlanmamıştı. Bu, "Bildirimler" (zil) butonuna her tıklandığında
// renderNotificationsPanel()'in daha classList.remove('hidden') satırına
// ulaşmadan çökmesine yol açıyordu — buton görünürde hiçbir şey yapmıyor
// gibi görünüyordu (canlı testte doğrulandı: gerçek bir arkadaşlık isteği
// veritabanında dururken bildirim paneli hiç açılmıyordu).
export function __getPendingFriendRequestsRef() { return _pendingFriendRequests; }
window.__getPendingFriendRequestsRef = __getPendingFriendRequestsRef;

// GERÇEK BUG DÜZELTMESİ (2026-08-06): renderNotificationsPanel()'in
// kullandığı diğer üç köprü de (yukarıdakiyle aynı sebep/aynı canlı test
// zincirinde) hiç tanımlanmamıştı — her biri "Bildirimler" panelini bir
// adım daha ileri götürüp yine window.__get*Ref is not a function ile
// çöküyordu (art arda üç ayrı hata, tek tek canlı testte yakalandı).
export function __getNotificationsSupabaseRef() { return _notificationsSupabase; }
export function __getReactionNotificationsRef() { return _reactionNotifications; }
export function __getPendingDmRequestsRef() { return _pendingDmRequests; }
window.__getNotificationsSupabaseRef = __getNotificationsSupabaseRef;
window.__getReactionNotificationsRef = __getReactionNotificationsRef;
window.__getPendingDmRequestsRef = __getPendingDmRequestsRef;

// ── Arkadaşlık yönetimi (Faz 5, üçüncü artırım — social.js:2247-2519'dan taşındı) ──
    // İsteği biz gönderdiğimizde, karşı taraf kabul edince burası tetiklenir
    // ve karşı tarafı da kendi arkadaş listemize ekleriz (mutual/iki yönlü arkadaşlık).
    export function listenForFriendAcceptances() {
        if (!getCurrentUser()) return;

        if (window.FocusSupabase) {
            // Supabase yolu: benim gönderdiğim istekler accepted olduğunda bildir
            if (window.__getFriendAcceptSupaChannelRef()) { window.FocusSupabase.removeChannel(window.__getFriendAcceptSupaChannelRef()); window.__setFriendAcceptSupaChannelRef(null); }
            const _newFriendAcceptSupaChannel = window.FocusSupabase
                .channel(`friend-acceptances-${getCurrentUser().id}`)
                .on('postgres_changes', {
                    event: 'UPDATE', schema: 'public', table: 'friendships',
                    filter: `requester_id=eq.${getCurrentUser().id}`
                }, async ({ old: oldRow, new: newRow }) => {
                    // Sadece pending → accepted geçişini işle
                    if (oldRow.status !== 'pending' || newRow.status !== 'accepted') return;
                    const { data: p } = await window.FocusSupabase.from('profiles')
                        .select('username, display_name').eq('id', newRow.addressee_id).single();
                    if (!p) return;

                    const friends = getFriends();
                    if (!friends.includes(p.username)) {
                        friends.push(p.username);
                        saveFriends(friends);
                    }
                    window.markFriendSince(p.username);
                    // Akış içerik kararı (2026-07-05): kaldırıldı.
                    populateHabitBuddySelect();
                    playNotificationSound('alert');
                    if (typeof window.showPremiumModal === 'function') {
                        window.showPremiumModal({ title: 'Yeni Arkadaş! 🎉', message: `${p.display_name || p.username} arkadaşlık isteğini kabul etti. Artık arkadaşsınız.`, type: 'success' });
                    }
                })
                .subscribe();
            window.__setFriendAcceptSupaChannelRef(_newFriendAcceptSupaChannel);
            return;
        }

    }

    function addFriend(username) {
        const friends = getFriends();
        if (!friends.includes(username) && username !== getCurrentUser()?.username) {
            friends.push(username);
            saveFriends(friends);
            window.markFriendSince(username);
            return true;
        }
        return false;
    }

    // Arkadaşlıktan çıkarma onayı için zengin görsellikli özel modal
    // (avatarlı, net uyarı metinli, tehlike rengiyle vurgulanmış aksiyon butonları)
    // social-online-friends.js gibi ayrı script scope'larından erişim için
    // (fonksiyon bildirimleri hoisted olduğundan bu atama, tanımdan önce
    // yazılsa bile derleme zamanında geçerlidir)
    export async function showUnfriendConfirm(username, displayName) {
        document.getElementById('unfriend-confirm-overlay')?.remove();

        const avatarColor = (_lastUsersSnapshot[username] && _lastUsersSnapshot[username].avatarColor) || '6c5ce7';
        const pairId = buddyPairId(getCurrentUser()?.username || '', username);

        // Bu çiftin ortak alışkanlıklarını say
        let buddyHabitCount = 0;
        try {
            if (window.FocusSupabase && getCurrentUser()?.id) {
                const { data } = await window.FocusSupabase.from('buddy_habits')
                    .select('id', { count: 'exact', head: false })
                    .eq('pair_id', pairId);
                buddyHabitCount = (data || []).length;
            }
        } catch (_) { console.warn('[FocusAI] sessiz hata:', _); }

        const hasSharedData = buddyHabitCount > 0;

        const warningBlock = hasSharedData ? `
            <div class="u-background-rgba25571870p08_border-1pxsolidrgba25571870p3_b">
                <div class="u-font-weight-700_color-hff4757_font-size-13px_margin-bottom">
                    <i class="fa-solid fa-triangle-exclamation"></i> Bu işlem geri alınamaz
                </div>
                <ul class="u-color-rgba2552552550p7_font-size-13px_line-height-1p8_marg">
                    <li><strong class="u-color-hfff">${buddyHabitCount}</strong> ortak alışkanlık zinciri kalıcı olarak silinecek</li>
                    <li>Ortak seans geçmişi ve tamamlama kayıtları silinecek</li>
                    <li>Bekleyen odak ve alışkanlık davetleri iptal edilecek</li>
                </ul>
            </div>` : `
            <p class="u-color-var-text-muted_font-size-13p5px_line-height-1p6_marg">
                "${_escapeHtml(displayName)}" arkadaş listenden kaldırılacak. Birbirinizin çevrimiçi durumunu ve odak davetlerini artık göremezsiniz.
            </p>`;

        const overlay = document.createElement('div');
        overlay.id = 'unfriend-confirm-overlay';
        overlay.className = 'modal-overlay';
        overlay.style.zIndex = '100050';

        overlay.innerHTML = `
            <div class="modal-content glass-panel u-max-width-390px_text-align-center_padding-30px28px" >
                <div class="u-width-72px_height-72px_border-radius-50pct_margin-0auto18p">
                    <i class="fa-solid fa-user-xmark u-font-size-28px_color-hff4757" ></i>
                </div>
                <div class="u-display-flex_align-items-center_justify-content-center_gap">
                    ${avatarImgHtml({ displayName, avatarColor, username }, 40)}
                    <span class="u-font-weight-700_color-hfff_font-size-16px">${_escapeHtml(displayName)}</span>
                </div>
                <h3 class="u-color-hfff_font-size-17px_margin-0014px">Arkadaşlıktan çıkarmak istediğine emin misin?</h3>
                ${warningBlock}
                <div ${hasSharedData ? '' : 'data-dyn-mt="24px"'} class="u-display-flex_gap-10px">
                    <button id="unfriend-cancel-btn" class="control-btn secondary u-flex-1_padding-12px_font-size-14px_border-radius-12px" >
                        Vazgeç
                    </button>
                    <button id="unfriend-confirm-btn" class="u-flex-1_padding-12px_font-size-14px_border-radius-12px_bord sfn-unfriend-confirm-btn">
                        <i class="fa-solid fa-user-minus"></i> ${hasSharedData ? 'Evet, Her Şeyi Sil' : 'Evet, Çıkar'}
                    </button>
                </div>
            </div>`;
        _applyDynStyles(overlay);

        document.body.appendChild(overlay);

        const close = () => overlay.remove();
        overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
        overlay.querySelector('#unfriend-cancel-btn')?.addEventListener('click', close);
        overlay.querySelector('#unfriend-confirm-btn')?.addEventListener('click', () => {
            close();
            performUnfriendCleanup(username, displayName, pairId, hasSharedData);
        });
    }

    async function performUnfriendCleanup(username, displayName, pairId, hasSharedData) {
        // 1. Arkadaş listesinden çıkar
        removeFriend(username);

        if (hasSharedData) {
            // 2. Ortak alışkanlık verilerini sil
            if (window.FocusSupabase && getCurrentUser()?.id) {
                // Silmeden önce ortak alışkanlıkları çek ve partner'lara bildir
                window.FocusSupabase.from('buddy_habits').select('id, host_id, guest_id').eq('pair_id', pairId).then(({ data }) => {
                    (data || []).forEach(row => {
                        const partnerId = row.host_id === getCurrentUser().id ? row.guest_id : row.host_id;
                        if (partnerId) {
                            window.FocusSupabase.from('notifications').insert({
                                user_id: partnerId, type: 'buddy_habit_deleted',
                                payload: { fromUsername: getCurrentUser().username, fromName: getCurrentUser().displayName, habitId: row.id }
                            }).then(() => {});
                        }
                    });
                    window.FocusSupabase.from('buddy_habits').delete().eq('pair_id', pairId).then(() => {});
                });
                window.FocusSupabase.from('buddy_habit_invites').delete()
                    .or(`from_id.eq.${getCurrentUser().id},to_id.eq.${getCurrentUser().id}`).then(() => {});
                window.FocusSupabase.from('buddy_habit_responses').delete()
                    .or(`from_id.eq.${getCurrentUser().id},to_id.eq.${getCurrentUser().id}`).then(() => {});
            }
            // 3. Bekleyen davetleri temizle (her iki yönde)
            if (getCurrentUser() && window.FocusSupabase) {
                _resolveProfileId(username).then(otherId => {
                    if (!otherId) return;
                    window.FocusSupabase.from('cw_invites')
                        .delete()
                        .or(`from_id.eq.${getCurrentUser().id},to_id.eq.${getCurrentUser().id}`)
                        .then(() => {});
                });
            }
        }

        // 4. Yerel alışkanlıklardan buddy bağlantısını temizle
        cleanBuddyHabitsLocally(username);

        if (typeof window.showPremiumModal === 'function') {
            window.showPremiumModal({
                title: 'Arkadaşlıktan Çıkarıldı',
                message: hasSharedData
                    ? `"${displayName}" arkadaş listenden ve tüm ortak veriler sistemden kaldırıldı.`
                    : `"${displayName}" artık arkadaş listende değil.`,
                type: 'info'
            });
        }
    }

    function cleanBuddyHabitsLocally(buddyUsername) {
        const transform = habits => habits.map(h => {
            if (h.buddy !== buddyUsername) return h;
            const copy = { ...h };
            delete copy.buddy;
            delete copy.pairId;
            return copy;
        });

        // window.removeBuddyHabitsForUser tanımlıysa onu kullan (script.js tarafı)
        if (typeof window.removeBuddyHabitsForUser === 'function') {
            window.removeBuddyHabitsForUser(buddyUsername);
            return;
        }
        // Fallback: localStorage'a doğrudan yaz
        try {
            if (typeof window.FocusStorage !== 'undefined') {
                window.FocusStorage.set('aliskanliklar', transform(window.FocusStorage.get('aliskanliklar', [])));
            } else {
                const key = 'focusai_aliskanliklar';
                localStorage.setItem(key, JSON.stringify(transform(JSON.parse(localStorage.getItem(key) || '[]', window._safeJsonReviver))));
            }
        } catch (_) { console.warn('[FocusAI] sessiz hata:', _); }
    }

    export function removeFriend(username) {
        saveFriends(getFriends().filter(u => u !== username));
        window._syncFriendRemoveToSupabase(username);
    }

    // Arkadaş listesinde olmayan kişilerle paylaşılmış (yetim) alışkanlıkları temizler.
    // Sayfa açılışında bir kez çalışır — arkadaşlıktan çıkarma temizliği yapılmadan önce
    // silinen arkadaşlara ait verileri de düzeltir.
    export function cleanOrphanedBuddyHabits() {
        if (!getCurrentUser()) return;
        const friends = getFriends();
        // Arkadaş listesi henüz yüklenmemişse (boşsa) race condition'dan kaçın
        // — yoksa tüm buddy habit'lar yanlışlıkla "yetim" sayılıp silinir
        if (!friends || friends.length === 0) return;

        const transform = habits => {
            let changed = false;
            const updated = habits.filter(h => {
                if (!h.buddy || h.buddy === 'none' || friends.includes(h.buddy)) return true;
                // Bu alışkanlığın partneri artık arkadaş listesinde yok — tamamen sil
                changed = true;
                const pairId = buddyPairId(getCurrentUser().username, h.buddy);
                if (window.FocusSupabase && getCurrentUser().id) {
                    // Sadece lokal + Supabase'den temizle; bildirim performUnfriendCleanup tarafından gönderildi
                    window.FocusSupabase.from('buddy_habits').delete().eq('id', h.id).then(() => {});
                }
                return false;
            });
            return changed ? updated : null; // null = değişiklik yok, kaydetme
        };

        try {
            // Doğru depolama anahtarı: script.js 'habits' anahtarını kullanıyor
            const storageKey = 'habits';
            const localStorageKey = 'focusai_habits';

            if (typeof window.FocusStorage !== 'undefined') {
                const habitsInStorage = window.FocusStorage.get(storageKey, []);
                const result = transform(habitsInStorage);
                if (result) {
                    window.FocusStorage.set(storageKey, result);
                    // script.js'deki in-memory diziyi de senkronize et
                    if (typeof window._syncHabitsFromStorage === 'function') {
                        window._syncHabitsFromStorage();
                    }
                }
            } else {
                const habitsInStorage = JSON.parse(localStorage.getItem(localStorageKey) || '[]', window._safeJsonReviver);
                const result = transform(habitsInStorage);
                if (result) localStorage.setItem(localStorageKey, JSON.stringify(result));
            }
        } catch (_) { console.warn('[FocusAI] sessiz hata:', _); }
    }

    export async function searchUser(username) {
        if (window.FocusSupabase) {
            try {
                const { data } = await window.FocusSupabase.from('profiles')
                    .select('username, display_name, avatar_color, custom_avatar, avatar_initials, xp')
                    .ilike('username', username).maybeSingle();
                if (!data) return null;
                return { username: data.username, displayName: data.display_name || data.username, avatarColor: data.avatar_color || '6c5ce7', customAvatar: data.custom_avatar || null, avatarInitials: data.avatar_initials || null, xp: data.xp || 0 };
            } catch { return null; }
        }
        return null;
    }
// renderNotificationsPanel/openNotificationsPanel: social-dm-notifications.js'e gerçek ES
// import ile dışa açılıyor (Faz P8) — daha önce burada circular-import endişesiyle window
// köprüsüyle bırakılmıştı, ama import zaten yalnızca fonksiyon gövdeleri içinde (geç/deferred)
// tüketildiği için circular import güvenli.

// ── Liderlik Tablosu (Faz 5, dördüncü artırım — social.js:2248-2491'den taşındı) ──
    // ──────────────────────────────────────────────────────
    // LİDERLİK TABLOSU (Gerçek Zamanlı)
    // ──────────────────────────────────────────────────────
    export function subscribeLeaderboard() {
        if (!getCurrentUser()) return;
        const el = document.getElementById('leaderboard-list');
        if (!el) return;

        window.addEventListener('focusai:friends-changed', _refreshLeaderboardFromSupabase);
        window.addEventListener('focusai:presence-changed', _refreshLeaderboardFromSupabase);
        _refreshLeaderboardFromSupabase();
        bindFriendsChangedListener();
    }

    async function _refreshLeaderboardFromSupabase() {
        if (!window.FocusSupabase || !getCurrentUser()?.id) return;

        const friends = getFriends();
        const usersToFetch = [...new Set([getCurrentUser().username, ...friends.filter(u => !window.isBlockedEitherWay(u))])];

        const { data: profiles } = await window.FocusSupabase
            .from('profiles')
            .select('id, username, display_name, avatar_color, custom_avatar, avatar_initials, xp, week_start, week_xp_base, league, focus_streak')
            .in('username', usersToFetch);

        const presenceState = window.getCommunityPresenceState ? window.getCommunityPresenceState() : {};
        const onlineUserIds = new Set();
        Object.values(presenceState).forEach(arr => {
            if (Array.isArray(arr)) arr.forEach(p => { if (p.user_id) onlineUserIds.add(p.user_id); });
        });

        // Geçen haftanın weekly_xp'si — "Bu Haftanın En Çok Gelişeni" rozeti için
        // (league_history herkese okunabilir: 049_weekly_league.sql select politikası).
        const _prevWeek = _leagueWeekStartIso(new Date(Date.now() - 7 * 86400000));
        const userIds = (profiles || []).map(p => p.id).filter(Boolean);
        let prevWeeklyXpByUserId = {};
        if (userIds.length) {
            const { data: hist } = await window.FocusSupabase
                .from('league_history')
                .select('user_id, weekly_xp')
                .eq('week_start', _prevWeek)
                .in('user_id', userIds);
            (hist || []).forEach(h => { prevWeeklyXpByUserId[h.user_id] = h.weekly_xp || 0; });
        }

        _lastUsersSnapshot = {};
        const _thisWeek = _leagueWeekStartIso();
        (profiles || []).forEach(p => {
            // Hafta anlık görüntüsü güncel değilse (kullanıcı bu hafta hiç gelmemişse)
            // bu haftaki XP'si 0 sayılır — birikmiş fark geçen haftaya aittir.
            const weeklyXp = p.week_start === _thisWeek
                ? Math.max(0, (p.xp || 0) - (p.week_xp_base || 0))
                : 0;
            _lastUsersSnapshot[p.username] = {
                xp: p.xp || 0,
                weeklyXp,
                prevWeeklyXp: prevWeeklyXpByUserId[p.id],
                league: p.league || 1,
                streak: p.focus_streak || 0,
                displayName: p.display_name || p.username,
                avatarColor: p.avatar_color || '6c5ce7',
                customAvatar: p.custom_avatar || null, avatarInitials: p.avatar_initials || null,
                online: onlineUserIds.has(p.id)
            };
        });

        const totalOnlineEl = document.getElementById('total-online-count');
        if (totalOnlineEl) totalOnlineEl.textContent = Object.values(_lastUsersSnapshot).filter(d => d.online).length;

        renderLeaderboardFromCache();
    }

    let _leaderboardRenderPending = false;
    export function renderLeaderboardFromCache() {
        if (_leaderboardRenderPending) return;
        _leaderboardRenderPending = true;
        requestAnimationFrame(() => {
            _leaderboardRenderPending = false;
            const el = document.getElementById('leaderboard-list');
            if (!el) return;
            const all = _lastUsersSnapshot;
            const friends = getFriends();

            // Arkadaşlar (kendini çift saymamak için filtrele)
            const visible = Object.entries(all)
                .filter(([u]) => friends.includes(u) && u !== getCurrentUser()?.username)
                .filter(([u]) => !(typeof window.isBlockedEitherWay === 'function' && window.isBlockedEitherWay(u)))
                .map(([u, d]) => ({ username: u, ...d, isMe: false }));

            // Kendini her zaman ekle (isMe:true ile vurgulanır)
            if (getCurrentUser()) {
                const meData = all[getCurrentUser().username] || {};
                const st = getMyLeagueState();
                visible.push({
                    username: getCurrentUser().username,
                    ...meData,
                    xp: (typeof getMyServerXP() === 'number') ? getMyServerXP() : Math.max(meData.xp || 0, getLocalXP()),
                    weeklyXp: st ? getMyWeeklyXP() : (meData.weeklyXp || 0),
                    league: st?.league || meData.league || 1,
                    displayName: getCurrentUser().displayName,
                    avatarColor: getCurrentUser().avatarColor,
                    isMe: true
                });
            }

            // Haftalık XP birincil ölçüt; eşitlikte toplam XP
            visible.sort((a, b) => (b.weeklyXp || 0) - (a.weeklyXp || 0) || (b.xp || 0) - (a.xp || 0));

            // Tüm uygulama online sayısı
            const totalOnline = Object.values(all).filter(d => d.online).length;
            const totalOnlineEl = document.getElementById('total-online-count');
            if (totalOnlineEl) totalOnlineEl.textContent = totalOnline;

            // Liderlik tablosunda 1-2-3 sıraya giriş tespiti.
            // Akış spam'i önleme: günde en fazla bir duyuru; aynı gün içinde
            // yalnızca daha iyi bir sıraya yükselirse tekrar paylaşılır
            // (her sayfa yenilemesinde/sıra sallanmasında akışı doldurmasın).
            if (getCurrentUser()) {
                const myRank = visible.findIndex(u => u.username === getCurrentUser().username);
                if (myRank >= 0 && myRank <= 2) {
                    const medals = ['👑 1.', '🥈 2.', '🥉 3.'];
                    let saved = null;
                    try { saved = JSON.parse(localStorage.getItem('focusai_rank_activity') || 'null', window._safeJsonReviver); } catch {}
                    const today = new Date().toISOString().slice(0, 10);
                    const alreadyToday = saved && saved.date === today;
                    if (!alreadyToday || myRank < saved.rank) {
                        // Akış içerik kararı (2026-07-05): kaldırıldı.
                        try { localStorage.setItem('focusai_rank_activity', JSON.stringify({ date: today, rank: myRank })); } catch {}
                    }
                }
            }

            applyRankingsCardTheme(getMyLeagueState()?.league || 1);
            renderLeaderboard(computeRankDeltas('friends', visible), el);
            renderStreakRace(visible);
            renderMostImprovedBadge(visible);
        });
    }
    window.renderLeaderboardFromCache = renderLeaderboardFromCache;

    // ─── GÜNLÜK MİNİ REKABET → social-daily-race.js dosyasına taşındı ──────

    // Arkadaş listesi (ekleme/çıkarma) değişince liderlik tablosunu ve arkadaş listesini
    // bir sonraki Firebase güncellemesini beklemeden anında yeniden çiz.
    function bindFriendsChangedListener() {
        if (_friendsChangedBound) return;
        _friendsChangedBound = true;
        window.addEventListener('focusai:friends-changed', () => {
            renderLeaderboardFromCache();
            if (typeof window.subscribeOnlineFriends === 'function') window.subscribeOnlineFriends();
            // Arkadaş listesi değişince Bugün ve Alışkanlıklar sekmelerini de yenile
            if (typeof window._syncHabitsFromStorage === 'function') window._syncHabitsFromStorage();
            // "Kişiler" listesini de anında güncelle
            if (typeof window.syncDcContactList === 'function') window.syncDcContactList();
        });
    }


