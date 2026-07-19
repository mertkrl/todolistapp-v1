// ─── GÜNLÜK MİNİ REKABET ──────────────────────────────────
// Haftalık lig/sezon gibi büyük döngülerin yanına, her gece kendiliğinden
// sıfırlanan düşük riskli bir günlük sinyal: "bugün" filtresiyle sorgulandığı
// için ayrı bir reset mekanizması gerekmez (bkz. 061 migration).
let _dailyRaceBusy = false;
window._gtLastFetch = window._gtLastFetch || {}; // grup içi mini-turnuva kartı için grup başına son fetch zamanı
async function renderArenaDailyRace() {
    const el = document.getElementById('daily-race-list');
    if (!el || !window.FocusSupabase || !window.currentUser?.id) return;
    if (_dailyRaceBusy) return;
    _dailyRaceBusy = true;
    try {
        const { data, error } = await window.FocusSupabase.rpc('get_daily_friend_ranking');
        if (error || !data || data.status !== 'ok') { el.innerHTML = ''; return; } // 061 uygulanmadıysa sessizce gizli kal
        const rows = (data.rows || []).filter(r => (r.today_xp || 0) > 0 || r.is_me);
        if (!rows.length) {
            el.innerHTML = `<li style="text-align:center; color:var(--text-muted); font-size:13px; padding:20px;">Bugün henüz kimse odaklanmadı — ilk sen ol! ☀️</li>`;
            return;
        }
        const topXp = Math.max(rows[0]?.today_xp || 0, 1);
        el.innerHTML = rows.map((r, i) => {
            const xp = r.today_xp || 0;
            const pct = Math.max(2, Math.round((xp / topXp) * 100));
            const medal = i === 0 && xp > 0 ? '☀️' : '';
            return `
                <li class="lb-row${r.is_me ? ' lb-row--me' : ''}" style="animation-delay:${Math.min(i, 15) * 35}ms;">
                    <span class="lb-rank">${i + 1}</span>
                    ${window.avatarImgHtml({ displayName: r.display_name, username: r.username, avatarColor: r.avatar_color, customAvatar: r.custom_avatar, avatarInitials: r.avatar_initials || null }, 32, 'flex-shrink:0;')}
                    <div class="lb-main">
                        <div class="lb-name-line">
                            <span class="lb-name">${window._escapeHtml(r.display_name || r.username)}${r.is_me ? '<span class="lb-me-tag"> (Sen)</span>' : ''}</span>
                            <span class="lb-xp">${medal} ${xp} XP</span>
                        </div>
                        <div class="lb-bar"><div class="lb-bar-fill${r.is_me ? ' lb-bar-fill--me' : ''}" style="width:${pct}%"></div></div>
                    </div>
                </li>`;
        }).join('');
    } catch { el.innerHTML = ''; }
    finally { _dailyRaceBusy = false; }
}
window.renderArenaDailyRace = renderArenaDailyRace;
