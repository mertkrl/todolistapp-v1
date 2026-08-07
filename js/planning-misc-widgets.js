import { CATEGORIES, deadlineLabel, getCat, progressRing } from './planning-utils.js';
import { isBlocked } from './planning-dependency-graph.js';
// planning-misc-widgets.js
// planning.js'ten çıkarıldı (Faz 6): Sabitler (STATUS_META), Grid View render,
// İstatistik Kartı, Animasyonlar, Push/Local Notification stub'ları — 5 ayrı
// küçük düşük-riskli blok, non-contiguous extraction, tek dosyada birleştirildi.
//
// Köprüler:
//  - STATUS_META: burada tanımlı, planning.js'in DETAIL PANEL bölümü
//    window.STATUS_META ile okuyor.
//  - esc/uid/_recalcProgress: planning.js'te zaten window'a atanmıştı.
//  - window._wzGetLessonPlanGroups(): planning.js'te zaten vardı (hoisting'e
//    dayanan bir bağımlılığı köprülemek için).
//  - window._deleteGoalWithUndo: planning.js'te zaten window'a atanmıştı.
//  - window.__getPgLoadedAtRef/__getPgRenderCountRef/__incPgRenderCountRef:
//    planning.js'te bu çıkarma için yeni eklendi (GridView bu state'i okuyup
//    _pgRenderCount'u artırıyor).
//  - getPgGoals(): planning.js'te zaten vardı (StatsCard için).
//  - renderStatsCard, _goalComplete, _sparkle: burada tanımlı, planning.js'in
//    geri kalanı tarafından window.* ile çağrılıyor (dışa açıldı).
import { esc, getPgLoadedAtRef, getPgRenderCountRef, incPgRenderCountRef, openDetailPanel, toggleArchive, deleteGoalWithUndo, getPgGoals, getPgActiveFilters, toast } from './planning.js';
import { MILESTONE_TEMPLATES, SUBTASK_SUGGESTIONS } from './planning-misc-widgets-templates.js';

    // ── Sabitler ──────────────────────────────
    // MILESTONE_TEMPLATES / SUBTASK_SUGGESTIONS → planning-misc-widgets-templates.js dosyasına taşındı.
    // CATEGORIES → planning-utils.js dosyasına taşındı.
    const STATUS_META = {
        active:    { label: 'Aktif',        color: '#4ade80' },
        paused:    { label: 'Duraklatıldı', color: '#ffd166' },
        completed: { label: 'Tamamlandı',   color: '#60a5fa' },
        archived:  { label: 'Arşivlendi',   color: '#555'    },
    };

    // ── GRID VIEW ────────────────────────────
    function _deadlineUrgency(dl) {
        if (!dl) return '';
        const diff = Math.ceil((new Date(dl) - new Date()) / 86400000);
        if (diff < 0)  return 'overdue';
        if (diff <= 7) return 'urgent';
        return '';
    }

    function cardHTML(g) {
        const cat=getCat(g.category), st=STATUS_META[g.status]||STATUS_META.active;
        const pct=g.progress_pct||0, ms=g.milestones||[];
        const msDone=ms.filter(m=>m.done).length, archived=g.status==='archived';
        const dl=deadlineLabel(g.deadline);
        const urgency  = archived ? '' : _deadlineUrgency(g.deadline);
        const blocked  = !archived && isBlocked(g.id);
        const priLabel=['','🔴 Yüksek','🟡 Orta','🟢 Düşük'][g.priority]||'';
        return `
        <div class="pg-card${archived?' pg-card-archived':''}${urgency?' pg-card-'+urgency:''}${blocked?' pg-card-blocked':''}" data-id="${g.id}">
            <div class="pg-card-stripe"></div>
            <div class="pg-card-body">
                <div class="pg-card-top-row">
                    <div class="pg-card-badges">
                        <span class="pg-cat-badge">${cat.icon} ${cat.label}</span>
                        <span class="pg-status-dot">● ${st.label}</span>
                        ${blocked?'<span class="pg-blocked-badge"><i class="ti ti-lock"></i> Bekliyor</span>':''}
                        ${g.context?.isTemplate?'<span class="pg-teacher-plan-badge" title="Bu bir ders planı şablonudur"><i class="ti ti-copy"></i> Şablon</span>':''}
                        ${(g.plan_mode==='lesson-plan' && !g.context?.isTemplate && !g.lpa_id)?(()=>{ const gName=(window._wzGetLessonPlanGroups()||[]).find(x=>x.id===g.context?.lessonPlanGroupId)?.name || 'Sınıf'; return g.context?.lessonPlanStudentId ? `<span class="pg-teacher-plan-badge" title="Kişiye özel ders planı"><i class="ti ti-user"></i> ${esc(gName)} — Kişiye Özel</span>` : `<span class="pg-teacher-plan-badge" title="Sınıfa özel ders planı"><i class="ti ti-users-group"></i> ${esc(gName)}</span>`; })():''}
                        ${g.pending_accept?'<span class="pg-teacher-plan-badge u-color-hFF9F1C_border-color-rgba25515928p35_background-rgba" title="Saatleri düzenliyorsun — henüz kabul etmedin, Ders Planları listesinden Kabul Et\'e basman gerekiyor" ><i class="ti ti-clock-pause"></i> Taslak — Kabul Bekliyor</span>':((g.lpa_id || (g.collab_room_id && g.my_role && g.my_role!=='owner'))?'<span class="pg-teacher-plan-badge" title="Bu plan sana atandı"><i class="ti ti-school"></i> Öğretmen Planı</span>':'')}
                        ${(()=>{ if (!g.collab_room_id) return ''; const online=window.PlanningCollab?.isActive()&&window.PlanningCollab.goalId===g.id ? Object.keys(window.PlanningCollab.onlineUsers||{}).length : 0; return `<span class="pg-collab-chip" title="Ortak Planlama Aktif">${online>0?`<span class="pg-collab-online-dot"></span> ${online} çevrimiçi`:'<i class="ti ti-users"></i> İşbirliği'}</span>`; })()}
                    </div>
                    ${progressRing(pct, cat.color)}
                </div>
                <h3 class="pg-card-title pg-card-open u-cursor-pointer" data-id="${g.id}" title="Detayları aç">${esc(g.title)}</h3>
                ${g.description?`<p class="pg-card-desc">${esc(g.description)}</p>`:''}
                <div class="pg-card-meta-row">
                    ${dl?`<span class="pg-meta-chip"><i class="ti ti-calendar-due"></i> ${dl}</span>`:''}
                    ${ms.length>0
                        ?`<span class="pg-meta-chip"><i class="ti ti-flag-3"></i> ${msDone}/${ms.length} milestone</span>`
                        :`<span class="pg-meta-chip u-opacity-p3" ><i class="ti ti-flag-3"></i> Milestone yok</span>`}
                    ${priLabel?`<span class="pg-meta-chip">${priLabel}</span>`:''}
                </div>
                <div class="pg-card-footer">
                    <button class="pg-act-btn pg-plan-btn" data-id="${g.id}">
                        <i class="ti ti-layout-board-split"></i> Planla
                    </button>
                    <div class="pg-act-right">
                        <button class="pg-icon-btn pg-edit-btn"    data-id="${g.id}" title="Düzenle"><i class="ti ti-pencil"></i></button>
                        <button class="pg-icon-btn pg-archive-btn" data-id="${g.id}" title="${archived?'Aktife Al':'Arşivle'}">
                            <i class="ti ti-${archived?'refresh':'archive'}"></i>
                        </button>
                        <button class="pg-icon-btn pg-delete-btn"  data-id="${g.id}" title="Sil"><i class="ti ti-trash"></i></button>
                    </div>
                </div>
            </div>
        </div>`;
    }

    function _applyCardColors(cardEl, g) {
        if (!cardEl) return;
        const cat = getCat(g.category), st = STATUS_META[g.status]||STATUS_META.active;
        const stripeEl = cardEl.querySelector('.pg-card-stripe');
        if (stripeEl) stripeEl.style.background = cat.color;
        const catBadge = cardEl.querySelector('.pg-cat-badge');
        if (catBadge) { catBadge.style.background = cat.color+'22'; catBadge.style.color = cat.color; catBadge.style.borderColor = cat.color+'44'; }
        const statusDot = cardEl.querySelector('.pg-status-dot');
        if (statusDot) statusDot.style.color = st.color;
        const planBtn = cardEl.querySelector('.pg-plan-btn');
        if (planBtn) { planBtn.style.background = cat.color+'18'; planBtn.style.borderColor = cat.color+'44'; planBtn.style.color = cat.color; }
    }

    function render() {
        const grid=document.getElementById('pg-cards-grid');
        const empty=document.getElementById('pg-empty-state');
        const statsEl=document.getElementById('pg-stats-bar');
        if (!grid) return;

        const statGoals=getPgGoals().filter(g=>g.plan_mode!=='lesson-plan');
        const activeCount=statGoals.filter(g=>g.status==='active').length;
        const doneCount=statGoals.filter(g=>g.status==='completed').length;
        const avgPct=statGoals.length ? Math.round(statGoals.reduce((s,g)=>s+(g.progress_pct||0),0)/statGoals.length) : 0;
        if (statsEl) statsEl.innerHTML=`
            <div class="pg-stat"><span class="pg-stat-n u-color-h4ade80" >${activeCount}</span><span class="pg-stat-l">Aktif Hedef</span></div>
            <div class="pg-stat-sep"></div>
            <div class="pg-stat"><span class="pg-stat-n u-color-var-ahD4900E" >${avgPct}%</span><span class="pg-stat-l">Ort. İlerleme</span></div>
            <div class="pg-stat-sep"></div>
            <div class="pg-stat"><span class="pg-stat-n u-color-h60a5fa" >${doneCount}</span><span class="pg-stat-l">Tamamlandı</span></div>`;

        let list = getPgGoals().filter(g => !g._pending_collab && g.plan_mode !== 'lesson-plan');
        const now = new Date();
        const isArchiveMode = getPgActiveFilters().has('__archived__');
        const isCompletedMode = getPgActiveFilters().has('__completed__');
        const isAllMode = !isArchiveMode && !isCompletedMode && getPgActiveFilters().size===1 && getPgActiveFilters().has('all');

        const matches = (g, filt) => {
            if (filt === '__overdue__') return g.status !== 'archived' && g.deadline &&
                Math.ceil((new Date(g.deadline) - now) / 86400000) < 0;
            if (filt === '__thisweek__') {
                if (g.status === 'archived' || !g.deadline) return false;
                const diff = Math.ceil((new Date(g.deadline) - now) / 86400000);
                return diff >= 0 && diff <= 7;
            }
            return g.category === filt; // kategori filtresi
        };

        if (isArchiveMode) {
            // Arşiv sadece manuel arşivlenmiş hedefleri gösterir — tamamlanmış (ama arşivlenmemiş)
            // hedefler normal listede kalır, ikisi ayrı kavramlardır.
            list = list.filter(g => g.status === 'archived');
        } else if (isCompletedMode) {
            // Başardıklarım — sadece tamamlanmış (ve arşivlenmemiş) hedefler
            list = list.filter(g => g.status === 'completed');
        } else {
            list = list.filter(g => g.status !== 'archived');
            if (!isAllMode) list = list.filter(g => [...getPgActiveFilters()].some(f => matches(g, f)));
        }

        list.sort((a,b)=>{
            if (a.status==='completed'&&b.status!=='completed') return 1;
            if (b.status==='completed'&&a.status!=='completed') return -1;
            return (a.priority||2)-(b.priority||2);
        });

        // Arşiv / Başardıklarım başlığı
        let archiveBanner = '';
        if (isArchiveMode) {
            const total = list.length;
            archiveBanner = `<div class="pg-archive-banner">
                <span class="pg-archive-banner-icon">🗄️</span>
                <div><div class="pg-archive-banner-title">Arşiv</div>
                <div class="pg-archive-banner-sub">${total} hedef arşivlendi</div></div>
            </div>`;
        } else if (isCompletedMode) {
            const total = list.length;
            archiveBanner = `<div class="pg-archive-banner">
                <span class="pg-archive-banner-icon">🏆</span>
                <div><div class="pg-archive-banner-title">Başardıklarım</div>
                <div class="pg-archive-banner-sub">${total} hedef tamamlandı</div></div>
            </div>`;
        }

        if (list.length===0) {
            if (isArchiveMode) {
                grid.innerHTML = archiveBanner + _pgEmptyCardHtml('🗄️', 'Henüz Arşivlenen Hedef Yok', 'Tamamladığın veya bıraktığın hedefleri arşivleyerek listeni sade tutabilirsin.');
            } else if (isCompletedMode) {
                grid.innerHTML = archiveBanner + _pgEmptyCardHtml('🏆', 'Henüz Tamamlanan Hedef Yok', 'Bir hedefi %100 bitirdiğinde otomatik olarak burada listelenir.');
            } else if (isAllMode) {
                grid.innerHTML = '';
            } else {
                // Akıllı/kategori filtresi (Gecikmiş, Bu Hafta, kategori...) sonucu boş —
                // önceden burası sessizce boş bırakılıyordu, kullanıcı hiçbir geri bildirim
                // görmüyordu. Seçili filtrelere göre uygun bir karşılama mesajı gösteriyoruz,
                // Arşiv/Başardıklarım'la aynı görsel dilde (_pgEmptyCardHtml).
                const isOverdueOnly = getPgActiveFilters().size === 1 && getPgActiveFilters().has('__overdue__');
                const isThisWeekOnly = getPgActiveFilters().size === 1 && getPgActiveFilters().has('__thisweek__');
                const activeLabels = [...document.querySelectorAll('.pg-filter-btn.active')]
                    .map(b => b.dataset.label).filter(Boolean);
                if (isOverdueOnly) {
                    grid.innerHTML = _pgEmptyCardHtml('🎉', 'Gecikmiş Hedefin Yok', 'Harika gidiyorsun — süresi geçmiş hiçbir hedefin yok, her şey zamanında ilerliyor.');
                } else if (isThisWeekOnly) {
                    grid.innerHTML = _pgEmptyCardHtml('🗓️', 'Bu Hafta Teslim Yok', 'Bu hafta son tarihi gelen bir hedefin bulunmuyor. Rahatsın, biraz nefes alabilirsin.');
                } else {
                    grid.innerHTML = _pgEmptyCardHtml('🔍', 'Bu Filtreye Uyan Hedef Yok',
                        activeLabels.length ? esc(activeLabels.join(', ')) + ' filtresine uyan bir hedef bulunamadı.' : 'Seçili filtreye uyan bir hedef bulunamadı.');
                }
            }
            _bindCardEvents(grid); // boş-durum kartındaki "Tümünü Gör" butonu için de gerekli
            if (empty) {
                const showEmpty = list.length===0 && isAllMode;
                empty.classList.toggle('hidden', !showEmpty);
                empty.style.display = showEmpty ? 'flex' : 'none';
            }
        } else {
            if (empty) { empty.classList.add('hidden'); empty.style.display='none'; }
            grid.innerHTML = archiveBanner + list.map(cardHTML).join('');
            grid.querySelectorAll('.pg-card').forEach((cardEl, cIdx) => _applyCardColors(cardEl, list[cIdx]));
            _bindCardEvents(grid);
            // NOT: sayfa açılışında localden bir kez, ~600ms sonra sunucu birleştirmesinden
            // ve ~1200ms sonra realtime abonelikten olmak üzere render() birkaç kez daha
            // otomatik çağrılıyor. Her çağrı grid.innerHTML'i TAMAMEN yeniden kurduğu için
            // kartlar yeni DOM elemanı oluyor ve .pg-card'ın giriş animasyonu (opacity:0'dan
            // başlayan) her seferinde yeniden oynuyordu — kullanıcı bunu "kart kayboluyor,
            // sonra geri geliyor" olarak görüyordu. İlk yüklemeden sonraki birkaç saniye
            // içindeki bu otomatik yeniden çizimlerde animasyonu bastırıyoruz.
            grid.classList.toggle('pg-no-card-anim', (Date.now() - getPgLoadedAtRef()) < 2500 && getPgRenderCountRef() > 0);
            incPgRenderCountRef();
        }
    }
    window.render = render;

    // Boş-durum kartı (Arşiv/Başardıklarım/Gecikmiş/Bu Hafta/filtre) — Ana
    // Hedefler'deki (script-goal-modal-list-utils.js buildEmptyCompletedStateHtml)
    // ile aynı görsel dil: glass-element kart, büyük emoji, başlık, açıklama,
    // "Tümünü Gör" CTA'sı (filtreleri sıfırlar). .u-grid-column-1-1 kartı grid
    // içinde tam genişliğe yayar, .pg-empty-card-wrap ise dikey olarak ortalar.
    function _pgEmptyCardHtml(icon, title, sub) {
        return `<div class="u-grid-column-1-1 pg-empty-card-wrap">
            <div class="glass-element u-text-align-center_padding-50px28px40px_border-1pxdashedrgb" >
                <div class="u-font-size-64px_margin-bottom-12px_line-height-1_filter-dro">${icon}</div>
                <h3 class="u-color-hfff_font-size-20px_font-weight-700_margin-bottom-8p">${title}</h3>
                <p class="u-color-var-text-muted_font-size-14px_max-width-340px_margin">${sub}</p>
                <button type="button" class="primary-btn u-margin-24pxauto0_justify-content-center_background-rgba254 pg-empty-reset-filter-btn">
                    <i class="fa-solid fa-list"></i> Tümünü Gör
                </button>
            </div>
        </div>`;
    }

    function _bindCardEvents(grid) {
        // Event delegation — tüm kart butonları tek listener ile
        if (grid._pgBound) return; // Sadece bir kez bağla
        grid._pgBound = true;
        grid.addEventListener('click', e => {
            const plan    = e.target.closest('.pg-plan-btn');
            const open    = e.target.closest('.pg-open-detail,.pg-card-open');
            const edit    = e.target.closest('.pg-edit-btn');
            const archive = e.target.closest('.pg-archive-btn');
            const del     = e.target.closest('.pg-delete-btn');
            const resetFilter = e.target.closest('.pg-empty-reset-filter-btn');
            if (plan)    { e.stopPropagation(); openPlanView(plan.dataset.id); }
            if (open)    { e.stopPropagation(); openDetailPanel(open.dataset.id); }
            if (edit)    { e.stopPropagation(); openGoalModal(edit.dataset.id); }
            if (archive) { e.stopPropagation(); toggleArchive(archive.dataset.id); }
            if (del)     { e.stopPropagation(); deleteGoalWithUndo(del.dataset.id); }
            if (resetFilter) { e.stopPropagation(); document.querySelector('.pg-filter-btn[data-cat="all"]')?.click(); }
        });
    }

    // ── İstatistik Kartı ──────────────────────
    function renderStatsCard() {
        const el = document.getElementById('pg-stats-card-body');
        if (!el) return;
        if (getPgGoals().length===0) {
            el.innerHTML='<p class="u-color-var-t2h888_font-size-13px">Henüz hedef yok.</p>'; return;
        }
        const active=getPgGoals().filter(g=>g.status==='active').length;
        const done=getPgGoals().filter(g=>g.status==='completed').length;
        const archived=getPgGoals().filter(g=>g.status==='archived').length;
        const totalMs=getPgGoals().reduce((s,g)=>(s+(g.milestones||[]).length),0);
        const doneMs=getPgGoals().reduce((s,g)=>(s+(g.milestones||[]).filter(m=>m.done).length),0);
        const avgPct=getPgGoals().length ? Math.round(getPgGoals().reduce((s,g)=>s+(g.progress_pct||0),0)/getPgGoals().length) : 0;

        const topGoals = getPgGoals().filter(g=>g.status!=='archived').sort((a,b)=>(b.progress_pct||0)-(a.progress_pct||0)).slice(0,5);

        el.innerHTML=`
        <div class="pg-stats-overview">
            <div class="pg-stats-mini"><div class="pg-stats-mini-n u-color-h4ade80" >${active}</div><div class="pg-stats-mini-l">Aktif</div></div>
            <div class="pg-stats-mini"><div class="pg-stats-mini-n u-color-h60a5fa" >${done}</div><div class="pg-stats-mini-l">Bitti</div></div>
            <div class="pg-stats-mini"><div class="pg-stats-mini-n u-color-var-ahD4900E" >${avgPct}%</div><div class="pg-stats-mini-l">Ort. İlerleme</div></div>
            <div class="pg-stats-mini"><div class="pg-stats-mini-n u-color-ha78bfa" >${doneMs}/${totalMs}</div><div class="pg-stats-mini-l">Milestone</div></div>
        </div>
        ${topGoals.length>0?`
        <div class="u-font-size-11px_font-weight-700_color-var-t2h888_text-trans">En İlerli Hedefler</div>
        ${topGoals.map((g,gIdx)=>{
            const cat=getCat(g.category);
            return `<div class="pg-stats-goal-row" data-topgoal-idx="${gIdx}">
                <div class="pg-stats-goal-dot"></div>
                <span class="pg-stats-goal-name">${esc(g.title)}</span>
                <div class="pg-stats-goal-bar-wrap"><div class="pg-stats-goal-bar"></div></div>
                <span class="pg-stats-goal-pct">${g.progress_pct||0}%</span>
            </div>`;
        }).join('')}` : ''}`;
        topGoals.forEach((g,gIdx) => {
            const cat = getCat(g.category);
            const rowEl = el.querySelector(`[data-topgoal-idx="${gIdx}"]`);
            if (!rowEl) return;
            const dotEl = rowEl.querySelector('.pg-stats-goal-dot');
            if (dotEl) dotEl.style.background = cat.color;
            const barEl = rowEl.querySelector('.pg-stats-goal-bar');
            if (barEl) { barEl.style.width = (g.progress_pct||0) + '%'; barEl.style.background = cat.color; }
        });
    }

    // ── Animasyonlar ──────────────────────────
    function _sparkle(el) {
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
        for (let i = 0; i < 8; i++) {
            const p = document.createElement('div');
            p.className = 'pg-sparkle';
            const angle = (i / 8) * 360;
            const dist  = 24 + Math.random() * 16;
            p.style.left = cx + 'px';
            p.style.top = cy + 'px';
            p.style.setProperty('--angle', angle + 'deg');
            p.style.setProperty('--dist', dist + 'px');
            p.style.background = ['#ffd166','#4ade80','#7c6eff','#ef476f','#60a5fa'][i%5];
            document.body.appendChild(p);
            setTimeout(() => p.remove(), 600);
        }
    }
    function _goalComplete(g) {
        const card = document.querySelector(`.pg-card[data-id="${g.id}"]`);
        if (card) { card.classList.add('pg-card-celebrate'); setTimeout(()=>card.classList.remove('pg-card-celebrate'),1200); }
        toast(`🏆 "${g.title}" tamamlandı! Harika iş!`, { duration: 4000 });
    }

    // ── 5.3 Dependency Graph ──────────────────
    // loadDependencies/saveDependencies/isBlocked/addDependency/removeDependency/
    // _wouldCreateCycle/_drawDependencyArrows planning-dependency-graph.js'e taşındı
    // (Faz 2, 2026-07-20) — window.loadDependencies/saveDependencies/
    // addPlanningDependency/removePlanningDependency/getPlanningDependencies/
    // isPlanningGoalBlocked köprüleriyle erişilir. Bu modül planning.js'ten ÖNCE
    // yüklenmeli (bkz. inline-module-loader.js) çünkü init() içinde
    // loadDependencies() senkron çağrılıyor.

    // ── 4.3 Push & Local Notifications ─────────
    window._notifyLocal = function _notifyLocal(title, body, tag) {
        if (Notification.permission !== 'granted') return;
        const icon = './icon-192.png';
        if (navigator.serviceWorker?.controller) {
            navigator.serviceWorker.ready.then(reg => {
                reg.showNotification(title, { body, icon, tag: tag || 'focusai-planning' });
            });
        } else {
            new Notification(title, { body, icon });
        }
    }

    window._requestNotificationPermission = async function _requestNotificationPermission() {
        if (!('Notification' in window) || Notification.permission === 'granted') return;
        if (Notification.permission !== 'denied') {
            try { await Notification.requestPermission(); }
            catch (e) { console.warn('[FocusAI] Notification.requestPermission:', e); }
        }
    }

    // _checkDeadlineNotifications, _debouncedRealtimeToast, _subscribeRealtime,
    // _handleGoalChange, _handleMilestoneChange -> planning-realtime.js dosyasına
    // taşındı (Faz 2, 2026-07-20). window._checkDeadlineNotifications/
    // _subscribeRealtime köprüleriyle erişilir.
    // ÖNEMLİ: init() bunları setTimeout/setInterval'e SENKRON referans olarak
    // veriyor, bu yüzden bu modül planning.js'ten ÖNCE yüklenmeli.


window.STATUS_META = STATUS_META;
window.renderStatsCard = renderStatsCard;
window._goalComplete = _goalComplete;
window._sparkle = _sparkle;

window.SUBTASK_SUGGESTIONS = SUBTASK_SUGGESTIONS;
