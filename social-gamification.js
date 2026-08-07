// social-gamification.js — XP/Lig/Sezon, Seri Yarışı, Grup İçi Mini-Turnuva
// social.js'ten çıkarıldı; ayrı top-level scope'ta çalışır, dışarıdaki paylaşılan
// yardımcılara (currentUser, _escapeHtml, avatarImgHtml, getLocalXP, vb.) window.X ile erişir.

    // ─── SUNUCU TARAFI XP (Faz A) ────────────────────────────
    // XP artık sunucuda hesaplanır (051_server_xp.sql — award_xp RPC'si).
    // Client tamamlanan öğeleri benzersiz ref'lerle olay olarak bildirir;
    // sunucu miktarı kendisi belirler, mükerrerleri reddeder, tavan uygular.
    // window.getLocalXP çevrimdışı/migration-öncesi görüntüleme yedeği olarak kalır.
import { getCurrentUser } from './state/current-user-store.js';
import { getMyServerXP, setMyServerXP } from './state/my-server-xp-store.js';
import { getMyLeagueState, setMyLeagueState } from './state/my-league-state-store.js';
import { getMySeasonState, setMySeasonState } from './state/my-season-state-store.js';
import { _bindEmptyStateCta } from './social-friends-notifications-leaderboard-render.js';
export { renderGroupTournament } from './social-gamification-tournament.js';
    setMyServerXP(null);

export function getServerXP() {
        return (typeof getMyServerXP() === 'number') ? getMyServerXP() : window.getLocalXP();
    }
    window.getServerXP = getServerXP;

    const _XP_QUEUE_KEY = 'xp_event_queue';     // gönderilmeyi bekleyen olaylar
    const _XP_AWARDED_KEY = 'xp_awarded_refs';  // sunucuya işlenmiş ref'ler
    const _XP_SEEDED_KEY = 'xp_awarded_seeded'; // ilk kurulum bayrağı
    let _xpFlushBusy = false;
    let _xpFlushTimer = null;

export function _xpGet(key, def) {
        try {
            return typeof FocusStorage !== 'undefined'
                ? FocusStorage.get(key, def)
                : (JSON.parse(localStorage.getItem('focusai_' + key), window._safeJsonReviver) ?? def);
        } catch { return def; }
    }
    window._xpGet = _xpGet;
export function _xpSet(key, val) {
        try {
            if (typeof FocusStorage !== 'undefined') FocusStorage.set(key, val);
            else localStorage.setItem('focusai_' + key, JSON.stringify(val));
        } catch {}
    }
    window._xpSet = _xpSet;

    // İlk kurulum: profiles.xp mevcut tamamlanmışları zaten içeriyor (eski
    // syncXP bunları yazmıştı). Aynı öğeleri olay olarak tekrar göndermek çift
    // sayım olurdu — o yüzden ilk çalıştırmada hepsi "işlenmiş" sayılır ve
    // yalnızca BUNDAN SONRAKİ tamamlamalar sunucuya olay olarak gider.
    function _xpSeedIfNeeded() {
        if (_xpGet(_XP_SEEDED_KEY, false)) return;
        const awarded = {};
        _xpCollectCompletedRefs().forEach(e => { awarded[e.kind + '|' + e.ref] = 1; });
        _xpSet(_XP_AWARDED_KEY, awarded);
        _xpSet(_XP_SEEDED_KEY, true);
    }

    // Tamamlanmış görev/alışkanlık/öne çıkanların {kind, ref} listesi
    function _xpCollectCompletedRefs() {
        const out = [];
        try {
            const tasks = typeof FocusStorage !== 'undefined'
                ? FocusStorage.get('tasks', [])
                : JSON.parse(localStorage.getItem('focusai_tasks') || '[]', window._safeJsonReviver);
            (Array.isArray(tasks) ? tasks : []).filter(t => t && t.completed && t.id != null)
                .forEach(t => out.push({ kind: t.parentHabit ? 'habit' : 'task', ref: 'task:' + t.id }));

            const hl = typeof FocusStorage !== 'undefined'
                ? FocusStorage.get('highlight_history', {})
                : JSON.parse(localStorage.getItem('focusai_highlight_history') || '{}', window._safeJsonReviver);
            Object.entries(hl || {}).filter(([, h]) => h && h.completed)
                .forEach(([date]) => out.push({ kind: 'highlight', ref: 'hl:' + date }));
        } catch {}
        return out;
    }

    window.FocusXP = {
        // Tek olay kuyruğa ekle (mükerrer koruması yerelde de var; sunucu son sözü söyler)
        award(kind, ref, minutes) {
            _xpSeedIfNeeded();
            const key = kind + '|' + ref;
            const awarded = _xpGet(_XP_AWARDED_KEY, {});
            if (awarded[key]) return;
            const queue = _xpGet(_XP_QUEUE_KEY, []);
            if (queue.some(e => e.kind === kind && e.ref === ref)) return;
            queue.push(minutes ? { kind, ref, minutes } : { kind, ref });
            _xpSet(_XP_QUEUE_KEY, queue);
            this.flushSoon();
        },
        // Odak seansı bitti: dakikalar olay olarak işlenir (seans başına benzersiz ref).
        // 057 sonrası bu yol yalnızca DOĞRULANMIŞ SEANSI OLMAYAN durumlarda (RPC
        // erişilemezse) yedek olarak kalır — sunucu 'focus' kolu artık
        // startFocusSession/finishFocusSession olmadan XP vermiyor (bkz. award_xp).
        awardFocus(minutes) {
            const m = Math.round(Number(minutes) || 0);
            if (m < 1) return;
            this.award('focus', 'focus:' + Date.now() + ':' + Math.random().toString(36).slice(2, 8), m);
        },
        // ─── Seans doğrulaması (057) ─────────────────────────────
        // Odak zamanlayıcısı başlarken çağrılır — started_at SUNUCU saatiyle
        // damgalanır (client geriye alamaz). Başarısız olursa null döner;
        // finishFocusSession bu durumda eski (artık XP vermeyen) yola düşer —
        // uygulama akışı bozulmaz, sadece o seans XP kazandırmaz.
        async startFocusSession() {
            if (!window.FocusSupabase || !getCurrentUser()?.id) return null;
            try {
                const { data, error } = await window.FocusSupabase.rpc('start_focus_session');
                if (error) throw error;
                return data || null;
            } catch { return null; }
        },
        // Odak zamanlayıcısı biterken (normal bitiş veya erken bitirme) çağrılır.
        // Ödüllenen dakika sunucuda min(beyan, gerçek geçen süre) olarak hesaplanır —
        // client artık gerçekte beklemediği bir süreyi XP'ye çeviremez.
        async finishFocusSession(sessionId, claimedMinutes) {
            const m = Math.round(Number(claimedMinutes) || 0);
            if (m < 1) return;
            if (!sessionId || !window.FocusSupabase || !getCurrentUser()?.id) {
                // Doğrulanmış seans yoksa eski yola düş (057 sonrası sunucu XP vermez,
                // ama en azından kuyruk/queue akışı tutarlı kalır).
                this.awardFocus(m);
                return;
            }
            try {
                const { data, error } = await window.FocusSupabase.rpc('finish_focus_session', {
                    p_session_id: sessionId, p_claimed_minutes: m
                });
                if (error) throw error;
                if (data && typeof data.xp === 'number') setMyServerXP(data.xp);
                if ((data?.awarded || 0) > 0) {
                    const arena = document.getElementById('dc-home-view');
                    if (arena && arena.offsetParent !== null && typeof window.renderHomeSummary === 'function') {
                        window.renderHomeSummary();
                    }
                }
            } catch (e) {
                console.warn('[XP] odak seansı doğrulanamadı', e);
            }
        },
        // ─── Etkileşim doğrulaması (059) ─────────────────────────
        // "Sekmeyi açık bırakıp beklemek" açığını kapatır: script.js gerçek
        // kullanıcı etkileşimi (fare/klavye/dokunma) gördüğü VE sekme görünür/
        // odaklıyken periyodik çağırır. Sunucu bunu active_seconds'e ekler;
        // finishFocusSession ödülü artık bununla da sınırlıdır (bkz. 059 migration).
        // Hata sessizce yutulur — heartbeat kaçırmak seansı bozmaz, sadece o
        // aralık ödül tavanına eklenmez.
        async heartbeat(sessionId) {
            if (!sessionId || !window.FocusSupabase || !getCurrentUser()?.id) return;
            try { await window.FocusSupabase.rpc('heartbeat_focus_session', { p_session_id: sessionId }); }
            catch {}
        },
        // Tüm tamamlama yollarını yakala: kayıtlı veriyi tara, yeni tamamlananları kuyruğa al
        scan() {
            _xpSeedIfNeeded();
            _xpCollectCompletedRefs().forEach(e => this.award(e.kind, e.ref));
        },
        flushSoon() {
            clearTimeout(_xpFlushTimer);
            _xpFlushTimer = setTimeout(() => this.flush(), 800);
        },
        async flush() {
            if (_xpFlushBusy || !window.FocusSupabase || !getCurrentUser()?.id || !navigator.onLine) return;
            const queue = _xpGet(_XP_QUEUE_KEY, []);
            if (!queue.length) return;
            _xpFlushBusy = true;
            try {
                const batch = queue.slice(0, 100);
                const { data, error } = await window.FocusSupabase.rpc('award_xp_batch', { p_events: batch });
                if (error || !data || data.error) return; // 051 uygulanmadıysa/çevrimdışıysa kuyrukta kalsın
                const okKeys = new Set((data.results || []).filter(r => r.ok).map(r => r.kind + '|' + r.ref));
                const awarded = _xpGet(_XP_AWARDED_KEY, {});
                okKeys.forEach(k => { awarded[k] = 1; });
                _xpSet(_XP_AWARDED_KEY, awarded);
                _xpSet(_XP_QUEUE_KEY, _xpGet(_XP_QUEUE_KEY, []).filter(e => !okKeys.has(e.kind + '|' + e.ref)));
                if (typeof data.xp === 'number') setMyServerXP(data.xp);
                if ((data.awarded || 0) > 0) {
                    // Arena açıksa skoru anında tazele
                    const arena = document.getElementById('dc-home-view');
                    if (arena && arena.offsetParent !== null && typeof window.renderHomeSummary === 'function') {
                        window.renderHomeSummary();
                    }
                }
            } catch (e) {
                console.warn('[XP] olay gönderimi başarısız — kuyrukta bekletiliyor', e);
            } finally { _xpFlushBusy = false; }
        }
    };

    // ─── HAFTALIK LİG SİSTEMİ (Faz 2) ────────────────────────
    // Haftalık XP = toplam XP - hafta başı anlık görüntüsü (week_xp_base).
    // Hafta pazartesi başlar; devrilme lazy yapılır: kullanıcı yeni haftada
    // ilk kez geldiğinde geçen haftanın sonucu hesaplanıp lige işlenir.
export const LEAGUES = [
        { id: 1, name: 'Bronz',  color: '#cd7f32', icon: 'fa-shield-halved' },
        { id: 2, name: 'Gümüş',  color: '#c0c4cc', icon: 'fa-shield-halved' },
        { id: 3, name: 'Altın',  color: '#feca57', icon: 'fa-shield-halved' },
        { id: 4, name: 'Platin', color: '#7bed9f', icon: 'fa-gem' },
        { id: 5, name: 'Elmas',  color: '#74b9ff', icon: 'fa-gem' }
    ];
    // Lig başına yükselme eşiği (haftalık XP) — üst liglerde çıta yükselir. Elmas son lig.
export const LEAGUE_PROMOTE_XP = [400, 500, 600, 700, Infinity];
    window.LEAGUE_PROMOTE_XP = LEAGUE_PROMOTE_XP;
    const LEAGUE_DEMOTE_XP = 150; // bu değerin altında kalan bir alt lige düşer (Bronz hariç)

export function leagueOf(id) { return LEAGUES[Math.min(Math.max((id || 1), 1), LEAGUES.length) - 1]; }
    window.leagueOf = leagueOf;

    // Sıralama kartının üst çubuğunu/köşe rengini kullanıcının o anki ligine göre temalar.
export function applyRankingsCardTheme(leagueId) {
        const card = document.querySelector('.bento-card--rankings');
        if (!card) return;
        card.style.setProperty('--rank-league-color', leagueOf(leagueId).color);
    }
    window.applyRankingsCardTheme = applyRankingsCardTheme;

    // İçinde bulunulan haftanın pazartesi tarihi, yerel saatle 'YYYY-MM-DD'
export function _leagueWeekStartIso(d = new Date()) {
        const x = new Date(d);
        x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); // Pzt=0
        return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
    }
    window._leagueWeekStartIso = _leagueWeekStartIso;

export function _leagueDaysLeft() {
        return 7 - ((new Date().getDay() + 6) % 7); // Pzt→7 ... Paz→1
    }
    window._leagueDaysLeft = _leagueDaysLeft;

    // Kendi haftalık durumum (renderHomeSummary/leaderboard "ben" satırı için)
    // { weekStart, base, league } — ensureWeeklyLeague doldurur.
    setMyLeagueState(null);

export function getMyWeeklyXP() {
        const st = getMyLeagueState();
        if (!st) return 0;
        return Math.max(0, getServerXP() - (st.base || 0));
    }
    window.getMyWeeklyXP = getMyWeeklyXP;

export async function ensureWeeklyLeague() {
        if (!window.FocusSupabase || !getCurrentUser()?.id) return;
        try {
            // Faz A: devrilme sunucuda hesaplanır (051 — league_rollover RPC).
            // Önce bekleyen XP olaylarını gönder ki geçen haftanın son seansları sayılsın.
            await window.FocusXP?.flush();
            const { data: r, error } = await window.FocusSupabase.rpc('league_rollover');
            if (error) { console.warn('[Lig] league_rollover RPC hatası', error.message); return; }
            if (!r || r.error) return;

            if (typeof r.xp === 'number') setMyServerXP(r.xp);
            setMyLeagueState({ weekStart: r.week_start, base: r.base || 0, league: r.league || 1 });
            applyRankingsCardTheme(getMyLeagueState().league);

            if (r.status !== 'rolled') return;

            // ── Hafta devrildi: sonucu duyur (toast + aktivite akışı) ──
            const weeklyXp = r.weekly_xp || 0;
            const L = leagueOf(r.league || 1);
            if (r.result === 'promote') {
                window.playNotificationSound('alert');
                if (typeof window.fireConfetti === 'function') window.fireConfetti();
                window.showGenericNotifToast({ icon: 'fa-trophy', accent: L.color, title: `${L.name} Ligi'ne yükseldin! 🏆`, body: `Geçen hafta ${weeklyXp} XP topladın. Yeni hafta başladı — çıtayı koru!` });
                // Akış içerik kararı (2026-07-05): kaldırıldı, sezon tamamlama zaten aynı bilgiyi taşıyor.
            } else if (r.result === 'demote') {
                // Negatif çerçeveleme yerine (Faz: pozitif rekabet) yeni ligi nötr bir
                // "yeniden başlangıç" olarak sun — "düştün" gibi başarısızlık dili yok.
                if (r.shielded) {
                    window.showGenericNotifToast({ icon: 'fa-shield-halved', accent: L.color, title: `${L.name} Ligi'nde korundun 🛡️`, body: `Geçen hafta ${weeklyXp} XP topladın — ligde yeni olduğun için bu hafta korumadasın. Bu hafta gaza bas!` });
                } else {
                    window.showGenericNotifToast({ icon: 'fa-flag-checkered', accent: L.color, title: `Yeni hafta: ${L.name} Ligi`, body: `Geçen hafta ${weeklyXp} XP topladın. Yeni hafta temiz sayfa — tekrar yükselmek senin elinde!` });
                }
            } else {
                window.showGenericNotifToast({ icon: 'fa-flag-checkered', accent: leagueOf(r.old_league || 1).color, title: 'Yeni lig haftası başladı', body: `Geçen hafta ${weeklyXp} XP topladın, ${leagueOf(r.old_league || 1).name} Ligi'nde kaldın.` });
            }
            if (typeof window.renderHomeSummary === 'function') window.renderHomeSummary();
        } catch (e) { console.warn('[Lig] haftalık devrilme kontrolü başarısız', e); }
    }
    window.ensureWeeklyLeague = ensureWeeklyLeague;

    // ─── SEZON SİSTEMİ (Faz C) ───────────────────────────────
    // Sezon = takvim ayı. Kapanış sunucuda lazy hesaplanır (052 — ensure_season
    // RPC'si): yeni ayda ilk gelen client kapanan sezon(lar)ı alır ve sezon
    // sonu ekranını gösterir. Sezon rozetleri season_results'tan türetilir.
    const _SEASON_MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
    setMySeasonState(null); // { season:'YYYY-MM', seasonXp } — geçmiş haftaların toplamı (bu hafta hariç)

export function _seasonLabel(seasonKey) {
        const [y, m] = String(seasonKey || '').split('-').map(Number);
        return m >= 1 && m <= 12 ? `${_SEASON_MONTHS[m - 1]} ${y}` : seasonKey;
    }
    window._seasonLabel = _seasonLabel;

export function _seasonDaysLeft() {
        const now = new Date();
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        return Math.max(1, Math.ceil((end - now) / 86400000));
    }
    window._seasonDaysLeft = _seasonDaysLeft;

export async function ensureSeason() {
        if (!window.FocusSupabase || !getCurrentUser()?.id) return;
        try {
            const { data: r, error } = await window.FocusSupabase.rpc('ensure_season');
            if (error || !r || r.error) return; // 052 uygulanmadıysa sezon bölümü sessizce pasif
            setMySeasonState({ season: r.current, seasonXp: r.season_xp || 0 });
            const closed = Array.isArray(r.closed) ? r.closed : [];
            if (closed.length) _showSeasonFinale(closed[closed.length - 1]);
            if (typeof window.renderHomeSummary === 'function') window.renderHomeSummary();
        } catch (e) { console.warn('[Sezon] kontrol başarısız', e); }
    }
    window.ensureSeason = ensureSeason;

    // Sezon sonu kapanış ekranı — ay biterken tek seferlik (sunucu sadece
    // sezonu kapatan ilk client'a döndürür, tekrar gösterilmez).
    function _showSeasonFinale(s) {
        if (!s) return;
        const L = leagueOf(s.best_league || 1);
        document.getElementById('season-finale-overlay')?.remove();
        const wrap = document.createElement('div');
        wrap.id = 'season-finale-overlay';
        wrap.className = 'modal-overlay';
        wrap.style.zIndex = '10096';
        wrap.innerHTML = `
            <div class="glass-element season-finale-box">
                <div class="season-finale-burst">🏁</div>
                <h3 class="season-finale-title">${window._escapeHtml(_seasonLabel(s.season))} Sezonu kapandı!</h3>
                <div class="season-finale-stats">
                    <div class="season-finale-stat">
                        <span class="sf-num">${s.total_xp || 0}</span>
                        <span class="sf-label">Sezon XP</span>
                    </div>
                    <div class="season-finale-stat">
                        <span class="sf-num sf-num--league"><i class="fa-solid ${L.icon}"></i> ${L.name}</span>
                        <span class="sf-label">En yüksek lig</span>
                    </div>
                    <div class="season-finale-stat">
                        <span class="sf-num">${s.weeks || 0}</span>
                        <span class="sf-label">Aktif hafta</span>
                    </div>
                </div>
                <p class="season-finale-sub">Bu sonuç kalıcı sezon geçmişine işlendi — rozet dolabında yerini aldı. Yeni sezon başladı, sayaçlar sıfır: zirve yeniden paylaşılıyor! 🚀</p>
                <button class="primary-btn u-width-100pct" data-close>Yeni Sezona Başla</button>
            </div>`;
        wrap.addEventListener('click', (e) => {
            if (e.target === wrap || e.target.closest('[data-close]')) wrap.remove();
        });
        wrap.querySelector('.sf-num--league').style.color = L.color;
        document.body.appendChild(wrap);
        window.playNotificationSound('alert');
        window.postActivity(`${_seasonLabel(s.season)} sezonunu ${L.name} Ligi'nde tamamladı! 🏁`);
    }


    // ─── SERİ YARIŞI (Faz 4) ─────────────────────────────────
    // Arkadaşlar arası odak serisi sıralaması — "zinciri kim daha uzun tutar".
    function _calcLocalStreak() {
        try {
            const fh = typeof FocusStorage !== 'undefined'
                ? (FocusStorage.get('focus_history', {}) || {})
                : JSON.parse(localStorage.getItem('focusai_focus_history') || '{}', window._safeJsonReviver);
            let streak = 0;
            const sd = new Date();
            if (!(Number(fh[window._dhsDateKey(sd)]) > 0)) sd.setDate(sd.getDate() - 1);
            while (Number(fh[window._dhsDateKey(sd)]) > 0) { streak++; sd.setDate(sd.getDate() - 1); }
            return streak;
        } catch { return 0; }
    }

    // Canlı Sıralama / Seri Yarışı / Bugünün Odağı — tek kart, sekmeyle geçilir
    // (2026-07-04, kullanıcı kararı). Render fonksiyonları değişmedi, sadece
    // hangi panelin görünür olduğu burada yönetiliyor.
    document.querySelectorAll('.rankings-tab-group [data-rankings-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.rankings-tab-group [data-rankings-tab]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const target = btn.dataset.rankingsTab;
            document.querySelectorAll('[data-rankings-panel]').forEach(panel => {
                const isTarget = panel.dataset.rankingsPanel === target;
                if (isTarget) {
                    panel.classList.remove('rankings-panel-hidden');
                    panel.classList.remove('rankings-panel-fade-out');
                } else if (!panel.classList.contains('rankings-panel-hidden')) {
                    panel.classList.add('rankings-panel-fade-out');
                    setTimeout(() => {
                        panel.classList.add('rankings-panel-hidden');
                        panel.classList.remove('rankings-panel-fade-out');
                    }, 180);
                }
            });
        });
    });

export function renderStreakRace(users) {
        const el = document.getElementById('streak-race-list');
        if (!el) return;
        const list = (users || []).map(u => ({
            ...u,
            streak: u.isMe ? Math.max(u.streak || 0, _calcLocalStreak()) : (u.streak || 0)
        })).sort((a, b) => (b.streak || 0) - (a.streak || 0));

        if (!list.length) {
            el.innerHTML = `
                <li class="lb-empty-card glass-element u-text-align-center_padding-50px28px40px_border-1pxdashedrgb">
                    <div class="u-font-size-64px_margin-bottom-12px_line-height-1_filter-dro">🔥</div>
                    <h3 class="u-color-hfff_font-size-20px_font-weight-700_margin-bottom-8p">Serini Kimseyle Yarıştırmıyorsun</h3>
                    <p class="u-color-var-text-muted_font-size-14px_max-width-340px_margin">
                        Arkadaşlarını ekle, günlük serilerinizi karşılaştırıp birbirinizi ateşleyin.
                    </p>
                    <button type="button" data-action="open-add-friend" class="primary-btn u-margin-24pxauto0_justify-content-center_background-rgba254">
                        <i class="fa-solid fa-user-plus"></i> Arkadaş Ekle
                    </button>
                </li>`;
            _bindEmptyStateCta(el);
            return;
        }
        const topStreak = Math.max(list[0]?.streak || 0, 1);
        el.innerHTML = list.map((u, i) => {
            const s = u.streak || 0;
            const flames = s >= 30 ? '🔥🔥🔥' : s >= 7 ? '🔥🔥' : s >= 1 ? '🔥' : '·';
            const pct = Math.max(2, Math.round((s / topStreak) * 100));
            return `
                <li class="lb-row${u.isMe ? ' lb-row--me' : ''}">
                    <span class="lb-rank">${i + 1}</span>
                    ${window.avatarImgHtml(u, 32, 'flex-shrink:0;')}
                    <div class="lb-main">
                        <div class="lb-name-line">
                            <span class="lb-name">${window._escapeHtml(u.displayName || u.username)}${u.isMe ? '<span class="lb-me-tag"> (Sen)</span>' : ''}</span>
                            <span class="lb-xp u-color-hff6b6b" >${flames} ${s} gün</span>
                        </div>
                        <div class="lb-bar"><div class="lb-bar-fill u-background-linear-gradient90degrgba2551071070p5hff6b6b" ></div></div>
                    </div>
                </li>`;
        }).join('');
        el.querySelectorAll('.lb-row').forEach((row, i) => {
            row.style.animationDelay = (Math.min(i, 15) * 35) + 'ms';
        });
        el.querySelectorAll('.lb-bar-fill').forEach((fill, i) => {
            const s = list[i]?.streak || 0;
            const pct = Math.max(2, Math.round((s / topStreak) * 100));
            fill.style.width = pct + '%';
        });
    }
    window.renderStreakRace = renderStreakRace;


    // Grup İçi Mini-Turnuva (premium özellik, 062) social-gamification-tournament.js'e çıkarıldı.

