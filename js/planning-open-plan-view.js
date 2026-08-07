// openPlanView → planning.js'ten taşındı (Faz J devamı). planning.js'ten ÖNCE
// yüklenir (bkz. inline-module-loader.js), bu yüzden window.* köprüleri
// tanımlanmadan önce çağrılabilir — sadece openPlanView'in kendisi çağrıldığında
// (init sonrası) bu köprüler zaten hazır olur.
import { _pvLoadBusySlots, _pvResetBusyState } from './planning-lesson-plan-busy-slots.js';
import { _pvBackfillMirrors } from './planning-lesson-plan-mirror.js';
import { _pvBuildCollabHandlers } from './planning-collab-handlers.js';

export function openPlanView(goalId) {
    const goals = window._pgGetGoals();
    const g = goals.find(x => x.id === goalId);
    if (!g) return;
    window.__setPvGoalId(goalId);
    window.__setPvSeqMode(false);
    window.__setPvCalYear(new Date().getFullYear());
    window.__setPvCalMonth(new Date().getMonth());
    window.__setPvSelectedDate(null);
    window.__setPvWiz(null);
    window.__setPvCalView('month');
    window.__setPvWeekCursor(null);
    window.__setPvDayCursor(null);
    _pvResetBusyState();
    localStorage.setItem('pg_pv_last_goal', goalId);
    // Görsel toggle kapalı olsa bile çakışma kontrolü için dolu saatleri arka planda önden yükle
    if (window._pvIsLessonPlan(g)) _pvLoadBusySlots(g);
    // Bu düzeltmeden ÖNCE takvimden saat saat eklenmiş ama hiç aynalanmamış (dolayısıyla
    // hiç senkronize olmamış) görevleri geriye dönük olarak aşamaya çevir — öğretmen planı
    // tekrar açtığında öğrenciye ulaşmayan eski içerik kendiliğinden düzelsin.
    // NOT: pvUnsaved bayrağı bu otomatik senkronizasyondan SONRA sıfırlanır, aksi halde
    // persistGoals() içindeki dirty-flag mantığı kullanıcı hiçbir şey yapmadan
    // "kaydedilmemiş değişiklik" uyarısını tetikliyordu.
    if (window._pvIsLessonPlan(g) && !window.__getPvReadOnly()) _pvBackfillMirrors(g);
    window.__setPvUnsaved(false);

    const firstIncomplete = (g.milestones || []).find(m => !m.done);
    window.__setPvActiveMsId(firstIncomplete?.id || g.milestones?.[0]?.id || null);

    document.getElementById('pg-plan-view')?.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    window._pvRender(g);

    // ── Collab: realtime kanalı başlat ──
    if (window.PlanningCollab && g.collab_room_id) {
        window.PlanningCollab.joinRoom(g.collab_room_id, g.id, g.my_role || 'owner');
        // Kendi task'larını odaya broadcast et — diğer kullanıcılar eksiklerini tamamlar
        setTimeout(() => {
            if (window.PlanningCollab?.channel) {
                const myTasks = FocusStorage.get('tasks', []).filter(t => String(t.parentGoal) === String(goalId));
                if (myTasks.length)
                    window.PlanningCollab.broadcast('sync_tasks', { goalId, tasks: myTasks });
            }
        }, 1200);
        window.PlanningCollab.setHandlers(_pvBuildCollabHandlers());
    }
}
