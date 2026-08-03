// social-dc-profile-resolve.js
// social.js'ten çıkarıldı (Faz E — çekirdek bölge derin taraması, 2026-07-23):
// Supabase profil çözümleme cache'i (_resolveProfileByUsername/
// _resolveProfileById) + mesaj tepkisi haritası (_fetchDcReactionsMap) +
// Supabase mesaj satırını render formatına çevirme (_normalizeSupabase
// MessageBase/DmMessage/GroupMessage). Kendi state'i (_profileCache/
// _profileCacheById) tamamen izole.
//
// Dış bağımlılıklar (window.* üzerinden): getCurrentUser(),
// window.FocusSupabase, window.__getProfileIdByUsernameRef.

    // ──────────────────────────────────────────────────────
    // SUPABASE: profil bilgisi cache'i — DM mesajlarını render etmek için
    // karşı tarafın display_name/avatar_color/custom_avatar bilgisi gerekir.
    // ──────────────────────────────────────────────────────
import { getCurrentUser } from './state/current-user-store.js';
import { __getProfileIdByUsernameRef } from './social-friends-notifications.js';
    let _profileCache = {};   // username -> profiles satırı
    let _profileCacheById = {}; // id -> profiles satırı

export async function _resolveProfileByUsername(username) {
        if (!username) return null;
        if (_profileCache[username]) return _profileCache[username];
        if (!window.FocusSupabase) return null;
        try {
            const { data, error } = await window.FocusSupabase
                .from('profiles')
                .select('id, username, display_name, avatar_color, custom_avatar, avatar_initials')
                .eq('username', username)
                .maybeSingle();
            if (error || !data) return null;
            _profileCache[username] = data;
            _profileCacheById[data.id] = data;
            __getProfileIdByUsernameRef()[username] = data.id;
            return data;
        } catch { return null; }
    }
    window._resolveProfileByUsername = _resolveProfileByUsername;

    // "Son Mesajlaşmalar"/DM istekleri Supabase `conversations` satırlarından
    // yalnızca `user_a`/`user_b` (uuid) bilgisini verir — karşı tarafın
    // username/display_name/avatar'ına ihtiyaç duyulur.
export async function _resolveProfileById(id) {
        if (!id) return null;
        if (_profileCacheById[id]) return _profileCacheById[id];
        if (!window.FocusSupabase) return null;
        try {
            const { data, error } = await window.FocusSupabase
                .from('profiles')
                .select('id, username, display_name, avatar_color, custom_avatar, avatar_initials, institution_role')
                .eq('id', id)
                .maybeSingle();
            if (error || !data) return null;
            _profileCacheById[id] = data;
            if (data.username) {
                _profileCache[data.username] = data;
                __getProfileIdByUsernameRef()[data.username] = data.id;
            }
            return data;
        } catch { return null; }
    }
    window._resolveProfileById = _resolveProfileById;

    // Bir scope'taki (dm/group/group_channel/group_subchannel) tüm mesaj
    // tepkilerini { message_id: { username: emoji } } şeklinde döndürür.
export async function _fetchDcReactionsMap(scopeType, scopeId) {
        if (!window.FocusSupabase || !scopeId) return {};
        const { data, error } = await window.FocusSupabase
            .from('message_reactions')
            .select('message_id, user_id, emoji')
            .eq('scope_type', scopeType)
            .eq('scope_id', scopeId);
        if (error || !data) return {};
        const map = {};
        for (const row of data) {
            const profile = await _resolveProfileById(row.user_id);
            const uname = profile?.username || row.user_id;
            (map[row.message_id] = map[row.message_id] || {})[uname] = row.emoji;
        }
        return map;
    }

    window._fetchDcReactionsMap = _fetchDcReactionsMap;

    // Supabase `messages` satırını renderDcMessage'ın beklediği eski (Firebase)
    // mesaj şekline çevirir. DM'de yalnızca 2 katılımcı olduğundan tam profil
    // listesine gerek yok: gönderen ben isem getCurrentUser(), değilse otherProfile.
    // DM ve grup mesajlarının ortak alanları (gönderen bilgisi hariç) — her iki
    // normalize fonksiyonu da bunun üstüne kendi profil çözümleme mantığını ekler.
    function _normalizeSupabaseMessageBase(row) {
        return {
            timestamp: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
            text: row.text || undefined,
            enc: row.enc || undefined,
            replyTo: row.reply_to || undefined,
            edited: !!row.edited,
            mentions: row.mentions || []
        };
    }

export function _normalizeSupabaseDmMessage(row, otherProfile) {
        const isMe = row.sender_id === getCurrentUser().id;
        const p = isMe
            ? getCurrentUser()
            : {
                username: otherProfile?.username,
                displayName: otherProfile?.display_name || otherProfile?.username,
                avatarColor: otherProfile?.avatar_color || '6c5ce7',
                customAvatar: otherProfile?.custom_avatar || null, avatarInitials: otherProfile?.avatar_initials || null
            };
        return {
            ..._normalizeSupabaseMessageBase(row),
            username: p.username,
            displayName: p.displayName,
            avatarColor: p.avatarColor || '6c5ce7',
            customAvatar: p.customAvatar || null
        };
    }
    window._normalizeSupabaseDmMessage = _normalizeSupabaseDmMessage;

    // Supabase `messages` satırını (scope_type='group') renderDcMessage'ın
    // beklediği eski (Firebase) mesaj şekline çevirir. DM'in aksine gönderen
    // herhangi bir grup üyesi olabilir — _resolveProfileById ile çözülür.
export async function _normalizeSupabaseGroupMessage(row) {
        const isMe = row.sender_id === getCurrentUser().id;
        const p = isMe ? getCurrentUser() : await _resolveProfileById(row.sender_id);
        const cwInviteAtt = Array.isArray(row.attachments) && row.attachments[0]?.kind === 'cw_room_invite'
            ? row.attachments[0] : null;
        return {
            ..._normalizeSupabaseMessageBase(row),
            username: p?.username || (isMe ? getCurrentUser().username : 'unknown'),
            displayName: (isMe ? getCurrentUser().displayName : p?.display_name) || p?.username || 'Kullanıcı',
            avatarColor: (isMe ? getCurrentUser().avatarColor : p?.avatar_color) || '6c5ce7',
            customAvatar: (isMe ? getCurrentUser().customAvatar : p?.custom_avatar) || null,
            institutionRole: (isMe ? getCurrentUser().institutionRole : p?.institution_role) || 'member',
            challengeId: row.challenge_id || undefined,
            attachments: row.attachments || undefined,
            pollId: row.poll_id || undefined,
            type: cwInviteAtt ? 'cw_room_invite' : undefined,
            cwInvite: cwInviteAtt || undefined
        };
    }
    // Farklı (kardeş) IIFE kapsamındaki "Son Mesajlaşmalar" kodu için global erişim
    window._normalizeSupabaseGroupMessage = _normalizeSupabaseGroupMessage;


