// ─── GÜNLÜK MİNİ REKABET ──────────────────────────────────
// Haftalık lig/sezon gibi büyük döngülerin yanına, her gece kendiliğinden
// sıfırlanan düşük riskli bir günlük sinyal: "bugün" filtresiyle sorgulandığı
// için ayrı bir reset mekanizması gerekmez (bkz. 061 migration).
import { avatarImgHtml } from './social-avatar-utils.js';
import { getCurrentUser } from '../state/current-user-store.js';

let _dailyRaceBusy = false;
window._gtLastFetch = window._gtLastFetch || {}; // grup içi mini-turnuva kartı için grup başına son fetch zamanı
async function renderArenaDailyRace() {
    const el = document.getElementById('daily-race-list');
    if (!el || !window.FocusSupabase || !getCurrentUser()?.id) return;
    if (_dailyRaceBusy) return;
    _dailyRaceBusy = true;
    try {
        const { data, error } = await window.FocusSupabase.rpc('get_daily_friend_ranking');
        if (error || !data || data.status !== 'ok') { el.innerHTML = ''; return; } // 061 uygulanmadıysa sessizce gizli kal
        const rows = (data.rows || []).filter(r => (r.today_xp || 0) > 0 || r.is_me);
        if (!rows.length) {
            el.innerHTML = `<li class="u-text-align-center_color-var-text-muted_font-size-13px_padd">Bugün henüz kimse odaklanmadı — ilk sen ol! ☀️</li>`;
            return;
        }
        const topXp = Math.max(rows[0]?.today_xp || 0, 1);
        el.innerHTML = rows.map((r, i) => {
            const xp = r.today_xp || 0;
            const pct = Math.max(2, Math.round((xp / topXp) * 100));
            const medal = i === 0 && xp > 0 ? '☀️' : '';
            return `
                <li class="lb-row${r.is_me ? ' lb-row--me' : ''}" data-race-idx="${i}">
                    <span class="lb-rank">${i + 1}</span>
                    ${avatarImgHtml({ displayName: r.display_name, username: r.username, avatarColor: r.avatar_color, customAvatar: r.custom_avatar, avatarInitials: r.avatar_initials || null }, 32, 'flex-shrink:0;')}
                    <div class="lb-main">
                        <div class="lb-name-line">
                            <span class="lb-name">${window._escapeHtml(r.display_name || r.username)}${r.is_me ? '<span class="lb-me-tag"> (Sen)</span>' : ''}</span>
                            <span class="lb-xp">${medal} ${xp} XP</span>
                        </div>
                        <div class="lb-bar"><div class="lb-bar-fill${r.is_me ? ' lb-bar-fill--me' : ''}"></div></div>
                    </div>
                </li>`;
        }).join('');
        el.querySelectorAll('.lb-row').forEach(li => {
            const i = parseInt(li.dataset.raceIdx, 10);
            li.style.animationDelay = (Math.min(i, 15) * 35) + 'ms';
            const r = rows[i];
            const xp = r.today_xp || 0;
            const pct = Math.max(2, Math.round((xp / topXp) * 100));
            const barFill = li.querySelector('.lb-bar-fill');
            if (barFill) barFill.style.width = pct + '%';
        });
    } catch { el.innerHTML = ''; }
    finally { _dailyRaceBusy = false; }
}
window.renderArenaDailyRace = renderArenaDailyRace;
