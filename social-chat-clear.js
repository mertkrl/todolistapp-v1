// ============================================================
// FOCUSAI SOCIAL — SOHBETİ TEMİZLE BUTONU
// social.js'ten çıkarıldı (2026-07-18)
// ============================================================
import { dcSetClearedAt } from './social-chat-local-delete.js';
import { dcShowConfirm } from './social-dc-confirm-toasts.js';
import { getCurrentUser } from './state/current-user-store.js';
import { getActiveChatTarget } from './state/active-chat-target-store.js';
import { getDcCurrentGroupScope } from './state/dc-current-group-scope-store.js';
(function () {
'use strict';

    // ── Sohbeti Temizle Butonu ────────────────────────────────
    // Not: eskiden burada "const database = null; if (!database) return;" vardı —
    // Firebase M2 göçüyle kapatıldığından bu, butonu hep sessizce no-op yapıyordu.
    // Ayrıca grup sohbetleri için burada üretilen path eski Firebase şemasıydı
    // (focusai_community/groups/...), oysa mesaj yükleyici artık
    // `supabase_group_${scope.type}_${scope.id}` anahtarına bakıyor — bu yüzden
    // path'i o formatla eşleştirdik, aksi halde "temizlendi" görünse de bir
    // sonraki açılışta mesajlar geri gelirdi.
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#clear-chat-btn')) return;

        // Aktif sohbet bir DM ise — sadece bu cihazda/kullanıcıda görünümü temizle
        // (karşı taraf etkilenmez, mesajlar Supabase'te kalır)
        const _active = getActiveChatTarget();
        if (_active && _active.type === 'dm' && _active.username && getCurrentUser()) {
            dcShowConfirm({
                title: 'Sohbeti Temizle',
                message: 'Bu sohbet sadece sizin görünümünüzden temizlenecek. Karşı taraf mesajları görmeye devam edecek.',
                confirmText: 'Sohbeti Temizle',
                onConfirm: () => {
                    const dmId = [getCurrentUser().username, _active.username].sort().join('_');
                    const dmPath = `focusai_community/direct_messages/${dmId}`;
                    dcSetClearedAt(dmPath, Date.now());
                    const streamEl = document.getElementById('sidebar-chat-messages-stream');
                    if (streamEl) {
                        streamEl.innerHTML = '<div class="u-text-align-center_color-rgba2552552550p2_font-size-13px_pa">Sohbet temizlendi.</div>';
                    }
                    window.dcShowToast('Sohbet temizlendi.');
                }
            });
            return;
        }

        const scope = getDcCurrentGroupScope();
        if (!scope || !scope.type || !scope.id) return;

        dcShowConfirm({
            title: 'Sohbeti Temizle',
            message: 'Bu sohbet sadece sizin görünümünüzden temizlenecek. Diğer üyeler mesajları görmeye devam edecek.',
            confirmText: 'Sohbeti Temizle',
            onConfirm: () => {
                const path = `supabase_group_${scope.type}_${scope.id}`;
                dcSetClearedAt(path, Date.now());
                const streamEl = document.getElementById('sidebar-chat-messages-stream');
                if (streamEl) {
                    const hasCard = streamEl.querySelector('[id^="dc-chal-status-"]');
                    if (!hasCard) {
                        streamEl.innerHTML = '<div class="u-text-align-center_color-rgba2552552550p2_font-size-13px_pa">Sohbet temizlendi.</div>';
                    }
                }
                window.dcShowToast('Sohbet temizlendi.');
            }
        });
    });

})();
