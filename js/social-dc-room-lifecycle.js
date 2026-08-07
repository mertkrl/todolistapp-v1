// ─── DC ODA YAŞAM DÖNGÜSÜ (grup kanalı/DM aç, mesaj gönder, kapat, dinleyicileri
// temizle) ───────────────────────────────────────────────────────────────────
// social.js dosyasından çıkarıldı (Faz H devamı, 2026-07-30). Realtime
// abonelik kurulumu (channel/subscribe) dahil — kanal referansları artık bu
// dosyanın kendi modül-seviyesi state'i (aşağıda), _dcCurrentGroupScope ise
// paylaşılan state/dc-current-group-scope-store.js üzerinden okunuyor/yazılıyor
// (gerçek getter/setter, bare closure değişkeni yok). social.js'te hâlâ kalan
// (dcSetMainView/updateChatInputStatus/dcShowToast/getMemberPermissionsSupabase
// gibi) fonksiyonlara window.X() köprüsüyle erişiliyor.
import { getCurrentUser } from '../state/current-user-store.js';
import { _resolveOrCreateConversation, _resolveProfileId } from './social-friends-notifications.js';

import { markDmRead, getDmLastRead, markGroupRead } from './social-dm-notifications.js';

import {
    _escapeHtml, _dcCreatePendingBubble, getDB, getUser
} from './social-misc-pure-utils.js';
import { dcChatEnabled } from './social-chat-gate.js';
import { dcHideSessionStrip, dcRenderSessionStrip } from './social-dc-session-strip.js';
import { closeDcChatSearch } from './social-chat-search.js';
import { cancelDcReply } from './social-dc-reply-reactions.js';
import { getDcCurrentGroupScope, setDcCurrentGroupScope } from '../state/dc-current-group-scope-store.js';
import {
    getDcMsgRegistry, setDcMsgRegistry,
    getDcRenderedKeys,
    getDcCurrentRole, setDcCurrentRole,
    getDcCurrentJoinedAt, setDcCurrentJoinedAt,
    getDcLoadingMore, setDcLoadingMore,
    getDcOldestCreatedAt, setDcOldestCreatedAt,
    getDcCurrentConversation, setDcCurrentConversation,
    getDcCurrentOtherProfile, setDcCurrentOtherProfile
} from '../state/dc-message-render-store.js';
import {
    getDcCurrentGroupId, setDcCurrentGroupId,
    setDcCurrentMsgPath,
    setDcOldestKey, getDcReplyTo
} from '../state/dc-chat-view-store.js';
import { getActiveChatTarget, setActiveChatTarget } from '../state/active-chat-target-store.js';
import { getDcState } from '../state/dc-state-store.js';
import { getDcGlobalMsgCache } from '../state/dc-global-msg-cache-store.js';
import { renderDcMessage } from './social-dc-message-render.js';
import { ensureDcLoadMoreBtn } from './social-dc-pagination.js';
import { showDcSkeleton, setupDcScrollButton, dcHandleScrollAfterRender, _dcRoomMsgCounts } from './social-dc-scroll-skeleton.js';
import { getDcEnteredRoomId } from '../state/dc-entered-room-id-store.js';
import { dcIsNearBottom } from './social-dc-scroll-utils.js';
import { dcGetClearedAt, dcGetDeletedForMe } from './social-chat-local-delete.js';
import { subscribeDcOnlineStatus, dcRebuildDateSeparators } from './social-dc-online-status.js';
import { initDcEmojiPicker } from './social-emoji-picker.js';
import { initDcChatTheme } from './social-dc-chat-theme.js';
import {
    teardownDcTyping, setupDcTyping, notifyDcTyping, clearDcTypingNow,
    teardownDmTypingSupabase, setupDmTypingSupabase,
    teardownDcGroupTypingSupabase, setupDcGroupTypingSupabase,
    teardownDcGroupReadReceiptSupabase, setupDcGroupReadReceiptSupabase,
    teardownDcReadReceipt, setupDcReadReceipt, setupDmReadReceiptSupabase,
    updateDcReadReceipts, teardownDcGroupReadReceipt
} from './social-typing-read-receipts.js';
import {
    teardownDcPinned, setupDcPinned, teardownDmPinnedSupabase,
    setupDmPinnedSupabase, teardownGroupPinnedSupabase, setupGroupPinnedSupabase
} from './social-message-pins.js';
import { insertDcUnreadDivider, setupDcJumpUnreadBtn } from './social-unread-divider.js';
import { saveDcDraft, restoreDcDraft, clearDcDraft, canSendDcMessage } from './social-dc-draft.js';
import { setupDcMentionAutocomplete, parseDcMentions } from './social-dc-mentions.js';
import {
    _resolveProfileByUsername, _fetchDcReactionsMap,
    _normalizeSupabaseDmMessage, _normalizeSupabaseGroupMessage
} from './social-dc-profile-resolve.js';
import {
    _dcAutoResizeTextarea, _dcMarkPendingBubbleFailed, _dcRemovePendingBubble
} from './social-dc-msg-dom-helpers.js';
import { _isRateLimitError } from './social-misc-isolated-utils.js';
import { _throttleAction } from './social-throttle-and-date-utils.js';
import { showDcDmLimitNotice } from './social-dm-limit-notice.js';
import { _isSupabaseGroupAdmin } from './social-dc-group-admin.js';

// ─── ODA/KANAL YAŞAM DÖNGÜSÜNE ÖZGÜ STATE ───────────────────────────────
// Bu değişkenlerin okuyucusu/yazarı sadece bu dosyadaki fonksiyonlar
// (teardownDcSupabaseDmChannels/openDcGroupChannelSupabase/openDcDmRoom/
// closeDcChat) olduğu için ayrı bir state/*.js dosyasına çıkarmaya gerek
// yok — modül-seviyesinde tutuluyor (eskiden social.js'in dev IIFE'sinde
// aynı şekilde closure değişkeniydi).
let _dcSupabaseMsgChannel = null;  // `messages` tablosu realtime kanalı
let _dcReactionsChannel   = null;  // `message_reactions` tablosu realtime kanalı
let _dcInputAbortController = null; // Oda/DM değişiminde önceki mesaj gönder listener'larını iptal etmek için
let _dcRoomPresenceRef = null;      // Açık çalışma odasının presence dinleyicisi
let _dcSubtitleDefault = '';        // Header alt başlığının orijinal metni (yazıyor göstergesi bitince geri dönülür)
window.__getDcSubtitleDefault = () => _dcSubtitleDefault; // social-typing-read-receipts.js için

let _dcLastOpenArgs = null; // { fn: 'dm'|'group', args: [...] } — bağlantı kopunca reconnect gap-fill için
window._dcGetLastOpenArgs = () => _dcLastOpenArgs; // social-conn-status.js için

// Açık DM'e ait tüm Supabase realtime kanallarını/oturum durumunu kapatır —
// DM'den bir grup sohbetine geçerken veya başka bir DM açılırken çağrılır.
window.teardownDcSupabaseDmChannels = teardownDcSupabaseDmChannels;
export function teardownDcSupabaseDmChannels() {
    if (_dcSupabaseMsgChannel) { window.FocusSupabase.removeChannel(_dcSupabaseMsgChannel); _dcSupabaseMsgChannel = null; }
    if (window.__getDcReadChannel && window.__getDcReadChannel()) { window.FocusSupabase.removeChannel(window.__getDcReadChannel()); window.__setDcReadChannel(null); }
    if (_dcReactionsChannel)   { window.FocusSupabase.removeChannel(_dcReactionsChannel); _dcReactionsChannel = null; }
    teardownDmTypingSupabase();
    teardownDcGroupTypingSupabase();
    teardownDcGroupReadReceiptSupabase();
    teardownDmPinnedSupabase();
    teardownGroupPinnedSupabase();
    setDcCurrentConversation(null);
    setDcCurrentOtherProfile(null);
    setDcCurrentGroupId(null);
    setDcCurrentGroupScope(null);
    _dcLastOpenArgs = null;
    dcHideSessionStrip();
}

// ─── GRUP SOHBETİ (SUPABASE — genel/kategori/alt-kanal — M2b-3 Bölüm 1+2) ──────────
// scope: { type: 'group'|'group_channel'|'group_subchannel', id: <uuid>, locked?: boolean }
window.openDcGroupChannelSupabase = openDcGroupChannelSupabase; // social-server-tree.js için
export async function openDcGroupChannelSupabase(groupCode, groupData, scope, displayLabel) {
    const user = getUser();
    if (!user) return;
    // Savunma katmanı: UI kapısını atlayan herhangi bir çağrı yolu (bildirim
    // tıklaması, eski kod, konsol) sohbet odası yükleyemez — Arena'ya düşer.
    if (!dcChatEnabled()) { window.dcSetMainView('home'); return; }
    _dcLastOpenArgs = { fn: 'group', args: [groupCode, groupData, scope, displayLabel] };
    window._dcPersistLastOpen({ fn: 'group', code: groupCode, scope: { type: scope.type, id: scope.id, locked: !!scope.locked, isAnnouncement: !!scope.isAnnouncement }, label: displayLabel });
    window.dcSetMainView('chat');
    dcRenderSessionStrip(groupData?._supaId || null);

    // Oda değişti — önceki yanıt/seçim durumunu sıfırla
    cancelDcReply();
    window.clearDcSelection();
    document.getElementById('analytics-modal')?.classList.remove('dc-panel-open');
    if (typeof closeDcChatSearch === 'function') closeDcChatSearch();
    setDcMsgRegistry({});
    setDcOldestKey(null);
    setDcLoadingMore(false);

    const inputBar = document.querySelector('.dc-chat-input-bar');
    if (inputBar) inputBar.style.display = '';

    const _actionBtns = document.getElementById('dc-room-action-btns');
    if (_actionBtns && getDcEnteredRoomId() !== scope.id) {
        _actionBtns.classList.remove('visible');
    }
    getDcState().groupCode = groupCode;
    getDcState().roomId    = scope.id;
    getDcState().chanId    = null;
    setActiveChatTarget({ type: 'group', code: groupCode, roomId: scope.id, channelId: null });

    // Roller/izinler M2b-4'e kadar Supabase grup sohbetinde uygulanmıyor
    setDcCurrentRole(_isSupabaseGroupAdmin(groupCode) ? 'admin' : 'member');

    const titleEl    = document.getElementById('live-chat-target-title');
    const subtitleEl = document.getElementById('live-chat-target-desc');
    if (titleEl)    titleEl.textContent    = displayLabel;
    _dcSubtitleDefault = groupCode + ' grubunun kanalı';
    if (subtitleEl) subtitleEl.textContent = _dcSubtitleDefault;

    const emptyEl  = document.getElementById('dc-chat-empty-state');
    const streamEl = document.getElementById('sidebar-chat-messages-stream');
    const headerEl = document.getElementById('dc-chat-header');
    if (emptyEl)  emptyEl.style.display  = 'none';
    if (streamEl) streamEl.style.display = 'flex';
    if (headerEl) headerEl.style.display = 'flex';
    const msgInputEl = document.getElementById('sidebar-chat-message-input');
    const msgSendBtn = document.getElementById('sidebar-chat-send-msg-btn');

    const headerDot = document.getElementById('dc-header-status-dot');
    if (headerDot) headerDot.style.display = 'none';

    const manageBtn = document.getElementById('live-chat-manage-btn');
    if (manageBtn) manageBtn.style.display = '';
    const focusInviteBtn = document.getElementById('dc-chat-focus-invite-btn');
    if (focusInviteBtn) focusInviteBtn.style.display = '';

    const _blockedBanner = document.getElementById('dc-blocked-banner');
    if (_blockedBanner) _blockedBanner.remove();

    if (typeof initDcChatTheme === 'function') initDcChatTheme();
    initDcEmojiPicker();
    setupDcScrollButton(streamEl);
    showDcSkeleton(streamEl);

    teardownDcSupabaseDmChannels();
    if (_dcRoomPresenceRef) { _dcRoomPresenceRef.off(); _dcRoomPresenceRef = null; }
    window.__setDcCurrentRoomPresence([]);

    const groupId = groupData._supaId;
    setDcCurrentGroupId(groupId);
    setDcCurrentGroupScope(scope);
    const groupPath = `supabase_group_${scope.type}_${scope.id}`;
    setDcCurrentMsgPath(groupPath);
    setDcOldestKey(null);
    setDcOldestCreatedAt(null);
    setDcCurrentJoinedAt(0);
    delete getDcRenderedKeys()[groupPath];

    // Kilitli alt-kanal: yönetim yetkisi olmayanlar için sohbet kapalı —
    // mesajları gösterme, fetch/realtime/gönder kurma (Firebase tarafındaki
    // "kilitli oda" placeholder'ıyla aynı görsel davranış). Adminler ve bu oda
    // için "lockRooms" izin istisnası verilmiş roller kilidi görmezden gelir.
    if (scope.type === 'group_subchannel' && scope.locked) {
        const perms = await new Promise(r => window.getMemberPermissionsSupabase(groupId, user.id, r, { subId: scope.id }));
        if (perms.role !== 'admin' && !perms.lockRooms) {
            if (msgInputEl) msgInputEl.disabled = true;
            if (msgSendBtn) msgSendBtn.disabled = true;
            if (streamEl) {
                streamEl.innerHTML = `
                    <div class="u-margin-auto_text-align-center_color-rgba2551181170p6_font-">
                        <i class="fa-solid fa-lock u-font-size-30px_color-rgba2551181170p35_margin-bottom-12px_" ></i>
                        <b>${_escapeHtml(displayLabel)}</b> odası kilitli.<br>Bu odaya girmek için yetkili biri tarafından kilidin açılması gerekiyor.
                    </div>`;
            }
            return;
        }
    }

    if (msgInputEl) msgInputEl.disabled = false;
    if (msgSendBtn) msgSendBtn.disabled = false;

    // Duyuru kanalı ise mesaj alanını kilitle
    window.__setCurrentChannelIsAnnouncement(!!(scope.isAnnouncement));
    window._focusCurrentGroupRole = getDcCurrentRole();
    if (typeof window.updateChatInputStatus === 'function') window.updateChatInputStatus();

    const renderGroupSnapshot = async (rows) => {
        if (!streamEl || getDcCurrentGroupScope() !== scope) return;
        const isFirstLoad = !getDcRenderedKeys()[groupPath];
        const wasAtBottom = isFirstLoad ? true : dcIsNearBottom(streamEl);
        streamEl.innerHTML = '';
        if (!rows.length) {
            streamEl.innerHTML = `<div class="dc-empty-channel-placeholder u-text-align-center_color-rgba2552552550p2_font-size-13px_pa" >${_escapeHtml(displayLabel)} kanalına hoş geldin! İlk mesajı sen gönder.</div>`;
            getDcRenderedKeys()[groupPath] = new Set();
            setDcOldestKey(null);
            setDcOldestCreatedAt(null);
            return;
        }
        const clearedAt = dcGetClearedAt(groupPath);
        const deletedForMe = dcGetDeletedForMe(groupPath);
        const prevKeys = getDcRenderedKeys()[groupPath];
        const newKeys = new Set();
        const _cacheEntry = { meta: { type: 'group', groupCode, roomName: displayLabel.replace(/^#\s*/, ''), roomId: scope.id, channelId: null, displayName: displayLabel }, msgs: {} };
        const reactionsMap = await _fetchDcReactionsMap(scope.type, scope.id);
        if (getDcCurrentGroupScope() !== scope) return;
        for (const row of rows) {
            const m = await _normalizeSupabaseGroupMessage(row);
            if (getDcCurrentGroupScope() !== scope) return;
            m.reactions = reactionsMap[row.id] || {};
            _cacheEntry.msgs[row.id] = m;
            if (m.timestamp && m.timestamp <= clearedAt) continue;
            if (deletedForMe.has(row.id)) continue;
            newKeys.add(row.id);
            const isNew = !isFirstLoad && prevKeys && !prevKeys.has(row.id);
            renderDcMessage(streamEl, m, user.username, row.id, { animate: isNew });
        }
        getDcGlobalMsgCache()[groupPath] = _cacheEntry;
        getDcRenderedKeys()[groupPath] = newKeys;
        setDcOldestKey(rows[0].id);
        setDcOldestCreatedAt(rows[0].created_at);
        if (rows.length >= 60) ensureDcLoadMoreBtn(streamEl);
        dcRebuildDateSeparators(streamEl);
        dcHandleScrollAfterRender(streamEl, groupPath, rows.length, wasAtBottom, isFirstLoad);
        // Oda açıkken "Son Mesajlaşmalar"daki okunmamış rozetini temizle
        if (typeof window.markGroupRead === 'function') markGroupRead(groupPath);
    };

    const fetchAndRenderGroup = () => {
        window.FocusSupabase
            .from('messages')
            .select('*')
            .eq('scope_type', scope.type)
            .eq('scope_id', scope.id)
            .order('created_at', { ascending: false })
            .limit(60)
            .then(({ data, error }) => {
                if (error) { console.error('[Grup Sohbeti] mesaj yükleme hatası', error); return; }
                renderGroupSnapshot((data || []).slice().reverse());
            });
    };

    fetchAndRenderGroup();
    setupGroupPinnedSupabase(scope);
    setupDcGroupTypingSupabase(scope);
    setupDcGroupReadReceiptSupabase(scope);

    _dcSupabaseMsgChannel = window.FocusSupabase
        .channel(`group-chat-${scope.type}-${scope.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `scope_id=eq.${scope.id}` }, async payload => {
            if (getDcCurrentGroupScope() !== scope) return;
            if (payload.eventType === 'DELETE') {
                delete getDcMsgRegistry()[payload.old.id];
                fetchAndRenderGroup();
                return;
            }
            if (payload.eventType === 'UPDATE') {
                fetchAndRenderGroup();
                return;
            }
            // INSERT — yeni mesajı DOM'a sadece ekle
            if (payload.eventType === 'INSERT' && payload.new) {
                if (payload.new.scope_type !== scope.type) return;
                if (getDcMsgRegistry() && getDcMsgRegistry()[payload.new.id]) return;
                const m = await _normalizeSupabaseGroupMessage(payload.new);
                if (getDcCurrentGroupScope() !== scope) return;
                const wasAtBottom = streamEl.scrollHeight - streamEl.scrollTop - streamEl.clientHeight < 120;
                const emptyPlaceholder = streamEl.querySelector('.dc-empty-channel-placeholder');
                if (emptyPlaceholder) emptyPlaceholder.remove();
                renderDcMessage(streamEl, m, user.username, payload.new.id, { animate: true });
                dcRebuildDateSeparators(streamEl);
                if (wasAtBottom) streamEl.scrollTop = streamEl.scrollHeight;
                if (getDcGlobalMsgCache()?.[groupPath]) {
                    getDcGlobalMsgCache()[groupPath].msgs[payload.new.id] = m;
                }
            }
        })
        .subscribe();

    if (_dcReactionsChannel) { window.FocusSupabase.removeChannel(_dcReactionsChannel); _dcReactionsChannel = null; }
    _dcReactionsChannel = window.FocusSupabase
        .channel(`group-reactions-${scope.type}-${scope.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions', filter: `scope_id=eq.${scope.id}` }, () => {
            if (getDcCurrentGroupScope() !== scope) return;
            fetchAndRenderGroup();
        })
        .subscribe();

    // Mesaj gönder — AbortController ile önceki listener'ları temizle
    const input   = document.getElementById('sidebar-chat-message-input');
    const sendBtn = document.getElementById('sidebar-chat-send-msg-btn');
    if (_dcInputAbortController) _dcInputAbortController.abort();
    _dcInputAbortController = new AbortController();
    const { signal: _inputSignal } = _dcInputAbortController;

    // Dosya yükleme butonu — grup sohbeti input bar'ına ekle
    let _pendingAttachment = null;
    const _inputBar = input.closest('.dc-chat-input-bar') || input.parentElement;
    if (_inputBar && window.FocusChat?.initFileUploadBtn) {
        window.FocusChat.initFileUploadBtn(_inputBar, async (file) => {
            if (!getDcCurrentGroupScope()) return;
            const att = await window.FocusChat.uploadChatFile(file, getDcCurrentGroupScope().type, getDcCurrentGroupScope().id);
            if (!att) return;
            _pendingAttachment = att;
            // Önizleme çubuğu göster
            let previewBar = _inputBar.querySelector('.dc-file-preview-bar');
            if (!previewBar) {
                previewBar = document.createElement('div');
                previewBar.className = 'dc-file-preview-bar';
                _inputBar.insertBefore(previewBar, _inputBar.firstChild);
            }
            previewBar.innerHTML = `
                <i class="fa-solid fa-paperclip u-color-ha29bfe_flex-shrink-0" ></i>
                <span class="dc-file-preview-name">${_escapeHtml(att.name)}</span>
                <button class="dc-file-preview-remove" title="İptal" aria-label="İptal"><i class="fa-solid fa-xmark"></i></button>
            `;
            previewBar.querySelector('.dc-file-preview-remove').addEventListener('click', () => {
                _pendingAttachment = null;
                previewBar.remove();
            });
        });
    }

    function sendGroupMessageSupabase() {
        const text = input.value.trim();
        if (!text && !_pendingAttachment) return;
        if (!canSendDcMessage()) return;
        // Güncel scope'u her zaman global state'den oku (closure stale olabilir)
        const _scope = getDcCurrentGroupScope() || scope;
        const _user  = getCurrentUser();
        if (!window.FocusSupabase || !_user?.id || !getDcCurrentGroupId() || !_scope) {
            console.warn('[Grup Sohbeti] sendGroupMessageSupabase: eksik state', { scope: _scope, user: _user?.id, groupId: getDcCurrentGroupId() });
            return;
        }
        if (!_throttleAction(`group_send_${_scope.type}_${_scope.id}`, 500)) {
            window.dcShowToast('Çok hızlı mesaj gönderiyorsunuz, biraz yavaşlayın.');
            return;
        }

        const payload = {
            scope_type: _scope.type,
            scope_id:   _scope.id,
            sender_id:  _user.id,
            text:       text || null,
            reply_to:   getDcReplyTo() ? getDcReplyTo().msgKey : null,
            attachments: _pendingAttachment ? [_pendingAttachment] : null
        };

        // Eki temizle
        if (_pendingAttachment) {
            _pendingAttachment = null;
            _inputBar?.querySelector('.dc-file-preview-bar')?.remove();
        }

        // Metinli mesajlarda sunucu cevabı beklenmeden hemen göster (iyimser UI);
        // ek-dosya (metinsiz) gönderimlerde önizleme zaten input bar'da gösterildiği için atlanır.
        const pending = text ? _dcCreatePendingBubble(streamEl, text) : null;

        const insertMessage = () => window.FocusSupabase.from('messages').insert(payload).then(({ error }) => {
            if (error) {
                console.error('[Grup Sohbeti] mesaj gönderme hatası', error);
                if (_isRateLimitError(error)) {
                    if (pending) _dcRemovePendingBubble(pending);
                    window.dcShowToast('Çok hızlı mesaj gönderiyorsun — birkaç saniye bekle ⏳', 'error');
                    return;
                }
                if (pending) _dcMarkPendingBubbleFailed(pending, insertMessage);
                return;
            }
            if (pending) _dcRemovePendingBubble(pending);
        });

        const mentions = parseDcMentions(text).filter(u => u !== _user.username);
        if (mentions.length) {
            Promise.all(mentions.map(u => _resolveProfileId(u))).then(ids => {
                const validIds = ids.filter(Boolean);
                payload.mentions = validIds;
                insertMessage();
                const roomName = displayLabel.replace(/^#\s*/, '');
                validIds.forEach(uid => {
                    window.FocusSupabase.from('notifications').insert({
                        user_id: uid,
                        type: 'mention',
                        payload: {
                            fromUser: _user.username,
                            fromName: _user.displayName,
                            fromColor: _user.avatarColor || '6c5ce7',
                            groupCode,
                            scopeType: payload.scope_type,
                            scopeId: payload.scope_id,
                            roomName,
                            text: text.length > 60 ? text.slice(0, 60) + '…' : text
                        }
                    }).then(({ error }) => { if (error) console.warn('[Grup Sohbeti] mention bildirimi yazılamadı', error.message); });
                });
            });
        } else {
            insertMessage();
        }

        cancelDcReply();
        clearDcTypingNow();
        input.value = '';
        _dcAutoResizeTextarea(input);
        clearDcDraft();
    }

    sendBtn.addEventListener('click', sendGroupMessageSupabase, { signal: _inputSignal });
    input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendGroupMessageSupabase(); } }, { signal: _inputSignal });
    setupDcMentionAutocomplete(input);
    restoreDcDraft(input);
    _dcAutoResizeTextarea(input);
    input.addEventListener('input', notifyDcTyping, { signal: _inputSignal });
    input.addEventListener('input', () => saveDcDraft(input), { signal: _inputSignal });
    input.addEventListener('input', () => _dcAutoResizeTextarea(input), { signal: _inputSignal });
}

// ─── DM ODASINI AÇ ──────────────────────────────────
window.openDcDmRoom = (...args) => openDcDmRoom(...args);
export async function openDcDmRoom(targetUsername, targetName) {
    const user = getUser();
    if (!user) { console.warn('[DM] getUser() null, DM açılamıyor'); return; }
    // Savunma katmanı: sohbet yetkisi yoksa DM odası hiç yüklenmez
    if (!dcChatEnabled()) {
        window.dcSetMainView('home');
        if (typeof window.dcShowToast === 'function') window.dcShowToast('Sohbet Premium planda — Sosyal herkese açık ⚡', 'info');
        return;
    }
    _dcLastOpenArgs = { fn: 'dm', args: [targetUsername, targetName] };
    window._dcPersistLastOpen({ fn: 'dm', username: targetUsername, name: targetName });
    window.dcSetMainView('chat');
    dcHideSessionStrip();

    // Oda değişti — önceki yanıt/seçim durumunu sıfırla
    cancelDcReply();
    window.clearDcSelection();
    document.getElementById('analytics-modal')?.classList.remove('dc-panel-open');
    if (typeof closeDcChatSearch === 'function') closeDcChatSearch();
    setDcMsgRegistry({});
    setDcOldestKey(null);
    setDcLoadingMore(false);

    // DM path: iki kullanıcının sıralı adlarından oluşan oda
    const dmId = [user.username, targetUsername].sort().join('_');
    const dmPath = `focusai_community/direct_messages/${dmId}`;
    setActiveChatTarget({ type: 'dm', username: targetUsername });
    setDcCurrentRole('member'); // DM'lerde moderasyon yetkisi yok

    const titleEl    = document.getElementById('live-chat-target-title');
    const subtitleEl = document.getElementById('live-chat-target-desc');
    if (titleEl)    titleEl.textContent    = '@' + targetName;
    _dcSubtitleDefault = 'Özel mesaj';
    if (subtitleEl) subtitleEl.textContent = _dcSubtitleDefault;
    if (subtitleEl) subtitleEl.textContent = _dcSubtitleDefault;

    // Kanal ikonunu @ yap
    const chanIcon = document.querySelector('.dc-channel-icon i');
    if (chanIcon) { chanIcon.className = 'fa-solid fa-at'; }

    const emptyEl  = document.getElementById('dc-chat-empty-state');
    const streamEl = document.getElementById('sidebar-chat-messages-stream');
    const headerEl = document.getElementById('dc-chat-header');
    if (emptyEl)  emptyEl.style.display  = 'none';
    if (streamEl) streamEl.style.display = 'flex';
    if (headerEl) headerEl.style.display = 'flex';
    // Bir kişi seçildi — yazma kutusunu aç
    const msgInputEl = document.getElementById('sidebar-chat-message-input');
    const msgSendBtn = document.getElementById('sidebar-chat-send-msg-btn');
    if (msgInputEl) msgInputEl.disabled = false;
    if (msgSendBtn) msgSendBtn.disabled = false;

    // DM hedefinin çevrimiçi durumunu başlıkta göster
    const headerDot = document.getElementById('dc-header-status-dot');
    if (headerDot) {
        headerDot.style.display = '';
        headerDot.dataset.onlineUser = targetUsername;
        headerDot.classList.remove('online', 'offline');
        headerDot.classList.add('offline');
        subscribeDcOnlineStatus(targetUsername);
    }

    // Özel mesajlarda grup yönetimi butonuna gerek yok
    const manageBtn = document.getElementById('live-chat-manage-btn');
    if (manageBtn) manageBtn.style.display = 'none';
    const focusInviteBtn = document.getElementById('dc-chat-focus-invite-btn');
    if (focusInviteBtn) focusInviteBtn.style.display = '';

    // Engelleme durumuna göre giriş kutusunu güncelle
    if (typeof window.updateDcBlockedBanner === 'function') window.updateDcBlockedBanner(targetUsername);

    if (typeof initDcChatTheme === 'function') initDcChatTheme();
    initDcEmojiPicker();
    setupDcScrollButton(streamEl);
    showDcSkeleton(streamEl);

    if (_dcRoomPresenceRef) { _dcRoomPresenceRef.off(); _dcRoomPresenceRef = null; }
    window.__setDcCurrentRoomPresence([]);

    setDcCurrentMsgPath(dmPath);
    let _dcOpenLastRead = getDmLastRead ? getDmLastRead(targetUsername) : 0;
    // Sohbet açıldı — okunmamış rozetlerini hangi yoldan açılırsa açılsın temizle
    // (_dcOpenLastRead yukarıda alındı, okunmamış ayıracı bundan etkilenmez)
    if (typeof window.markDmRead === 'function') markDmRead(targetUsername);
    setupDcJumpUnreadBtn(streamEl);
    teardownDcGroupReadReceipt();
    delete getDcRenderedKeys()[dmPath];

    // ── SUPABASE: conversation bul/oluştur + son 60 mesajı yükle + realtime ──
    if (window.FocusSupabase) teardownDcSupabaseDmChannels();
    setDcOldestKey(null);
    setDcOldestCreatedAt(null);

    if (window.FocusSupabase && getCurrentUser()?.id) {
        // Sabitlenmiş mesajlar/okundu/yazıyor durumu artık Supabase üzerinden
        // (conversation çözüldükten sonra) kurulacak — eski Firebase dinleyicilerini temizle
        teardownDcPinned();
        teardownDcReadReceipt();
        teardownDcTyping();
    } else {
        // Supabase oturumu yok — eski Firebase tabanlı yol
        setupDcPinned(dmPath);
        setupDcTyping(`focusai_community/typing_status/${dmId}`, user.username);
        setupDcReadReceipt(dmId, user.username, targetUsername);
    }

    const renderDmSnapshot = async (rows) => {
        if (!streamEl) return;
        const isFirstLoad = !getDcRenderedKeys()[dmPath];
        const wasAtBottom = isFirstLoad ? true : dcIsNearBottom(streamEl);
        streamEl.innerHTML = '';
        if (!rows.length) {
            streamEl.innerHTML = `<div class="u-text-align-center_color-rgba2552552550p2_font-size-13px_pa">${_escapeHtml(targetName)} ile konuşmana başla!</div>`;
            getDcRenderedKeys()[dmPath] = new Set();
            setDcOldestKey(null);
            setDcOldestCreatedAt(null);
            return;
        }
        const lastRead = _dcOpenLastRead;
        const clearedAt = dcGetClearedAt(dmPath);
        const deletedForMe = dcGetDeletedForMe(dmPath);
        const prevKeys = getDcRenderedKeys()[dmPath];
        const newKeys = new Set();
        let dividerInserted = false;
        let visible = 0;
        const _cacheEntry = { meta: { type: 'dm', username: targetUsername, displayName: targetName }, msgs: {} };
        const reactionsMap = getDcCurrentConversation() ? await _fetchDcReactionsMap('dm', getDcCurrentConversation().id) : {};
        if (getActiveChatTarget()?.type !== 'dm' || getActiveChatTarget()?.username !== targetUsername) return;
        rows.forEach(row => {
            const m = _normalizeSupabaseDmMessage(row, getDcCurrentOtherProfile());
            m.reactions = reactionsMap[row.id] || {};
            _cacheEntry.msgs[row.id] = m;
            if (m.timestamp && m.timestamp <= clearedAt) return;
            if (deletedForMe.has(row.id)) return;
            visible++;
            newKeys.add(row.id);
            if (!dividerInserted && m.username !== user.username && m.timestamp > lastRead) {
                insertDcUnreadDivider(streamEl);
                dividerInserted = true;
            }
            const isNew = !isFirstLoad && prevKeys && !prevKeys.has(row.id);
            renderDcMessage(streamEl, m, user.username, row.id, { animate: isNew });
        });
        getDcGlobalMsgCache()[dmPath] = _cacheEntry;
        getDcRenderedKeys()[dmPath] = newKeys;
        if (visible === 0) {
            streamEl.innerHTML = `<div class="u-text-align-center_color-rgba2552552550p2_font-size-13px_pa">Sohbet temizlendi.</div>`;
        }
        setDcOldestKey(rows[0].id);
        setDcOldestCreatedAt(rows[0].created_at);
        if (rows.length >= 60) ensureDcLoadMoreBtn(streamEl);
        dcRebuildDateSeparators(streamEl);
        if (dividerInserted) {
            const divider = streamEl.querySelector('.dc-unread-divider');
            if (divider) divider.scrollIntoView({ block: 'center' });
            _dcRoomMsgCounts[dmPath] = rows.length;
            const btn = document.getElementById('dc-scroll-bottom-btn');
            if (btn) btn.style.display = 'none';
        } else {
            dcHandleScrollAfterRender(streamEl, dmPath, rows.length, wasAtBottom, isFirstLoad);
        }
        setupDcJumpUnreadBtn(streamEl);
        updateDcReadReceipts();
    };

    const fetchAndRenderDm = (conversationId) => {
        window.FocusSupabase
            .from('messages')
            .select('*')
            .eq('scope_type', 'dm')
            .eq('scope_id', conversationId)
            .order('created_at', { ascending: false })
            .limit(60)
            .then(({ data, error }) => {
                if (error) { console.error('[DM] mesaj yükleme hatası', error); return; }
                renderDmSnapshot((data || []).slice().reverse());
            });
    };

    if (window.FocusSupabase && getCurrentUser()?.id) {
        _resolveOrCreateConversation(targetUsername).then(async conversation => {
            if (!conversation) return;
            // Oda kapatılmadan/değiştirilmeden cevap geldiyse devam et
            if (getActiveChatTarget()?.type !== 'dm' || getActiveChatTarget()?.username !== targetUsername) return;

            setDcCurrentConversation(conversation);
            setDcCurrentOtherProfile(await _resolveProfileByUsername(targetUsername));
            fetchAndRenderDm(conversation.id);
            setupDmReadReceiptSupabase(conversation, getDcCurrentOtherProfile());
            setupDmTypingSupabase(conversation);
            setupDmPinnedSupabase(conversation);

            _dcSupabaseMsgChannel = window.FocusSupabase
                .channel(`dm-messages-${conversation.id}`)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `scope_id=eq.${conversation.id}` }, payload => {
                    if (getActiveChatTarget()?.type !== 'dm' || getActiveChatTarget()?.username !== targetUsername) return;
                    if (payload.eventType === 'DELETE') {
                        delete getDcMsgRegistry()[payload.old.id];
                        fetchAndRenderDm(conversation.id);
                        return;
                    }
                    if (payload.eventType === 'UPDATE') {
                        // Düzenleme/güncelleme — sadece o satırı yeniden çiz
                        fetchAndRenderDm(conversation.id);
                        return;
                    }
                    // INSERT — yeni mesajı DOM'a sadece ekle, tüm listeyi yeniden çizme
                    if (payload.eventType === 'INSERT' && payload.new) {
                        const row = payload.new;
                        // Zaten render edilmişse atla (kendi gönderimiz optimistic eklenmemiş, ama duplicate önle)
                        if (getDcMsgRegistry() && getDcMsgRegistry()[row.id]) return;
                        const m = _normalizeSupabaseDmMessage(row, getDcCurrentOtherProfile());
                        const wasAtBottom = streamEl.scrollHeight - streamEl.scrollTop - streamEl.clientHeight < 120;
                        renderDcMessage(streamEl, m, user.username, row.id, { animate: true });
                        dcRebuildDateSeparators(streamEl);
                        if (wasAtBottom) streamEl.scrollTop = streamEl.scrollHeight;
                        // Global cache güncelle
                        if (getDcGlobalMsgCache()?.[dmPath]) {
                            getDcGlobalMsgCache()[dmPath].msgs[row.id] = m;
                        }
                    }
                    // Artık fetchAndRenderDm çağrılmıyor (INSERT için)
                    // Sohbet açıkken karşıdan yeni mesaj geldiyse "okundu" zaman damgasını
                    // güncelle — yoksa last_read_at sohbeti AÇTIĞIMIZ andaki değerde
                    // donup kalır ve karşı taraf hep tek tik (gönderildi) görür.
                    if (payload.eventType === 'INSERT' && payload.new?.sender_id !== getCurrentUser().id) {
                        window.FocusSupabase.from('message_reads')
                            .upsert({ conversation_id: conversation.id, user_id: getCurrentUser().id, last_read_at: new Date().toISOString() })
                            .then(({ error }) => { if (error) console.error('[DM] okundu bilgisi güncellenemedi', error); });
                        // Yerel okunmamış rozetleri de temizle — yoksa sohbet açıkken
                        // gelen mesajlar hep "okunmamış" görünmeye devam eder.
                        // Mesajın sunucu zamanı taban olarak geçilir (saat farkına dayanıklı).
                        if (typeof window.markDmRead === 'function') {
                            markDmRead(targetUsername, payload.new.created_at ? new Date(payload.new.created_at).getTime() : 0);
                        }
                    }
                })
                .subscribe((status) => {
                    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                        // Kanal kopunca mesajları yeniden çek
                        setTimeout(() => {
                            if (getActiveChatTarget()?.type === 'dm' && getActiveChatTarget()?.username === targetUsername) {
                                fetchAndRenderDm(conversation.id);
                            }
                        }, 3000);
                    }
                });

            _dcReactionsChannel = window.FocusSupabase
                .channel(`dm-reactions-${conversation.id}`)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions', filter: `scope_id=eq.${conversation.id}` }, () => {
                    if (getActiveChatTarget()?.type !== 'dm' || getActiveChatTarget()?.username !== targetUsername) return;
                    fetchAndRenderDm(conversation.id);
                })
                .subscribe();
        });
    }

    // Mesaj gönder — AbortController ile önceki listener'ları temizle
    const input   = document.getElementById('sidebar-chat-message-input');
    const sendBtn = document.getElementById('sidebar-chat-send-msg-btn');
    if (_dcInputAbortController) _dcInputAbortController.abort();
    _dcInputAbortController = new AbortController();
    const { signal: _inputSignal } = _dcInputAbortController;

    function sendDm() {
        const text = input.value.trim();
        if (!text) return;
        if (!canSendDcMessage()) return;
        if (typeof window.isBlockedEitherWay === 'function' && window.isBlockedEitherWay(targetUsername)) {
            window.dcShowToast('Bu kullanıcıyla iletişim kuramazsınız.');
            return;
        }
        if (!window.FocusSupabase || !getCurrentUser()?.id || !getDcCurrentConversation()) return;
        if (!_throttleAction(`dm_send_${getDcCurrentConversation().id}`, 500)) {
            window.dcShowToast('Çok hızlı mesaj gönderiyorsunuz, biraz yavaşlayın.');
            return;
        }
        const conversation = getDcCurrentConversation();
        const replyTo = getDcReplyTo() ? getDcReplyTo().msgKey : null;
        // DM'de tek mention hedefi olabilir: karşı taraf (@username)
        const safeTarget = targetUsername.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const mentioned = new RegExp('@' + safeTarget + '\\b', 'i').test(text);

        // Sunucu cevabını beklemeden mesajı hemen göster (iyimser UI)
        const pending = _dcCreatePendingBubble(streamEl, text);

        cancelDcReply();
        clearDcTypingNow();
        input.value = '';
        _dcAutoResizeTextarea(input);
        clearDcDraft();

        const attemptSend = () => (async () => {
            const payload = {
                scope_type: 'dm',
                scope_id:   conversation.id,
                sender_id:  getCurrentUser().id,
                reply_to:   replyTo || null,
                text
            };
            if (mentioned) {
                const targetId = await _resolveProfileId(targetUsername);
                if (targetId) payload.mentions = [targetId];
            }
            window.FocusSupabase.from('messages').insert(payload).then(({ error }) => {
                if (error) {
                    if (conversation.status === 'pending' && conversation.requested_by === getCurrentUser().id) {
                        showDcDmLimitNotice();
                        _dcRemovePendingBubble(pending);
                    } else if (_isRateLimitError(error)) {
                        _dcRemovePendingBubble(pending);
                        window.dcShowToast('Çok hızlı mesaj gönderiyorsun — birkaç saniye bekle ⏳', 'error');
                    } else {
                        console.error('[DM] mesaj gönderme hatası', error);
                        _dcMarkPendingBubbleFailed(pending, attemptSend);
                    }
                    return;
                }
                // Başarılı — gerçek mesaj realtime dinleyiciden gelecek, geçici baloncuğu kaldır
                _dcRemovePendingBubble(pending);
                if (mentioned && payload.mentions && payload.mentions.length) {
                    window.FocusSupabase.from('notifications').insert({
                        user_id: payload.mentions[0],
                        type: 'mention',
                        payload: {
                            fromUser: getCurrentUser().username,
                            fromName: getCurrentUser().displayName,
                            fromColor: getCurrentUser().avatarColor || '6c5ce7',
                            conversationId: conversation.id,
                            text: text.length > 60 ? text.slice(0, 60) + '…' : text
                        }
                    }).then(({ error: notifErr }) => { if (notifErr) console.warn('[DM] mention bildirimi yazılamadı', notifErr.message); });
                }
            });
        })();
        attemptSend();
    }
    sendBtn.addEventListener('click', sendDm, { signal: _inputSignal });
    restoreDcDraft(input);
    _dcAutoResizeTextarea(input);
    input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendDm(); } }, { signal: _inputSignal });
    input.addEventListener('input', notifyDcTyping, { signal: _inputSignal });
    input.addEventListener('input', () => saveDcDraft(input), { signal: _inputSignal });
    input.addEventListener('input', () => _dcAutoResizeTextarea(input), { signal: _inputSignal });
}

// ─── SOHBET KAPAT ────────────────────────────────────
window.closeDcChat = closeDcChat;
export function closeDcChat() {
    setActiveChatTarget(null);
    // Sadece SOHBET (dm/group) kaydını temizle — 'group-panel' kaydı sohbetten
    // bağımsızdır: kullanıcı Sınıf Paneli'ndeyken başka ana sekmeye geçmek
    // closeDcChat'i tetikliyor ve kayıt silinince sayfa yenilemede grup paneli
    // yerine Arena açılıyordu.
    try {
        const _saved = JSON.parse(localStorage.getItem('focusai_dc_last_open') || 'null', window._safeJsonReviver);
        if (_saved && _saved.fn !== 'group-panel' && typeof window._dcClearLastOpen === 'function') window._dcClearLastOpen();
    } catch (_) {
        if (typeof window._dcClearLastOpen === 'function') window._dcClearLastOpen();
    }
    cancelDcReply();
    window.clearDcSelection();
    teardownDcTyping();
    teardownDcReadReceipt();
    teardownDcGroupReadReceipt();
    teardownDcPinned();
    // Sohbet panel tamamen kapatılırken açık kalan Supabase realtime kanallarını
    // (mesaj/okundu/reaksiyon/yazıyor) da kapat — önceden sadece başka bir
    // sohbete GEÇİLİRKEN temizleniyordu, panel kapatılıp hiç sohbet açılmayınca
    // kanallar sayfa yenilenene kadar arka planda açık kalıyordu.
    if (window.FocusSupabase) teardownDcSupabaseDmChannels();
    const jumpBtn = document.getElementById('dc-jump-unread-btn');
    if (jumpBtn) jumpBtn.style.display = 'none';
    setDcMsgRegistry({});
    const emptyEl  = document.getElementById('dc-chat-empty-state');
    const streamEl = document.getElementById('sidebar-chat-messages-stream');
    const headerEl = document.getElementById('dc-chat-header');
    if (emptyEl)  emptyEl.style.display  = 'flex';
    if (streamEl) { streamEl.style.display = 'none'; streamEl.innerHTML = ''; }
    if (headerEl) headerEl.style.display = 'none';
    document.querySelectorAll('.dc-channel-item').forEach(el => el.classList.remove('active'));
}

// ─── DİNLEYİCİLERİ TEMİZLE ──────────────────────────
// teardownDcMembersSupabase/detachDcListeners artık social-dc-room-lifecycle-teardown.js'de
// (modül-seviyesi state'e bağımlı değillerdi, bağımsız dosyaya çıkarıldı).
import './social-dc-room-lifecycle-teardown.js';
