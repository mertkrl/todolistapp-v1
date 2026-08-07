// social-assignments-badge.js — 'ÖDEVLERİM' rozeti (2026-07-06)
// social.js'ten izole edildi (2026-07-18).

// ─── "ÖDEVLERİM" ROZETİ (2026-07-06) ──────────────────────────
// Üye olunan tüm sınıf gruplarındaki bekleyen (teslim edilmemiş) ödevleri
// tek rozette toplar — öğrenci hangi gruptan geldiğini hatırlamak zorunda
// kalmadan tüm ödevlerini burada görür, tıklayınca ilgili grubun Ödevler
// sekmesine düşer (bkz. window.dcOpenAssignmentTab).
// window.FocusAssignments: script.js'in (Bugün/Takvim görünümleri) sınıf ödevlerine
// erişebilmesi için paylaşılan, salt-okunur önbellek. `items` her zaman TÜM (açık) ödevleri
// içerir (teslim edilmiş dahil, `done` alanıyla işaretli) — Takvim geçmiş/gelecek günleri de
// gösterebilsin diye. Veri her yenilendiğinde 'focusai:assignments-updated' olayı yayınlanır.
import { getCurrentUser } from '../state/current-user-store.js';
let _myPendingAssignments = [];
window.FocusAssignments = { items: [], refresh: () => _refreshMyAssignmentsBadge() };
export async function _refreshMyAssignmentsBadge() {
    if (!window.FocusSupabase || !getCurrentUser()?.id) return;
    const badge = document.getElementById('dhs-assignments-badge');
    const setBadge = (n, warn) => {
        if (!badge) return;
        badge.classList.toggle('hidden', n === 0);
        badge.classList.toggle('dhs-assignments-badge--warn', !!warn);
        const countEl = badge.querySelector('#dhs-assignments-count');
        if (countEl) countEl.textContent = n;
    };
    try {
        const { data: memberships } = await window.FocusSupabase
            .from('group_members').select('group_id, groups(id, code, name, classroom_type)')
            .eq('user_id', getCurrentUser().id);
        // "Sınıf Paneli" sekmesi (ve dolayısıyla ödev/görevlendirme özelliği) hem
        // classroom hem workplace tipi gruplarda aktif (bkz. social.js ~11581) —
        // sadece 'classroom' filtrelemek workplace (Ekip) gruplarındaki ödevlerin
        // Bugün/Takvim'e hiç yansımamasına sebep oluyordu.
        const classroomGroups = (memberships || [])
            .map(m => m.groups).filter(g => g && (g.classroom_type === 'classroom' || g.classroom_type === 'workplace'));
        if (!classroomGroups.length) {
            _myPendingAssignments = []; window.FocusAssignments.items = []; setBadge(0);
            window.dispatchEvent(new CustomEvent('focusai:assignments-updated'));
            return;
        }
        const groupById = {};
        classroomGroups.forEach(g => { groupById[g.id] = g; });
        const { data: assignments } = await window.FocusSupabase
            .from('classroom_assignments').select('id, group_id, title, due_date, status, priority, target_user_ids, steps')
            .in('group_id', classroomGroups.map(g => g.id)).eq('status', 'active');
        const mine = (assignments || []).filter(a => !a.target_user_ids || a.target_user_ids.includes(getCurrentUser().id));
        if (!mine.length) {
            _myPendingAssignments = []; window.FocusAssignments.items = []; setBadge(0);
            window.dispatchEvent(new CustomEvent('focusai:assignments-updated'));
            return;
        }
        const { data: subs } = await window.FocusSupabase
            .from('assignment_submissions').select('assignment_id').eq('user_id', getCurrentUser().id)
            .in('assignment_id', mine.map(a => a.id));
        const doneIds = new Set((subs || []).map(s => s.assignment_id));
        // Çok adımlı ödev/ders planı (steps var): "teslim" yerine "tüm adımlar tamamlandı mı"
        // sayılır — Ödevlerim rozeti/popoveri de bu yüzden classroom_assignments ile aynı
        // veriyi (assignment_step_progress) kullanıyor, ayrı bir "ders planlarım" listesine gerek yok.
        const multiStepMine = mine.filter(a => a.steps && a.steps.length);
        const myStepDoneByAsg = {};
        if (multiStepMine.length) {
            const { data: stepRows } = await window.FocusSupabase
                .from('assignment_step_progress').select('assignment_id, step_id')
                .eq('user_id', getCurrentUser().id).eq('done', true)
                .in('assignment_id', multiStepMine.map(a => a.id));
            (stepRows || []).forEach(r => (myStepDoneByAsg[r.assignment_id] = myStepDoneByAsg[r.assignment_id] || new Set()).add(r.step_id));
        }
        const decorated = mine
            .map(a => {
                const isMultiStep = !!(a.steps && a.steps.length);
                const stepsDone = isMultiStep ? a.steps.filter(s => myStepDoneByAsg[a.id]?.has(s.id)).length : 0;
                return {
                    ...a, isMultiStep, stepsDone,
                    done: isMultiStep ? (a.steps.length > 0 && stepsDone === a.steps.length) : doneIds.has(a.id),
                    groupCode: groupById[a.group_id]?.code, groupName: groupById[a.group_id]?.name
                };
            })
            .sort((a, b) => {
                if (!a.due_date && !b.due_date) return 0;
                if (!a.due_date) return 1;
                if (!b.due_date) return -1;
                return new Date(a.due_date) - new Date(b.due_date);
            });
        window.FocusAssignments.items = decorated;
        _myPendingAssignments = decorated.filter(a => !a.done);
        const overdueCount = _myPendingAssignments.filter(a => a.due_date && new Date(a.due_date) < new Date()).length;
        setBadge(_myPendingAssignments.length, overdueCount > 0);
        window.dispatchEvent(new CustomEvent('focusai:assignments-updated'));
    } catch (err) {
        console.warn('[Ödevlerim] rozet güncellenemedi:', err.message);
    }
}
window._refreshMyAssignmentsBadge = _refreshMyAssignmentsBadge;

