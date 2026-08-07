// ─── DC ESKİ MESAJ SAYFALAMA + BAĞLAMLI MESAJA ATLAMA ──────────────────────
// social.js dosyasından çıkarıldı (Faz H devamı, 2026-07-30). Paylaşılan DC
// sohbet state'i artık state/dc-message-render-store.js + state/dc-chat-view-store.js
// + state/dc-current-group-scope-store.js üzerinden okunuyor (gerçek getter/setter).
import { getDB, getUser } from './social-misc-pure-utils.js';
import {
    getDcCurrentGroupId, getDcOldestKey, setDcOldestKey, getDcCurrentMsgPath
} from '../state/dc-chat-view-store.js';
import {
    getDcLoadingMore, setDcLoadingMore,
    getDcOldestCreatedAt, setDcOldestCreatedAt,
    getDcCurrentConversation, getDcCurrentOtherProfile,
    getDcCurrentJoinedAt, getDcRenderedKeys
} from '../state/dc-message-render-store.js';
import { getDcCurrentGroupScope } from '../state/dc-current-group-scope-store.js';
import { getDcGlobalMsgCache } from '../state/dc-global-msg-cache-store.js';
import { dcRebuildDateSeparators } from './social-dc-online-status.js';
import { dcGetClearedAt, dcGetDeletedForMe } from './social-chat-local-delete.js';
import { _normalizeSupabaseDmMessage, _normalizeSupabaseGroupMessage } from './social-dc-profile-resolve.js';
import { renderDcMessage } from './social-dc-message-render.js';

// ─── ESKİ MESAJLARI GEÇ YÜKLE ─────────────────────────
window.ensureDcLoadMoreBtn = ensureDcLoadMoreBtn;
export function ensureDcLoadMoreBtn(streamEl) {
    let btn = streamEl.querySelector('#dc-load-more-btn');
    if (!btn) {
        btn = document.createElement('button');
        btn.id = 'dc-load-more-btn';
        btn.className = 'dc-load-more-btn';
        btn.textContent = 'Daha fazla yükle';
        streamEl.insertBefore(btn, streamEl.firstChild);
        btn.addEventListener('click', () => loadOlderDcMessages(streamEl));
    }
    return btn;
}

window.loadOlderDcMessages = loadOlderDcMessages;
export function loadOlderDcMessages(streamEl) {
    if (getDcCurrentGroupId()) { loadOlderGroupMessagesSupabase(streamEl); return; }
    if (!getDcOldestKey() || getDcLoadingMore() || !getDcCurrentMsgPath()) return;
    if (getDcCurrentConversation()) { loadOlderDmMessagesSupabase(streamEl); return; }
    const database = getDB();
    const user = getUser();
    if (!database || !user) return;

    setDcLoadingMore(true);
    const btn = streamEl.querySelector('#dc-load-more-btn');
    if (btn) btn.textContent = 'Yükleniyor...';

    database.ref(getDcCurrentMsgPath()).orderByKey().endBefore(getDcOldestKey()).limitToLast(30).once('value').then(snap => {
        setDcLoadingMore(false);
        if (!snap.exists()) {
            if (btn) btn.remove();
            return;
        }
        const prevHeight = streamEl.scrollHeight;
        const frag = document.createDocumentFragment();
        let newOldest = null;
        let count = 0;
        const knownKeys = getDcRenderedKeys()[getDcCurrentMsgPath()];
        let crossedJoinBoundary = false;
        snap.forEach(msgSnap => {
            if (!newOldest) newOldest = msgSnap.key;
            count++;
            const m = msgSnap.val();
            if (!m) return;
            if (m.username !== user.username && typeof window.isBlockedEitherWay === 'function' && window.isBlockedEitherWay(m.username)) return;
            // Kullanıcının gruba katılma tarihinden ÖNCEKİ mesajlar "Daha fazla yükle"
            // ile de gösterilmesin — bu sınıra ulaşıldıysa daha eski sayfalar da
            // tamamen filtreleneceği için "Daha fazla yükle" butonu kaldırılır.
            if (m.timestamp && getDcCurrentJoinedAt() && m.timestamp < getDcCurrentJoinedAt()) { crossedJoinBoundary = true; return; }
            if (knownKeys) knownKeys.add(msgSnap.key);
            renderDcMessage(frag, m, user.username, msgSnap.key);
        });
        setDcOldestKey(newOldest);
        streamEl.insertBefore(frag, btn ? btn.nextSibling : streamEl.firstChild);
        dcRebuildDateSeparators(streamEl);
        streamEl.scrollTop = streamEl.scrollHeight - prevHeight;
        if ((count < 30 || crossedJoinBoundary) && btn) btn.remove();
        else if (btn) btn.textContent = 'Daha fazla yükle';
    }).catch(() => {
        setDcLoadingMore(false);
        if (btn) btn.textContent = 'Daha fazla yükle';
    });
}

// Supabase DM: getDcOldestCreatedAt()'ten daha eski 30 mesajı yükler.
window.loadOlderDmMessagesSupabase = loadOlderDmMessagesSupabase;
export function loadOlderDmMessagesSupabase(streamEl) {
    const user = getUser();
    if (!window.FocusSupabase || !user || !getDcCurrentConversation() || !getDcOldestCreatedAt()) return;
    const dmPath = getDcCurrentMsgPath();
    const conversationId = getDcCurrentConversation().id;

    setDcLoadingMore(true);
    const btn = streamEl.querySelector('#dc-load-more-btn');
    if (btn) btn.textContent = 'Yükleniyor...';

    window.FocusSupabase
        .from('messages')
        .select('*')
        .eq('scope_type', 'dm')
        .eq('scope_id', conversationId)
        .lt('created_at', getDcOldestCreatedAt())
        .order('created_at', { ascending: false })
        .limit(30)
        .then(({ data, error }) => {
            setDcLoadingMore(false);
            const rows = (data || []).slice().reverse();
            if (error || !rows.length) {
                if (btn) btn.remove();
                return;
            }
            const prevHeight = streamEl.scrollHeight;
            const frag = document.createDocumentFragment();
            const knownKeys = getDcRenderedKeys()[dmPath];
            const clearedAt = dcGetClearedAt(dmPath);
            const deletedForMe = dcGetDeletedForMe(dmPath);
            rows.forEach(row => {
                const m = _normalizeSupabaseDmMessage(row, getDcCurrentOtherProfile());
                getDcGlobalMsgCache()[dmPath].msgs[row.id] = m;
                if (m.timestamp && m.timestamp <= clearedAt) return;
                if (deletedForMe.has(row.id)) return;
                if (knownKeys) knownKeys.add(row.id);
                renderDcMessage(frag, m, user.username, row.id);
            });
            setDcOldestKey(rows[0].id);
            setDcOldestCreatedAt(rows[0].created_at);
            streamEl.insertBefore(frag, btn ? btn.nextSibling : streamEl.firstChild);
            dcRebuildDateSeparators(streamEl);
            streamEl.scrollTop = streamEl.scrollHeight - prevHeight;
            if (rows.length < 30 && btn) btn.remove();
            else if (btn) btn.textContent = 'Daha fazla yükle';
        }).catch(() => {
            setDcLoadingMore(false);
            if (btn) btn.textContent = 'Daha fazla yükle';
        });
}

// Supabase grup sohbeti: getDcOldestCreatedAt()'ten daha eski 30 mesajı yükler.
window.loadOlderGroupMessagesSupabase = loadOlderGroupMessagesSupabase;
export function loadOlderGroupMessagesSupabase(streamEl) {
    const user = getUser();
    if (!window.FocusSupabase || !user || !getDcCurrentGroupId() || !getDcCurrentGroupScope() || !getDcOldestCreatedAt()) return;
    const scope = getDcCurrentGroupScope();
    const groupPath = `supabase_group_${scope.type}_${scope.id}`;

    setDcLoadingMore(true);
    const btn = streamEl.querySelector('#dc-load-more-btn');
    if (btn) btn.textContent = 'Yükleniyor...';

    window.FocusSupabase
        .from('messages')
        .select('*')
        .eq('scope_type', scope.type)
        .eq('scope_id', scope.id)
        .lt('created_at', getDcOldestCreatedAt())
        .order('created_at', { ascending: false })
        .limit(30)
        .then(async ({ data, error }) => {
            setDcLoadingMore(false);
            const rows = (data || []).slice().reverse();
            if (error || !rows.length) {
                if (btn) btn.remove();
                return;
            }
            if (getDcCurrentGroupScope() !== scope) return;
            const prevHeight = streamEl.scrollHeight;
            const frag = document.createDocumentFragment();
            const knownKeys = getDcRenderedKeys()[groupPath];
            const clearedAt = dcGetClearedAt(groupPath);
            const deletedForMe = dcGetDeletedForMe(groupPath);
            for (const row of rows) {
                const m = await _normalizeSupabaseGroupMessage(row);
                if (getDcCurrentGroupScope() !== scope) return;
                if (getDcGlobalMsgCache()[groupPath]) getDcGlobalMsgCache()[groupPath].msgs[row.id] = m;
                if (m.timestamp && m.timestamp <= clearedAt) continue;
                if (deletedForMe.has(row.id)) continue;
                if (knownKeys) knownKeys.add(row.id);
                renderDcMessage(frag, m, user.username, row.id);
            }
            setDcOldestKey(rows[0].id);
            setDcOldestCreatedAt(rows[0].created_at);
            streamEl.insertBefore(frag, btn ? btn.nextSibling : streamEl.firstChild);
            dcRebuildDateSeparators(streamEl);
            streamEl.scrollTop = streamEl.scrollHeight - prevHeight;
            if (rows.length < 30 && btn) btn.remove();
            else if (btn) btn.textContent = 'Daha fazla yükle';
        }).catch(() => {
            setDcLoadingMore(false);
            if (btn) btn.textContent = 'Daha fazla yükle';
        });
}

// ─── SCROLL İLE OTOMATİK ESKİ MESAJ YÜKLEME ───────────
// Kullanıcı akışın en üstüne yaklaşınca "Daha fazla yükle" butonuna basmadan
// eski mesajlar kendiliğinden gelir (buton yedek olarak durmaya devam eder).
(function setupDcInfiniteScroll() {
    const streamEl = document.getElementById('sidebar-chat-messages-stream');
    if (!streamEl) return;
    streamEl.addEventListener('scroll', () => {
        if (streamEl.scrollTop < 80 && !getDcLoadingMore() && streamEl.querySelector('#dc-load-more-btn')) {
            loadOlderDcMessages(streamEl);
        }
    }, { passive: true });
})();

// ─── BAĞLAMLI MESAJA ATLAMA ───────────────────────────
// Arama sonucundan tıklanan mesaj henüz yüklenmemişse eski sayfaları
// (en fazla 20 sayfa) yükleyip mesajı bulur, ortalar ve flash ile vurgular.
window.dcJumpToMessage = async function(msgId) {
    const streamEl = document.getElementById('sidebar-chat-messages-stream');
    if (!streamEl || !msgId) return false;
    const flash = (row) => {
        row.scrollIntoView({ block: 'center', behavior: 'smooth' });
        row.classList.remove('dc-msg-flash');
        void row.offsetWidth;
        row.classList.add('dc-msg-flash');
        setTimeout(() => row.classList.remove('dc-msg-flash'), 1500);
    };
    let row = streamEl.querySelector(`[data-msg-key="${msgId}"]`);
    if (row) { flash(row); return true; }
    for (let i = 0; i < 20; i++) {
        if (!streamEl.querySelector('#dc-load-more-btn')) break;
        loadOlderDcMessages(streamEl);
        // Yükleme bitene kadar bekle (en fazla 4 sn)
        await new Promise(resolve => {
            const t = setInterval(() => { if (!getDcLoadingMore()) { clearInterval(t); clearTimeout(g); resolve(); } }, 80);
            const g = setTimeout(() => { clearInterval(t); resolve(); }, 4000);
        });
        row = streamEl.querySelector(`[data-msg-key="${msgId}"]`);
        if (row) { flash(row); return true; }
    }
    return false;
};
export function dcJumpToMessage(...args) { return window.dcJumpToMessage(...args); }
