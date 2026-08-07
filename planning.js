/* ════════════════════════════════════════════
   FocusAI — Planlama Modülü  (Faz 1 + 2 + 3)
   ════════════════════════════════════════════ */
// Faz G: planning-lesson-plan-modal.js sıralı-yükleme zincirinde planning.js'ten
// ÖNCE yüklendiği için (bkz. inline-module-loader.js), bu yöndeki statik import
// GÜVENLİ (üretici → tüketici sırası korunuyor).
import {
    openModeSelect, closeModeSelect, openLessonPlanModal, closeLessonPlanModal,
    _lpBindExistingListEvents, _lpShowTemplateStep, _lpShowFormStep, _lpShowChoiceStep,
    _lpShowTemplatesListStep, _lpShowInstancesListStep, _lpSaveTemplate, _lpSetTarget,
    _lpLoadStudents, _lpSave, _lpRenderStudentPicker
} from './planning-lesson-plan-modal.js';
// planning-plan-header.js de aynı zincirde planning.js'ten ÖNCE yüklenir.
import './planning-plan-header.js';
import { _pvUpdateActivityFeed } from './planning-ghost-toast.js';
import { loadDependencies, saveDependencies, addDependency, removeDependency } from './planning-dependency-graph.js';
import { _checkDeadlineNotifications, _subscribeRealtime } from './planning-realtime.js';
import { deadlineLabel, fmtDate, fmtShort, getCat, msUid, progressRing } from './planning-utils.js';
// planning-wizard.js de aynı zincirde planning.js'ten ÖNCE yüklenir.
import { _pvWizAssignDate, _pvBroadcastWizState } from './planning-wizard.js';
// planning-lesson-plan-conflicts.js de aynı zincirde planning.js'ten ÖNCE
// yüklenir (Faz O, ilk dilim — bkz. o dosyanın üst yorumu).
import {
    _lpaTimeToMin, _lpaOverlap, _lpaFindConflicts, _lpaShowSimpleConflictWarning,
    _pvConflictHourKeys, _pvRecomputeUnresolvedConflicts, _pvHasUnresolvedConflicts,
    _pvIsDateLocked, _pvConflictHourSetFor, _pvShowUnresolvedConflictModal,
    _pvUpdateConflictBanner, _pvShowUnsavedModal
} from './planning-lesson-plan-conflicts.js';
// planning-lesson-plan-busy-slots.js de aynı zincirde planning.js'ten ÖNCE
// yüklenir (Faz O, ikinci dilim — bkz. o dosyanın üst yorumu).
import {
    _pvBusyTargetStudentId, _pvGroupMembers, _pvLoadBusySlots, _pvIsBusyHour,
    _pvIsBusyDay, _pvBusyToggleBtn, _pvBindBusyToggle, _pvBusyConflict,
    _pvShowConflictModal, _pvResetBusyState, _pvGetCachedGroupMemberName,
    _pvGetSuppressBusyWarning
} from './planning-lesson-plan-busy-slots.js';
// planning-plan-view-time-utils.js de aynı zincirde planning.js'ten ÖNCE
// yüklenir (Faz O, üçüncü dilim — bkz. o dosyanın üst yorumu).
import {
    _dstrLocal, _pvFmtHM, _pvFmtDuration, _pvTimeToMin, _pvMinToTime,
    _pvAddHour, _pvIsMirrorMs, _pvMsIcon, _pvGetMsIndex, _pvWeekTotalMins,
    _pvFindFreeSlot
} from './planning-plan-view-time-utils.js';
// planning-plan-view-dom-fx.js de aynı zincirde planning.js'ten ÖNCE
// yüklenir (Faz O, dördüncü dilim — bkz. o dosyanın üst yorumu).
import {
    _pvUpdateOverallProgress, _pvCelebrate, showMsForm, hideMsForm,
    _pvGoalTasksOn, _pvHighlightTaskInList, _pvAutoFillTime,
    _pvRenderCenter, _pvRenderTeam
} from './planning-plan-view-dom-fx.js';
// planning-goal-sync-cleanup.js de aynı zincirde planning.js'ten ÖNCE yüklenir
// (Faz O, beşinci dilim — bkz. o dosyanın üst yorumu).
import { _setSyncBadge, _purgeGoalTasks, _notifyCollabMembersGoalDeleted } from './planning-goal-sync-cleanup.js';
// planning-goal-detail-render.js de aynı zincirde planning.js'ten ÖNCE
// yüklenir (Faz O, altıncı dilim — bkz. o dosyanın üst yorumu).
import { _recalcProgress, refreshDetailSummary, _initDetailProgress } from './planning-goal-detail-render.js';
// planning-main-cal-render.js de aynı zincirde planning.js'ten ÖNCE yüklenir.
import { _pvComputeMainCalData, _pvBuildMainCalCellsHtml } from './planning-main-cal-render.js';
import { _pvCalSwitchInline, _pvBindCalSwitch, _pvHourGridHead, _pvTimeToMinLocal, _pvTaskChip, _pvRenderTaskChips } from './planning-hourgrid-render.js';
import { _pvBuildDayPanelMarkup } from './planning-day-panel-markup.js';
import { _pvRenderPlanSummary } from './planning-plan-summary-render.js';
import { _pvApplyTaskChipStyles, _pvMirrorTaskToMilestone, _pvBackfillMirrors, _pvUnmirrorTask } from './planning-lesson-plan-mirror.js';
import { getCurrentUser } from './state/current-user-store.js';
// planning-collab-handlers.js de aynı zincirde planning.js'ten ÖNCE yüklenir
// (Faz H devamı — bkz. o dosyanın üst yorumu).
import { _pvBuildCollabHandlers } from './planning-collab-handlers.js';
import { openPlanView } from './planning-open-plan-view.js';
// planning-milestone-list-render.js de aynı zincirde planning.js'ten ÖNCE
// yüklenir (Faz Q — bkz. o dosyanın üst yorumu).
export { renderMilestoneList } from './planning-milestone-list-render.js';
import { renderMilestoneList } from './planning-milestone-list-render.js';
// planning-week-day-cal-render.js de aynı zincirde planning.js'ten ÖNCE yüklenir.
import { _pvSelectDay, _pvRenderWeekCal, _pvRenderDayCal } from './planning-week-day-cal-render.js';
// esc/toast → planning-toast-esc.js dosyasına taşındı (Faz H2); window.esc/window.toast
// köprüsü aracılığıyla yukarıdaki wrapper export'lar (satır ~2576) hâlâ çalışıyor.
// planning-init-setup.js de aynı zincirde planning.js'ten ÖNCE yüklenir (Faz J
// devamı — init()'in 4 _pgSetupX() yardımcısı buraya taşındı, bkz. o dosyanın
// üst yorumu).
import {
    _pgSetupFilterControls, _pgSetupGoalCreationModals,
    _pgSetupDetailAndMilestonePanel, _pgSetupEscAndFinalBindings
} from './planning-init-setup.js';
// planning-goal-load-sync.js / planning-quick-create-collab.js /
// planning-lesson-plan-route.js de aynı zincirde planning.js'ten ÖNCE
// yüklenir (Faz H "son duvar" turu — bkz. o dosyaların üst yorumu).
import { loadGoals, loadGoalsFromServer, _syncDirty } from './planning-goal-load-sync.js';
import { _qcStartCollab, _convertGoalToSolo } from './planning-quick-create-collab.js';
import { _lpaRouteToConflictEdit, _pvJumpToWeekAtTask } from './planning-lesson-plan-route.js';
// planning-detail-panel.js / planning-collab-invite-delete.js / planning-plan-view-exit.js /
// planning-day-panel-events.js / planning-pv-main-cal.js de aynı zincirde planning.js'ten
// ÖNCE yüklenir (Faz devamı, dev fonksiyon refactoru — bkz. o dosyaların üst yorumu).
import { openDetailPanel, closeDetailPanel, refreshDetailPanel } from './planning-detail-panel.js';
import {
    _acceptLessonPlanInvite, _showCollabDeleteModal, _deleteGoalWithUndo,
    _deleteMilestoneWithUndo, _pvDiscardUnacceptedGoal,
} from './planning-collab-invite-delete.js';
import { _pvHandleExitClick } from './planning-plan-view-exit.js';
import { _pvRenderDayPanel, _pvBindDayTaskActionEvents, _pvBindDayAddTaskForm } from './planning-day-panel-events.js';
import { _pvRenderMainCal } from './planning-pv-main-cal.js';
import './planning-pv-render.js';
// planning-goal-collab-bridge.js de aynı zincirde planning.js'ten ÖNCE yüklenir
// (Faz devamı — bkz. o dosyanın üst yorumu). window.persistGoals/uid/
// _pvIsLessonPlan köprüleri orada kuruluyor; aşağıdaki export sarmalayıcılar
// (satır ~779) window.* üzerinden bunlara erişiyor.
import './planning-goal-collab-bridge.js';
import { getPgRenderCount, incPgRenderCount } from './state/pg-render-count-store.js';
import { getPgDependencies, setPgDependencies } from './state/pg-dependencies-store.js';
import { getPgActiveFilters, setPgActiveFilters } from './state/pg-active-filters-store.js';
import { getEditingId, setEditingId } from './state/pg-editing-id-store.js';
import { getPgDetailGoalId, setPgDetailGoalId } from './state/pg-detail-goal-id-store.js';
import { getPgGoalsArr, setPgGoalsArr } from './state/pg-goals-store.js';
import { getPvGoalId, setPvGoalId } from './state/pv-goal-id-store.js';
import { getPvActiveMsId, setPvActiveMsId } from './state/pv-active-ms-id-store.js';
import { getPvSeqMode, setPvSeqMode } from './state/pv-seq-mode-store.js';
import { getPvReadOnly, setPvReadOnly, getPvReadOnlyTempId, setPvReadOnlyTempId, setPvReadOnlyPreview } from './state/pv-read-only-store.js';
import { getPvReadOnlyShowOwnTasks, setPvReadOnlyShowOwnTasks } from './state/pv-read-only-show-own-tasks-store.js';
import { getPvCalYear, setPvCalYear } from './state/pv-cal-year-store.js';
import { getPvCalMonth, setPvCalMonth } from './state/pv-cal-month-store.js';
import { getPvCalView, setPvCalView } from './state/pv-cal-view-store.js';
import { getPvWeekCursor, setPvWeekCursor } from './state/pv-week-cursor-store.js';
import { getPvDayCursor, setPvDayCursor } from './state/pv-day-cursor-store.js';
import { getPvUnsaved, setPvUnsaved } from './state/pv-unsaved-store.js';
import './state/pv-wiz-store.js';
import { getPvSelectedDate, setPvSelectedDate } from './state/pv-selected-date-store.js';
(function () {
    'use strict';

    // ── State ─────────────────────────────────
    const _pgLoadedAt = Date.now();
    window.__getPgLoadedAtRef = () => _pgLoadedAt;
    // _pgRenderCount/goals/dependencies/activeFilters/editingId/detailGoalId artık
    // ilgili state/pg-*-store.js dosyalarında tanımlı; window.* köprüleri de
    // orada kuruluyor.
    const CATEGORY_KEYS = ['egitim','saglik','kariyer','finans','kisisel','diger'];

    // Wizard state (wizardState/_wzCalYear/_wzCalMonth) planning-milestone-wizard.js'e
    // taşındı (Faz 2, 2026-07-20) — planning.js'in başka hiçbir yerinde kullanılmıyordu.

    // ── Storage ───────────────────────────────
    // loadGoals/loadGoalsFromServer → planning-goal-load-sync.js'e taşındı
    // (Faz H "son duvar" turu).

    // Bekleyen ders planı davetleri artık Planlama sayfasında genel bir kutu olarak
    // gösterilmiyor — sadece ilgili sınıfın Sınıf Paneli > Ders Planı sekmesinde
    // (bkz. renderStudentLessonPlanInvitesForGroup) ve bildirim tıklamasında görünür.
    // Kabul/revize/red fonksiyonları ve kart markup'ı (_lpaInviteCardHTML,
    // _bindLpaInviteCard, renderStudentLessonPlanInvitesForGroup,
    // _toggleLessonPlanPreview, _promptLessonPlanNote, _lpaDiscardDraft,
    // _requestLessonPlanRevision, _rejectLessonPlanInvite) planning-lesson-plan-invites.js
    // dosyasına taşındı (Faz 2, 2026-07-20) — window.* köprüsüyle erişilebilirler.
    // _acceptLessonPlanInvite ise PlanView çakışma çözümü sistemine çok bağımlı
    // olduğu için burada kaldı (bkz. window._acceptLessonPlanInvite köprüsü, aşağıda).

    // ── Kabul: saatli aşamaları klonlar, kendi mevcut görevleriyle çakışma
    // varsa önce çözüm ekranı açar (öğrenci kendi görevini VEYA öğretmenin
    // planındaki görevi taşıyabilir — öğretmenin planındaki görevler
    // silinemez, günü değiştirilemez, sadece o gün içindeki saati değişir).
    // Çakışma yoksa/çözülünce: yeni hedef + aşamalar kaydedilir VE saatli
    // aşamalar aynı zamanda `tasks`'a da yazılır ki Bugün/Takvim'de görünsün.
    // _lpaTimeToMin/_lpaOverlap/_lpaFindConflicts/_lpaShowSimpleConflictWarning/
    // _pvConflictHourKeys → planning-lesson-plan-conflicts.js'e taşındı (Faz O).

    // _lpaRouteToConflictEdit/_pvJumpToMonth/_pvJumpToWeekAtTask →
    // planning-lesson-plan-route.js'e taşındı (Faz H "son duvar" turu).

    // _pvUpdateConflictBanner/_pvRecomputeUnresolvedConflicts/
    // _pvHasUnresolvedConflicts/_pvIsDateLocked/_pvConflictHourSetFor/
    // _pvShowUnresolvedConflictModal → planning-lesson-plan-conflicts.js'e
    // taşındı (Faz O). window.* köprüleri de o dosyada (planning-plan-header.js
    // hâlâ window.* üzerinden çağırıyor).

    // "Kaydet"/"Çık" ile "Kabul Et" farklı şeyler: taslağı yerelde oluşturup saat
    // gridinde düzenlemek (materialize) planı KABUL ETMEZ — lesson_plan_assignments.status
    // sadece acceptForReal() ile, yani gerçekten "Kabul Et" akışı tamamlandığında değişir.
    // _acceptLessonPlanInvite → planning-collab-invite-delete.js'e taşındı
    // (Faz devamı, dev fonksiyon refactoru).

    // persistGoals → planning-goal-collab-bridge.js'e taşındı (Faz devamı).
    // Salt-okunur köprü — planning-quick-create.js gibi ayrılan modüllerin
    // goals dizisini (referans olarak — unshift/find gibi mutasyon
    // metodları çalışır) taşımadan kullanabilmesi için.
    window._pgGetGoals = () => getPgGoalsArr();
    // goals dizisi yeni bir referansla DEĞİŞTİRİLDİĞİNDE (filter/reassign,
    // splice/unshift referansı korur ve zaten _pgGetGoals ile çalışır) bunu
    // geri yazmak için — planning-lesson-plan-invites.js gibi ayrılmış
    // modüllerin `goals = goals.filter(...)` desenini kullanabilmesi için.
    window._pgSetGoals = (arr) => { setPgGoalsArr(arr); };

    // _setSyncBadge → planning-goal-sync-cleanup.js'e taşındı (Faz O).

    // _syncDirty → planning-goal-load-sync.js'e taşındı (Faz H "son duvar" turu).

    // ── Helpers ───────────────────────────────
    // uid → planning-goal-collab-bridge.js'e taşındı (Faz devamı).
    // msUid → planning-utils.js dosyasına taşındı.
    // Tek kaynak: script.js'teki window.escapeHtml. planning.js önce bu dosya
    // yüklendikten sonra çalıştığı için normalde her zaman mevcuttur; olası bir
    // yükleme sırası değişikliğine karşı aynı mantığı yerel fallback olarak tutuyoruz.
    // esc → planning-toast-esc.js dosyasına taşındı (Faz H2).
    // getCat → planning-utils.js dosyasına taşındı.

    // deadlineLabel/fmtDate/fmtShort/progressRing → planning-utils.js
    // dosyasına taşındı (Faz 2, 2026-07-19).

    // _recalcProgress → planning-goal-detail-render.js'e taşındı (Faz O).

    // ── Goal CRUD ─────────────────────────────
    // addGoal/updateGoal/deleteGoal/toggleArchive/updateGoalProgress →
    // planning-goal-crud.js'e taşındı (Faz devamı). window.addGoal/updateGoal/
    // _pgDeleteGoal/toggleArchive/updateGoalProgress köprüleri orada kuruluyor
    // (planning.js'ten ÖNCE yüklenir, bkz. inline-module-loader.js).
    // NOT: window.deleteGoal ismi script-goal-modal.js'te farklı bir "goal"
    // kavramı için zaten kullanıldığından, planlama hedefi silme fonksiyonu
    // çakışmayı önlemek için window._pgDeleteGoal olarak köprülenir.

    // _purgeGoalTasks → planning-goal-sync-cleanup.js'e taşındı (Faz O).

    // addMilestone/addSubtask/toggleSubtask/deleteSubtask/_deleteSubtaskWithUndo/
    // toggleMilestone/deleteMilestone/milestoneToTask → planning-milestone-crud.js'e
    // taşındı (Faz devamı). window.addMilestone/addSubtask/toggleSubtask/
    // toggleMilestone/milestoneToTask köprüleri orada kuruluyor (planning.js'ten
    // ÖNCE yüklenir, bkz. inline-module-loader.js). deleteSubtask/deleteMilestone
    // sadece o dosya içinde kullanıldığı için köprülenmedi.



    // ── DETAIL PANEL ─────────────────────────
    // openDetailPanel/closeDetailPanel/refreshDetailPanel → planning-detail-panel.js'e
    // taşındı (Faz devamı, dev fonksiyon refactoru).

    // refreshDetailSummary/_initDetailProgress → planning-goal-detail-render.js'e
    // taşındı (Faz O).

    // renderMilestoneList/_bindMilestoneDragSort/_bindMilestoneEvents →
    // planning-milestone-list-render.js'e taşındı (Faz Q).

    // showMsForm/hideMsForm → planning-plan-view-dom-fx.js'e taşındı (Faz O).

    // saveMsForm → planning-lesson-plan-route.js'e taşındı (Faz H "son duvar" turu).

    // ══════════════════════════════════════════
    // HIZLI HEDEF OLUŞTUR — planning-quick-create.js dosyasına taşındı
    // (Faz 2, 2026-07-19). window._pgGetGoals() üzerinden goals dizisine
    // erişiyor; openQuickCreate/closeQuickCreate/_qcRender/_qcSave artık
    // window.* üzerinden çağrılıyor.
    // ══════════════════════════════════════════

    // _qcStartCollab → planning-quick-create-collab.js'e taşındı (Faz H "son duvar" turu).

    // Collab Wait Overlay state (_collabWaitPollTimer/_collabWaitGoal/
    // _collabInviteStatus/_cwFriendCache) → planning-collab-wait.js
    // dosyasına taşındı.

    // ── Goal Modal ────────────────────────────
    // openGoalModal/closeGoalModal/handleGoalSubmit → planning-goal-crud.js'e
    // taşındı (Faz devamı).

    // ── Collab bridge fonksiyonları ───────────
    // _updateGoalCollabState/_applyInviteJoin → planning-goal-collab-bridge.js'e
    // taşındı (Faz devamı).

    // ── Toast ─────────────────────────────────
    // toast → planning-toast-esc.js dosyasına taşındı (Faz H2).

    // Collab hedef silindiğinde diğer üyelere bildirim gönder
    // _notifyCollabMembersGoalDeleted → planning-goal-sync-cleanup.js'e taşındı (Faz O).

    // _convertGoalToSolo → planning-quick-create-collab.js'e taşındı (Faz H "son duvar" turu).

    // _showCollabDeleteModal/_deleteGoalWithUndo/_deleteMilestoneWithUndo →
    // planning-collab-invite-delete.js'e taşındı (Faz devamı, dev fonksiyon refactoru).

    // ── Init ──────────────────────────────────
    // init() → planning-pv-lifecycle.js'e taşındı (Faz devamı, dev fonksiyon
    // refactoru — goals bridge zaten mevcuttu). window.initPlanningModule
    // köprüsü de o dosyada kuruluyor.

    // _pgSetupFilterControls/_pgSetupGoalCreationModals/_pgSetupDetailAndMilestonePanel/
    // _pgSetupEscAndFinalBindings → planning-init-setup.js'e taşındı (Faz J devamı).



    // ══════════════════════════════════════════
    // BİRLEŞİK PLAN GÖRÜNÜMÜ — Faz 3
    // ══════════════════════════════════════════

    // pvGoalId/pvActiveMsId/pvSeqMode/pvReadOnly/pvReadOnlyTempId/
    // pvReadOnlyShowOwnTasks/pvCalYear/pvCalMonth/pvCalView/pvWeekCursor/
    // pvDayCursor/pvUnsaved artık ilgili state/pv-*-store.js dosyalarında
    // tanımlı; window.* köprüleri de orada kuruluyor.
    // _pvIsLessonPlan → planning-goal-collab-bridge.js'e taşındı (Faz devamı).

    // Dolu-saat (meşguliyet) state'i ve fonksiyonları (_pvBusyTargetStudentId/
    // _pvGroupMembers/_pvLoadBusySlots/_pvIsBusyHour/_pvIsBusyDay/
    // _pvBusyToggleBtn/_pvBindBusyToggle/_pvBusyConflict/_pvShowConflictModal)
    // → planning-lesson-plan-busy-slots.js'e taşındı (Faz O).

    // Ders planında "Kaydet" butonuna basınca: dirty senkronu zorla + görsel geri bildirim
    // _pvExplicitSave → planning-pv-lifecycle.js'e taşındı (Faz devamı, dev
    // fonksiyon refactoru). window._pvExplicitSave köprüsü de o dosyada kuruluyor.

    // Kapat / Tüm Hedefler'e basıldığında kaydedilmemiş değişiklik varsa gösterilen onay modalı
    // _pvShowUnsavedModal → planning-lesson-plan-conflicts.js'e taşındı (Faz O).

    // _pvDiscardUnacceptedGoal → planning-collab-invite-delete.js'e taşındı,
    // _pvHandleExitClick → planning-plan-view-exit.js'e taşındı (Faz devamı,
    // dev fonksiyon refactoru).

    // ── Milestone Wizard State ────────────────
    // pvWiz artık state/pv-wiz-store.js'te tanımlı; window.* köprüsü orada kuruluyor.

    const PV_MOTIVATION = {
        egitim:  ['Her uzman bir zamanlar acemiydi.', 'Öğrenmek zihnin en büyük macerasıdır.', 'Bilgi, taşıması en hafif yüktür.'],
        saglik:  ['Vücudunuz en büyük yatırımınızdır.', 'Her adım daha güçlü bir versiyona doğru.', 'Sağlık servetten üstündür.'],
        kariyer: ['Kariyer bir maraton, sprint değil.', 'Başarı küçük çabaların birikmesidir.', 'Her büyük kariyer bir küçük adımla başlar.'],
        finans:  ['Finansal özgürlük bir yolculuktur.', 'Bugünkü disiplin yarının özgürlüğüdür.', 'Servet, tutarlı kararların ürünüdür.'],
        kisisel: ['En önemli proje kendinizsiniz.', 'Büyüme konfor alanınızın dışında başlar.', 'Her gün daha iyi bir versiyon mümkün.'],
        diger:   ['Büyük hedefler cesur kalplerle başlar.', 'Planlamak başarının yarısıdır.', 'Her harika sonuç net bir niyetle başlar.'],
    };
    window.PV_MOTIVATION = PV_MOTIVATION; // planning-wizard.js için (önceki bir çıkarmada gözden kaçmış bare referans)

    // openPlanView → planning-open-plan-view.js dosyasına taşındı (Faz J devamı).

    // _pvBuildCollabHandlers → planning-collab-handlers.js dosyasına taşındı (Faz H
    // devamı, dev fonksiyon refactoru) — module-seviye pvGoalId/goals/pvWiz/
    // pvSelectedDate'e window.__get/__set köprüleri üzerinden erişiyor.

    // ── Öneri 3: Ghost Toast bildirimi → planning-ghost-toast.js dosyasına taşındı ──

    // closePlanView → planning-pv-lifecycle.js'e taşındı (Faz devamı, dev
    // fonksiyon refactoru). window.closePlanView köprüsü de o dosyada kuruluyor.

    // pvSelectedDate artık state/pv-selected-date-store.js'te tanımlı; window.*
    // köprüsü orada kuruluyor.

    // _pvRender → planning-pv-render.js'e taşındı (Faz H devamı).

    // PLANVIEW: HEADER / STEPPER → planning-plan-header.js dosyasına taşındı (Faz 6)


    // MİLESTONE WİZARD (PlanView içi) → planning-wizard.js dosyasına taşındı (Faz 6)

    // ── Center: Ana Takvim ───────────────────
    // Ders planı — Aylık/Haftalık/Günlük görünüm anahtarı — "Bugün" butonuyla aynı sırada, aynı stilde
    // _pvCalSwitchInline/_pvBindCalSwitch → planning-hourgrid-render.js'e taşındı (Faz O devamı).

    // Genel takvim/gündelik görünümden (plan-view dışından) silinen bir görev, bir
    // ders planının aynalanmış (mirrored) milestone'una karşılık geliyorsa, o milestone
    // da temizlenmezse plan tekrar açıldığında/yeniden atandığında "hayalet görev" olarak
    // geri gelebiliyordu. script.js:deleteGlobalTask bu fonksiyonu çağırarak senkronize eder.
    // PlanningUnmirrorTaskGlobal → planning-goal-collab-bridge.js'e taşındı
    // (Faz devamı).

    // Haftalık/Günlük gridde görev sürükleme — hedef hücreye bırakınca
    // görevin tarihini/saatini (süresi korunarak) günceller. planning-week-day-cal-render.js'teki
    // _pvBindHourGridDrag buraya window.* köprüsüyle çağrı yapıyor.
    // Bir görevi bırakılan hücreye taşır. O hücrede zaten (kendisi hariç) tek bir
    // görev varsa, üst üste binmek yerine ikisinin yeri/saati DEĞİŞ TOKUŞ edilir.
    // _pvMoveTaskToSlot → planning-week-day-cal-render.js dosyasına taşındı
    // (window._pvMoveTaskToSlot köprüsü de o dosyada).

    // _pvSelectDay/_pvBindHourGridDrag/_pvBindHourGridNav/_pvRenderWeekCal/_pvRenderDayCal
    // → planning-week-day-cal-render.js'e taşındı.

    // _pvRenderMainCal → planning-pv-main-cal.js'e taşındı (Faz devamı, dev
    // fonksiyon refactoru).

    // _pvWeekTotalMins/_pvFmtDuration → planning-plan-view-time-utils.js'e taşındı
    // (Faz O). window.* köprüleri de o dosyada.

    // _pvPlanFinish SİLİNDİ (Faz devamı) — proje genelinde hiçbir yerde
    // çağrılmıyordu (grep ile doğrulandı), tamamen ölü kod.

    // ── Right: Gün Detayı ────────────────────
    // _pvRenderDayPanel/_pvBindDayTaskActionEvents/_pvBindDayAddTaskForm →
    // planning-day-panel-events.js'e taşındı (Faz devamı, dev fonksiyon refactoru).

    // ── Yardımcı: Boş 1 saatlik slot bul ───────
    // _pvFindFreeSlot/_pvTimeToMin/_pvMinToTime/_pvAddHour →
    // planning-plan-view-time-utils.js'e taşındı (Faz O). window._pvAddHour
    // köprüsü de o dosyada.
    // _pvAutoFillTime/_pvRenderCenter/_pvRenderTeam/_pvUpdateOverallProgress/
    // _pvCelebrate → planning-plan-view-dom-fx.js'e taşındı (Faz O).

    // _pvTimeAgo SİLİNDİ (Faz O) — proje genelinde hiçbir yerde çağrılmıyordu
    // (grep ile doğrulandı), tamamen ölü kod.

    // ── Quick-add MS in plan view → planning-quick-add-ms.js dosyasına
    // taşındı (Faz devamı). window._pvBindQuickAddMs/window._pvSaveQuickMs
    // köprüsü aracılığıyla erişiliyor.

    // ── Init bindings ─────────────────────────
    // _pvInitBindings → planning-pv-lifecycle.js'e taşındı (Faz devamı, dev
    // fonksiyon refactoru). window._pvInitBindings köprüsü de o dosyada kuruluyor.

    // ── Public API ────────────────────────────
    window.openPlanView = openPlanView;

    // ── Public ────────────────────────────────
    // renderTodaySprintWidget → planning-goal-collab-bridge.js'e taşındı
    // (Faz devamı).

    window.renderPlanningRef   = ()=>{ window.render(); };
    // addPlanningDependency/removePlanningDependency/getPlanningDependencies/
    // isPlanningGoalBlocked artık planning-dependency-graph.js'te tanımlanıyor.
    // window.initPlanningModule köprüsü artık planning-pv-lifecycle.js'de kuruluyor.
    window.renderPlanningStats = (...args) => window.renderStatsCard(...args);
    // openLessonPlanModal artık planning-lesson-plan-modal.js'te tanımlanıyor
    // (sınıf paneli/social.js gibi dış yerlerden openLessonPlanModal ile açılır).
    // social.js'in collab_goal_deleted bildiriminde çağırdığı API
    window._convertGoalToSoloById = _convertGoalToSolo;
    window._deleteGoalSilently    = deleteGoal;

    // F1.1 — Görev tamamlama → milestone durumu güncelle (script.js çağırır)
    // setPlanningMilestoneDone → planning-goal-collab-bridge.js'e taşındı
    // (Faz devamı).

    // F1.2 — Takvim milestone event'i tıklanınca planning modülünü güncelle
    // togglePlanningMilestoneFromCalendar → planning-goal-collab-bridge.js'e
    // taşındı (Faz devamı).

    if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', () => window.initPlanningModule());
    else window.initPlanningModule();
})();

// ── Faz G: planning-*.js tüketicileri için ince export sarmalayıcılar ──
// (Yukarıdaki IIFE içindeki fonksiyonlara doğrudan erişilemediği için
//  window köprüsü üzerinden ince sarmalayıcılar dışa aktarılıyor.
//  Mevcut window.fn = fn; atamaları SİLİNMEDİ, geriye dönük uyumluluk korunuyor.)
export function getPgGoals(...args) { return window._pgGetGoals(...args); }
export function setPgGoals(...args) { return window._pgSetGoals(...args); }
export { getPgActiveFilters };
export function qcStartCollab(...args) { return window._qcStartCollab(...args); }
export { openPlanView };
export { openDetailPanel, closeDetailPanel, refreshDetailPanel };
export { _pvRenderDayPanel, _pvBindDayTaskActionEvents, _pvBindDayAddTaskForm };
export { _pvRenderMainCal };
export { _acceptLessonPlanInvite, _showCollabDeleteModal, _deleteGoalWithUndo, _deleteMilestoneWithUndo, _pvDiscardUnacceptedGoal };
export { _pvHandleExitClick };
export function persistGoals(...args) { return window.persistGoals(...args); }
export function toast(...args) { return window.toast(...args); }
export function esc(...args) { return window.esc(...args); }
export function uid(...args) { return window.uid(...args); }
export function acceptLessonPlanInvite(...args) { return window._acceptLessonPlanInvite(...args); }
export { setPvReadOnlyPreview };
export function pvAddHour(...args) { return window._pvAddHour(...args); }
export function deleteGoalWithUndo(...args) { return window._deleteGoalWithUndo(...args); }
export function toggleArchive(...args) { return window.toggleArchive(...args); }
export function getPgLoadedAtRef(...args) { return window.__getPgLoadedAtRef(...args); }
export function getPgRenderCountRef(...args) { return window.__getPgRenderCountRef(...args); }
export function incPgRenderCountRef(...args) { return window.__incPgRenderCountRef(...args); }

// planning.js'nin geri kalan window.* köprülerini de dışa açan evrensel
// shim'ler (Faz P/Q mimari turu, bkz. social.js'teki aynı desen).
export function PV_MOTIVATION(...args) { const v = window.PV_MOTIVATION; return (typeof v === "function") ? v(...args) : v; }
export function PlanningUnmirrorTaskGlobal(...args) { const v = window.PlanningUnmirrorTaskGlobal; return (typeof v === "function") ? v(...args) : v; }
export function __getPvActiveMsId(...args) { const v = window.__getPvActiveMsId; return (typeof v === "function") ? v(...args) : v; }
export function __getPvCalMonth(...args) { const v = window.__getPvCalMonth; return (typeof v === "function") ? v(...args) : v; }
export function __getPvCalYear(...args) { const v = window.__getPvCalYear; return (typeof v === "function") ? v(...args) : v; }
export function __getPvGoalId(...args) { const v = window.__getPvGoalId; return (typeof v === "function") ? v(...args) : v; }
export function __getPvReadOnly(...args) { const v = window.__getPvReadOnly; return (typeof v === "function") ? v(...args) : v; }
export function __getPvReadOnlyShowOwnTasks(...args) { const v = window.__getPvReadOnlyShowOwnTasks; return (typeof v === "function") ? v(...args) : v; }
export function __getPvSelectedDate(...args) { const v = window.__getPvSelectedDate; return (typeof v === "function") ? v(...args) : v; }
export function __getPvSeqMode(...args) { const v = window.__getPvSeqMode; return (typeof v === "function") ? v(...args) : v; }
export function __getPvWiz(...args) { const v = window.__getPvWiz; return (typeof v === "function") ? v(...args) : v; }
export function __setPvActiveMsId(...args) { const v = window.__setPvActiveMsId; return (typeof v === "function") ? v(...args) : v; }
export function __setPvCalMonth(...args) { const v = window.__setPvCalMonth; return (typeof v === "function") ? v(...args) : v; }
export function __setPvCalYear(...args) { const v = window.__setPvCalYear; return (typeof v === "function") ? v(...args) : v; }
export function __setPvReadOnlyShowOwnTasks(...args) { const v = window.__setPvReadOnlyShowOwnTasks; return (typeof v === "function") ? v(...args) : v; }
export function __setPvSelectedDate(...args) { const v = window.__setPvSelectedDate; return (typeof v === "function") ? v(...args) : v; }
export function __setPvWiz(...args) { const v = window.__setPvWiz; return (typeof v === "function") ? v(...args) : v; }
export function _applyInviteJoin(...args) { const v = window._applyInviteJoin; return (typeof v === "function") ? v(...args) : v; }
export function _convertGoalToSoloById(...args) { const v = window._convertGoalToSoloById; return (typeof v === "function") ? v(...args) : v; }
export function _deleteGoalSilently(...args) { const v = window._deleteGoalSilently; return (typeof v === "function") ? v(...args) : v; }
export function _pgGetDependencies(...args) { const v = window._pgGetDependencies; return (typeof v === "function") ? v(...args) : v; }
export function _pgGetDetailGoalId(...args) { const v = window._pgGetDetailGoalId; return (typeof v === "function") ? v(...args) : v; }
export function _pgSetDependencies(...args) { const v = window._pgSetDependencies; return (typeof v === "function") ? v(...args) : v; }
export function _pvExplicitSave(...args) { const v = window._pvExplicitSave; return (typeof v === "function") ? v(...args) : v; }
export function _pvIsLessonPlan(...args) { const v = window._pvIsLessonPlan; return (typeof v === "function") ? v(...args) : v; }
export function _updateGoalCollabState(...args) { const v = window._updateGoalCollabState; return (typeof v === "function") ? v(...args) : v; }
export function closePlanView(...args) { const v = window.closePlanView; return (typeof v === "function") ? v(...args) : v; }
export function fn(...args) { const v = window.fn; return (typeof v === "function") ? v(...args) : v; }
export function initPlanningModule(...args) { const v = window.initPlanningModule; return (typeof v === "function") ? v(...args) : v; }
export function openGoalModal(...args) { const v = window.openGoalModal; return (typeof v === "function") ? v(...args) : v; }
export function renderPlanningRef(...args) { const v = window.renderPlanningRef; return (typeof v === "function") ? v(...args) : v; }
export function renderPlanningStats(...args) { const v = window.renderPlanningStats; return (typeof v === "function") ? v(...args) : v; }
export function renderTodaySprintWidget(...args) { const v = window.renderTodaySprintWidget; return (typeof v === "function") ? v(...args) : v; }
export function setPlanningMilestoneDone(...args) { const v = window.setPlanningMilestoneDone; return (typeof v === "function") ? v(...args) : v; }
export function togglePlanningMilestoneFromCalendar(...args) { const v = window.togglePlanningMilestoneFromCalendar; return (typeof v === "function") ? v(...args) : v; }
