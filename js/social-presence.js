import { _resolveProfileByUsername } from './social-dc-profile-resolve.js';
import { __getProfileIdByUsernameRef, getFriends } from './social-friends-notifications.js';
import { getCurrentUser } from '../state/current-user-store.js';
// ─── PRESENCE (ÇEVRİMİÇİ DURUM) ────────────────────────────────────
// social.js dosyasından çıkarıldı (Faz 6): heartbeat + hedefli polling motoru.
//
// Presence artık paylaşımlı bir Realtime kanalıyla (anlık broadcast) değil,
// periyodik DB heartbeat + hedefli polling ile çalışır (Karar 2026-07-13):
// eski 'community-presence' kanalına HER online kullanıcı katılıyordu ve her
// durum değişimi tüm o an online olanlara anlık yayınlanıyordu — mesaj hacmi
// eşzamanlı kullanıcı sayısıyla karesel büyüyor, Supabase free tier'ın aylık
// realtime mesaj kotasına bağlantı limitinden önce çarpma riski taşıyordu.
// Yeni model cw_room_heartbeat (075_cw_room_heartbeat.sql) ile aynı desen:
// istemci kendi durumunu presence_heartbeat RPC'siyle (120 migration) periyodik
// yazar, ilgilendiği kullanıcıları (arkadaşlar/grup/sınıf üyeleri/seans katılımcıları
// — bkz. registerPresenceWatchIds) periyodik olarak tek bir sorguda okur.
// getCommunityPresenceState()'in dönüş şekli eskisiyle aynı kalır, böylece onu
// tüketen tüm ekranlar (leaderboard, online-arkadaşlar, grup/sınıf rozetleri vb.)
// değişmeden çalışmaya devam eder — sadece veri artık ~45-60sn gecikmeli.
//
// Dış bağımlılıklar:
// - _presencePayload / _polledPresenceCache: social.js'teki Ortak Odaklanma
//   koduyla (setFocusState/gscGetFocusingNow/setWaitingState/gscGetWaitingNow/
//   getCommunityPresenceState — DOKUNULMAMASI gereken çekirdek) PAYLAŞIMLI.
//   _presencePayload dışarıdan hem okunuyor hem REASSIGN ediliyor, bu yüzden
//   getter+setter köprüsü (window.__getPresencePayload/__setPresencePayload)
//   kuruldu. _polledPresenceCache dışarıdan sadece okunuyor, salt-okunur
//   getter (window.__getPolledPresenceCache) yeterli.
// - _presenceHeartbeatTick: setFocusState/setWaitingState tarafından
//   doğrudan çağrılıyor → window._presenceHeartbeatTick köprüsü.
// - startPresence: social.js'te 2 yerden bare çağrılıyordu → window.startPresence.
// - getCurrentUser() / window.FocusSupabase / window.getFriends /
//   window.__getProfileIdByUsernameRef / window.__getGscSessionsCacheRef →
//   zaten global.
    let _presencePayload = null;
    let _polledPresenceCache = {};
    let _presenceWatchIds = new Set();
    let _presenceHeartbeatInterval = null;
    const PRESENCE_HEARTBEAT_MS = 45000;

    window.__getPresencePayload = () => _presencePayload;
    window.__setPresencePayload = (v) => { _presencePayload = v; };
    window.__getPolledPresenceCache = () => _polledPresenceCache;

    export function registerPresenceWatchIds(ids) {
        (ids || []).forEach(id => { if (id) _presenceWatchIds.add(id); });
    }
    window.registerPresenceWatchIds = registerPresenceWatchIds;

    window._presenceHeartbeatTick = _presenceHeartbeatTick; // setFocusState/setWaitingState (social.js) için
    async function _presenceHeartbeatTick() {
        if (!window.FocusSupabase || !_presencePayload) return;
        window.FocusSupabase.rpc('presence_heartbeat', {
            p_studying: !!_presencePayload.studying,
            p_focus_mode: _presencePayload.focusMode || null,
            p_gsc_session_id: _presencePayload.gscSessionId || null,
            p_waiting_session_id: _presencePayload.waitingForSessionId || null
        }).then(() => {}).catch(() => {});
    }

    async function _refreshWatchedPresence() {
        if (!window.FocusSupabase || !getCurrentUser()?.id) return;
        // Sayfa yeni yüklendiğinde (hard refresh) _profileIdByUsername henüz boştur —
        // arkadaşların profile id'leri sadece Kişiler/DM panelleri render olunca
        // (_resolveProfileByUsername ile) dolar. O panel bu ilk tick'ten SONRA
        // çalışırsa arkadaşlar bu turda hiç sorgulanmaz ve 45sn boyunca hepsi
        // "çevrimdışı" görünür. Burada arkadaş listesini doğrudan çözüp id'lerini
        // önceden garantiye alıyoruz — böylece ilk çağrıda da doğru sonuç gelir.
        try {
            const friendUsernames = getFriends();
            const missingUsernames = friendUsernames.filter(u => u && !__getProfileIdByUsernameRef()[u]);
            if (missingUsernames.length) {
                const { data: friendProfiles } = await window.FocusSupabase
                    .from('profiles').select('id, username').in('username', missingUsernames);
                (friendProfiles || []).forEach(p => { if (p.username) __getProfileIdByUsernameRef()[p.username] = p.id; });
            }
        } catch (e) { /* arkadaş id çözümü başarısız olsa da presence akışı devam etsin */ }
        registerPresenceWatchIds(Object.values(__getProfileIdByUsernameRef() || {}));
        // `gscSessionsCache` artık social-group-details.js'te tanımlı (Faz 5
        // çıkarması) — window.__getGscSessionsCacheRef() köprüsüyle okunuyor.
        // Modül henüz yüklenmediyse (erken tetiklenme) boş nesne kullan.
        const _gscCache = typeof window.__getGscSessionsCacheRef === 'function' ? window.__getGscSessionsCacheRef() : {};
        registerPresenceWatchIds(Object.values(_gscCache).flatMap(s =>
            s.attendees ? Object.values(s.attendees).map(a => a.userId) : []));
        _presenceWatchIds.add(getCurrentUser().id);
        const ids = [..._presenceWatchIds];
        if (!ids.length) return;

        const { data } = await window.FocusSupabase
            .from('profiles')
            .select('id, username, last_seen, is_focusing, focus_mode, gsc_session_id, waiting_for_session_id')
            .in('id', ids);

        const cache = {};
        const cutoff = Date.now() - PRESENCE_HEARTBEAT_MS * 2;
        (data || []).forEach(p => {
            const lastSeenMs = p.last_seen ? new Date(p.last_seen).getTime() : 0;
            if (lastSeenMs < cutoff) return; // heartbeat eskimiş -> offline sayılır, cache'e girmez
            const entry = [{
                user_id: p.id,
                username: p.username || null,
                studying: !!p.is_focusing,
                focusMode: p.focus_mode || null,
                gscSessionId: p.gsc_session_id || null,
                waitingForSessionId: p.waiting_for_session_id || null
            }];
            cache[p.id] = entry;
            // Bazı tüketiciler (subscribeOnlineFriends, grup/kişi panelleri) cache'i
            // profile id yerine username ile sorguluyor — ikisiyle de erişilebilsin
            // diye aynı girdi username anahtarıyla da ekleniyor.
            if (p.username) cache[p.username] = entry;
        });
        _polledPresenceCache = cache;
        window.dispatchEvent(new CustomEvent('focusai:presence-changed'));
    }

    window.startPresence = startPresence; // social.js'te 2 yerden bare çağrılıyordu
    function startPresence() {
        if (!getCurrentUser()) return;
        if (!window.FocusSupabase || !getCurrentUser().id) return;

        _presencePayload = {
            user_id: getCurrentUser().id,
            studying: false,
            focusMode: null,
            gscSessionId: null,
            waitingForSessionId: null
        };

        if (_presenceHeartbeatInterval) clearInterval(_presenceHeartbeatInterval);
        _presenceHeartbeatTick();
        _presenceHeartbeatInterval = setInterval(_presenceHeartbeatTick, PRESENCE_HEARTBEAT_MS);

        _refreshWatchedPresence();
        setInterval(_refreshWatchedPresence, PRESENCE_HEARTBEAT_MS);
    }
