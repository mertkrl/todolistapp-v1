// ─── HIZLI OLUŞTURMA COLLAB BAŞLATMA + SOLO'YA ÇEVİRME ─────────────────────
// planning.js dosyasından çıkarıldı (Faz H "son duvar" turu). _qcStartCollab/
// _convertGoalToSolo — goals'a window._pgGetGoals() (referans, unshift/find/
// findIndex çalışır) üzerinden erişiyor, persistGoals/render/toast ise
// zaten global (window.*) fonksiyonlar. planning.js'ten ÖNCE yüklenir (bkz.
// inline-module-loader.js).
import { getCurrentUser } from '../state/current-user-store.js';

export async function _qcStartCollab(goal) {
    try {
        const createBtn = document.getElementById('pg-qc-create-btn');
        if (createBtn) { createBtn.disabled = true; }

        // collab_rooms.goal_id -> planning_goals(id) FK'si var; persistGoals()'ın
        // arka planda çalışan _syncDirty()'sini beklemeden enableCollab çağrılırsa
        // hedef satırı Supabase'e henüz yazılmadan oda oluşturulmaya çalışılır,
        // FK ihlaliyle collab_rooms insert'i sessizce (console.warn) başarısız olur
        // ve davet kodu hiçbir zaman gerçek bir odayla eşleşmez ("Geçersiz davet kodu").
        // Bu yüzden hedefi burada senkron biçimde bekleyerek yazıyoruz.
        const goals = window._pgGetGoals();
        if (window.FocusSupabase && getCurrentUser()) {
            const { error: goalErr } = await window.FocusSupabase.from('planning_goals').upsert({
                id: goal.id, user_id: getCurrentUser().id, title: goal.title,
                description: goal.description || '', category: goal.category,
                color: goal.color, deadline: goal.deadline || null,
                priority: goal.priority || 2, status: goal.status || 'active',
                progress_pct: goal.progress_pct || 0,
                milestone_count: (goal.milestones || []).length,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'id' });
            if (goalErr) console.warn('[Collab] pre-create goal upsert error:', goalErr.message);
            else {
                const g = goals.find(x => x.id === goal.id);
                if (g) g._dirty = false;
            }
        }

        const { roomId, inviteCode } = await window.PlanningCollab.enableCollab(goal.id, goal.title);
        window._updateGoalCollabState?.(goal.id, { collab_room_id: roomId, invite_code: inviteCode, is_collaborative: true });
        await window.PlanningCollab.joinRoom(roomId, goal.id, 'owner');

        // Update goal in local storage with collab info
        const gIdx = goals.findIndex(g => g.id === goal.id);
        if (gIdx !== -1) {
            goals[gIdx].collab_room_id  = roomId;
            goals[gIdx].invite_code     = inviteCode;
            goals[gIdx].is_collaborative = true;
            window.persistGoals();
        }

        window._openCollabWaitOverlay({ ...goal, collab_room_id: roomId, invite_code: inviteCode });
    } catch(e) {
        window.toast('Collab başlatılamadı, tekrar deneyin.');
    } finally {
        const createBtn = document.getElementById('pg-qc-create-btn');
        if (createBtn) createBtn.disabled = false;
    }
}
window._qcStartCollab = _qcStartCollab;

// Collab hedefi solo'ya çevir
export async function _convertGoalToSolo(id) {
    const goals = window._pgGetGoals();
    const g = goals.find(x=>x.id===id);
    if (!g) return;
    g.collab_room_id = null;
    g.is_collaborative = false;
    g.invite_code = null;
    g._dirty = true;
    window.persistGoals(); window.render();
    window.PlanningCollab?.leaveRoom?.();
    if (window.FocusSupabase && getCurrentUser()) {
        try {
            await window.FocusSupabase.from('planning_goals').update({
                collab_room_id: null,
                is_collaborative: false,
                invite_code: null,
            }).eq('id', id);
        } catch (_) { console.warn('[FocusAI] sessiz hata:', _); }
    }
    window.toast('Planlama solo\'ya çevrildi');
}
window._convertGoalToSolo = _convertGoalToSolo;
