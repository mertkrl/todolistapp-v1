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

    // ── Sabitler ──────────────────────────────
    // ── Milestone Şablonları (kategori bazlı) ─
    const MILESTONE_TEMPLATES = {
        egitim: [
            { title: 'A1 Başlangıç',      icon: '📖', weeks: 8 },
            { title: 'A2 Temel Seviye',   icon: '📚', weeks: 8 },
            { title: 'B1 Orta Seviye',    icon: '🎯', weeks: 12 },
            { title: 'B2 İleri Seviye',   icon: '🚀', weeks: 16 },
            { title: 'Kurs Tamamla',       icon: '🎓', weeks: 10 },
            { title: 'Sertifika Sınavı',  icon: '📜', weeks: 4 },
            { title: 'Proje Yap',          icon: '🛠️', weeks: 8 },
            { title: 'Mentor Bul',         icon: '🤝', weeks: 2 },
        ],
        saglik: [
            { title: 'Doktor Muayenesi',      icon: '🏥', weeks: 1 },
            { title: 'Beslenme Planı Hazırla', icon: '🥗', weeks: 2 },
            { title: 'İlk 5K Koş',            icon: '🏃', weeks: 8 },
            { title: '10K Hedefine Ulaş',      icon: '🏅', weeks: 16 },
            { title: 'Hedef Kiloya Ulaş',      icon: '⚖️', weeks: 20 },
            { title: 'Yoga Rutini Kur',        icon: '🧘', weeks: 4 },
            { title: 'Uyku Düzeni Oluştur',   icon: '😴', weeks: 3 },
            { title: 'Spor Alışkanlığı Edin',  icon: '💪', weeks: 12 },
        ],
        kariyer: [
            { title: 'CV Güncelle',        icon: '📄', weeks: 1 },
            { title: 'Profesyonel Ağ Kur', icon: '🤝', weeks: 8 },
            { title: 'Yeni Beceri Öğren',  icon: '💡', weeks: 12 },
            { title: 'Portföy Hazırla',    icon: '🗂️', weeks: 6 },
            { title: 'İş Başvuruları',     icon: '📮', weeks: 8 },
            { title: 'Mülakat Hazırlığı',  icon: '💼', weeks: 4 },
            { title: 'Terfi Hedefle',      icon: '📈', weeks: 24 },
            { title: 'Freelance Başla',    icon: '🖥️', weeks: 12 },
        ],
        finans: [
            { title: 'Bütçe Planı Yap',    icon: '📊', weeks: 1 },
            { title: 'Acil Fon Oluştur',   icon: '🏦', weeks: 24 },
            { title: 'Borç Öde',           icon: '💳', weeks: 16 },
            { title: 'İlk Yatırım Yap',    icon: '📈', weeks: 12 },
            { title: '%10 Tasarruf Hedefi', icon: '💰', weeks: 8 },
            { title: 'Ek Gelir Kaynağı',   icon: '💹', weeks: 20 },
        ],
        kisisel: [
            { title: 'Yeni Hobi Başlat',     icon: '🎨', weeks: 4 },
            { title: 'Meditasyon Alışkanlığı',icon: '🧘', weeks: 4 },
            { title: 'Seyahat Planla',       icon: '✈️', weeks: 12 },
            { title: '12 Kitap Oku',         icon: '📚', weeks: 52 },
            { title: 'Sosyal Çevre Genişlet',icon: '👥', weeks: 8 },
            { title: 'Dijital Detoks',       icon: '📵', weeks: 2 },
        ],
        diger: [
            { title: 'Araştırma Yap',  icon: '🔍', weeks: 2 },
            { title: 'Plan Oluştur',   icon: '📋', weeks: 1 },
            { title: 'Kaynak Topla',   icon: '📦', weeks: 3 },
            { title: 'Uygula',         icon: '⚡', weeks: 8 },
            { title: 'Değerlendir',    icon: '📊', weeks: 2 },
            { title: 'Sonuçlandır',    icon: '🏁', weeks: 2 },
        ],
    };

    const SUBTASK_SUGGESTIONS = {
        egitim: ['Ders programı oluştur', 'Kaynak listesi hazırla', 'Çalışma ortamı düzenle', 'İlerlemeyi takip et', 'Pratik yap'],
        saglik: ['Doktora danış', 'Beslenme günlüğü tut', 'Egzersiz programı oluştur', 'Haftalık ölçüm al'],
        kariyer: ['Araştırma yap', 'Mentor bul', 'Network oluştur', 'Günlük hedef belirle', 'Geri bildirim al'],
        finans: ['Mevcut durumu analiz et', 'Bütçe oluştur', 'Tasarruf hesabı aç', 'Harcamaları takip et'],
        kisisel: ['Motivasyon kaynağı bul', 'Haftalık plan yap', 'İlerleme günlüğü tut', 'Destek al'],
        diger:   ['Araştırma yap', 'Plan oluştur', 'Adım adım ilerle', 'Değerlendir'],
    };

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
        const cat=window.getCat(g.category), st=STATUS_META[g.status]||STATUS_META.active;
        const pct=g.progress_pct||0, ms=g.milestones||[];
        const msDone=ms.filter(m=>m.done).length, archived=g.status==='archived';
        const dl=window.deadlineLabel(g.deadline);
        const urgency  = archived ? '' : _deadlineUrgency(g.deadline);
        const blocked  = !archived && window.isPlanningGoalBlocked(g.id);
        const priLabel=['','🔴 Yüksek','🟡 Orta','🟢 Düşük'][g.priority]||'';
        return `
        <div class="pg-card${archived?' pg-card-archived':''}${urgency?' pg-card-'+urgency:''}${blocked?' pg-card-blocked':''}" data-id="${g.id}">
            <div class="pg-card-stripe" style="background:${cat.color};"></div>
            <div class="pg-card-body">
                <div class="pg-card-top-row">
                    <div class="pg-card-badges">
                        <span class="pg-cat-badge" style="background:${cat.color}22;color:${cat.color};border-color:${cat.color}44;">${cat.icon} ${cat.label}</span>
                        <span class="pg-status-dot" style="color:${st.color};">● ${st.label}</span>
                        ${blocked?'<span class="pg-blocked-badge"><i class="ti ti-lock"></i> Bekliyor</span>':''}
                        ${g.context?.isTemplate?'<span class="pg-teacher-plan-badge" title="Bu bir ders planı şablonudur"><i class="ti ti-copy"></i> Şablon</span>':''}
                        ${(g.plan_mode==='lesson-plan' && !g.context?.isTemplate && !g.lpa_id)?(()=>{ const gName=(window._wzGetLessonPlanGroups()||[]).find(x=>x.id===g.context?.lessonPlanGroupId)?.name || 'Sınıf'; return g.context?.lessonPlanStudentId ? `<span class="pg-teacher-plan-badge" title="Kişiye özel ders planı"><i class="ti ti-user"></i> ${esc(gName)} — Kişiye Özel</span>` : `<span class="pg-teacher-plan-badge" title="Sınıfa özel ders planı"><i class="ti ti-users-group"></i> ${esc(gName)}</span>`; })():''}
                        ${g.pending_accept?'<span class="pg-teacher-plan-badge" title="Saatleri düzenliyorsun — henüz kabul etmedin, Ders Planları listesinden Kabul Et\'e basman gerekiyor" style="color:#FF9F1C;border-color:rgba(255,159,28,.35);background:rgba(255,159,28,.1);"><i class="ti ti-clock-pause"></i> Taslak — Kabul Bekliyor</span>':((g.lpa_id || (g.collab_room_id && g.my_role && g.my_role!=='owner'))?'<span class="pg-teacher-plan-badge" title="Bu plan sana atandı"><i class="ti ti-school"></i> Öğretmen Planı</span>':'')}
                        ${(()=>{ if (!g.collab_room_id) return ''; const online=window.PlanningCollab?.isActive()&&window.PlanningCollab.goalId===g.id ? Object.keys(window.PlanningCollab.onlineUsers||{}).length : 0; return `<span class="pg-collab-chip" title="Ortak Planlama Aktif">${online>0?`<span class="pg-collab-online-dot"></span> ${online} çevrimiçi`:'<i class="ti ti-users"></i> İşbirliği'}</span>`; })()}
                    </div>
                    ${window.progressRing(pct, cat.color)}
                </div>
                <h3 class="pg-card-title pg-card-open" data-id="${g.id}" style="cursor:pointer;" title="Detayları aç">${esc(g.title)}</h3>
                ${g.description?`<p class="pg-card-desc">${esc(g.description)}</p>`:''}
                <div class="pg-card-meta-row">
                    ${dl?`<span class="pg-meta-chip"><i class="ti ti-calendar-due"></i> ${dl}</span>`:''}
                    ${ms.length>0
                        ?`<span class="pg-meta-chip"><i class="ti ti-flag-3"></i> ${msDone}/${ms.length} milestone</span>`
                        :`<span class="pg-meta-chip" style="opacity:.3;"><i class="ti ti-flag-3"></i> Milestone yok</span>`}
                    ${priLabel?`<span class="pg-meta-chip">${priLabel}</span>`:''}
                </div>
                <div class="pg-card-footer">
                    <button class="pg-act-btn pg-plan-btn" data-id="${g.id}" style="background:${cat.color}18;border-color:${cat.color}44;color:${cat.color};">
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
            <div class="pg-stat"><span class="pg-stat-n" style="color:#4ade80;">${activeCount}</span><span class="pg-stat-l">Aktif Hedef</span></div>
            <div class="pg-stat-sep"></div>
            <div class="pg-stat"><span class="pg-stat-n" style="color:var(--a,#D4900E);">${avgPct}%</span><span class="pg-stat-l">Ort. İlerleme</span></div>
            <div class="pg-stat-sep"></div>
            <div class="pg-stat"><span class="pg-stat-n" style="color:#60a5fa;">${doneCount}</span><span class="pg-stat-l">Tamamlandı</span></div>`;

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
            grid.innerHTML = isArchiveMode
                ? `${archiveBanner}<div class="pg-ms-empty" style="padding:40px;"><i class="ti ti-archive"></i><br>Henüz arşivlenen hedef yok.</div>`
                : isCompletedMode
                    ? `${archiveBanner}<div class="pg-ms-empty" style="padding:40px;"><i class="ti ti-trophy"></i><br>Henüz tamamlanan hedef yok.</div>`
                    : '';
            if (empty) empty.style.display = list.length===0 && isAllMode ? 'flex' : 'none';
        } else {
            if (empty) empty.style.display='none';
            grid.innerHTML = archiveBanner + list.map(cardHTML).join('');
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
            if (plan)    { e.stopPropagation(); openPlanView(plan.dataset.id); }
            if (open)    { e.stopPropagation(); openDetailPanel(open.dataset.id); }
            if (edit)    { e.stopPropagation(); openGoalModal(edit.dataset.id); }
            if (archive) { e.stopPropagation(); toggleArchive(archive.dataset.id); }
            if (del)     { e.stopPropagation(); deleteGoalWithUndo(del.dataset.id); }
        });
    }

    // ── İstatistik Kartı ──────────────────────
    function renderStatsCard() {
        const el = document.getElementById('pg-stats-card-body');
        if (!el) return;
        if (getPgGoals().length===0) {
            el.innerHTML='<p style="color:var(--t2,#888);font-size:13px;">Henüz hedef yok.</p>'; return;
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
            <div class="pg-stats-mini"><div class="pg-stats-mini-n" style="color:#4ade80;">${active}</div><div class="pg-stats-mini-l">Aktif</div></div>
            <div class="pg-stats-mini"><div class="pg-stats-mini-n" style="color:#60a5fa;">${done}</div><div class="pg-stats-mini-l">Bitti</div></div>
            <div class="pg-stats-mini"><div class="pg-stats-mini-n" style="color:var(--a,#D4900E);">${avgPct}%</div><div class="pg-stats-mini-l">Ort. İlerleme</div></div>
            <div class="pg-stats-mini"><div class="pg-stats-mini-n" style="color:#a78bfa;">${doneMs}/${totalMs}</div><div class="pg-stats-mini-l">Milestone</div></div>
        </div>
        ${topGoals.length>0?`
        <div style="font-size:11px;font-weight:700;color:var(--t2,#888);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;">En İlerli Hedefler</div>
        ${topGoals.map(g=>{
            const cat=window.getCat(g.category);
            return `<div class="pg-stats-goal-row">
                <div class="pg-stats-goal-dot" style="background:${cat.color};"></div>
                <span class="pg-stats-goal-name">${esc(g.title)}</span>
                <div class="pg-stats-goal-bar-wrap"><div class="pg-stats-goal-bar" style="width:${g.progress_pct||0}%;background:${cat.color};"></div></div>
                <span class="pg-stats-goal-pct">${g.progress_pct||0}%</span>
            </div>`;
        }).join('')}` : ''}`;
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
            p.style.cssText = `left:${cx}px;top:${cy}px;--angle:${angle}deg;--dist:${dist}px;
                background:${['#ffd166','#4ade80','#7c6eff','#ef476f','#60a5fa'][i%5]};`;
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
    // window.loadDependencies() senkron çağrılıyor.

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
