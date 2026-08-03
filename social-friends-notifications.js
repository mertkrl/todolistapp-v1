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
import { getCurrentUser } from './state/current-user-store.js';
import { getMyServerXP } from './state/my-server-xp-store.js';
import { getMyLeagueState } from './state/my-league-state-store.js';

    // Arkadaş listesi her sekme için bellekte tutulur — localStorage paylaşım çakışmasını
    // önler. Eskiden social.js'te tanımlıydı (Faz 5 çıkarmasında bu dosyaya taşındı,
    // ancak kendi bildirimi unutulmuştu — bare ReferenceError'a yol açıyordu).
    let _friendsCache = null;  // null = henüz yüklenmedi, [] = yüklendi ama boş
    // bindFriendsChangedListener()'ın birden fazla kez dinleyici bağlamasını önler.
    let _friendsChangedBound = false;

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
                    window.renderNotificationsPanel();
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
                    window.renderNotificationsPanel();
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
                    if (entry) { delete _pendingFriendRequests[entry[0]]; window.renderNotificationsPanel(); }
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
        window.renderNotificationsPanel();
    }

    function _normalizeNotifRow(row) {
        return { type: row.type, timestamp: new Date(row.created_at).getTime(), ...row.payload };
    }

    // "Öğretmenden" bildirim ailesi — öğretmen/kurumdan öğrenciye giden tüm bildirimler
    // (ödev, ders planı, hatırlatma, sınıf daveti, haftalık özet) tek bir tutarlı renk diliyle
    // ayırt edilsin diye ortak vurgu rengi. İkonlar bildirim amacına göre farklı kalır.
    const TEACHER_NOTIF_ACCENT = '#a29bfe';

    // Ders planı bildirimlerine (öğrenciye giden atama, öğretmene giden kabul/revize/red)
    // tıklayınca genel "Planlama" sekmesi yerine doğrudan ilgili grubun Sınıf Paneli >
    // Ders Planı sekmesi açılır — kod (groupCode) yoksa (eski/geçiş dönemi bildirimleri
    // için) yine de Planlama'ya düşülür.
    function _goToLessonPlanTab(groupCode) {
        if (groupCode && typeof window.dcOpenAssignmentTab === 'function') {
            if (typeof window.switchTab === 'function') window.switchTab('arkadaslar');
            window.dcOpenAssignmentTab(groupCode, 'planlar');
        } else if (typeof window.switchTab === 'function') {
            window.switchTab('planlama');
        }
    }

    // Öğretmen tarafında Sınıf Paneli > Ders Planı sekmesi zaten açıksa (aynı sekme
    // görünürken karşı taraf kabul/revize/red yapınca), sayfa yenilemeden anında
    // güncellensin diye — bu bildirimler zaten realtime geldiği için ek bir
    // realtime aboneliğine gerek kalmadan "bildirim = tazele sinyali" olarak kullanılır.
    function _refreshOpenLessonPlanTrackers() {
        document.querySelectorAll('#cp-lpa-tracker-body[data-lpa-group-id]').forEach(el => {
            const groupId = el.dataset.lpaGroupId;
            if (groupId && typeof window.renderGroupLessonPlanStatus === 'function') {
                window.renderGroupLessonPlanStatus(groupId, el);
            }
        });
    }

    function _handleNewNotif(info) {
        window.renderNotificationsPanel();
        // 'reaction' tipi bildirimler artık üretilmiyor (sadeleştirme kararı) —
        // eski satırlar panelde görünmeye devam eder ama toast/ses tetiklemez.
        if (info.type === 'group_announcement') {
            playNotificationSound('alert');
            showGenericNotifToast({
                icon: 'fa-bullhorn', accent: '#74b9ff',
                title: `📣 ${_escapeHtml(info.groupName || 'Grup')} duyurusu`,
                body: `${_escapeHtml(info.text || '')} — ${_escapeHtml(info.fromName || '')}`,
                onClick: () => { if (info.groupCode && typeof window.dcOpenGroupPanel === 'function') window.dcOpenGroupPanel(info.groupCode); }
            });
        } else if (info.type === 'group_slot_open') {
            playNotificationSound('alert');
            showGenericNotifToast({
                icon: 'fa-star', accent: '#2ed573', title: 'Grupta Yer Açıldı!',
                body: `<b>${_escapeHtml(info.groupName || '')}</b> grubunda yer açıldı.`,
                onClick: window.openNotificationsPanel
            });
        } else if (info.type === 'focus_reminder') {
            playNotificationSound('alert');
            showGenericNotifToast({
                icon: 'fa-bell', accent: TEACHER_NOTIF_ACCENT, title: 'Öğretmenden Hatırlatma',
                body: `<b>${_escapeHtml(info.fromName || '')}</b> sana <b>${_escapeHtml(info.groupName || '')}</b> için bir hatırlatma gönderdi.`,
                onClick: window.openNotificationsPanel
            });
        } else if (info.type === 'assignment_reminder') {
            playNotificationSound('alert');
            showGenericNotifToast({
                icon: 'fa-clipboard-list', accent: TEACHER_NOTIF_ACCENT, title: 'Öğretmenden: Ödev Hatırlatması',
                body: `<b>${_escapeHtml(info.assignmentTitle || '')}</b> ödevini (${_escapeHtml(info.groupName || '')}) henüz teslim etmedin.`,
                onClick: window.openNotificationsPanel
            });
        } else if (info.type === 'assignment_new') {
            playNotificationSound('alert');
            showGenericNotifToast({
                icon: 'fa-clipboard-list', accent: TEACHER_NOTIF_ACCENT, title: 'Öğretmenden: Yeni Ödev',
                body: `<b>${_escapeHtml(info.fromName || '')}</b> <b>${_escapeHtml(info.groupName || '')}</b>'e yeni bir ödev ekledi: ${_escapeHtml(info.assignmentTitle || '')}`,
                onClick: () => { if (info.groupCode && typeof window.dcOpenAssignmentTab === 'function') window.dcOpenAssignmentTab(info.groupCode); }
            });
            if (typeof _refreshMyAssignmentsBadge === 'function') _refreshMyAssignmentsBadge();
        } else if (info.type === 'classroom_weekly_digest') {
            playNotificationSound('alert');
            showGenericNotifToast({
                icon: 'fa-chart-line', accent: TEACHER_NOTIF_ACCENT, title: 'Öğretmenden: Haftalık Sınıf Özeti',
                body: `<b>${_escapeHtml(info.groupName || '')}</b>: bu hafta ${info.inactiveCount} kişi hiç odaklanmadı.`,
                onClick: window.openNotificationsPanel
            });
        } else if (info.type === 'institution_invite') {
            playNotificationSound('alert');
            showGenericNotifToast({
                icon: 'fa-building-columns', accent: TEACHER_NOTIF_ACCENT, title: 'Öğretmenden: Sınıf Daveti',
                body: `<b>${_escapeHtml(info.fromName || '')}</b> seni <b>${_escapeHtml(info.groupName || '')}</b> sınıfına davet etti.`,
                onClick: window.openNotificationsPanel
            });
        } else if (info.type === 'mention') {
            playNotificationSound('alert');
            const isDm = !!info.conversationId;
            showGenericNotifToast({
                icon: 'fa-at', accent: '#74b9ff', title: 'Bahsedildin',
                body: `<b>${_escapeHtml(info.fromName || '')}</b> seni ${isDm ? 'bir mesajda' : 'bir grup sohbetinde'} etiketledi.`,
                onClick: window.openNotificationsPanel
            });
        } else if (info.type === 'buddy_habit_deleted') {
            playNotificationSound('alert');
            _handleBuddyHabitDeletedNotification(info);
        } else if (info.type === 'buddy_session_ended') {
            playNotificationSound('message');
            _handleBuddySessionEndedNotification(info);
        } else if (info.type === 'collab_plan_invite') {
            playNotificationSound('alert');
            _handleCollabPlanInvite(info);
        } else if (info.type === 'lesson_plan_reminder') {
            playNotificationSound('alert');
            showGenericNotifToast({
                icon: 'fa-book-open', accent: TEACHER_NOTIF_ACCENT, title: 'Öğretmenden: Ders Planı Hatırlatması',
                body: `<b>${_escapeHtml(info.fromName || '')}</b>, <b>${_escapeHtml(info.goalTitle || '')}</b> ders planını henüz tamamlamadığını hatırlatıyor.`,
                onClick: () => { if (typeof window.switchTab === 'function') window.switchTab('planlama'); }
            });
        } else if (info.type === 'lesson_plan_new') {
            playNotificationSound('alert');
            showGenericNotifToast({
                icon: 'fa-graduation-cap', accent: TEACHER_NOTIF_ACCENT, title: 'Bekleyen planlama isteğiniz var',
                body: info.resent
                    ? `<b>${_escapeHtml(info.fromName || '')}</b> <b>${_escapeHtml(info.goalTitle || '')}</b> planını düzenleyip tekrar gönderdi.`
                    : `<b>${_escapeHtml(info.fromName || '')}</b> sana <b>${_escapeHtml(info.goalTitle || '')}</b> adlı bir ders planı atadı.`,
                onClick: () => _goToLessonPlanTab(info.groupCode)
            });
        } else if (info.type === 'lesson_plan_accepted') {
            playNotificationSound('message');
            _refreshOpenLessonPlanTrackers();
            showGenericNotifToast({
                icon: 'fa-circle-check', accent: '#2ed573', title: 'Ders Planı Kabul Edildi',
                body: `<b>${_escapeHtml(info.fromName || '')}</b> gönderdiğin ders planını kabul etti.`,
                onClick: () => _goToLessonPlanTab(info.groupCode)
            });
        } else if (info.type === 'lesson_plan_revision_requested') {
            playNotificationSound('alert');
            _refreshOpenLessonPlanTrackers();
            showGenericNotifToast({
                icon: 'fa-pen-to-square', accent: '#feca57', title: 'Ders Planında Revize İstendi',
                body: `<b>${_escapeHtml(info.fromName || '')}</b>: “${_escapeHtml(info.note || '')}”`,
                onClick: () => _goToLessonPlanTab(info.groupCode)
            });
        } else if (info.type === 'lesson_plan_rejected') {
            playNotificationSound('alert');
            _refreshOpenLessonPlanTrackers();
            showGenericNotifToast({
                icon: 'fa-circle-xmark', accent: '#ff6b6b', title: 'Ders Planı Reddedildi',
                body: `<b>${_escapeHtml(info.fromName || '')}</b> planı reddetti.${info.note ? ` Sebep: “${_escapeHtml(info.note)}”` : ''} Plan 7 gün içinde tekrar düzenlenip gönderilebilir.`,
                onClick: () => _goToLessonPlanTab(info.groupCode)
            });
        } else if (info.type === 'collab_goal_deleted') {
            playNotificationSound('alert');
            _handleCollabGoalDeleted(info);
        } else if (info.type === 'kudos') {
            playNotificationSound('alert');
            showGenericNotifToast({
                icon: 'fa-hands-clapping', accent: '#feca57', title: 'Alkış Aldın! 👏',
                body: `<b>${_escapeHtml(info.fromName || '')}</b> odaklanmana alkış gönderdi.`,
                onClick: window.openNotificationsPanel
            });
        } else if (info.type === 'group_goal_reached') {
            playNotificationSound('alert');
            if (typeof window.fireConfetti === 'function') window.fireConfetti();
            showGenericNotifToast({
                icon: 'fa-trophy', accent: '#feca57', title: 'Haftalık Hedef Tamamlandı! 🎉',
                body: `<b>${_escapeHtml(info.groupName || '')}</b> grubu bu haftaki ${info.weeklyGoal ? formatFocusMinutes(info.weeklyGoal) : ''} hedefine ulaştı.`,
                onClick: window.openNotificationsPanel
            });
        }
    }

    function _handleCollabPlanInvite(info) {
        const esc = window.escapeHtml;
        document.getElementById('collab-plan-invite-overlay')?.remove();

        const fromName   = info.fromName  || info.fromUsername || 'Biri';
        const goalTitle  = info.goalTitle || 'bir plan';
        const inviteCode = info.inviteCode;
        const goalId     = info.goalId;

        const overlay = document.createElement('div');
        overlay.id        = 'collab-plan-invite-overlay';
        overlay.className = 'modal-overlay';
        overlay.style.zIndex = '100080';
        overlay.innerHTML = `
            <div class="cpi-card">
                <div class="cpi-avatar-row">
                    <div class="cpi-from-avatar">${esc(fromName.slice(0,2).toUpperCase())}</div>
                </div>
                <p class="cpi-from-name">${esc(fromName)}</p>
                <p class="cpi-label">seni bir plana davet etti</p>
                <p class="cpi-goal-title">"${esc(goalTitle)}"</p>
                <div class="cpi-actions">
                    <button id="cpi-reject-btn" class="cpi-btn-reject">Reddet</button>
                    <button id="cpi-accept-btn" class="cpi-btn-accept">
                        <i class="ti ti-check"></i> Kabul Et
                    </button>
                </div>
                <div id="cpi-status" class="cpi-status-msg"></div>
            </div>`;
        document.body.appendChild(overlay);

        overlay.querySelector('#cpi-reject-btn').addEventListener('click', () => {
            overlay.remove();
            if (goalId && window.FocusSupabase && getCurrentUser()?.id) {
                window.FocusSupabase.from('lesson_plan_assignments')
                    .update({ status: 'rejected', responded_at: new Date().toISOString() })
                    .eq('goal_id', goalId).eq('student_id', getCurrentUser().id).then(() => {});
            }
        });

        overlay.querySelector('#cpi-accept-btn').addEventListener('click', async () => {
            const acceptBtn = overlay.querySelector('#cpi-accept-btn');
            const statusEl  = overlay.querySelector('#cpi-status');
            acceptBtn.disabled = true;
            acceptBtn.innerHTML = '<span class="cpi-spinner"></span>';

            try {
                const result = await window.PlanningCollab?.joinByCode?.(inviteCode);
                if (!result) {
                    statusEl.textContent = 'Geçersiz davet kodu.';
                    acceptBtn.disabled = false;
                    acceptBtn.innerHTML = '<i class="ti ti-check"></i> Kabul Et';
                    return;
                }

                // Hedefi local'e ekle
                await window._applyInviteJoin?.(result);

                const targetGoalIdForStatus = result.goalId || goalId;
                if (targetGoalIdForStatus && window.FocusSupabase && getCurrentUser()?.id) {
                    window.FocusSupabase.from('lesson_plan_assignments')
                        .update({ status: 'accepted', responded_at: new Date().toISOString() })
                        .eq('goal_id', targetGoalIdForStatus).eq('student_id', getCurrentUser().id).then(() => {});
                }

                // Planlama sekmesine geç ve plana doğrudan gir — ders planı ataması bir
                // ödev gibidir, öğretmenin "planlamayı başlat" tuşuna basmasını beklemeye gerek yok
                // (o mekanizma canlı/senkron ortak planlama oturumları için var, ders planı ataması için değil).
                if (typeof window.switchTab === 'function') window.switchTab('planlama');

                const targetGoalId = result.goalId || goalId;
                await window.PlanningCollab?.joinRoom?.(result.roomId, targetGoalId, 'editor');
                window.PlanningCollab?.setHandlers?.({
                    onStartPlanning: () => {},
                    onMilestoneChange: () => {},
                    onProgressChange:  () => {},
                });

                overlay.remove();
                if (typeof window.openPlanView === 'function') {
                    window.openPlanView(targetGoalId);
                }

            } catch(e) {
                statusEl.textContent = 'Bir hata oluştu, tekrar dene.';
                acceptBtn.disabled = false;
                acceptBtn.innerHTML = '<i class="ti ti-check"></i> Kabul Et';
            }
        });
    }

    function _handleCollabGoalDeleted(info) {
        const esc = window.escapeHtml;
        document.getElementById('collab-goal-deleted-overlay')?.remove();

        const fromName  = info.fromName || info.fromUsername || 'Biri';
        const goalTitle = info.goalTitle || 'bir plan';
        const goalId    = info.goalId;

        const overlay = document.createElement('div');
        overlay.id        = 'collab-goal-deleted-overlay';
        overlay.className = 'modal-overlay';
        overlay.style.zIndex = '100085';
        overlay.innerHTML = `
            <div class="modal-content glass-panel u-text-align-center-2" >
                <div class="modal-icon-wrapper warning">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                </div>
                <h2 class="u-margin-bottom-10px_color-hfff">Ortak Çalışma Sona Erdi</h2>
                <p class="u-color-var-text-muted_font-size-14px_line-height-1p6_margin">
                    <strong class="u-color-rgba255255255p85">${esc(fromName)}</strong>,
                    <em>"${esc(goalTitle)}"</em> planındaki ortak çalışmayı sonlandırdı.
                </p>
                <p class="u-color-var-text-muted_font-size-13px_line-height-1p5_margin-2">
                    Planı bireysel olarak sürdürebilir ya da hesabınızdan kalıcı olarak kaldırabilirsiniz.
                </p>
                <div class="u-display-grid_grid-template-columns-1fr1fr1fr_gap-8px_margi">
                    <button id="cgd-later-btn"  class="cdm-btn cdm-btn--ghost">Sonra Karar Ver</button>
                    <button id="cgd-delete-btn" class="cdm-btn cdm-btn--danger">Kalıcı Olarak Sil</button>
                    <button id="cgd-solo-btn"   class="cdm-btn cdm-btn--purple">Bireysel Sürdür</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);

        overlay.querySelector('#cgd-later-btn').addEventListener('click', () => overlay.remove());

        overlay.querySelector('#cgd-solo-btn').addEventListener('click', async () => {
            overlay.remove();
            if (typeof window._convertGoalToSoloById === 'function') {
                await window._convertGoalToSoloById(goalId);
            }
        });

        overlay.querySelector('#cgd-delete-btn').addEventListener('click', async () => {
            overlay.remove();
            if (typeof window._deleteGoalSilently === 'function') {
                window._deleteGoalSilently(goalId);
            }
        });
    }

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
                window.renderNotificationsPanel();
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

    // renderNotificationsPanel'in tek bir bildirim öğesini HTML'e çeviren dispatch'i —
    // saf fonksiyon, sadece item (kind/info/key) alır. window.timeAgo/avatarImgHtml/
    // _escapeHtml/TEACHER_NOTIF_ACCENT global referanslar.
    function buildFriendRequestNotifHtml(item) {
                const fromUser = item.fromUser;
                const info = item.info;
                return `
                <div class="glass-element si-row-sb">
                    <div class="si-row-g10-min0">
                        ${window.avatarImgHtml({ displayName: info.fromName, avatarColor: info.fromColor, username: fromUser }, 38)}
                        <div class="si-min0">
                            <div class="u-font-weight-600_color-hfff_font-size-14px_overflow-hidden_">${_escapeHtml(info.fromName || '')}</div>
                            <div class="si-muted-sm">@${_escapeHtml(fromUser)} · arkadaşlık isteği gönderdi</div>
                        </div>
                    </div>
                    <div class="u-display-flex_gap-6px_flex-shrink-0">
                        <button class="control-btn primary fr-accept-btn u-font-size-12px_padding-7px12px_background-h2ed573" data-from="${_escapeHtml(fromUser)}" data-name="${_escapeHtml(info.fromName || '')}" ><i class="fa-solid fa-check"></i></button>
                        <button class="control-btn secondary fr-decline-btn u-font-size-12px_padding-7px12px_color-hff4757_border-color-" data-from="${_escapeHtml(fromUser)}" ><i class="fa-solid fa-xmark"></i></button>
                    </div>
                </div>`;
    }

    function buildDmRequestNotifHtml(item) {
                const fromUser = item.fromUser;
                const info = item.info;
                return `
                <div class="glass-element u-display-flex_flex-direction-column_gap-10px_padding-12px14" >
                    <div class="si-row-g10-min0">
                        ${window.avatarImgHtml({ displayName: info.fromName, avatarColor: info.fromColor, customAvatar: info.fromCustomAvatar, username: fromUser }, 38)}
                        <div class="si-min0">
                            <div class="u-font-weight-600_color-hfff_font-size-14px_overflow-hidden_">${_escapeHtml(info.fromName || '')}</div>
                            <div class="si-muted-sm">@${_escapeHtml(fromUser)} · sana mesaj gönderdi</div>
                            ${info.lastText ? `<div class="u-font-size-12px_color-var-text-muted_margin-top-2px_overflo">"${_escapeHtml(info.lastText)}"</div>` : ''}
                        </div>
                    </div>
                    <div class="u-display-flex_gap-6px">
                        <button class="control-btn primary dm-req-add-btn u-flex-1_font-size-12px_padding-8px10px_background-h2ed573" data-from="${_escapeHtml(fromUser)}" data-name="${_escapeHtml(info.fromName || '')}" ><i class="fa-solid fa-user-plus"></i> Kişilere Ekle</button>
                        <button class="control-btn secondary dm-req-continue-btn u-flex-1_font-size-12px_padding-8px10px" data-from="${_escapeHtml(fromUser)}" data-name="${_escapeHtml(info.fromName || '')}" data-room-name="${_escapeHtml(info.fromName || fromUser)}" ><i class="fa-regular fa-comment-dots"></i> Konuşmaya Devam Et</button>
                    </div>
                </div>`;
    }

    function buildMentionNotifHtml(item) {
                const info = item.info;
                const isDm = !!info.conversationId;
                return `
                <div class="glass-element dc-mention-notif u-display-flex_align-items-center_justify-content-space-betw-6" data-dm="${isDm ? '1' : ''}" data-from="${_escapeHtml(info.fromUser || '')}" data-from-name="${_escapeHtml(info.fromName || '')}" data-group="${_escapeHtml(info.groupCode || '')}" data-scope-type="${_escapeHtml(info.scopeType || '')}" data-scope-id="${_escapeHtml(info.scopeId || '')}" data-room="${_escapeHtml(info.roomId || '')}" data-channel="${_escapeHtml(info.channelId || '')}" data-room-name="${_escapeHtml(info.roomName || info.roomId || '')}" data-id="${item.key}" >
                    <div class="si-row-g10-min0">
                        ${window.avatarImgHtml({ displayName: info.fromName, avatarColor: info.fromColor, username: info.fromUser }, 38)}
                        <div class="si-min0">
                            <div class="si-title">
                                <span class="u-font-weight-600">${_escapeHtml(info.fromName || '')}</span>
                                ${isDm
                                    ? `<span class="si-muted"> bir mesajda seni etiketledi</span>`
                                    : `<span class="si-muted"> seni etiketledi: </span><span class="si-muted">#${_escapeHtml(info.roomName || info.roomId || '')}</span>`}
                            </div>
                            <div class="u-font-size-11px_color-var-text-muted_margin-top-2px_overflo">${window.timeAgo(info.timestamp)}${info.text ? ' · "' + _escapeHtml(info.text) + '"' : ''}</div>
                        </div>
                    </div>
                    <button class="control-btn secondary notif-dismiss-btn" data-id="${item.key}" title="Bildirimi kaldır" class="si-action-btn" aria-label="Bildirimi kaldır"><i class="fa-solid fa-xmark"></i></button>
                </div>`;
    }

    function buildRoleChangeNotifHtml(item) {
                const info = item.info;
                const isPromote = info.direction === 'promote';
                const accent = isPromote ? '#ffd166' : '#ff7675';
                const icon = isPromote ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down';
                const verb = isPromote ? 'terfi ettirildi' : 'rolün değiştirildi';
                return `
                <div class="glass-element u-display-flex_align-items-center_justify-content-space-betw-7" data-dyn-bdc="${accent}">
                    <div class="si-row-g10-min0">
                        <div data-dyn-bg="${accent}22" class="u-width-38px_height-38px_border-radius-50pct_display-flex_al">
                            <i class="fa-solid ${icon} u-font-size-16px" data-dyn-color="${accent}"></i>
                        </div>
                        <div class="si-min0">
                            <div class="si-title">
                                <span class="si-muted">Yeni rolün: </span>
                                <span data-dyn-color="${accent}" class="u-font-weight-600">${_escapeHtml(info.roleLabel || '')}</span>
                                <span class="si-muted"> — ${verb}</span>
                            </div>
                            <div class="si-meta">${window.timeAgo(info.timestamp)}${info.fromName ? ' · ' + _escapeHtml(info.fromName) + ' tarafından' : ''}</div>
                        </div>
                    </div>
                    <button class="control-btn secondary notif-dismiss-btn" data-id="${item.key}" title="Bildirimi kaldır" class="si-action-btn" aria-label="Bildirimi kaldır"><i class="fa-solid fa-xmark"></i></button>
                </div>`;
    }

    function buildGroupSlotOpenNotifHtml(item) {
                const info = item.info;
                return `
                <div class="glass-element discover-saved-slot-notif u-display-flex_align-items-center_justify-content-space-betw-2" data-group="${_escapeHtml(info.groupCode || '')}" >
                    <div class="si-row-g10-min0">
                        <div class="u-width-38px_height-38px_border-radius-50pct_background-h2ed">
                            <i class="fa-solid fa-star u-color-h2ed573_font-size-16px" ></i>
                        </div>
                        <div class="si-min0">
                            <div class="si-title">
                                <span class="u-font-weight-600">${_escapeHtml(info.groupName || '')}</span>
                                <span class="si-muted"> grubunda yer açıldı!</span>
                            </div>
                            <div class="si-meta">${window.timeAgo(info.timestamp)} · Kaydettiğin bir grup</div>
                        </div>
                    </div>
                    <button class="control-btn secondary notif-dismiss-btn" data-id="${item.key}" title="Bildirimi kaldır" class="si-action-btn" aria-label="Bildirimi kaldır"><i class="fa-solid fa-xmark"></i></button>
                </div>`;
    }

    function buildGroupInviteNotifHtml(item) {
                const info = item.info;
                return `
                <div class="glass-element u-display-flex_flex-direction-column_gap-10px_padding-12px14" >
                    <div class="si-row-g10-min0">
                        ${window.avatarImgHtml({ displayName: info.fromName, avatarColor: info.fromColor, customAvatar: info.fromCustomAvatar, username: info.fromUser }, 38)}
                        <div class="si-min0">
                            <div class="si-title">
                                <span class="u-font-weight-600">${_escapeHtml(info.fromName || info.fromUser || '')}</span>
                                <span class="si-muted"> seni </span>
                                <span class="u-font-weight-600">${_escapeHtml(info.groupName || '')}</span>
                                <span class="si-muted"> grubuna davet etti</span>
                            </div>
                            <div class="si-meta">${window.timeAgo(info.timestamp)}</div>
                        </div>
                    </div>
                    <div class="u-display-flex_gap-6px">
                        <button class="control-btn primary group-invite-accept-btn u-flex-1_font-size-12px_padding-8px10px_background-h2ed573" data-id="${item.key}" data-code="${_escapeHtml(info.groupCode || '')}" ><i class="fa-solid fa-check"></i> Katıl</button>
                        <button class="control-btn secondary group-invite-decline-btn u-flex-1_font-size-12px_padding-8px10px_color-hff4757_border" data-id="${item.key}" ><i class="fa-solid fa-xmark"></i> Reddet</button>
                    </div>
                </div>`;
    }

    function buildInstitutionInviteNotifHtml(item) {
                const info = item.info;
                return `
                <div class="glass-element u-display-flex_flex-direction-column_gap-10px_padding-12px14-2" data-dyn-bdc="${TEACHER_NOTIF_ACCENT}">
                    <div class="si-row-g10-min0">
                        <div data-dyn-bg="${TEACHER_NOTIF_ACCENT}26" class="u-width-38px_height-38px_border-radius-50pct_display-flex_al">
                            <i class="fa-solid fa-building-columns u-font-size-16px" data-dyn-color="${TEACHER_NOTIF_ACCENT}"></i>
                        </div>
                        <div class="si-min0">
                            <div class="si-title">
                                <span class="u-font-weight-600">${_escapeHtml(info.fromName || '')}</span>
                                <span class="si-muted"> seni </span>
                                <span class="u-font-weight-600">${_escapeHtml(info.groupName || '')}</span>
                                <span class="si-muted"> sınıfına davet etti</span>
                            </div>
                            <div class="si-meta">${window.timeAgo(info.timestamp)}</div>
                        </div>
                    </div>
                    <div class="u-display-flex_gap-6px">
                        <button class="control-btn primary institution-invite-accept-btn u-flex-1_font-size-12px_padding-8px10px_background-h2ed573" data-id="${item.key}" data-invite-id="${info.inviteId || ''}" ><i class="fa-solid fa-check"></i> Kabul Et</button>
                        <button class="control-btn secondary institution-invite-decline-btn u-flex-1_font-size-12px_padding-8px10px_color-hff4757_border" data-id="${item.key}" data-invite-id="${info.inviteId || ''}" ><i class="fa-solid fa-xmark"></i> Reddet</button>
                    </div>
                </div>`;
    }

    function buildClassroomWeeklyDigestNotifHtml(item) {
                const info = item.info;
                return `
                <div class="glass-element discover-saved-slot-notif u-display-flex_align-items-center_justify-content-space-betw-3" data-group="${info.groupCode || ''}" data-dyn-bdc="${TEACHER_NOTIF_ACCENT}">
                    <div class="si-row-g10-min0">
                        <div data-dyn-bg="${TEACHER_NOTIF_ACCENT}26" class="u-width-38px_height-38px_border-radius-50pct_display-flex_al">
                            <i class="fa-solid fa-chart-line u-font-size-16px" data-dyn-color="${TEACHER_NOTIF_ACCENT}"></i>
                        </div>
                        <div class="si-min0">
                            <div class="si-title">
                                <span class="u-font-weight-600">${_escapeHtml(info.groupName || '')}</span>
                                <span class="si-muted">: bu hafta ${info.inactiveCount} kişi hiç odaklanmadı</span>
                            </div>
                            <div class="si-meta">${window.timeAgo(info.timestamp)} · haftalık özet</div>
                        </div>
                    </div>
                    <button class="control-btn secondary notif-dismiss-btn" data-id="${item.key}" title="Bildirimi kaldır" class="si-action-btn" aria-label="Bildirimi kaldır"><i class="fa-solid fa-xmark"></i></button>
                </div>`;
    }

    function buildFocusReminderNotifHtml(item) {
                const info = item.info;
                return `
                <div class="glass-element discover-saved-slot-notif u-display-flex_align-items-center_justify-content-space-betw-3" data-group="${info.groupCode || ''}" data-dyn-bdc="${TEACHER_NOTIF_ACCENT}">
                    <div class="si-row-g10-min0">
                        <div data-dyn-bg="${TEACHER_NOTIF_ACCENT}26" class="u-width-38px_height-38px_border-radius-50pct_display-flex_al">
                            <i class="fa-solid fa-bell u-font-size-16px" data-dyn-color="${TEACHER_NOTIF_ACCENT}"></i>
                        </div>
                        <div class="si-min0">
                            <div class="si-title">
                                <span class="u-font-weight-600">${_escapeHtml(info.fromName || '')}</span>
                                <span class="si-muted"> sana </span>
                                <span class="u-font-weight-600">${_escapeHtml(info.groupName || '')}</span>
                                <span class="si-muted"> için bir hatırlatma gönderdi</span>
                            </div>
                            <div class="si-meta">${window.timeAgo(info.timestamp)}</div>
                        </div>
                    </div>
                    <button class="control-btn secondary notif-dismiss-btn" data-id="${item.key}" title="Bildirimi kaldır" class="si-action-btn" aria-label="Bildirimi kaldır"><i class="fa-solid fa-xmark"></i></button>
                </div>`;
    }

    function buildAssignmentReminderNotifHtml(item) {
                const info = item.info;
                return `
                <div class="glass-element discover-saved-slot-notif u-display-flex_align-items-center_justify-content-space-betw-3" data-group="${info.groupCode || ''}" data-assignment-jump="1" data-dyn-bdc="${TEACHER_NOTIF_ACCENT}">
                    <div class="si-row-g10-min0">
                        <div data-dyn-bg="${TEACHER_NOTIF_ACCENT}26" class="u-width-38px_height-38px_border-radius-50pct_display-flex_al">
                            <i class="fa-solid fa-clipboard-list u-font-size-16px" data-dyn-color="${TEACHER_NOTIF_ACCENT}"></i>
                        </div>
                        <div class="si-min0">
                            <div class="si-title">
                                <span class="u-font-weight-600">${_escapeHtml(info.assignmentTitle || '')}</span>
                                <span class="si-muted"> ödevini henüz teslim etmedin</span>
                            </div>
                            <div class="si-meta">${_escapeHtml(info.groupName || '')} · ${window.timeAgo(info.timestamp)}</div>
                        </div>
                    </div>
                    <button class="control-btn secondary notif-dismiss-btn" data-id="${item.key}" title="Bildirimi kaldır" class="si-action-btn" aria-label="Bildirimi kaldır"><i class="fa-solid fa-xmark"></i></button>
                </div>`;
    }

    function buildAssignmentNewNotifHtml(item) {
                const info = item.info;
                return `
                <div class="glass-element discover-saved-slot-notif u-display-flex_align-items-center_justify-content-space-betw-3" data-group="${info.groupCode || ''}" data-assignment-jump="1" data-dyn-bdc="${TEACHER_NOTIF_ACCENT}">
                    <div class="si-row-g10-min0">
                        <div data-dyn-bg="${TEACHER_NOTIF_ACCENT}26" class="u-width-38px_height-38px_border-radius-50pct_display-flex_al">
                            <i class="fa-solid fa-clipboard-list u-font-size-16px" data-dyn-color="${TEACHER_NOTIF_ACCENT}"></i>
                        </div>
                        <div class="si-min0">
                            <div class="si-title">
                                <span class="u-font-weight-600">${_escapeHtml(info.fromName || '')}</span>
                                <span class="si-muted"> yeni bir ödev ekledi: </span>
                                <span class="u-font-weight-600">${_escapeHtml(info.assignmentTitle || '')}</span>
                            </div>
                            <div class="si-meta">${_escapeHtml(info.groupName || '')} · ${window.timeAgo(info.timestamp)}</div>
                        </div>
                    </div>
                    <button class="control-btn secondary notif-dismiss-btn" data-id="${item.key}" title="Bildirimi kaldır" class="si-action-btn" aria-label="Bildirimi kaldır"><i class="fa-solid fa-xmark"></i></button>
                </div>`;
    }

    function buildCollabPlanInviteNotifHtml(item) {
                const info = item.info;
                return `
                <div class="glass-element cp-plan-invite-notif u-display-flex_align-items-center_justify-content-space-betw-3" data-id="${item.key}" data-dyn-bdc="${TEACHER_NOTIF_ACCENT}">
                    <div class="si-row-g10-min0">
                        <div data-dyn-bg="${TEACHER_NOTIF_ACCENT}26" class="u-width-38px_height-38px_border-radius-50pct_display-flex_al">
                            <i class="fa-solid fa-book-open u-font-size-16px" data-dyn-color="${TEACHER_NOTIF_ACCENT}"></i>
                        </div>
                        <div class="si-min0">
                            <div class="si-title">
                                <span class="u-font-weight-600">${_escapeHtml(info.fromName || '')}</span>
                                <span class="si-muted"> sana bir ders planı atadı: </span>
                                <span class="u-font-weight-600">${_escapeHtml(info.goalTitle || '')}</span>
                            </div>
                            <div class="si-meta">${window.timeAgo(info.timestamp)}</div>
                        </div>
                    </div>
                    <button class="control-btn secondary notif-dismiss-btn" data-id="${item.key}" title="Bildirimi kaldır" class="si-action-btn" aria-label="Bildirimi kaldır"><i class="fa-solid fa-xmark"></i></button>
                </div>`;
    }

    function buildLessonPlanReminderNotifHtml(item) {
                const info = item.info;
                return `
                <div class="glass-element discover-saved-slot-notif u-display-flex_align-items-center_justify-content-space-betw-3" data-lesson-plan-jump="1" data-dyn-bdc="${TEACHER_NOTIF_ACCENT}">
                    <div class="si-row-g10-min0">
                        <div data-dyn-bg="${TEACHER_NOTIF_ACCENT}26" class="u-width-38px_height-38px_border-radius-50pct_display-flex_al">
                            <i class="fa-solid fa-bell u-font-size-16px" data-dyn-color="${TEACHER_NOTIF_ACCENT}"></i>
                        </div>
                        <div class="si-min0">
                            <div class="si-title">
                                <span class="u-font-weight-600">${_escapeHtml(info.fromName || '')}</span>
                                <span class="si-muted"> </span>
                                <span class="u-font-weight-600">${_escapeHtml(info.goalTitle || '')}</span>
                                <span class="si-muted"> ders planını hatırlatıyor</span>
                            </div>
                            <div class="si-meta">${window.timeAgo(info.timestamp)}</div>
                        </div>
                    </div>
                    <button class="control-btn secondary notif-dismiss-btn" data-id="${item.key}" title="Bildirimi kaldır" class="si-action-btn" aria-label="Bildirimi kaldır"><i class="fa-solid fa-xmark"></i></button>
                </div>`;
    }

    function buildLessonPlanNewNotifHtml(item) {
                const info = item.info;
                return `
                <div class="glass-element discover-saved-slot-notif u-display-flex_align-items-center_justify-content-space-betw-3" data-lesson-plan-jump="1" data-dyn-bdc="${TEACHER_NOTIF_ACCENT}">
                    <div class="si-row-g10-min0">
                        <div data-dyn-bg="${TEACHER_NOTIF_ACCENT}26" class="u-width-38px_height-38px_border-radius-50pct_display-flex_al">
                            <i class="fa-solid fa-graduation-cap u-font-size-16px" data-dyn-color="${TEACHER_NOTIF_ACCENT}"></i>
                        </div>
                        <div class="si-min0">
                            <div class="si-title">
                                ${info.resent
                                    ? `<span class="u-font-weight-600">${_escapeHtml(info.fromName || '')}</span><span class="si-muted"> planını düzenleyip tekrar gönderdi: </span><span class="u-font-weight-600">${_escapeHtml(info.goalTitle || '')}</span>`
                                    : `<span class="u-font-weight-600">${_escapeHtml(info.fromName || '')}</span><span class="si-muted"> sana bir ders planı atadı: </span><span class="u-font-weight-600">${_escapeHtml(info.goalTitle || '')}</span>`}
                            </div>
                            <div class="si-meta">Bekleyen planlama isteğiniz var · ${window.timeAgo(info.timestamp)}</div>
                        </div>
                    </div>
                    <button class="control-btn secondary notif-dismiss-btn" data-id="${item.key}" title="Bildirimi kaldır" class="si-action-btn" aria-label="Bildirimi kaldır"><i class="fa-solid fa-xmark"></i></button>
                </div>`;
    }

    function buildLessonPlanAcceptedNotifHtml(item) {
                const info = item.info;
                return `
                <div class="glass-element discover-saved-slot-notif u-display-flex_align-items-center_justify-content-space-betw-2" data-lesson-plan-jump="1" >
                    <div class="si-row-g10-min0">
                        <div class="u-width-38px_height-38px_border-radius-50pct_background-h2ed-2">
                            <i class="fa-solid fa-circle-check u-color-h2ed573_font-size-16px" ></i>
                        </div>
                        <div class="si-min0">
                            <div class="si-title"><span class="u-font-weight-600">${_escapeHtml(info.fromName || '')}</span><span class="si-muted"> gönderdiğin ders planını kabul etti.</span></div>
                            <div class="si-meta">${window.timeAgo(info.timestamp)}</div>
                        </div>
                    </div>
                    <button class="control-btn secondary notif-dismiss-btn" data-id="${item.key}" title="Bildirimi kaldır" class="si-action-btn" aria-label="Bildirimi kaldır"><i class="fa-solid fa-xmark"></i></button>
                </div>`;
    }

    function buildLessonPlanRevisionRequestedNotifHtml(item) {
                const info = item.info;
                return `
                <div class="glass-element discover-saved-slot-notif u-display-flex_align-items-center_justify-content-space-betw-8" data-lesson-plan-jump="1" >
                    <div class="si-row-g10-min0">
                        <div class="u-width-38px_height-38px_border-radius-50pct_background-hfec">
                            <i class="fa-solid fa-pen-to-square u-color-hfeca57_font-size-16px" ></i>
                        </div>
                        <div class="si-min0">
                            <div class="si-title"><span class="u-font-weight-600">${_escapeHtml(info.fromName || '')}</span><span class="si-muted"> ders planında revize istedi: </span>"${_escapeHtml(info.note || '')}"</div>
                            <div class="si-meta">${window.timeAgo(info.timestamp)}</div>
                        </div>
                    </div>
                    <button class="control-btn secondary notif-dismiss-btn" data-id="${item.key}" title="Bildirimi kaldır" class="si-action-btn" aria-label="Bildirimi kaldır"><i class="fa-solid fa-xmark"></i></button>
                </div>`;
    }

    function buildLessonPlanRejectedNotifHtml(item) {
                const info = item.info;
                return `
                <div class="glass-element discover-saved-slot-notif u-display-flex_align-items-center_justify-content-space-betw-9" data-lesson-plan-jump="1" >
                    <div class="si-row-g10-min0">
                        <div class="u-width-38px_height-38px_border-radius-50pct_background-hff6">
                            <i class="fa-solid fa-circle-xmark u-color-hff6b6b_font-size-16px" ></i>
                        </div>
                        <div class="si-min0">
                            <div class="si-title"><span class="u-font-weight-600">${_escapeHtml(info.fromName || '')}</span><span class="si-muted"> planı reddetti${info.note ? ': "' + _escapeHtml(info.note) + '"' : '.'}</span></div>
                            <div class="si-meta">7 gün içinde düzenleyip tekrar gönderebilirsin · ${window.timeAgo(info.timestamp)}</div>
                        </div>
                    </div>
                    <button class="control-btn secondary notif-dismiss-btn" data-id="${item.key}" title="Bildirimi kaldır" class="si-action-btn" aria-label="Bildirimi kaldır"><i class="fa-solid fa-xmark"></i></button>
                </div>`;
    }

    function buildKudosNotifHtml(item) {
                const info = item.info;
                return `
                <div class="glass-element si-row-sb">
                    <div class="si-row-g10-min0">
                        ${window.avatarImgHtml({ displayName: info.fromName, avatarColor: info.fromColor, username: info.fromUser }, 38)}
                        <div class="si-min0">
                            <div class="si-title">
                                <span class="u-font-weight-600">${_escapeHtml(info.fromName || '')}</span>
                                <span class="si-muted"> sana </span>
                                <span class="u-font-size-16px">👏</span>
                                <span class="si-muted"> alkış gönderdi</span>
                            </div>
                            <div class="si-meta">${window.timeAgo(info.timestamp)}</div>
                        </div>
                    </div>
                    <button class="control-btn secondary notif-dismiss-btn" data-id="${item.key}" title="Bildirimi kaldır" class="si-action-btn" aria-label="Bildirimi kaldır"><i class="fa-solid fa-xmark"></i></button>
                </div>`;
    }

    function buildGroupGoalReachedNotifHtml(item) {
                const info = item.info;
                return `
                <div class="glass-element si-row-sb">
                    <div class="si-row-g10-min0">
                        <div class="u-width-38px_height-38px_border-radius-50pct_background-rgba-2">
                            <i class="fa-solid fa-trophy u-color-hfeca57_font-size-16px" ></i>
                        </div>
                        <div class="si-min0">
                            <div class="si-title">
                                <span class="u-font-weight-600">${_escapeHtml(info.groupName || '')}</span>
                                <span class="si-muted"> haftalık hedefi tamamladı 🎉</span>
                            </div>
                            <div class="si-meta">${window.timeAgo(info.timestamp)}${info.totalMinutes ? ` · ${window.formatFocusMinutes(info.totalMinutes)}/${window.formatFocusMinutes(info.weeklyGoal)}` : ''}</div>
                        </div>
                    </div>
                    <button class="control-btn secondary notif-dismiss-btn" data-id="${item.key}" title="Bildirimi kaldır" class="si-action-btn" aria-label="Bildirimi kaldır"><i class="fa-solid fa-xmark"></i></button>
                </div>`;
    }

    function buildReactionNotifHtml(item) {

            // Tepki bildirimi
            const info = item.info;
            return `
                <div class="glass-element si-row-sb">
                    <div class="si-row-g10-min0">
                        ${window.avatarImgHtml({ displayName: info.fromName, avatarColor: info.fromColor, username: info.fromUser }, 38)}
                        <div class="si-min0">
                            <div class="si-title">
                                <span class="u-font-weight-600">${_escapeHtml(info.fromName || '')}</span>
                                <span class="si-muted"> aktivitene </span>
                                <span class="u-font-size-16px">${_escapeHtml(info.emoji || '')}</span>
                                <span class="si-muted"> tepkisi verdi</span>
                            </div>
                            <div class="si-meta">${window.timeAgo(info.timestamp)}${info.activityText ? ' · "' + _escapeHtml(info.activityText) + '"' : ''}</div>
                        </div>
                    </div>
                    <button class="control-btn secondary notif-dismiss-btn" data-id="${item.key}" title="Bildirimi kaldır" class="si-action-btn" aria-label="Bildirimi kaldır"><i class="fa-solid fa-xmark"></i></button>
                </div>`;
    }

    const NOTIF_TYPE_BUILDERS = {
        mention: buildMentionNotifHtml,
        role_change: buildRoleChangeNotifHtml,
        group_slot_open: buildGroupSlotOpenNotifHtml,
        group_invite: buildGroupInviteNotifHtml,
        institution_invite: buildInstitutionInviteNotifHtml,
        classroom_weekly_digest: buildClassroomWeeklyDigestNotifHtml,
        focus_reminder: buildFocusReminderNotifHtml,
        assignment_reminder: buildAssignmentReminderNotifHtml,
        assignment_new: buildAssignmentNewNotifHtml,
        collab_plan_invite: buildCollabPlanInviteNotifHtml,
        lesson_plan_reminder: buildLessonPlanReminderNotifHtml,
        lesson_plan_new: buildLessonPlanNewNotifHtml,
        lesson_plan_accepted: buildLessonPlanAcceptedNotifHtml,
        lesson_plan_revision_requested: buildLessonPlanRevisionRequestedNotifHtml,
        lesson_plan_rejected: buildLessonPlanRejectedNotifHtml,
        kudos: buildKudosNotifHtml,
        group_goal_reached: buildGroupGoalReachedNotifHtml,
    };

    // Bildirim tipine göre doğru HTML üretici fonksiyona yönlendirir. 'request'/'dmRequest'
    // kind'a göre, geri kalanı item.info.type'a göre dispatch edilir (bkz. NOTIF_TYPE_BUILDERS).
    function buildNotificationItemHtml(item) {
        if (item.kind === 'request') return buildFriendRequestNotifHtml(item);
        if (item.kind === 'dmRequest') return buildDmRequestNotifHtml(item);
        const builder = NOTIF_TYPE_BUILDERS[item.info.type];
        if (builder) return builder(item);
        return buildReactionNotifHtml(item);
    }


    // renderNotificationsPanel'den ayrılan: bildirim listesindeki tüm buton/tıklama olaylarını bağlar.
    // Faz S devamı, dev fonksiyon refactoru.
    // Faz Dev-Dosya-Bölme: _wireNotificationsPanelEvents'in 12 bağımsız bildirim-türü
    // wiring bloğu module-seviyeye taşındı — her biri kendi CSS seçicisiyle sınırlı,
    // aralarında paylaşılan mutable state yok (sadece 'cp-plan-invite-notif' bloğu
    // `items`'a ihtiyaç duyuyor). Davranış birebir aynı.
    function _ctWireFrAccept(listEl) {
    listEl.querySelectorAll('.fr-accept-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const fromUser = btn.dataset.from;
            const fromName = btn.dataset.name;

            const friends = getFriends();
            if (!friends.includes(fromUser)) {
                friends.push(fromUser);
                saveFriends(friends);
            }
            window.markFriendSince(fromUser);
            // Akış içerik kararı (2026-07-05): kaldırıldı.
            populateHabitBuddySelect();

            const supaId = window.__getPendingFriendRequestsRef()[fromUser]?._supaId;
            if (supaId && window.FocusSupabase) {
                // Supabase yolu: friendship'i accepted yap
                window.FocusSupabase.from('friendships')
                    .update({ status: 'accepted', accepted_at: new Date().toISOString() })
                    .eq('id', supaId)
                    .then(({ error }) => { if (error) console.error('[FocusAI] arkadaşlık kabul hatası', error); });
                delete window.__getPendingFriendRequestsRef()[fromUser];
                renderNotificationsPanel();
            }

            if (typeof window.showPremiumModal === 'function') {
                window.showPremiumModal({ title: 'Yeni Arkadaş! 🎉', message: `${fromName} ile artık arkadaşsınız.`, type: 'success' });
            }
        });
    });
    }
    function _ctWireFrDecline(listEl) {

    listEl.querySelectorAll('.fr-decline-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const fromUser = btn.dataset.from;
            const supaId = window.__getPendingFriendRequestsRef()[fromUser]?._supaId;
            if (supaId && window.FocusSupabase) {
                window.FocusSupabase.from('friendships').delete().eq('id', supaId)
                    .then(() => {});
                delete window.__getPendingFriendRequestsRef()[fromUser];
                renderNotificationsPanel();
            }
        });
    });
    }
    function _ctWireNotifDismiss(listEl) {

    listEl.querySelectorAll('.notif-dismiss-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            if (window.FocusSupabase && getCurrentUser()?.id && window.__getNotificationsSupabaseRef()[id]) {
                // Optimistik silme: önce cache'den kaldır
                const backup = window.__getNotificationsSupabaseRef()[id];
                delete window.__getNotificationsSupabaseRef()[id];
                renderNotificationsPanel();
                // DB'den sil; başarısız olursa cache'e geri ekle
                const { error } = await window.FocusSupabase.from('notifications').delete().eq('id', id).eq('user_id', getCurrentUser().id);
                if (error) {
                    console.warn('[Bildirim] Silme hatası:', error.message);
                    window.__getNotificationsSupabaseRef()[id] = backup;
                    renderNotificationsPanel();
                }
            }
        });
    });
    }
    function _ctWireGroupInviteAccept(listEl) {

    listEl.querySelectorAll('.group-invite-accept-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            btn.disabled = true;
            const code = btn.dataset.code;
            const notifId = btn.dataset.id;
            if (!code || typeof window.joinGroupWithCode !== 'function') { btn.disabled = false; return; }
            try {
                await window.joinGroupWithCode(code);
                // Katılım başarılı (ya da onay bekliyor) — davet bildirimi artık gereksiz
                if (getCurrentUser()?.id && window.__getNotificationsSupabaseRef()[notifId]) {
                    delete window.__getNotificationsSupabaseRef()[notifId];
                    if (window.FocusSupabase) {
                        await window.FocusSupabase.from('notifications').delete().eq('id', notifId).eq('user_id', getCurrentUser().id);
                    }
                }
                renderNotificationsPanel();
            } catch (e) {
                // Grup artık mevcut değilse (silinmiş/kod geçersiz) bildirim asla kabul edilemeyecektir — temizle
                const msg = e?.message || '';
                if (msg.includes('bulunamadı') && getCurrentUser()?.id && window.__getNotificationsSupabaseRef()[notifId]) {
                    delete window.__getNotificationsSupabaseRef()[notifId];
                    if (window.FocusSupabase) {
                        await window.FocusSupabase.from('notifications').delete().eq('id', notifId).eq('user_id', getCurrentUser().id);
                    }
                    window.dcShowToast('Bu grup artık mevcut değil, davet kaldırıldı.');
                    renderNotificationsPanel();
                } else {
                    window.dcShowToast(msg || 'Gruba katılırken hata oluştu.');
                    btn.disabled = false;
                }
            }
        });
    });
    }
    function _ctWireGroupInviteDecline(listEl) {

    listEl.querySelectorAll('.group-invite-decline-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            btn.disabled = true;
            const notifId = btn.dataset.id;
            if (getCurrentUser()?.id && window.__getNotificationsSupabaseRef()[notifId]) {
                delete window.__getNotificationsSupabaseRef()[notifId];
                renderNotificationsPanel();
                if (window.FocusSupabase) {
                    const { error } = await window.FocusSupabase.from('notifications').delete().eq('id', notifId).eq('user_id', getCurrentUser().id);
                    if (error) console.warn('[Bildirim] Grup daveti reddedilirken silme hatası:', error.message);
                }
            }
        });
    });
    }
    function _ctWireInstitutionInviteAccept(listEl) {

    listEl.querySelectorAll('.institution-invite-accept-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            btn.disabled = true;
            const notifId = btn.dataset.id;
            const inviteId = btn.dataset.inviteId;
            if (!inviteId || !window.FocusSupabase) { btn.disabled = false; return; }
            const { error } = await window.FocusSupabase.rpc('accept_institution_invite', { p_invite_id: inviteId });
            if (error) {
                window.dcShowToast('Davet kabul edilemedi: ' + error.message, 'error');
                btn.disabled = false;
                return;
            }
            if (getCurrentUser()?.id && window.__getNotificationsSupabaseRef()[notifId]) {
                delete window.__getNotificationsSupabaseRef()[notifId];
                await window.FocusSupabase.from('notifications').delete().eq('id', notifId).eq('user_id', getCurrentUser().id);
            }
            window.dcShowToast('Sınıfa katıldın! 🎉', 'success');
            renderNotificationsPanel();
            if (typeof window.loadMyGroups === 'function') window.loadMyGroups();
            if (typeof window.loadUserGroupsForDc === 'function') window.loadUserGroupsForDc();
        });
    });
    }
    function _ctWireInstitutionInviteDecline(listEl) {

    listEl.querySelectorAll('.institution-invite-decline-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            btn.disabled = true;
            const notifId = btn.dataset.id;
            const inviteId = btn.dataset.inviteId;
            if (inviteId && window.FocusSupabase) {
                await window.FocusSupabase.from('institution_invites').update({ status: 'rejected', responded_at: new Date().toISOString() }).eq('id', inviteId);
            }
            if (getCurrentUser()?.id && window.__getNotificationsSupabaseRef()[notifId]) {
                delete window.__getNotificationsSupabaseRef()[notifId];
                await window.FocusSupabase.from('notifications').delete().eq('id', notifId).eq('user_id', getCurrentUser().id);
            }
            renderNotificationsPanel();
        });
    });
    }
    function _ctWireDmReqAdd(listEl) {

    listEl.querySelectorAll('.dm-req-add-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const fromUser = btn.dataset.from;
            const fromName = btn.dataset.name;

            const friends = getFriends();
            if (!friends.includes(fromUser)) {
                friends.push(fromUser);
                saveFriends(friends);
            }
            window.markFriendSince(fromUser);
            // Akış içerik kararı (2026-07-05): kaldırıldı.
            populateHabitBuddySelect();
            window._syncFriendAcceptToSupabase(fromUser);
            if (window.FocusSupabase && getCurrentUser().id && __getPendingDmRequestsSupabaseRef()[fromUser]) {
                window.FocusSupabase.from('conversations').update({ status: 'accepted' })
                    .eq('id', __getPendingDmRequestsSupabaseRef()[fromUser].conversationId);
            }

            if (typeof window.showPremiumModal === 'function') {
                window.showPremiumModal({ title: 'Yeni Arkadaş! 🎉', message: `${fromName} ile artık arkadaşsınız.`, type: 'success' });
            }
            if (typeof window.openDcDmRoom === 'function') window.openDcDmRoom(fromUser, fromName);
        });
    });
    }
    function _ctWireDmReqContinue(listEl) {

    listEl.querySelectorAll('.dm-req-continue-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const fromUser = btn.dataset.from;
            const fromName = btn.dataset.name;
            if (window.FocusSupabase && getCurrentUser().id && __getPendingDmRequestsSupabaseRef()[fromUser]) {
                window.FocusSupabase.from('conversations').update({ status: 'accepted' })
                    .eq('id', __getPendingDmRequestsSupabaseRef()[fromUser].conversationId);
            }
            if (typeof window.openDcDmRoom === 'function') window.openDcDmRoom(fromUser, fromName);
        });
    });
    }
    function _ctWireDiscoverSavedSlotNotif(listEl) {

    listEl.querySelectorAll('.discover-saved-slot-notif').forEach(el => {
        el.addEventListener('click', (e) => {
            if (e.target.closest('.notif-dismiss-btn')) return;
            if (el.dataset.lessonPlanJump === '1') {
                if (typeof window.switchTab === 'function') window.switchTab('planlama');
                return;
            }
            const groupCode = el.dataset.group;
            if (el.dataset.assignmentJump === '1' && groupCode && typeof window.dcOpenAssignmentTab === 'function') {
                window.dcOpenAssignmentTab(groupCode);
                return;
            }
            if (groupCode && typeof openSavedGroupPreview === 'function') {
                openSavedGroupPreview(groupCode);
            }
        });
    });
    }
    function _ctWireCpPlanInviteNotif(listEl, items) {

    listEl.querySelectorAll('.cp-plan-invite-notif').forEach(el => {
        el.addEventListener('click', (e) => {
            if (e.target.closest('.notif-dismiss-btn')) return;
            const item = items.find(it => it.key === el.dataset.id);
            if (item) window._handleCollabPlanInvite(item.info);
        });
    });
    }
    function _ctWireDcMentionNotif(listEl) {

    listEl.querySelectorAll('.dc-mention-notif').forEach(el => {
        el.addEventListener('click', (e) => {
            if (e.target.closest('.notif-dismiss-btn')) return;
            const { dm, from, fromName, group, scopeType, scopeId, room, channel, roomName } = el.dataset;
            if (dm === '1') {
                if (from && typeof window.openDcDmRoom === 'function') window.openDcDmRoom(from, fromName || from);
            } else if (group && scopeType && scopeId && typeof window.openGroupMentionNotif === 'function') {
                window.openGroupMentionNotif(group, scopeType, scopeId, roomName);
            } else if (group && room && typeof window.openDcChatRoom === 'function') {
                window.openDcChatRoom(group, roomName || room, room, channel || null);
            }
        });
    });
    }
    function _wireNotificationsPanelEvents(listEl, items) {
        _ctWireFrAccept(listEl);
        _ctWireFrDecline(listEl);
        _ctWireNotifDismiss(listEl);
        _ctWireGroupInviteAccept(listEl);
        _ctWireGroupInviteDecline(listEl);
        _ctWireInstitutionInviteAccept(listEl);
        _ctWireInstitutionInviteDecline(listEl);
        _ctWireDmReqAdd(listEl);
        _ctWireDmReqContinue(listEl);
        _ctWireDiscoverSavedSlotNotif(listEl);
        _ctWireCpPlanInviteNotif(listEl, items);
        _ctWireDcMentionNotif(listEl);
    }

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

    // "Bu Haftanın En Çok Gelişeni" — mutlak XP değil, geçen haftaya göre artışı
    // ödüllendirir (pozitif rekabet: zaten üstte olan sürekli kazanmasın, herkesin
    // şansı olsun). Grup tarafındaki "Yükselen Yıldız" rozetiyle aynı mantık (bkz.
    // gscSessionsCache yakınındaki addBadge çağrıları), burada arkadaş listesine uyarlandı.
    function renderMostImprovedBadge(visibleUsers) {
        const el = document.getElementById('leaderboard-improved-badge');
        if (!el) return;
        const candidates = visibleUsers
            .filter(u => typeof u.prevWeeklyXp === 'number' && u.weeklyXp > 0)
            .map(u => ({ ...u, _delta: u.weeklyXp - u.prevWeeklyXp }))
            .filter(u => u._delta > 0)
            .sort((a, b) => b._delta - a._delta);

        if (candidates.length < 1 || visibleUsers.length < 2) {
            el.classList.add('hidden');
            el.innerHTML = '';
            return;
        }
        const best = candidates[0];
        const name = best.isMe ? 'Sen' : _escapeHtml(best.displayName || best.username);
        el.classList.remove('hidden');
        el.innerHTML = `<span class="lb-improved-icon">🚀</span> Bu haftanın en çok gelişeni: <span class="lb-improved-name">${name}</span> — geçen haftaya göre +${best._delta} XP`;
    }

    // Sıra değişim oku (B2): bir önceki render'a göre kimin yükselip kimin
    // düştüğünü tespit eder. İlk render'da (önceki harita boşsa) ok gösterilmez.
    const _lastRankByScope = { friends: {}, league: {} };
    function computeRankDeltas(scope, sortedUsers) {
        const prev = _lastRankByScope[scope];
        const hadPrev = Object.keys(prev).length > 0;
        const next = {};
        const withDelta = sortedUsers.map((u, i) => {
            const prevRank = prev[u.username];
            const delta = (hadPrev && prevRank !== undefined) ? (prevRank - i) : 0;
            next[u.username] = i;
            return { ...u, _rankDelta: delta };
        });
        _lastRankByScope[scope] = next;
        return withDelta;
    }

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

    // Canlı Sıralama — podyum/madalya yok; her satırda lidere göre XP dolum çubuğu,
    // kendi satırında bir öndekiyle arasındaki fark rozeti (pozitif rekabet vurgusu).
    function renderLeaderboard(users, container) {
        if (!users.length) {
            container.innerHTML = `
                <li class="u-text-align-center_color-var-text-muted_padding-30px20px_fo">
                    <i class="fa-solid fa-users u-font-size-24px_margin-bottom-10px_display-block_color-rgba" ></i>
                    Arkadaş ekle ve sıralamada yarış!
                </li>`;
            return;
        }
        const topXp = Math.max(users[0]?.weeklyXp || 0, 1);
        container.innerHTML = users.map((u, i) => {
            const wxp = u.weeklyXp || 0;
            const pct = Math.max(2, Math.round((wxp / topXp) * 100));
            const ahead = i > 0 ? users[i - 1] : null;
            const gap = ahead ? Math.max(0, (ahead.weeklyXp || 0) - wxp) : 0;
            const gapChip = u.isMe && ahead
                ? `<span class="lb-gap-chip"><i class="fa-solid fa-bolt"></i> ${gap} XP kaldı</span>`
                : (u.isMe ? '<span class="lb-gap-chip lb-gap-chip--leader"><i class="fa-solid fa-crown"></i> Lidersin</span>' : '');
            const L = leagueOf(u.league);
            const leagueBadge = `<span class="lb-league-badge" data-dyn-color="${L.color}" data-dyn-bordercolor="${L.color}44" data-dyn-bg="${L.color}1a" title="${L.name} Ligi"><i class="fa-solid ${L.icon}"></i> ${L.name}</span>`;

            const zoneClass = u._zone === 'promo' ? ' lb-row--promo' : (u._zone === 'demo' ? ' lb-row--demo' : '');
            const rankDeltaChip = u._rankDelta > 0
                ? `<span class="lb-rank-delta lb-rank-delta--up"><i class="fa-solid fa-caret-up"></i></span>`
                : (u._rankDelta < 0 ? `<span class="lb-rank-delta lb-rank-delta--down"><i class="fa-solid fa-caret-down"></i></span>` : '');
            return `
                <li class="lb-row${u.isMe ? ' lb-row--me' : ''}${zoneClass}" data-dyn-delay="${Math.min(i, 15) * 35}ms">
                    <span class="lb-rank">${i + 1}</span>
                    ${avatarImgHtml(u, 32, 'flex-shrink:0;')}
                    <div class="lb-main">
                        <div class="lb-name-line">
                            ${rankDeltaChip}
                            <span class="lb-name">${_escapeHtml(u.displayName || u.username)}${u.isMe ? '<span class="lb-me-tag"> (Sen)</span>' : ''}</span>
                            ${leagueBadge}
                            ${gapChip}
                            <span class="lb-xp" title="Bu haftaki XP — toplam ${u.xp || 0} XP">${wxp} XP</span>
                        </div>
                        <div class="lb-bar"><div class="lb-bar-fill${u.isMe ? ' lb-bar-fill--me' : ''}" data-dyn-w="${pct}%"></div></div>
                    </div>
                </li>`;
        }).join('');
        _applyDynStyles(container);
    }


