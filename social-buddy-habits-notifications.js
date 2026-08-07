import { getCurrentUser } from './state/current-user-store.js';

// social-buddy-habits.js'ten çıkarıldı: 3 bildirim işleyicisi — hiçbiri
// social-buddy-habits.js'in davet kuyruğu/kanal state'ine dokunmuyor, sadece
// getCurrentUser()/window.FocusSupabase/window._escapeHtml ve DOM'a bağımlı.
// social.js'in geri kalanından da çağrıldığı için window.* olarak da açık.

// Partner'a alışkanlık silindi bildirimi gönder
export async function _sendBuddyHabitDeletedNotification(habitId, buddyUsername, habitName) {
    const currentUser = getCurrentUser();
    if (!window.FocusSupabase || !currentUser?.id || !buddyUsername) {
        console.warn('[BuddyHabit] ön koşul hatası:', { supabase: !!window.FocusSupabase, userId: currentUser?.id, buddy: buddyUsername });
        return;
    }
    // Partner id'sini çöz
    let partnerId = null;
    try {
        const cached = await window._resolveProfileByUsername?.(buddyUsername);
        partnerId = cached?.id || null;
        if (!partnerId) {
            const { data: p, error: pe } = await window.FocusSupabase.from('profiles').select('id').eq('username', buddyUsername).maybeSingle();
            if (pe) console.warn('[BuddyHabit] profiles sorgu hatası:', pe.message);
            partnerId = p?.id || null;
        }
    } catch (e) { console.warn('[BuddyHabit] profil çözme hatası:', e.message); }
    if (!partnerId) {
        console.warn('[BuddyHabit] partner profili bulunamadı, username:', buddyUsername);
        return;
    }
    const resolvedName = habitName || '';
    const { error } = await window.FocusSupabase.from('notifications').insert({
        user_id: partnerId, type: 'buddy_habit_deleted',
        payload: { fromUsername: currentUser.username, fromName: currentUser.displayName || currentUser.username, habitId, habitName: resolvedName }
    });
    if (error) console.warn('[BuddyHabit] bildirim insert hatası:', error.message);
}
window._sendBuddyHabitDeletedNotification = _sendBuddyHabitDeletedNotification;

// Ortak alışkanlık silindi bildirimini işle — partnere modal göster
export function _handleBuddyHabitDeletedNotification(info) {
    document.getElementById('gf-buddy-habit-deleted-overlay')?.remove();
    const habitName = info.habitName || 'bir ortak alışkanlık';
    const fromName = info.fromName || info.fromUsername || 'Partner';
    const overlay = document.createElement('div');
    overlay.id = 'gf-buddy-habit-deleted-overlay';
    overlay.className = 'modal-overlay';
    overlay.style.zIndex = '100060';
    overlay.innerHTML = `
        <div class="modal-content glass-panel u-max-width-370px_text-align-center_padding-28px24px" >
            <div class="u-font-size-32px_margin-bottom-12px">🍃</div>
            <h3 class="u-margin-008px_font-size-16px_color-hfff">${window._escapeHtml(fromName)} ayrıldı</h3>
            <p class="u-color-var-text-muted_font-size-13px_margin-0022px">
                <b class="u-color-hfff">"${window._escapeHtml(habitName)}"</b> alışkanlığını ortak olarak sildi.<br>Bu alışkanlığa tek başına devam etmek ister misin?
            </p>
            <div class="u-display-flex_flex-direction-column_gap-10px-2">
                <button id="gf-bh-solo-btn" class="control-btn primary u-width-100pct_padding-12px" >
                    <i class="fa-solid fa-person-running"></i> Evet, Solo Devam Et
                </button>
                <button id="gf-bh-delete-btn" class="control-btn u-width-100pct_padding-12px_background-rgba25571870p1_color-" >
                    <i class="fa-solid fa-trash"></i> Hayır, Alışkanlığı Sil
                </button>
            </div>
        </div>`;
    document.body.appendChild(overlay);

    document.getElementById('gf-bh-solo-btn').addEventListener('click', () => {
        overlay.remove();
        // Alışkanlığı solo'ya çevir (buddy/pairId'yi kaldır)
        if (info.habitId && typeof window.convertBuddyHabitToSolo === 'function') {
            window.convertBuddyHabitToSolo(info.habitId);
        }
    });
    document.getElementById('gf-bh-delete-btn').addEventListener('click', () => {
        overlay.remove();
        if (info.habitId && typeof window.deleteHabitById === 'function') {
            window.deleteHabitById(info.habitId);
        }
    });
}
window._handleBuddyHabitDeletedNotification = _handleBuddyHabitDeletedNotification;

// Oturum bitti bildirimini işle — toast göster
export function _handleBuddySessionEndedNotification(info) {
    const fromName = info.fromName || info.fromUsername || 'Partner';
    const habitName = info.habitName || 'ortak alışkanlık';
    const completed = info.completed;
    if (typeof window.showGenericNotifToast === 'function') {
        window.showGenericNotifToast({
            icon: completed ? 'fa-check-double' : 'fa-hourglass-end',
            accent: completed ? '#2ed573' : '#fdcb6e',
            title: completed ? 'Oturum Bitti — Tamamlandı! 🎉' : 'Oturum Sonlandı',
            body: completed
                ? `<b>${window._escapeHtml(fromName)}</b>, "${window._escapeHtml(habitName)}" alışkanlığını bugün tamamladığını bildirdi.`
                : `<b>${window._escapeHtml(fromName)}</b> odak oturumunu sonlandırdı.`
        });
    }
}
window._handleBuddySessionEndedNotification = _handleBuddySessionEndedNotification;
