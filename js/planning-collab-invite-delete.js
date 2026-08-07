import { msUid } from './planning-utils.js';
import { _pvAddHour } from './planning-plan-view-time-utils.js';
import {
    _lpaFindConflicts, _lpaShowSimpleConflictWarning, _pvRecomputeUnresolvedConflicts,
} from './planning-lesson-plan-conflicts.js';
import { _lpaRouteToConflictEdit } from './planning-lesson-plan-route.js';
import { _normYMD } from './planning-wizard.js';
import { _recalcProgress } from './planning-goal-detail-render.js';
import { renderMilestoneList } from './planning-milestone-list-render.js';
import { _convertGoalToSolo } from './planning-quick-create-collab.js';
import { _notifyCollabMembersGoalDeleted } from './planning-goal-sync-cleanup.js';
import { saveDependencies } from './planning-dependency-graph.js';
import { getCurrentUser } from '../state/current-user-store.js';
import { toast } from './planning-toast-esc.js';

// planning.js dosyasından çıkarıldı (Faz devamı — dev fonksiyon refactoru).
// goals/pvUnsaved/pvGoalId gibi module-seviye state'e window.__get/__set ve
// window._pg* köprüleri üzerinden erişiyor (planning.js'te zaten mevcuttular).
// window._pgDeleteGoal/window._pgDeleteMilestone → planning-goal-crud.js/
// planning-milestone-crud.js'te tanımlı, zaten köprülü.

// "Kaydet"/"Çık" ile "Kabul Et" farklı şeyler: taslağı yerelde oluşturup saat
// gridinde düzenlemek (materialize) planı KABUL ETMEZ — lesson_plan_assignments.status
// sadece acceptForReal() ile, yani gerçekten "Kabul Et" akışı tamamlandığında değişir.
async function _acceptLessonPlanInvite(card) {
    const goals = window._pgGetGoals();
    const sb = window.FocusSupabase;
    const lpaId = card.dataset.lpaId, teacherGoalId = card.dataset.goalId;
    card.style.opacity = '.5'; card.style.pointerEvents = 'none';
    try {
        // Öğrenci daha önce "Düzenle" ile bu planı taslak olarak açıp saatleri
        // ayarlamış olabilir (pending_accept=true, henüz kabul edilmedi) — sıfırdan
        // klonlamak yerine o taslağı kullanırız, yoksa yaptığı düzenlemeler kaybolur.
        let draft = goals.find(x => x.lpa_id === lpaId && x.pending_accept);
        let tGoal = null, clonedMs = null, conflicts;

        if (!draft) {
            // bkz. _toggleLessonPlanPreview — aynı RLS kısıtı burada da geçerli, aynı RPC kullanılıyor.
            const { data: preview, error } = await sb.rpc('lesson_plan_preview', { p_goal_id: teacherGoalId });
            if (error || !preview) throw new Error('Plan bulunamadı');
            tGoal = preview;
            clonedMs = (preview.milestones || []).map(m => ({
                id: msUid(), title: m.title, due_date: m.due_date || '', start_date: m.start_date || '',
                start_time: m.start_time || '', end_time: m.end_time || '',
                is_task_mirror: !!m.is_task_mirror,
                done: false, order: m.order_index, description: m.description || '',
            }));
            // ÖNEMLİ: çakışma burada, henüz `tasks`'a hiçbir şey yazılmadan hesaplanmalı —
            // yoksa aşağıdaki materialize() aynı saatte kendi aynasıyla "çakışıyor" görünür.
            conflicts = _lpaFindConflicts(clonedMs);
        }

        // Taslağı (ya da mevcut taslağı) yerel bir hedefe dönüştürür; saatli aşamaları
        // SADECE ilk oluşturmada `tasks`'a aynalar (taslak zaten varsa görevlere
        // dokunulmaz ki öğrencinin önceki sürükle-bırak düzenlemeleri korunsun).
        // lesson_plan_assignments'a HİÇBİR ŞEY yazmaz — bu fonksiyon kabul değildir.
        const materialize = () => {
            if (draft) return draft.id;
            const newId = window.uid();
            goals.unshift({
                id: newId, title: tGoal.title, description: tGoal.description || '',
                category: tGoal.category, color: tGoal.color, deadline: tGoal.deadline || null,
                priority: tGoal.priority || 2, status: 'active', progress_pct: 0,
                milestones: clonedMs, lpa_id: lpaId, _dirty: true,
                // Öğretmenin ders planı ile aynı zengin saat-gridi/sürükle-bırak
                // arayüzünü kullansın diye (bkz. _pvIsLessonPlan) — ama `lpa_id`
                // dolu olduğundan öğretmene özel "Şablon"/"Öğrencilere Ata" aksiyonları
                // header'da gizlenir (bkz. _pvRenderHeader).
                plan_mode: 'lesson-plan',
                // Gerçekten "Kabul Et" ile onaylanana kadar true — bkz. acceptForReal.
                pending_accept: true,
            });
            draft = goals.find(x => x.id === newId);
            window.persistGoals();

            if (typeof window.addGlobalTask === 'function') {
                clonedMs.forEach(m => {
                    if (!m.due_date || !m.start_time) return;
                    const [y, mo, dd] = m.due_date.split('-');
                    window.addGlobalTask(m.title, tGoal.priority || 2, tGoal.category || '', `${dd}-${mo}-${y}`, m.start_time, m.end_time || _pvAddHour(m.start_time), '', newId);
                });
            }
            if (typeof window.syncTasksFromStorage === 'function') window.syncTasksFromStorage();
            if (typeof window.renderTasks === 'function') window.renderTasks();
            if (typeof window.renderCalendarGlobal === 'function') window.renderCalendarGlobal();
            window.render();
            return newId;
        };

        // Gerçek kabul — lesson_plan_assignments.status sadece burada 'accepted' olur.
        const acceptForReal = (goalId) => {
            const g = goals.find(x => x.id === goalId);
            if (g) { delete g.pending_accept; g._dirty = true; }
            window.persistGoals();
            sb.from('lesson_plan_assignments').update({ status: 'accepted', responded_at: new Date().toISOString(), student_note: null })
                .eq('id', lpaId).select('teacher_id').single().then(({ data: lpa }) => {
                    if (lpa?.teacher_id) {
                        sb.from('notifications').insert([{
                            user_id: lpa.teacher_id, type: 'lesson_plan_accepted',
                            payload: { fromName: getCurrentUser().displayName || getCurrentUser().username, goalId: teacherGoalId, groupCode: card.dataset.groupCode || null },
                        }]).then(() => {});
                    }
                });
            card.remove();
            if (!document.querySelectorAll('.pg-lpa-invite-card').length) document.getElementById('pg-lpa-invites')?.style.setProperty('display', 'none');
            toast('Plan kabul edildi, kendi hedeflerine eklendi 🎯');
        };

        const goalId = materialize();
        if (draft) {
            // Taslak zaten vardı — kalan çakışmaları güncel görev saatleriyle canlı hesapla.
            // _pvRecomputeUnresolvedConflicts task nesneleri döndürür (date/timeStart/timeEnd);
            // _lpaRouteToConflictEdit ise milestone şekli bekler (due_date/start_time/end_time) —
            // burada eşleştiriyoruz.
            const gLive = goals.find(x => x.id === goalId);
            conflicts = _pvRecomputeUnresolvedConflicts(gLive).map(c => ({
                ms: { due_date: _normYMD(c.lesson.date), start_time: c.lesson.timeStart, end_time: c.lesson.timeEnd },
                task: c.own,
            }));
        }

        if (conflicts.length) {
            card.style.opacity = ''; card.style.pointerEvents = '';
            _lpaShowSimpleConflictWarning(conflicts, {
                onLater: () => acceptForReal(goalId),
                onEdit: () => _lpaRouteToConflictEdit(goalId, conflicts),
            });
        } else {
            acceptForReal(goalId);
        }
    } catch (e) {
        card.style.opacity = ''; card.style.pointerEvents = '';
    }
}
// planning-lesson-plan-invites.js modülündeki _bindLpaInviteCard'ın
// "Kabul Et" butonuna bağlayabilmesi için köprü.
window._acceptLessonPlanInvite = _acceptLessonPlanInvite;

// Collab silme onay modalı (silen kişi için)
function _showCollabDeleteModal(g, depSnapshot) {
    document.getElementById('pg-collab-delete-modal')?.remove();
    const esc = window.escapeHtml || (s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'));
    const overlay = document.createElement('div');
    overlay.id = 'pg-collab-delete-modal';
    overlay.className = 'modal-overlay';
    overlay.style.zIndex = '100090';
    overlay.innerHTML = `
        <div class="modal-content glass-panel u-text-align-center-2" >
            <div class="modal-icon-wrapper warning">
                <i class="fa-solid fa-triangle-exclamation"></i>
            </div>
            <h2 class="u-margin-bottom-10px_color-hfff">Planı Kaldır</h2>
            <p class="u-color-var-text-muted_font-size-14px_line-height-1p6_margin">
                <strong class="u-color-rgba255255255p85">"${esc(g.title)}"</strong> başlıklı ortak planı kaldırmak üzeresiniz.
            </p>
            <p class="u-color-var-text-muted_font-size-13px_line-height-1p5_margin-2">
                Planı silmek yerine bireysel olarak sürdürerek tüm görev ve ilerlemenizi koruyabilirsiniz.
            </p>
            <div class="u-display-grid_grid-template-columns-1fr1fr1fr_gap-8px_margi">
                <button id="pg-cdm-cancel" class="cdm-btn cdm-btn--ghost">Vazgeç</button>
                <button id="pg-cdm-solo"   class="cdm-btn cdm-btn--purple">Bireysel Sürdür</button>
                <button id="pg-cdm-delete" class="cdm-btn cdm-btn--danger">Kalıcı Olarak Sil</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);

    overlay.querySelector('#pg-cdm-cancel').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

    overlay.querySelector('#pg-cdm-solo').addEventListener('click', async () => {
        overlay.remove();
        await _notifyCollabMembersGoalDeleted(g);
        await _convertGoalToSolo(g.id);
    });

    overlay.querySelector('#pg-cdm-delete').addEventListener('click', async () => {
        overlay.remove();
        await _notifyCollabMembersGoalDeleted(g);
        const snapshot = g;
        window._pgDeleteGoal(g.id);
        toast(`"${snapshot.title}" silindi`, {
            undoFn: () => {
                window._pgGetGoals().unshift(snapshot);
                depSnapshot.forEach(d=>{ if(!window._pgGetDependencies().find(x=>x.id===d.id)) window._pgGetDependencies().push(d); });
                window.persistGoals(); saveDependencies(); window.render();
                toast('Geri alındı ↩');
            },
            undoLabel: 'Geri Al',
            duration: 4000,
        });
    });
}

// Silme işlemleri için undo destekli silme
function _deleteGoalWithUndo(id) {
    const goals = window._pgGetGoals();
    const g = goals.find(x=>x.id===id);
    if (!g) return;
    const snapshot = JSON.parse(JSON.stringify(g));
    const depSnapshot = window._pgGetDependencies().filter(d=>d.from===id||d.to===id);
    // Collab hedefler için seçenek modalı göster
    if (g.collab_room_id) {
        _showCollabDeleteModal(snapshot, depSnapshot);
        return;
    }
    window._pgDeleteGoal(id);
    toast(`"${snapshot.title}" silindi`, {
        undoFn: () => {
            window._pgGetGoals().unshift(snapshot);
            depSnapshot.forEach(d=>{ if(!window._pgGetDependencies().find(x=>x.id===d.id)) window._pgGetDependencies().push(d); });
            window.persistGoals(); saveDependencies(); window.render();
            toast('Geri alındı ↩');
        },
        undoLabel: 'Geri Al',
        duration: 4000,
    });
}
window._deleteGoalWithUndo = _deleteGoalWithUndo;

function _deleteMilestoneWithUndo(goalId, msId) {
    const goals = window._pgGetGoals();
    const g = goals.find(x=>x.id===goalId);
    const ms = (g?.milestones||[]).find(m=>m.id===msId);
    if (!g||!ms) return;
    const snapshot = JSON.parse(JSON.stringify(ms));
    window._pgDeleteMilestone(goalId, msId);
    toast(`"${snapshot.title}" silindi`, {
        undoFn: () => {
            const g2 = window._pgGetGoals().find(x=>x.id===goalId);
            if (!g2) return;
            g2.milestones = g2.milestones||[];
            g2.milestones.splice(snapshot.order||g2.milestones.length, 0, snapshot);
            _recalcProgress(g2); g2._dirty=true;
            window.persistGoals(); window.render(); renderMilestoneList(goalId);
            toast('Geri alındı ↩');
        },
        undoLabel: 'Geri Al',
        duration: 4000,
    });
}
window._deleteMilestoneWithUndo = _deleteMilestoneWithUndo;

// Öğrenci "Kabul Et"e hiç basmadan (pending_accept=true iken) düzenleme arayüzünü
// kapatırsa, materialize() sırasında takvime yazılmış görevler ve taslak hedef
// tamamen geri alınır — kabul edilmemiş bir plan asla takvimde kalıcı görünmemeli.
function _pvDiscardUnacceptedGoal(g) {
    if (!g || !g.pending_accept) return;
    const goalId = g.id;
    const allTasks = FocusStorage.get('tasks', []);
    const removedTaskIds = allTasks.filter(t => String(t.parentGoal) === String(goalId)).map(t => t.id);
    const remainingTasks = allTasks.filter(t => String(t.parentGoal) !== String(goalId));
    if (remainingTasks.length !== allTasks.length) FocusStorage.set('tasks', remainingTasks);
    const events = FocusStorage.get('events', {});
    let eventsChanged = false;
    Object.keys(events).forEach(dateKey => {
        const filtered = (events[dateKey] || []).filter(e => String(e.parentGoal) !== String(goalId));
        if (filtered.length !== (events[dateKey] || []).length) {
            eventsChanged = true;
            if (filtered.length) events[dateKey] = filtered; else delete events[dateKey];
        }
    });
    if (eventsChanged) FocusStorage.set('events', events);
    window._pgSetGoals(window._pgGetGoals().filter(x => x.id !== goalId));
    window.persistGoals();
    if (typeof window.syncTasksFromStorage === 'function') window.syncTasksFromStorage();
    if (typeof window.renderTasksGlobal === 'function') window.renderTasksGlobal();
    if (typeof window.renderCalendarGlobal === 'function') window.renderCalendarGlobal();

    // Taslak zaten sunucuya yazılmış olabilir (_syncDirty upsert'i) — sadece yerelden
    // silmek yetmez, yoksa bir sonraki loadGoalsFromServer()/pullAll() bu satırları
    // geri indirip taslağı ve görevlerini "hayalet" olarak yeniden canlandırır.
    const sb = window.FocusSupabase;
    if (sb && getCurrentUser()) {
        if (removedTaskIds.length) {
            sb.from('tasks').delete().in('id', removedTaskIds).then(({ error }) => {
                if (error) console.warn('[FocusSync] taslak görev silme hatası:', error.message);
            });
        }
        sb.from('planning_milestones').delete().eq('goal_id', goalId).then(({ error }) => {
            if (error) console.warn('[FocusSync] taslak milestone silme hatası:', error.message);
        });
        sb.from('planning_goals').delete().eq('id', goalId).then(({ error }) => {
            if (error) console.warn('[FocusSync] taslak goal silme hatası:', error.message);
        });
    }
}
// planning-plan-view-exit.js'in _pvHandleExitClick'ten çağırabilmesi için köprü
// (Faz devamı, dev fonksiyon refactoru — bu fonksiyon eskiden planning.js'in
// aynı closure'ı içindeydi, artık ayrı dosyada).
window._pvDiscardUnacceptedGoal = _pvDiscardUnacceptedGoal;

export {
    _acceptLessonPlanInvite, _showCollabDeleteModal, _deleteGoalWithUndo,
    _deleteMilestoneWithUndo, _pvDiscardUnacceptedGoal,
};
