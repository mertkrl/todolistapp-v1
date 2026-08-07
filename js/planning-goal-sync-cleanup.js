// ─── HEDEF SENKRON ROZETİ + SİLME TEMİZLİĞİ + İŞ BİRLİĞİ BİLDİRİMİ ─────────
// planning.js dosyasından çıkarıldı (Faz O, beşinci dilim): üç bağımsız
// fonksiyon — hiçbiri planning.js'in goals/dependencies/activeFilters gibi
// paylaşılan durumuna dokunmuyor, sadece parametre olarak verilen id/goal
// nesnesini okuyup DOM'u veya FocusStorage/Supabase'i güncelliyor.
// planning.js dışında hiçbir dosya bu üçünü çağırmıyor (yalnızca kendi
// içinde persistGoals/_syncDirty ve deleteGoal/_convertGoalToSolo tarafından
// kullanılıyor) — bu yüzden window.* köprüsüne hiç gerek kalmadı.

// state: 'syncing' | 'done' | 'hidden'
import { getCurrentUser } from '../state/current-user-store.js';
function _setSyncBadge(state) {
    let badge = document.getElementById('pg-sync-badge');
    if (!badge) {
        badge = document.createElement('div');
        badge.id = 'pg-sync-badge';
        badge.className = 'pg-sync-badge';
        const header = document.querySelector('.pg-header');
        if (header) header.appendChild(badge);
    }
    if (state === 'syncing') {
        badge.innerHTML = '<i class="ti ti-refresh pg-sync-spin"></i> Senkronize ediliyor...';
        badge.classList.add('show');
    } else if (state === 'done') {
        badge.innerHTML = '<i class="ti ti-check"></i> Kaydedildi';
        badge.classList.add('show');
        clearTimeout(badge._t);
        badge._t = setTimeout(() => badge.classList.remove('show'), 2000);
    } else {
        badge.classList.remove('show');
    }
}

function _purgeGoalTasks(goalId, milestoneIds) {
    // Remove all tasks and calendar events tied to this goal
    const allTasks = FocusStorage.get('tasks', []);
    const purgedIds = new Set(
        allTasks.filter(t => String(t.parentGoal) === String(goalId)).map(t => String(t.id))
    );
    const kept = allTasks.filter(t => String(t.parentGoal) !== String(goalId));
    FocusStorage.set('tasks', kept);

    // Bu hedefe ait dönüm noktalarının takvim event id'leri (ms_cal_<msId>)
    const msCalIds = new Set((milestoneIds||[]).map(id => 'ms_cal_' + id));

    const events = FocusStorage.get('events', {});
    let changed  = false;
    for (const date in events) {
        const before = events[date].length;
        // parentGoal eşleşmesi, silinen görev ID'si VEYA silinen milestone'un takvim id'si ile eşleşen olayları kaldır
        events[date] = events[date].filter(e =>
            String(e.parentGoal) !== String(goalId) &&
            !purgedIds.has(String(e.id)) &&
            !msCalIds.has(String(e.id))
        );
        if (events[date].length !== before) changed = true;
        if (!events[date].length) delete events[date];
    }
    if (changed) FocusStorage.set('events', events);

    // FocusStorage temizlendi — script.js in-memory array'lerini de senkronize et.
    // Aksi hâlde deleteGlobalTask in-memory'den silip saveTasks() çağırınca
    // silinen görevler FocusStorage'a geri yazılır.
    if (typeof window.syncTasksFromStorage === 'function') window.syncTasksFromStorage();

    if (typeof window.renderCalendarGlobal === 'function') window.renderCalendarGlobal();
    if (typeof window.renderTasks === 'function') window.renderTasks();
}

async function _notifyCollabMembersGoalDeleted(goal) {
    if (!window.FocusSupabase) return;
    // Auth kullanıcısını doğrudan Supabase'den al (currentUser race condition'ına karşı)
    let authId = getCurrentUser()?.id;
    if (!authId) {
        try {
            const { data: { user } } = await window.FocusSupabase.auth.getUser();
            authId = user?.id;
        } catch (_) { console.warn('[FocusAI] sessiz hata:', _); }
    }
    if (!authId) return;

    const cu = getCurrentUser() || {};
    const fromName     = cu.displayName || cu.username || cu.email?.split('@')[0] || 'Biri';
    const fromUsername = cu.username || '';

    let members = [];
    try {
        const { data, error } = await window.FocusSupabase
            .from('collab_room_members')
            .select('user_id')
            .eq('room_id', goal.collab_room_id);
        if (error) console.warn('[CollabNotif] members fetch error:', error.message);
        members = (data || []).filter(m => m.user_id !== authId);
    } catch(e) { console.warn('[CollabNotif] members fetch exception:', e); }

    for (const m of members) {
        try {
            const { error } = await window.FocusSupabase.from('notifications').insert({
                user_id: m.user_id,
                type: 'collab_goal_deleted',
                payload: {
                    fromName, fromUsername,
                    goalId: goal.id,
                    goalTitle: goal.title,
                    roomId: goal.collab_room_id,
                }
            });
            if (error) console.warn('[CollabNotif] insert error:', error.message);
        } catch(e) { console.warn('[CollabNotif] insert exception:', e); }
    }
}

// Faz O: gerçek export (planning.js bu dosyadan ÖNCE yüklendiği için güvenli
// — bkz. inline-module-loader.js).
export { _setSyncBadge, _purgeGoalTasks, _notifyCollabMembersGoalDeleted };
