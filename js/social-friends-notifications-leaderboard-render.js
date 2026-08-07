// social-friends-notifications-leaderboard-render.js
// social-friends-notifications.js'ten çıkarıldı (Faz H/O devamı): arkadaş liderlik
// tablosunun saf render yardımcıları — renderMostImprovedBadge/computeRankDeltas/
// renderLeaderboard hepsi SADECE parametre alır (visibleUsers/scope+sortedUsers/
// users+container), paylaşılan _lastUsersSnapshot/getCurrentUser gibi state'e
// dokunmaz. _lastRankByScope bu üçlünün kendi iç durumu olduğu için burada kaldı.
// Dış bağımlılıklar: _escapeHtml/avatarImgHtml (window global), leagueOf
// (social-gamification.js), _applyDynStyles (bu dosyada, root parametresi alan saf yardımcı).
import { leagueOf } from './social-gamification.js';

// Sıralama/Seri boş durum kartlarındaki "Arkadaş Ekle" CTA'sı — event delegasyonu
// ile container'a bir kez bağlanır (renderLeaderboard/renderStreakRace her
// çağrıda innerHTML'i tamamen yeniden kurduğu için doğrudan bağlanan bir
// listener her render'da kaybolurdu). Mevcut "Kişi Ekle" akışını (#dc-add-dm-btn
// tıklaması — giriş yoksa kurulum modalını, varsa arkadaş ekleme modalını açar)
// olduğu gibi tetikler, mantığı tekrar etmez.
export function _bindEmptyStateCta(container) {
    if (!container || container._lbEmptyCtaBound) return;
    container._lbEmptyCtaBound = true;
    container.addEventListener('click', (e) => {
        if (!e.target.closest('[data-action="open-add-friend"]')) return;
        document.getElementById('dc-add-dm-btn')?.click();
    });
}

function _applyDynStyles(root) {
    if (!root) return;
    root.querySelectorAll('[data-dyn-bg]').forEach(el => { el.style.backgroundColor = el.getAttribute('data-dyn-bg'); });
    root.querySelectorAll('[data-dyn-color]').forEach(el => { el.style.color = el.getAttribute('data-dyn-color'); });
    root.querySelectorAll('[data-dyn-bdc]').forEach(el => { el.style.borderLeftColor = el.getAttribute('data-dyn-bdc'); });
    root.querySelectorAll('[data-dyn-mt]').forEach(el => { el.style.marginTop = el.getAttribute('data-dyn-mt'); });
    root.querySelectorAll('[data-dyn-w]').forEach(el => { el.style.width = el.getAttribute('data-dyn-w'); });
    root.querySelectorAll('[data-dyn-delay]').forEach(el => { el.style.animationDelay = el.getAttribute('data-dyn-delay'); });
    root.querySelectorAll('[data-dyn-bordercolor]').forEach(el => { el.style.borderColor = el.getAttribute('data-dyn-bordercolor'); });
}

// "Bu Haftanın En Çok Gelişeni" — mutlak XP değil, geçen haftaya göre artışı
// ödüllendirir (pozitif rekabet: zaten üstte olan sürekli kazanmasın, herkesin
// şansı olsun). Grup tarafındaki "Yükselen Yıldız" rozetiyle aynı mantık (bkz.
// gscSessionsCache yakınındaki addBadge çağrıları), burada arkadaş listesine uyarlandı.
export function renderMostImprovedBadge(visibleUsers) {
    const el = document.getElementById('leaderboard-improved-badge');
    if (!el) return;
    const candidates = visibleUsers
        .filter(u => typeof u.prevWeeklyXp === 'number' && u.weeklyXp > 0)
        .map(u => ({ ...u, _delta: u.weeklyXp - u.prevWeeklyXp }))
        .filter(u => u._delta > 0)
        .sort((a, b) => b._delta - a._delta);

    if (candidates.length < 1 || visibleUsers.length < 2) {
        el.classList.add('hidden');
        el.innerHTML = '';
        return;
    }
    const best = candidates[0];
    const name = best.isMe ? 'Sen' : _escapeHtml(best.displayName || best.username);
    el.classList.remove('hidden');
    el.innerHTML = `<span class="lb-improved-icon">🚀</span> Bu haftanın en çok gelişeni: <span class="lb-improved-name">${name}</span> — geçen haftaya göre +${best._delta} XP`;
}

// Sıra değişim oku (B2): bir önceki render'a göre kimin yükselip kimin
// düştüğünü tespit eder. İlk render'da (önceki harita boşsa) ok gösterilmez.
const _lastRankByScope = { friends: {}, league: {} };
export function computeRankDeltas(scope, sortedUsers) {
    const prev = _lastRankByScope[scope];
    const hadPrev = Object.keys(prev).length > 0;
    const next = {};
    const withDelta = sortedUsers.map((u, i) => {
        const prevRank = prev[u.username];
        const delta = (hadPrev && prevRank !== undefined) ? (prevRank - i) : 0;
        next[u.username] = i;
        return { ...u, _rankDelta: delta };
    });
    _lastRankByScope[scope] = next;
    return withDelta;
}

// Canlı Sıralama — podyum/madalya yok; her satırda lidere göre XP dolum çubuğu,
// kendi satırında bir öndekiyle arasındaki fark rozeti (pozitif rekabet vurgusu).
export function renderLeaderboard(users, container) {
    if (!users.length) {
        container.innerHTML = `
            <li class="lb-empty-card glass-element u-text-align-center_padding-50px28px40px_border-1pxdashedrgb">
                <div class="u-font-size-64px_margin-bottom-12px_line-height-1_filter-dro">🏆</div>
                <h3 class="u-color-hfff_font-size-20px_font-weight-700_margin-bottom-8p">Henüz Sıralamada Yalnızsın</h3>
                <p class="u-color-var-text-muted_font-size-14px_max-width-340px_margin">
                    Arkadaşlarını ekle, haftalık XP yarışına katıl ve kim daha odaklı görelim.
                </p>
                <button type="button" data-action="open-add-friend" class="primary-btn u-margin-24pxauto0_justify-content-center_background-rgba254">
                    <i class="fa-solid fa-user-plus"></i> Arkadaş Ekle
                </button>
            </li>`;
        _bindEmptyStateCta(container);
        return;
    }
    const topXp = Math.max(users[0]?.weeklyXp || 0, 1);
    container.innerHTML = users.map((u, i) => {
        const wxp = u.weeklyXp || 0;
        const pct = Math.max(2, Math.round((wxp / topXp) * 100));
        const ahead = i > 0 ? users[i - 1] : null;
        const gap = ahead ? Math.max(0, (ahead.weeklyXp || 0) - wxp) : 0;
        const gapChip = u.isMe && ahead
            ? `<span class="lb-gap-chip"><i class="fa-solid fa-bolt"></i> ${gap} XP kaldı</span>`
            : (u.isMe ? '<span class="lb-gap-chip lb-gap-chip--leader"><i class="fa-solid fa-crown"></i> Lidersin</span>' : '');
        const L = leagueOf(u.league);
        const leagueBadge = `<span class="lb-league-badge" data-dyn-color="${L.color}" data-dyn-bordercolor="${L.color}44" data-dyn-bg="${L.color}1a" title="${L.name} Ligi"><i class="fa-solid ${L.icon}"></i> ${L.name}</span>`;

        const zoneClass = u._zone === 'promo' ? ' lb-row--promo' : (u._zone === 'demo' ? ' lb-row--demo' : '');
        const rankDeltaChip = u._rankDelta > 0
            ? `<span class="lb-rank-delta lb-rank-delta--up"><i class="fa-solid fa-caret-up"></i></span>`
            : (u._rankDelta < 0 ? `<span class="lb-rank-delta lb-rank-delta--down"><i class="fa-solid fa-caret-down"></i></span>` : '');
        return `
            <li class="lb-row${u.isMe ? ' lb-row--me' : ''}${zoneClass}" data-dyn-delay="${Math.min(i, 15) * 35}ms">
                <span class="lb-rank">${i + 1}</span>
                ${avatarImgHtml(u, 32, 'flex-shrink:0;')}
                <div class="lb-main">
                    <div class="lb-name-line">
                        ${rankDeltaChip}
                        <span class="lb-name">${_escapeHtml(u.displayName || u.username)}${u.isMe ? '<span class="lb-me-tag"> (Sen)</span>' : ''}</span>
                        ${leagueBadge}
                        ${gapChip}
                        <span class="lb-xp" title="Bu haftaki XP — toplam ${u.xp || 0} XP">${wxp} XP</span>
                    </div>
                    <div class="lb-bar"><div class="lb-bar-fill${u.isMe ? ' lb-bar-fill--me' : ''}" data-dyn-w="${pct}%"></div></div>
                </div>
            </li>`;
    }).join('');
    _applyDynStyles(container);
}
