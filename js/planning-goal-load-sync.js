// ─── HEDEF YÜKLEME + SUNUCU SENKRONU ───────────────────────────────────────
// planning.js dosyasından çıkarıldı (Faz H "son duvar" turu). loadGoals/
// loadGoalsFromServer/_syncDirty — goals/pvGoalId gibi planning.js'in
// paylaşılan durumuna window.__get/__set köprüleri üzerinden erişiyor
// (goals: window._pgGetGoals/_pgSetGoals, pvGoalId: window.__getPvGoalId).
// planning.js'ten ÖNCE yüklenir (bkz. inline-module-loader.js), init()
// içinden ve persistGoals() içinden window._pgLoadGoals/_pgSyncDirty
// köprüleriyle çağrılır.
import { getCurrentUser } from '../state/current-user-store.js';
import { _setSyncBadge } from './planning-goal-sync-cleanup.js';

export function loadGoals() {
    const arr = (typeof FocusStorage !== 'undefined')
        ? FocusStorage.get('planning_goals', [])
        : JSON.parse(localStorage.getItem('planning_goals') || '[]', window._safeJsonReviver);
    window._pgSetGoals(arr);
}
window._pgLoadGoals = loadGoals;

// 4.1 — Supabase'den hedef + milestone'ları çek, localStorage ile birleştir
export async function loadGoalsFromServer() {
    if (!window.FocusSupabase || !getCurrentUser()) return;
    const sb = window.FocusSupabase, uid = getCurrentUser().id;
    try {
        const { data: gData } = await sb.from('planning_goals')
            .select('*').eq('user_id', uid).order('created_at', { ascending: false });
        if (!gData || !gData.length) return;

        const { data: msData } = await sb.from('planning_milestones')
            .select('*').eq('user_id', uid).order('order_index', { ascending: true });

        const goals = window._pgGetGoals();
        // Server goals ile localStorage'ı birleştir (server öncelikli)
        gData.forEach(sg => {
            const local = goals.find(g => g.id === sg.id);
            const serverMs = (msData || []).filter(m => m.goal_id === sg.id).map(m => ({
                id: m.id, title: m.title, due_date: m.due_date || '',
                start_date: m.start_date || '',
                start_time: m.start_time || '', end_time: m.end_time || '',
                is_task_mirror: !!m.is_task_mirror,
                done: !!m.done, order: m.order_index,
                description: m.description || '', created_at: m.created_at,
            }));
            const merged = {
                ...(local || {}), ...sg,
                milestones: serverMs.length ? serverMs : (local?.milestones || []),
                // Supabase'de null olan ama localStorage'da olan alanları koru
                collab_room_id: local?.collab_room_id || sg.collab_room_id || null,
                invite_code:    local?.invite_code    || null,
                my_role:        local?.my_role        || null,
                lpa_id:         local?.lpa_id         || null,
                // plan_mode/context eski kayıtlarda (102 migration'dan önce yazılmış) sunucuda
                // hâlâ boş olabilir — yerel değeri koru ki ders planı kopyası "bireysel plan"a dönmesin.
                plan_mode:      sg.plan_mode || local?.plan_mode || null,
                context:        (sg.context && Object.keys(sg.context).length ? sg.context : local?.context) || null,
                _dirty: false,
            };
            if (local) {
                const idx = goals.indexOf(local);
                goals[idx] = merged;
            } else {
                goals.push(merged);
            }
        });
        window.persistGoals();
        window.render();
        // PlanView açıksa yeni server verisiyle yeniden render et
        const pvGoalId = window.__getPvGoalId();
        if (pvGoalId) {
            const gLive = window._pgGetGoals().find(x => x.id === pvGoalId);
            if (gLive) window._pvRender(gLive);
        }
        if (typeof window.renderPlanningStats === 'function') window.renderPlanningStats();
    } catch (_) { console.warn('[FocusAI] sessiz hata:', _); }
}
window._pgLoadGoalsFromServer = loadGoalsFromServer;

export async function _syncDirty() {
    if (!window.FocusSupabase || !getCurrentUser()) return;
    const goals = window._pgGetGoals();
    const dirty = goals.filter(g => g._dirty);
    if (!dirty.length) return;
    _setSyncBadge('syncing');
    const sb = window.FocusSupabase, uid = getCurrentUser().id;
    for (const g of goals) {
        if (!g._dirty) continue;
        try {
            // 4.1 — Hedefi yaz
            const { error } = await sb.from('planning_goals').upsert({
                id: g.id, user_id: uid, title: g.title,
                description: g.description || '', category: g.category,
                color: g.color, deadline: g.deadline || null,
                priority: g.priority || 2, status: g.status || 'active',
                progress_pct: g.progress_pct || 0,
                milestone_count: (g.milestones || []).length,
                // plan_mode/context daha önce hiç senkronize olmuyordu — bkz. 102_planning_goals_plan_mode.sql.
                // Eksik kalınca loadGoalsFromServer() sunucudan gelen null değerle yerel plan_mode'u
                // eziyor, ders planı kopyaları sayfa yenilenince bireysel plana dönüyordu.
                plan_mode: g.plan_mode || null,
                context: g.context || {},
                updated_at: new Date().toISOString(),
            }, { onConflict: 'id' });
            if (!error) {
                g._dirty = false;
                // Ders planı olarak atanmışsa öğretmenin takip tablosunu da güncelle (kayıt yoksa no-op).
                // pending_accept true iken (öğrenci taslağı düzenliyor ama henüz "Kabul Et"e basmadı)
                // bu güncelleme ATLANMALI — yoksa sadece düzenleme arayüzüne girmek/bir aşamayı
                // kaydetmek bile lesson_plan_assignments.status'u sessizce 'accepted' yapıyordu.
                if (g.lpa_id && !g.pending_accept) {
                    const isDone = (g.progress_pct || 0) === 100;
                    sb.from('lesson_plan_assignments').update({
                        progress_pct: g.progress_pct || 0,
                        status: isDone ? 'completed' : 'accepted',
                        completed_at: isDone ? new Date().toISOString() : null,
                    }).eq('id', g.lpa_id).then(() => {});
                }
                // 4.1 — Milestone'ları ayrı tabloya yaz
                const msList = (g.milestones || []).map((ms, i) => ({
                    id: ms.id, goal_id: g.id, user_id: uid,
                    title: ms.title, due_date: ms.due_date || null,
                    start_date: ms.start_date || null,
                    // start_time/end_time: ders planı aşamalarının saatli içeriği — önceden burada
                    // eksikti, bu yüzden öğretmenin planlama takviminde girdiği saat bilgisi hiç
                    // Supabase'e ulaşmıyor, dolayısıyla öğrenciye de hiç geçmiyordu.
                    start_time: ms.start_time || null, end_time: ms.end_time || null,
                    is_task_mirror: !!ms.is_task_mirror,
                    order_index: ms.order ?? i, done: !!ms.done,
                    updated_at: new Date().toISOString(),
                }));
                if (msList.length) {
                    await sb.from('planning_milestones').upsert(msList, { onConflict: 'id' });
                    // Silinmiş milestone'ları temizle
                    const liveIds = msList.map(m => m.id);
                    await sb.from('planning_milestones')
                        .delete()
                        .eq('goal_id', g.id)
                        .not('id', 'in', `(${liveIds.map(x=>'"'+x+'"').join(',')})`);
                } else {
                    // Tüm milestone'lar silindiyse
                    await sb.from('planning_milestones').delete().eq('goal_id', g.id);
                }
            }
        } catch (_) { console.warn('[FocusAI] sessiz hata:', _); }
    }
    _setSyncBadge('done');
}
window._pgSyncDirty = _syncDirty;
