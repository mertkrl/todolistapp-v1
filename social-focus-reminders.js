// ─── AMACA HİZMET EDEN BİLDİRİMLER ──────────────────────────────────
// social.js dosyasından çıkarıldı (Faz 2, 2026-07-19). Sohbete değil
// çalışmaya çağıran hatırlatmalar: bugünkü grup seansları (15 dk kala +
// başlangıçta) ve akşam seri-riski uyarısı.
//
// Dış bağımlılıklar:
// - currentUser → window._dcGetChatContext().currentUser (salt-okunur)
// - playNotificationSound / maybeShowDesktopNotification → social-notif-
//   sounds.js dosyasında zaten window.* olarak tanımlı
// - showGenericNotifToast / _dhsDateKey → social.js'te zaten window.*
//   köprülüydü
// - _escapeHtml → window.escapeHtml
let _focusRemindersScheduled = false;
async function scheduleFocusReminders() {
    const currentUser = window._dcGetChatContext().currentUser;
    if (_focusRemindersScheduled || !window.FocusSupabase || !currentUser?.id) return;
    _focusRemindersScheduled = true;

    // İzin iste (kullanıcı reddetmişse sessizce ekran içi toast'a düşülür)
    try { if (typeof Notification !== 'undefined' && Notification.permission === 'default') Notification.requestPermission().catch(() => {}); } catch {}

    const notify = (title, body) => {
        window.playNotificationSound('alert');
        window.maybeShowDesktopNotification(title, body);
        window.showGenericNotifToast({ icon: 'fa-bolt', accent: '#D4900E', title, body: window.escapeHtml(body) });
    };

    // 1. Bugünkü grup seansları
    try {
        const { data: memberRows } = await window.FocusSupabase
            .from('group_members').select('group_id, groups(name)').eq('user_id', currentUser.id);
        const groupIds = (memberRows || []).map(r => r.group_id);
        if (groupIds.length) {
            const todayIso = new Date().toISOString().slice(0, 10);
            const { data: sessions } = await window.FocusSupabase
                .from('group_sessions')
                .select('id, title, session_date, session_time, group_id')
                .in('group_id', groupIds)
                .eq('session_date', todayIso);
            const nameByGroup = {};
            (memberRows || []).forEach(r => { nameByGroup[r.group_id] = r.groups?.name || 'Grubun'; });
            (sessions || []).forEach(sess => {
                if (!sess.session_time) return;
                const start = new Date(`${sess.session_date}T${sess.session_time}`);
                const msTo = start.getTime() - Date.now();
                const gName = nameByGroup[sess.group_id] || 'Grubun';
                if (msTo > 15 * 60 * 1000) {
                    setTimeout(() => notify('Seans yaklaşıyor ⏳', `"${sess.title}" 15 dk sonra başlıyor (${gName}).`), msTo - 15 * 60 * 1000);
                }
                if (msTo > 0) {
                    setTimeout(() => notify('Seans başlıyor! ⚡', `"${sess.title}" şimdi başlıyor — ${gName} seni bekliyor.`), msTo);
                }
            });
        }
    } catch (e) { console.warn('[Bildirim] seans hatırlatmaları kurulamadı', e); }

    // 2. Seri riski: 20:30'da bugün hiç odak yoksa ve seri varsa uyar
    try {
        const target = new Date(); target.setHours(20, 30, 0, 0);
        const msTo = target.getTime() - Date.now();
        if (msTo > 0) {
            setTimeout(() => {
                try {
                    const fh = typeof FocusStorage !== 'undefined' ? (FocusStorage.get('focus_history', {}) || {}) : {};
                    const today = window._dhsDateKey(new Date());
                    const y = new Date(); y.setDate(y.getDate() - 1);
                    const hadStreak = Number(fh[window._dhsDateKey(y)]) > 0;
                    if (hadStreak && !(Number(fh[today]) > 0)) {
                        notify('Serin risk altında 🔥', 'Bugün henüz odaklanmadın — kısa bir seans zinciri kurtarır.');
                    }
                } catch {}
            }, msTo);
        }
    } catch {}
}
window.scheduleFocusReminders = scheduleFocusReminders;
