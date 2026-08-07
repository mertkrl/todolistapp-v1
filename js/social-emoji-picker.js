// ─── EMOJİ PICKER ───────────────────────────────────
// social.js dosyasından çıkarıldı (Faz 2 — modülerleştirme, 2026-07-19).
// Mesaj kompozisyon kutusundaki emoji seçici: sıfır paylaşılan sohbet-state
// bağımlılığı, sadece DOM + kendi verisi (DC_EMOJI_GROUPS) kullanıyor.
// DC_EMOJI_GROUPS window'a açık çünkü social.js içindeki mesaj tepki
// (reaction) picker'ı (openDcMsgReactionPicker) aynı emoji setini kullanıyor.
export const DC_EMOJI_GROUPS = {
    'Sık Kullanılan': ['😀','😂','🤣','😊','😍','😘','😜','🤔','😎','🙄','😢','😭','😡','👍','👎','👏','🙏','💪','🔥','❤️','💜','💯','🎉','✅'],
    'Yüzler':         ['😀','😃','😄','😁','😆','😅','😂','🙂','😉','😊','😇','😍','😘','😋','😜','🤪','🤨','🧐','😎','😏','😒','😞','😔','😢','😭','😤','😠','😡','🥳','😴','🤯','🤗','🤭','🤫','🤐','😷','🤒','🥺'],
    'Jestler':        ['👍','👎','👏','🙏','👋','🤝','💪','✌️','🤞','👌','🤟','🫶','👊','🙌','🤙'],
    'Semboller':      ['❤️','💜','💛','💚','💙','🧡','🖤','🤍','💯','🔥','✨','⭐','✅','❌','⚡','🎯','💡','🎵','🎮','📌']
};
window.DC_EMOJI_GROUPS = DC_EMOJI_GROUPS;

export function initDcEmojiPicker() {
    const btn = document.getElementById('dc-emoji-picker-btn');
    const popover = document.getElementById('dc-emoji-picker-popover');
    if (!btn || !popover) return;

    if (!popover.dataset.filled) {
        popover.dataset.filled = '1';
        popover.innerHTML = Object.entries(DC_EMOJI_GROUPS).map(([label, emojis]) => `
            <div class="dc-emoji-popover-group-label">${label}</div>
            <div class="dc-emoji-popover-grid">
                ${emojis.map(e => `<button type="button" class="dc-emoji-popover-btn" data-emoji="${e}">${e}</button>`).join('')}
            </div>
        `).join('');
        popover.addEventListener('click', (e) => {
            const emojiBtn = e.target.closest('.dc-emoji-popover-btn');
            if (!emojiBtn) return;
            const input = document.getElementById('sidebar-chat-message-input');
            if (!input) return;
            const emoji = emojiBtn.dataset.emoji;
            const start = input.selectionStart ?? input.value.length;
            const end = input.selectionEnd ?? input.value.length;
            input.value = input.value.slice(0, start) + emoji + input.value.slice(end);
            const newPos = start + emoji.length;
            input.focus();
            input.setSelectionRange(newPos, newPos);
            input.dispatchEvent(new Event('input', { bubbles: true }));
        });
    }

    if (btn.dataset.bound === '1') return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        popover.classList.toggle('is-hidden', !popover.classList.contains('is-hidden'));
    });
    document.addEventListener('click', (e) => {
        if (!popover.classList.contains('is-hidden') && !popover.contains(e.target) && e.target !== btn) {
            popover.classList.add('is-hidden');
        }
    });
}
window.initDcEmojiPicker = initDcEmojiPicker;
