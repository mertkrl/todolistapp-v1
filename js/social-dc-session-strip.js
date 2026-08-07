// ─── SEANS ŞERİDİ: kanal sohbetinin üstünde yaklaşan seans ──────────────────
// social.js dosyasından çıkarıldı (Faz H devamı, 2026-07-30). "Haberleşelim"
// ihtiyacını mesaj yazmadan çözer: sıradaki seansı ve katılımcı sayısını
// gösterir, tek tıkla "Varım" denir. _sessionStripGroupId artık
// state/session-strip-group-id-store.js üzerinden okunuyor/yazılıyor.
import { getCurrentUser } from '../state/current-user-store.js';
import { getSessionStripGroupId, setSessionStripGroupId } from '../state/session-strip-group-id-store.js';
import { _escapeHtml } from './social-misc-pure-utils.js';

export function dcHideSessionStrip() {
    setSessionStripGroupId(null);
    document.getElementById('dc-session-strip')?.remove();
}
window.dcHideSessionStrip = dcHideSessionStrip;

window.dcRenderSessionStrip = (groupUuid) => dcRenderSessionStrip(groupUuid); // Faz 5: social-group-details.js için
export async function dcRenderSessionStrip(groupUuid) {
    const currentUser = getCurrentUser();
    if (!window.FocusSupabase || !currentUser?.id || !groupUuid) return;
    setSessionStripGroupId(groupUuid);
    try {
        const todayIso = new Date().toISOString().slice(0, 10);
        const { data: sessions } = await window.FocusSupabase
            .from('group_sessions')
            .select('id, title, session_date, session_time, duration, group_session_attendees(user_id, username)')
            .eq('group_id', groupUuid)
            .gte('session_date', todayIso)
            .order('session_date', { ascending: true })
            .order('session_time', { ascending: true })
            .limit(3);
        if (getSessionStripGroupId() !== groupUuid) return; // bu arada kanal değişti

        const now = Date.now();
        const next = (sessions || []).find(sess => {
            if (!sess.session_time) return sess.session_date >= todayIso;
            const end = new Date(`${sess.session_date}T${sess.session_time}`).getTime() + (sess.duration || 60) * 60000;
            return end > now;
        });

        document.getElementById('dc-session-strip')?.remove();
        if (!next) return;

        const attendees = next.group_session_attendees || [];
        const iAmIn = attendees.some(a => a.user_id === currentUser.id);
        const start = next.session_time ? new Date(`${next.session_date}T${next.session_time}`) : null;
        const isToday = next.session_date === todayIso;
        const whenTxt = (isToday ? 'Bugün' : new Date(next.session_date + 'T00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }))
            + (start ? ' ' + start.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '');
        const liveNow = start && now >= start.getTime() && now < start.getTime() + (next.duration || 60) * 60000;

        const strip = document.createElement('div');
        strip.id = 'dc-session-strip';
        strip.className = liveNow ? 'is-live' : '';
        strip.innerHTML = `
            <i class="fa-solid ${liveNow ? 'fa-circle-dot dc-ss-live-icon' : 'fa-calendar-day'}"></i>
            <div class="dc-ss-info">
                <span class="dc-ss-title">${liveNow ? '🔴 ŞU AN: ' : ''}${_escapeHtml(next.title)}</span>
                <span class="dc-ss-meta">${whenTxt} · ${next.duration || 60} dk · ${attendees.length} kişi varım dedi</span>
            </div>
            <button class="dc-ss-attend-btn${iAmIn ? ' is-in' : ''}">
                ${iAmIn ? '<i class="fa-solid fa-check"></i> Varsın' : '<i class="fa-solid fa-hand"></i> Varım'}
            </button>`;

        const header = document.getElementById('dc-chat-header');
        const area = document.getElementById('dc-chat-area');
        if (header && area && header.parentNode === area) header.insertAdjacentElement('afterend', strip);

        strip.querySelector('.dc-ss-attend-btn').addEventListener('click', async () => {
            if (iAmIn) {
                const { data, error } = await window.FocusSupabase.from('group_session_attendees')
                    .delete().eq('session_id', next.id).eq('user_id', currentUser.id).select();
                if (error || !data || data.length === 0) {
                    console.error('[Seans şeridi] katılım kaldırılamadı', error);
                    dcShowToast('Katılım kaldırılamadı, tekrar dene.', 'error');
                    return;
                }
            } else {
                const { data, error } = await window.FocusSupabase.from('group_session_attendees')
                    .upsert({ session_id: next.id, user_id: currentUser.id, username: currentUser.username }).select();
                if (error || !data || data.length === 0) {
                    console.error('[Seans şeridi] katılım kaydedilemedi', error);
                    dcShowToast('Katılım kaydedilemedi, tekrar dene.', 'error');
                    return;
                }
                dcShowToast('Seansa yazıldın — görüşürüz! ⚡', 'success');
            }
            // Bu şerit gscSessionsCache'ten bağımsız kendi fetch'ini kullanıyor — Takvim
            // sekmesiyle senkron kalması için oradaki cache'i de tazele (Faz 5: cache/render
            // artık social-group-details.js'te, window.__getGscSessionsCacheRef/window.gscRenderCalendar köprüsü).
            const _gscCacheForStrip = typeof window.__getGscSessionsCacheRef === 'function' ? window.__getGscSessionsCacheRef() : null;
            if (_gscCacheForStrip && _gscCacheForStrip[next.id]) {
                const cached = _gscCacheForStrip[next.id];
                cached.attendees = { ...(cached.attendees || {}) };
                if (iAmIn) delete cached.attendees[currentUser.username];
                else cached.attendees[currentUser.username] = {
                    userId: currentUser.id,
                    displayName: currentUser.displayName || currentUser.username,
                    avatarColor: currentUser.avatarColor || '6c5ce7',
                    customAvatar: currentUser.customAvatar || null,
                    checkedInAt: null
                };
                if (typeof window.gscRenderCalendar === 'function') window.gscRenderCalendar();
            }
            dcRenderSessionStrip(groupUuid);
        });
    } catch (e) { console.warn('[Seans şeridi] yüklenemedi', e); }
}
window.dcRenderSessionStrip = dcRenderSessionStrip;
