// ============================================================
// FOCUSAI SOCIAL — SOHBET ARAMA (İÇİ + TÜM SOHBETLER)
// social.js'ten çıkarıldı (2026-07-18)
// ============================================================
(function () {
'use strict';

    // ── Sohbet İçi Arama ──────────────────────────────────────
    (function setupDcChatSearch() {
        const searchBtn   = document.getElementById('dc-chat-search-btn');
        const searchBar   = document.getElementById('dc-chat-search-bar');
        const searchInput = document.getElementById('dc-chat-search-input');
        const searchCount = document.getElementById('dc-chat-search-count');
        const closeBtn    = document.getElementById('dc-chat-search-close');
        const prevBtn     = document.getElementById('dc-chat-search-prev');
        const nextBtn     = document.getElementById('dc-chat-search-next');
        if (!searchBtn || !searchBar || !searchInput) return;

        let matches = [];
        let activeIdx = -1;

        function clearSearch() {
            const streamEl = document.getElementById('sidebar-chat-messages-stream');
            if (streamEl) {
                streamEl.querySelectorAll('.dc-msg-search-dim').forEach(el => el.classList.remove('dc-msg-search-dim'));
                streamEl.querySelectorAll('.dc-msg-search-match, .dc-msg-search-active').forEach(el => el.classList.remove('dc-msg-search-match', 'dc-msg-search-active'));
            }
            matches = [];
            activeIdx = -1;
            searchCount.textContent = '';
        }

        function setActive(idx) {
            if (matches[activeIdx]) matches[activeIdx].classList.remove('dc-msg-search-active');
            activeIdx = idx;
            if (matches[activeIdx]) {
                const row = matches[activeIdx];
                row.classList.add('dc-msg-search-active');
                row.scrollIntoView({ block: 'center', behavior: 'smooth' });
                searchCount.textContent = `${activeIdx + 1}/${matches.length}`;

                // Hedef mesajı kısa süreliğine vurgula (flash) — kullanıcının gözünden kaçmasın
                row.classList.remove('dc-msg-flash');
                void row.offsetWidth; // animasyonu yeniden tetiklemek için reflow zorla
                row.classList.add('dc-msg-flash');
                clearTimeout(row._flashTimer);
                row._flashTimer = setTimeout(() => row.classList.remove('dc-msg-flash'), 1200);
            }
        }

        function runSearch() {
            const term = searchInput.value.trim().toLowerCase();
            const streamEl = document.getElementById('sidebar-chat-messages-stream');
            if (!streamEl) return;
            const rows = streamEl.querySelectorAll('.dc-dm-msg-row');

            if (!term) { clearSearch(); return; }

            matches = [];
            rows.forEach(row => {
                const textEl = row.querySelector('.dc-msg-text');
                const text = textEl ? textEl.textContent.toLowerCase() : '';
                const isMatch = text.includes(term);
                row.classList.toggle('dc-msg-search-dim', !isMatch);
                row.classList.toggle('dc-msg-search-match', isMatch);
                row.classList.remove('dc-msg-search-active');
                if (isMatch) matches.push(row);
            });

            if (matches.length) {
                setActive(matches.length - 1);
            } else {
                activeIdx = -1;
                searchCount.textContent = '0/0';
            }
        }

        searchBtn.addEventListener('click', () => {
            const visible = searchBar.style.display !== 'none';
            searchBar.style.display = visible ? 'none' : 'flex';
            if (!visible) searchInput.focus();
            else { searchInput.value = ''; clearSearch(); }
        });
        closeBtn?.addEventListener('click', () => {
            searchBar.style.display = 'none';
            searchInput.value = '';
            clearSearch();
        });
        searchInput.addEventListener('input', runSearch);
        prevBtn?.addEventListener('click', () => {
            if (!matches.length) return;
            setActive((activeIdx - 1 + matches.length) % matches.length);
        });
        nextBtn?.addEventListener('click', () => {
            if (!matches.length) return;
            setActive((activeIdx + 1) % matches.length);
        });
        searchInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (e.shiftKey) prevBtn?.click(); else nextBtn?.click();
            } else if (e.key === 'Escape') {
                closeBtn?.click();
            }
        });

        // Sohbet değiştiğinde arama çubuğunu kapat
        window.closeDcChatSearch = () => {
            if (searchBar.style.display === 'none') return;
            searchBar.style.display = 'none';
            searchInput.value = '';
            clearSearch();
        };
    })();

    // ── Tüm Sohbetlerde Arama ─────────────────────────────────
    (function setupDcGlobalSearch() {
        const btn = document.getElementById('dc-global-search-btn');
        if (!btn) return;

        let overlay = null;

        function highlight(text, term) {
            const esc = window._escapeHtml;
            const safeText = esc(text);
            if (!term) return safeText;
            const safeTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            return safeText.replace(new RegExp('(' + safeTerm + ')', 'gi'), '<mark class="dc-global-search-hl">$1</mark>');
        }

        function jumpToMessage(meta, key) {
            const tryFlash = () => {
                const row = document.querySelector(`#sidebar-chat-messages-stream [data-msg-key="${key}"]`);
                if (!row) return false;
                row.scrollIntoView({ block: 'center', behavior: 'smooth' });
                row.classList.remove('dc-msg-flash');
                void row.offsetWidth; // animasyonu yeniden tetikle
                row.classList.add('dc-msg-flash');
                clearTimeout(row._flashTimer);
                row._flashTimer = setTimeout(() => row.classList.remove('dc-msg-flash'), 1200);
                return true;
            };

            if (meta.type === 'dm') {
                if (typeof window.openDcDmRoom === 'function') window.openDcDmRoom(meta.username, meta.displayName);
            } else {
                if (typeof window.openDcChatRoom === 'function') window.openDcChatRoom(meta.groupCode, meta.roomName, meta.roomId, meta.channelId);
            }

            let attempts = 0;
            const interval = setInterval(() => {
                attempts++;
                if (tryFlash() || attempts > 20) clearInterval(interval);
            }, 150);
        }

        function runSearch(rawTerm) {
            const resultsEl = overlay.querySelector('.dc-global-search-results');
            const term = rawTerm.trim().toLowerCase();
            if (!term) {
                resultsEl.innerHTML = `<div class="dc-global-search-empty">Aramak için en az bir karakter yazın.</div>`;
                return;
            }

            const results = [];
            Object.values(window._dcGlobalMsgCache || {}).forEach(entry => {
                Object.entries(entry.msgs || {}).forEach(([key, m]) => {
                    const text = m.text || m.decryptedText || '';
                    if (!text || !text.toLowerCase().includes(term)) return;
                    results.push({ key, m, meta: entry.meta });
                });
            });
            results.sort((a, b) => (b.m.timestamp || 0) - (a.m.timestamp || 0));

            if (!results.length) {
                resultsEl.innerHTML = `<div class="dc-global-search-empty">Sonuç bulunamadı. Sadece daha önce açtığın sohbetler aranır.</div>`;
                return;
            }

            const esc = window._escapeHtml;
            resultsEl.innerHTML = results.slice(0, 100).map((r, idx) => {
                const sender = esc(r.m.displayName || r.m.username || '?');
                const chatName = esc(r.meta.displayName || '');
                const snippet = highlight((r.m.text || r.m.decryptedText || '').slice(0, 140), term);
                const time = r.m.timestamp ? new Date(r.m.timestamp).toLocaleString('tr-TR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : '';
                const avatarUrl = r.m.customAvatar || (window.dcAvatar ? window.dcAvatar(sender, r.m.avatarColor || '6c5ce7') : `https://ui-avatars.com/api/?name=${encodeURIComponent(sender)}&background=${(r.m.avatarColor||'6c5ce7')}&color=fff`);
                return `
                    <div class="dc-global-search-item" data-idx="${idx}">
                        <img class="dc-global-search-avatar" src="${esc(avatarUrl)}" alt="">
                        <div class="dc-global-search-body">
                            <div class="dc-global-search-meta">
                                <span class="dc-global-search-sender">${sender}</span>
                                <span class="dc-global-search-chat"><i class="fa-solid fa-${r.meta.type === 'dm' ? 'at' : 'hashtag'}"></i> ${chatName}</span>
                                <span class="dc-global-search-time">${time}</span>
                            </div>
                            <div class="dc-global-search-snippet">${snippet}</div>
                        </div>
                    </div>`;
            }).join('');

            resultsEl.querySelectorAll('.dc-global-search-item').forEach(item => {
                item.addEventListener('click', () => {
                    const r = results[parseInt(item.dataset.idx, 10)];
                    closeModal();
                    jumpToMessage(r.meta, r.key);
                });
            });
        }

        function escHandler(e) {
            if (e.key === 'Escape') closeModal();
        }

        function closeModal() {
            if (!overlay) return;
            document.removeEventListener('keydown', escHandler);
            overlay.remove();
            overlay = null;
        }

        function openModal(prefill) {
            overlay = document.createElement('div');
            overlay.className = 'dc-global-search-overlay';
            overlay.innerHTML = `
                <div class="dc-global-search-modal">
                    <div class="dc-global-search-header">
                        <i class="fa-solid fa-magnifying-glass"></i>
                        <input type="text" class="dc-global-search-input" placeholder="Tüm sohbetlerde mesaj ara...">
                        <button class="dc-global-search-close" title="Kapat"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                    <div class="dc-global-search-results"></div>
                </div>
            `;
            document.body.appendChild(overlay);
            const input = overlay.querySelector('.dc-global-search-input');
            overlay.querySelector('.dc-global-search-close').addEventListener('click', closeModal);
            overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
            input.addEventListener('input', () => runSearch(input.value));
            document.addEventListener('keydown', escHandler);
            if (prefill) input.value = prefill;
            runSearch(prefill || '');
            setTimeout(() => input.focus(), 50);
        }

        btn.addEventListener('click', () => {
            if (overlay) { closeModal(); return; }
            const actionInput = document.getElementById('sidebar-action-input');
            openModal(actionInput ? actionInput.value.trim() : '');
        });

        // Üstteki birleşik arama kutusundan (sidebar-action-input) da açılabilsin —
        // kullanıcı @ ile başlamayan / grup kodu formatında olmayan bir metin
        // yazdığında bunu mesaj araması olarak yorumluyoruz.
        window.openDcGlobalSearch = (prefill) => {
            if (overlay) closeModal();
            openModal(prefill);
        };
    })();

})();
