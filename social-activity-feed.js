// ============================================================
// FOCUSAI SOCIAL-ACTIVITY-FEED.JS
// social.js'ten çıkarılmış aktivite/kudos yardımcıları: mesaj tepki
// (reaction) picker paylaşılan durumu, grup lig kudos gönderme, haftalık
// grup hedefi kutlaması.
// getCurrentUser(), window.FocusSupabase, window.dcShowToast,
// window._throttleAction, window.fireConfetti gibi social.js globallerine
// bağımlı — ondan SONRA yüklenmeli.
// window._activeReactionPicker ve window.closeReactionPicker, social.js'in
// GERİ KALANINDAKİ openDcMsgReactionPicker() ile PAYLAŞILAN durumdur — bu
// yüzden window üzerinden erişiliyor. window._currentWeekStartKey ve
// window._maybeCelebrateGroupGoal da uzak bir bölümden çağrıldığı için
// window.X olarak dışa açılıyor.
// ============================================================
// Emoji tepki seçici kabarcığı için paylaşılan durum/kapatma yardımcıları —
// openDcMsgReactionPicker (sohbet mesajı tepkisi, social.js'in geri kalanında) bunları kullanır.
import { getCurrentUser } from './state/current-user-store.js';
import { getActiveReactionPicker, setActiveReactionPicker } from './state/active-reaction-picker-store.js';
setActiveReactionPicker(null);
export function closeReactionPicker() {
    if (!getActiveReactionPicker()) return;
    const { picker, outsideHandler } = getActiveReactionPicker();
    document.removeEventListener('click', outsideHandler);
    picker.classList.remove('is-open');
    setTimeout(() => picker.remove(), 160);
    setActiveReactionPicker(null);
}
window.closeReactionPicker = closeReactionPicker;

// Grup leaderboard'unda bir üyeye 👏 (kudos/alkış) gönderir — pozitif rekabeti
// tek taraflı bir yarış olmaktan çıkarıp karşılıklı teşvike dönüştürür.
export async function sendGroupKudos(targetUserId, targetUsername, btnEl) {
    const currentUser = getCurrentUser();
    if (!currentUser || !targetUserId || !window.FocusSupabase) return;
    if (targetUserId === currentUser.id) return;
    // Aynı kişiye art arda spam göndermeyi engelle: kişi başına 2 dakikada bir
    if (!window._throttleAction(`kudos_${targetUserId}`, 120000)) {
        window.dcShowToast('Az önce ona alkış gönderdin, biraz bekle.');
        return;
    }

    if (btnEl) {
        btnEl.disabled = true;
        btnEl.classList.add('kudos-sent');
    }

    try {
        const { error } = await window.FocusSupabase.from('notifications').insert({
            user_id: targetUserId,
            type: 'kudos',
            payload: {
                fromUser: currentUser.username,
                fromName: currentUser.displayName,
                fromColor: currentUser.avatarColor || '6c5ce7'
            }
        });
        if (error) {
            console.warn('[Kudos] bildirim yazma hatası', error.message);
            if (btnEl) { btnEl.disabled = false; btnEl.classList.remove('kudos-sent'); }
            return;
        }
        window.dcShowToast(`👏 ${targetUsername ? '@' + targetUsername : 'Üyeye'} alkış gönderildi!`);
    } catch (err) {
        console.error('[Kudos] gönderme hatası', err);
        if (btnEl) { btnEl.disabled = false; btnEl.classList.remove('kudos-sent'); }
    }
}
window.sendGroupKudos = sendGroupKudos;

// Haftalık grup hedefi %100'e ulaşınca: her tarayıcıda bir kerelik konfeti +
// (yarışan tüm clientlar arasında yalnızca biri "kazanıp") tüm üyelere bildirim.
function _currentWeekStartKey() {
    const d = new Date();
    const day = (d.getDay() + 6) % 7; // Pazartesi=0
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - day);
    return d.toISOString().slice(0, 10);
}
window._currentWeekStartKey = _currentWeekStartKey;

export async function _maybeCelebrateGroupGoal(groupId, groupName, totalMinutes, weeklyGoal) {
    if (!groupId || !window.FocusSupabase) return;

    const localKey = `focusai_group_celebrated_${groupId}_${_currentWeekStartKey()}`;
    if (!localStorage.getItem(localKey)) {
        localStorage.setItem(localKey, '1');
        if (typeof window.fireConfetti === 'function') window.fireConfetti();
        window.dcShowToast(`🎉 ${groupName || 'Grubunuz'} haftalık hedefi tamamladı!`);
    }

    // Sunucu tarafında bu haftanın bildirimi daha önce gönderilmediyse atomik olarak
    // "kazan" ve tüm üyelere bildirim yolla (claim_group_weekly_celebration RPC'si
    // aynı anda birden çok client denese bile bunu yalnızca bir kez yapar).
    try {
        await window.FocusSupabase.rpc('claim_group_weekly_celebration', {
            p_group_id: groupId,
            p_total_minutes: totalMinutes,
            p_weekly_goal: weeklyGoal
        });
    } catch (e) {
        console.warn('[Grup Kutlama] claim_group_weekly_celebration hatası:', e.message);
    }
}
window._maybeCelebrateGroupGoal = _maybeCelebrateGroupGoal;

