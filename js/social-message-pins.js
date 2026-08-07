import { _normalizeSupabaseDmMessage, _normalizeSupabaseGroupMessage } from './social-dc-profile-resolve.js';
import { getActiveChatTarget } from '../state/active-chat-target-store.js';
import { getDB, getUser } from './social-misc-pure-utils.js';
// ─── SABİTLENMİŞ MESAJLAR ──────────────────────────────────────────────
// social.js dosyasından çıkarıldı (Faz 2, 2026-07-19 — yüksek risk grubu).
//
// Bu özellik "şu an açık olan sohbet" durumuna (currentUser,
// _dcCurrentConversation, _dcCurrentGroupScope, _dcCurrentMsgPath,
// _dcCurrentOtherProfile, _dcCurrentRole) bağımlı — bunlar social.js'in
// yüzlerce başka yerinde de okunup yazılan paylaşılan değişkenler, o yüzden
// hepsini buraya taşımak (ve social.js'teki tüm kullanımlarını güncellemek)
// kapsam dışı ve gereksiz derecede riskli olurdu.
//
// Bunun yerine: social.js şimdi window._dcGetChatContext() adlı SALT-OKUNUR
// bir getter açıyor (bkz. social.js, _dcCurrentConversation tanımının hemen
// altı). Bu modül state'i hiç YAZMIYOR, sadece her ihtiyaç duyduğunda
// window._dcGetChatContext() çağırıp GÜNCEL değerleri okuyor — snapshot değil,
// canlı okuma. getDB/getUser/_normalizeSupabaseDmMessage/jumpToDcMsg da
// benzer şekilde social.js'te window.* köprüsüyle açıldı.
let _dcPinnedRef             = null;  // Sabitlenmiş mesajlar dinleyicisi (Firebase)
let _dcPinnedPath            = null;  // Sabitlenmiş mesajlar Firebase yolu
let _dcPinnedMsgs            = {};    // key -> { text, displayName, username, timestamp, pinnedBy }
let _dcPinnedIndex           = 0;     // Banner'da gösterilen sabitlenmiş mesaj indexi
let _dcPinnedChannel         = null;  // `message_pins` tablosu realtime kanalı (DM/grup)
let _dcPinnedConversationId  = null;  // Sabitleme kanalının bağlı olduğu conversation id (DM)
let _dcPinnedScope           = null;  // Sabitleme kanalının bağlı olduğu { type, id } (grup/kanal)

export function isDcMsgPinned(msgKey) {
    return !!_dcPinnedMsgs[msgKey];
}
window.isDcMsgPinned = isDcMsgPinned;

export function dcPinnedPathFor(chatPath) {
    if (/\/messages$/.test(chatPath)) {
        // Grup/kanal mesaj yolu: ".../messages" -> ".../pinned"
        return chatPath.replace(/\/messages$/, '/pinned');
    }
    // DM mesajları doğrudan dmPath altında saklanır — sabitlenenleri ayrı bir meta yoluna koy
    const dmId = chatPath.split('/').pop();
    return `focusai_community/dm_meta/${dmId}/pinned`;
}
window.dcPinnedPathFor = dcPinnedPathFor;

export function teardownDcPinned() {
    if (_dcPinnedRef) { _dcPinnedRef.off(); _dcPinnedRef = null; }
    _dcPinnedPath  = null;
    _dcPinnedMsgs  = {};
    _dcPinnedIndex = 0;
    renderDcPinnedBanner();
}
window.teardownDcPinned = teardownDcPinned;

export function setupDcPinned(chatPath) {
    const database = getDB();
    if (!database) return;
    teardownDcPinned();
    _dcPinnedPath = dcPinnedPathFor(chatPath);
    _dcPinnedRef  = database.ref(_dcPinnedPath);
    _dcPinnedRef.on('value', snap => {
        _dcPinnedMsgs  = snap.val() || {};
        _dcPinnedIndex = 0;
        renderDcPinnedBanner();
        // Açık mesajların sabitlenme rozetini güncelle
        document.querySelectorAll('#sidebar-chat-messages-stream [data-action="pin"]').forEach(btn => {
            const row = btn.closest('[data-msg-key]');
            const key = row && row.dataset.msgKey;
            const isPinned = !!key && !!_dcPinnedMsgs[key];
            btn.classList.toggle('is-selected', isPinned);
            btn.title = isPinned ? 'Sabitlemeyi kaldır' : 'Sabitle';
        });
    });
}
window.setupDcPinned = setupDcPinned;

// ─── SABİTLENMİŞ MESAJLAR (DM — Supabase `message_pins`) ───────────
export function teardownDmPinnedSupabase() {
    if (_dcPinnedChannel) {
        window.FocusSupabase.removeChannel(_dcPinnedChannel);
        _dcPinnedChannel = null;
    }
    _dcPinnedConversationId = null;
}
window.teardownDmPinnedSupabase = teardownDmPinnedSupabase;

export function refreshDmPinned() {
    if (!_dcPinnedConversationId || !window.FocusSupabase) return;
    window.FocusSupabase
        .from('message_pins')
        .select('message_id, pinned_by, messages(*)')
        .eq('conversation_id', _dcPinnedConversationId)
        .order('created_at', { ascending: true })
        .then(async ({ data, error }) => {
            if (error) { console.error('[DM] sabitlenmiş mesajlar okunamadı', error); return; }
            _dcPinnedMsgs = {};
            const ctx = window._dcGetChatContext();
            await Promise.all((data || []).map(async row => {
                if (!row.messages) return;
                const m = _normalizeSupabaseDmMessage(row.messages, ctx.otherProfile);
                let text = m.text || '';
                if (m.enc) {
                    const otherUsername = m.username === ctx.currentUser.username
                        ? ctx.otherProfile?.username
                        : m.username;
                    const plain = otherUsername ? await window.decryptDmText(otherUsername, m.enc) : null;
                    if (plain !== null) text = plain;
                }
                _dcPinnedMsgs[row.message_id] = {
                    text,
                    displayName: m.displayName,
                    username: m.username,
                    timestamp: m.timestamp,
                    pinnedBy: row.pinned_by
                };
            }));
            _dcPinnedIndex = 0;
            renderDcPinnedBanner();
            document.querySelectorAll('#sidebar-chat-messages-stream [data-action="pin"]').forEach(btn => {
                const row = btn.closest('[data-msg-key]');
                const key = row && row.dataset.msgKey;
                const isPinned = !!key && !!_dcPinnedMsgs[key];
                btn.classList.toggle('is-selected', isPinned);
                btn.title = isPinned ? 'Sabitlemeyi kaldır' : 'Sabitle';
            });
        });
}
window.refreshDmPinned = refreshDmPinned;

export function setupDmPinnedSupabase(conversation) {
    teardownDcPinned();
    teardownDmPinnedSupabase();
    teardownGroupPinnedSupabase();
    _dcPinnedConversationId = conversation.id;
    refreshDmPinned();
    _dcPinnedChannel = window.FocusSupabase
        .channel(`dm-pins-${conversation.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'message_pins', filter: `conversation_id=eq.${conversation.id}` }, () => refreshDmPinned())
        .subscribe();
}
window.setupDmPinnedSupabase = setupDmPinnedSupabase;

// ─── SABİTLENMİŞ MESAJLAR (Grup/Kanal — Supabase `message_pins`) ───
export function teardownGroupPinnedSupabase() {
    if (_dcPinnedChannel) {
        window.FocusSupabase.removeChannel(_dcPinnedChannel);
        _dcPinnedChannel = null;
    }
    _dcPinnedScope = null;
}
window.teardownGroupPinnedSupabase = teardownGroupPinnedSupabase;

export function refreshGroupPinned() {
    if (!_dcPinnedScope || !window.FocusSupabase) return;
    const scope = _dcPinnedScope;
    window.FocusSupabase
        .from('message_pins')
        .select('message_id, pinned_by, messages(*)')
        .eq('scope_type', scope.type)
        .eq('scope_id', scope.id)
        .order('created_at', { ascending: true })
        .then(async ({ data, error }) => {
            if (error) { console.error('[Grup] sabitlenmiş mesajlar okunamadı', error); return; }
            if (_dcPinnedScope !== scope) return;
            _dcPinnedMsgs = {};
            await Promise.all((data || []).map(async row => {
                if (!row.messages) return;
                const m = await _normalizeSupabaseGroupMessage(row.messages);
                _dcPinnedMsgs[row.message_id] = {
                    text: m.text || (m.enc ? (m.decryptedText || '') : ''),
                    displayName: m.displayName,
                    username: m.username,
                    timestamp: m.timestamp,
                    pinnedBy: row.pinned_by
                };
            }));
            if (_dcPinnedScope !== scope) return;
            _dcPinnedIndex = 0;
            renderDcPinnedBanner();
            document.querySelectorAll('#sidebar-chat-messages-stream [data-action="pin"]').forEach(btn => {
                const row = btn.closest('[data-msg-key]');
                const key = row && row.dataset.msgKey;
                const isPinned = !!key && !!_dcPinnedMsgs[key];
                btn.classList.toggle('is-selected', isPinned);
                btn.title = isPinned ? 'Sabitlemeyi kaldır' : 'Sabitle';
            });
        });
}
window.refreshGroupPinned = refreshGroupPinned;

export function setupGroupPinnedSupabase(scope) {
    teardownDcPinned();
    teardownDmPinnedSupabase();
    teardownGroupPinnedSupabase();
    _dcPinnedScope = scope;
    refreshGroupPinned();
    _dcPinnedChannel = window.FocusSupabase
        .channel(`group-pins-${scope.type}-${scope.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'message_pins', filter: `scope_id=eq.${scope.id}` }, () => refreshGroupPinned())
        .subscribe();
}
window.setupGroupPinnedSupabase = setupGroupPinnedSupabase;

export function toggleDcPinMessage(msgKey, m) {
    const user = getUser();
    if (!user || !msgKey) return;
    const ctx = window._dcGetChatContext();

    if (ctx.dmConversation && window.FocusSupabase && ctx.currentUser?.id) {
        if (_dcPinnedMsgs[msgKey]) {
            window.FocusSupabase.from('message_pins').delete().eq('message_id', msgKey)
                .then(({ error }) => { if (error) console.error('[DM] sabit kaldırma hatası', error); });
        } else {
            window.FocusSupabase.from('message_pins').insert({
                message_id: msgKey,
                conversation_id: ctx.dmConversation.id,
                pinned_by: ctx.currentUser.id
            }).then(({ error }) => { if (error) console.error('[DM] sabitleme hatası', error); });
        }
        return;
    }

    if (ctx.groupScope && window.FocusSupabase && ctx.currentUser?.id) {
        const scope = ctx.groupScope;
        if (_dcPinnedMsgs[msgKey]) {
            window.FocusSupabase.from('message_pins').delete().eq('message_id', msgKey)
                .then(({ error }) => { if (error) console.error('[Grup] sabit kaldırma hatası', error); });
        } else {
            window.FocusSupabase.from('message_pins').insert({
                message_id: msgKey,
                scope_type: scope.type,
                scope_id: scope.id,
                pinned_by: ctx.currentUser.id
            }).then(({ error }) => { if (error) console.error('[Grup] sabitleme hatası', error); });
        }
        return;
    }

    const database = getDB();
    if (!database || !ctx.msgPath) return;
    const ref = database.ref(`${dcPinnedPathFor(ctx.msgPath)}/${msgKey}`);
    if (_dcPinnedMsgs[msgKey]) {
        ref.remove();
    } else {
        ref.set({
            text: m.text || '',
            displayName: m.displayName || m.username,
            username: m.username,
            timestamp: m.timestamp || Date.now(),
            pinnedBy: user.username
        });
    }
}
window.toggleDcPinMessage = toggleDcPinMessage;

export function renderDcPinnedBanner() {
    const banner = document.getElementById('dc-pinned-banner');
    if (!banner) return;
    const keys = Object.keys(_dcPinnedMsgs);
    if (!keys.length) {
        banner.style.display = 'none';
        banner.innerHTML = '';
        return;
    }
    if (_dcPinnedIndex >= keys.length) _dcPinnedIndex = 0;
    const key = keys[_dcPinnedIndex];
    const m = _dcPinnedMsgs[key];
    const user = getUser();
    const ctx = window._dcGetChatContext();
    const isDm = getActiveChatTarget() && getActiveChatTarget().type === 'dm';
    const isAdminOrMod = !isDm && (ctx.role === 'admin' || ctx.role === 'moderator');
    const canUnpin = !!user && (isDm || isAdminOrMod || m.pinnedBy === user.username);
    const text = m.text || '';

    banner.style.display = 'flex';
    banner.innerHTML = `
        <i class="fa-solid fa-thumbtack dc-pinned-icon"></i>
        <div class="dc-pinned-content" data-action="goto-pin">
            <span class="dc-pinned-label">${keys.length > 1 ? `Sabitlenmiş mesaj (${_dcPinnedIndex + 1}/${keys.length})` : 'Sabitlenmiş mesaj'}</span>
            <span class="dc-pinned-text">${window.escapeHtml(m.displayName || m.username || '')}: ${window.escapeHtml(text.length > 80 ? text.slice(0, 80) + '…' : text)}</span>
        </div>
        ${keys.length > 1 ? `<button class="dc-pinned-nav-btn" data-action="next-pin" title="Sonraki sabitlenmiş mesaj" aria-label="Sonraki sabitlenmiş mesaj"><i class="fa-solid fa-chevron-down"></i></button>` : ''}
        ${canUnpin ? `<button class="dc-pinned-unpin-btn" data-action="unpin" title="Sabitlemeyi kaldır" aria-label="Sabitlemeyi kaldır"><i class="fa-solid fa-xmark"></i></button>` : ''}
    `;

    banner.querySelector('[data-action="goto-pin"]').addEventListener('click', () => window.jumpToDcMsg(key));
    const nextBtn = banner.querySelector('[data-action="next-pin"]');
    if (nextBtn) nextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        _dcPinnedIndex = (_dcPinnedIndex + 1) % keys.length;
        renderDcPinnedBanner();
    });
    const unpinBtn = banner.querySelector('[data-action="unpin"]');
    if (unpinBtn) unpinBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleDcPinMessage(key, m);
    });
}
window.renderDcPinnedBanner = renderDcPinnedBanner;
