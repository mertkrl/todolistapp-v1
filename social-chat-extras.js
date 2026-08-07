import { fmtDate } from './planning-utils.js';
import { getCurrentUser } from './state/current-user-store.js';
import { getActiveChatTarget } from './state/active-chat-target-store.js';
import { getDcCurrentGroupScope } from './state/dc-current-group-scope-store.js';
import { getDcCurrentGroupId } from './state/dc-chat-view-store.js';
import './social-chat-extras-file-upload.js';
import './social-chat-extras-notif-prefs.js';
// ============================================================
// FOCUSAI SOCIAL-CHAT-EXTRAS.JS
// social.js'ten çıkarılmış window.FocusChat.* ek özellikleri:
// dosya paylaşımı, günlük özet, mesaj→görev dönüşümü,
// bildirim tercihleri, düzenleme geçmişi, initHybridChatUI().
// (Anket sistemi ayrıca social-polls.js dosyasına taşındı.)
// social.js'ten SONRA yüklenmeli (window.dcShowToast, window.FocusSupabase,
// getCurrentUser() gibi social.js/supabase-client.js globallerine bağımlı).
// ============================================================
(function () {
'use strict';

// ═══════════════════════════════════════════════════════
// 📎 DOSYA PAYLAŞIMI (FAZ 1)
// ═══════════════════════════════════════════════════════

window.FocusChat = window.FocusChat || {};

// ═══════════════════════════════════════════════════════
// 🔎 SUPABASE FTS MESAJ ARAMA (FAZ 1)
// ═══════════════════════════════════════════════════════

window.FocusChat.searchMessages = async function({ query, scopeType, scopeId, limit = 30 }) {
    if (!window.FocusSupabase || !query || !scopeId) return [];
    try {
        const { data, error } = await window.FocusSupabase
            .from('messages')
            .select('id, text, created_at, sender_id, scope_type, scope_id, attachments')
            .eq('scope_type', scopeType)
            .eq('scope_id', scopeId)
            .textSearch('text', query, { type: 'plain', config: 'simple' })
            .order('created_at', { ascending: false })
            .limit(limit);
        if (error) throw error;
        return data || [];
    } catch (e) {
        // FTS başarısız olursa ilike fallback
        try {
            const { data } = await window.FocusSupabase
                .from('messages')
                .select('id, text, created_at, sender_id, scope_type, scope_id, attachments')
                .eq('scope_type', scopeType)
                .eq('scope_id', scopeId)
                .ilike('text', `%${query}%`)
                .order('created_at', { ascending: false })
                .limit(limit);
            return data || [];
        } catch { return []; }
    }
};

// Global mesaj arama paneli — birden fazla kanalda/DM'de arama
window.FocusChat.openGlobalSearch = function() {
    let panel = document.getElementById('focuschat-global-search');
    if (panel) { panel.classList.toggle('hidden'); return; }

    panel = document.createElement('div');
    panel.id = 'focuschat-global-search';
    panel.className = 'focuschat-global-search';
    panel.innerHTML = `
        <div class="fgs-header">
            <i class="fa-solid fa-magnifying-glass si-purple"></i>
            <input id="fgs-input" type="text" placeholder="Mesajlarda ara..." autocomplete="off" />
            <button id="fgs-close" class="dc-msg-action-btn" title="Kapat" aria-label="Kapat"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div id="fgs-results" class="fgs-results">
            <div class="fgs-empty u-text-align-center_color-rgba2552552550p3_padding-30px_font" >
                Aramak için yazmaya başla...
            </div>
        </div>
    `;
    document.body.appendChild(panel);

    const input   = panel.querySelector('#fgs-input');
    const results = panel.querySelector('#fgs-results');
    const closeBtn = panel.querySelector('#fgs-close');

    closeBtn.addEventListener('click', () => panel.classList.add('hidden'));

    let _searchTimer = null;
    input.addEventListener('input', () => {
        clearTimeout(_searchTimer);
        const q = input.value.trim();
        if (q.length < 2) {
            results.innerHTML = '<div class="fgs-empty u-text-align-center_color-rgba2552552550p3_padding-30px_font" >En az 2 karakter gir...</div>';
            return;
        }
        results.innerHTML = '<div class="fgs-empty u-text-align-center_color-rgba2552552550p3_padding-20px_font" ><i class="fa-solid fa-spinner fa-spin"></i> Aranıyor...</div>';
        _searchTimer = setTimeout(async () => {
            const scope = getDcCurrentGroupScope() || (getActiveChatTarget()?.type === 'dm' ? { type: 'dm', id: window._dcCurrentConversation?.id } : null);
            if (!scope || !scope.id) {
                results.innerHTML = '<div class="fgs-empty u-text-align-center_color-rgba2552552550p3_padding-20px_font" >Önce bir sohbet aç.</div>';
                return;
            }
            const msgs = await window.FocusChat.searchMessages({ query: q, scopeType: scope.type, scopeId: scope.id });
            if (!msgs.length) {
                results.innerHTML = '<div class="fgs-empty u-text-align-center_color-rgba2552552550p3_padding-20px_font" >Sonuç bulunamadı.</div>';
                return;
            }
            results.innerHTML = '';
            msgs.forEach(msg => {
                const item = document.createElement('div');
                item.className = 'fgs-result-item';
                const date = new Date(msg.created_at).toLocaleDateString('tr-TR', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
                const esc = window.escapeHtml;
                const highlight = (esc(msg.text || '')).replace(
                    new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
                    m => `<mark class="u-background-rgba1621552540p3_color-hfff_border-radius-2px">${m}</mark>`
                );
                item.innerHTML = `
                    <div class="fgs-msg-text">${highlight}</div>
                    <div class="fgs-msg-meta">${date}</div>
                `;
                item.addEventListener('click', async () => {
                    panel.classList.add('hidden');
                    // Mesaj yüklüyse doğrudan git; değilse eski sayfaları yükleyerek bul
                    if (typeof window.dcJumpToMessage === 'function') {
                        const found = await window.dcJumpToMessage(msg.id);
                        if (!found) window.dcShowToast('Mesaja ulaşılamadı — sohbeti açıp tekrar dener misin?', 'error');
                    }
                });
                results.appendChild(item);
            });
        }, 350);
    });

    input.focus();
};


// ═══════════════════════════════════════════════════════
// ANKET (POLL) SİSTEMİ → social-polls.js dosyasına taşındı
// ═══════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════
// FAZ 2: GÜNLÜK ÖZET ŞABLONU
// ═══════════════════════════════════════════════════════

window.FocusChat.openDailySummaryModal = function() {
    const modal = document.getElementById('daily-summary-modal');
    if (!modal) return;
    document.getElementById('ds-did-today').value = '';
    document.getElementById('ds-obstacle').value  = '';
    document.getElementById('ds-tomorrow').value  = '';
    modal.classList.remove('hidden');
    document.getElementById('ds-did-today')?.focus();
};

window.FocusChat.submitDailySummary = async function() {
    const didToday = document.getElementById('ds-did-today')?.value.trim();
    if (!didToday) { window.dcShowToast('En az "Bugün ne yaptım?" alanını doldur.'); return; }

    const obstacle = document.getElementById('ds-obstacle')?.value.trim() || '';
    const tomorrow = document.getElementById('ds-tomorrow')?.value.trim() || '';
    const scope = getDcCurrentGroupScope();
    if (!scope || !window.FocusSupabase || !getCurrentUser()?.id) {
        window.dcShowToast('Önce bir grup kanalı aç.');
        return;
    }

    const submitBtn = document.getElementById('daily-summary-submit');
    if (submitBtn) { submitBtn.disabled = true; }

    // Formatlanmış mesaj oluştur
    const lines = [
        '📋 **Günlük Özet**',
        '',
        `✅ **Bugün yaptım:** ${didToday}`,
        obstacle ? `⚠️ **Engel:** ${obstacle}` : null,
        tomorrow ? `🎯 **Yarınki hedef:** ${tomorrow}` : null
    ].filter(l => l !== null).join('\n');

    try {
        // Mesaj gönder
        const { data: msg, error: msgErr } = await window.FocusSupabase.from('messages').insert({
            scope_type: scope.type,
            scope_id:   scope.id,
            sender_id:  getCurrentUser().id,
            text:       lines
        }).select().single();
        if (msgErr) throw msgErr;

        // Özeti daily_summaries tablosuna kaydet
        const groupId = getDcCurrentGroupId();
        await window.FocusSupabase.from('daily_summaries').upsert({
            user_id:    getCurrentUser().id,
            group_id:   groupId,
            did_today:  didToday,
            obstacle,
            tomorrow,
            message_id: msg?.id || null,
            created_at: new Date().toISOString().split('T')[0]
        }, { onConflict: 'user_id,created_at' });

        document.getElementById('daily-summary-modal')?.classList.add('hidden');
    } catch(e) {
        window.dcShowToast('Özet gönderilemedi: ' + e.message);
    } finally {
        if (submitBtn) { submitBtn.disabled = false; }
    }
};

(function initDailySummaryModal() {
    const tryBind = () => {
        const submitBtn = document.getElementById('daily-summary-submit');
        const cancelBtn = document.getElementById('daily-summary-cancel');
        const closeBtn  = document.getElementById('daily-summary-close');
        if (!submitBtn) { setTimeout(tryBind, 800); return; }
        submitBtn.addEventListener('click', window.FocusChat.submitDailySummary);
        cancelBtn?.addEventListener('click', () => document.getElementById('daily-summary-modal')?.classList.add('hidden'));
        closeBtn?.addEventListener('click',  () => document.getElementById('daily-summary-modal')?.classList.add('hidden'));
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tryBind);
    else tryBind();
})();


// ═══════════════════════════════════════════════════════
// FAZ 2: MESAJDAN GÖREV OLUŞTURMA
// ═══════════════════════════════════════════════════════

window.FocusChat.openMsgToTaskModal = function(msgText) {
    const modal = document.getElementById('msg-to-task-modal');
    if (!modal) return;
    const esc = window.escapeHtml;
    document.getElementById('msg-task-source-text').innerHTML = esc(msgText.length > 120 ? msgText.slice(0,120) + '…' : msgText);
    document.getElementById('msg-task-title').value = msgText.length > 60 ? msgText.slice(0,60) : msgText;
    document.getElementById('msg-task-due').value   = '';
    modal.classList.remove('hidden');
    document.getElementById('msg-task-title')?.select();
};

window.FocusChat.createTaskFromMsg = function() {
    const title = document.getElementById('msg-task-title')?.value.trim();
    if (!title) { window.dcShowToast('Görev başlığı boş olamaz.'); return; }
    const due = document.getElementById('msg-task-due')?.value || null;

    // Mevcut FocusStorage task sistemine ekle
    try {
        const tasks = (typeof FocusStorage !== 'undefined')
            ? FocusStorage.get('tasks', [])
            : JSON.parse(localStorage.getItem('focusai_tasks') || '[]', window._safeJsonReviver);

        const newTask = {
            id: `task_${Date.now()}`,
            text: title,
            completed: false,
            dueDate: due || null,
            createdAt: new Date().toISOString(),
            fromChat: true
        };
        tasks.unshift(newTask);

        if (typeof FocusStorage !== 'undefined') FocusStorage.set('tasks', tasks);
        else localStorage.setItem('focusai_tasks', JSON.stringify(tasks));

        window.dispatchEvent(new CustomEvent('focusai:tasks-updated'));
        document.getElementById('msg-to-task-modal')?.classList.add('hidden');

        // Başarı toast
        dcShowToast('✅ Görev eklendi: ' + title);
    } catch(e) {
        window.dcShowToast('Görev eklenemedi: ' + e.message);
    }
};

(function initMsgToTaskModal() {
    const tryBind = () => {
        const submitBtn = document.getElementById('msg-task-submit');
        const cancelBtn = document.getElementById('msg-task-cancel');
        const closeBtn  = document.getElementById('msg-task-close');
        if (!submitBtn) { setTimeout(tryBind, 800); return; }
        submitBtn.addEventListener('click', window.FocusChat.createTaskFromMsg);
        cancelBtn?.addEventListener('click', () => document.getElementById('msg-to-task-modal')?.classList.add('hidden'));
        closeBtn?.addEventListener('click',  () => document.getElementById('msg-to-task-modal')?.classList.add('hidden'));
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tryBind);
    else tryBind();
})();


// ═══════════════════════════════════════════════════════
// FAZ 3 — 2. MESAJ DÜZENLEME LOGU
// ═══════════════════════════════════════════════════════

// Düzenleme kaydedilince edit_history'ye ekle
window.FocusChat = window.FocusChat || {};
window.FocusChat.saveEditWithHistory = async function(msgId, newText, oldText) {
    if (!window.FocusSupabase || !msgId) return false;
    try {
        // Mevcut edit_history'yi çek
        const { data: msg } = await window.FocusSupabase
            .from('messages').select('edit_history').eq('id', msgId).maybeSingle();
        const history = Array.isArray(msg?.edit_history) ? msg.edit_history : [];
        history.push({ text: oldText, edited_at: new Date().toISOString() });

        const { error } = await window.FocusSupabase.from('messages').update({
            text: newText,
            edited: true,
            edit_history: history
        }).eq('id', msgId);

        return !error;
    } catch { return false; }
};

// Düzenleme geçmişini modal'da göster
window.FocusChat.showEditHistory = async function(msgId) {
    const modal = document.getElementById('edit-history-modal');
    const list  = document.getElementById('edit-history-list');
    if (!modal || !list || !window.FocusSupabase) return;

    list.innerHTML = '<div class="u-color-rgba2552552550p3_font-size-12px_padding-8px0">Yükleniyor...</div>';
    modal.classList.remove('hidden');

    const { data: msg } = await window.FocusSupabase
        .from('messages').select('text, edit_history, created_at').eq('id', msgId).maybeSingle();

    if (!msg) { list.innerHTML = '<div class="u-color-rgba2552552550p3_font-size-12px">Bulunamadı.</div>'; return; }

    const history  = Array.isArray(msg.edit_history) ? msg.edit_history : [];
    const esc = window.escapeHtml;
    const fmtDate  = d => new Date(d).toLocaleString('tr-TR', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });

    // En eski → en yeni sıralı göster
    const entries = [
        ...history.map((h, i) => ({ text: h.text, date: h.edited_at, label: i === 0 ? 'Orijinal' : `Versiyon ${i}` })),
        { text: msg.text, date: new Date().toISOString(), label: 'Güncel' }
    ];

    list.innerHTML = '';
    entries.forEach(entry => {
        const row = document.createElement('div');
        row.style.background = 'rgba(255,255,255,0.04)';
        row.style.border = '1px solid rgba(255,255,255,0.08)';
        row.style.borderRadius = '8px';
        row.style.padding = '10px 12px';
        row.innerHTML = `
            <div class="u-display-flex_justify-content-space-between_margin-bottom-5">
                <span class="u-font-size-11px_font-weight-600_color-rgba2552552550p5">${esc(entry.label)}</span>
                <span class="u-font-size-10px_color-rgba2552552550p3">${fmtDate(entry.date)}</span>
            </div>
            <div class="u-font-size-13px_color-rgba2552552550p85_line-height-1p5">${esc(entry.text || '')}</div>
        `;
        list.appendChild(row);
    });
};

(function initEditHistoryModal() {
    function tryBind() {
        const closeBtn = document.getElementById('edit-history-close');
        if (!closeBtn) { setTimeout(tryBind, 800); return; }
        closeBtn.addEventListener('click', () => document.getElementById('edit-history-modal')?.classList.add('hidden'));
    }
    document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', tryBind) : tryBind();
})();


// FAZ 3-3 Mesaj İletme kaldırıldı (sadeleştirme kararı, 2026-07-02).

// ═══════════════════════════════════════════════════════
// FAZ 3 — 5. HOVER AKSIYON: İLET + DÜZENLEMEGEÇMİŞİ
// ═══════════════════════════════════════════════════════

// renderDcMessage'daki hover aksiyon listesini genişlet
// "(düzenlendi)" etiketi tıklandığında geçmişi aç
(function patchEditedTagClick() {
    const origRender = window.renderDcMessage;
    // Mevcut "(düzenlendi)" tag'ine click bağla — event delegation ile
    document.addEventListener('click', (e) => {
        const tag = e.target.closest('.dc-msg-edited-tag');
        if (!tag) return;
        const row = tag.closest('[data-msg-key]');
        if (!row) return;
        const msgKey = row.dataset.msgKey;
        if (msgKey && window.FocusChat?.showEditHistory) window.FocusChat.showEditHistory(msgKey);
    });
})();

// ═══════════════════════════════════════════════════════════════
// HYBRİD CHAT UI — A+C+B Entegrasyonu
// ═══════════════════════════════════════════════════════════════
(function initHybridChatUI() {
    // Avatar renk paleti (kullanıcı adının hash'ine göre)
    const AV_COLORS = [
        { bg: 'rgba(212,144,14,0.18)', color: '#D4900E', border: 'rgba(212,144,14,0.28)' },
        { bg: 'rgba(74,222,128,0.16)',  color: '#4ADE80', border: 'rgba(74,222,128,0.26)' },
        { bg: 'rgba(96,165,250,0.16)',  color: '#60A5FA', border: 'rgba(96,165,250,0.26)' },
        { bg: 'rgba(167,139,250,0.16)', color: '#A78BFA', border: 'rgba(167,139,250,0.26)' },
        { bg: 'rgba(248,113,113,0.16)', color: '#F87171', border: 'rgba(248,113,113,0.26)' },
        { bg: 'rgba(34,211,238,0.16)',  color: '#22D3EE', border: 'rgba(34,211,238,0.26)' },
    ];

    function avatarColor(username) {
        let h = 0;
        for (let i = 0; i < (username || '').length; i++) h = (h * 31 + username.charCodeAt(i)) & 0xffffff;
        return AV_COLORS[Math.abs(h) % AV_COLORS.length];
    }

    function avatarInitials(name) {
        const parts = (name || '?').trim().split(/[\s_]+/);
        return parts.length >= 2
            ? (parts[0][0] + parts[1][0]).toUpperCase()
            : (name || '?').slice(0, 2).toUpperCase();
    }

    function makeAvEl(username, size) {
        const c = avatarColor(username);
        const el = document.createElement('div');
        el.className = 'hc-feed-av';
        el.style.width = `${size}px`;
        el.style.height = `${size}px`;
        el.style.background = c.bg;
        el.style.color = c.color;
        el.style.border = `1px solid ${c.border}`;
        el.style.fontSize = `${Math.floor(size * 0.35)}px`;
        el.textContent = avatarInitials(username);
        return el;
    }

    function relTime(ts) {
        const diff = Math.floor((Date.now() - ts) / 1000);
        if (diff < 60) return 'az önce';
        if (diff < 3600) return Math.floor(diff / 60) + ' dk önce';
        return Math.floor(diff / 3600) + ' sa önce';
    }

    // ─── Odak pane (C) ───
    let _hcFocusTimerInterval = null;

    function hcShowFocusPane(channelName) {
        const pane = document.getElementById('hc-focus-pane');
        const stream = document.getElementById('sidebar-chat-messages-stream');
        const membersListEl = document.getElementById('sidebar-chat-members-list');
        const inputBar = document.querySelector('.dc-chat-input-bar');
        const tabsBar = document.getElementById('hc-state-tabs-bar');
        const pinnedBanner = document.getElementById('dc-pinned-banner');
        if (!pane) return;

        // Stream/input gizle, focus pane göster
        if (stream) stream.style.display = 'none';
        if (inputBar) inputBar.style.display = 'none';
        if (membersListEl) membersListEl.style.display = 'none';
        if (pinnedBanner) pinnedBanner.style.display = 'none';
        if (tabsBar) tabsBar.style.display = 'none';
        pane.classList.add('hc-active');

        const nameEl = document.getElementById('hc-focus-channel-name');
        if (nameEl) nameEl.textContent = channelName || 'Odak Kanalı';

        hcRefreshFocusMembers();
    }

    function hcHideFocusPane() {
        const pane = document.getElementById('hc-focus-pane');
        if (pane) pane.classList.remove('hc-active');
        if (_hcFocusTimerInterval) { clearInterval(_hcFocusTimerInterval); _hcFocusTimerInterval = null; }
        const timerEl = document.getElementById('hc-focus-timer');
        if (timerEl) timerEl.textContent = '--:--';
    }

    function hcRefreshFocusMembers() {
        const membersEl = document.getElementById('hc-focus-members');
        const countEl   = document.getElementById('hc-focus-active-count');
        if (!membersEl) return;

        const target = getActiveChatTarget();
        const groupData = (target?.type === 'group' && typeof window.getMyGroupsDataCache === 'function')
            ? window.getMyGroupsDataCache()[target.code] : null;

        if (!groupData?.members) {
            membersEl.innerHTML = '<span class="u-font-size-11px_color-rgba2552552550p25">Üye verisi yükleniyor...</span>';
            return;
        }

        const me = (() => { try { return JSON.parse(localStorage.getItem('focusai_social_user'), window._safeJsonReviver); } catch { return null; } })();
        const presence = (typeof window.getCommunityPresenceState === 'function') ? window.getCommunityPresenceState() : {};

        const memberList = Object.entries(groupData.members).map(([username, data]) => {
            const isOnline = presence[username]?.online ?? (me && username === me.username);
            return { username, displayName: data.displayName || username, xp: data.xp || 0, isOnline };
        });

        const online = memberList.filter(m => m.isOnline);
        if (countEl) countEl.textContent = online.length || memberList.length;

        const toShow = online.length ? online : memberList.slice(0, 8);
        membersEl.innerHTML = toShow.map((m, i) => {
            return `
                <div class="hc-member-chip" data-chip-idx="${i}">
                    <div class="hc-chip-av">${window.escapeHtml(avatarInitials(m.username))}</div>
                    <div class="hc-chip-info">
                        <div class="hc-chip-name">${window.escapeHtml(m.displayName)}</div>
                        <div class="hc-chip-detail">${m.xp} XP</div>
                    </div>
                    <div class="hc-chip-dot${m.isOnline ? '' : ' idle'}"></div>
                </div>`;
        }).join('');
        membersEl.querySelectorAll('.hc-member-chip').forEach(chip => {
            const i = parseInt(chip.dataset.chipIdx, 10);
            const c = avatarColor(toShow[i].username);
            const av = chip.querySelector('.hc-chip-av');
            if (av) {
                av.style.background = c.bg;
                av.style.color = c.color;
                av.style.border = '1px solid ' + c.border;
            }
        });
    }

    // ─── Tab yönetimi (yalnızca sohbet durumu kaldı) ───
    let _hcActiveTab = 'sohbet';

    function hcSwitchTab(tab) {
        _hcActiveTab = tab;

        const stream      = document.getElementById('sidebar-chat-messages-stream');
        const membersRow  = document.getElementById('sidebar-chat-members-list');
        const inputBar    = document.querySelector('.dc-chat-input-bar');
        const pinnedBanner = document.getElementById('dc-pinned-banner');
        const scrollBtn   = document.getElementById('dc-scroll-bottom-btn');
        const jumpBtn     = document.getElementById('dc-jump-unread-btn');

        // Not: dc-chat-search-bar buradan yönetilmiyor — açık/kapalı durumu yalnızca
        // arama butonuna (setupDcChatSearch) ve window.closeDcChatSearch()'e bağlı.
        // Burada elle "" yapılırsa varsayılan CSS'i (display:flex) devreye girip
        // her kanal açılışında arama çubuğunu istemsizce gösteriyordu.
        const showStream = tab === 'sohbet';
        if (stream)      stream.style.display      = showStream ? 'flex' : 'none';
        if (inputBar)    inputBar.style.display     = showStream ? ''    : 'none';
        if (membersRow)  membersRow.style.display   = showStream ? 'flex': 'none';
        if (pinnedBanner) pinnedBanner.style.display = showStream ? '' : 'none';
        if (scrollBtn) {
            // Sekme her açıldığında butonu koşulsuz göstermek yerine gerçek scroll
            // konumuna göre karar veriyoruz — aksi halde ekranda son mesaj görünse
            // bile (kısa/tek mesajlık kanallarda) buton CSS varsayılanıyla belirip duruyordu.
            const nearBottom = !showStream || (typeof dcIsNearBottom === 'function' && dcIsNearBottom(stream));
            scrollBtn.style.display = nearBottom ? 'none' : 'flex';
        }
        // "Okunmamış mesajlar" butonu koşulsuz gösterilmez — görünürlüğü
        // setupDcJumpUnreadBtn yönetir (akışta .dc-unread-divider varsa ve
        // ekran dışındaysa gösterir). Burada '' yapılırsa CSS'teki display:flex
        // devreye girip boş kanallarda bile butonu gösteriyordu.
        if (jumpBtn) {
            const hasDivider = showStream && stream && stream.querySelector('.dc-unread-divider');
            if (!hasDivider) jumpBtn.style.display = 'none';
        }
    }

    // Kanal açıldığında tetiklenen ana hook
    function hcOnChannelOpen(roomId, roomName) {
        hcHideFocusPane();
        _hcActiveTab = 'sohbet';

        const isFocusChannel = /odak|focus|calisma|çalışma/i.test(roomName || '');

        if (isFocusChannel) {
            hcShowFocusPane(roomName);
        } else {
            hcSwitchTab('sohbet');
        }
    }

    // Oturum sonu kartı
    window.hcShowSessionEnd = function(opts = {}) {
        const overlay = document.getElementById('hc-session-end-overlay');
        if (!overlay) return;

        const dur   = opts.durationMin ? `${opts.durationMin} dk` : '--';
        const tasks = opts.tasksCompleted ?? '--';
        const xp    = opts.xpGained ? `+${opts.xpGained}` : '--';
        const streak = opts.streak ? `🔥 ${opts.streak}` : '--';

        document.getElementById('hc-sec-title').textContent = opts.title || 'Oturum Tamamlandı!';
        document.getElementById('hc-sec-sub').textContent   = opts.sub   || 'Harika bir odak seansıydı';
        document.getElementById('hc-sec-duration').textContent = dur;
        document.getElementById('hc-sec-tasks').textContent    = tasks;
        document.getElementById('hc-sec-xp').textContent       = xp;
        document.getElementById('hc-sec-streak').textContent   = streak;

        const rankEl   = document.getElementById('hc-sec-rank');
        const rankText = document.getElementById('hc-sec-rank-text');
        if (opts.rankText && rankEl && rankText) {
            rankText.textContent = opts.rankText;
            rankEl.style.display = 'flex';
        } else if (rankEl) {
            rankEl.style.display = 'none';
        }

        overlay.classList.add('hc-visible');
    };

    // Aktivite sistemi mesaj enjeksiyonu (stream'e)
    window.hcInjectSysMsg = function(type, html) {
        const stream = document.getElementById('sidebar-chat-messages-stream');
        if (!stream) return;
        const div = document.createElement('div');
        div.className = `dc-sys-card hc-${type} dc-msg-animate-in`;
        div.innerHTML = html;
        stream.appendChild(div);
        stream.scrollTop = stream.scrollHeight;
    };

    // ─── Event listener'lar ───
    document.addEventListener('click', (e) => {
        // Oturum sonu kapat
        if (e.target.closest('#hc-sec-close-btn')) {
            const overlay = document.getElementById('hc-session-end-overlay');
            if (overlay) overlay.classList.remove('hc-visible');
            return;
        }

        // Odak panelinden sohbete geç
        if (e.target.closest('#hc-focus-chat-toggle')) {
            hcHideFocusPane();
            const stream  = document.getElementById('sidebar-chat-messages-stream');
            const inputBar = document.querySelector('.dc-chat-input-bar');
            if (stream)   stream.style.display   = 'flex';
            if (inputBar) inputBar.style.display = '';
            hcSwitchTab('sohbet');
            return;
        }
    });

    // Kanal açılma tespiti: title elementini izle
    const titleEl = document.getElementById('live-chat-target-title');
    if (titleEl) {
        new MutationObserver(() => {
            const txt = titleEl.textContent.replace(/^[#\s]+/, '').trim();
            const target = getActiveChatTarget();
            if (target && txt) hcOnChannelOpen(target.roomId, txt);
        }).observe(titleEl, { childList: true, characterData: true, subtree: true });
    }

    // Mevcut oturum sonu olaylarını dinle (buddy_session_ended benzeri)
    document.addEventListener('focusai:session_ended', (e) => {
        const d = e.detail || {};
        window.hcShowSessionEnd({
            durationMin: d.durationMin,
            tasksCompleted: d.tasksCompleted,
            xpGained: d.xpGained,
            streak: d.streak,
            rankText: d.rankText,
        });
    });

    // Periyodik focus pane üye güncelleme
    setInterval(() => {
        if (document.getElementById('hc-focus-pane')?.classList.contains('hc-active')) {
            hcRefreshFocusMembers();
        }
    }, 30000);

    // Global erişim
    window.hcOnChannelOpen    = hcOnChannelOpen;
    window.hcShowFocusPane    = hcShowFocusPane;
    window.hcHideFocusPane    = hcHideFocusPane;
    window.hcSwitchTab        = hcSwitchTab;
})();

})();
