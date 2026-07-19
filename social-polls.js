// ============================================================
// FOCUSAI SOCIAL-POLLS.JS
// social-chat-extras.js'ten çıkarılmış anket (poll) sistemi:
// anket oluşturma modalı, anket gönderme, anket kartı render/oy verme.
// window.dcShowToast, window.FocusSupabase, window.currentUser,
// window.escapeHtml gibi social.js/storage-manager.js globallerine
// bağımlı — onlardan SONRA yüklenmeli.
// ============================================================
(function () {
'use strict';

window.FocusChat = window.FocusChat || {};

// ── Anket oluşturma modalını aç ──
window.FocusChat.openPollModal = function() {
    const modal = document.getElementById('poll-create-modal');
    if (!modal) return;
    // Sıfırla
    document.getElementById('poll-question-input').value = '';
    document.getElementById('poll-anonymous').checked = false;
    document.getElementById('poll-multiple').checked = false;
    const optList = document.getElementById('poll-options-list');
    optList.innerHTML = '';
    [1, 2].forEach(i => _addPollOptionRow(optList, i));
    modal.classList.remove('hidden');
};

function _addPollOptionRow(container, num) {
    const row = document.createElement('div');
    row.className = 'poll-option-row';
    row.style.cssText = 'display:flex; gap:6px; align-items:center;';
    const allRows = container.querySelectorAll('.poll-option-row');
    const canRemove = allRows.length >= 2;
    row.innerHTML = `
        <input type="text" class="poll-option-input premium-input" placeholder="Seçenek ${num}" maxlength="80" style="flex:1;">
        <button class="poll-option-remove icon-btn" style="opacity:${canRemove ? '0.6' : '0'}; pointer-events:${canRemove ? 'auto' : 'none'};"><i class="fa-solid fa-minus"></i></button>
    `;
    row.querySelector('.poll-option-remove').addEventListener('click', () => {
        const rows = container.querySelectorAll('.poll-option-row');
        if (rows.length > 2) row.remove();
        _updatePollRemoveBtns(container);
    });
    container.appendChild(row);
    _updatePollRemoveBtns(container);
}

function _updatePollRemoveBtns(container) {
    const rows = container.querySelectorAll('.poll-option-row');
    rows.forEach(r => {
        const btn = r.querySelector('.poll-option-remove');
        if (!btn) return;
        const canRemove = rows.length > 2;
        btn.style.opacity = canRemove ? '0.6' : '0';
        btn.style.pointerEvents = canRemove ? 'auto' : 'none';
    });
}

// Anket gönder
window.FocusChat.submitPoll = async function() {
    const scope = window._dcCurrentGroupScope || (window._activeChatTarget?.type === 'dm' ? { type: 'dm', id: window._dcCurrentConversation?.id } : null);
    if (!scope || !scope.id || !window.FocusSupabase || !window.currentUser?.id) return;

    const question = document.getElementById('poll-question-input')?.value.trim();
    if (!question) { window.dcShowToast('Soru boş olamaz.'); return; }

    const optInputs = document.querySelectorAll('.poll-option-input');
    const options = Array.from(optInputs).map(i => i.value.trim()).filter(Boolean);
    if (options.length < 2) { window.dcShowToast('En az 2 seçenek girin.'); return; }

    const isAnonymous = document.getElementById('poll-anonymous')?.checked || false;
    const isMultiple  = document.getElementById('poll-multiple')?.checked  || false;

    const submitBtn = document.getElementById('poll-modal-submit');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; }

    try {
        // Anketi kaydet
        const { data: poll, error: pollErr } = await window.FocusSupabase
            .from('polls')
            .insert({ scope_type: scope.type, scope_id: scope.id, created_by: window.currentUser.id, question, options, is_anonymous: isAnonymous, is_multiple: isMultiple })
            .select().single();
        if (pollErr) throw pollErr;

        // Anketi mesaj olarak gönder (text boş, poll_id dolu)
        await window.FocusSupabase.from('messages').insert({
            scope_type: scope.type,
            scope_id:   scope.id,
            sender_id:  window.currentUser.id,
            text:       `📊 ${question}`,
            poll_id:    poll.id
        });

        document.getElementById('poll-create-modal')?.classList.add('hidden');
    } catch(e) {
        window.dcShowToast('Anket gönderilemedi: ' + e.message);
    } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Anketi Gönder'; }
    }
};

// Anket kartı render
window.FocusChat.renderPollCard = async function(pollId, containerEl) {
    if (!window.FocusSupabase || !pollId || !containerEl) return;
    try {
        const [{ data: poll }, { data: votes }] = await Promise.all([
            window.FocusSupabase.from('polls').select('*').eq('id', pollId).maybeSingle(),
            window.FocusSupabase.from('poll_votes').select('user_id, option_indices').eq('poll_id', pollId)
        ]);
        if (!poll) return;

        const options = Array.isArray(poll.options) ? poll.options : [];
        const totalVotes = (votes || []).length;
        const myVote = (votes || []).find(v => v.user_id === window.currentUser?.id);
        const myIndices = myVote ? myVote.option_indices : [];

        // Seçenek oy sayıları
        const counts = options.map((_, i) => (votes || []).filter(v => Array.isArray(v.option_indices) && v.option_indices.includes(i)).length);

        const card = document.createElement('div');
        card.className = 'poll-card';
        card.dataset.pollId = pollId;
        card.innerHTML = `
            <div class="poll-question">${window.escapeHtml(poll.question)}</div>
            <div class="poll-options">
                ${options.map((opt, i) => {
                    const pct = totalVotes > 0 ? Math.round((counts[i] / totalVotes) * 100) : 0;
                    const isMyVote = myIndices.includes(i);
                    return `
                        <button class="poll-option-btn${isMyVote ? ' is-voted' : ''}" data-idx="${i}">
                            <div class="poll-option-bar" style="width:${pct}%"></div>
                            <span class="poll-option-label">${window.escapeHtml(opt)}</span>
                            <span class="poll-option-pct">${pct}%</span>
                        </button>
                    `;
                }).join('')}
            </div>
            <div class="poll-footer">
                ${totalVotes} oy · ${poll.is_anonymous ? 'Anonim' : ''} ${poll.is_multiple ? '· Çoklu seçim' : ''}
            </div>
        `;

        // Oy verme
        card.querySelectorAll('.poll-option-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const idx = parseInt(btn.dataset.idx);
                if (!window.currentUser?.id) return;
                const existing = myIndices.includes(idx);
                const newIndices = existing
                    ? myIndices.filter(i => i !== idx)
                    : (poll.is_multiple ? [...myIndices, idx] : [idx]);

                if (newIndices.length === 0) {
                    await window.FocusSupabase.from('poll_votes').delete().eq('poll_id', pollId).eq('user_id', window.currentUser.id);
                } else {
                    await window.FocusSupabase.from('poll_votes').upsert({ poll_id: pollId, user_id: window.currentUser.id, option_indices: newIndices });
                }
                // Yenile
                containerEl.innerHTML = '';
                window.FocusChat.renderPollCard(pollId, containerEl);
            });
        });

        containerEl.appendChild(card);
    } catch(e) { console.error('[Poll] render hatası', e); }
};

// Poll modalı bind
(function initPollModal() {
    const tryBind = () => {
        const addOptBtn = document.getElementById('poll-add-option-btn');
        const submitBtn = document.getElementById('poll-modal-submit');
        const cancelBtn = document.getElementById('poll-modal-cancel');
        const closeBtn  = document.getElementById('poll-modal-close');
        if (!addOptBtn) { setTimeout(tryBind, 800); return; }

        addOptBtn.addEventListener('click', () => {
            const list = document.getElementById('poll-options-list');
            if (list.querySelectorAll('.poll-option-row').length >= 6) return;
            _addPollOptionRow(list, list.querySelectorAll('.poll-option-row').length + 1);
        });
        submitBtn?.addEventListener('click', window.FocusChat.submitPoll);
        cancelBtn?.addEventListener('click', () => document.getElementById('poll-create-modal')?.classList.add('hidden'));
        closeBtn?.addEventListener('click',  () => document.getElementById('poll-create-modal')?.classList.add('hidden'));
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tryBind);
    else tryBind();
})();

})();
