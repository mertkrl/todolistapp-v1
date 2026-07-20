// ─── PLANLAMA — REALTIME ABONELİK + DEADLINE BİLDİRİMLERİ ──────────────
// planning.js dosyasından çıkarıldı (Faz 2, 2026-07-20). Supabase
// planning_goals/planning_milestones tablolarındaki değişiklikleri
// dinleyip yerel `goals` durumuna uygular (çok kullanıcılı/collab senaryosu
// için kritik) ve yaklaşan deadline'lar için yerel bildirim gösterir.
//
// ÖNEMLİ: Bu dosya index.html'de/inline-module-loader.js'de planning.js'ten
// ÖNCE yüklenmeli — planning.js'in init() fonksiyonu window._subscribeRealtime
// ve window._checkDeadlineNotifications'ı setTimeout/setInterval'e SENKRON
// referans olarak veriyor (bkz. Faz 2 metodolojisi, sıralama kontrolü —
// planning-dependency-graph.js/planning-lesson-plan-modal.js'te de aynı tuzak).
//
// Dış bağımlılıklar (planning.js'te kalıyor, window.* köprüsüyle açıldı):
// - goals → window._pgGetGoals() / window._pgSetGoals() (reassign edildiği
//   için setter da gerekli)
// - toast, render, _recalcProgress, renderMilestoneList, refreshDetailSummary,
//   _initDetailProgress, _notifyLocal → window.*
// - detailGoalId (salt-okunur) → window._pgGetDetailGoalId()
// - FocusStorage / window.FocusSupabase / window.currentUser → zaten global

function _checkDeadlineNotifications() {
    if (Notification.permission !== 'granted') return;
    const now = new Date();
    window._pgGetGoals().filter(g => g.status === 'active' && g.deadline).forEach(g => {
        const diff = Math.ceil((new Date(g.deadline) - now) / 86400000);
        const key  = 'pg_notif_' + g.id + '_' + g.deadline;
        if (diff === 7 && !sessionStorage.getItem(key + '_7')) {
            window._notifyLocal('📅 Deadline Yaklaşıyor', `"${g.title}" için 7 gün kaldı!`, key + '_7');
            sessionStorage.setItem(key + '_7', '1');
        }
        if (diff === 1 && !sessionStorage.getItem(key + '_1')) {
            window._notifyLocal('⚠️ Yarın Son Gün!', `"${g.title}" için son gün yarın!`, key + '_1');
            sessionStorage.setItem(key + '_1', '1');
        }
        if (diff < 0 && !sessionStorage.getItem(key + '_over')) {
            window._notifyLocal('🔴 Deadline Geçti', `"${g.title}" için son tarih geçti.`, key + '_over');
            sessionStorage.setItem(key + '_over', '1');
        }
    });
}
window._checkDeadlineNotifications = _checkDeadlineNotifications;

// ── 4.2 Realtime Subscription ────────────
let _realtimeChannel = null;
// Debounce: çok kullanıcılı ortamda toast flood önlemi
let _realtimeToastCount = 0, _realtimeToastTimer = null;
function _debouncedRealtimeToast() {
    _realtimeToastCount++;
    clearTimeout(_realtimeToastTimer);
    _realtimeToastTimer = setTimeout(() => {
        const n = _realtimeToastCount;
        _realtimeToastCount = 0;
        window.toast(`🔄 ${n > 1 ? n + ' güncelleme' : 'Güncelleme'} senkronize edildi`);
    }, 800);
}

function _subscribeRealtime() {
    if (!window.FocusSupabase || !window.currentUser) return;
    const sb = window.FocusSupabase, uid = window.currentUser.id;

    // Önceki kanalı temizle
    if (_realtimeChannel) { sb.removeChannel(_realtimeChannel); _realtimeChannel = null; }

    _realtimeChannel = sb.channel('planning-realtime-' + uid)
        // Hedef değişiklikleri
        .on('postgres_changes', {
            event: '*', schema: 'public', table: 'planning_goals',
            filter: 'user_id=eq.' + uid,
        }, payload => {
            _handleGoalChange(payload);
        })
        // Milestone değişiklikleri (collab için kritik)
        .on('postgres_changes', {
            event: '*', schema: 'public', table: 'planning_milestones',
        }, payload => {
            _handleMilestoneChange(payload);
        })
        .subscribe();
}
window._subscribeRealtime = _subscribeRealtime;

function _handleGoalChange(payload) {
    const { eventType, new: row, old: oldRow } = payload;
    let goals = window._pgGetGoals();
    if (eventType === 'DELETE') {
        goals = goals.filter(g => g.id !== oldRow.id);
        window._pgSetGoals(goals);
    } else if (eventType === 'INSERT') {
        if (!goals.find(g => g.id === row.id)) goals.unshift({ ...row, milestones: [], _dirty: false });
    } else if (eventType === 'UPDATE') {
        const idx = goals.findIndex(g => g.id === row.id);
        if (idx !== -1 && !goals[idx]._dirty) {
            goals[idx] = {
                ...goals[idx], ...row,
                // Realtime row'u milestone'ları içermez — local'i koru
                milestones:     goals[idx].milestones,
                collab_room_id: goals[idx].collab_room_id || row.collab_room_id || null,
                invite_code:    goals[idx].invite_code    || null,
                my_role:        goals[idx].my_role        || null,
                _dirty: false,
            };
        }
    }
    if (typeof FocusStorage !== 'undefined') FocusStorage.set('planning_goals', window._pgGetGoals());
    window.render();
    if (typeof window.renderPlanningStats === 'function') window.renderPlanningStats();
}

function _handleMilestoneChange(payload) {
    const { eventType, new: row, old: oldRow } = payload;
    const goals = window._pgGetGoals();
    const g = goals.find(g => g.id === (row?.goal_id || oldRow?.goal_id));
    if (!g) return;
    if (!g.milestones) g.milestones = [];

    if (eventType === 'DELETE') {
        g.milestones = g.milestones.filter(m => m.id !== oldRow.id);
    } else if (eventType === 'INSERT') {
        if (!g.milestones.find(m => m.id === row.id)) {
            g.milestones.push({ id:row.id, title:row.title, due_date:row.due_date||'',
                done:!!row.done, order:row.order_index, description:'', created_at:row.created_at });
        }
    } else if (eventType === 'UPDATE') {
        const idx = g.milestones.findIndex(m => m.id === row.id);
        if (idx !== -1) {
            g.milestones[idx] = { ...g.milestones[idx], title:row.title,
                due_date:row.due_date||'', done:!!row.done, order:row.order_index };
        }
    }
    window._recalcProgress(g);
    if (typeof FocusStorage !== 'undefined') FocusStorage.set('planning_goals', goals);
    window.render();
    if (window._pgGetDetailGoalId() === g.id) {
        window.renderMilestoneList(g.id);
        window.refreshDetailSummary(g);
        window._initDetailProgress(g);
    }
    if (typeof window.renderPlanningStats === 'function') window.renderPlanningStats();
    _debouncedRealtimeToast();
}
