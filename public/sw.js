const CACHE = 'focusai-fcd724bb74';
const FILES = [
  './',
  './index.html',
  './a11y-focus-visible.css',
  './a11y-reduced-motion.css',
  './app-shell-layout.css',
  './arena.css',
  './asama-duzeltmeleri.css',
  './auth-ui.js',
  './book-premium-tooltip.css',
  './bsi-stat-cards.css',
  './buddy-habit.css',
  './bugun-minimalist.css',
  './bugun-tasarim-v2.css',
  './bugun-td-add-form-fixes.css',
  './bugun-yeni-minimal-tasarim.css',
  './calendar-day-drawer.css',
  './calendar-dnd-preview.css',
  './calendar-dragdrop-cards.css',
  './calendar-edit-chip-height.css',
  './calendar-event-cards.css',
  './calendar-fullscreen-mode.css',
  './calendar-gcal-style-chip.css',
  './calendar-habit-dump-widgets.css',
  './calendar-header-event-modal.css',
  './calendar-highlight-drag.css',
  './calendar-highlight-timeline.css',
  './calendar-hover-popup.css',
  './calendar-tab-bridge-override.css',
  './calendar-week-day-view.css',
  './chat-confirm-modal.css',
  './chat-fab-drag-room-pills.css',
  './chat-misc-widgets.css',
  './chat-reply-bar.css',
  './chat-theme-wallpaper-picker.css',
  './collab-invite-modal.css',
  './collab-plan-invite-card.css',
  './collab.js',
  './command-palette.css',
  './core-modal-system-bridge-v2.css',
  './core-modal-system.css',
  './core-utilities.css',
  './deepwrite-editor.css',
  './faz2-layout-overrides.css',
  './faz3-render-bridge-override.css',
  './faz5-istatistik-gunluk-bridge.css',
  './faz7-social-dock-cleanup.css',
  './five-modal-shared-polish.css',
  './flatpickr-theme.css',
  './focus-mode-page-shell.css',
  './focusai-confirm-modal.css',
  './goal-card-detail.css',
  './goal-detail-item-templates.css',
  './goal-detail-modal-sizing.css',
  './goal-modal-custom.css',
  './goal-section-header-minimal.css',
  './group-focus-room-friends.css',
  './group-focus-session-cws.css',
  './group-focus-session.css',
  './groups-discover.css',
  './groups-hub-panel.css',
  './gun-serisi-alev-sistemi.css',
  './habit-create-modal-padding.css',
  './habit-modal-fields.css',
  './habit-tracker.css',
  './help-center.css',
  './hero-metric-stats.css',
  './hybrid-chat-ui.css',
  './inline-a11y-patch.js',
  './inline-button-failsafe.js',
  './inline-dock-topbar-init.js',
  './inline-error-net.js',
  './inline-goal-modal-globals.js',
  './inline-module-loader-2.js',
  './inline-module-loader.js',
  './inline-onclick-migration.js',
  './inline-quick-add-popup.css',
  './inline-sw-register.js',
  './inline-tab-restore-dom.js',
  './inline-tab-restore-early.js',
  './leaderboard.css',
  './library-bookshelf-visuals.css',
  './library-bookshelf.css',
  './mgmt-member-rows.css',
  './mind-dump.css',
  './mini-profile-popup.css',
  './misc-small-widgets.css',
  './native-time-picker.css',
  './onboarding-tour.css',
  './page-scroll-zoom-fix.css',
  './planning-collab-handlers.js',
  './planning-collab-invite-delete.js',
  './planning-collab-live-features.css',
  './planning-collab-panel.css',
  './planning-collab-wait.css',
  './planning-collab-wait.js',
  './planning-day-panel-events.js',
  './planning-day-panel-markup.js',
  './planning-dependency-graph.js',
  './planning-detail-panel.js',
  './planning-ghost-toast.css',
  './planning-ghost-toast.js',
  './planning-goal-collab-bridge.js',
  './planning-goal-crud.js',
  './planning-goal-detail-render.js',
  './planning-goal-load-sync.js',
  './planning-goal-sync-cleanup.js',
  './planning-hourgrid-render.js',
  './planning-init-setup.js',
  './planning-lesson-plan-assign-modal.css',
  './planning-lesson-plan-assign.js',
  './planning-lesson-plan-busy-slots.js',
  './planning-lesson-plan-conflicts.js',
  './planning-lesson-plan-invites.css',
  './planning-lesson-plan-invites.js',
  './planning-lesson-plan-mirror.js',
  './planning-lesson-plan-modal.css',
  './planning-lesson-plan-modal.js',
  './planning-lesson-plan-route.js',
  './planning-main-cal-render.js',
  './planning-main-page-layout.css',
  './planning-milestone-crud.js',
  './planning-milestone-list-render.js',
  './planning-milestone-widgets.css',
  './planning-milestone-wizard-cal.js',
  './planning-milestone-wizard.js',
  './planning-misc-widgets.css',
  './planning-misc-widgets.js',
  './planning-mode-select-modal.css',
  './planning-open-plan-view.js',
  './planning-plan-header.js',
  './planning-plan-summary-render.js',
  './planning-plan-view-dom-fx.js',
  './planning-plan-view-exit.js',
  './planning-plan-view-milestone-wizard.css',
  './planning-plan-view-time-utils.js',
  './planning-pv-lifecycle.js',
  './planning-pv-main-cal.js',
  './planning-pv-render.js',
  './planning-quick-add-ms.js',
  './planning-quick-create-collab.js',
  './planning-quick-create.css',
  './planning-quick-create.js',
  './planning-realtime.js',
  './planning-subtask-list.css',
  './planning-toast-esc.js',
  './planning-utils.js',
  './planning-week-day-cal-render.js',
  './planning-wizard-info-tooltip.js',
  './planning-wizard-lesson-plan.css',
  './planning-wizard.js',
  './planning.js',
  './poll-card.css',
  './premium-ambient-misc-widgets.css',
  './premium-validation-minddump-drawer.css',
  './profile-dropdown-menu.css',
  './profile-edit-modal.css',
  './profile-settings-modal.css',
  './room-presence-strip.css',
  './script-add-task.js',
  './script-ambient-sounds.js',
  './script-book-detail-modal.js',
  './script-cal-dnd.js',
  './script-calendar-date-utils.js',
  './script-calendar-dragdrop.js',
  './script-calendar-fullscreen.js',
  './script-calendar-hover-popup.js',
  './script-calendar-month-view.js',
  './script-calendar-sync-bridge.js',
  './script-calendar-view-switch.js',
  './script-calendar-week-day-view.js',
  './script-challenge-days.js',
  './script-color-utils.js',
  './script-command-palette.js',
  './script-confetti.js',
  './script-convert-modal.js',
  './script-coworking-groups.js',
  './script-daily-highlight.js',
  './script-data-sync-refresh.js',
  './script-date-time-utils.js',
  './script-day-drawer-core.js',
  './script-day-drawer-render.js',
  './script-day-summary-card.js',
  './script-edit-task-modal.js',
  './script-evening-reflection-modal.js',
  './script-event-modal.js',
  './script-focus-mode.js',
  './script-goal-archiver.js',
  './script-goal-deadline-extend.js',
  './script-goal-delete-prompt.js',
  './script-goal-details-panel.js',
  './script-goal-details-sections.js',
  './script-goal-modal-open-close.js',
  './script-goal-modal.js',
  './script-goal-reward-ui.js',
  './script-habit-category-modal.js',
  './script-habit-edit-modal.js',
  './script-habit-goal-synergy.js',
  './script-habit-modal-dates.js',
  './script-habit-render-mutate.js',
  './script-habit-sync.js',
  './script-journal-library.js',
  './script-journal-modal.js',
  './script-library-lamp-parallax.js',
  './script-migrate-event-keys.js',
  './script-milestone-auto-splitter.js',
  './script-milestone-goal-actions.js',
  './script-mind-dump-calendar-bridge.js',
  './script-mind-dump-drawer.js',
  './script-mind-dump.js',
  './script-misc-widgets.js',
  './script-move-task-to-date.js',
  './script-nlp.js',
  './script-onboarding-tour.js',
  './script-plan-wizard.js',
  './script-populate-parent-selects.js',
  './script-premium-alert-toast.js',
  './script-premium-modal.js',
  './script-profile-dropdown.js',
  './script-profile-edit.js',
  './script-quick-add.js',
  './script-reflection-date-utils.js',
  './script-render-social-stats.js',
  './script-schedule-conflict-utils.js',
  './script-settings-steppers.js',
  './script-smart-task-add.js',
  './script-spotlight-search.js',
  './script-statistics.js',
  './script-system-settings.js',
  './script-tab-restore.js',
  './script-tab-switch-core.js',
  './script-task-breadcrumb.js',
  './script-task-complete-sound.js',
  './script-task-end-question.js',
  './script-task-render-mutate.js',
  './script-time-picker.js',
  './script-timer-flame.js',
  './script-timer.js',
  './script-today-stats.js',
  './script-toggle-activity-reaction.js',
  './script-toggle-task.js',
  './script-undo-toast.js',
  './script-update-timer-dropdown.js',
  './script.js',
  './sidebar-chat-panel-redesign.css',
  './sidebar-social-panel-redesign.css',
  './social-activity-feed.js',
  './social-arena-chips.js',
  './social-assignments-badge.js',
  './social-auth-bootstrap.js',
  './social-avatar-utils.js',
  './social-block-users.js',
  './social-buddy-focus-settings-modal.js',
  './social-buddy-habits.js',
  './social-chat-clear.js',
  './social-chat-extras.js',
  './social-chat-gate.js',
  './social-chat-list-actions.js',
  './social-chat-local-delete.js',
  './social-chat-panel-open.js',
  './social-chat-search.js',
  './social-color-toast.css',
  './social-conn-status.js',
  './social-cw-control-request.js',
  './social-cw-heartbeat.js',
  './social-cw-invites.js',
  './social-cw-room-helpers.js',
  './social-daily-race.js',
  './social-dc-chat-context.js',
  './social-dc-chat-theme.js',
  './social-dc-confirm-toasts.js',
  './social-dc-contacts.js',
  './social-dc-draft.js',
  './social-dc-group-admin.js',
  './social-dc-init.js',
  './social-dc-last-open-storage.js',
  './social-dc-mentions.js',
  './social-dc-message-cards.js',
  './social-dc-message-mutate.js',
  './social-dc-message-render.js',
  './social-dc-msg-dom-helpers.js',
  './social-dc-msg-selection.js',
  './social-dc-online-status.js',
  './social-dc-open-room.js',
  './social-dc-pagination.js',
  './social-dc-panel-view.js',
  './social-dc-profile-resolve.js',
  './social-dc-reply-reactions.js',
  './social-dc-room-lifecycle.js',
  './social-dc-scroll-skeleton.js',
  './social-dc-scroll-utils.js',
  './social-dc-session-strip.js',
  './social-dm-limit-notice.js',
  './social-dm-notifications.js',
  './social-e2e.js',
  './social-emoji-picker.js',
  './social-floating-chat-badge.js',
  './social-focus-hush.js',
  './social-focus-quote-rotation.js',
  './social-focus-reminders.js',
  './social-friend-search.js',
  './social-friends-groups-listeners.js',
  './social-friends-notifications.js',
  './social-gamification.js',
  './social-group-details.js',
  './social-group-discover.js',
  './social-group-focus-break-chat.js',
  './social-group-focus-idle.js',
  './social-group-focus-leave.js',
  './social-group-focus-render.js',
  './social-group-focus-task-selector.js',
  './social-group-listeners.js',
  './social-group-mention-notif.js',
  './social-group-modal-setup.js',
  './social-group-roles-permissions.css',
  './social-group-session-calendar.js',
  './social-groups.js',
  './social-home-summary.js',
  './social-institution-class-modals.js',
  './social-institution-classroom-insights.js',
  './social-institution-classroom-perf-utils.js',
  './social-institution-classroom-sections.js',
  './social-institution-classroom-wire.js',
  './social-institution-my-groups.js',
  './social-institution-panel.css',
  './social-institution-panel.js',
  './social-institution-student-report.js',
  './social-message-pins.js',
  './social-mini-focus-timer.js',
  './social-mini-profile-popup.js',
  './social-misc-isolated-utils.js',
  './social-misc-pure-utils.js',
  './social-my-groups-active.js',
  './social-notif-sounds.js',
  './social-online-friends.css',
  './social-online-friends.js',
  './social-online-people-popover.js',
  './social-polls.js',
  './social-presence-focus-utils.js',
  './social-presence.js',
  './social-productivity-share.css',
  './social-productivity-share.js',
  './social-profile-header.js',
  './social-roles.js',
  './social-room-presence.js',
  './social-server-tree.js',
  './social-settings-modal.js',
  './social-setup-modal-edit.js',
  './social-setup-profile-listeners.js',
  './social-shared-focus-math.js',
  './social-shared-focus-overlay.js',
  './social-shared-focus-phase-ui.js',
  './social-shared-focus-room-lifecycle.js',
  './social-shared-focus-sync.js',
  './social-shared-focus-timer-ctrl.js',
  './social-shared-focus-ui.js',
  './social-sidebar-profile.js',
  './social-throttle-and-date-utils.js',
  './social-toast.js',
  './social-typing-read-receipts.js',
  './social-unread-divider.js',
  './social-user-registration.js',
  './social.js',
  './sohbet-3sutun-mimari.css',
  './sohbet-faz-gelistirmeleri.css',
  './sohbet-sol-panel-final.css',
  './sohbet-tab-design-v2.css',
  './sohbet-tab-minimalist.css',
  './state-store.js',
  './statistics-page.css',
  './storage-manager.js',
  './style-final-overrides.css',
  './style.css',
  './supabase-client.js',
  './system-settings-modal.css',
  './task-card-themes-scrollbar.css',
  './task-form-misc-controls.css',
  './task-mini-goal-selector.css',
  './time-picker-task-controls.css',
  './timer-ambient-mixer.css',
  './timer-bridge-override.css',
  './timer-core-widget.css',
  './timer-floating-widgets.css',
  './timer-profiles.css',
  './timer-scene-immersive-mode.css',
  './timer-scene-picker.css',
  './timer-settings-advanced.css',
  './timer-task-end-question.css',
  './today-sprint-widget.css',
  './tokens.css',
  './trend-chart-svg.css',
  './undo-toast-fab-spotlight.css',
  './utility-classes.css',
  './v2-design-system.css',
  './zettelkasten-library.css'
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(async c => {
      // c.addAll(FILES) YERİNE tek tek fetch+put: FILES artık build-time
      // otomatik üretiliyor (scripts/update-sw-file-list.py) ve 270+ dosya
      // içeriyor — addAll TÜM-YA-DA-HİÇBİRİ çalışır, listede tek bir eksik
      // dosya olsa (ör. üretim build'inde dosya adları hash'lenip
      // değiştiğinde) kurulumun TAMAMI sessizce başarısız olurdu.
      // Ayrıca bazı sunucular (SPA fallback yapan static host'lar, `vite
      // preview` dahil) olmayan bir yol için 404 yerine index.html'i 200
      // ile döndürür — content-type kontrolü olmadan bu, bir .css/.js
      // isteğinin YANLIŞLIKLA index.html içeriğiyle önbelleğe düşmesine
      // (ve offline modda sayfanın bozuk görünmesine) yol açar.
      await Promise.all(FILES.map(async url => {
        try {
          const res = await fetch(url, { cache: 'no-cache' });
          if (!res.ok) return; // 404 vb. — bu dosyayı sessizce atla, diğerlerini engelleme
          const ct = res.headers.get('content-type') || '';
          if (url.endsWith('.css') && !ct.includes('css')) return;
          if (url.endsWith('.js') && !ct.includes('javascript')) return;
          await c.put(url, res);
        } catch (_) { /* tek dosyanın ağ hatası diğerlerini engellemesin */ }
      }));
    })
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // .js, .css, .html ve sayfa navigasyonları: stale-while-revalidate.
  // Önceki sürüm ("her zaman ağdan bekle") her yüklemede 4.6MB'lık ham JS/CSS'i
  // yeniden indirtiyordu — PWA'nın hız avantajını tamamen sıfırlıyordu. Bu
  // sürüm önbellekte varsa ANINDA onu döndürür (hızlı ilk boyama), AYNI ANDA
  // arka planda ağdan taze kopyayı çekip önbelleği günceller — bir sonraki
  // yüklemede yeni sürüm görünür. "Bayat veri asla güncellenmez" bug'ı
  // (2026-07-14) burada oluşmuyor çünkü her istekte arka plan revalidasyonu
  // tetikleniyor, cache asla "sonsuza dek dondurulmuş" olmuyor.
  const url = e.request.url;
  if (e.request.mode === 'navigate' || url.endsWith('.js') || url.endsWith('.css') || url.endsWith('.html')) {
    e.respondWith(
      caches.open(CACHE).then(async c => {
        const cached = await c.match(e.request);
        const network = fetch(e.request).then(res => {
          if (res && res.ok) c.put(e.request, res.clone());
          return res;
        }).catch(() => null);
        if (cached) {
          network; // arka planda güncelle, yanıtı bekletme
          return cached;
        }
        const fresh = await network;
        return fresh || cached || Response.error();
      })
    );
    return;
  }
  // Cross-origin istekleri (Supabase REST/Auth/Realtime, avatar/CDN vb.) HİÇ
  // önbelleğe alma. Aşağıdaki cache-first strateji buraya da uygulanıyordu —
  // aynı sorgu URL'si (ör. group_members select?group_id=eq.X) ilk yüklemede
  // önbelleğe yazılıp bir daha ASLA güncellenmiyordu (bu cache'in süresi/
  // geçersiz kılma mantığı yok). Sonuç: şube ataması gibi gerçek DB
  // güncellemeleri veritabanında doğru şekilde kalıcı oluyordu ama sayfa
  // yenilenince tarayıcı hep İLK YÜKLEMEDEKİ bayat API yanıtını görüyordu —
  // hem "şube ataması sayfa yenilenince gidiyor" hem de grup/panel restore
  // akışının bayat veriyle çalışıp Arena'ya düşmesi buradan kaynaklanıyordu
  // (2026-07-14). Cross-origin isteklerde respondWith çağırmayıp tarayıcının
  // normal ağ isteğini yapmasına izin veriyoruz.
  if (url.startsWith(self.location.origin)) {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request))
    );
  }
});
// 4.3 — Push Notification handler
self.addEventListener('push', e => {
  let data = { title: 'FocusAI', body: 'Yeni bildirim', icon: './icon-192.png', tag: 'focusai' };
  try { if (e.data) data = { ...data, ...e.data.json() }; } catch(_) {}
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body, icon: data.icon || './icon-192.png',
      badge: './icon-192.png', tag: data.tag || 'focusai',
      data: { url: data.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/';
  e.waitUntil(clients.matchAll({ type:'window' }).then(list => {
    const w = list.find(c => c.url === url && 'focus' in c);
    return w ? w.focus() : clients.openWindow(url);
  }));
});
