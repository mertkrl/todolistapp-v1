// social-home-summary.js
// social.js'ten çıkarıldı (Faz E, 2026-07-23): Ana Sayfa özet şeridi
// (selamlama/mikro-öneri/lig kartı/sezon çizgisi) + Grup Hedefleri (Arena).
// _dhsDateKey/_dhsGreetingSuggestion/renderHomeSummary/
// _updateArenaActionEmptyState/getLocalXP/renderArenaGroupGoals.
//
// Dış bağımlılıklar (window.* üzerinden): window.currentUser, window._escapeHtml,
// window.playNotificationSound, window.showGenericNotifToast, window.postActivity,
// window.renderArenaDailyRace, window.getMyWeeklyXP, window.leagueOf,
// window.LEAGUE_PROMOTE_XP, window._leagueDaysLeft, window._mySeasonState,
// window._seasonLabel, window._seasonDaysLeft, window._leagueWeekStartIso,
// window._xpGet/_xpSet, window.dcOpenGroupPanel, window.formatFocusMinutes,
// window._toggleOnlinePeoplePopover, window.switchTab,
// window._onlineFriendsPresenceCb, window._refreshMyAssignmentsBadge,
// window._myLeagueState, window.FocusSupabase.
(function () {
'use strict';

    // ─── ÖZETİM ŞERİDİ (Ana Sayfa / tek panel home görünümü) ────
    // Kullanıcının kişisel özetini çizer: bugün/bu hafta odak, seri, XP,
    // 7 günlük mini grafik ve arkadaşlar arası sıra (pozitif rekabet).
    // NOT (pre-existing, dokunulmadı): social-friends-notifications.js kendi
    // sloppy-mode global `_lastUsersSnapshot`'ını yazıyor (window üzerinden,
    // 'use strict' yok o dosyada) — bu, buradaki closure-local değişkenden
    // FARKLI, hiç senkronize olmuyor. Taşımadan önce de aynı davranıştı.
    let _lastUsersSnapshot = {};

    function _dhsDateKey(d) {
        return String(d.getDate()).padStart(2,'0') + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + d.getFullYear();
    }
    window._dhsDateKey = _dhsDateKey; // social-gamification.js gibi ayrı script scope'larından erişim için
    // Saat dilimi + bugünkü ilerlemeye göre selamlama şeridindeki mikro-öneriyi
    // ve CTA'yı belirler. Gece geç saatte yeni seans yerine yarını planlamaya
    // yönlendirir; gündüz odaklanılmamışsa doğrudan seansı başlatmaya iter.
    function _dhsGreetingSuggestion(hour, todayMin) {
        if (todayMin > 0) {
            if (hour >= 22 || hour < 5) {
                return { sub: `Bugün ${todayMin} dk odaklandın — harika iş, dinlenme vakti 🌙`, cta: null, action: null };
            }
            return { sub: `Bugün ${todayMin} dk odaklandın — devam!`, cta: 'Yeni seans başlat', action: 'start' };
        }
        if (hour < 6) {
            return { sub: 'Gece geç oldu — yarın için kısa bir seans planla.', cta: 'Yarını planla', action: 'plan' };
        }
        if (hour < 12) {
            return { sub: 'Güne enerjik başla — ilk seansını şimdi yap!', cta: 'Seansı başlat', action: 'start' };
        }
        if (hour < 18) {
            return { sub: 'Öğleden sonra odaklanmak için henüz geç değil.', cta: 'Seansı başlat', action: 'start' };
        }
        if (hour < 22) {
            return { sub: 'Günü kapatmadan kısa bir seans dene.', cta: 'Seansı başlat', action: 'start' };
        }
        return { sub: 'Bugün henüz odaklanmadın — yarın için plan yap.', cta: 'Yarını planla', action: 'plan' };
    }

    function renderHomeSummary() {
        const el = document.getElementById('dc-home-summary');
        if (!el) return;

        let fh = {};
        try {
            fh = typeof FocusStorage !== 'undefined'
                ? (FocusStorage.get('focus_history', {}) || {})
                : JSON.parse(localStorage.getItem('focusai_focus_history') || '{}');
        } catch { fh = {}; }

        // Bugün/bu hafta/seri kartları kaldırıldı (2026-07-03, kullanıcı kararı:
        // bu veriler İstatistikler sekmesinde zaten var) — greeting mesajı için
        // yalnızca bugünkü dakika gerekiyor.
        const todayMin = Number(fh[_dhsDateKey(new Date())]) || 0;

        const myWeekly = window.getMyWeeklyXP();

        // Arkadaşlar arası sıra — pozitif rekabetin kalbi (haftalık XP üzerinden)
        let rankInfo = null;
        try {
            const entries = Object.entries(_lastUsersSnapshot || {}).map(([u, d]) => ({ username: u, ...d }));
            if (window.currentUser && entries.length >= 2) {
                const sorted = entries
                    .filter(e => e.username !== window.currentUser.username)
                    .concat([{ username: window.currentUser.username, weeklyXp: myWeekly }])
                    .sort((a, b) => (b.weeklyXp || 0) - (a.weeklyXp || 0) || (b.xp || 0) - (a.xp || 0));
                const idx = sorted.findIndex(u => u.username === window.currentUser.username);
                if (idx !== -1) {
                    const ahead = idx > 0 ? sorted[idx - 1] : null;
                    rankInfo = {
                        rank: idx + 1, total: sorted.length,
                        aheadName: ahead ? (ahead.displayName || ahead.username) : null,
                        aheadXp: ahead ? (ahead.weeklyXp || 0) : null,
                        gap: ahead ? Math.max(0, (ahead.weeklyXp || 0) - myWeekly) : 0
                    };
                }
            }
        } catch {}

        const hour = new Date().getHours();
        const greet = hour < 6 ? 'İyi geceler' : hour < 12 ? 'Günaydın' : hour < 18 ? 'İyi günler' : 'İyi akşamlar';
        const name = window.currentUser ? (window.currentUser.displayName || window.currentUser.username) : '';
        const suggestion = _dhsGreetingSuggestion(hour, todayMin);

        // ── 1. Selamlama şeridi (sade — istatistikler ayrı bölümde) ──
        // "Çevrimiçi" rozeti (2026-07-03): eskiden her zaman görünen "Arkadaşlar"
        // kartının yerini aldı — sıra rozetinin SOLUNDA durur, tıklayınca "Kişiler"
        // panelini açar (bkz. _toggleOnlinePeoplePopover). Sayaç/nokta rengini
        // subscribeOnlineFriends() dolduruyor; ücretsiz olmayan planda CSS ile
        // gizli (body:not(.dc-chat-disabled)).
        // Selamlama alt satırı (2026-07-05): saat dilimine + bugünkü ilerlemeye göre
        // değişen mikro-öneri metni + tıklanabilir CTA (bkz. _dhsGreetingSuggestion) —
        // eskiden sabit "İlk seansı başlat!" metniydi, artık aksiyona yönlendiriyor.
        el.innerHTML = `
            <div class="dc-home-summary-inner">
                <div class="dhs-greeting">
                    <span class="dhs-greeting-title">${greet}${name ? ', ' + window._escapeHtml(name) : ''} 👋</span>
                    <span class="dhs-greeting-sub">
                        <span>${suggestion.sub}</span>
                        ${suggestion.cta ? `<button id="dhs-greeting-cta" class="dhs-greeting-cta" type="button">${suggestion.cta} →</button>` : ''}
                    </span>
                </div>
                <button id="dhs-online-badge" class="dhs-rank-badge dhs-rank-badge--big dhs-online-badge" type="button" title="Kişiler">
                    <i class="fa-solid fa-circle" id="dhs-online-dot" style="font-size:8px;"></i>
                    <span id="dhs-online-count">0</span> Çevrimiçi
                </button>
                ${rankInfo ? `<div class="dhs-rank-badge dhs-rank-badge--big"><i class="fa-solid fa-trophy"></i> ${rankInfo.rank}. sıradasın</div>` : ''}
            </div>`;

        document.getElementById('dhs-online-badge')?.addEventListener('click', (e) => {
            e.stopPropagation();
            window._toggleOnlinePeoplePopover(e.currentTarget);
        });
        document.getElementById('dhs-greeting-cta')?.addEventListener('click', () => {
            if (typeof window.switchTab === 'function') window.switchTab(suggestion.action === 'plan' ? 'planlama' : 'zamanlayici');
        });
        // Rozet az önce yeniden oluşturuldu (innerHTML replace) — sayaç/nokta
        // sıfırlandı; presence dinleyicisi zaten kuruluysa hemen tazele.
        if (typeof window._onlineFriendsPresenceCb === 'function') window._onlineFriendsPresenceCb();
        // "Aktif Ödev" rozeti kaldırıldı (kullanıcı isteği, 2026-07-13) — ama
        // _refreshMyAssignmentsBadge() çağrısı KALMALI: window.FocusAssignments.items
        // burada dolduruluyor ve script.js'teki Bugün/Takvim görünümleri bu veriyi
        // kullanıyor (bkz. fonksiyonun başındaki yorum, social.js:664).
        if (typeof window._refreshMyAssignmentsBadge === 'function') window._refreshMyAssignmentsBadge();

        // ── 2. Performans bölümü (rekabet odaklı, animasyonlu) ──
        let statsEl = document.getElementById('dc-home-stats');
        if (!statsEl) {
            statsEl = document.createElement('div');
            statsEl.id = 'dc-home-stats';
            el.insertAdjacentElement('afterend', statsEl);
        }

        // Lig kartı verileri
        const _st = window._myLeagueState;
        const myLeague = window.leagueOf(_st?.league || 1);
        const promoteAt = window.LEAGUE_PROMOTE_XP[(_st?.league || 1) - 1];
        const leaguePct = isFinite(promoteAt) ? Math.min(100, Math.round((myWeekly / promoteAt) * 100)) : 100;
        const daysLeft = window._leagueDaysLeft();

        // ── Sadeleştirme (2026-07-03): Bugün/Bu hafta/Odak serisi kartları da
        //    kaldırıldı (kullanıcı kararı: İstatistikler sekmesinde zaten var).
        //    Geriye tek kart kalıyor: Lig — Arena'ya özgü, başka sekmede yok.
        const seasonLine = window._mySeasonState
            ? `<div class="dhs-stat-sub dhs-stat-sub--secondary"><i class="fa-solid fa-flag-checkered"></i> ${window._escapeHtml(window._seasonLabel(window._mySeasonState.season))} sezonu: <b>${(window._mySeasonState.seasonXp || 0) + myWeekly} XP</b> · ${window._seasonDaysLeft()} gün kaldı</div>`
            : '';

        statsEl.innerHTML = `
            <div class="dhs-stats-grid">
                <div class="dhs-stat-card dhs-anim dhs-stat-card--league" style="--i:0; --league-color:${myLeague.color};">
                    <div class="dhs-stat-head"><i class="fa-solid ${myLeague.icon}" style="color:${myLeague.color};"></i> Lig · <b>${myWeekly} XP</b> bu hafta</div>
                    <div class="dhs-stat-big dhs-league-name" style="color:${myLeague.color};">${myLeague.name}</div>
                    <div class="dhs-progress"><div class="dhs-progress-fill" data-w="${leaguePct}" style="background:linear-gradient(90deg, ${myLeague.color}88, ${myLeague.color});"></div></div>
                    <div class="dhs-stat-sub">${isFinite(promoteAt)
                        ? `Yükselmek için <b>${Math.max(0, promoteAt - myWeekly)} XP</b> kaldı · <b>${daysLeft} gün</b>`
                        : `En üst ligdesin — zirveyi koru! 👑 · <b>${daysLeft} gün</b>`}</div>
                    ${seasonLine}
                </div>
            </div>`;

        // ── Animasyonlar: sayı sayacı + progress dolumu ──
        statsEl.querySelectorAll('.dhs-count').forEach(cEl => {
            const target = Number(cEl.dataset.target) || 0;
            const dur = 800;
            const t0 = performance.now();
            const tick = (t) => {
                const p = Math.min(1, (t - t0) / dur);
                const eased = 1 - Math.pow(1 - p, 3);
                cEl.textContent = Math.round(target * eased);
                if (p < 1) requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
        });
        requestAnimationFrame(() => requestAnimationFrame(() => {
            statsEl.querySelectorAll('.dhs-progress-fill').forEach(f => { f.style.width = f.dataset.w + '%'; });
        }));

        // Arena'nın diğer bölümlerini de tazele
        window.renderArenaDailyRace();
    }
    window.renderHomeSummary = renderHomeSummary;

    // ─── TEK "EYLEM" BÖLGESİ (Sadeleştirme B, 2026-07-03) ───────
    // Meydan Okuma/Düello/Grup Hedefi üçü de tek ortak başlık altında (bkz.
    // index.html #arena-action-zone); her biri veri yoksa hiç render edilmez
    // (kendi boş-durum metnini basmaz). Üçü de boşsa tek ortak mesaj (#arena-
    // action-empty) gösterilir. Üç render fonksiyonu da finally bloğunda bunu
    // çağırır — hangisi en son biterse DOM'un güncel halini görür.
    function _updateArenaActionEmptyState() {
        const empty = document.getElementById('arena-action-empty');
        if (!empty) return;
        const anyContent = ['arena-group-goals']
            .some(id => document.getElementById(id)?.innerHTML.trim());
        empty.style.display = anyContent ? 'none' : '';
    }

    function getLocalXP() {
        try {
            const tasks = typeof FocusStorage !== 'undefined'
                ? FocusStorage.get('tasks', [])
                : JSON.parse(localStorage.getItem('focusai_tasks') || '[]');

            let xp = 0;
            (Array.isArray(tasks) ? tasks : [])
                .filter(t => t.completed)
                .forEach(t => { xp += t.parentHabit ? 15 : 10; });

            const hl = typeof FocusStorage !== 'undefined'
                ? FocusStorage.get('highlight_history', {})
                : JSON.parse(localStorage.getItem('focusai_highlight_history') || '{}');
            Object.values(hl || {}).filter(h => h.completed).forEach(() => { xp += 20; });

            const fm = typeof FocusStorage !== 'undefined'
                ? FocusStorage.get('total_focus_minutes', 0)
                : parseInt(localStorage.getItem('focusai_total_focus_minutes') || '0');
            xp += (fm || 0) * 2;

            return xp;
        } catch { return 0; }
    }
    window.getLocalXP = getLocalXP; // social-gamification.js gibi ayrı script scope'larından erişim için

    // ─── GRUP HEDEFLERİ (Faz B) ──────────────────────────────
    // Grupların haftalık ortak hedefi (groups.weekly_goal, dk cinsinden) zaten
    // vardı ama grup panelinde gömülüydü — Arena'da kart olarak öne çıkarılır.
    // İlerleme, RLS-güvenli group_weekly_leaderboard RPC'sinden (035) okunur.
    let _arenaGoalsRenderBusy = false;

    async function renderArenaGroupGoals() {
        const el = document.getElementById('arena-group-goals');
        if (!el || !window.FocusSupabase || !window.currentUser?.id) return;
        if (_arenaGoalsRenderBusy) return;
        _arenaGoalsRenderBusy = true;
        try {
            const { data: rows, error } = await window.FocusSupabase
                .from('group_members').select('groups(id, name, code, weekly_goal)')
                .eq('user_id', window.currentUser.id);
            if (error) { el.innerHTML = ''; return; }
            const myGroups = (rows || []).map(r => r.groups).filter(g => g && (g.weekly_goal || 0) > 0);
            if (!myGroups.length) { el.innerHTML = ''; return; }

            const stats = await Promise.all(myGroups.map(g =>
                window.FocusSupabase.rpc('group_weekly_leaderboard', { p_group_id: g.id })
                    .then(r => r.data || []).catch(() => [])
            ));

            // Kazanma-görünürlüğü tutarlılığı (2026-07-04): düello kazanma ve lig
            // yükselmesi ses+toast+aktivite akışıyla kutlanıyordu ama grup hedefi
            // tamamlanması SESSİZ kalıyordu — üç rekabet mekanizması arasında
            // tutarsızlık. Grup başarısı bireysel utandırma riski taşımadığı için
            // (herkesin ortak başarısı) her zaman herkese açık kutlanır — dedup
            // localStorage'da (grup, hafta) bazında, aynı hafta tekrar tetiklenmez.
            const _thisGoalWeek = window._leagueWeekStartIso();
            const _celebrated = window._xpGet('group_goal_celebrated', {});
            let _celebratedChanged = false;

            // Fikir A (2026-07-03): kart yerine tek satır — ilerleme çubuğu satırın
            // altında ince bir çizgi olarak kalıyor, katkı bilgisi meta satırında.
            el.innerHTML = myGroups.map((g, i) => {
                const rowsG = stats[i];
                const total = rowsG.reduce((s, r) => s + (r.weekly_minutes || 0), 0);
                const mine = rowsG.find(r => r.user_id === window.currentUser.id)?.weekly_minutes || 0;
                const pct = Math.min(100, Math.round((total / g.weekly_goal) * 100));
                const done = total >= g.weekly_goal;

                if (done && _celebrated[g.id] !== _thisGoalWeek) {
                    _celebrated[g.id] = _thisGoalWeek;
                    _celebratedChanged = true;
                    window.playNotificationSound('alert');
                    window.showGenericNotifToast({ icon: 'fa-bullseye', accent: '#2ed573', title: 'Grup hedefi tamamlandı! 🎯', body: `"${window._escapeHtml(g.name)}" bu haftaki ${window.formatFocusMinutes(g.weekly_goal)} hedefine ulaştı.` });
                    window.postActivity(`"${g.name}" grubu haftalık hedefini tamamladı! 🎯`);
                }

                return `
                    <div class="arena-row arena-row--goal${done ? ' arena-row--done' : ''}" data-gcode="${window._escapeHtml(g.code || '')}">
                        <span class="arena-row-icon"><i class="fa-solid fa-bullseye" style="color:#2ed573;"></i></span>
                        <div class="arena-row-main">
                            <span class="arena-row-title">${window._escapeHtml(g.name)}</span>
                            <span class="arena-row-meta">${done ? '✓ Tamamlandı' : `%${pct}`} · ${window.formatFocusMinutes(total)} / ${window.formatFocusMinutes(g.weekly_goal)} · katkın ${window.formatFocusMinutes(mine)}</span>
                            <div class="arena-row-bar"><div class="arena-row-bar-fill${done ? ' arena-row-bar-fill--done' : ''}" style="width:${Math.max(4, pct)}%"></div></div>
                        </div>
                    </div>`;
            }).join('');

            if (_celebratedChanged) window._xpSet('group_goal_celebrated', _celebrated);

            el.querySelectorAll('.arena-row--goal[data-gcode]').forEach(c => c.addEventListener('click', () => {
                if (c.dataset.gcode && typeof window.dcOpenGroupPanel === 'function') window.dcOpenGroupPanel(c.dataset.gcode);
            }));
        } finally { _arenaGoalsRenderBusy = false; _updateArenaActionEmptyState(); }
    }
    window.renderArenaGroupGoals = renderArenaGroupGoals;

})();

// Diğer social-*.js modüllerinin import edebilmesi için ince sarmalayıcı export'lar.
export const _dhsDateKey = window._dhsDateKey;
export const getLocalXP = window.getLocalXP;
