// inline-module-loader.js — index.html'deki tek type="module" inline <script>'ten taşındı.
// social.js (1.6MB), planning.js (480KB) ve collab.js (58KB) ilk yüklemeyi
// bloklamasın diye artık senkron <script src> ile değil, sayfa yüklendikten
// sonra sırayla (orijinal çalışma sırası korunarak: social → planning → collab)
// dinamik import() ile yükleniyor. Bu üç dosya zaten kendi init kodlarını
// document.readyState==='loading' kontrolüyle çalıştırıyor, yani geç
// yüklenmeye karşı hazırlar — bu değişiklik davranışlarını değiştirmez,
// sadece "Bugün" sekmesindeki ilk etkileşimi geciktiren indirme/parse
// yükünü öteler.
// NOT: document.createElement('script') + s.type='module' yerine gerçek
// import() kullanılıyor — Vite'ın build sırasında bu dosyaları statik
// olarak keşfedip bundle/minify edebilmesi için gerekli (createElement ile
// çalışma zamanında enjekte edilen script'leri bundler statik analizle
// göremiyordu). Hata durumunda (bir modül yüklenemezse) sıradaki modüle
// geçmeye devam eder — eski onerror davranışıyla aynı. Bu dosya index.html'de
// type="module" olarak yüklenmeli (import() kullandığı için).
(function() {
    async function start() {
        const steps = [
            () => import('./social-toast.js'),
            () => import('./social-productivity-share.js'),
            () => import('./social-groups.js'),
            () => import('./social-presence.js'),
            () => import('./social-server-tree.js'),
            () => import('./social-room-presence.js'),
            () => import('./social-typing-read-receipts.js'),
            () => import('./social-dm-notifications.js'),
            () => import('./social-shared-focus-math.js'),
            () => import('./social-dc-msg-dom-helpers.js'),
            () => import('./social-misc-isolated-utils.js'),
            () => import('./social-presence-focus-utils.js'),
            () => import('./social-dc-scroll-utils.js'),
            () => import('./social-dc-last-open-storage.js'),
            () => import('./social-cw-heartbeat.js'),
            () => import('./social-shared-focus-phase-ui.js'),
            () => import('./social-throttle-and-date-utils.js'),
            () => import('./social.js'),
            () => import('./social-floating-chat-badge.js'),
            () => import('./social-dc-chat-context.js'),
            // Faz G Kategori 3: social-e2e.js buraya, social.js'ten SONRAYA
            // taşındı — getUser/getDB'yi artık gerçek import ile alıyor
            // (önceden social.js'ten ÖNCE yüklendiği için sadece window.*
            // köprüsü kullanabiliyordu). window.decryptDmText'i runtime'da
            // tüketen social-dm-notifications.js (yukarıda, ÖNCE yüklenir)
            // bunu sadece fonksiyon gövdesi içinde çağırıyor, sıra değişikliği
            // onu etkilemiyor.
            () => import('./social-e2e.js'),
            () => import('./social-conn-status.js'),
            () => import('./social-dc-confirm-toasts.js'),
            () => import('./social-dc-msg-selection.js'),
            // Faz H (2026-07-27): social-friend-search.js / social-settings-modal.js
            // gerçek import kullanabilsin diye ürettikleri fonksiyonların hepsi
            // (avatarImgHtml, getFriends/searchUser/sendFriendRequest/removeFriend,
            // isBlockedEitherWay/renderBlockedUsersSettings, requestDesktopNotificationPermission)
            // buraya, iki tüketiciden ÖNCEYE taşındı. Bu 4 dosyanın hiçbiri modül
            // üst seviyesinde (top-level) başka social-*.js fonksiyonu çağırmıyor —
            // sadece window._escapeHtml'e (social.js, yukarıda zaten yüklü) bağımlılar,
            // dolayısıyla erken taşınmaları güvenli.
            () => import('./social-avatar-utils.js'),
            () => import('./social-friends-notifications.js'),
            () => import('./social-block-users.js'),
            () => import('./social-notif-sounds.js'),
            () => import('./social-friend-search.js'),
            () => import('./social-arena-chips.js'),
            () => import('./social-dc-profile-resolve.js'),
            () => import('./social-dc-message-cards.js'),
            () => import('./social-cw-invites.js'),
            () => import('./social-cw-control-request.js'),
            () => import('./social-profile-header.js'),
            () => import('./social-home-summary.js'),
            () => import('./social-dc-online-status.js'),
            () => import('./social-dc-mentions.js'),
            () => import('./social-dc-draft.js'),
            () => import('./social-dc-chat-theme.js'),
            () => import('./social-settings-modal.js'),
            () => import('./social-dc-contacts.js'),
            () => import('./social-mini-profile-popup.js'),
            () => import('./social-dc-init.js'),
            () => import('./social-group-details.js'),
            () => import('./social-dm-limit-notice.js'),
            () => import('./social-group-discover.js'),
            () => import('./social-institution-panel.js'),
            () => import('./social-emoji-picker.js'),
            () => import('./social-group-focus-render.js'),
            () => import('./social-focus-quote-rotation.js'),
            () => import('./social-group-focus-idle.js'),
            () => import('./social-message-pins.js'),
            () => import('./social-group-focus-break-chat.js'),
            () => import('./social-group-focus-leave.js'),
            () => import('./social-group-focus-task-selector.js'),
            () => import('./social-chat-list-actions.js'),
            () => import('./social-chat-local-delete.js'),
            () => import('./social-focus-reminders.js'),
            () => import('./social-online-people-popover.js'),
            () => import('./social-assignments-badge.js'),
            () => import('./social-focus-hush.js'),
            () => import('./social-daily-race.js'),
            () => import('./social-unread-divider.js'),
            () => import('./social-chat-search.js'),
            () => import('./social-chat-clear.js'),
            () => import('./social-sidebar-profile.js'),
            () => import('./social-buddy-habits.js'),
            () => import('./social-online-friends.js'),
            () => import('./social-activity-feed.js'),
            () => import('./social-roles.js'),
            () => import('./social-gamification.js'),
            () => import('./social-chat-extras.js'),
            () => import('./social-polls.js'),
            () => import('./planning-wizard-info-tooltip.js'),
            () => import('./planning-ghost-toast.js'),
            () => import('./planning-dependency-graph.js'),
            () => import('./planning-lesson-plan-modal.js'),
            () => import('./planning-realtime.js'),
            () => import('./planning-milestone-wizard.js'),
            () => import('./planning-wizard.js'),
            () => import('./planning-plan-header.js'),
            () => import('./planning-lesson-plan-conflicts.js'),
            () => import('./planning-lesson-plan-busy-slots.js'),
            () => import('./planning-plan-view-time-utils.js'),
            () => import('./planning-plan-view-dom-fx.js'),
            () => import('./planning-goal-sync-cleanup.js'),
            () => import('./planning-goal-detail-render.js'),
            () => import('./planning-main-cal-render.js'),
            () => import('./planning-day-panel-markup.js'),
            () => import('./planning-plan-summary-render.js'),
            () => import('./planning-lesson-plan-mirror.js'),
            () => import('./planning-milestone-list-render.js'),
            () => import('./planning-week-day-cal-render.js'),
            () => import('./planning-toast-esc.js'),
            () => import('./planning-collab-handlers.js'),
            () => import('./planning-init-setup.js'),
            () => import('./planning-open-plan-view.js'),
            () => import('./planning-goal-crud.js'),
            () => import('./planning-milestone-crud.js'),
            () => import('./planning-goal-load-sync.js'),
            () => import('./planning-quick-create-collab.js'),
            () => import('./planning-lesson-plan-route.js'),
            () => import('./planning-detail-panel.js'),
            () => import('./planning-collab-invite-delete.js'),
            () => import('./planning-plan-view-exit.js'),
            () => import('./planning-day-panel-events.js'),
            () => import('./planning-pv-main-cal.js'),
            () => import('./planning-quick-add-ms.js'),
            () => import('./planning-pv-lifecycle.js'),
            () => import('./planning-goal-collab-bridge.js'),
            () => import('./planning.js'),
            () => import('./planning-utils.js'),
            () => import('./planning-quick-create.js'),
            () => import('./planning-collab-wait.js'),
            () => import('./planning-lesson-plan-invites.js'),
            () => import('./planning-misc-widgets.js'),
            () => import('./planning-lesson-plan-assign.js'),
            () => import('./collab.js'),
        ];
        for (const step of steps) {
            try { await step(); } catch (e) { console.warn('[FocusAI] modül yüklenemedi:', e); }
        }
    }
    if (document.readyState === 'complete') {
        start();
    } else {
        window.addEventListener('load', function() {
            if ('requestIdleCallback' in window) requestIdleCallback(start, { timeout: 1500 });
            else setTimeout(start, 0);
        });
    }
})();
