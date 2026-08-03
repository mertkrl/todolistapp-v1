// social-dc-mentions.js
// social.js'ten çıkarıldı (Faz E, 2026-07-23): @bahsetme oto-tamamlama
// (getDcMentionableNames/setupDcMentionAutocomplete) ve mesaj metnindeki
// @bahsetmeleri odadaki kişilerle eşleştirme (parseDcMentions). Tüm state
// (currentMatches/activeIndex) setupDcMentionAutocomplete'in kendi closure'ında.
//
// Dış bağımlılıklar (window.* üzerinden): getDcState(), getActiveChatTarget(),
// window.__getDcCurrentRoomPresence, window.getMyGroupsDataCache, getUser,
// window._escapeHtml.
// ─── @BAHSETME (MENTION) OTO-TAMAMLAMA ─────────────────
// @ ile sadece o an aynı çalışma odasında (presence) bulunan kişiler etiketlenebilir
import { getActiveChatTarget } from './state/active-chat-target-store.js';
import { getDcState } from './state/dc-state-store.js';
import { getUser } from './social-misc-pure-utils.js';
export function getDcMentionableNames() {
        const st = getDcState() || {};
        const isWorkRoom = !!st.chanId && st.roomId !== 'general' && st.roomId !== 'genel' && st.roomId !== 'ch-general';
        if (isWorkRoom) return window.__getDcCurrentRoomPresence() || [];

        // M2d: çalışma odası dışındaki grup sohbetlerinde (#genel, kategori
        // kanalları, alt-kanallar) etiketlenebilir kişiler = grubun tüm üyeleri
        const target = getActiveChatTarget();
        if (target && target.type === 'group' && typeof window.getMyGroupsDataCache === 'function') {
            const g = window.getMyGroupsDataCache()[target.code];
            if (g && g.members) return Object.keys(g.members);
        }
        return [];
    }

    window.getDcMentionableNames = getDcMentionableNames;

export function setupDcMentionAutocomplete(inputEl) {
        const dropdown = document.getElementById('dc-mention-autocomplete');
        if (!dropdown || !inputEl) return;

        let currentMatches = [];
        let activeIndex = -1;

        function closeDropdown() {
            dropdown.classList.add('is-hidden');
            dropdown.innerHTML = '';
            currentMatches = [];
            activeIndex = -1;
        }

        function getMentionQuery() {
            const target = getActiveChatTarget();
            if (!target || target.type !== 'group') return null;
            const cursor = inputEl.selectionStart;
            const text = inputEl.value.slice(0, cursor);
            const match = text.match(/(?:^|\s)@([\wçğıöşüÇĞİÖŞÜ]*)$/);
            return match ? match[1] : null;
        }

        function updateActiveItem() {
            dropdown.querySelectorAll('.dc-mention-item').forEach((item, i) => {
                item.classList.toggle('is-active', i === activeIndex);
            });
        }

        function applyMention(username) {
            const cursor = inputEl.selectionStart;
            const text = inputEl.value;
            const before = text.slice(0, cursor);
            const after = text.slice(cursor);
            const newBefore = before.replace(/(^|\s)@([\wçğıöşüÇĞİÖŞÜ]*)$/, (m, lead) => `${lead}@${username} `);
            inputEl.value = newBefore + after;
            const newPos = newBefore.length;
            inputEl.focus();
            inputEl.setSelectionRange(newPos, newPos);
            closeDropdown();
            inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        }

        function renderDropdown(query) {
            const lower = query.toLowerCase();
            const myUsername = (getUser() || {}).username;
            currentMatches = getDcMentionableNames()
                .filter(name => name !== myUsername && name.toLowerCase().startsWith(lower))
                .slice(0, 6);
            if (!currentMatches.length) { closeDropdown(); return; }
            activeIndex = 0;
            dropdown.innerHTML = currentMatches.map((name, i) => `
                <div class="dc-mention-item${i === 0 ? ' is-active' : ''}" data-username="${window._escapeHtml(name)}">@${window._escapeHtml(name)}</div>
            `).join('');
            dropdown.classList.remove('is-hidden');
            dropdown.querySelectorAll('.dc-mention-item').forEach((item, i) => {
                item.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    applyMention(currentMatches[i]);
                });
            });
        }

        inputEl.addEventListener('input', () => {
            const query = getMentionQuery();
            if (query === null) { closeDropdown(); return; }
            renderDropdown(query);
        });

        inputEl.addEventListener('keydown', (e) => {
            if (dropdown.classList.contains('is-hidden') || !currentMatches.length) return;
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                activeIndex = (activeIndex + 1) % currentMatches.length;
                updateActiveItem();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                activeIndex = (activeIndex - 1 + currentMatches.length) % currentMatches.length;
                updateActiveItem();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                closeDropdown();
            } else if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                applyMention(currentMatches[activeIndex]);
            }
        });

        inputEl.addEventListener('blur', () => setTimeout(closeDropdown, 150));
    }

    window.setupDcMentionAutocomplete = setupDcMentionAutocomplete;

    // Mesaj metni içindeki @kullanıcıadı bahsetmelerini, sadece o an aynı çalışma
    // odasında bulunan kişilerle eşleştirir — odada olmayan biri @ ile etiketlenemez
export function parseDcMentions(text) {
        const mentionable = getDcMentionableNames();
        if (!text || !mentionable.length) return [];
        const found = new Set();
        mentionable.forEach(name => {
            const safe = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const re = new RegExp('@' + safe + '\\b', 'i');
            if (re.test(text)) found.add(name);
        });
        return Array.from(found);
    }
    window.parseDcMentions = parseDcMentions;

