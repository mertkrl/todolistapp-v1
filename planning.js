/* ════════════════════════════════════════════
   FocusAI — Planlama Modülü  (Faz 1 + 2 + 3)
   ════════════════════════════════════════════ */
(function () {
    'use strict';

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

    // ── State ─────────────────────────────────
    const _pgLoadedAt = Date.now();
    let _pgRenderCount = 0;
    let goals        = [];
    let dependencies  = [];  // [{from:goalId, to:goalId}]
    // planning-dependency-graph.js modülüne taşınan fonksiyonların bu diziyi
    // okuyup (referans — push/find çalışır) ve yeniden atayabilmesi (filter/
    // JSON.parse reassignment) için köprü.
    window._pgGetDependencies = () => dependencies;
    window._pgSetDependencies = (arr) => { dependencies = arr; };
    let activeFilters = new Set(['all']); // çoklu seçim — 'all' ve '__archived__' birbirini dışlar, diğerleri serbestçe birleşir
    const CATEGORY_KEYS = ['egitim','saglik','kariyer','finans','kisisel','diger'];
    let editingId    = null;
    let detailGoalId = null;
    // planning-realtime.js modülünün detay paneli açık mı diye bakabilmesi için köprü.
    window._pgGetDetailGoalId = () => detailGoalId;

    // Wizard state (wizardState/_wzCalYear/_wzCalMonth) planning-milestone-wizard.js'e
    // taşındı (Faz 2, 2026-07-20) — planning.js'in başka hiçbir yerinde kullanılmıyordu.

    // ── Storage ───────────────────────────────
    function loadGoals() {
        goals = (typeof FocusStorage !== 'undefined')
            ? FocusStorage.get('planning_goals', [])
            : JSON.parse(localStorage.getItem('planning_goals') || '[]');
    }

    // 4.1 — Supabase'den hedef + milestone'ları çek, localStorage ile birleştir
    async function loadGoalsFromServer() {
        if (!window.FocusSupabase || !window.currentUser) return;
        const sb = window.FocusSupabase, uid = window.currentUser.id;
        try {
            const { data: gData } = await sb.from('planning_goals')
                .select('*').eq('user_id', uid).order('created_at', { ascending: false });
            if (!gData || !gData.length) return;

            const { data: msData } = await sb.from('planning_milestones')
                .select('*').eq('user_id', uid).order('order_index', { ascending: true });

            // Server goals ile localStorage'ı birleştir (server öncelikli)
            gData.forEach(sg => {
                const local = goals.find(g => g.id === sg.id);
                const serverMs = (msData || []).filter(m => m.goal_id === sg.id).map(m => ({
                    id: m.id, title: m.title, due_date: m.due_date || '',
                    start_date: m.start_date || '',
                    start_time: m.start_time || '', end_time: m.end_time || '',
                    is_task_mirror: !!m.is_task_mirror,
                    done: !!m.done, order: m.order_index,
                    description: m.description || '', created_at: m.created_at,
                }));
                const merged = {
                    ...(local || {}), ...sg,
                    milestones: serverMs.length ? serverMs : (local?.milestones || []),
                    // Supabase'de null olan ama localStorage'da olan alanları koru
                    collab_room_id: local?.collab_room_id || sg.collab_room_id || null,
                    invite_code:    local?.invite_code    || null,
                    my_role:        local?.my_role        || null,
                    lpa_id:         local?.lpa_id         || null,
                    // plan_mode/context eski kayıtlarda (102 migration'dan önce yazılmış) sunucuda
                    // hâlâ boş olabilir — yerel değeri koru ki ders planı kopyası "bireysel plan"a dönmesin.
                    plan_mode:      sg.plan_mode || local?.plan_mode || null,
                    context:        (sg.context && Object.keys(sg.context).length ? sg.context : local?.context) || null,
                    _dirty: false,
                };
                if (local) {
                    const idx = goals.indexOf(local);
                    goals[idx] = merged;
                } else {
                    goals.push(merged);
                }
            });
            persistGoals();
            render();
            // PlanView açıksa yeni server verisiyle yeniden render et
            if (pvGoalId) {
                const gLive = goals.find(x => x.id === pvGoalId);
                if (gLive) _pvRender(gLive);
            }
            if (typeof window.renderPlanningStats === 'function') window.renderPlanningStats();
        } catch (_) { console.warn('[FocusAI] sessiz hata:', _); }
    }

    // Bekleyen ders planı davetleri artık Planlama sayfasında genel bir kutu olarak
    // gösterilmiyor — sadece ilgili sınıfın Sınıf Paneli > Ders Planı sekmesinde
    // (bkz. renderStudentLessonPlanInvitesForGroup) ve bildirim tıklamasında görünür.
    // Kabul/revize/red fonksiyonları ve kart markup'ı (_lpaInviteCardHTML,
    // _bindLpaInviteCard, renderStudentLessonPlanInvitesForGroup,
    // _toggleLessonPlanPreview, _promptLessonPlanNote, _lpaDiscardDraft,
    // _requestLessonPlanRevision, _rejectLessonPlanInvite) planning-lesson-plan-invites.js
    // dosyasına taşındı (Faz 2, 2026-07-20) — window.* köprüsüyle erişilebilirler.
    // _acceptLessonPlanInvite ise PlanView çakışma çözümü sistemine çok bağımlı
    // olduğu için burada kaldı (bkz. window._acceptLessonPlanInvite köprüsü, aşağıda).

    // ── Kabul: saatli aşamaları klonlar, kendi mevcut görevleriyle çakışma
    // varsa önce çözüm ekranı açar (öğrenci kendi görevini VEYA öğretmenin
    // planındaki görevi taşıyabilir — öğretmenin planındaki görevler
    // silinemez, günü değiştirilemez, sadece o gün içindeki saati değişir).
    // Çakışma yoksa/çözülünce: yeni hedef + aşamalar kaydedilir VE saatli
    // aşamalar aynı zamanda `tasks`'a da yazılır ki Bugün/Takvim'de görünsün.
    function _lpaTimeToMin(t) { const [h, m] = (t || '0:00').split(':').map(Number); return h * 60 + (m || 0); }
    function _lpaOverlap(aStart, aEnd, bStart, bEnd) {
        let s1 = _lpaTimeToMin(aStart), e1 = _lpaTimeToMin(aEnd || aStart); if (e1 <= s1) e1 = 24 * 60;
        let s2 = _lpaTimeToMin(bStart), e2 = _lpaTimeToMin(bEnd || bStart); if (e2 <= s2) e2 = 24 * 60;
        return s1 < e2 && e1 > s2;
    }
    function _lpaFindConflicts(clonedMs) {
        const myTasks = FocusStorage.get('tasks', []);
        const conflicts = [];
        clonedMs.forEach(ms => {
            if (!ms.due_date || !ms.start_time) return;
            const clash = myTasks.find(t => t.timeStart && t.timeEnd && _normYMD(t.date) === ms.due_date
                && _lpaOverlap(ms.start_time, ms.end_time, t.timeStart, t.timeEnd));
            if (clash) conflicts.push({ ms, task: clash });
        });
        return conflicts;
    }

    // Kabul öncesi ilk uyarı: detaylı çözüm ekranı yerine kısa, profesyonel bir
    // bildirim — kullanıcı ister hemen düzenlesin, ister planı olduğu gibi kabul
    // edip daha sonra düzeltsin.
    function _lpaShowSimpleConflictWarning(conflicts, { onEdit, onLater }) {
        const overlay = document.createElement('div');
        overlay.className = 'pg-pv-conflict-overlay';
        overlay.innerHTML = `
            <div class="pg-pv-conflict-box">
                <div class="pg-pv-conflict-icon"><i class="ti ti-alert-triangle"></i></div>
                <div class="pg-pv-conflict-title">Saat çakışması var</div>
                <div class="pg-pv-conflict-msg">Öğretmeninin planındaki bazı saatler, senin zaten planladığın görevlerle çakışıyor. Şimdi düzenleyebilir ya da planı olduğu gibi kabul edip daha sonra düzenleyebilirsin.</div>
                <div class="pg-pv-conflict-actions">
                    <button type="button" class="pg-pv-conflict-btn pg-pv-conflict-cancel" data-action="later">Daha sonra düzenle</button>
                    <button type="button" class="pg-pv-conflict-btn pg-pv-conflict-confirm" data-action="edit">Düzenle</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);
        const close = () => overlay.remove();
        overlay.querySelector('[data-action="later"]').addEventListener('click', () => { close(); onLater(); });
        overlay.querySelector('[data-action="edit"]').addEventListener('click', () => { close(); onEdit(); });
    }

    // Kabul edilen dersin çakışan günlerine sırayla odaklanır ve o günleri
    // "kilitli" işaretler (bkz. _pvMoveTaskToSlot) — kullanıcı sadece saat
    // değiştirebilir, görevleri başka güne sürükleyemez.
    // dateStr + saat aralığı (HH:MM) -> o aralığa denk gelen her saat hücresi için
    // "dateStr|saat" anahtarları — hcal grid hücrelerini vurgulamak için kullanılır.
    function _pvConflictHourKeys(dateStr, startT, endT) {
        if (!dateStr || !startT) return [];
        const sH = Math.floor(_pvTimeToMinLocal(startT) / 60);
        let eMin = _pvTimeToMinLocal(endT || startT);
        let eH = Math.floor((eMin > 0 ? eMin - 1 : 0) / 60);
        if (eH < sH) eH = sH;
        const keys = [];
        for (let h = sH; h <= eH; h++) keys.push(`${dateStr}|${h}`);
        return keys;
    }

    function _lpaRouteToConflictEdit(newGoalId, conflicts) {
        const g = goals.find(x => x.id === newGoalId);
        if (!g || typeof window.openPlanView !== 'function') return;
        const firstDate = conflicts.map(c => c.ms.due_date).find(Boolean);
        window.openPlanView(newGoalId);
        // Direkt hafta/gün saat gridine değil, aylık görünüme atla — kullanıcı önce
        // "Günün Görevleri" panelinden hangi günlerde çakışma olduğuna baksın, oradan
        // bir çakışan göreve tıklayıp haftalık görünüme geçsin (bkz. _pvJumpToWeekAtTask).
        if (firstDate) setTimeout(() => _pvJumpToMonth(g, firstDate), 60);
        toast('Çakışan saatleri düzenleyebilirsin — görevler sadece aynı gün içinde taşınabilir');
    }

    function _pvJumpToMonth(g, dateStr) {
        const [y, mo] = dateStr.split('-').map(Number);
        pvCalYear  = y;
        pvCalMonth = mo - 1;
        pvCalView  = 'month';
        // Önce seç (pvSelectedDate'i günceller), sonra ay gridini çiz — böylece hücre
        // "selected" vurgusuyla doğru günde açılır (bkz. _pvRenderMainCal isSel kontrolü).
        _pvSelectDay(g, dateStr);
        _pvRenderMainCal(g);
    }

    // "Günün Görevleri" listesindeki çakışma uyarı ikonuna tıklayınca haftalık görünümde
    // ilgili günün/saatin olduğu hücreye atlar (o hücre zaten pg-pv-hcal-cell-conflict ile
    // yanıp söner, bkz. _pvConflictHourSetFor).
    function _pvJumpToWeekAtTask(g, t) {
        const dateStr = _normYMD(t.date);
        const [y, mo, dd] = dateStr.split('-').map(Number);
        pvCalView = 'week';
        pvWeekCursor = new Date(y, mo - 1, dd);
        _pvRenderMainCal(g);
        _pvSelectDay(g, dateStr);
        setTimeout(() => {
            const hour = t.timeStart ? Math.floor(_pvTimeToMin(t.timeStart) / 60) : null;
            const cell = hour !== null ? document.querySelector(`.pg-pv-hcal-cell[data-cal-date="${dateStr}"][data-hour="${hour}"]`) : null;
            cell?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 80);
    }

    // Üst bardaki "çakışan saatler var" rozetini günceller — çözülünce otomatik kaybolur.
    function _pvUpdateConflictBanner(g) {
        const banner = document.getElementById('pg-pv-conflict-banner');
        if (!banner) return;
        const count = _pvRecomputeUnresolvedConflicts(g).length;
        banner.classList.toggle('hidden', count === 0);
        if (count > 0) {
            const textEl = document.getElementById('pg-pv-conflict-banner-text');
            if (textEl) textEl.textContent = count === 1 ? 'Çakışan bir saat var — düzenlemen gerekiyor' : `${count} çakışan saat var — düzenlemen gerekiyor`;
        }
    }

    // Öğrencinin öğretmenden kabul ettiği ders planında (g.lpa_id) bu plana ait
    // saatli görevlerle öğrencinin kendi diğer görevleri arasında hâlâ çakışma var
    // mı diye HER ZAMAN canlı hesaplar — bir önceki oturumda "Düzenle" ile açılıp
    // açılmadığına bakmaz, böylece sayfa yenilense/plan farklı bir yoldan tekrar
    // açılsa bile kaydet/çık uyarısı doğru çalışır.
    function _pvRecomputeUnresolvedConflicts(g) {
        if (!g || !g.lpa_id) return [];
        const allTasks = FocusStorage.get('tasks', []);
        const lessonTasks = allTasks.filter(t => String(t.parentGoal) === String(g.id) && t.timeStart && t.timeEnd);
        const ownTasks = allTasks.filter(t => String(t.parentGoal) !== String(g.id) && t.timeStart && t.timeEnd);
        const conflicts = [];
        lessonTasks.forEach(lesson => {
            const own = ownTasks.find(o => _normYMD(o.date) === _normYMD(lesson.date)
                && _lpaOverlap(lesson.timeStart, lesson.timeEnd, o.timeStart, o.timeEnd));
            if (own) conflicts.push({ lesson, own });
        });
        return conflicts;
    }

    function _pvHasUnresolvedConflicts(g) { return _pvRecomputeUnresolvedConflicts(g).length > 0; }

    // Bir tarih, o gün için hâlâ çözülmemiş bir çakışma varsa "kilitli" sayılır —
    // bkz. _pvMoveTaskToSlot: kilitli günlerdeki görevler başka bir güne sürüklenemez.
    function _pvIsDateLocked(g, dateStr) {
        if (!g?.lpa_id) return false;
        return _pvRecomputeUnresolvedConflicts(g).some(c => _normYMD(c.lesson.date) === dateStr || _normYMD(c.own.date) === dateStr);
    }

    // Bu plana ait hcal grid hücrelerini vurgulamak için "dateStr|saat" anahtar seti üretir.
    function _pvConflictHourSetFor(g) {
        const set = new Set();
        if (!g?.lpa_id) return set;
        _pvRecomputeUnresolvedConflicts(g).forEach(c => {
            _pvConflictHourKeys(_normYMD(c.lesson.date), c.lesson.timeStart, c.lesson.timeEnd).forEach(k => set.add(k));
            _pvConflictHourKeys(_normYMD(c.own.date), c.own.timeStart, c.own.timeEnd).forEach(k => set.add(k));
        });
        return set;
    }

    // Çakışma çözülmeden kaydet/çık denendiğinde gösterilen uyarı.
    function _pvShowUnresolvedConflictModal({ onLeave }) {
        const overlay = document.createElement('div');
        overlay.className = 'pg-pv-conflict-overlay';
        overlay.innerHTML = `
            <div class="pg-pv-conflict-box">
                <div class="pg-pv-conflict-icon"><i class="ti ti-alert-triangle"></i></div>
                <div class="pg-pv-conflict-title">Çakışan saatler var</div>
                <div class="pg-pv-conflict-msg">Bu planda hâlâ çözülmemiş saat çakışmaları var. Çıkmadan önce düzenlemeye devam edebilir ya da planlamadan ayrılabilirsin.</div>
                <div class="pg-pv-conflict-actions">
                    <button type="button" class="pg-pv-conflict-btn pg-pv-conflict-cancel" data-action="continue">Düzenlemeye Devam Et</button>
                    <button type="button" class="pg-pv-conflict-btn pg-pv-conflict-confirm" data-action="leave">Planlamadan Ayrıl</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);
        const close = () => overlay.remove();
        overlay.querySelector('[data-action="continue"]').addEventListener('click', close);
        overlay.querySelector('[data-action="leave"]').addEventListener('click', () => { close(); onLeave(); });
    }

    // "Kaydet"/"Çık" ile "Kabul Et" farklı şeyler: taslağı yerelde oluşturup saat
    // gridinde düzenlemek (materialize) planı KABUL ETMEZ — lesson_plan_assignments.status
    // sadece acceptForReal() ile, yani gerçekten "Kabul Et" akışı tamamlandığında değişir.
    async function _acceptLessonPlanInvite(card) {
        const sb = window.FocusSupabase;
        const lpaId = card.dataset.lpaId, teacherGoalId = card.dataset.goalId;
        card.style.opacity = '.5'; card.style.pointerEvents = 'none';
        try {
            // Öğrenci daha önce "Düzenle" ile bu planı taslak olarak açıp saatleri
            // ayarlamış olabilir (pending_accept=true, henüz kabul edilmedi) — sıfırdan
            // klonlamak yerine o taslağı kullanırız, yoksa yaptığı düzenlemeler kaybolur.
            let draft = goals.find(x => x.lpa_id === lpaId && x.pending_accept);
            let tGoal = null, clonedMs = null, conflicts;

            if (!draft) {
                // bkz. _toggleLessonPlanPreview — aynı RLS kısıtı burada da geçerli, aynı RPC kullanılıyor.
                const { data: preview, error } = await sb.rpc('lesson_plan_preview', { p_goal_id: teacherGoalId });
                if (error || !preview) throw new Error('Plan bulunamadı');
                tGoal = preview;
                clonedMs = (preview.milestones || []).map(m => ({
                    id: window.msUid(), title: m.title, due_date: m.due_date || '', start_date: m.start_date || '',
                    start_time: m.start_time || '', end_time: m.end_time || '',
                    is_task_mirror: !!m.is_task_mirror,
                    done: false, order: m.order_index, description: m.description || '',
                }));
                // ÖNEMLİ: çakışma burada, henüz `tasks`'a hiçbir şey yazılmadan hesaplanmalı —
                // yoksa aşağıdaki materialize() aynı saatte kendi aynasıyla "çakışıyor" görünür.
                conflicts = _lpaFindConflicts(clonedMs);
            }

            // Taslağı (ya da mevcut taslağı) yerel bir hedefe dönüştürür; saatli aşamaları
            // SADECE ilk oluşturmada `tasks`'a aynalar (taslak zaten varsa görevlere
            // dokunulmaz ki öğrencinin önceki sürükle-bırak düzenlemeleri korunsun).
            // lesson_plan_assignments'a HİÇBİR ŞEY yazmaz — bu fonksiyon kabul değildir.
            const materialize = () => {
                if (draft) return draft.id;
                const newId = uid();
                goals.unshift({
                    id: newId, title: tGoal.title, description: tGoal.description || '',
                    category: tGoal.category, color: tGoal.color, deadline: tGoal.deadline || null,
                    priority: tGoal.priority || 2, status: 'active', progress_pct: 0,
                    milestones: clonedMs, lpa_id: lpaId, _dirty: true,
                    // Öğretmenin ders planı ile aynı zengin saat-gridi/sürükle-bırak
                    // arayüzünü kullansın diye (bkz. _pvIsLessonPlan) — ama `lpa_id`
                    // dolu olduğundan öğretmene özel "Şablon"/"Öğrencilere Ata" aksiyonları
                    // header'da gizlenir (bkz. _pvRenderHeader).
                    plan_mode: 'lesson-plan',
                    // Gerçekten "Kabul Et" ile onaylanana kadar true — bkz. acceptForReal.
                    pending_accept: true,
                });
                draft = goals.find(x => x.id === newId);
                persistGoals();

                if (typeof window.addGlobalTask === 'function') {
                    clonedMs.forEach(m => {
                        if (!m.due_date || !m.start_time) return;
                        const [y, mo, dd] = m.due_date.split('-');
                        window.addGlobalTask(m.title, tGoal.priority || 2, tGoal.category || '', `${dd}-${mo}-${y}`, m.start_time, m.end_time || _pvAddHour(m.start_time), '', newId);
                    });
                }
                if (typeof window.syncTasksFromStorage === 'function') window.syncTasksFromStorage();
                if (typeof window.renderTasks === 'function') window.renderTasks();
                if (typeof window.renderCalendarGlobal === 'function') window.renderCalendarGlobal();
                render();
                return newId;
            };

            // Gerçek kabul — lesson_plan_assignments.status sadece burada 'accepted' olur.
            const acceptForReal = (goalId) => {
                const g = goals.find(x => x.id === goalId);
                if (g) { delete g.pending_accept; g._dirty = true; }
                persistGoals();
                sb.from('lesson_plan_assignments').update({ status: 'accepted', responded_at: new Date().toISOString(), student_note: null })
                    .eq('id', lpaId).select('teacher_id').single().then(({ data: lpa }) => {
                        if (lpa?.teacher_id) {
                            sb.from('notifications').insert([{
                                user_id: lpa.teacher_id, type: 'lesson_plan_accepted',
                                payload: { fromName: window.currentUser.displayName || window.currentUser.username, goalId: teacherGoalId, groupCode: card.dataset.groupCode || null },
                            }]).then(() => {});
                        }
                    });
                card.remove();
                if (!document.querySelectorAll('.pg-lpa-invite-card').length) document.getElementById('pg-lpa-invites')?.style.setProperty('display', 'none');
                toast('Plan kabul edildi, kendi hedeflerine eklendi 🎯');
            };

            const goalId = materialize();
            if (draft) {
                // Taslak zaten vardı — kalan çakışmaları güncel görev saatleriyle canlı hesapla.
                // _pvRecomputeUnresolvedConflicts task nesneleri döndürür (date/timeStart/timeEnd);
                // _lpaRouteToConflictEdit ise milestone şekli bekler (due_date/start_time/end_time) —
                // burada eşleştiriyoruz.
                const gLive = goals.find(x => x.id === goalId);
                conflicts = _pvRecomputeUnresolvedConflicts(gLive).map(c => ({
                    ms: { due_date: _normYMD(c.lesson.date), start_time: c.lesson.timeStart, end_time: c.lesson.timeEnd },
                    task: c.own,
                }));
            }

            if (conflicts.length) {
                card.style.opacity = ''; card.style.pointerEvents = '';
                _lpaShowSimpleConflictWarning(conflicts, {
                    onLater: () => acceptForReal(goalId),
                    onEdit: () => _lpaRouteToConflictEdit(goalId, conflicts),
                });
            } else {
                acceptForReal(goalId);
            }
        } catch (e) {
            card.style.opacity = ''; card.style.pointerEvents = '';
        }
    }
    // planning-lesson-plan-invites.js modülündeki _bindLpaInviteCard'ın
    // "Kabul Et" butonuna bağlayabilmesi için köprü.
    window._acceptLessonPlanInvite = _acceptLessonPlanInvite;

    function persistGoals() {
        if (typeof FocusStorage !== 'undefined')
            FocusStorage.set('planning_goals', goals);
        else
            localStorage.setItem('planning_goals', JSON.stringify(goals));
        // Plan görünümü açıkken bir ders planının aşama/başlık verisi değiştiyse "kaydedilmemiş" işaretle
        if (pvGoalId) {
            const openGoal = goals.find(x => x.id === pvGoalId);
            if (openGoal?.plan_mode === 'lesson-plan') pvUnsaved = true;
        }
        _syncDirty();
        // Takvimi senkronize et
        if (typeof window.syncAllMilestonesToCalendar === 'function')
            window.syncAllMilestonesToCalendar();
        // 5.4 — Bugün widget'ını güncelle
        if (typeof window.renderTodaySprintWidget === 'function')
            window.renderTodaySprintWidget();
    }
    window.persistGoals = persistGoals;
    // Salt-okunur köprü — planning-quick-create.js gibi ayrılan modüllerin
    // goals dizisini (referans olarak — unshift/find gibi mutasyon
    // metodları çalışır) taşımadan kullanabilmesi için.
    window._pgGetGoals = () => goals;
    // goals dizisi yeni bir referansla DEĞİŞTİRİLDİĞİNDE (filter/reassign,
    // splice/unshift referansı korur ve zaten _pgGetGoals ile çalışır) bunu
    // geri yazmak için — planning-lesson-plan-invites.js gibi ayrılmış
    // modüllerin `goals = goals.filter(...)` desenini kullanabilmesi için.
    window._pgSetGoals = (arr) => { goals = arr; };

    function _setSyncBadge(state) {
        // state: 'syncing' | 'done' | 'hidden'
        let badge = document.getElementById('pg-sync-badge');
        if (!badge) {
            badge = document.createElement('div');
            badge.id = 'pg-sync-badge';
            badge.className = 'pg-sync-badge';
            const header = document.querySelector('.pg-header');
            if (header) header.appendChild(badge);
        }
        if (state === 'syncing') {
            badge.innerHTML = '<i class="ti ti-refresh pg-sync-spin"></i> Senkronize ediliyor...';
            badge.classList.add('show');
        } else if (state === 'done') {
            badge.innerHTML = '<i class="ti ti-check"></i> Kaydedildi';
            badge.classList.add('show');
            clearTimeout(badge._t);
            badge._t = setTimeout(() => badge.classList.remove('show'), 2000);
        } else {
            badge.classList.remove('show');
        }
    }

    async function _syncDirty() {
        if (!window.FocusSupabase || !window.currentUser) return;
        const dirty = goals.filter(g => g._dirty);
        if (!dirty.length) return;
        _setSyncBadge('syncing');
        const sb = window.FocusSupabase, uid = window.currentUser.id;
        for (const g of goals) {
            if (!g._dirty) continue;
            try {
                // 4.1 — Hedefi yaz
                const { error } = await sb.from('planning_goals').upsert({
                    id: g.id, user_id: uid, title: g.title,
                    description: g.description || '', category: g.category,
                    color: g.color, deadline: g.deadline || null,
                    priority: g.priority || 2, status: g.status || 'active',
                    progress_pct: g.progress_pct || 0,
                    milestone_count: (g.milestones || []).length,
                    // plan_mode/context daha önce hiç senkronize olmuyordu — bkz. 102_planning_goals_plan_mode.sql.
                    // Eksik kalınca loadGoalsFromServer() sunucudan gelen null değerle yerel plan_mode'u
                    // eziyor, ders planı kopyaları sayfa yenilenince bireysel plana dönüyordu.
                    plan_mode: g.plan_mode || null,
                    context: g.context || {},
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'id' });
                if (!error) {
                    g._dirty = false;
                    // Ders planı olarak atanmışsa öğretmenin takip tablosunu da güncelle (kayıt yoksa no-op).
                    // pending_accept true iken (öğrenci taslağı düzenliyor ama henüz "Kabul Et"e basmadı)
                    // bu güncelleme ATLANMALI — yoksa sadece düzenleme arayüzüne girmek/bir aşamayı
                    // kaydetmek bile lesson_plan_assignments.status'u sessizce 'accepted' yapıyordu.
                    if (g.lpa_id && !g.pending_accept) {
                        const isDone = (g.progress_pct || 0) === 100;
                        sb.from('lesson_plan_assignments').update({
                            progress_pct: g.progress_pct || 0,
                            status: isDone ? 'completed' : 'accepted',
                            completed_at: isDone ? new Date().toISOString() : null,
                        }).eq('id', g.lpa_id).then(() => {});
                    }
                    // 4.1 — Milestone'ları ayrı tabloya yaz
                    const msList = (g.milestones || []).map((ms, i) => ({
                        id: ms.id, goal_id: g.id, user_id: uid,
                        title: ms.title, due_date: ms.due_date || null,
                        start_date: ms.start_date || null,
                        // start_time/end_time: ders planı aşamalarının saatli içeriği — önceden burada
                        // eksikti, bu yüzden öğretmenin planlama takviminde girdiği saat bilgisi hiç
                        // Supabase'e ulaşmıyor, dolayısıyla öğrenciye de hiç geçmiyordu.
                        start_time: ms.start_time || null, end_time: ms.end_time || null,
                        is_task_mirror: !!ms.is_task_mirror,
                        order_index: ms.order ?? i, done: !!ms.done,
                        updated_at: new Date().toISOString(),
                    }));
                    if (msList.length) {
                        await sb.from('planning_milestones').upsert(msList, { onConflict: 'id' });
                        // Silinmiş milestone'ları temizle
                        const liveIds = msList.map(m => m.id);
                        await sb.from('planning_milestones')
                            .delete()
                            .eq('goal_id', g.id)
                            .not('id', 'in', `(${liveIds.map(x=>'"'+x+'"').join(',')})`);
                    } else {
                        // Tüm milestone'lar silindiyse
                        await sb.from('planning_milestones').delete().eq('goal_id', g.id);
                    }
                }
            } catch (_) { console.warn('[FocusAI] sessiz hata:', _); }
        }
        _setSyncBadge('done');
    }

    // ── Helpers ───────────────────────────────
    function uid()   { return 'pg_' + Date.now() + '_' + Math.random().toString(36).slice(2,7); }
    window.uid = uid;
    // msUid → planning-utils.js dosyasına taşındı.
    // Tek kaynak: script.js'teki window.escapeHtml. planning.js önce bu dosya
    // yüklendikten sonra çalıştığı için normalde her zaman mevcuttur; olası bir
    // yükleme sırası değişikliğine karşı aynı mantığı yerel fallback olarak tutuyoruz.
    function esc(s)  {
        if (typeof window.escapeHtml === 'function') return window.escapeHtml(s);
        return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;')
                        .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    }
    window.esc = esc;
    // getCat → planning-utils.js dosyasına taşındı.

    // deadlineLabel/fmtDate/fmtShort/progressRing → planning-utils.js
    // dosyasına taşındı (Faz 2, 2026-07-19).

    function _recalcProgress(g) {
        const ms = g.milestones || [];
        if (ms.length > 0) g.progress_pct = Math.round(ms.filter(m=>m.done).length / ms.length * 100);
        if (g.progress_pct === 100 && ms.length > 0) g.status = 'completed';
        else if (g.status === 'completed' && g.progress_pct < 100) g.status = 'active';
    }
    window._recalcProgress = _recalcProgress;

    // ── Goal CRUD ─────────────────────────────
    function addGoal(data) {
        const cat = window.getCat(data.category);
        goals.unshift({
            id: uid(), title: data.title.trim(),
            description: (data.description||'').trim(),
            category: data.category||'diger', color: cat.color,
            deadline: data.deadline||'', priority: parseInt(data.priority)||2,
            status: 'active', progress_pct: 0, milestones: [],
            created_at: new Date().toISOString(), _dirty: true,
        });
        persistGoals(); render(); toast('Hedef eklendi! 🎯');
    }

    function updateGoal(id, data) {
        const idx = goals.findIndex(g=>g.id===id);
        if (idx===-1) return;
        const cat = window.getCat(data.category);
        goals[idx] = { ...goals[idx], ...data, color: cat.color, _dirty: true };
        persistGoals(); render(); toast('Hedef güncellendi ✓');
    }

    function _purgeGoalTasks(goalId, milestoneIds) {
        // Remove all tasks and calendar events tied to this goal
        const allTasks = FocusStorage.get('tasks', []);
        const purgedIds = new Set(
            allTasks.filter(t => String(t.parentGoal) === String(goalId)).map(t => String(t.id))
        );
        const kept = allTasks.filter(t => String(t.parentGoal) !== String(goalId));
        FocusStorage.set('tasks', kept);

        // Bu hedefe ait dönüm noktalarının takvim event id'leri (ms_cal_<msId>)
        const msCalIds = new Set((milestoneIds||[]).map(id => 'ms_cal_' + id));

        const events = FocusStorage.get('events', {});
        let changed  = false;
        for (const date in events) {
            const before = events[date].length;
            // parentGoal eşleşmesi, silinen görev ID'si VEYA silinen milestone'un takvim id'si ile eşleşen olayları kaldır
            events[date] = events[date].filter(e =>
                String(e.parentGoal) !== String(goalId) &&
                !purgedIds.has(String(e.id)) &&
                !msCalIds.has(String(e.id))
            );
            if (events[date].length !== before) changed = true;
            if (!events[date].length) delete events[date];
        }
        if (changed) FocusStorage.set('events', events);

        // FocusStorage temizlendi — script.js in-memory array'lerini de senkronize et.
        // Aksi hâlde deleteGlobalTask in-memory'den silip saveTasks() çağırınca
        // silinen görevler FocusStorage'a geri yazılır.
        if (typeof window.syncTasksFromStorage === 'function') window.syncTasksFromStorage();

        if (typeof window.renderCalendarGlobal === 'function') window.renderCalendarGlobal();
        if (typeof window.renderTasks === 'function') window.renderTasks();
    }

    function deleteGoal(id) {
        // Kart çıkış animasyonu
        const card = document.querySelector(`.pg-card[data-id="${id}"]`);
        const doDelete = () => {
            const deletedGoal = goals.find(g=>g.id===id);
            const msIds = (deletedGoal?.milestones||[]).map(m=>m.id);
            goals = goals.filter(g=>g.id!==id);
            persistGoals(); render();
            _purgeGoalTasks(id, msIds);
            if (typeof window.syncAllMilestonesToCalendar === 'function')
                window.syncAllMilestonesToCalendar();
            if (typeof window.renderCalendarGlobal === 'function')
                window.renderCalendarGlobal();
            if (detailGoalId===id) closeDetailPanel();
            if (pvGoalId===id) closePlanView();
            if (typeof window.renderTodaySprintWidget === 'function')
                window.renderTodaySprintWidget();
            if (window.FocusSupabase && window.currentUser)
                window.FocusSupabase.from('planning_goals').delete().eq('id',id).then(()=>{});
        };
        if (card) {
            card.classList.add('pg-card-exiting');
            setTimeout(doDelete, 220);
        } else {
            doDelete();
        }
    }

    function toggleArchive(id) {
        const g = goals.find(g=>g.id===id);
        if (!g) return;
        if (g.status==='archived') {
            // Aktife al — tamamlanmışsa "tamamlandı" durumunu korur, arşivleme onu silmez
            g.status = g.progress_pct===100 ? 'completed' : 'active';
        } else {
            g.status = 'archived';
        }
        g._dirty = true;
        persistGoals(); render();
        toast(g.status==='archived' ? 'Arşivlendi' : 'Aktife alındı');
    }

    function updateGoalProgress(id, pct) {
        const g = goals.find(g=>g.id===id);
        if (!g) return;
        g.progress_pct = Math.max(0, Math.min(100, pct));
        if (g.progress_pct===100) g.status='completed';
        else if (g.status==='completed') g.status='active';
        g._dirty = true;
        persistGoals(); render(); refreshDetailPanel();
    }

    // ── Milestone CRUD ────────────────────────
    function addMilestone(goalId, data) {
        const g = goals.find(g=>g.id===goalId);
        if (!g) return;
        if (!g.milestones) g.milestones = [];
        const ms = {
            id: window.msUid(), title: data.title.trim(),
            description: (data.description||'').trim(),
            due_date: data.due_date||'', done: false,
            order: g.milestones.length, subtasks: [],
            created_at: new Date().toISOString(),
        };
        g.milestones.push(ms);
        _recalcProgress(g); g._dirty = true;
        persistGoals(); render(); renderMilestoneList(goalId);
        toast('Milestone eklendi 🚩');
    }

    function addSubtask(goalId, msId, title) {
        const g  = goals.find(x=>x.id===goalId);
        const ms = (g?.milestones||[]).find(m=>m.id===msId);
        if (!g||!ms||!title.trim()) return;
        if (!ms.subtasks) ms.subtasks = [];
        ms.subtasks.push({ id: window.msUid(), title: title.trim(), done: false });
        g._dirty = true;
        persistGoals(); renderMilestoneList(goalId);
    }

    function toggleSubtask(goalId, msId, stId) {
        const g  = goals.find(x=>x.id===goalId);
        const ms = (g?.milestones||[]).find(m=>m.id===msId);
        const st = (ms?.subtasks||[]).find(s=>s.id===stId);
        if (!g||!ms||!st) return;
        st.done = !st.done;
        if (ms.subtasks.length > 0 && ms.subtasks.every(s=>s.done)) {
            ms.done = true; _recalcProgress(g);
            toast('Milestone tamamlandı! 🎉');
            _sparkle(document.querySelector(`[data-msid="${msId}"] .pg-ms-check`));
            if (g.progress_pct === 100) setTimeout(() => _goalComplete(g), 300);
        } else if (ms.done && ms.subtasks.some(s=>!s.done)) {
            ms.done = false; _recalcProgress(g);
        }
        g._dirty = true;
        persistGoals(); render(); renderMilestoneList(goalId); refreshDetailSummary(g);
    }

    function deleteSubtask(goalId, msId, stId) {
        const g  = goals.find(x=>x.id===goalId);
        const ms = (g?.milestones||[]).find(m=>m.id===msId);
        if (!g||!ms) return;
        ms.subtasks = (ms.subtasks||[]).filter(s=>s.id!==stId);
        g._dirty = true;
        persistGoals(); renderMilestoneList(goalId);
    }

    // deleteSubtask hiçbir onay/geri-al olmadan kalıcı siliyordu — _deleteGoalWithUndo
    // ve _deleteMilestoneWithUndo'da zaten kullanılan geri-al (undo toast) desenini
    // burada da uygulayıp tutarlı hale getiriyoruz.
    function _deleteSubtaskWithUndo(goalId, msId, stId) {
        const g  = goals.find(x=>x.id===goalId);
        const ms = (g?.milestones||[]).find(m=>m.id===msId);
        const st = (ms?.subtasks||[]).find(s=>s.id===stId);
        if (!g||!ms||!st) return;
        const snapshot = JSON.parse(JSON.stringify(st));
        const order = (ms.subtasks||[]).findIndex(s=>s.id===stId);
        deleteSubtask(goalId, msId, stId);
        toast(`"${snapshot.text||snapshot.title||'Görev'}" silindi`, {
            undoFn: () => {
                const g2 = goals.find(x=>x.id===goalId);
                const ms2 = (g2?.milestones||[]).find(m=>m.id===msId);
                if (!g2||!ms2) return;
                ms2.subtasks = ms2.subtasks||[];
                ms2.subtasks.splice(order>=0?order:ms2.subtasks.length, 0, snapshot);
                g2._dirty = true;
                persistGoals(); renderMilestoneList(goalId);
                toast('Geri alındı ↩');
            },
            undoLabel: 'Geri Al',
            duration: 4000,
        });
    }

    function toggleMilestone(goalId, msId) {
        const g = goals.find(g=>g.id===goalId);
        const ms = (g?.milestones||[]).find(m=>m.id===msId);
        if (!g || !ms) return;
        ms.done = !ms.done;
        _recalcProgress(g); g._dirty = true;
        persistGoals(); render();
        renderMilestoneList(goalId);
        refreshDetailSummary(g);
        if (ms.done) {
            toast('Milestone tamamlandı! 🎉');
            _sparkle(document.querySelector(`[data-msid="${msId}"] .pg-ms-check`));
            if (g.progress_pct === 100) setTimeout(() => _goalComplete(g), 300);
        }
        // Broadcast
        if (window.PlanningCollab?.channel) {
            window.PlanningCollab.broadcast('ms_toggle', { goalId, msId, done: ms.done });
        }
    }

    function deleteMilestone(goalId, msId) {
        const g = goals.find(g=>g.id===goalId);
        if (!g) return;
        g.milestones = (g.milestones||[]).filter(m=>m.id!==msId);
        _recalcProgress(g); g._dirty = true;
        persistGoals(); render(); renderMilestoneList(goalId);
        // Bu milestone'un takvim event'ini doğrudan ID ile temizle (stale cache'e bağımlı kalma)
        const events = FocusStorage.get('events', {});
        const evId = 'ms_cal_' + msId;
        let evChanged = false;
        for (const date in events) {
            const before = events[date].length;
            events[date] = events[date].filter(e => e.id !== evId);
            if (events[date].length !== before) evChanged = true;
            if (!events[date].length) delete events[date];
        }
        if (evChanged) FocusStorage.set('events', events);
        if (typeof window.syncAllMilestonesToCalendar === 'function')
            window.syncAllMilestonesToCalendar();
        if (typeof window.renderCalendarGlobal === 'function')
            window.renderCalendarGlobal();
        if (typeof window.renderTodaySprintWidget === 'function')
            window.renderTodaySprintWidget();
        toast('Milestone silindi');
        // Broadcast
        if (window.PlanningCollab?.channel) {
            window.PlanningCollab.broadcast('ms_delete', { goalId, msId });
        }
    }

    function milestoneToTask(goalId, msId) {
        const g  = goals.find(g=>g.id===goalId);
        const ms = (g?.milestones||[]).find(m=>m.id===msId);
        if (!g||!ms) return;
        const date = ms.due_date || new Date().toISOString().split('T')[0];
        if (typeof window.addGlobalTask === 'function') {
            window.addGlobalTask(ms.title, g.priority||2, g.category||'', date, '09:00','10:00','', g.id);
            if (typeof window.renderTasksGlobal==='function') window.renderTasksGlobal();
        } else {
            const tasks = FocusStorage.get('tasks', []);
            tasks.push({ id:'task_'+Date.now(), text:ms.title, completed:false,
                priority:g.priority||2, category:g.category||'', date,
                timeStart:'09:00', timeEnd:'10:00', parentGoal:g.id, parentMilestone:ms.id });
            FocusStorage.set('tasks', tasks);
        }
        toast('Göreve dönüştürüldü ✓ — "Bugün" sekmesini kontrol et');
    }


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
                        ${(g.plan_mode==='lesson-plan' && !g.context?.isTemplate && !g.lpa_id)?(()=>{ const gName=(_wzLessonPlanGroups||[]).find(x=>x.id===g.context?.lessonPlanGroupId)?.name || 'Sınıf'; return g.context?.lessonPlanStudentId ? `<span class="pg-teacher-plan-badge" title="Kişiye özel ders planı"><i class="ti ti-user"></i> ${esc(gName)} — Kişiye Özel</span>` : `<span class="pg-teacher-plan-badge" title="Sınıfa özel ders planı"><i class="ti ti-users-group"></i> ${esc(gName)}</span>`; })():''}
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

        const statGoals=goals.filter(g=>g.plan_mode!=='lesson-plan');
        const activeCount=statGoals.filter(g=>g.status==='active').length;
        const doneCount=statGoals.filter(g=>g.status==='completed').length;
        const avgPct=statGoals.length ? Math.round(statGoals.reduce((s,g)=>s+(g.progress_pct||0),0)/statGoals.length) : 0;
        if (statsEl) statsEl.innerHTML=`
            <div class="pg-stat"><span class="pg-stat-n" style="color:#4ade80;">${activeCount}</span><span class="pg-stat-l">Aktif Hedef</span></div>
            <div class="pg-stat-sep"></div>
            <div class="pg-stat"><span class="pg-stat-n" style="color:var(--a,#D4900E);">${avgPct}%</span><span class="pg-stat-l">Ort. İlerleme</span></div>
            <div class="pg-stat-sep"></div>
            <div class="pg-stat"><span class="pg-stat-n" style="color:#60a5fa;">${doneCount}</span><span class="pg-stat-l">Tamamlandı</span></div>`;

        let list = goals.filter(g => !g._pending_collab && g.plan_mode !== 'lesson-plan');
        const now = new Date();
        const isArchiveMode = activeFilters.has('__archived__');
        const isCompletedMode = activeFilters.has('__completed__');
        const isAllMode = !isArchiveMode && !isCompletedMode && activeFilters.size===1 && activeFilters.has('all');

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
            if (!isAllMode) list = list.filter(g => [...activeFilters].some(f => matches(g, f)));
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
            grid.classList.toggle('pg-no-card-anim', (Date.now() - _pgLoadedAt) < 2500 && _pgRenderCount > 0);
            _pgRenderCount++;
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
            if (del)     { e.stopPropagation(); _deleteGoalWithUndo(del.dataset.id); }
        });
    }

    // ── DETAIL PANEL ─────────────────────────
    function openDetailPanel(goalId) {
        const g=goals.find(g=>g.id===goalId); if (!g) return;
        detailGoalId=goalId;
        refreshDetailSummary(g); renderMilestoneList(goalId); _initDetailProgress(g);
        document.getElementById('pg-detail-panel')?.classList.add('open');
        document.getElementById('pg-detail-overlay')?.classList.add('open');

        // 5.3 — Dependency panel doldur
        _renderDepPanel(goalId);

        // Collab: kanala bağlan + bölümü render et
        if (window.PlanningCollab) {
            if (g.collab_room_id) {
                window.PlanningCollab.joinRoom(g.collab_room_id, g.id, g.my_role || 'owner');
            }
            window.PlanningCollab.renderCollabSection(g);
            window.PlanningCollab.setHandlers({
                onMilestoneChange: (type, payload) => {
                    const gLive = goals.find(x => x.id === goalId);
                    if (gLive) {
                        if (type === 'toggle' && payload.msId) {
                            const ms = (gLive.milestones || []).find(m => m.id === payload.msId);
                            if (ms) { ms.done = payload.done; _recalcProgress(gLive); gLive._dirty = true; persistGoals(); }
                        } else if (type === 'add' && payload.milestone) {
                            gLive.milestones = gLive.milestones || [];
                            if (!gLive.milestones.find(m => m.id === payload.milestone.id)) {
                                gLive.milestones.push(payload.milestone); gLive._dirty = true; persistGoals();
                            }
                        } else if (type === 'delete' && payload.msId) {
                            gLive.milestones = (gLive.milestones || []).filter(m => m.id !== payload.msId);
                            _recalcProgress(gLive); gLive._dirty = true; persistGoals();
                        } else if (type === 'batch_set' && payload.milestones) {
                            gLive.milestones = payload.milestones; _recalcProgress(gLive); gLive._dirty = true; persistGoals();
                        } else if (type === 'update' && payload.msId) {
                            const ms = (gLive.milestones || []).find(m => m.id === payload.msId);
                            if (ms) { Object.assign(ms, payload.fields); gLive._dirty = true; persistGoals(); }
                        }
                    }
                    renderMilestoneList(goalId);
                    refreshDetailSummary(goals.find(x => x.id === goalId) || g);
                    render();
                },
                onProgressChange: (payload) => {
                    const idx = goals.findIndex(x=>x.id===goalId);
                    if (idx!==-1) { goals[idx].progress_pct = payload.pct; persistGoals(); render(); refreshDetailPanel(); }
                },
                onStartPlanning: (payload) => {
                    if (payload.goalId === goalId) {
                        closeDetailPanel();
                        setTimeout(() => openPlanView(payload.goalId), 150);
                    }
                },
                onPresenceChange: () => {},
            });
        }
    }

    function closeDetailPanel() {
        detailGoalId=null;
        document.getElementById('pg-detail-panel')?.classList.remove('open');
        document.getElementById('pg-detail-overlay')?.classList.remove('open');
        hideMsForm();
        if (window.PlanningCollab) window.PlanningCollab.leaveRoom();
    }

    function refreshDetailPanel() {
        if (!detailGoalId) return;
        const g=goals.find(g=>g.id===detailGoalId); if (!g) return;
        refreshDetailSummary(g); _initDetailProgress(g);
    }

    function refreshDetailSummary(g) {
        const el=document.getElementById('pg-dp-summary'); if (!el) return;
        const cat=window.getCat(g.category), st=STATUS_META[g.status]||STATUS_META.active, pct=g.progress_pct||0;
        const ms=g.milestones||[];
        el.innerHTML=`
        <div class="pg-dp-goal-top">
            <div>
                <span class="pg-cat-badge" style="background:${cat.color}22;color:${cat.color};border:1px solid ${cat.color}44;font-size:11px;padding:2px 8px;border-radius:5px;display:inline-flex;align-items:center;gap:4px;margin-bottom:6px;">${cat.icon} ${cat.label}</span>
                <h2 class="pg-dp-goal-title">${esc(g.title)}</h2>
            </div>
            ${window.progressRing(pct,cat.color)}
        </div>
        ${g.description?`<p class="pg-dp-goal-desc">${esc(g.description)}</p>`:''}
        <div class="pg-dp-goal-meta">
            <span class="pg-dp-meta-item" style="color:${st.color};">● ${st.label}</span>
            ${g.deadline?`<span class="pg-dp-meta-item"><i class="ti ti-calendar-due"></i> ${window.fmtDate(g.deadline)}</span>`:''}
            ${ms.length>0?`<span class="pg-dp-meta-item"><i class="ti ti-flag-3"></i> ${ms.filter(m=>m.done).length}/${ms.length} milestone</span>`:''}
        </div>`;
    }
    window.refreshDetailSummary = refreshDetailSummary;

    function _initDetailProgress(g) {
        const fill=document.getElementById('pg-dp-pfill');
        const pctEl=document.getElementById('pg-dp-ppct');
        const slider=document.getElementById('pg-dp-slider');
        const sliderV=document.getElementById('pg-dp-slider-val');
        const manualWrap=document.getElementById('pg-dp-manual-wrap');
        const autoLabel=document.getElementById('pg-dp-auto-label');
        const cat=window.getCat(g.category), pct=g.progress_pct||0;
        const hasMilestones=(g.milestones||[]).length>0;

        if (fill)   { fill.style.width=pct+'%'; fill.style.background=cat.color; }
        if (pctEl)  pctEl.textContent=pct+'%';
        if (slider) slider.value=pct;
        if (sliderV) sliderV.textContent=pct+'%';

        // Milestone varsa slider'ı gizle, otomatik mod etiketi göster
        if (manualWrap) manualWrap.style.display = hasMilestones ? 'none' : '';
        if (autoLabel)  autoLabel.style.display  = hasMilestones ? ''     : 'none';
        if (autoLabel)  autoLabel.innerHTML = `<i class="ti ti-robot" style="color:${cat.color};"></i> Otomatik · Milestone tamamlandıkça güncellenir`;
    }
    window._initDetailProgress = _initDetailProgress;

    function renderMilestoneList(goalId) {
        const g=goals.find(g=>g.id===goalId);
        const el=document.getElementById('pg-ms-list');
        if (!el||!g) return;
        const ms=g.milestones||[];
        if (ms.length===0) {
            el.innerHTML=`<div class="pg-ms-empty"><i class="ti ti-flag-off"></i>Henüz milestone yok.<br>Yukarıdan ekleyebilirsin.</div>`;
            return;
        }
        const isCollab = !!(g.collab_room_id && window.PlanningCollab?.isActive());
        el.innerHTML=ms.map(m=>{
            const dlLabel=m.due_date?window.fmtDate(m.due_date):'';
            const extras = typeof window.PlanningCollabMsExtras === 'function'
                ? window.PlanningCollabMsExtras(m.id, m.title)
                : '';
            const subs = m.subtasks||[];
            const subsDone = subs.filter(s=>s.done).length;
            const subsHTML = subs.length ? `
                <div class="pg-subtask-list">
                    ${subs.map(s=>`<div class="pg-subtask-item${s.done?' done':''}">
                        <div class="pg-subtask-check${s.done?' done':''}" data-st-toggle="${s.id}" data-msid="${m.id}" data-gid="${goalId}"></div>
                        <span class="pg-subtask-title">${esc(s.title)}</span>
                        <button class="pg-subtask-del" data-st-del="${s.id}" data-msid="${m.id}" data-gid="${goalId}">×</button>
                    </div>`).join('')}
                </div>` : '';
            return `<div class="pg-ms-item${m.done?' done':''}" data-msid="${m.id}" draggable="true">
                <div class="pg-ms-drag-handle" title="Sırala"><i class="ti ti-grip-vertical"></i></div>
                <div class="pg-ms-check${m.done?' done':''}" data-ms-toggle="${m.id}" data-gid="${goalId}" title="${m.done?'Geri al':'Tamamla'}"></div>
                <div class="pg-ms-body">
                    <div class="pg-ms-title">${esc(m.title)}</div>
                    ${m.description?`<div class="pg-ms-desc">${esc(m.description)}</div>`:''}
                    <div class="pg-ms-meta">
                        ${dlLabel?`<span class="pg-ms-date-label"><i class="ti ti-calendar"></i> ${dlLabel}</span>`:''}
                        ${subs.length?`<span class="pg-ms-subtask-counter"><i class="ti ti-checklist"></i> ${subsDone}/${subs.length}</span>`:''}
                    </div>
                    ${subsHTML}
                    <div class="pg-subtask-add-row">
                        <input type="text" class="pg-subtask-input" data-ms-st-inp="${m.id}" placeholder="+ Alt adım ekle..." maxlength="100">
                    </div>
                    ${extras}
                </div>
                <div class="pg-ms-actions">
                    <button class="pg-ms-btn task-btn" data-ms-task="${m.id}" data-gid="${goalId}" title="Göreve Dönüştür"><i class="ti ti-arrow-right"></i></button>
                    <button class="pg-ms-btn del-btn"  data-ms-del="${m.id}"  data-gid="${goalId}" title="Sil"><i class="ti ti-trash"></i></button>
                </div>
            </div>`;
        }).join('');
        _bindMilestoneEvents(el);
        _bindMilestoneDragSort(el, goalId);
        if (typeof window.PlanningCollabBindMsExtras === 'function')
            window.PlanningCollabBindMsExtras(el);
    }
    window.renderMilestoneList = renderMilestoneList;

    function _bindMilestoneDragSort(el, goalId) {
        let dragSrc = null;
        el.addEventListener('dragstart', e => {
            dragSrc = e.target.closest('.pg-ms-item');
            if (!dragSrc) return;
            e.dataTransfer.effectAllowed = 'move';
            dragSrc.classList.add('pg-ms-dragging');
        });
        el.addEventListener('dragover', e => {
            e.preventDefault();
            const over = e.target.closest('.pg-ms-item');
            if (!over || over === dragSrc) return;
            e.dataTransfer.dropEffect = 'move';
            const rect = over.getBoundingClientRect();
            const after = e.clientY > rect.top + rect.height / 2;
            el.insertBefore(dragSrc, after ? over.nextSibling : over);
        });
        el.addEventListener('dragend', e => {
            if (!dragSrc) return;
            dragSrc.classList.remove('pg-ms-dragging');
            dragSrc = null;
            // DOM sıralamasını goals dizisine yansıt
            const g = goals.find(x=>x.id===goalId);
            if (!g) return;
            const newOrder = [...el.querySelectorAll('.pg-ms-item[data-msid]')].map(row => row.dataset.msid);
            g.milestones = newOrder.map((id,i) => {
                const ms = g.milestones.find(m=>m.id===id);
                if (ms) ms.order = i;
                return ms;
            }).filter(Boolean);
            g._dirty = true;
            persistGoals();
        });
    }

    function _renderDepPanel(goalId) {
        const sel  = document.getElementById('pg-dep-select');
        const list = document.getElementById('pg-dep-list');
        const btn  = document.getElementById('pg-dep-add-btn');
        if (!sel || !list) return;

        // Dropdown - bu hedef hariç tüm aktif hedefleri listele
        sel.innerHTML = '<option value="">— Bağımlı hedef seç —</option>' +
            goals.filter(g => g.id !== goalId && g.status !== 'archived')
                 .map(g => `<option value="${g.id}">${esc(g.title)}</option>`).join('');

        // Mevcut bağımlılıkları listele (bu hedef: to)
        const myDeps = window._pgGetDependencies().filter(d => d.to === goalId);
        if (!myDeps.length) {
            list.innerHTML = '<p style="font-size:11px;color:#444;text-align:center;">Bağımlılık yok</p>';
        } else {
            list.innerHTML = myDeps.map(dep => {
                const fromG = goals.find(g => g.id === dep.from);
                if (!fromG) return '';
                const done = fromG.status === 'completed';
                return `<div class="pg-dep-item">
                    <span class="pg-dep-status" style="color:${done?'#4ade80':'#f87171'};">${done?'✓':'⏳'}</span>
                    <span class="pg-dep-name">${esc(fromG.title)}</span>
                    <button class="pg-ms-btn del-btn" data-dep-id="${dep.id}" title="Kaldır" style="width:24px;height:24px;padding:0;"><i class="ti ti-x"></i></button>
                </div>`;
            }).join('');
            list.querySelectorAll('[data-dep-id]').forEach(b =>
                b.addEventListener('click', () => { window.removePlanningDependency(b.dataset.depId); _renderDepPanel(goalId); }));
        }

        // Ekle butonu
        if (btn) {
            btn.onclick = () => {
                const fromId = sel.value;
                if (!fromId) return;
                window.addPlanningDependency(fromId, goalId);
                _renderDepPanel(goalId);
            };
        }
    }

    let _msBound = false;
    function _bindMilestoneEvents(el) {
        // el her seferinde aynı #pg-ms-list DOM node'u, innerHTML değişiyor ama node sabit
        if (_msBound) return;
        _msBound = true;
        el.addEventListener('click', e => {
            const tog   = e.target.closest('[data-ms-toggle]');
            const task  = e.target.closest('[data-ms-task]');
            const del   = e.target.closest('[data-ms-del]');
            const stTog = e.target.closest('[data-st-toggle]');
            const stDel = e.target.closest('[data-st-del]');
            if (tog)   toggleMilestone(tog.dataset.gid, tog.dataset.msToggle);
            if (task)  milestoneToTask(task.dataset.gid, task.dataset.msTask);
            if (del)   _deleteMilestoneWithUndo(del.dataset.gid, del.dataset.msDel);
            if (stTog) toggleSubtask(stTog.dataset.gid, stTog.dataset.msid, stTog.dataset.stToggle);
            if (stDel) _deleteSubtaskWithUndo(stDel.dataset.gid, stDel.dataset.msid, stDel.dataset.stDel);
        });
        el.addEventListener('keydown', e => {
            const inp = e.target.closest('[data-ms-st-inp]');
            if (!inp || e.key !== 'Enter') return;
            const msId = inp.dataset.msStInp;
            const ms = goals.flatMap(g=>g.milestones||[]).find(m=>m.id===msId);
            const goalId = goals.find(g=>(g.milestones||[]).some(m=>m.id===msId))?.id;
            if (goalId && inp.value.trim()) { addSubtask(goalId, msId, inp.value); inp.value=''; }
        });
    }

    function showMsForm() {
        const form=document.getElementById('pg-ms-form'); if (!form) return;
        form.classList.remove('hidden');
        const inp=document.getElementById('pg-ms-title');
        if (inp) { inp.value=''; setTimeout(()=>inp.focus(), 80); }
        document.getElementById('pg-ms-desc')?.['value' in document.createElement('textarea') ? 'value' : 'value']?.set?.('');
        const desc=document.getElementById('pg-ms-desc'); if (desc) desc.value='';
        const dateEl=document.getElementById('pg-ms-date'); if (dateEl) dateEl.value='';
    }

    function hideMsForm() { document.getElementById('pg-ms-form')?.classList.add('hidden'); }

    function saveMsForm() {
        const title=(document.getElementById('pg-ms-title')?.value||'').trim();
        if (!title) { document.getElementById('pg-ms-title')?.focus(); return; }
        addMilestone(detailGoalId, {
            title,
            description: document.getElementById('pg-ms-desc')?.value||'',
            due_date:    document.getElementById('pg-ms-date')?.value||'',
        });
        hideMsForm();
    }

    // ── İstatistik Kartı ──────────────────────
    function renderStatsCard() {
        const el = document.getElementById('pg-stats-card-body');
        if (!el) return;
        if (goals.length===0) {
            el.innerHTML='<p style="color:var(--t2,#888);font-size:13px;">Henüz hedef yok.</p>'; return;
        }
        const active=goals.filter(g=>g.status==='active').length;
        const done=goals.filter(g=>g.status==='completed').length;
        const archived=goals.filter(g=>g.status==='archived').length;
        const totalMs=goals.reduce((s,g)=>(s+(g.milestones||[]).length),0);
        const doneMs=goals.reduce((s,g)=>(s+(g.milestones||[]).filter(m=>m.done).length),0);
        const avgPct=goals.length ? Math.round(goals.reduce((s,g)=>s+(g.progress_pct||0),0)/goals.length) : 0;

        const topGoals = goals.filter(g=>g.status!=='archived').sort((a,b)=>(b.progress_pct||0)-(a.progress_pct||0)).slice(0,5);

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

    // ══════════════════════════════════════════
    // HIZLI HEDEF OLUŞTUR — planning-quick-create.js dosyasına taşındı
    // (Faz 2, 2026-07-19). window._pgGetGoals() üzerinden goals dizisine
    // erişiyor; openQuickCreate/closeQuickCreate/_qcRender/_qcSave artık
    // window.* üzerinden çağrılıyor.
    // ══════════════════════════════════════════

    async function _qcStartCollab(goal) {
        try {
            const createBtn = document.getElementById('pg-qc-create-btn');
            if (createBtn) { createBtn.disabled = true; }

            // collab_rooms.goal_id -> planning_goals(id) FK'si var; persistGoals()'ın
            // arka planda çalışan _syncDirty()'sini beklemeden enableCollab çağrılırsa
            // hedef satırı Supabase'e henüz yazılmadan oda oluşturulmaya çalışılır,
            // FK ihlaliyle collab_rooms insert'i sessizce (console.warn) başarısız olur
            // ve davet kodu hiçbir zaman gerçek bir odayla eşleşmez ("Geçersiz davet kodu").
            // Bu yüzden hedefi burada senkron biçimde bekleyerek yazıyoruz.
            if (window.FocusSupabase && window.currentUser) {
                const { error: goalErr } = await window.FocusSupabase.from('planning_goals').upsert({
                    id: goal.id, user_id: window.currentUser.id, title: goal.title,
                    description: goal.description || '', category: goal.category,
                    color: goal.color, deadline: goal.deadline || null,
                    priority: goal.priority || 2, status: goal.status || 'active',
                    progress_pct: goal.progress_pct || 0,
                    milestone_count: (goal.milestones || []).length,
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'id' });
                if (goalErr) console.warn('[Collab] pre-create goal upsert error:', goalErr.message);
                else {
                    const g = goals.find(x => x.id === goal.id);
                    if (g) g._dirty = false;
                }
            }

            const { roomId, inviteCode } = await window.PlanningCollab.enableCollab(goal.id, goal.title);
            window._updateGoalCollabState?.(goal.id, { collab_room_id: roomId, invite_code: inviteCode, is_collaborative: true });
            await window.PlanningCollab.joinRoom(roomId, goal.id, 'owner');

            // Update goal in local storage with collab info
            const gIdx = goals.findIndex(g => g.id === goal.id);
            if (gIdx !== -1) {
                goals[gIdx].collab_room_id  = roomId;
                goals[gIdx].invite_code     = inviteCode;
                goals[gIdx].is_collaborative = true;
                persistGoals();
            }

            window._openCollabWaitOverlay({ ...goal, collab_room_id: roomId, invite_code: inviteCode });
        } catch(e) {
            toast('Collab başlatılamadı, tekrar deneyin.');
        } finally {
            const createBtn = document.getElementById('pg-qc-create-btn');
            if (createBtn) createBtn.disabled = false;
        }
    }
    window._qcStartCollab = _qcStartCollab;

    // Collab Wait Overlay state (_collabWaitPollTimer/_collabWaitGoal/
    // _collabInviteStatus/_cwFriendCache) → planning-collab-wait.js
    // dosyasına taşındı.

    // ── Sınıfa / Öğrenciye Ata (lesson_plan_assignments) ──────
    async function openAssignModal(goalId) {
        const goal = goals.find(g => g.id === goalId);
        if (!goal || !window.FocusSupabase || !window.currentUser) return;
        const sb = window.FocusSupabase, uid = window.currentUser.id;

        document.getElementById('pg-assign-modal')?.remove();
        const overlay = document.createElement('div');
        overlay.id = 'pg-assign-modal';
        overlay.className = 'modal-overlay';
        const today = new Date().toISOString().split('T')[0];
        overlay.innerHTML = `
            <div class="modal-content glass-panel pg-assign-modal-content">
                <header class="modal-header">
                    <h2><i class="ti ti-school"></i> Ders Planını Ata</h2>
                    <button id="pg-assign-close" class="icon-btn"><i class="fa-solid fa-xmark"></i></button>
                </header>
                <div class="modal-body">
                    <p class="pg-hint" style="margin-bottom:14px;">"${esc(goal.title)}" planını bir sınıfa veya öğrenciye ata.</p>
                    <div id="pg-assign-loading" class="pg-cw-loading"><span class="pg-cw-pulse-dot"></span> Sınıflar yükleniyor…</div>
                    <div id="pg-assign-body" style="display:none;">
                        <div class="form-group">
                            <label class="form-label">Sınıf</label>
                            <select id="pg-assign-group" class="premium-input modern-select pg-assign-select"></select>
                        </div>
                        <label class="pg-assign-all-row" for="pg-assign-all">
                            <input type="checkbox" id="pg-assign-all">
                            <span class="pg-assign-checkbox"></span>
                            <span class="pg-assign-all-label">Tüm sınıfa ata</span>
                        </label>
                        <div id="pg-assign-students" class="pg-assign-students"></div>
                        <div class="form-group" style="margin-top:14px;">
                            <label class="form-label">Son tarih (opsiyonel)</label>
                            <input id="pg-assign-deadline" type="date" class="premium-input pg-assign-select" value="${today}">
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" id="pg-assign-confirm" class="pg-assign-confirm-btn" disabled><i class="ti ti-send"></i> Ata</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);

        const close = () => overlay.remove();
        overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
        overlay.querySelector('#pg-assign-close').onclick = close;

        const loading = overlay.querySelector('#pg-assign-loading');
        const body    = overlay.querySelector('#pg-assign-body');
        let memberships;
        try {
            ({ data: memberships } = await sb
                .from('group_members').select('group_id, role, groups(id, name, classroom_type, code)')
                .eq('user_id', uid).eq('role', 'admin'));
        } catch (e) {
            console.warn('[FocusAI] openAssignModal:', e);
            loading.textContent = 'Sınıflar yüklenemedi. Bağlantını kontrol edip tekrar dene.';
            return;
        }
        const classGroups = (memberships || [])
            .map(m => m.groups).filter(g => g && (g.classroom_type === 'classroom' || g.classroom_type === 'workplace'));

        if (!classGroups.length) {
            loading.textContent = 'Yönettiğin bir sınıf/ekip grubu bulunamadı.';
            return;
        }
        loading.style.display = 'none';
        body.style.display = '';

        const groupSel = overlay.querySelector('#pg-assign-group');
        groupSel.innerHTML = classGroups.map(g => `<option value="${g.id}">${esc(g.name)}</option>`).join('');

        const allBox     = overlay.querySelector('#pg-assign-all');
        const studentsEl = overlay.querySelector('#pg-assign-students');
        const confirmBtn = overlay.querySelector('#pg-assign-confirm');

        let members = [];
        const loadMembers = async () => {
            studentsEl.innerHTML = '<div class="pg-cw-loading"><span class="pg-cw-pulse-dot"></span> Öğrenciler yükleniyor…</div>';
            let rows;
            try {
                ({ data: rows } = await sb
                    .from('group_members').select('user_id, profiles(id, display_name, username)')
                    .eq('group_id', groupSel.value));
            } catch (e) {
                console.warn('[FocusAI] loadMembers:', e);
                studentsEl.innerHTML = '<p class="pg-cw-empty">Öğrenciler yüklenemedi. Tekrar dene.</p>';
                return;
            }
            members = (rows || []).map(r => r.profiles).filter(p => p && p.id !== uid);
            studentsEl.innerHTML = members.length
                ? members.map(m => `
                    <label class="pg-assign-student-row" for="pg-assign-student-${m.id}">
                        <input type="checkbox" class="pg-assign-student" id="pg-assign-student-${m.id}" value="${m.id}">
                        <span class="pg-assign-checkbox"></span>
                        <span class="pg-assign-student-name">${esc(m.display_name || m.username)}</span>
                    </label>`).join('')
                : '<p class="pg-cw-empty">Bu grupta henüz öğrenci yok.</p>';
            _refreshAssignConfirm();
        };
        groupSel.onchange = loadMembers;
        await loadMembers();

        function _refreshAssignConfirm() {
            const anyChecked = allBox.checked || overlay.querySelectorAll('.pg-assign-student:checked').length > 0;
            confirmBtn.disabled = !anyChecked;
        }
        allBox.onchange = () => {
            studentsEl.querySelectorAll('.pg-assign-student').forEach(cb => { cb.checked = false; cb.disabled = allBox.checked; });
            _refreshAssignConfirm();
        };
        studentsEl.addEventListener('change', _refreshAssignConfirm);

        confirmBtn.onclick = async () => {
            confirmBtn.disabled = true;
            confirmBtn.innerHTML = '<i class="ti ti-loader-2 pg-sync-spin"></i> Atanıyor…';
            const groupId = groupSel.value;
            const targetIds = allBox.checked
                ? members.map(m => m.id)
                : Array.from(overlay.querySelectorAll('.pg-assign-student:checked')).map(cb => cb.value);
            const deadline = overlay.querySelector('#pg-assign-deadline').value || null;
            if (!targetIds.length) return;

            const rows = targetIds.map(studentId => ({
                goal_id: goal.id, group_id: groupId, teacher_id: uid, student_id: studentId,
                status: 'invited', deadline: deadline ? new Date(deadline + 'T23:59:59').toISOString() : null,
                goal_title: goal.title,
            }));
            const { error } = await sb.from('lesson_plan_assignments').upsert(rows, { onConflict: 'goal_id,student_id' });
            if (error) {
                window.dcShowToast?.('Atama başarısız: ' + error.message, 'error');
                confirmBtn.disabled = false;
                confirmBtn.innerHTML = '<i class="ti ti-send"></i> Ata';
                return;
            }
            const groupCode = classGroups.find(cg => cg.id === groupId)?.code || null;
            try {
                await sb.from('notifications').insert(targetIds.map(userId => ({
                    user_id: userId,
                    type: 'lesson_plan_new',
                    payload: { fromName: window.currentUser.displayName || window.currentUser.username, goalTitle: goal.title, groupId, groupCode },
                })));
            } catch (e) {
                console.warn('[FocusAI] lesson_plan_new bildirimi gönderilemedi:', e);
            }
            window.dcShowToast?.('Plan ' + targetIds.length + ' kişiye atandı.', 'success');
            close();
            // Atama, öğretmenin "kaydetmesi gereken" bir değişiklik değil — atama zaten
            // ayrı bir tabloya (lesson_plan_assignments) yazıldı. Yine de pvUnsaved açık
            // kalmışsa (atamadan önce plan üzerinde başka bir düzenleme yapılmışsa) hedefi
            // burada kaydedip bayrağı temizliyoruz ki çıkarken gereksiz "kaydedilmemiş
            // değişiklikler" uyarısı çıkmasın — atadıktan sonra tekrar Kaydet'e basmaya gerek yok.
            const liveGoal = goals.find(x => x.id === goal.id);
            if (liveGoal) { liveGoal._dirty = true; persistGoals(); }
            pvUnsaved = false;
            _pvRenderAssignmentStatus(goal);
        };
    }

    // ── Öğretmen tarafı: bu ders planının öğrencilere atanma durumu ──────
    // "Bekliyor / Onaylandı / Revize İstendi / Reddedildi / Tamamlandı" —
    // revize isteyen ve reddeden öğrenciler için not + tekrar gönder aksiyonu.
    // Reddedilenler 7 gün sonra (expires_at geçince) bir sonraki açılışta
    // otomatik temizlenir (cron yok, client-side lazy cleanup).
    const PVLPA_STATUS_META = {
        invited:            { label: 'Bekliyor',        cls: 'wait' },
        accepted:           { label: 'Onaylandı',       cls: 'ok' },
        revision_requested: { label: 'Revize İstendi',  cls: 'warn' },
        rejected:           { label: 'Reddedildi',      cls: 'bad' },
        completed:          { label: 'Tamamlandı',      cls: 'ok' },
    };
    async function _pvRenderAssignmentStatus(g) {
        const box = document.getElementById('pg-pv-assign-status');
        if (!box || !window.FocusSupabase || !window.currentUser) return;
        if (g.context?.isTemplate) { box.classList.add('hidden'); return; }
        const sb = window.FocusSupabase, myId = window.currentUser.id;

        let rows;
        try {
            // Süresi dolmuş reddedilenleri sessizce temizle (7 gün, migration 097)
            await sb.from('lesson_plan_assignments').delete()
                .eq('teacher_id', myId).eq('status', 'rejected').lt('expires_at', new Date().toISOString());

            ({ data: rows } = await sb.from('lesson_plan_assignments')
                .select('id, student_id, status, student_note, teacher_note, expires_at, progress_pct, profiles!lesson_plan_assignments_student_id_fkey(display_name, username)')
                .eq('goal_id', g.id).eq('teacher_id', myId));
        } catch (e) {
            console.warn('[FocusAI] _pvRenderAssignmentStatus:', e);
            box.classList.add('hidden');
            return;
        }
        if (!rows || !rows.length) { box.classList.add('hidden'); return; }

        box.classList.remove('hidden');
        box.innerHTML = `
            <div class="pg-pv-assign-status-title"><i class="ti ti-users"></i> Atama Durumu</div>
            <div class="pg-pv-assign-status-list">${rows.map(r => _lpaStatusRowHTML(r, false)).join('')}</div>`;

        box.querySelectorAll('.pg-pv-assign-resend-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader-2 pg-sync-spin"></i> Gönderiliyor…';
                const lpaId = btn.dataset.lpaId, studentId = btn.dataset.studentId;
                try {
                    await sb.from('lesson_plan_assignments').update({
                        status: 'invited', student_note: null, responded_at: null, expires_at: null,
                    }).eq('id', lpaId);
                    const groupCode = await _lpaGetGroupCode(sb, g.context?.lessonPlanGroupId);
                    await sb.from('notifications').insert([{
                        user_id: studentId, type: 'lesson_plan_new',
                        payload: { fromName: window.currentUser.displayName || window.currentUser.username, goalTitle: g.title, resent: true, groupCode },
                    }]);
                    window.dcShowToast?.('Plan tekrar gönderildi.', 'success');
                    _pvRenderAssignmentStatus(g);
                } catch (e) {
                    console.warn('[FocusAI] plan tekrar gönderme hatası:', e);
                    window.dcShowToast?.('Gönderilemedi, tekrar dene.', 'error');
                    btn.disabled = false; btn.innerHTML = 'Tekrar Gönder';
                }
            });
        });
    }
    window._pvRenderAssignmentStatus = _pvRenderAssignmentStatus;

    // Tek bir atama satırının HTML'i — hem tek-plan (yukarıdaki) hem gruba-özel
    // (Sınıf Paneli > Ders Planı) görünümde paylaşılır. `showGoalTitle` gruba-özel
    // görünümde birden fazla plan karışabileceği için başlığı da gösterir.
    // `opts.deleteStatuses`: hangi durumlarda "Sil" butonu gösterilsin (öğrenci sadece
    // rejected'ı silebilir — RLS öyle izin veriyor; öğretmen kendi kaydı olduğu için
    // hem revision_requested hem rejected'ı silebilir).
    function _lpaStatusRowHTML(r, showGoalTitle, showResendBtn, opts) {
        showResendBtn = showResendBtn !== false;
        opts = opts || {};
        const deleteStatuses = opts.deleteStatuses || [];
        const meta = PVLPA_STATUS_META[r.status] || { label: r.status, cls: '' };
        const name = esc(r.profiles?.display_name || r.profiles?.username || '?');
        const daysLeft = r.status === 'rejected' && r.expires_at ? Math.max(0, Math.ceil((new Date(r.expires_at) - Date.now()) / 86400000)) : null;
        return `
        <div class="pg-pv-assign-row${opts.isStudentView ? ' pg-pv-assign-row--premium' : ''}" data-lpa-id="${r.id}" data-goal-id="${r.goal_id || ''}">
            ${!opts.isStudentView ? `<span class="pg-pv-assign-name">${name}</span>` : ''}
            ${showGoalTitle ? `<span class="pg-pv-assign-goal">${esc(r.goal_title || '')}</span>` : ''}
            <span class="pg-pv-assign-badge ${meta.cls}${opts.isStudentView ? ' pg-pv-assign-badge--end' : ''}">${meta.label}</span>
            ${r.status === 'accepted' || r.status === 'completed' ? `<span class="pg-pv-assign-progress">%${r.progress_pct || 0}</span>` : ''}
            ${r.student_note ? `<div class="pg-pv-assign-note"><i class="ti ti-message-circle"></i> ${esc(r.student_note)}</div>` : ''}
            ${daysLeft !== null ? `<span class="pg-pv-assign-expiry">${daysLeft} gün sonra otomatik silinir</span>` : ''}
            ${(opts.showEditBtn && r.status === 'revision_requested') ? `
            <button class="pg-lpa-mini-btn pg-pv-assign-edit-btn" data-goal-id="${r.goal_id}" title="Planı düzenle">
                <i class="ti ti-pencil"></i> Düzenle
            </button>` : ''}
            ${(showResendBtn && (r.status === 'revision_requested' || r.status === 'rejected')) ? `
            <button class="control-btn secondary pg-pv-assign-resend-btn" data-lpa-id="${r.id}" data-student-id="${r.student_id}" data-goal-title="${esc(r.goal_title || '')}">
                <i class="ti ti-send"></i> Planı Düzenledim, Tekrar Gönder
            </button>` : ''}
            ${deleteStatuses.includes(r.status) ? `
            <button class="pg-lpa-mini-btn pg-pv-assign-delete-btn" data-lpa-id="${r.id}" title="Şimdi sil">
                <i class="ti ti-trash"></i> Sil
            </button>` : ''}
        </div>`;
    }
    // planning-lesson-plan-invites.js modülünün öğrenci davet listesinde
    // kullanabilmesi için köprü.
    window._lpaStatusRowHTML = _lpaStatusRowHTML;

    // Bir grubun kısa katılım kodunu (bildirim onClick'inde Sınıf Paneli'ni doğrudan
    // açabilmek için) uuid'sinden bulur — küçük bir önbellekle tekrar sorgulamayı önler.
    const _lpaGroupCodeCache = {};
    async function _lpaGetGroupCode(sb, groupId) {
        if (!groupId) return null;
        if (_lpaGroupCodeCache[groupId] !== undefined) return _lpaGroupCodeCache[groupId];
        try {
            const { data } = await sb.from('groups').select('code').eq('id', groupId).maybeSingle();
            return (_lpaGroupCodeCache[groupId] = data?.code || null);
        } catch (e) {
            console.warn('[FocusAI] _lpaGetGroupCode:', e);
            return null;
        }
    }

    // Sınıf Paneli > Ders Planı sekmesi — öğretmen tarafı: bu gruptaki TÜM ders planı
    // atamalarının durumu. Kategoriler (Aktif / Revize / Reddedilenler) ayrı sekmeler
    // halinde — hepsi aynı anda listelense çok yer kaplıyordu, artık sadece seçili
    // kategori render ediliyor (bkz. kullanıcı geri bildirimi).
    // "Aktif" sadece kabul edilmeyi BEKLEYEN atamaları gösterir — öğrenci kabul edince
    // (veya tamamlayınca) buradan düşer, yoksa zamanla çok fazla veri birikip liste
    // kullanılamaz hale geliyordu (bkz. kullanıcı geri bildirimi).
    const LPA_GROUP_TABS = [
        { key: 'active',   label: 'Aktif',        statuses: ['invited'] },
        { key: 'revision', label: 'Revize',        statuses: ['revision_requested'] },
        { key: 'rejected', label: 'Reddedilenler', statuses: ['rejected'] },
    ];
    // "Yeni Ders Planı Oluştur" butonu, sekme çubuğuyla aynı satırda (sağda) —
    // Planlama modülünü açıp ders planı oluşturma akışını başlatır.
    const _lpaCreateBtnHtml = `
        <button id="cp-asg-goto-lessonplan-btn" class="control-btn secondary pg-lpa-create-btn">
            <i class="fa-solid fa-book-open-reader"></i> Yeni Ders Planı Oluştur
        </button>`;
    function _lpaBindCreateBtn(containerEl) {
        containerEl.querySelector('#cp-asg-goto-lessonplan-btn')?.addEventListener('click', () => {
            if (typeof window.switchTab === 'function') window.switchTab('planlama');
            setTimeout(() => { if (typeof window.openLessonPlanModal === 'function') window.openLessonPlanModal(); }, 150);
        });
    }

    // Sekme değişiminde ağdan tekrar veri çekmek (fetch+delete round-trip'i) buton
    // tıklamasından geçişe kadar gözle görülür bir gecikmeye yol açıyordu (bkz.
    // kullanıcı geri bildirimi) — bu yüzden sekmeler arası geçiş, ilk yüklemede
    // önbelleğe alınan satırlar üzerinden anında (senkron) render edilir; veri
    // ancak groupId değiştiğinde veya bir aksiyon (sil/tekrar gönder) sonrası
    // sunucudan yeniden çekilir.
    function _lpaRenderTabs(groupId, containerEl, rows) {
        containerEl._lpaRows = rows;
        const buckets = {};
        LPA_GROUP_TABS.forEach(t => { buckets[t.key] = rows.filter(r => t.statuses.includes(r.status)); });
        let activeTab = containerEl.dataset.lpaActiveTab;
        if (!activeTab || !buckets[activeTab]) activeTab = LPA_GROUP_TABS.find(t => buckets[t.key].length)?.key || 'active';
        containerEl.dataset.lpaActiveTab = activeTab;

        containerEl.innerHTML = `
            <div class="pg-lpa-tabs-row">
                <div class="pg-lpa-tabs">
                    ${LPA_GROUP_TABS.map(t => `
                    <button class="pg-lpa-tab-btn${t.key === activeTab ? ' active' : ''}" data-tab="${t.key}">
                        ${esc(t.label)}${buckets[t.key].length ? ` <span class="pg-lpa-tab-count">${buckets[t.key].length}</span>` : ''}
                    </button>`).join('')}
                </div>
                ${_lpaCreateBtnHtml}
            </div>
            <div class="pg-pv-assign-status-list">${buckets[activeTab].length
                ? buckets[activeTab].map(r => _lpaStatusRowHTML(r, true, true, { showEditBtn: true, deleteStatuses: ['revision_requested', 'rejected'] })).join('')
                : '<p class="cp-hint">Bu kategoride kayıt yok.</p>'}</div>`;

        _lpaBindCreateBtn(containerEl);
        containerEl.querySelectorAll('.pg-lpa-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (btn.dataset.tab === containerEl.dataset.lpaActiveTab) return;
                containerEl.dataset.lpaActiveTab = btn.dataset.tab;
                _lpaRenderTabs(groupId, containerEl, containerEl._lpaRows || []);
            });
        });
        containerEl.querySelectorAll('.pg-pv-assign-edit-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (btn.dataset.goalId && typeof window.openPlanView === 'function') window.openPlanView(btn.dataset.goalId);
            });
        });
        containerEl.querySelectorAll('.pg-pv-assign-delete-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                let ok;
                try {
                    ok = await window.showFocusaiConfirm({
                        title: 'Ders Planı Kaydını Sil',
                        desc: 'Bu atama kaydı kalıcı olarak silinsin mi? Bu işlem geri alınamaz.',
                        type: 'danger', icon: 'fa-trash-can', confirmText: 'Sil', cancelText: 'Vazgeç',
                    });
                } catch (e) { console.warn('[FocusAI] sessiz hata:', e); return; }
                if (!ok) return;
                btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader-2 pg-sync-spin"></i>';
                try {
                    await window.FocusSupabase.from('lesson_plan_assignments').delete().eq('id', btn.dataset.lpaId);
                    renderGroupLessonPlanStatus(groupId, containerEl);
                } catch (e) {
                    console.warn('[FocusAI] lesson_plan_assignments silme hatası:', e);
                    btn.disabled = false; btn.innerHTML = 'Sil';
                }
            });
        });
        containerEl.querySelectorAll('.pg-pv-assign-resend-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const sb = window.FocusSupabase;
                btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader-2 pg-sync-spin"></i> Gönderiliyor…';
                const lpaId = btn.dataset.lpaId, studentId = btn.dataset.studentId, goalTitle = btn.dataset.goalTitle;
                try {
                    await sb.from('lesson_plan_assignments').update({
                        status: 'invited', student_note: null, responded_at: null, expires_at: null,
                    }).eq('id', lpaId);
                    const groupCode = await _lpaGetGroupCode(sb, groupId);
                    await sb.from('notifications').insert([{
                        user_id: studentId, type: 'lesson_plan_new',
                        payload: { fromName: window.currentUser.displayName || window.currentUser.username, goalTitle, resent: true, groupCode },
                    }]);
                    window.dcShowToast?.('Plan tekrar gönderildi.', 'success');
                    containerEl.dataset.lpaActiveTab = 'active';
                    renderGroupLessonPlanStatus(groupId, containerEl);
                } catch (e) {
                    console.warn('[FocusAI] plan tekrar gönderme hatası:', e);
                    window.dcShowToast?.('Gönderilemedi, tekrar dene.', 'error');
                    btn.disabled = false; btn.innerHTML = 'Tekrar Gönder';
                }
            });
        });
    }

    async function renderGroupLessonPlanStatus(groupId, containerEl) {
        if (!containerEl || !window.FocusSupabase || !window.currentUser) return;
        const sb = window.FocusSupabase, myId = window.currentUser.id;

        let rows;
        try {
            await sb.from('lesson_plan_assignments').delete()
                .eq('teacher_id', myId).eq('status', 'rejected').lt('expires_at', new Date().toISOString());

            ({ data: rows } = await sb.from('lesson_plan_assignments')
                .select('id, goal_id, student_id, status, student_note, teacher_note, expires_at, progress_pct, goal_title, profiles!lesson_plan_assignments_student_id_fkey(display_name, username)')
                .eq('group_id', groupId).eq('teacher_id', myId)
                .order('assigned_at', { ascending: false }));
        } catch (e) {
            console.warn('[FocusAI] renderGroupLessonPlanStatus:', e);
            containerEl.innerHTML = '<p class="cp-hint">Ders planı durumu yüklenemedi. Tekrar dene.</p>';
            return;
        }
        if (!rows || !rows.length) {
            containerEl.innerHTML = `
                <div class="pg-lpa-tabs-row">
                    <p class="cp-hint" style="margin:0;">Bu sınıf için henüz atanmış bir ders planı yok.</p>
                    ${_lpaCreateBtnHtml}
                </div>`;
            _lpaBindCreateBtn(containerEl);
            return;
        }
        _lpaRenderTabs(groupId, containerEl, rows);
    }
    window.renderGroupLessonPlanStatus = renderGroupLessonPlanStatus;

    // _openCollabWaitOverlay/_closeCollabWaitOverlay/_cwAvatarColor/
    // _collabWaitLoadFriends/_collabWaitSendInvite/_collabWaitShowWaitingSection/
    // _collabWaitRefreshWaitingList/_collabWaitRefreshAccepted →
    // planning-collab-wait.js dosyasına taşındı (Faz 2, 2026-07-19).

    // openModeSelect, closeModeSelect, openLessonPlanModal, _lpHideAllSteps,
    // _lpShowChoiceStep, _lpUpdateBrowseCounts, _lpRenderListStep,
    // _lpShowTemplatesListStep, _lpShowInstancesListStep, _lpBindExistingListEvents,
    // _lpShowTemplateStep, _lpShowFormStep, _lpSetTarget, _cloneMilestonesForTemplate,
    // _cloneTasksForTemplate, _applyTemplateTasksToGoal, _pvSaveGoalAsTemplate,
    // _lpSaveTemplate, _lpLoadStudents, _lpRenderStudentPicker, closeLessonPlanModal,
    // _lpSave -> planning-lesson-plan-modal.js dosyasına taşındı (Faz 2, 2026-07-20).
    // window.* köprüsüyle erişilir. Bu modül planning.js'ten ÖNCE yüklenmeli
    // (init() içinde bu fonksiyonlar senkron addEventListener'a bağlanıyor).

    // Öğretmen/kurum yöneticisi bir sınıf/ders grubunda admin ise "Ders Planı" modu açılır
    let _wzLessonPlanGroups = null; // cache: [{id, name, classroom_type}] | []
    // planning-lesson-plan-modal.js modülünün önbelleği okuyabilmesi için köprü
    // (kendisi burada kalıyor çünkü cardHTML de kullanıyor).
    window._wzGetLessonPlanGroups = () => _wzLessonPlanGroups;
    async function _wzCheckLessonPlanGroups() {
        // FocusSupabase/currentUser henüz hazır değilse sonucu ÖNBELLEKLEME —
        // aksi halde erken (login tamamlanmadan) çağrılan init() bu boş sonucu
        // kalıcı olarak önbelleğe alır ve "Ders Planı" hiç görünmez.
        if (!window.FocusSupabase || !window.currentUser) return [];
        const sb = window.FocusSupabase, uid = window.currentUser.id;
        try {
            const { data: memberships } = await sb
                .from('group_members').select('group_id, role, groups(id, name, classroom_type)')
                .eq('user_id', uid).eq('role', 'admin');
            _wzLessonPlanGroups = (memberships || [])
                .map(m => m.groups).filter(g => g && (g.classroom_type === 'classroom' || g.classroom_type === 'workplace'));
            return _wzLessonPlanGroups;
        } catch (e) {
            console.warn('[FocusAI] _wzCheckLessonPlanGroups:', e);
            return []; // önbelleğe alınmaz (_wzLessonPlanGroups null kalır) — bir sonraki çağrıda tekrar denenir
        }
    }
    window._wzCheckLessonPlanGroups = _wzCheckLessonPlanGroups;

    // openWizard, closeWizard, _wzRenderStep, _wzValidate, _wzNext, _wzBack ve tüm
    // 5-adımlı Hedef Oluşturma Sihirbazı (_wz* — ~2150 satır: adım render'ları,
    // booking takvimi, mini gantt, akordeon, günlük/haftalık/aylık takvim ızgarası,
    // _wzSave) -> planning-milestone-wizard.js dosyasına taşındı (Faz 2, 2026-07-20).
    // wizardState/_wzCalYear/_wzCalMonth state'i de o dosyaya taşındı (planning.js'in
    // başka hiçbir yerinde kullanılmıyordu). window.openWizard/closeWizard/_wzNext/
    // _wzBack köprüleriyle erişilir.
    // ÖNEMLİ: init() closeWizard/_wzNext/_wzBack'i SENKRON addEventListener'a
    // bağladığı için bu modül planning.js'ten ÖNCE yüklenmeli.


    // ── Goal Modal ────────────────────────────
    function openGoalModal(editId) {
        editingId=editId||null;
        const modal=document.getElementById('pg-goal-modal'); if (!modal) return;
        if (editId) {
            const g=goals.find(g=>g.id===editId); if (!g) return;
            document.getElementById('pg-goal-title').value=g.title;
            document.getElementById('pg-goal-desc').value=g.description||'';
            document.getElementById('pg-goal-category').value=g.category;
            document.getElementById('pg-goal-priority').value=g.priority||2;
            document.getElementById('pg-goal-deadline').value=g.deadline||'';
            document.getElementById('pg-modal-title').textContent='Hedefi Düzenle';
        } else {
            document.getElementById('pg-goal-form').reset();
            document.getElementById('pg-modal-title').textContent='Yeni Hedef';
        }
        modal.classList.remove('hidden');
        setTimeout(()=>document.getElementById('pg-goal-title')?.focus(), 120);
    }
    // planning-milestone-wizard.js'in modal DOM'u bulamazsa (#pg-wizard-modal
    // yoksa) düştüğü basit fallback için köprü.
    window.openGoalModal = openGoalModal;

    function closeGoalModal() {
        document.getElementById('pg-goal-modal')?.classList.add('hidden');
        editingId=null;
    }

    function handleGoalSubmit(e) {
        e.preventDefault();
        const title=document.getElementById('pg-goal-title').value.trim();
        if (!title) { document.getElementById('pg-goal-title').focus(); return; }
        const data={
            title,
            description: document.getElementById('pg-goal-desc').value,
            category:    document.getElementById('pg-goal-category').value,
            priority:    document.getElementById('pg-goal-priority').value,
            deadline:    document.getElementById('pg-goal-deadline').value,
        };
        if (editingId) updateGoal(editingId, data); else addGoal(data);
        closeGoalModal();
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

    // ── Collab bridge fonksiyonları ───────────
    // collab.js tarafından çağrılır
    window._updateGoalCollabState = function(goalId, fields) {
        const g = goals.find(g=>g.id===goalId);
        if (!g) return;
        Object.assign(g, fields);
        g._dirty = true;
        persistGoals();
        render();
    };

    window._applyInviteJoin = async function(result) {
        // result: { roomId, goalId, role }
        let g = goals.find(x => x.id === result.goalId);

        if (!g && window.FocusSupabase) {
            // Goal local'de yok — sunucudan çek
            try {
                const { data: row } = await window.FocusSupabase
                    .from('planning_goals')
                    .select('*')
                    .eq('id', result.goalId)
                    .maybeSingle();
                if (row) {
                    // Milestone'ları da çek
                    const { data: ms } = await window.FocusSupabase
                        .from('planning_milestones')
                        .select('*')
                        .eq('goal_id', result.goalId)
                        .order('order_index');
                    g = {
                        ...row,
                        milestones:    (ms || []),
                        collab_room_id: result.roomId,
                        my_role:        result.role,
                        _dirty:         false,
                    };
                    goals.unshift(g);
                    persistGoals();
                    render();
                }
            } catch(e) {
                console.warn('[_applyInviteJoin] fetch error:', e);
            }
        } else if (g) {
            g.collab_room_id = result.roomId;
            g.my_role        = result.role;
            g._dirty         = true;
            persistGoals();
            render();
        }

        // Realtime kanalına bağlan ve start_planning sinyalini bekle
        if (g && window.PlanningCollab) {
            try {
                await window.PlanningCollab.joinRoom(result.roomId, result.goalId, result.role);
            } catch (e) {
                console.warn('[FocusAI] PlanningCollab.joinRoom:', e);
                return;
            }
            window.PlanningCollab.setHandlers({
                onStartPlanning: (payload) => {
                    if (payload.goalId === result.goalId) {
                        toast('Planlama başlatıldı! 🚀');
                        setTimeout(() => openPlanView(result.goalId), 300);
                    }
                },
                onMilestoneChange: (type, payload) => {
                    const gLive = goals.find(x => x.id === result.goalId);
                    if (!gLive) return;
                    if (type === 'toggle' && payload.msId) {
                        const ms = (gLive.milestones || []).find(m => m.id === payload.msId);
                        if (ms) { ms.done = payload.done; _recalcProgress(gLive); gLive._dirty = true; persistGoals(); }
                    } else if (type === 'add' && payload.milestone) {
                        gLive.milestones = gLive.milestones || [];
                        if (!gLive.milestones.find(m => m.id === payload.milestone.id)) {
                            gLive.milestones.push(payload.milestone); gLive._dirty = true; persistGoals();
                        }
                    } else if (type === 'delete' && payload.msId) {
                        gLive.milestones = (gLive.milestones || []).filter(m => m.id !== payload.msId);
                        _recalcProgress(gLive); gLive._dirty = true; persistGoals();
                    } else if (type === 'batch_set' && payload.milestones) {
                        gLive.milestones = payload.milestones; _recalcProgress(gLive); gLive._dirty = true; persistGoals();
                    } else if (type === 'update' && payload.msId) {
                        const ms = (gLive.milestones || []).find(m => m.id === payload.msId);
                        if (ms) { Object.assign(ms, payload.fields); gLive._dirty = true; persistGoals(); }
                    }
                    render();
                },
                onTaskChange: (type, payload) => {
                    let tasks = FocusStorage.get('tasks', []);
                    let changed = false;
                    if (type === 'add' && payload.task) {
                        if (!tasks.find(t => t.id === payload.task.id)) { tasks.push(payload.task); changed = true; }
                    } else if (type === 'delete' && payload.taskId) {
                        const before = tasks.length;
                        tasks = tasks.filter(t => t.id !== payload.taskId);
                        changed = tasks.length !== before;
                    } else if (type === 'toggle' && payload.taskId) {
                        const t = tasks.find(x => x.id === payload.taskId);
                        if (t) { t.completed = payload.completed; changed = true; }
                    } else if (type === 'sync' && payload.tasks) {
                        payload.tasks.forEach(incoming => {
                            if (!tasks.find(t => t.id === incoming.id)) { tasks.push(incoming); changed = true; }
                        });
                    }
                    if (changed) {
                        FocusStorage.set('tasks', tasks);
                        if (typeof window.syncTasksFromStorage === 'function') window.syncTasksFromStorage();
                    }
                    if (typeof window.renderTasks === 'function') window.renderTasks();
                },
                onProgressChange: (payload) => {
                    const gLive = goals.find(x => x.id === result.goalId);
                    if (!gLive) return;
                    gLive.progress_pct = payload.pct; gLive._dirty = true; persistGoals(); render();
                },
                onPresenceChange: () => { window.PlanningCollab._renderPresence(); },
                onWizState: (payload) => {
                    if (payload.goalId !== result.goalId) return;
                    pvWiz = payload.wiz;
                    const gLive = goals.find(x => x.id === result.goalId);
                    if (gLive) { _pvRenderStepper(gLive); _pvRenderMainCal(gLive); }
                },
            });
        }

        return g; // caller navigate edecek
    };

    // ── Toast ─────────────────────────────────
    function toast(msg, opts) {
        // opts: { undoFn, undoLabel, duration }
        let el=document.getElementById('pg-toast');
        if (!el) { el=document.createElement('div'); el.id='pg-toast'; el.className='pg-toast'; document.body.appendChild(el); }
        el.innerHTML=''; el.classList.add('show');
        clearTimeout(el._t);
        const span=document.createElement('span'); span.textContent=msg; el.appendChild(span);
        if (opts?.undoFn) {
            const btn=document.createElement('button'); btn.className='pg-toast-undo'; btn.textContent=opts.undoLabel||'Geri Al';
            btn.onclick=()=>{ clearTimeout(el._t); el.classList.remove('show'); opts.undoFn(); };
            el.appendChild(btn);
        }
        el._t=setTimeout(()=>el.classList.remove('show'), opts?.duration||2800);
    }
    window.toast = toast;

    // Collab hedef silindiğinde diğer üyelere bildirim gönder
    async function _notifyCollabMembersGoalDeleted(goal) {
        if (!window.FocusSupabase) return;
        // Auth kullanıcısını doğrudan Supabase'den al (currentUser race condition'ına karşı)
        let authId = window.currentUser?.id;
        if (!authId) {
            try {
                const { data: { user } } = await window.FocusSupabase.auth.getUser();
                authId = user?.id;
            } catch (_) { console.warn('[FocusAI] sessiz hata:', _); }
        }
        if (!authId) return;

        const cu = window.currentUser || {};
        const fromName     = cu.displayName || cu.username || cu.email?.split('@')[0] || 'Biri';
        const fromUsername = cu.username || '';

        let members = [];
        try {
            const { data, error } = await window.FocusSupabase
                .from('collab_room_members')
                .select('user_id')
                .eq('room_id', goal.collab_room_id);
            if (error) console.warn('[CollabNotif] members fetch error:', error.message);
            members = (data || []).filter(m => m.user_id !== authId);
        } catch(e) { console.warn('[CollabNotif] members fetch exception:', e); }

        for (const m of members) {
            try {
                const { error } = await window.FocusSupabase.from('notifications').insert({
                    user_id: m.user_id,
                    type: 'collab_goal_deleted',
                    payload: {
                        fromName, fromUsername,
                        goalId: goal.id,
                        goalTitle: goal.title,
                        roomId: goal.collab_room_id,
                    }
                });
                if (error) console.warn('[CollabNotif] insert error:', error.message);
            } catch(e) { console.warn('[CollabNotif] insert exception:', e); }
        }
    }

    // Collab hedefi solo'ya çevir
    async function _convertGoalToSolo(id) {
        const g = goals.find(x=>x.id===id);
        if (!g) return;
        const roomId = g.collab_room_id;
        g.collab_room_id = null;
        g.is_collaborative = false;
        g.invite_code = null;
        g._dirty = true;
        persistGoals(); render();
        window.PlanningCollab?.leaveRoom?.();
        if (window.FocusSupabase && window.currentUser) {
            try {
                await window.FocusSupabase.from('planning_goals').update({
                    collab_room_id: null,
                    is_collaborative: false,
                    invite_code: null,
                }).eq('id', id);
            } catch (_) { console.warn('[FocusAI] sessiz hata:', _); }
        }
        toast('Planlama solo\'ya çevrildi');
    }

    // Collab silme onay modalı (silen kişi için)
    function _showCollabDeleteModal(g, depSnapshot) {
        document.getElementById('pg-collab-delete-modal')?.remove();
        const esc = window.escapeHtml || (s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'));
        const overlay = document.createElement('div');
        overlay.id = 'pg-collab-delete-modal';
        overlay.className = 'modal-overlay';
        overlay.style.cssText = 'z-index:100090;';
        overlay.innerHTML = `
            <div class="modal-content glass-panel" style="text-align:center;">
                <div class="modal-icon-wrapper warning">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                </div>
                <h2 style="margin-bottom:10px;color:#fff;">Planı Kaldır</h2>
                <p style="color:var(--text-muted);font-size:14px;line-height:1.6;margin-bottom:6px;">
                    <strong style="color:rgba(255,255,255,.85);">"${esc(g.title)}"</strong> başlıklı ortak planı kaldırmak üzeresiniz.
                </p>
                <p style="color:var(--text-muted);font-size:13px;line-height:1.5;margin-bottom:22px;">
                    Planı silmek yerine bireysel olarak sürdürerek tüm görev ve ilerlemenizi koruyabilirsiniz.
                </p>
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:20px;">
                    <button id="pg-cdm-cancel" class="cdm-btn cdm-btn--ghost">Vazgeç</button>
                    <button id="pg-cdm-solo"   class="cdm-btn cdm-btn--purple">Bireysel Sürdür</button>
                    <button id="pg-cdm-delete" class="cdm-btn cdm-btn--danger">Kalıcı Olarak Sil</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);

        overlay.querySelector('#pg-cdm-cancel').addEventListener('click', () => overlay.remove());
        overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

        overlay.querySelector('#pg-cdm-solo').addEventListener('click', async () => {
            overlay.remove();
            await _notifyCollabMembersGoalDeleted(g);
            await _convertGoalToSolo(g.id);
        });

        overlay.querySelector('#pg-cdm-delete').addEventListener('click', async () => {
            overlay.remove();
            await _notifyCollabMembersGoalDeleted(g);
            const snapshot = g;
            deleteGoal(g.id);
            toast(`"${snapshot.title}" silindi`, {
                undoFn: () => {
                    goals.unshift(snapshot);
                    depSnapshot.forEach(d=>{ if(!window._pgGetDependencies().find(x=>x.id===d.id)) window._pgGetDependencies().push(d); });
                    persistGoals(); window.saveDependencies(); render();
                    toast('Geri alındı ↩');
                },
                undoLabel: 'Geri Al',
                duration: 4000,
            });
        });
    }

    // Silme işlemleri için undo destekli silme
    function _deleteGoalWithUndo(id) {
        const g = goals.find(x=>x.id===id);
        if (!g) return;
        const snapshot = JSON.parse(JSON.stringify(g));
        const depSnapshot = window._pgGetDependencies().filter(d=>d.from===id||d.to===id);
        // Collab hedefler için seçenek modalı göster
        if (g.collab_room_id) {
            _showCollabDeleteModal(snapshot, depSnapshot);
            return;
        }
        deleteGoal(id);
        toast(`"${snapshot.title}" silindi`, {
            undoFn: () => {
                goals.unshift(snapshot);
                depSnapshot.forEach(d=>{ if(!window._pgGetDependencies().find(x=>x.id===d.id)) window._pgGetDependencies().push(d); });
                persistGoals(); window.saveDependencies(); render();
                toast('Geri alındı ↩');
            },
            undoLabel: 'Geri Al',
            duration: 4000,
        });
    }
    window._deleteGoalWithUndo = _deleteGoalWithUndo;

    function _deleteMilestoneWithUndo(goalId, msId) {
        const g = goals.find(x=>x.id===goalId);
        const ms = (g?.milestones||[]).find(m=>m.id===msId);
        if (!g||!ms) return;
        const snapshot = JSON.parse(JSON.stringify(ms));
        deleteMilestone(goalId, msId);
        toast(`"${snapshot.title}" silindi`, {
            undoFn: () => {
                const g2 = goals.find(x=>x.id===goalId);
                if (!g2) return;
                g2.milestones = g2.milestones||[];
                g2.milestones.splice(snapshot.order||g2.milestones.length, 0, snapshot);
                _recalcProgress(g2); g2._dirty=true;
                persistGoals(); render(); renderMilestoneList(goalId);
                toast('Geri alındı ↩');
            },
            undoLabel: 'Geri Al',
            duration: 4000,
        });
    }

    // ── Init ──────────────────────────────────
    function init() {
        loadGoals();
        window.loadDependencies();
        // Hard reset sonrası PlanView'i geri aç
        const lastGoalId = localStorage.getItem('pg_pv_last_goal');
        if (lastGoalId && goals.find(g => g.id === lastGoalId)) {
            setTimeout(() => openPlanView(lastGoalId), 300);
        }
        // 4.1 — Server'dan güncel veriyi çek (arka planda)
        setTimeout(loadGoalsFromServer, 600);
        // 4.2 — Realtime subscription
        setTimeout(window._subscribeRealtime, 1200);
        // 4.3 — Bildirim izni + deadline taraması
        setTimeout(_requestNotificationPermission, 3000);
        setTimeout(window._checkDeadlineNotifications, 4000);
        setInterval(window._checkDeadlineNotifications, 3600000); // Saatte bir kontrol

        // Filter — tek bir dropdown butonu içinde
        const filterToggleBtn = document.getElementById('pg-filter-toggle-btn');
        const filterToggleLabel = document.getElementById('pg-filter-toggle-label');
        const filterMenu = document.getElementById('pg-filter-menu');
        filterToggleBtn?.addEventListener('click', e => {
            e.stopPropagation();
            const willOpen = filterMenu.classList.contains('hidden');
            filterMenu.classList.toggle('hidden', !willOpen);
            filterToggleBtn.classList.toggle('open', willOpen);
        });
        document.addEventListener('click', e => {
            if (!filterMenu || filterMenu.classList.contains('hidden')) return;
            if (!filterMenu.contains(e.target) && e.target !== filterToggleBtn) {
                filterMenu.classList.add('hidden');
                filterToggleBtn?.classList.remove('open');
            }
        });
        const _pgUpdateFilterLabel = () => {
            if (!filterToggleLabel) return;
            if (activeFilters.has('__archived__') || activeFilters.has('__completed__')) {
                filterToggleLabel.textContent = 'Tümü';
                return;
            }
            if (activeFilters.size === 1) {
                const only = [...activeFilters][0];
                const btn = document.querySelector(`.pg-filter-btn[data-cat="${only}"]`);
                filterToggleLabel.textContent = btn?.dataset.label || 'Tümü';
            } else {
                filterToggleLabel.textContent = `${activeFilters.size} filtre`;
            }
        };
        const _pgSyncFilterButtons = () => {
            document.querySelectorAll('.pg-filter-btn').forEach(b =>
                b.classList.toggle('active', activeFilters.has(b.dataset.cat)));
            document.getElementById('pg-archive-toggle-btn')?.classList.toggle('active', activeFilters.has('__archived__'));
            document.getElementById('pg-completed-toggle-btn')?.classList.toggle('active', activeFilters.has('__completed__'));
        };
        document.querySelectorAll('.pg-filter-btn').forEach(btn=>
            btn.addEventListener('click', ()=>{
                const cat = btn.dataset.cat;
                if (cat === 'all') {
                    // Tekil / dışlayıcı seçim: diğer her şeyi temizler
                    activeFilters = new Set([cat]);
                    filterMenu?.classList.add('hidden');
                    filterToggleBtn?.classList.remove('open');
                } else {
                    // Çoklu seçilebilir filtreler — Arşiv/Başardıklarım/Tümü seçiliyse önce onları temizle
                    activeFilters.delete('all');
                    activeFilters.delete('__archived__');
                    activeFilters.delete('__completed__');
                    // Gecikmiş ve Bu Hafta birbiriyle çelişir (bir hedef ikisi olamaz) — aynı anda seçilemezler
                    if (cat === '__overdue__') activeFilters.delete('__thisweek__');
                    if (cat === '__thisweek__') activeFilters.delete('__overdue__');
                    if (activeFilters.has(cat)) activeFilters.delete(cat);
                    else activeFilters.add(cat);
                    if (activeFilters.size === 0) activeFilters.add('all');
                }
                _pgSyncFilterButtons();
                _pgUpdateFilterLabel();
                render();
            }));

        // Arşiv — filtre menüsünden bağımsız, kendi başına açılıp kapanan bir görünüm anahtarı
        const archiveToggleBtn = document.getElementById('pg-archive-toggle-btn');
        archiveToggleBtn?.addEventListener('click', () => {
            const isArchiveMode = activeFilters.has('__archived__');
            activeFilters = isArchiveMode ? new Set(['all']) : new Set(['__archived__']);
            _pgSyncFilterButtons();
            _pgUpdateFilterLabel();
            render();
        });

        // Başardıklarım — tamamlanan hedefler, arşivden ayrı bağımsız görünüm anahtarı
        const completedToggleBtn = document.getElementById('pg-completed-toggle-btn');
        completedToggleBtn?.addEventListener('click', () => {
            const isCompletedMode = activeFilters.has('__completed__');
            activeFilters = isCompletedMode ? new Set(['all']) : new Set(['__completed__']);
            _pgSyncFilterButtons();
            _pgUpdateFilterLabel();
            render();
        });


        // New goal — mod seçimi açar
        document.getElementById('pg-new-goal-btn')?.addEventListener('click', ()=>window.openModeSelect());
        document.getElementById('pg-empty-add-btn')?.addEventListener('click', ()=>window.openModeSelect());

        // Mode select modal
        document.getElementById('pg-mode-select-close')?.addEventListener('click', window.closeModeSelect);
        document.getElementById('pg-mode-select-overlay')?.addEventListener('click', e => {
            if (e.target.id === 'pg-mode-select-overlay') window.closeModeSelect();
        });
        document.getElementById('pg-mode-solo-btn')?.addEventListener('click', () => {
            window.closeModeSelect();
            window.openQuickCreate('solo');
        });
        document.getElementById('pg-mode-collab-btn')?.addEventListener('click', () => {
            window.closeModeSelect();
            window.openQuickCreate('collab');
        });
        document.getElementById('pg-mode-lesson-plan-btn')?.addEventListener('click', () => {
            window.closeModeSelect();
            window.openLessonPlanModal();
        });

        // Ders Planı oluşturma (minimal: sınıf + açıklama)
        document.getElementById('pg-lp-modal-close')?.addEventListener('click', window.closeLessonPlanModal);
        document.getElementById('pg-lp-modal')?.addEventListener('click', e => {
            if (e.target.id === 'pg-lp-modal') window.closeLessonPlanModal();
        });
        window._lpBindExistingListEvents();
        document.getElementById('pg-lp-choice-template')?.addEventListener('click', window._lpShowTemplateStep);
        document.getElementById('pg-lp-choice-instance')?.addEventListener('click', () => window._lpShowFormStep());
        document.getElementById('pg-lp-template-back-btn')?.addEventListener('click', window._lpShowChoiceStep);
        document.getElementById('pg-lp-browse-templates')?.addEventListener('click', window._lpShowTemplatesListStep);
        document.getElementById('pg-lp-browse-instances')?.addEventListener('click', window._lpShowInstancesListStep);
        document.getElementById('pg-lp-templates-back-btn')?.addEventListener('click', window._lpShowChoiceStep);
        document.getElementById('pg-lp-instances-back-btn')?.addEventListener('click', window._lpShowChoiceStep);
        document.getElementById('pg-lp-template-save-btn')?.addEventListener('click', window._lpSaveTemplate);
        document.getElementById('pg-lp-back-btn')?.addEventListener('click', window._lpShowChoiceStep);
        document.getElementById('pg-lp-target-class')?.addEventListener('click', () => window._lpSetTarget('class'));
        document.getElementById('pg-lp-target-student')?.addEventListener('click', () => window._lpSetTarget('student'));
        document.getElementById('pg-lp-group')?.addEventListener('change', window._lpLoadStudents);
        document.getElementById('pg-lp-save-btn')?.addEventListener('click', window._lpSave);
        document.getElementById('pg-lp-students')?.addEventListener('change', e => {
            if (e.target.classList.contains('pg-lp-student-cb')) window._lpRenderStudentPicker(document.getElementById('pg-lp-student-search')?.value);
        });
        document.getElementById('pg-lp-student-chips')?.addEventListener('click', e => {
            const chip = e.target.closest('.pg-lp-student-chip');
            if (!chip) return;
            const cb = document.getElementById(`pg-lp-student-${chip.dataset.id}`);
            if (cb) { cb.checked = false; window._lpRenderStudentPicker(document.getElementById('pg-lp-student-search')?.value); }
        });

        // Wizard event bindings
        document.getElementById('pg-wz-close')?.addEventListener('click', window.closeWizard);
        document.getElementById('pg-wizard-modal')?.addEventListener('click', e => {
            if (e.target.id === 'pg-wizard-modal') window.closeWizard();
        });
        document.getElementById('pg-wz-next')?.addEventListener('click', window._wzNext);
        document.getElementById('pg-wz-back')?.addEventListener('click', window._wzBack);

        // Hızlı ekleme satırı
        const quickInp = document.getElementById('pg-quick-add-input');
        if (quickInp) {
            quickInp.addEventListener('keydown', e => {
                if (e.key === 'Enter' && e.shiftKey) {
                    e.preventDefault();
                    const val = quickInp.value.trim();
                    if (val) { document.getElementById('pg-goal-title').value = val; }
                    quickInp.value = '';
                    openGoalModal();
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    const val = quickInp.value.trim();
                    if (!val) return;
                    const _catFilter = [...activeFilters].find(f => CATEGORY_KEYS.includes(f));
                    addGoal({ title: val, category: _catFilter || 'diger', priority: 2 });
                    quickInp.value = '';
                    quickInp.blur();
                } else if (e.key === 'Escape') {
                    quickInp.value = ''; quickInp.blur();
                }
            });
        }

        // Goal modal
        document.getElementById('pg-modal-close') ?.addEventListener('click', closeGoalModal);
        document.getElementById('pg-modal-cancel')?.addEventListener('click', closeGoalModal);
        document.getElementById('pg-goal-modal')  ?.addEventListener('click', e=>{ if (e.target.id==='pg-goal-modal') closeGoalModal(); });
        document.getElementById('pg-goal-form')   ?.addEventListener('submit', handleGoalSubmit);

        // Detail panel
        document.getElementById('pg-dp-back')       ?.addEventListener('click', closeDetailPanel);
        document.getElementById('pg-dp-close')      ?.addEventListener('click', closeDetailPanel);
        document.getElementById('pg-detail-overlay')?.addEventListener('click', closeDetailPanel);

        // Milestone form
        document.getElementById('pg-dp-add-ms')?.addEventListener('click', showMsForm);
        document.getElementById('pg-ms-cancel')?.addEventListener('click', hideMsForm);
        document.getElementById('pg-ms-save')  ?.addEventListener('click', saveMsForm);
        document.getElementById('pg-ms-title') ?.addEventListener('keydown', e=>{ if (e.key==='Enter') { e.preventDefault(); saveMsForm(); } });

        // Progress slider
        document.getElementById('pg-dp-slider')?.addEventListener('input', e=>{
            const el=document.getElementById('pg-dp-slider-val');
            if (el) el.textContent=e.target.value+'%';
        });
        document.getElementById('pg-dp-save-progress')?.addEventListener('click', ()=>{
            if (!detailGoalId) return;
            updateGoalProgress(detailGoalId, parseInt(document.getElementById('pg-dp-slider')?.value||0));
            toast('İlerleme kaydedildi ✓');
        });

        // ESC
        document.addEventListener('keydown', e=>{
            if (e.key==='Escape') {
                const wz=document.getElementById('pg-wizard-modal');
                if (wz&&!wz.classList.contains('hidden')) { window.closeWizard(); return; }
                const modal=document.getElementById('pg-goal-modal');
                if (modal&&!modal.classList.contains('hidden')) { closeGoalModal(); return; }
                if (detailGoalId) closeDetailPanel();
            }
        });

        // Plan view bindings
        _pvInitBindings();

        // İlk yüklemede takvimi senkronize et
        if (typeof window.syncAllMilestonesToCalendar==='function')
            setTimeout(window.syncAllMilestonesToCalendar, 800);

        render();
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

    // ══════════════════════════════════════════
    // BİRLEŞİK PLAN GÖRÜNÜMÜ — Faz 3
    // ══════════════════════════════════════════

    let pvGoalId   = null;
    let pvActiveMsId = null;
    let pvSeqMode  = false;
    // Öğrenci, öğretmenin kendisine atadığı planı "İncele" ile açtığında salt okunur
    // önizleme modu — aynı takvim/aşama arayüzü kullanılır, sadece düzenleme/kaydetme/
    // atama aksiyonları gizlenir. `pvReadOnlyTempId` önizleme için `goals`'a geçici
    // (persist edilmeyen) olarak eklenen sahte hedefin id'sidir; kapatılınca silinir.
    let pvReadOnly = false;
    let pvReadOnlyTempId = null;
    // planning-lesson-plan-invites.js'teki önizleme açma akışının bu iki
    // değişkeni ayarlayabilmesi için köprü (doğrudan yazılamıyorlar, modül
    // dışı bir dosyadan referans veremez).
    window._pgSetPvReadOnlyPreview = (val, tempId) => { pvReadOnly = val; pvReadOnlyTempId = tempId; };
    // "Mevcut Görevlerimi Gör" — salt okunur önizlemede öğrencinin kendi (öğretmenin
    // planı dışındaki) görevlerini gün panelinde ek olarak gösterip çakışanları işaretler.
    let pvReadOnlyShowOwnTasks = false;
    let pvCalYear  = new Date().getFullYear();
    let pvCalMonth = new Date().getMonth();
    let pvCalView  = 'month'; // 'month' | 'week' | 'day' — sadece ders planı için
    let pvWeekCursor = null;
    let pvDayCursor  = null;
    function _pvIsLessonPlan(g) { return g?.plan_mode === 'lesson-plan'; }
    window._pvIsLessonPlan = _pvIsLessonPlan;

    // ── Ders planı: "Kaydet" butonu + kapatmadan önce kaydedilmemiş değişiklik uyarısı ──
    let pvUnsaved = false;

    // ── Kişiye özel ders planlamasında öğrencinin dolu saatleri (bilgi amaçlı) ──
    let pvShowBusy = false;
    let pvBusySlots = null;       // [{task_date, time_start, time_end, is_overnight}] | null (yüklenmedi)
    let pvBusyStudentId = null;   // hangi öğrenci için yüklendiği (cache anahtarı)
    let pvBusySlotsLoaded = false; // cacheKey için yükleme gerçekten tamamlandı mı (boş sonuç da geçerli sayılsın diye)

    function _pvBusyTargetStudentId(g) {
        return _pvIsLessonPlan(g) ? (g.context?.lessonPlanStudentId || null) : null;
    }

    // Sınıfa özel planlarda çakışma kontrolü gruptaki HERKESE karşı yapılmalı —
    // isim de gösterebilmek için üye listesini (id + ad) ayrıca önbelleğe alıyoruz.
    let pvGroupMembersCache = null; // { groupId, members: [{id, display_name, username}] }
    async function _pvGroupMembers(groupId) {
        if (!groupId || !window.FocusSupabase) return [];
        if (pvGroupMembersCache?.groupId === groupId) return pvGroupMembersCache.members;
        const myId = window.currentUser?.id;
        try {
            const { data } = await window.FocusSupabase
                .from('group_members').select('user_id, profiles(id, display_name, username)')
                .eq('group_id', groupId);
            const members = (data || []).map(r => r.profiles).filter(p => p && p.id !== myId);
            pvGroupMembersCache = { groupId, members };
            return members;
        } catch (e) {
            console.warn('[FocusAI] _pvGroupMembers:', e);
            return [];
        }
    }

    async function _pvLoadBusySlots(g) {
        const groupId = g.context?.lessonPlanGroupId;
        if (!groupId || !window.FocusSupabase) { pvBusySlots = []; return; }
        const studentId = _pvBusyTargetStudentId(g);
        const cacheKey = studentId || `group:${groupId}`;
        // Not: boş dizi de geçerli bir sonuç olduğundan (JS'te [] truthy'dir), cache kontrolünü
        // ayrı bir "yüklendi" bayrağıyla yapıyoruz — yoksa geçici/erken boş sonuç kalıcı
        // önbelleğe girip "Dolu Saatler" butonu tekrar basılsa bile yenilenmiyordu.
        if (pvBusyStudentId === cacheKey && pvBusySlotsLoaded) return; // zaten yüklü
        try {
            if (studentId) {
                const { data, error } = await window.FocusSupabase
                    .rpc('lesson_plan_student_busy_slots', { p_student_id: studentId, p_group_id: groupId });
                pvBusySlots = error ? [] : (data || []).map(s => ({ ...s, student_id: studentId }));
                if (error) { pvBusyStudentId = null; pvBusySlotsLoaded = false; return; }
            } else {
                // Sınıfa özel: gruptaki her öğrencinin dolu saatlerini tek tek çekip birleştiriyoruz
                // (RPC tek öğrenci alıyor, çoklu-öğrenci varyantı yok — döngüyle çözülüyor).
                const members = await _pvGroupMembers(groupId);
                const results = await Promise.all(members.map(m =>
                    window.FocusSupabase.rpc('lesson_plan_student_busy_slots', { p_student_id: m.id, p_group_id: groupId })
                        .then(({ data, error }) => error ? [] : (data || []).map(s => ({ ...s, student_id: m.id })))
                ));
                pvBusySlots = results.flat();
            }
        } catch (e) {
            console.warn('[FocusAI] _pvLoadBusySlots:', e);
            pvBusySlots = [];
            pvBusyStudentId = null; pvBusySlotsLoaded = false;
            return;
        }
        pvBusyStudentId = cacheKey;
        pvBusySlotsLoaded = true;
    }

    // dateStr (YYYY-MM-DD) + saat (0-23) dolu mu?
    function _pvIsBusyHour(dateStr, hour) {
        if (!pvShowBusy || !pvBusySlots) return false;
        const cellStart = hour * 60, cellEnd = cellStart + 60;
        return pvBusySlots.some(s => {
            if (s.task_date !== dateStr) return false;
            const startMin = _pvTimeToMinLocal((s.time_start || '00:00').slice(0,5));
            let endMin = _pvTimeToMinLocal((s.time_end || '00:00').slice(0,5));
            if (s.is_overnight || endMin <= startMin) endMin = 24 * 60;
            return startMin < cellEnd && endMin > cellStart;
        });
    }

    // dateStr (YYYY-MM-DD) içinde herhangi bir dolu saat var mı? (aylık görünüm — gün bazlı özet)
    function _pvIsBusyDay(dateStr) {
        if (!pvShowBusy || !pvBusySlots) return false;
        return pvBusySlots.some(s => s.task_date === dateStr);
    }

    function _pvBusyToggleBtn(g) {
        if (!_pvBusyTargetStudentId(g)) return '';
        const legend = pvShowBusy ? `<span class="pg-pv-busy-legend"><span class="pg-pv-busy-legend-swatch"></span>Öğrencinin dolu saati</span>` : '';
        return `<button type="button" class="pg-pv-main-cal-today-btn pg-pv-busy-toggle-btn${pvShowBusy?' active':''}" id="pg-pv-busy-toggle" title="Öğrencinin dolu saatlerini göster (sadece bilgi amaçlı)">
            <i class="ti ti-eye${pvShowBusy?'':'-off'}"></i> Dolu Saatler
        </button>${legend}`;
    }

    function _pvBindBusyToggle(el, g) {
        const btn = el.querySelector('#pg-pv-busy-toggle');
        if (!btn) return;
        btn.addEventListener('click', async () => {
            pvShowBusy = !pvShowBusy;
            if (pvShowBusy) await _pvLoadBusySlots(g);
            _pvRenderMainCal(g);
        });
    }

    // ── Çakışma kontrolü: seçilen tarih/saat aralığı öğrencinin dolu bir dilimiyle kesişiyor mu? ──
    let pvSuppressBusyWarning = false; // "bir daha gösterme" — sadece bu planlama oturumu boyunca geçerli
    function _pvBusyConflict(dateStr, timeStart, timeEnd) {
        if (!pvBusySlots || !pvBusySlots.length) return null;
        const rangeStart = _pvTimeToMinLocal((timeStart || '00:00').slice(0,5));
        let rangeEnd = _pvTimeToMinLocal((timeEnd || '00:00').slice(0,5));
        if (rangeEnd <= rangeStart) rangeEnd = 24 * 60;
        return pvBusySlots.find(s => {
            if (s.task_date !== dateStr) return false;
            const startMin = _pvTimeToMinLocal((s.time_start || '00:00').slice(0,5));
            let endMin = _pvTimeToMinLocal((s.time_end || '00:00').slice(0,5));
            if (s.is_overnight || endMin <= startMin) endMin = 24 * 60;
            return startMin < rangeEnd && endMin > rangeStart;
        }) || null;
    }

    // Profesyonel onay modalı — "bu uyarıyı bir daha gösterme" seçeneğiyle
    function _pvShowConflictModal({ timeStart, timeEnd, studentName, onConfirm }) {
        const overlay = document.createElement('div');
        overlay.className = 'pg-pv-conflict-overlay';
        overlay.innerHTML = `
            <div class="pg-pv-conflict-box">
                <div class="pg-pv-conflict-icon"><i class="ti ti-alert-triangle"></i></div>
                <div class="pg-pv-conflict-title">Zaman çakışması</div>
                <div class="pg-pv-conflict-msg">
                    <b>${esc(timeStart)}–${esc(timeEnd)}</b> saat aralığında ${studentName ? `<b>${esc(studentName)}</b>'nin` : 'öğrencinin'} planında başka bir görevi görünüyor.
                    Yine de bu saate ders eklemek istiyor musunuz?
                </div>
                <label class="pg-pv-conflict-suppress">
                    <input type="checkbox" id="pg-pv-conflict-suppress-chk">
                    Bu uyarıyı bir daha gösterme (bu oturum için)
                </label>
                <div class="pg-pv-conflict-actions">
                    <button type="button" class="pg-pv-conflict-btn pg-pv-conflict-cancel" id="pg-pv-conflict-cancel">Vazgeç</button>
                    <button type="button" class="pg-pv-conflict-btn pg-pv-conflict-confirm" id="pg-pv-conflict-confirm">Yine de Ekle</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);
        const close = () => overlay.remove();
        overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
        overlay.querySelector('#pg-pv-conflict-cancel').addEventListener('click', close);
        overlay.querySelector('#pg-pv-conflict-confirm').addEventListener('click', () => {
            if (overlay.querySelector('#pg-pv-conflict-suppress-chk')?.checked) pvSuppressBusyWarning = true;
            close();
            onConfirm();
        });
    }

    // Ders planında "Kaydet" butonuna basınca: dirty senkronu zorla + görsel geri bildirim
    function _pvExplicitSave(g) {
        const live = goals.find(x => x.id === g.id);
        if (live) live._dirty = true;
        persistGoals();
        pvUnsaved = false;
        _pvRenderHeader(live || g);
        toast('Plan kaydedildi ✓', '#06d6a0');
    }

    // Kapat / Tüm Hedefler'e basıldığında kaydedilmemiş değişiklik varsa gösterilen onay modalı
    function _pvShowUnsavedModal({ onSaveExit, onDiscardExit }) {
        const overlay = document.createElement('div');
        overlay.className = 'pg-pv-conflict-overlay';
        overlay.innerHTML = `
            <div class="pg-pv-conflict-box">
                <div class="pg-pv-conflict-icon"><i class="ti ti-device-floppy"></i></div>
                <div class="pg-pv-conflict-title">Kaydedilmemiş değişiklikler</div>
                <div class="pg-pv-conflict-msg">
                    Bu planda henüz kaydedilmemiş değişiklikler var. Çıkmadan önce ne yapmak istersiniz?
                </div>
                <div class="pg-pv-conflict-actions" style="flex-direction:column;gap:8px;">
                    <button type="button" class="pg-pv-conflict-btn pg-pv-conflict-confirm" id="pg-pv-unsaved-save" style="width:100%;">Kaydet ve Çık</button>
                    <div style="display:flex;gap:8px;width:100%;">
                        <button type="button" class="pg-pv-conflict-btn pg-pv-conflict-cancel" id="pg-pv-unsaved-cancel">Vazgeç</button>
                        <button type="button" class="pg-pv-conflict-btn pg-pv-conflict-discard" id="pg-pv-unsaved-discard">Kaydetmeden Çık</button>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(overlay);
        const close = () => overlay.remove();
        overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
        overlay.querySelector('#pg-pv-unsaved-cancel').addEventListener('click', close);
        overlay.querySelector('#pg-pv-unsaved-save').addEventListener('click', () => { close(); onSaveExit(); });
        overlay.querySelector('#pg-pv-unsaved-discard').addEventListener('click', () => { close(); onDiscardExit(); });
    }

    // Öğrenci "Kabul Et"e hiç basmadan (pending_accept=true iken) düzenleme arayüzünü
    // kapatırsa, materialize() sırasında takvime yazılmış görevler ve taslak hedef
    // tamamen geri alınır — kabul edilmemiş bir plan asla takvimde kalıcı görünmemeli.
    function _pvDiscardUnacceptedGoal(g) {
        if (!g || !g.pending_accept) return;
        const goalId = g.id;
        const allTasks = FocusStorage.get('tasks', []);
        const removedTaskIds = allTasks.filter(t => String(t.parentGoal) === String(goalId)).map(t => t.id);
        const remainingTasks = allTasks.filter(t => String(t.parentGoal) !== String(goalId));
        if (remainingTasks.length !== allTasks.length) FocusStorage.set('tasks', remainingTasks);
        const events = FocusStorage.get('events', {});
        let eventsChanged = false;
        Object.keys(events).forEach(dateKey => {
            const filtered = (events[dateKey] || []).filter(e => String(e.parentGoal) !== String(goalId));
            if (filtered.length !== (events[dateKey] || []).length) {
                eventsChanged = true;
                if (filtered.length) events[dateKey] = filtered; else delete events[dateKey];
            }
        });
        if (eventsChanged) FocusStorage.set('events', events);
        goals = goals.filter(x => x.id !== goalId);
        persistGoals();
        if (typeof window.syncTasksFromStorage === 'function') window.syncTasksFromStorage();
        if (typeof window.renderTasksGlobal === 'function') window.renderTasksGlobal();
        if (typeof window.renderCalendarGlobal === 'function') window.renderCalendarGlobal();

        // Taslak zaten sunucuya yazılmış olabilir (_syncDirty upsert'i) — sadece yerelden
        // silmek yetmez, yoksa bir sonraki loadGoalsFromServer()/pullAll() bu satırları
        // geri indirip taslağı ve görevlerini "hayalet" olarak yeniden canlandırır.
        const sb = window.FocusSupabase;
        if (sb && window.currentUser) {
            if (removedTaskIds.length) {
                sb.from('tasks').delete().in('id', removedTaskIds).then(({ error }) => {
                    if (error) console.warn('[FocusSync] taslak görev silme hatası:', error.message);
                });
            }
            sb.from('planning_milestones').delete().eq('goal_id', goalId).then(({ error }) => {
                if (error) console.warn('[FocusSync] taslak milestone silme hatası:', error.message);
            });
            sb.from('planning_goals').delete().eq('id', goalId).then(({ error }) => {
                if (error) console.warn('[FocusSync] taslak goal silme hatası:', error.message);
            });
        }
    }

    // pg-pv-back ve pg-pv-close ortak çıkış noktası: burada "zaman çakışması var" uyarısı
    // GÖSTERİLMEZ — kullanıcı çakışmayı düzeltmeden de çıkabilir (çakışma bir sonraki
    // girişte hâlâ ilgili yerlerde vurgulanır). Sadece kaydedilmemiş değişiklik var mı
    // diye sorulur: değişiklik yoksa direkt kapanır, varsa Kaydet/Kaydetmeden Çık/Vazgeç sorulur.
    function _pvHandleExitClick() {
        const g = goals.find(x => x.id === pvGoalId);
        if (g?.pending_accept) {
            // Kabul edilmemiş taslak: hiç değişiklik yapılmadıysa (pvUnsaved false)
            // sessizce geri al — kaydedecek bir şey yok. Ama öğrenci çakışmaları
            // düzeltmek için saat/gün değiştirdiyse (pvUnsaved true), diğer ders
            // planlarında olduğu gibi Kaydet/Kaydetmeden Çık/Vazgeç sorulmalı —
            // aksi halde yaptığı düzeltmeler sessizce çöpe gidiyordu.
            if (pvUnsaved) {
                _pvShowUnsavedModal({
                    onSaveExit: () => { _pvExplicitSave(g); closePlanView(); },
                    onDiscardExit: () => { _pvDiscardUnacceptedGoal(g); pvUnsaved = false; closePlanView(); },
                });
                return;
            }
            _pvDiscardUnacceptedGoal(g);
            pvUnsaved = false;
            closePlanView();
            return;
        }
        if (pvUnsaved && _pvIsLessonPlan(g)) {
            _pvShowUnsavedModal({
                onSaveExit: () => { _pvExplicitSave(g); closePlanView(); },
                onDiscardExit: () => { pvUnsaved = false; closePlanView(); },
            });
            return;
        }
        closePlanView();
    }

    // ── Milestone Wizard State ────────────────
    let pvWiz = null; // { step:'welcome'|'count'|'names'|'dates'|'done', count:0, names:[], dateIdx:0 }

    const PV_MOTIVATION = {
        egitim:  ['Her uzman bir zamanlar acemiydi.', 'Öğrenmek zihnin en büyük macerasıdır.', 'Bilgi, taşıması en hafif yüktür.'],
        saglik:  ['Vücudunuz en büyük yatırımınızdır.', 'Her adım daha güçlü bir versiyona doğru.', 'Sağlık servetten üstündür.'],
        kariyer: ['Kariyer bir maraton, sprint değil.', 'Başarı küçük çabaların birikmesidir.', 'Her büyük kariyer bir küçük adımla başlar.'],
        finans:  ['Finansal özgürlük bir yolculuktur.', 'Bugünkü disiplin yarının özgürlüğüdür.', 'Servet, tutarlı kararların ürünüdür.'],
        kisisel: ['En önemli proje kendinizsiniz.', 'Büyüme konfor alanınızın dışında başlar.', 'Her gün daha iyi bir versiyon mümkün.'],
        diger:   ['Büyük hedefler cesur kalplerle başlar.', 'Planlamak başarının yarısıdır.', 'Her harika sonuç net bir niyetle başlar.'],
    };

    function openPlanView(goalId) {
        const g = goals.find(x => x.id === goalId);
        if (!g) return;
        pvGoalId       = goalId;
        pvSeqMode      = false;
        pvCalYear      = new Date().getFullYear();
        pvCalMonth     = new Date().getMonth();
        pvSelectedDate = null;
        pvWiz          = null;
        pvCalView      = 'month';
        pvWeekCursor   = null;
        pvDayCursor    = null;
        pvShowBusy     = false;
        pvBusySlots    = null;
        pvBusyStudentId = null;
        pvBusySlotsLoaded = false;
        pvSuppressBusyWarning = false;
        localStorage.setItem('pg_pv_last_goal', goalId);
        // Görsel toggle kapalı olsa bile çakışma kontrolü için dolu saatleri arka planda önden yükle
        if (_pvIsLessonPlan(g)) _pvLoadBusySlots(g);
        // Bu düzeltmeden ÖNCE takvimden saat saat eklenmiş ama hiç aynalanmamış (dolayısıyla
        // hiç senkronize olmamış) görevleri geriye dönük olarak aşamaya çevir — öğretmen planı
        // tekrar açtığında öğrenciye ulaşmayan eski içerik kendiliğinden düzelsin.
        // NOT: pvUnsaved bayrağı bu otomatik senkronizasyondan SONRA sıfırlanır, aksi halde
        // persistGoals() içindeki dirty-flag mantığı kullanıcı hiçbir şey yapmadan
        // "kaydedilmemiş değişiklik" uyarısını tetikliyordu.
        if (_pvIsLessonPlan(g) && !pvReadOnly) _pvBackfillMirrors(g);
        pvUnsaved = false;

        const firstIncomplete = (g.milestones || []).find(m => !m.done);
        pvActiveMsId = firstIncomplete?.id || g.milestones?.[0]?.id || null;

        document.getElementById('pg-plan-view')?.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        _pvRender(g);

        // ── Collab: realtime kanalı başlat ──
        if (window.PlanningCollab && g.collab_room_id) {
            window.PlanningCollab.joinRoom(g.collab_room_id, g.id, g.my_role || 'owner');
            // Kendi task'larını odaya broadcast et — diğer kullanıcılar eksiklerini tamamlar
            setTimeout(() => {
                if (window.PlanningCollab?.channel) {
                    const myTasks = FocusStorage.get('tasks', []).filter(t => String(t.parentGoal) === String(goalId));
                    if (myTasks.length)
                        window.PlanningCollab.broadcast('sync_tasks', { goalId, tasks: myTasks });
                }
            }, 1200);
            window.PlanningCollab.setHandlers({
                onMilestoneChange: (type, payload) => {
                    const gLive = goals.find(x => x.id === pvGoalId);
                    if (!gLive) return;
                    if (type === 'toggle' && payload.msId) {
                        const ms = (gLive.milestones || []).find(m => m.id === payload.msId);
                        if (ms) { ms.done = payload.done; _recalcProgress(gLive); gLive._dirty = true; persistGoals(); }
                    } else if (type === 'add' && payload.milestone) {
                        gLive.milestones = gLive.milestones || [];
                        if (!gLive.milestones.find(m => m.id === payload.milestone.id)) {
                            gLive.milestones.push(payload.milestone);
                            gLive._dirty = true;
                            persistGoals();
                        }
                    } else if (type === 'delete' && payload.msId) {
                        gLive.milestones = (gLive.milestones || []).filter(m => m.id !== payload.msId);
                        _recalcProgress(gLive);
                        gLive._dirty = true;
                        persistGoals();
                    } else if (type === 'batch_set' && payload.milestones) {
                        gLive.milestones = payload.milestones;
                        _recalcProgress(gLive);
                        gLive._dirty = true;
                        persistGoals();
                    } else if (type === 'update' && payload.msId) {
                        const ms = (gLive.milestones || []).find(m => m.id === payload.msId);
                        if (ms) { Object.assign(ms, payload.fields); gLive._dirty = true; persistGoals(); }
                    }
                    _pvRender(gLive);
                    render();
                },
                onTaskChange: (type, payload) => {
                    let tasks = FocusStorage.get('tasks', []);
                    let events = FocusStorage.get('events', {});
                    let changed = false;

                    // Helper: sync a task into calendarEvents so the sidebar calendar shows it
                    const _syncEvent = (task) => {
                        if (!task.date) return;
                        if (!events[task.date]) events[task.date] = [];
                        if (!events[task.date].find(e => e.id === task.id)) {
                            events[task.date].push({
                                id: task.id, text: task.text,
                                timeStart: task.timeStart, timeEnd: task.timeEnd,
                                priority: task.priority, parentGoal: task.parentGoal,
                                parentHabit: task.parentHabit || '', isOvernight: task.isOvernight || false,
                            });
                        }
                    };
                    const _removeEvent = (taskId) => {
                        Object.keys(events).forEach(d => {
                            events[d] = (events[d] || []).filter(e => e.id !== taskId);
                        });
                    };

                    if (type === 'add' && payload.task) {
                        if (!tasks.find(t => t.id === payload.task.id)) {
                            const newTask = {
                                ...payload.task,
                                ...(payload.user_name ? { _addedBy: { name: payload.user_name, color: payload.user_color || '#888' } } : {})
                            };
                            tasks.push(newTask);
                            _syncEvent(newTask);
                            changed = true;
                        }
                    } else if (type === 'pending' && payload.task) {
                        if (!tasks.find(t => t.id === payload.task.id)) {
                            const newTask = { ...payload.task, _pending: true,
                                _addedBy: { name: payload.user_name, color: payload.user_color } };
                            tasks.push(newTask);
                            // pending görevler onaylanana kadar sidebar'da gözükmesin
                            changed = true;
                        }
                    } else if (type === 'approve' && payload.taskId) {
                        const t = tasks.find(x => x.id === payload.taskId);
                        if (t && t._pending) { delete t._pending; _syncEvent(t); changed = true; }
                    } else if (type === 'reject' && payload.taskId) {
                        _removeEvent(payload.taskId);
                        const before = tasks.length;
                        tasks = tasks.filter(t => t.id !== payload.taskId);
                        changed = tasks.length !== before;
                    } else if (type === 'delete' && payload.taskId) {
                        _removeEvent(payload.taskId);
                        const before = tasks.length;
                        tasks = tasks.filter(t => t.id !== payload.taskId);
                        changed = tasks.length !== before;
                    } else if (type === 'toggle' && payload.taskId) {
                        const t = tasks.find(x => x.id === payload.taskId);
                        if (t) { t.completed = payload.completed; changed = true; }
                    } else if (type === 'sync' && payload.tasks) {
                        payload.tasks.forEach(incoming => {
                            if (!tasks.find(t => t.id === incoming.id)) {
                                tasks.push(incoming);
                                if (!incoming._pending) _syncEvent(incoming);
                                changed = true;
                            }
                        });
                    }
                    if (changed) {
                        FocusStorage.set('tasks', tasks);
                        FocusStorage.set('events', events);
                        if (typeof window.syncTasksFromStorage === 'function') window.syncTasksFromStorage();
                        // Sidebar calendar must reflect the new task immediately
                        if (typeof window.renderCalendarGlobal === 'function') window.renderCalendarGlobal();
                    }
                    const gLive = goals.find(x => x.id === pvGoalId);
                    if (gLive) { _pvRenderDayPanel(gLive, pvSelectedDate); _pvRenderMainCal(gLive); }
                    if (typeof window.renderTasks === 'function') window.renderTasks();
                    // Ghost toast — sadece karşı taraftan gelen olaylarda göster
                    if (payload.user_name && window.PlanningCollab) {
                        const actionLabels = { add:'görev ekledi', pending:'görev önerdi', delete:'görevi sildi', toggle:'görevi tamamladı', approve:'görevi onayladı', reject:'görevi reddetti' };
                        _pvUpdateActivityFeed({
                            user_name: payload.user_name,
                            user_color: payload.user_color || '#888',
                            action: type,
                            action_label: actionLabels[type] || type,
                            target: payload.task?.text || payload.taskText || '',
                            created_at: new Date().toISOString(),
                        });
                    }
                },
                onProgressChange: (payload) => {
                    const gLive = goals.find(x => x.id === pvGoalId);
                    if (!gLive) return;
                    gLive.progress_pct = payload.pct;
                    gLive._dirty = true;
                    persistGoals();
                    _pvRenderHeader(gLive);
                    _pvUpdateOverallProgress(gLive);
                    render();
                },
                onPresenceChange: () => {
                    window.PlanningCollab._renderPresence();
                    const gLive = goals.find(x => x.id === pvGoalId);
                    if (gLive) {
                        _pvRenderMainCal(gLive);
                        if (pvSelectedDate) _pvRenderDayPanel(gLive, pvSelectedDate);
                    }
                },
                onStartPlanning: () => {},
                onWizState: (payload) => {
                    if (payload.goalId !== pvGoalId) return;
                    pvWiz = payload.wiz;
                    const gLive = goals.find(x => x.id === pvGoalId);
                    if (gLive) {
                        _pvRenderStepper(gLive);
                        _pvRenderMainCal(gLive);
                    }
                },
            });
        }
    }

    // ── Öneri 3: Ghost Toast bildirimi → planning-ghost-toast.js dosyasına taşındı ──
    const _pvUpdateActivityFeed = (...args) => window._pvUpdateActivityFeed?.(...args);

    function closePlanView() {
        document.getElementById('pg-plan-view')?.classList.add('hidden');
        document.body.style.overflow = '';
        pvGoalId = null; pvActiveMsId = null;
        localStorage.removeItem('pg_pv_last_goal');
        // Collab kanalını kapat
        if (window.PlanningCollab?.isActive()) {
            window.PlanningCollab.leaveRoom();
        }
        // Salt okunur önizleme kapanıyorsa geçici sahte hedefi VE onun için yazılan
        // geçici görevleri (bkz. _toggleLessonPlanPreview) temizle — kalıcı değiller.
        if (pvReadOnly) {
            if (pvReadOnlyTempId) {
                goals = goals.filter(x => x.id !== pvReadOnlyTempId);
                const remainingTasks = FocusStorage.get('tasks', []).filter(t => t.parentGoal !== pvReadOnlyTempId);
                FocusStorage.set('tasks', remainingTasks);
                if (typeof window.syncTasksFromStorage === 'function') window.syncTasksFromStorage();
                if (typeof window.renderCalendarGlobal === 'function') window.renderCalendarGlobal();
            }
            pvReadOnly = false;
            pvReadOnlyTempId = null;
            pvReadOnlyShowOwnTasks = false;
        }
    }

    let pvSelectedDate = null; // 'YYYY-MM-DD'

    function _pvRender(g) {
        document.getElementById('pg-plan-view')?.classList.toggle('pg-pv-readonly', pvReadOnly);
        _pvRenderHeader(g);
        _pvRenderStepper(g);
        _pvRenderMainCal(g);
        _pvRenderDayPanel(g, pvSelectedDate);
        _pvUpdateOverallProgress(g);
    }

    // ── Header ────────────────────────────────
    function _pvRenderHeader(g) {
        _pvUpdateConflictBanner(g);
        const cat = window.getCat(g.category);
        const pct = g.progress_pct || 0;
        const el  = document.getElementById('pg-pv-goal-info');
        if (!el) return;
        el.innerHTML = `
            <div class="pg-pv-goal-cat-dot" style="background:${cat.color};color:${cat.color};"></div>
            <div>
                <div class="pg-pv-goal-title-text">${esc(g.title)}</div>
                <div class="pg-pv-goal-meta">
                    <span>${cat.icon} ${cat.label}</span>
                    ${g.deadline ? `<span>·</span><span><i class="ti ti-calendar-due"></i> ${window.fmtDate(g.deadline)}</span>` : ''}
                </div>
            </div>
            <div class="pg-pv-goal-progress-wrap">
                <div class="pg-pv-goal-progress-bar">
                    <div class="pg-pv-goal-progress-fill" style="width:${pct}%;background:${cat.color};"></div>
                </div>
                <span class="pg-pv-goal-pct" style="color:${cat.color};">${pct}%</span>
            </div>`;

        // Seq toggle sync — ders planında anlamsız (aşamalar öğretmen tarafından serbestçe eklenir), gizle
        const seqCheck = document.getElementById('pg-pv-seq-check');
        if (seqCheck) seqCheck.checked = pvSeqMode;
        document.querySelector('.pg-pv-seq-wrap')?.classList.toggle('hidden', _pvIsLessonPlan(g));

        // Ders planı (Uygulama Planı + Şablon) — sağ üstte açık "Kaydet" butonu
        const saveBtn = document.getElementById('pg-pv-save-btn');
        if (saveBtn) {
            saveBtn.classList.toggle('hidden', !_pvIsLessonPlan(g) || pvReadOnly);
            saveBtn.onclick = () => {
                if (_pvHasUnresolvedConflicts(g)) {
                    _pvShowUnresolvedConflictModal({ onLeave: () => { _pvExplicitSave(g); closePlanView(); } });
                    return;
                }
                _pvExplicitSave(g);
            };
        }

        // Öğretmenin sana atadığı planı "İncele" ile salt okunur açtığında: düzenleme/
        // atama butonları yerine sadece bir bilgi rozeti göster, aşama-ekleme/görev
        // düzenleme aksiyonları da _pvRenderStepper/_pvRenderDayPanel'de gizlenir.
        document.getElementById('pg-pv-edit-goal')?.classList.toggle('hidden', pvReadOnly || _pvHasUnresolvedConflicts(g));
        const invLaterWrap = document.getElementById('pg-pv-invite-later-wrap');
        if (pvReadOnly) {
            document.getElementById('pg-pv-assign-status')?.classList.add('hidden');
            if (invLaterWrap) {
                invLaterWrap.innerHTML = `
                    <span class="pg-pv-readonly-badge"><i class="ti ti-eye"></i> Öğretmen Planı — Salt Okunur Önizleme</span>
                    <button class="pg-pv-own-tasks-toggle-btn${pvReadOnlyShowOwnTasks ? ' active' : ''}" id="pg-pv-own-tasks-toggle">
                        <i class="ti ti-calendar-user"></i> ${pvReadOnlyShowOwnTasks ? 'Mevcut Görevlerimi Gizle' : 'Mevcut Görevlerimi Gör'}
                    </button>`;
                document.getElementById('pg-pv-own-tasks-toggle')?.addEventListener('click', () => {
                    pvReadOnlyShowOwnTasks = !pvReadOnlyShowOwnTasks;
                    _pvRenderHeader(g);
                    _pvRenderDayPanel(g, pvSelectedDate);
                });
            }
            return;
        }
        if (invLaterWrap) {
            if (g.lpa_id) {
                // Öğretmenden kabul edilmiş ders planı kopyası: atama/şablon
                // aksiyonları öğretmene özeldir, öğrenciye gösterilmez.
                document.getElementById('pg-pv-assign-status')?.classList.add('hidden');
                invLaterWrap.innerHTML = '';
            } else if (_pvIsLessonPlan(g)) {
                const isTpl = !!g.context?.isTemplate;
                invLaterWrap.innerHTML = `
                    ${!isTpl ? `<button class="pg-pv-save-template-btn" id="pg-pv-save-template-btn" title="Bu planın aşama/görev yapısını yeni dönemlerde tekrar kullanabileceğin bir şablon olarak kaydet">
                        <i class="ti ti-copy"></i> Şablon Olarak Kaydet
                    </button>` : ''}
                    ${!isTpl ? `<button class="pg-pv-assign-class-btn" id="pg-pv-assign-class-btn">
                        <i class="ti ti-send"></i> Öğrencilere Ata
                    </button>` : ''}`;
                document.getElementById('pg-pv-save-template-btn')?.addEventListener('click', () => window._pvSaveGoalAsTemplate(g));
                if (!isTpl) _pvRenderAssignmentStatus(g);
                else document.getElementById('pg-pv-assign-status')?.classList.add('hidden');
                document.getElementById('pg-pv-assign-class-btn')?.addEventListener('click', async () => {
                    const groupId = g.context?.lessonPlanGroupId;
                    await openAssignModal(g.id);
                    if (groupId) {
                        const sel = document.getElementById('pg-assign-group');
                        if (sel) { sel.value = groupId; sel.dispatchEvent(new Event('change')); }
                    }
                });
            } else if (!g.collab_room_id) {
                document.getElementById('pg-pv-assign-status')?.classList.add('hidden');
                invLaterWrap.innerHTML = `
                    <button class="pg-pv-invite-later-btn" id="pg-pv-invite-later-btn">
                        <i class="ti ti-user-plus"></i> Arkadaşını bu plana davet et
                    </button>`;
                document.getElementById('pg-pv-invite-later-btn')?.addEventListener('click', async () => {
                    const btn = document.getElementById('pg-pv-invite-later-btn');
                    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader" style="animation:spin .8s linear infinite;display:inline-block;"></i>'; }
                    try {
                        const { roomId, inviteCode } = await window.PlanningCollab.enableCollab(g.id, g.title);
                        window._updateGoalCollabState?.(g.id, { collab_room_id: roomId, invite_code: inviteCode, is_collaborative: true });
                        await window.PlanningCollab.joinRoom(roomId, g.id, 'owner');
                        // Reload plan view header to remove button
                        const freshGoal = FocusStorage.get('goals', []).find(x => x.id === g.id) || { ...g, collab_room_id: roomId, invite_code: inviteCode };
                        _pvRenderHeader(freshGoal);
                        // Show invite modal
                        _pvOpenCollabInviteModal(inviteCode);
                    } catch(e) {
                        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-user-plus"></i> Arkadaşını bu plana davet et'; }
                    }
                });
            } else {
                document.getElementById('pg-pv-assign-status')?.classList.add('hidden');
                invLaterWrap.innerHTML = '';
            }
        }
    }

    // ── Plan view collab invite modal ─────────
    function _pvOpenCollabInviteModal(inviteCode) {
        const modal = document.getElementById('pg-pv-collab-invite-modal');
        if (!modal) return;
        const codeEl = document.getElementById('pg-pv-collab-invite-code');
        if (codeEl) codeEl.textContent = inviteCode || '—';

        const membersEl = document.getElementById('pg-pv-collab-members');
        if (membersEl) membersEl.innerHTML = '<p style="font-size:12px;color:var(--text-muted);">Henüz katılan yok. Kodu paylaştıktan sonra arkadaşın <strong>Odaya Katıl</strong> seçeneğinden bu kodu girince burada görünür.</p>';

        const copyBtn = document.getElementById('pg-pv-collab-copy-btn');
        if (copyBtn && !copyBtn._pvBound) {
            copyBtn._pvBound = true;
            copyBtn.addEventListener('click', () => {
                navigator.clipboard?.writeText(inviteCode).catch(()=>{});
                copyBtn.innerHTML = '<i class="ti ti-check"></i> Kopyalandı';
                setTimeout(() => { copyBtn.innerHTML = '<i class="ti ti-copy"></i> Kopyala'; }, 2000);
            });
        }

        const closeBtn = document.getElementById('pg-pv-collab-invite-close');
        if (closeBtn && !closeBtn._pvBound) {
            closeBtn._pvBound = true;
            closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
        }
        modal.addEventListener('click', e => { if (e.target === modal) modal.classList.add('hidden'); });
        modal.classList.remove('hidden');
    }

    // ── Left: Stepper ─────────────────────────
    function _pvRenderStepper(g) {
        document.getElementById('pg-pv-body')?.classList.toggle('pg-pv-no-stages', _pvIsLessonPlan(g));
        const el  = document.getElementById('pg-pv-stepper');
        if (!el) return;
        // Takvimden saat saat eklenen görevlerin aynası olan milestone'lar burada da
        // hariç tutulur — gerçek bir "aşama" değiller, sol listede aşama gibi görünüp
        // kafa karıştırmasınlar diye (bkz. _pvIsMirrorMs).
        const ms  = (g.milestones || []).filter(m => !_pvIsMirrorMs(m));
        const cat = window.getCat(g.category);

        // Wizard active and in dates step → keep showing chat even with milestones
        const wizActive = pvWiz && pvWiz.step !== 'done' && pvWiz.step !== null;

        // Ders planı: "kaç aşamaya bölmek istersiniz" sohbet sihirbazı hiç gösterilmez —
        // öğretmen aşamaları doğrudan, tamamen opsiyonel olarak ekler.
        if (_pvIsLessonPlan(g)) {
            document.querySelector('.pg-pv-panel-header')?.style.removeProperty('display');
            document.getElementById('pg-pv-overall-progress')?.style.removeProperty('display');
            pvWiz = null;
        } else if (!ms.length || wizActive) {
            // Show wizard if not already in wizard flow
            if (!pvWiz) pvWiz = { step: 'welcome' };
            _pvRenderWizard(g, el);
            // Hide normal panel chrome while in wizard
            document.querySelector('.pg-pv-panel-header')?.style.setProperty('display','none');
            document.getElementById('pg-pv-quick-add-ms')?.style.setProperty('display','none');
            document.getElementById('pg-pv-overall-progress')?.style.setProperty('display','none');
            return;
        }
        // Milestones exist & wizard done — restore normal chrome
        document.querySelector('.pg-pv-panel-header')?.style.removeProperty('display');
        document.getElementById('pg-pv-overall-progress')?.style.removeProperty('display');
        pvWiz = null;

        const allTasks = FocusStorage.get('tasks', []).filter(t => String(t.parentGoal) === String(g.id));
        const today    = _localToday();

        el.innerHTML = ms.map((m, i) => {
            const isActive = m.id === pvActiveMsId;
            const isLocked = pvSeqMode && i > 0 && !ms[i - 1].done && !m.done;
            const stsDone  = (m.subtasks || []).filter(s => s.done).length;
            const stTotal  = (m.subtasks || []).length;
            const stPct    = stTotal ? Math.round(stsDone / stTotal * 100) : (m.done ? 100 : 0);

            // Task count in this milestone's date range — only this goal's tasks
            const mTasks   = m.start_date && m.due_date
                ? allTasks.filter(t => { const d = _normYMD(t.date); return d >= m.start_date && d <= m.due_date && String(t.parentGoal) === String(g.id); })
                : [];
            const mDone    = mTasks.filter(t => t.completed).length;

            // Days remaining / elapsed
            let daysInfo = '';
            if (!m.done && m.due_date) {
                const diff = Math.round((new Date(m.due_date + 'T00:00:00') - new Date(today + 'T00:00:00')) / 86400000);
                if (diff > 0)       daysInfo = `${diff} gün kaldı`;
                else if (diff === 0) daysInfo = 'Bugün bitiyor';
                else                daysInfo = `${-diff} gün geçti`;
            }

            // Duration (planned time)
            const mMins = _pvWeekTotalMins(allTasks, m.start_date || '', m.due_date || '');
            const mDur  = _pvFmtDuration(mMins);

            // Status badge
            let statusBadge = '';
            if (m.done)        statusBadge = `<span class="pg-pv-ms-badge done">✓ Tamamlandı</span>`;
            else if (isLocked) statusBadge = `<span class="pg-pv-ms-badge locked"><i class="ti ti-lock"></i> Kilitli</span>`;
            else if (isActive) statusBadge = `<span class="pg-pv-ms-badge active" style="--ms-color:${cat.color};">▶ Aktif</span>`;

            // Date range label
            const timeLabel = (m.start_time || m.end_time) ? ` · ${m.start_time || ''}${m.end_time ? '–'+m.end_time : ''}` : '';
            const dateRange = (m.start_date && m.due_date)
                ? `${window.fmtShort(m.start_date)} → ${window.fmtShort(m.due_date)}${timeLabel}`
                : m.due_date ? `Bitiş: ${window.fmtShort(m.due_date)}${timeLabel}` : '';

            return `
            ${i > 0 ? `<div class="pg-pv-step-connector${ms[i-1].done?' done':''}"></div>` : ''}
            <div class="pg-pv-step-item${isActive?' active':''}${m.done?' done':''}${isLocked?' locked':''}"
                data-pvms="${m.id}" style="${isActive?`--ms-color:${cat.color};`:''}"
                ${isLocked ? 'title="Sıralı modda önceki aşama tamamlanmadan açılamaz"' : ''}>

                <div class="pg-pv-step-top">
                    <div class="pg-pv-step-num" style="${isActive||m.done?`background:${cat.color};color:#000;`:''}">
                        ${m.done ? '✓' : i + 1}
                    </div>
                    <div class="pg-pv-step-body">
                        <div class="pg-pv-step-title">${esc(m.title)}</div>
                        ${statusBadge}
                    </div>
                </div>

                ${dateRange ? `<div class="pg-pv-step-daterange"><i class="ti ti-calendar-event"></i> ${dateRange}</div>` : ''}

                ${(stTotal || mTasks.length) ? `
                <div class="pg-pv-step-progress-row">
                    <div class="pg-pv-step-progress-bar">
                        <div class="pg-pv-step-progress-fill" style="width:${stPct}%;background:${cat.color};"></div>
                    </div>
                    <span class="pg-pv-step-progress-pct">${stPct}%</span>
                </div>` : ''}

                <div class="pg-pv-step-stats">
                    ${mTasks.length ? `<span class="pg-pv-step-stat"><i class="ti ti-checkbox"></i> ${mDone}/${mTasks.length} görev</span>` : ''}
                    ${stTotal ? `<span class="pg-pv-step-stat"><i class="ti ti-list-check"></i> ${stsDone}/${stTotal} alt görev</span>` : ''}
                    ${mDur ? `<span class="pg-pv-step-stat"><i class="ti ti-clock"></i> ${mDur}</span>` : ''}
                    ${daysInfo ? `<span class="pg-pv-step-stat${m.due_date < today && !m.done ? ' overdue' : ''}"><i class="ti ti-hourglass"></i> ${daysInfo}</span>` : ''}
                </div>
            </div>`;
        }).join('');

        // Click to highlight milestone date on calendar
        el.querySelectorAll('[data-pvms]').forEach(item => {
            item.addEventListener('click', () => {
                if (item.classList.contains('locked')) return;
                pvActiveMsId = item.dataset.pvms;
                _pvRenderStepper(g);
                // Jump to milestone's month on calendar
                const ms = (g.milestones || []).find(m => m.id === pvActiveMsId);
                if (ms?.due_date) {
                    const d = new Date(ms.due_date);
                    pvCalYear  = d.getFullYear();
                    pvCalMonth = d.getMonth();
                    pvSelectedDate = ms.due_date;
                }
                _pvRenderMainCal(g);
                _pvRenderDayPanel(g, pvSelectedDate);
            });
        });
    }

    // ── Center: MS Detail (legacy — artık kullanılmıyor) ─
    function _pvRenderCenterLegacy(g) {
        const centerEl = document.getElementById('pg-pv-center');
        const emptyEl  = document.getElementById('pg-pv-center-empty');
        const detailEl = document.getElementById('pg-pv-ms-detail');
        if (!centerEl || !detailEl) return;

        const ms = (g.milestones || []).find(m => m.id === pvActiveMsId);
        if (!ms) {
            if (emptyEl) emptyEl.style.display = '';
            detailEl.innerHTML = '';
            return;
        }
        if (emptyEl) emptyEl.style.display = 'none';

        const cat      = window.getCat(g.category);
        const stDone   = (ms.subtasks || []).filter(s => s.done).length;
        const stTotal  = (ms.subtasks || []).length;
        const stPct    = stTotal ? Math.round(stDone / stTotal * 100) : 0;
        const statusCls = ms.done ? 'done' : 'active';
        const statusLbl = ms.done ? '✓ Tamamlandı' : '⚡ Aktif';

        detailEl.innerHTML = `
        <div class="pg-pv-ms-header">
            <div class="pg-pv-ms-big-icon">${_pvMsIcon(ms, g)}</div>
            <div class="pg-pv-ms-title-wrap">
                <div class="pg-pv-ms-title-edit" contenteditable="true"
                    data-placeholder="Aşama başlığı..."
                    id="pg-pv-ms-title-edit"
                    style="--ms-color:${cat.color};">${esc(ms.title)}</div>
                <div class="pg-pv-ms-header-meta">
                    <span class="pg-pv-ms-status-badge ${statusCls}">${statusLbl}</span>
                    <div class="pg-pv-ms-date-row">
                        <i class="ti ti-calendar" style="color:#555;font-size:12px;"></i>
                        <input type="date" class="pg-pv-ms-date-inp" id="pg-pv-ms-date-inp"
                            value="${ms.due_date || ''}" style="--ms-color:${cat.color};">
                        ${!ms.due_date ? '<span style="color:#444;font-size:11px;">Tarih belirle</span>' : ''}
                    </div>
                </div>
            </div>
        </div>

        ${stTotal ? `
        <div class="pg-pv-st-progress">
            <div class="pg-pv-st-progress-header">
                <span class="pg-pv-st-progress-label"><i class="ti ti-checklist"></i> Alt Görevler</span>
                <span class="pg-pv-st-progress-count">${stDone}/${stTotal} · ${stPct}%</span>
            </div>
            <div class="pg-pv-st-track">
                <div class="pg-pv-st-fill" style="width:${stPct}%;background:${cat.color};"></div>
            </div>
        </div>` : ''}

        <div class="pg-pv-section">
            <div class="pg-pv-section-label"><i class="ti ti-checklist"></i> Alt Görevler</div>
            <div class="pg-pv-subtask-list" id="pg-pv-subtask-list">
                ${(ms.subtasks || []).map(s => `
                <div class="pg-pv-subtask-row${s.done ? ' done' : ''}" data-stid="${s.id}">
                    <div class="pg-pv-subtask-check${s.done ? ' done' : ''}" data-st-check="${s.id}">
                        ${s.done ? '✓' : ''}
                    </div>
                    <span class="pg-pv-subtask-text">${esc(s.title)}</span>
                    <button class="pg-pv-subtask-del" data-st-del="${s.id}"><i class="ti ti-x"></i></button>
                </div>`).join('')}
            </div>
            <div class="pg-pv-add-subtask-row">
                <input type="text" id="pg-pv-add-st-inp" class="pg-pv-add-subtask-inp"
                    placeholder="+ Alt görev ekle (Enter)..." maxlength="100">
            </div>
        </div>

        <div class="pg-pv-section">
            <div class="pg-pv-section-label"><i class="ti ti-notes"></i> Notlar & Kaynaklar</div>
            <textarea class="pg-pv-notes" id="pg-pv-notes-area"
                placeholder="Kaynaklar, linkler, notlar, hatırlatmalar...">${esc(ms.description || '')}</textarea>
        </div>

        <div class="pg-pv-ms-actions">
            <button class="pg-pv-nav-btn" id="pg-pv-prev-ms" ${_pvGetMsIndex(g, ms.id) === 0 ? 'disabled' : ''}>
                <i class="ti ti-arrow-left"></i> Önceki
            </button>
            <button class="pg-pv-complete-btn${ms.done ? ' done' : ''}" id="pg-pv-complete-btn">
                ${ms.done ? '<i class="ti ti-rotate-counterclockwise"></i> Geri Al' : '<i class="ti ti-check"></i> Tamamlandı'}
            </button>
            <button class="pg-pv-nav-btn" id="pg-pv-next-ms" ${_pvGetMsIndex(g, ms.id) === (g.milestones.length - 1) ? 'disabled' : ''}>
                Sonraki <i class="ti ti-arrow-right"></i>
            </button>
        </div>`;

        _pvBindCenterEvents(g, ms);
    }

    function _pvMsIcon(ms, g) {
        if (ms.icon) return ms.icon;
        const catIcons = { egitim:'📖', saglik:'💪', kariyer:'💼', finans:'💰', kisisel:'🌱', diger:'🎯' };
        return catIcons[g.category] || '🎯';
    }

    function _pvGetMsIndex(g, msId) {
        return (g.milestones || []).findIndex(m => m.id === msId);
    }

    function _pvBindCenterEvents(g, ms) {
        // Inline title save (blur)
        const titleEdit = document.getElementById('pg-pv-ms-title-edit');
        if (titleEdit) {
            titleEdit.addEventListener('blur', () => {
                const newTitle = titleEdit.innerText.trim();
                if (newTitle && newTitle !== ms.title) {
                    ms.title = newTitle;
                    g._dirty = true;
                    persistGoals();
                    _pvRenderStepper(g);
                    _pvRenderHeader(g);
                }
            });
            titleEdit.addEventListener('keydown', e => {
                if (e.key === 'Enter') { e.preventDefault(); titleEdit.blur(); }
            });
        }

        // Date change
        const dateInp = document.getElementById('pg-pv-ms-date-inp');
        if (dateInp) {
            dateInp.addEventListener('change', () => {
                ms.due_date = dateInp.value;
                g._dirty = true;
                persistGoals();
                _pvRenderStepper(g);
                _pvRenderMainCal(g);
            });
        }

        // Subtask check
        document.querySelectorAll('[data-st-check]').forEach(el => {
            el.addEventListener('click', () => {
                const st = (ms.subtasks || []).find(s => s.id === el.dataset.stCheck);
                if (!st) return;
                st.done = !st.done;
                _recalcProgress(g); g._dirty = true;
                persistGoals(); render();
                _pvRenderStepper(g); _pvUpdateOverallProgress(g);
                _pvRenderHeader(g);
                if (g.progress_pct === 100) _pvCelebrate();
            });
        });

        // Subtask delete
        document.querySelectorAll('[data-st-del]').forEach(el => {
            el.addEventListener('click', () => {
                ms.subtasks = (ms.subtasks || []).filter(s => s.id !== el.dataset.stDel);
                _recalcProgress(g); g._dirty = true;
                persistGoals(); render();
                ;
            });
        });

        // Add subtask
        const stInp = document.getElementById('pg-pv-add-st-inp');
        if (stInp) {
            stInp.addEventListener('keydown', e => {
                if (e.key !== 'Enter') return;
                const val = stInp.value.trim();
                if (!val) return;
                if (!ms.subtasks) ms.subtasks = [];
                ms.subtasks.push({ id: window.msUid(), title: val, done: false });
                stInp.value = '';
                _recalcProgress(g); g._dirty = true;
                persistGoals(); render();
                _pvRenderStepper(g);
            });
        }

        // Notes auto-save (debounced)
        const notesArea = document.getElementById('pg-pv-notes-area');
        if (notesArea) {
            let _notesTimer;
            notesArea.addEventListener('input', () => {
                clearTimeout(_notesTimer);
                _notesTimer = setTimeout(() => {
                    ms.description = notesArea.value;
                    g._dirty = true;
                    persistGoals();
                }, 800);
            });
        }

        // Complete / undo button
        const completeBtn = document.getElementById('pg-pv-complete-btn');
        if (completeBtn) {
            completeBtn.addEventListener('click', () => {
                ms.done = !ms.done;
                _recalcProgress(g); g._dirty = true;
                persistGoals(); render();
                if (ms.done) {
                    _pvCelebrate();
                    toast(`"${ms.title}" tamamlandı! 🎉`);
                    // Auto-advance to next ms
                    const nextIdx = _pvGetMsIndex(g, ms.id) + 1;
                    if (nextIdx < (g.milestones || []).length) {
                        setTimeout(() => {
                            pvActiveMsId = g.milestones[nextIdx].id;
                            _pvRenderStepper(g);
                            ;
                            _pvRenderHeader(g);
                            _pvUpdateOverallProgress(g);
                        }, 600);
                    } else {
                        _pvRenderStepper(g); ;
                        _pvRenderHeader(g); _pvUpdateOverallProgress(g);
                        if (g.progress_pct === 100) _pvCelebrate(true);
                    }
                } else {
                    _pvRenderStepper(g); ;
                    _pvRenderHeader(g); _pvUpdateOverallProgress(g);
                }
                if (window.PlanningCollab?.channel) {
                    window.PlanningCollab.broadcast('ms_toggle', { goalId: g.id, msId: ms.id, done: ms.done });
                }
            });
        }

        // Prev / Next navigation
        const prevBtn = document.getElementById('pg-pv-prev-ms');
        const nextBtn = document.getElementById('pg-pv-next-ms');
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                const idx = _pvGetMsIndex(g, pvActiveMsId);
                if (idx > 0) { pvActiveMsId = g.milestones[idx - 1].id; _pvRenderStepper(g); ; }
            });
        }
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                const idx = _pvGetMsIndex(g, pvActiveMsId);
                if (idx < (g.milestones || []).length - 1) {
                    pvActiveMsId = g.milestones[idx + 1].id;
                    _pvRenderStepper(g); ;
                }
            });
        }
    }

    // ══════════════════════════════════════════
    // MİLESTONE WİZARD
    // ══════════════════════════════════════════

    function _pvBroadcastWizState() {
        if (window.PlanningCollab?.channel && pvWiz)
            window.PlanningCollab.broadcast('wiz_state', { goalId: pvGoalId, wiz: JSON.parse(JSON.stringify(pvWiz)) });
    }

    function _pvRenderWizard(g, container) {
        // Always prefer live goal from goals array to avoid stale closure issues
        const _liveG = () => goals.find(x => x.id === pvGoalId) || g;
        const cat    = window.getCat(g.category);
        const quotes = PV_MOTIVATION[g.category] || PV_MOTIVATION.diger;
        const quote  = quotes[Math.floor(Date.now() / 86400000) % quotes.length];

        // ── Welcome ─────────────────────────────
        if (pvWiz.step === 'welcome') {
            container.innerHTML = `
            <div class="pvwiz-welcome">
                <div class="pvwiz-welcome-glow" style="background:${cat.color};"></div>
                <div class="pvwiz-welcome-icon" style="color:${cat.color};">${cat.icon}</div>
                <div class="pvwiz-welcome-goal">${esc(g.title)}</div>
                <div class="pvwiz-welcome-quote">"${esc(quote)}"</div>
                <div class="pvwiz-welcome-hint">Hedefine giden yolu birlikte çizelim</div>
                <button class="pvwiz-start-btn" id="pvwiz-start" style="--wiz-color:${cat.color};">
                    <i class="ti ti-rocket"></i> Planlamaya Başla
                </button>
            </div>`;
            document.getElementById('pvwiz-start')?.addEventListener('click', () => {
                if (!pvWiz) pvWiz = { step: 'welcome' };
                pvWiz.step = 'count';
                _pvBroadcastWizState();
                const _g = _liveG();
                _pvRenderStepper(_g);
                _pvRenderMainCal(_g);
            });
            return;
        }

        // Chat container
        container.innerHTML = `<div class="pvwiz-chat" id="pvwiz-chat"></div>`;
        const chat = container.querySelector('#pvwiz-chat');

        // ── Count ────────────────────────────────
        if (pvWiz.step === 'count') {
            _pvWizAddBubble(chat, '👋', 'Merhaba! Hedefinizi kaç aşamaya bölmek istersiniz?', 0, () => {
                const row = document.createElement('div');
                row.className = 'pvwiz-count-cards';
                row.innerHTML = [3,4,5,6].map(n => `
                    <button class="pvwiz-count-card" data-n="${n}">
                        <span class="pvwiz-count-num">${n}</span>
                        <span class="pvwiz-count-lbl">aşama</span>
                    </button>`).join('');
                chat.appendChild(row);
                setTimeout(() => row.classList.add('visible'), 50);
                row.querySelectorAll('.pvwiz-count-card').forEach(btn => {
                    btn.addEventListener('click', () => {
                        row.querySelectorAll('.pvwiz-count-card').forEach(b => b.classList.remove('selected'));
                        btn.classList.add('selected');
                        const n = parseInt(btn.dataset.n);
                        setTimeout(() => {
                            pvWiz.step    = 'names';
                            pvWiz.count   = n;
                            pvWiz.names   = Array(n).fill('');
                            pvWiz.nameIdx = 0;
                            _pvBroadcastWizState();
                            _pvRenderStepper(_liveG());
                            _pvRenderMainCal(_liveG());
                        }, 350);
                    });
                });
            });
            return;
        }

        // ── Names — card navigator ───────────────
        if (pvWiz.step === 'names') {
            const idx   = pvWiz.nameIdx || 0;
            const count = pvWiz.count;

            _pvWizAddBubble(chat, '🤖',
                `Harika! ${count} aşama seçildi.\nŞimdi her birine isim verelim 📝`,
                0, () => {
                    const card = document.createElement('div');
                    card.className = 'pvwiz-name-card pvwiz-name-wrap';
                    card.innerHTML = `
                        <div class="pvwiz-name-card-header">
                            <span class="pvwiz-name-card-pos" id="pvwiz-pos">${idx + 1} / ${count}</span>
                            <span class="pvwiz-name-card-label">Aşama <span id="pvwiz-num">${idx + 1}</span></span>
                        </div>
                        <input class="pvwiz-name-inp" id="pvwiz-name-inp" type="text"
                            placeholder="Aşama adı…" maxlength="40" autocomplete="off"
                            value="${esc(pvWiz.names[idx] || '')}">
                        <div class="pvwiz-name-card-nav">
                            <button class="pvwiz-nav-btn pvwiz-nav-back" id="pvwiz-back"
                                ${idx === 0 ? 'disabled' : ''} style="--wiz-color:${cat.color};">
                                <i class="ti ti-arrow-left"></i> Geri
                            </button>
                            <div class="pvwiz-name-progress" id="pvwiz-dots">
                                ${Array(count).fill(0).map((_,i) =>
                                    `<div class="pvwiz-name-dot${i < idx ? ' done' : i === idx ? ' active' : ''}"
                                        style="${i <= idx ? `--wiz-color:${cat.color}` : ''}"></div>`
                                ).join('')}
                            </div>
                            <button class="pvwiz-nav-btn pvwiz-nav-fwd" id="pvwiz-fwd"
                                style="--wiz-color:${cat.color};">
                                ${idx < count - 1 ? 'İleri <i class="ti ti-arrow-right"></i>' : 'Tarihler <i class="ti ti-calendar"></i>'}
                            </button>
                        </div>`;
                    chat.appendChild(card);
                    setTimeout(() => card.classList.add('visible'), 30);

                    const inp  = card.querySelector('#pvwiz-name-inp');
                    const fwd  = card.querySelector('#pvwiz-fwd');
                    const back = card.querySelector('#pvwiz-back');
                    setTimeout(() => inp?.focus(), 150);

                    const goTo = (newIdx) => {
                        // Save current
                        pvWiz.names[pvWiz.nameIdx] = inp.value.trim();
                        if (newIdx < 0) {
                            // Back to count step
                            pvWiz.step = 'count';
                            _pvBroadcastWizState();
                            _pvRenderStepper(_liveG());
                            return;
                        }
                        pvWiz.nameIdx = newIdx;
                        _pvBroadcastWizState();

                        // Update card inline (no full re-render = smoother)
                        const curIdx = pvWiz.nameIdx;
                        card.querySelector('#pvwiz-pos').textContent  = `${curIdx + 1} / ${count}`;
                        card.querySelector('#pvwiz-num').textContent  = curIdx + 1;
                        inp.value       = pvWiz.names[curIdx] || '';
                        inp.placeholder = `Aşama ${curIdx + 1} adı…`;
                        back.disabled   = curIdx === 0;
                        fwd.innerHTML   = curIdx < count - 1
                            ? 'İleri <i class="ti ti-arrow-right"></i>'
                            : 'Tarihler <i class="ti ti-calendar"></i>';

                        // Animate dots
                        card.querySelectorAll('.pvwiz-name-dot').forEach((dot, i) => {
                            dot.className = 'pvwiz-name-dot' + (i < curIdx ? ' done' : i === curIdx ? ' active' : '');
                            if (i <= curIdx) dot.style.setProperty('--wiz-color', cat.color);
                        });
                        setTimeout(() => inp?.focus(), 80);
                    };

                    fwd.addEventListener('click', () => {
                        const val = inp.value.trim();
                        if (!val) {
                            inp.classList.add('pvwiz-shake');
                            setTimeout(() => inp.classList.remove('pvwiz-shake'), 500);
                            return;
                        }
                        pvWiz.names[pvWiz.nameIdx] = val;
                        if (pvWiz.nameIdx >= count - 1) {
                            // All named → create milestones & go to dates
                            const g2 = goals.find(x => x.id === pvGoalId);
                            if (g2) {
                                const todayIso = _localToday();
                                g2.milestones = pvWiz.names.map((name, i) => ({
                                    id: uid(), title: name.trim() || `Aşama ${i+1}`,
                                    due_date: '', start_date: i === 0 ? todayIso : '',
                                    done: false, order: i, subtasks: [],
                                    created_at: new Date().toISOString(),
                                }));
                                persistGoals();
                                if (window.PlanningCollab?.channel)
                                    window.PlanningCollab.broadcast('ms_batch_set', { goalId: pvGoalId, milestones: g2.milestones });
                            }
                            pvWiz.step    = 'dates';
                            pvWiz.dateIdx = 0;
                            _pvBroadcastWizState();
                            _pvRenderStepper(_liveG());
                            _pvRenderMainCal(_liveG());
                        } else {
                            goTo(pvWiz.nameIdx + 1);
                        }
                    });
                    back.addEventListener('click', () => {
                        if (pvWiz.nameIdx === 0) goTo(-1);
                        else goTo(pvWiz.nameIdx - 1);
                    });
                    inp.addEventListener('keydown', e => {
                        if (e.key === 'Enter') fwd.click();
                        if (e.key === 'Backspace' && inp.value === '') back.click();
                    });
                });
            return;
        }

        // ── Dates ────────────────────────────────
        if (pvWiz.step === 'dates') {
            const g2     = goals.find(x => x.id === pvGoalId) || g;
            const msList  = g2.milestones || [];
            const total   = msList.length;
            const askUpto = total - 1; // user picks dates for all except last
            const idx     = pvWiz.dateIdx || 0;

            // History: already-picked dates
            msList.slice(0, idx).forEach((m, i) => {
                _pvWizAddBubble(chat, '🤖', i === 0
                    ? `Süper! Şimdi her aşamanın bitiş tarihini takvimden seçin 👇\n"${esc(m.title)}" ne zaman bitmeli?`
                    : `"${esc(m.title)}" ne zaman bitmeli?`, i * 50, null, false);
                _pvWizAddUserBubble(chat, `📅 ${window.fmtDate(m.due_date)}`, i * 50 + 25);
            });

            if (idx >= askUpto) {
                // Only the last milestone remains — auto-assign
                _pvWizAutoFinish(g2);
                return;
            }

            const cur = msList[idx];
            const minDate = idx === 0
                ? new Date().toISOString().split('T')[0]
                : _pvDayAfter(msList[idx - 1].due_date);

            const delay = idx * 50;
            _pvWizAddBubble(chat, '🤖',
                idx === 0
                    ? `Süper! Takvimde her aşamanın bitiş tarihini seçin 👇\n"${esc(cur.title)}" ne zaman bitmeli?`
                    : `"${esc(cur.title)}" ne zaman bitmeli?`,
                delay, () => {
                    const hint = document.createElement('div');
                    hint.className = 'pvwiz-cal-hint';
                    hint.innerHTML = `<i class="ti ti-hand-click"></i> Takvimde bir güne tıklayın
                        ${minDate ? `<span class="pvwiz-min-hint">(${window.fmtDate(minDate)} ve sonrası)</span>` : ''}`;
                    chat.appendChild(hint);
                    setTimeout(() => hint.classList.add('visible'), 30);
                });
            return;
        }

        if (pvWiz.step === 'summary') {
            _pvRenderPlanSummary(g, container);
            return;
        }
    }

    // Auto-assign last milestone's date = goal deadline
    function _pvWizAutoFinish(g2) {
        const msList = g2.milestones || [];
        const last   = msList[msList.length - 1];
        if (!last) return;
        const deadline = g2.deadline || _pvDayAfter(msList[msList.length - 2]?.due_date || _localToday());
        last.due_date   = deadline;
        last.start_date = _pvDayAfter(msList[msList.length - 2]?.due_date || _localToday());
        g2._dirty = true;   // sadece tüm tarihler atandığında Supabase'e sync et
        persistGoals();
        if (window.PlanningCollab?.channel)
            window.PlanningCollab.broadcast('ms_batch_set', { goalId: pvGoalId, milestones: g2.milestones });
        pvWiz.step = 'summary';
        _pvBroadcastWizState();
        _pvRenderStepper(g2);
        _pvRenderMainCal(g2);
        toast('🎉 Aşamalar planlandı!');
    }

    function _pvWizAddBubble(container, avatar, text, delay, afterCb, animated = true) {
        const typing = document.createElement('div');
        typing.className = 'pvwiz-typing';
        typing.innerHTML = `<div class="pvwiz-avatar">${avatar}</div><div class="pvwiz-typing-dots"><span></span><span></span><span></span></div>`;
        container.appendChild(typing);
        const showTime = animated ? 380 : 0;
        setTimeout(() => {
            typing.remove();
            const bubble = document.createElement('div');
            bubble.className = 'pvwiz-bubble pvwiz-bubble-bot';
            bubble.innerHTML = `<div class="pvwiz-avatar">${avatar}</div><div class="pvwiz-bubble-text">${esc(text).replace(/\n/g,'<br>')}</div>`;
            container.appendChild(bubble);
            requestAnimationFrame(() => bubble.classList.add('in'));
            container.scrollTop = container.scrollHeight;
            if (afterCb) setTimeout(afterCb, animated ? 280 : 0);
        }, animated ? delay + showTime : delay);
        if (animated) setTimeout(() => typing.classList.add('visible'), delay);
    }

    function _pvWizAddUserBubble(container, text, delay) {
        setTimeout(() => {
            const bubble = document.createElement('div');
            bubble.className = 'pvwiz-bubble pvwiz-bubble-user';
            bubble.innerHTML = `<div class="pvwiz-bubble-text">${esc(text)}</div>`;
            container.appendChild(bubble);
            requestAnimationFrame(() => bubble.classList.add('in'));
            container.scrollTop = container.scrollHeight;
        }, delay);
    }

    function _pvDayAfter(dateStr) {
        if (!dateStr) return _localToday();
        const d = new Date(dateStr + 'T00:00:00');
        d.setDate(d.getDate() + 1);
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }

    function _localToday() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }

    // Normalize any date to YYYY-MM-DD (handles DD-MM-YYYY from the main app)
    function _normYMD(d) {
        if (!d) return '';
        const p = d.split('-');
        if (p.length !== 3) return d;
        return p[0].length === 2 ? `${p[2]}-${p[1]}-${p[0]}` : d;
    }
    window._normYMD = _normYMD;

    // Called from calendar when wizard dates step is active
    function _pvWizAssignDate(g, dateStr) {
        if (!pvWiz || pvWiz.step !== 'dates') return false;
        const g2    = goals.find(x => x.id === pvGoalId) || g;
        const msList = g2.milestones;
        const idx   = pvWiz.dateIdx;
        const total = msList.length;
        const askUpto = total - 1;

        // Validate: must be after previous milestone's end
        if (idx > 0 && dateStr <= msList[idx - 1].due_date) {
            toast(`⚠️ Tarih önceki aşamanın bitişinden sonra olmalı`);
            return false;
        }

        const ms = msList[idx];
        if (!ms) return false;
        ms.due_date   = dateStr;
        ms.start_date = idx === 0
            ? _localToday()
            : _pvDayAfter(msList[idx - 1].due_date);

        // Set next milestone's start_date immediately
        if (idx + 1 < total) {
            msList[idx + 1].start_date = _pvDayAfter(dateStr);
        }

        pvWiz.dateIdx++;
        persistGoals();
        if (window.PlanningCollab?.channel) {
            window.PlanningCollab.broadcast('ms_update', { goalId: pvGoalId, msId: ms.id, fields: { due_date: ms.due_date, start_date: ms.start_date } });
            if (idx + 1 < total)
                window.PlanningCollab.broadcast('ms_update', { goalId: pvGoalId, msId: msList[idx+1].id, fields: { start_date: msList[idx+1].start_date } });
        }
        _pvBroadcastWizState();

        if (pvWiz.dateIdx >= askUpto) {
            // Auto-finish last milestone
            _pvWizAutoFinish(g2);
        } else {
            _pvRenderStepper(g2);
            _pvRenderMainCal(g2);
        }
        _pvRenderDayPanel(g2, dateStr);
        return true;
    }

    // ── Center: Ana Takvim ───────────────────
    // Ders planı — Aylık/Haftalık/Günlük görünüm anahtarı — "Bugün" butonuyla aynı sırada, aynı stilde
    function _pvCalSwitchInline(g) {
        if (!_pvIsLessonPlan(g)) return '';
        const views = [['month','Aylık'],['week','Haftalık'],['day','Günlük']];
        return views.map(([v,label]) =>
            `<button type="button" class="pg-pv-main-cal-today-btn pg-pv-cal-view-btn${pvCalView===v?' active':''}" data-view="${v}">${label}</button>`).join('');
    }
    function _pvBindCalSwitch(el, g) {
        el.querySelectorAll('.pg-pv-cal-view-btn').forEach(btn => {
            btn.addEventListener('click', () => { pvCalView = btn.dataset.view; _pvRenderMainCal(g); });
        });
    }

    // Ay/hafta/gün görünümleri arasında ortak gün seçim davranışı
    function _pvSelectDay(g, dateStr) {
        pvSelectedDate = dateStr;
        const msForDate = (g.milestones || []).find(m =>
            m.start_date && m.due_date && dateStr >= m.start_date && dateStr <= m.due_date);
        if (msForDate) pvActiveMsId = msForDate.id;
        _pvRenderDayPanel(g, dateStr);
        _pvRenderStepper(g);
    }

    // Takvim sekmesindeki saat-gridi görünümüyle aynı mantık — bu goal'a ait
    // görevleri (tasks, parentGoal=g.id) saat bazlı bloklar olarak gösterir.
    const PVC_HOUR_START = 0, PVC_HOUR_END = 23, PVC_ROW_H = 60;

    function _pvGoalTasksOn(g, dateStr) {
        const all = FocusStorage.get('tasks', []);
        // Öğrencinin öğretmenden kabul ettiği ders planını (g.lpa_id) düzenlerken bu, artık
        // öğrencinin KENDİ takvimi — sadece bu plana ait görevleri değil, o gündeki TÜM kendi
        // görevlerini de göstermeli ki çakışan kendi dersini de görüp saatini düzeltebilsin.
        if (g.lpa_id) return all.filter(t => _normYMD(t.date) === dateStr);
        return all.filter(t => String(t.parentGoal) === String(g.id) && _normYMD(t.date) === dateStr);
    }

    function _pvTimeToMinLocal(t) { const [h,m] = (t||'0:00').split(':').map(Number); return h*60+(m||0); }
    // Her zaman "09:00" gibi sıfır dolgulu, iki haneli saat:dakika biçimi
    function _pvFmtHM(t) {
        if (!t) return '';
        const [h, m] = t.split(':').map(Number);
        return `${String(h||0).padStart(2,'0')}:${String(m||0).padStart(2,'0')}`;
    }

    function _pvHourGridHead(label, g) {
        return `<div class="pg-pv-main-cal-nav">
            <div style="display:flex;align-items:center;gap:8px;">
                <button class="pg-pv-main-cal-nav-btn" id="pg-pv-mcal-prev"><i class="ti ti-chevron-left"></i></button>
                <div class="pg-pv-main-cal-month">${label}</div>
                <button class="pg-pv-main-cal-nav-btn" id="pg-pv-mcal-next"><i class="ti ti-chevron-right"></i></button>
            </div>
            <div style="display:flex;align-items:center;gap:6px;">
                ${_pvCalSwitchInline(g)}
                <button class="pg-pv-main-cal-today-btn" id="pg-pv-mcal-today">Bugün</button>
                ${_pvBusyToggleBtn(g)}
            </div>
        </div>`;
    }

    // Aynı saat diliminde birden fazla görev varsa yan yana sütunlara böl —
    // ana Takvim sekmesindeki çakışma çözümüyle aynı mantık, üst üste binmesinler.
    function _pvTaskChip(t, g, col, colTotal) {
        col = col || 0; colTotal = colTotal || 1;
        // Öğrencinin kendi takvimi olarak açılan ders planı görünümünde (g.lpa_id) bu plana
        // ait olmayan görevler de gösteriliyor — onları kendi hedeflerinin renginde çiz ki
        // "bu ders" ile "kendi görevim" birbirinden ayırt edilebilsin.
        const isForeign = g.lpa_id && String(t.parentGoal) !== String(g.id);
        let cat = window.getCat(g.category);
        if (isForeign) {
            const ownerGoal = goals.find(x => String(x.id) === String(t.parentGoal));
            cat = window.getCat(ownerGoal?.category);
        }
        const s = _pvTimeToMinLocal(t.timeStart), e = _pvTimeToMinLocal(t.timeEnd || t.timeStart);
        // Chip bir tek saatlik hücrenin İÇİNE ekleniyor — top, o hücrenin başından
        // itibaren geçen dakikaya göre olmalı (günün başından itibaren değil).
        const top = Math.max(0, (s % 60) / 60 * PVC_ROW_H);
        const height = Math.max(20, (e - s) / 60 * PVC_ROW_H);
        const timeLbl = [_pvFmtHM(t.timeStart), _pvFmtHM(t.timeEnd)].filter(Boolean).join('–');
        const colW = 100 / colTotal;
        const gap  = colTotal > 1 ? 2 : 3;
        return `<div class="pg-pv-hcal-chip${t.completed?' done':''}${isForeign?' pg-pv-hcal-chip-foreign':''}" data-day-task="${t.id}" draggable="true"
            style="top:${top}px;height:${height}px;left:calc(${col*colW}% + ${gap}px);width:calc(${colW}% - ${gap*2}px);background:color-mix(in srgb,${cat.color} ${t.completed?10:16}%,transparent);border-left-color:${cat.color};"
            title="${esc(t.text)}${timeLbl?' · '+timeLbl:''}${isForeign?' (kendi görevin)':''}">
            <span class="pg-pv-hcal-chip-text">${isForeign?'<i class="ti ti-user" style="font-size:9px;margin-right:2px;opacity:.7;"></i>':''}${esc(t.text)}</span>
            ${height>=34 && colTotal===1 ? `<span class="pg-pv-hcal-chip-time">${timeLbl}</span>` : ''}
        </div>`;
    }

    function _pvRenderTaskChips(tasks, g) {
        return tasks.map((t, i) => _pvTaskChip(t, g, i, tasks.length)).join('');
    }

    // ── Ders planı "aynalama" köprüsü ─────────────────────────
    // Öğretmen takvimde saat saat görev eklediğinde (aşağıdaki doAdd/taşıma/silme/
    // düzenleme akışları) bu, `tasks` dizisine yazılır — ama `tasks` HİÇBİR ZAMAN
    // Supabase'e senkronize olmaz (yalnızca `planning_milestones` senkronize olur,
    // bkz. _syncDirty). Öğrenci öğretmenin planını "İncele" ile veya kabul ederek
    // göremiyordu çünkü sadece "Aşama Ekle" formuyla girilenler senkronize oluyordu.
    // Bu üç fonksiyon, ders planı hedeflerinde her `tasks` değişikliğini otomatik
    // olarak eşleşen bir `g.milestones` girdisine ("ayna") yansıtır — böylece
    // öğretmen takvimden nasıl eklerse eklesin, öğrenciye ulaşır.
    // Bir milestone gerçek bir "aşama" mı yoksa takvimden eklenen bir görevin
    // senkron kopyası mı? `task_mirror_id` sadece o an açık olan cihazda (henüz
    // kaydedilmemiş/taze) set edilir; `is_task_mirror` Supabase'e giden kalıcı
    // bayrak (bkz. 100_milestone_task_mirror_flag.sql) — ikisi birden kontrol
    // edilmeli ki hem yerel hem sunucudan/önizlemeden gelen veri doğru tanınsın.
    function _pvIsMirrorMs(m) { return !!(m && (m.task_mirror_id || m.is_task_mirror)); }

    function _pvMirrorTaskToMilestone(g, taskId, title, dateStr, timeStart, timeEnd) {
        if (!_pvIsLessonPlan(g)) return;
        g.milestones = g.milestones || [];
        let ms = g.milestones.find(m => m.task_mirror_id === taskId);
        if (!ms) {
            ms = { id: window.msUid(), task_mirror_id: taskId, is_task_mirror: true, done: false, order: g.milestones.length, description: '' };
            g.milestones.push(ms);
        }
        ms.title = title;
        ms.due_date = dateStr;
        ms.start_date = dateStr;
        ms.start_time = timeStart || '';
        ms.end_time = timeEnd || '';
        ms.is_task_mirror = true;
        g._dirty = true;
    }
    // Bu düzeltmeden önce eklenmiş, hiç aynalanmamış saatli görevleri geriye dönük
    // olarak aşamaya çevirir — böylece daha önce takvimden eklenen içerik de
    // (bir kez plan tekrar açıldığında) senkronize olur ve öğrenciye ulaşır.
    function _pvBackfillMirrors(g) {
        let changed = false;
        // 1) `is_task_mirror` kolonu eklenmeden ÖNCE oluşturulmuş aynalar: yerel cihazda
        // task_mirror_id zaten vardı ama senkron bayrağı hiç set edilmemişti, bu yüzden
        // Supabase'e "gerçek aşama" olarak gitmişlerdi. Burada düzeltilip yeniden işaretlenir.
        (g.milestones || []).forEach(m => {
            if (m.task_mirror_id && !m.is_task_mirror) { m.is_task_mirror = true; changed = true; }
        });
        // 2) Hiç aynalanmamış saatli görevler için yeni ayna oluştur
        const myTasks = FocusStorage.get('tasks', []).filter(t => String(t.parentGoal) === String(g.id) && t.timeStart);
        const mirrored = new Set((g.milestones || []).map(m => m.task_mirror_id).filter(Boolean));
        myTasks.forEach(t => {
            if (mirrored.has(t.id)) return;
            _pvMirrorTaskToMilestone(g, t.id, t.text, _normYMD(t.date), t.timeStart, t.timeEnd);
            changed = true;
        });
        if (changed) { g._dirty = true; persistGoals(); }
    }

    function _pvUnmirrorTask(g, taskId) {
        if (!_pvIsLessonPlan(g)) return;
        const before = (g.milestones || []).length;
        g.milestones = (g.milestones || []).filter(m => m.task_mirror_id !== taskId);
        if (g.milestones.length !== before) g._dirty = true;
    }

    // Genel takvim/gündelik görünümden (plan-view dışından) silinen bir görev, bir
    // ders planının aynalanmış (mirrored) milestone'una karşılık geliyorsa, o milestone
    // da temizlenmezse plan tekrar açıldığında/yeniden atandığında "hayalet görev" olarak
    // geri gelebiliyordu. script.js:deleteGlobalTask bu fonksiyonu çağırarak senkronize eder.
    window.PlanningUnmirrorTaskGlobal = function(taskId) {
        let changed = false;
        (goals || []).forEach(g => {
            if (!_pvIsLessonPlan(g)) return;
            const before = (g.milestones || []).length;
            g.milestones = (g.milestones || []).filter(m => m.task_mirror_id !== String(taskId) && m.task_mirror_id !== taskId);
            if (g.milestones.length !== before) { g._dirty = true; changed = true; }
        });
        if (changed) persistGoals();
    };

    // Haftalık/Günlük gridde görev sürükleme — hedef hücreye bırakınca
    // görevin tarihini/saatini (süresi korunarak) günceller.
    let _pvDragTaskId = null;
    // Bir görevi bırakılan hücreye taşır. O hücrede zaten (kendisi hariç) tek bir
    // görev varsa, üst üste binmek yerine ikisinin yeri/saati DEĞİŞ TOKUŞ edilir.
    function _pvMoveTaskToSlot(taskId, dateStr, hour, g) {
        const tasks = FocusStorage.get('tasks', []);
        const t = tasks.find(x => String(x.id) === String(taskId));
        if (!t) return;
        // Çözülmemiş çakışması olan günlerdeki görevler başka bir güne taşınamaz —
        // sadece aynı gün içinde saat değişebilir (bkz. _pvIsDateLocked).
        if (dateStr !== _normYMD(t.date) && _pvIsDateLocked(g, _normYMD(t.date))) {
            if (typeof toast === 'function') toast('Bu görev çakışma çözülene kadar sadece aynı gün içinde taşınabilir');
            return;
        }
        const targetDateDD = (() => { const [y,mo,dd] = dateStr.split('-'); return `${dd}-${mo}-${y}`; })();

        const occupants = tasks.filter(x =>
            String(x.id) !== String(taskId) && String(x.parentGoal) === String(g.id) &&
            _normYMD(x.date) === dateStr && x.timeStart && Math.floor(_pvTimeToMinLocal(x.timeStart)/60) === hour
        );

        if (occupants.length === 1) {
            // Değiş tokuş: iki görev birbirinin tarih+saatini alır
            const other = occupants[0];
            const tDate = t.date, tStart = t.timeStart, tEnd = t.timeEnd;
            t.date = other.date; t.timeStart = other.timeStart; t.timeEnd = other.timeEnd;
            other.date = tDate; other.timeStart = tStart; other.timeEnd = tEnd;
            // Sadece bu plana ait görevler g.milestones'a aynalanır — öğrencinin kendi
            // (yabancı) görevi bu ders planının aşama listesine karışmamalı.
            if (String(t.parentGoal) === String(g.id)) _pvMirrorTaskToMilestone(g, t.id, t.text, _normYMD(t.date), t.timeStart, t.timeEnd);
            if (String(other.parentGoal) === String(g.id)) _pvMirrorTaskToMilestone(g, other.id, other.text, _normYMD(other.date), other.timeStart, other.timeEnd);
        } else {
            // Hedef boş (ya da belirsiz/çok sayıda) — sadece taşı, süresi korunur
            const durMin = Math.max(30, _pvTimeToMinLocal(t.timeEnd || t.timeStart) - _pvTimeToMinLocal(t.timeStart || '0:00'));
            const newStartMin = hour * 60;
            const newEndMin = Math.min(newStartMin + durMin, 23*60 + 59);
            t.timeStart = `${String(hour).padStart(2,'0')}:00`;
            t.timeEnd   = `${String(Math.floor(newEndMin/60)).padStart(2,'0')}:${String(newEndMin%60).padStart(2,'0')}`;
            t.date = targetDateDD;
            if (String(t.parentGoal) === String(g.id)) _pvMirrorTaskToMilestone(g, t.id, t.text, dateStr, t.timeStart, t.timeEnd);
        }
        FocusStorage.set('tasks', tasks);
        if (_pvIsLessonPlan(g)) persistGoals();
        if (typeof window.syncTasksFromStorage === 'function') window.syncTasksFromStorage();
        if (typeof window.renderCalendarGlobal === 'function') window.renderCalendarGlobal();
    }

    // Takvimde bir göreve tıklanınca, "Günün Görevleri" listesindeki karşılığı
    // kısa bir animasyonla belirsin — kullanıcı listede aramak zorunda kalmasın.
    function _pvHighlightTaskInList(taskId) {
        const row = document.querySelector(`#pg-pv-day-tasks-list [data-day-task="${taskId}"]`);
        if (!row) return;
        row.classList.remove('pg-pv-task-pulse');
        void row.offsetWidth; // reflow — animasyonu yeniden tetikler
        row.classList.add('pg-pv-task-pulse');
        row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function _pvBindHourGridDrag(el, g) {
        el.querySelectorAll('.pg-pv-hcal-chip[data-day-task]').forEach(chip => {
            chip.addEventListener('click', e => {
                e.stopPropagation();
                const dateStr = chip.closest('[data-cal-date]')?.dataset.calDate;
                if (dateStr) _pvSelectDay(g, dateStr);
                setTimeout(() => _pvHighlightTaskInList(chip.dataset.dayTask), dateStr ? 60 : 0);
            });
            chip.addEventListener('dragstart', e => {
                _pvDragTaskId = chip.dataset.dayTask;
                e.dataTransfer.effectAllowed = 'move';
                chip.classList.add('dragging');
            });
            chip.addEventListener('dragend', () => chip.classList.remove('dragging'));
        });
        el.querySelectorAll('.pg-pv-hcal-cell').forEach(cell => {
            cell.addEventListener('dragover', e => { e.preventDefault(); cell.classList.add('drag-over'); });
            cell.addEventListener('dragleave', () => cell.classList.remove('drag-over'));
            cell.addEventListener('drop', e => {
                e.preventDefault();
                cell.classList.remove('drag-over');
                if (!_pvDragTaskId) return;
                const hadConflicts = _pvHasUnresolvedConflicts(g);
                _pvMoveTaskToSlot(_pvDragTaskId, cell.dataset.calDate, parseInt(cell.dataset.hour), g);
                _pvDragTaskId = null;
                if (hadConflicts && !_pvHasUnresolvedConflicts(g)) toast('Tüm çakışmalar çözüldü ✓', '#06d6a0');
                _pvUpdateConflictBanner(g);
                _pvRenderMainCal(g);
                _pvRenderDayPanel(g, pvSelectedDate);
            });
        });
    }

    function _pvBindHourGridNav(el, g, stepDays) {
        el.querySelector('#pg-pv-mcal-prev')?.addEventListener('click', () => {
            (pvWeekCursor && pvCalView==='week' ? pvWeekCursor : pvDayCursor).setDate((pvWeekCursor && pvCalView==='week' ? pvWeekCursor : pvDayCursor).getDate() - stepDays);
            _pvRenderMainCal(g);
        });
        el.querySelector('#pg-pv-mcal-next')?.addEventListener('click', () => {
            (pvWeekCursor && pvCalView==='week' ? pvWeekCursor : pvDayCursor).setDate((pvWeekCursor && pvCalView==='week' ? pvWeekCursor : pvDayCursor).getDate() + stepDays);
            _pvRenderMainCal(g);
        });
        el.querySelector('#pg-pv-mcal-today')?.addEventListener('click', () => {
            if (pvCalView === 'week') pvWeekCursor = new Date(); else pvDayCursor = new Date();
            _pvRenderMainCal(g);
        });
        el.querySelectorAll('[data-day-task]').forEach(chip => {
            chip.addEventListener('click', e => { e.stopPropagation(); _pvSelectDay(g, chip.closest('[data-cal-date]')?.dataset.calDate || _dstrLocal(pvDayCursor)); });
        });
        _pvBindBusyToggle(el, g);
    }

    // toISOString() UTC'ye çevirir — yerel saat dilimi UTC'nin ilerisindeyse (ör. Türkiye,
    // UTC+3) gece yarısını temsil eden bir Date bir önceki güne kayar. Yerel yıl/ay/gün
    // parçalarını doğrudan kullanmak bu kaymayı önler (bkz. _pvJumpToDate ile günlük görünüme
    // atlarken ortaya çıkan "çakışma günlükte görünmüyor" hatası).
    function _dstrLocal(d) {
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }

    function _pvRenderWeekCal(g) {
        const el = document.getElementById('pg-pv-main-cal');
        if (!el) return;
        const cursor = pvWeekCursor || new Date();
        pvWeekCursor = cursor;
        const start = new Date(cursor); start.setDate(cursor.getDate() - ((cursor.getDay() + 6) % 7));
        const dayNames = ['Pt','Sa','Ça','Pe','Cu','Ct','Pz'];
        const todayStr = _dstrLocal(new Date());

        const dayCols = Array.from({length:7}, (_,i) => { const d = new Date(start); d.setDate(start.getDate()+i); return d; });

        let headerCells = '<div class="pg-pv-hcal-corner"></div>';
        dayCols.forEach((d,i) => {
            const dateStr = _dstrLocal(d);
            headerCells += `<div class="pg-pv-hcal-daycol-head${dateStr===todayStr?' today':''}">${dayNames[i]}<br>${d.getDate()}</div>`;
        });

        const conflictHours = _pvConflictHourSetFor(g);
        let rows = '';
        for (let h = PVC_HOUR_START; h <= PVC_HOUR_END; h++) {
            rows += `<div class="pg-pv-hcal-hourlabel">${String(h).padStart(2,'0')}:00</div>`;
            dayCols.forEach(d => {
                const dateStr = _dstrLocal(d);
                const tasks = _pvGoalTasksOn(g, dateStr).filter(t => t.timeStart && Math.floor(_pvTimeToMinLocal(t.timeStart)/60) === h);
                const busy = _pvIsBusyHour(dateStr, h);
                const conflict = conflictHours.has(`${dateStr}|${h}`);
                rows += `<div class="pg-pv-hcal-cell${busy?' pg-pv-hcal-cell-busy':''}${conflict?' pg-pv-hcal-cell-conflict':''}" data-cal-date="${dateStr}" data-hour="${h}" title="${conflict?'Çakışan saat — düzenlemen gerekiyor':(busy?'Öğrenci bu saatte dolu':'')}">
                    ${conflict ? '<i class="ti ti-alert-triangle pg-pv-hcal-cell-conflict-icon"></i>' : (busy ? '<i class="ti ti-lock pg-pv-hcal-cell-busy-icon"></i>' : '')}
                    ${_pvRenderTaskChips(tasks, g)}
                </div>`;
            });
        }

        const endD = new Date(start); endD.setDate(start.getDate() + 6);
        const label = `${start.getDate()} ${start.toLocaleDateString('tr-TR',{month:'short'})} – ${endD.getDate()} ${endD.toLocaleDateString('tr-TR',{month:'short'})}`;

        el.innerHTML = _pvHourGridHead(label, g) + `
            <div class="pg-pv-hcal-wrap">
                <div class="pg-pv-hcal-grid pg-pv-hcal-grid-week">${headerCells}${rows}</div>
            </div>`;

        _pvBindHourGridNav(el, g, 7);
        _pvBindCalSwitch(el, g);
        _pvBindHourGridDrag(el, g);
        el.querySelectorAll('.pg-pv-hcal-cell').forEach(cell => {
            cell.addEventListener('click', e => {
                if (e.target.closest('[data-day-task]')) return;
                _pvSelectDay(g, cell.dataset.calDate);
                setTimeout(() => {
                    const startInp = document.getElementById('pg-pv-day-time-start');
                    const endInp   = document.getElementById('pg-pv-day-time-end');
                    if (startInp) { startInp.value = `${String(cell.dataset.hour).padStart(2,'0')}:00`; }
                    if (endInp)   { endInp.value = `${String(Math.min(parseInt(cell.dataset.hour)+1,23)).padStart(2,'0')}:00`; }
                    document.getElementById('pg-pv-day-add-inp')?.focus();
                }, 50);
            });
        });
    }

    function _pvRenderDayCal(g) {
        const el = document.getElementById('pg-pv-main-cal');
        if (!el) return;
        const cursor = pvDayCursor || new Date();
        pvDayCursor = cursor;
        const dateStr = _dstrLocal(cursor);
        const label = cursor.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' });
        const tasks = _pvGoalTasksOn(g, dateStr);
        const conflictHours = _pvConflictHourSetFor(g);

        let rows = '';
        for (let h = PVC_HOUR_START; h <= PVC_HOUR_END; h++) {
            const hourTasks = tasks.filter(t => t.timeStart && Math.floor(_pvTimeToMinLocal(t.timeStart)/60) === h);
            const busy = _pvIsBusyHour(dateStr, h);
            const conflict = conflictHours.has(`${dateStr}|${h}`);
            rows += `<div class="pg-pv-hcal-hourlabel">${String(h).padStart(2,'0')}:00</div>
                <div class="pg-pv-hcal-cell${busy?' pg-pv-hcal-cell-busy':''}${conflict?' pg-pv-hcal-cell-conflict':''}" data-cal-date="${dateStr}" data-hour="${h}" title="${conflict?'Çakışan saat — düzenlemen gerekiyor':(busy?'Öğrenci bu saatte dolu':'')}">
                    ${conflict ? '<i class="ti ti-alert-triangle pg-pv-hcal-cell-conflict-icon"></i>' : (busy ? '<i class="ti ti-lock pg-pv-hcal-cell-busy-icon"></i>' : '')}
                    ${_pvRenderTaskChips(hourTasks, g)}
                </div>`;
        }

        el.innerHTML = _pvHourGridHead(label, g) + `
            <div class="pg-pv-hcal-wrap">
                <div class="pg-pv-hcal-grid pg-pv-hcal-grid-day">${rows}</div>
            </div>`;

        _pvBindHourGridNav(el, g, 1);
        _pvBindCalSwitch(el, g);
        _pvBindHourGridDrag(el, g);
        el.querySelectorAll('.pg-pv-hcal-cell').forEach(cell => {
            cell.addEventListener('click', e => {
                if (e.target.closest('[data-day-task]')) return;
                setTimeout(() => {
                    const startInp = document.getElementById('pg-pv-day-time-start');
                    const endInp   = document.getElementById('pg-pv-day-time-end');
                    if (startInp) { startInp.value = `${String(cell.dataset.hour).padStart(2,'0')}:00`; }
                    if (endInp)   { endInp.value = `${String(Math.min(parseInt(cell.dataset.hour)+1,23)).padStart(2,'0')}:00`; }
                    document.getElementById('pg-pv-day-add-inp')?.focus();
                }, 50);
            });
        });
        _pvSelectDay(g, dateStr);
    }

    function _pvRenderMainCal(g) {
        const el = document.getElementById('pg-pv-main-cal');
        if (!el) return;

        if (_pvIsLessonPlan(g) && pvCalView === 'week') return _pvRenderWeekCal(g);
        if (_pvIsLessonPlan(g) && pvCalView === 'day')  return _pvRenderDayCal(g);

        const today    = new Date();
        const firstDay = new Date(pvCalYear, pvCalMonth, 1);
        const lastDate = new Date(pvCalYear, pvCalMonth + 1, 0).getDate();
        const startDow = (firstDay.getDay() + 6) % 7; // Monday-first
        const monthLbl = firstDay.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
        const cat      = window.getCat(g.category);

        // Build milestone lookup by date — takvimden saat saat eklenen görevlerin "aynası"
        // olan milestone'lar (task_mirror_id'li) burada HARİÇ tutulur: bunlar gerçek bir
        // "aşama" değil, tek bir görevin senkron kopyası; günün ısı/görev-sayısı stiliyle
        // zaten temsil ediliyorlar (taskMap üzerinden), ayrıca renkli "aşama" etiketi/rozeti
        // almaları hem anlamsız hem her görev farklı bir renk aldığı için görsel karmaşa
        // yaratıyordu (bkz. kullanıcı ekran görüntüsü — her gün farklı renkte kutu).
        const msDateMap = {};
        (g.milestones || []).forEach(m => {
            if (!m.due_date || _pvIsMirrorMs(m)) return;
            const d = new Date(m.due_date);
            const key = d.toISOString().split('T')[0];
            msDateMap[key] = m;
        });

        // Build task lookup by date — only tasks belonging to this goal
        const allTasks = FocusStorage.get('tasks', []);
        const taskMap  = {};
        allTasks.filter(t => String(t.parentGoal) === String(g.id)).forEach(t => {
            if (!t.date) return;
            const key = _normYMD(t.date); // normalize DD-MM-YYYY → YYYY-MM-DD
            if (!taskMap[key]) taskMap[key] = [];
            taskMap[key].push(t);
        });

        const dlDateStr = g.deadline ? new Date(g.deadline).toISOString().split('T')[0] : null;
        const dayNames  = ['Pt','Sa','Ça','Pe','Cu','Ct','Pz'];

        // Aylık görünümde de çakışan günler görünsün ki kullanıcı hafta/gün gridine
        // girmeden hangi günlerde saat çakışması olduğunu rahatça görebilsin.
        const conflictDates = g.lpa_id
            ? new Set(_pvRecomputeUnresolvedConflicts(g).flatMap(c => [_normYMD(c.lesson.date), _normYMD(c.own.date)]))
            : new Set();

        // Build milestone range map: dateStr → { ms, msIdx, isStart, isEnd, color }
        const RANGE_COLORS = ['#7c6eff','#ef476f','#06d6a0','#ffd166','#ff9f43','#60a5fa'];
        const rangeMap = {};
        (g.milestones || []).forEach((m, mi) => {
            if (_pvIsMirrorMs(m)) return; // takvimden eklenen görevin aynası — yukarıdaki notla aynı gerekçe
            if (!m.start_date && !m.due_date) return;
            const start = m.start_date || m.due_date;
            const end   = m.due_date   || m.start_date;
            if (!start || !end) return;
            const rangeColor = RANGE_COLORS[mi % RANGE_COLORS.length];
            const s = new Date(start + 'T00:00:00');
            const e = new Date(end   + 'T00:00:00');
            for (let cur = new Date(s); cur <= e; cur.setDate(cur.getDate() + 1)) {
                // Use LOCAL date parts to avoid UTC timezone shift
                const key = `${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,'0')}-${String(cur.getDate()).padStart(2,'0')}`;
                rangeMap[key] = {
                    ms: m, msIdx: mi, color: rangeColor,
                    isStart: key === start,
                    isEnd:   key === end,
                };
            }
        });

        // Build prev-month trailing days (not clickable — past)
        const prevMonthLast = new Date(pvCalYear, pvCalMonth, 0).getDate();
        let cells = '';
        for (let i = 0; i < startDow; i++) {
            const d = prevMonthLast - startDow + 1 + i;
            const prevY = pvCalMonth === 0 ? pvCalYear - 1 : pvCalYear;
            const prevM = pvCalMonth === 0 ? 12 : pvCalMonth;
            const dateStr = `${prevY}-${String(prevM).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            cells += `<div class="pg-pv-main-cal-cell other-month past">
                <div class="pg-pv-main-cal-day-num">${d}</div>
            </div>`;
        }

        const todayStr = today.toISOString().split('T')[0];

        for (let d = 1; d <= lastDate; d++) {
            const dateStr  = `${pvCalYear}-${String(pvCalMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            const isToday  = dateStr === todayStr;
            const isPast   = dateStr < todayStr;
            const isSel    = dateStr === pvSelectedDate;
            const ms       = msDateMap[dateStr];
            const dayTasks = taskMap[dateStr] || [];
            const isDl     = dateStr === dlDateStr;
            const rangeInfo = rangeMap[dateStr];
            const isBusyDay = !isPast && _pvIsBusyDay(dateStr);
            const isConflictDay = !isPast && conflictDates.has(dateStr);

            // Heatmap: task density colour — skip when cell is inside a milestone range
            // (both use background !important; range colour must win)
            const taskN = dayTasks.length;
            let heatStyle = '';
            if (taskN >= 1 && !isPast && !rangeInfo) {
                const alpha = Math.min(0.08 + taskN * 0.07, 0.45);
                heatStyle = `--heat-bg:color-mix(in srgb,${cat.color} ${Math.round(alpha*100)}%,transparent);`;
            }

            let extraCls = '';
            if (isToday)  extraCls += ' today';
            if (isPast)   extraCls += ' past';
            if (isSel)    extraCls += ' selected';
            if (isDl)     extraCls += ' deadline-day';
            if (ms)       extraCls += ' ms-day';
            if (taskN)    extraCls += ' has-tasks';
            if (isBusyDay) extraCls += ' pg-pv-cal-day-busy';
            if (isConflictDay) extraCls += ' pg-pv-cal-day-conflict';
            if (taskN >= 1 && !isPast && !rangeInfo) extraCls += ' heat-day';

            // Range classes
            let rangeStyle = '';
            let rangeEdge  = '';
            if (rangeInfo) {
                extraCls  += ' ms-range';
                if (rangeInfo.isStart && rangeInfo.isEnd) extraCls += ' range-only';
                else if (rangeInfo.isStart) extraCls += ' range-start';
                else if (rangeInfo.isEnd)   extraCls += ' range-end';
                else                        extraCls += ' range-mid';
                rangeStyle = `--range-color:${rangeInfo.color};`;
                if (rangeInfo.isEnd && rangeInfo.ms.title) {
                    rangeEdge = `<div class="pg-pv-range-end-label" style="color:${rangeInfo.color};">${esc(rangeInfo.ms.title.slice(0,12))}</div>`;
                }
            }

            const dotsHtml = ms
                ? `<div class="pg-pv-main-cal-dot" style="background:${cat.color};" title="${esc(ms.title)}"></div>`
                : '';

            const msLabel = (ms && !rangeInfo?.isEnd)
                ? `<div class="pg-pv-main-cal-ms-label" style="color:${cat.color};background:color-mix(in srgb,${cat.color} 12%,transparent);">${esc(ms.title.slice(0,14))}</div>`
                : '';

            const taskCount = dayTasks.length
                ? `<div class="pg-pv-main-cal-task-count">${dayTasks.length} görev</div>`
                : '';

            const cellStyle = (rangeStyle || heatStyle) ? `style="${rangeStyle}${heatStyle}"` : '';

            if (isPast) {
                cells += `<div class="pg-pv-main-cal-cell${extraCls}" ${cellStyle}>
                    <div class="pg-pv-main-cal-day-num">${d}</div>
                    ${rangeEdge}
                    <div class="pg-pv-main-cal-dots">${dotsHtml}</div>
                </div>`;
            } else {
                cells += `<div class="pg-pv-main-cal-cell${extraCls}" data-cal-date="${dateStr}" ${cellStyle} ${isConflictDay ? 'title="Bu günde saat çakışması var"' : (isBusyDay ? 'title="Öğrenci bu gün dolu"' : '')}>
                    <div class="pg-pv-main-cal-day-num">${d}</div>
                    ${isConflictDay ? '<i class="ti ti-alert-triangle pg-pv-cal-day-conflict-icon"></i>' : (isBusyDay ? '<i class="ti ti-lock pg-pv-cal-day-busy-icon"></i>' : '')}
                    ${rangeEdge || msLabel}
                    ${taskCount}
                    <div class="pg-pv-main-cal-dots">${dotsHtml}</div>
                </div>`;
            }
        }

        // Trailing next-month days — clickable, navigate to next month
        const totalCells = startDow + lastDate;
        const remaining  = totalCells % 7 ? 7 - (totalCells % 7) : 0;
        const nextY = pvCalMonth === 11 ? pvCalYear + 1 : pvCalYear;
        const nextM = pvCalMonth === 11 ? 0 : pvCalMonth + 1;
        for (let d = 1; d <= remaining; d++) {
            const dateStr = `${nextY}-${String(nextM+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            const isPastNext = dateStr < todayStr;
            cells += `<div class="pg-pv-main-cal-cell other-month${isPastNext ? ' past' : ''}" ${isPastNext ? '' : `data-jump-date="${dateStr}" data-jump-year="${nextY}" data-jump-month="${nextM}"`}>
                <div class="pg-pv-main-cal-day-num">${d}</div>
            </div>`;
        }

        el.innerHTML = `
            <div class="pg-pv-main-cal-nav">
                <div style="display:flex;align-items:center;gap:8px;">
                    <button class="pg-pv-main-cal-nav-btn" id="pg-pv-mcal-prev"><i class="ti ti-chevron-left"></i></button>
                    <div class="pg-pv-main-cal-month">${monthLbl}</div>
                    <button class="pg-pv-main-cal-nav-btn" id="pg-pv-mcal-next"><i class="ti ti-chevron-right"></i></button>
                </div>
                <div style="display:flex;align-items:center;gap:6px;">
                    ${_pvCalSwitchInline(g)}
                    <button class="pg-pv-main-cal-today-btn" id="pg-pv-mcal-today">Bugün</button>
                    ${_pvBusyToggleBtn(g)}
                </div>
            </div>
            <div class="pg-pv-main-cal-grid">
                ${dayNames.map(d => `<div class="pg-pv-main-cal-hdr">${d}</div>`).join('')}
                ${cells}
            </div>`;

        _pvBindCalSwitch(el, g);
        _pvBindBusyToggle(el, g);
        el.querySelector('#pg-pv-mcal-prev')?.addEventListener('click', () => {
            pvCalMonth--; if (pvCalMonth < 0) { pvCalMonth = 11; pvCalYear--; }
            _pvRenderMainCal(g);
        });
        el.querySelector('#pg-pv-mcal-next')?.addEventListener('click', () => {
            pvCalMonth++; if (pvCalMonth > 11) { pvCalMonth = 0; pvCalYear++; }
            _pvRenderMainCal(g);
        });
        // Wizard dates mode: show pulsing overlay hint on calendar
        if (pvWiz?.step === 'dates') {
            const hint = document.createElement('div');
            hint.className = 'pvwiz-cal-overlay-hint';
            const g2 = goals.find(x => x.id === pvGoalId) || g;
            const cur = g2.milestones?.[pvWiz.dateIdx || 0];
            hint.innerHTML = `<i class="ti ti-hand-click"></i> <strong>${cur ? esc(cur.title.slice(0,22)) : ''}</strong> için tarih seç`;
            el.style.position = 'relative';
            el.appendChild(hint);
        }

        el.querySelector('#pg-pv-mcal-today')?.addEventListener('click', () => {
            pvCalYear  = today.getFullYear();
            pvCalMonth = today.getMonth();
            pvSelectedDate = today.toISOString().split('T')[0];
            _pvRenderMainCal(g);
            _pvRenderDayPanel(g, pvSelectedDate);
        });

        // ── Öneri 1: Peer cursor overlays ───────────────────────
        if (window.PlanningCollab?.isActive()) {
            const peerState = window.PlanningCollab.getPeerState();
            Object.values(peerState).forEach(peer => {
                if (!peer.cursorDay) return;
                const peerCell = el.querySelector(`[data-cal-date="${peer.cursorDay}"]`);
                if (!peerCell) return;
                if (!peerCell.querySelector('.pg-pv-peer-cursor')) {
                    const ov = document.createElement('div');
                    ov.className = 'pg-pv-peer-cursor';
                    ov.style.setProperty('--peer-color', peer.color || '#888');
                    ov.title = `${peer.name} bu günde`;
                    ov.innerHTML = `<span class="pg-pv-peer-avatar">${esc((peer.name||'?').slice(0,2).toUpperCase())}</span>`;
                    peerCell.appendChild(ov);
                }
            });
        }

        el.querySelectorAll('[data-cal-date]').forEach(cell => {
            cell.addEventListener('click', () => {
                const dateStr = cell.dataset.calDate;
                // If wizard is in dates step, route click there
                if (pvWiz?.step === 'dates') {
                    _pvWizAssignDate(g, dateStr);
                    return;
                }
                pvSelectedDate = dateStr;
                el.querySelectorAll('[data-cal-date]').forEach(c => c.classList.remove('selected'));
                cell.classList.add('selected');
                // Sync stepper: activate the milestone whose range contains this date
                const msForDate = (g.milestones || []).find(m =>
                    m.start_date && m.due_date &&
                    dateStr >= m.start_date && dateStr <= m.due_date
                );
                if (msForDate) pvActiveMsId = msForDate.id;
                _pvRenderDayPanel(g, pvSelectedDate);
                _pvRenderStepper(g);
                // ── Öneri 1: Kursor günü broadcast ──────────────
                if (window.PlanningCollab?.isActive()) {
                    const me = window.PlanningCollab._me();
                    window.PlanningCollab.broadcast('cursor_day', {
                        dateStr, user_name: me.name, user_color: me.color
                    });
                }
            });
        });

        // Next-month trailing cells — jump to next month
        el.querySelectorAll('[data-jump-date]').forEach(cell => {
            cell.style.cursor = 'pointer';
            cell.addEventListener('click', () => {
                pvCalYear      = parseInt(cell.dataset.jumpYear);
                pvCalMonth     = parseInt(cell.dataset.jumpMonth);
                pvSelectedDate = cell.dataset.jumpDate;
                _pvRenderMainCal(g);
                _pvRenderDayPanel(g, pvSelectedDate);
            });
        });
    }

    function _pvWeekTotalMins(tasks, wStart, wEnd) {
        let mins = 0;
        tasks.forEach(t => {
            if (!t.date || t._pending) return;
            const d = _normYMD(t.date);
            if (d < wStart || d > wEnd) return;
            if (t.timeStart && t.timeEnd) {
                const diff = _pvTimeToMin(t.timeEnd) - _pvTimeToMin(t.timeStart);
                if (diff > 0) mins += diff;
            }
        });
        return mins;
    }

    function _pvFmtDuration(mins) {
        if (mins <= 0) return null;
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        if (h === 0) return `${m} dk`;
        if (m === 0) return `${h} sa`;
        return `${h} sa ${m} dk`;
    }

    function _pvPlanFinish(g) {
        pvWiz.step = 'summary';
        _pvRenderStepper(g);
        _pvRenderMainCal(g);
    }

    function _pvRenderPlanSummary(g, container) {
        const cat    = window.getCat(g.category);
        const msList = g.milestones || [];
        const allTasks = FocusStorage.get('tasks', []).filter(t => String(t.parentGoal) === String(g.id));
        const goalTasks = allTasks.filter(t => {
            const d = _normYMD(t.date);
            return msList.some(m => d >= (m.start_date||'') && d <= (m.due_date||'')) || true;
        });

        let totalMins = 0;
        goalTasks.forEach(t => {
            if (t.timeStart && t.timeEnd) {
                const d = _pvTimeToMin(t.timeEnd) - _pvTimeToMin(t.timeStart);
                if (d > 0) totalMins += d;
            }
        });

        // Per-milestone stats
        const msRows = msList.map((m, i) => {
            const mTasks = allTasks.filter(t => { const d = _normYMD(t.date); return d >= (m.start_date||'') && d <= (m.due_date||''); });
            const mMins  = _pvWeekTotalMins(allTasks, m.start_date||'', m.due_date||'');
            const dur    = _pvFmtDuration(mMins);
            return `<div class="pvwiz-summary-ms-row">
                <span class="pvwiz-summary-ms-num" style="background:color-mix(in srgb,${cat.color} 18%,transparent);color:${cat.color};">${i+1}</span>
                <span class="pvwiz-summary-ms-title">${esc(m.title.slice(0,22))}</span>
                <span class="pvwiz-summary-ms-stat">${mTasks.length} görev${dur ? ' · ' + dur : ''}</span>
            </div>`;
        }).join('');

        const totalDur = _pvFmtDuration(totalMins);

        container.innerHTML = `<div class="pvwiz-chat pvwiz-summary" id="pvwiz-summary">
            <div class="pvwiz-summary-glow" style="background:${cat.color};"></div>
            <div class="pvwiz-summary-icon">${cat.icon}</div>
            <div class="pvwiz-summary-title">Harika! 🎉</div>
            <div class="pvwiz-summary-sub">"${esc(g.title.slice(0,30))}" hedefin planlandı</div>
            <div class="pvwiz-summary-stats">
                <div class="pvwiz-summary-stat-card">
                    <div class="pvwiz-summary-stat-val" style="color:${cat.color};">${goalTasks.length}</div>
                    <div class="pvwiz-summary-stat-lbl">Toplam Görev</div>
                </div>
                <div class="pvwiz-summary-stat-card">
                    <div class="pvwiz-summary-stat-val" style="color:${cat.color};">${msList.length}</div>
                    <div class="pvwiz-summary-stat-lbl">Aşama</div>
                </div>
                ${totalDur ? `<div class="pvwiz-summary-stat-card">
                    <div class="pvwiz-summary-stat-val" style="color:${cat.color};">${totalDur}</div>
                    <div class="pvwiz-summary-stat-lbl">Toplam Süre</div>
                </div>` : ''}
            </div>
            <div class="pvwiz-summary-ms-list">${msRows}</div>
            <button class="pvwiz-plan-next-ms-btn" id="pvwiz-summary-done" style="--wiz-color:${cat.color}; margin-top:12px;">
                <i class="ti ti-rocket"></i> Başla!
            </button>
        </div>`;

        container.querySelector('#pvwiz-summary-done')?.addEventListener('click', () => {
            pvWiz.step   = 'done';
            pvActiveMsId = msList[0]?.id || null;
            const gFinal = goals.find(x => x.id === pvGoalId);
            if (gFinal) gFinal._dirty = true;
            persistGoals();
            _pvBroadcastWizState();
            const gDone = gFinal || g;
            _pvRenderStepper(gDone);
            _pvRenderMainCal(gDone);
            toast('🚀 Haydi başlayalım!');
        });
    }

    // ── Right: Gün Detayı ────────────────────
    function _pvRenderDayPanel(g, dateStr) {
        const el = document.getElementById('pg-pv-day-panel');
        if (!el) return;
        if (!dateStr) {
            el.innerHTML = `<div class="pg-pv-day-empty">
                <div class="pg-pv-day-empty-icon">📅</div>
                <div class="pg-pv-day-empty-text">Bir güne tıkla</div>
                <div class="pg-pv-day-empty-sub">Takvimden bir güne tıklayınca o günün özeti burada görünür</div>
            </div>`;
            return;
        }

        const cat      = window.getCat(g.category);
        const dateObj  = new Date(dateStr + 'T00:00:00');
        const dayName  = dateObj.toLocaleDateString('tr-TR', { weekday: 'long' });
        const dateLbl  = dateObj.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
        const today    = new Date().toISOString().split('T')[0];
        const isToday  = dateStr === today;

        // Milestone on this day?
        const ms = (g.milestones || []).find(m => m.due_date === dateStr);

        // Tasks for this day — normalde sadece bu hedefe ait görevler gösterilir; ancak
        // öğrencinin öğretmenden kabul ettiği ders planını (g.lpa_id) kendi takvimi olarak
        // düzenlerken çakışan kendi görevini de görüp saatini düzeltebilmesi için o gündeki
        // TÜM kendi görevleri listelenir (bkz. _pvGoalTasksOn, aynı mantık).
        let allTasks = FocusStorage.get('tasks', []);
        const dayTasks = g.lpa_id
            ? allTasks.filter(t => _normYMD(t.date) === dateStr)
            : allTasks.filter(t => _normYMD(t.date) === dateStr && String(t.parentGoal) === String(g.id));
        // Saate göre sırala — sürükle-bırakla saat değiştirilince liste eski (ekleniş)
        // sırasında donup kalmasın (bkz. bildirilen sıralama hatası). Saati olmayanlar sona.
        dayTasks.sort((a, b) => {
            if (!a.timeStart && !b.timeStart) return 0;
            if (!a.timeStart) return 1;
            if (!b.timeStart) return -1;
            return _pvTimeToMin(a.timeStart) - _pvTimeToMin(b.timeStart);
        });
        // Çözülmemiş çakışması olan görevler (bkz. _pvRecomputeUnresolvedConflicts) — listede
        // animasyonlu vurgulanır, tıklanınca haftalık görünümde o saate atlanır.
        const conflictTaskIds = g.lpa_id
            ? new Set(_pvRecomputeUnresolvedConflicts(g).flatMap(c => [c.lesson.id, c.own.id]))
            : new Set();

        // Capacity — unique occupied minutes for THIS goal's tasks only (avoids counting
        // other goals' tasks that were synced from collaborators in a multi-user session)
        const DAILY_LIMIT_MIN = 480; // 8 saat
        const occupiedMins = new Set();
        allTasks
            .filter(t => _normYMD(t.date) === dateStr && t.timeStart && t.timeEnd && !t._pending
                      && String(t.parentGoal) === String(g.id))
            .forEach(t => {
                const s = _pvTimeToMin(t.timeStart);
                const e = _pvTimeToMin(t.timeEnd);
                for (let m = s; m < e; m++) occupiedMins.add(m);
            });
        const usedMin = occupiedMins.size;
        const pct      = Math.min(100, Math.round(usedMin / DAILY_LIMIT_MIN * 100));
        const isFull   = pct >= 100;
        const remMin   = Math.max(0, DAILY_LIMIT_MIN - usedMin);
        // Ücretsiz planda kapasite dolunca yeni görev eklemek engellenir (blocker) — aşırı yüklenmeyi
        // önlemek asıl amaç. Ücretli (premium/kurumsal) planda ise kısıtlamıyoruz, sadece bilgilendiriyoruz
        // (advisory) — çünkü ders planı gibi dışarıdan dayatılan gerçek programları girmek engellenmemeli.
        // Ceza değil farkındalık çerçevesi: premium/ders planında dolulukta bile alarm-kırmızı yerine
        // sakin bir amber ton ve destekleyici bir dil kullanılır (bkz. psikolog perspektifi notları).
        const isPremiumUser = window.currentUser?.plan === 'premium'
            || ['student', 'teacher'].includes(window.currentUser?.institutionRole);
        const barColor = isFull ? (isPremiumUser ? '#ff9f43' : '#ff4757') : pct >= 75 ? '#ff9f43' : '#06d6a0';
        const usedH    = Math.floor(usedMin / 60), usedM = usedMin % 60;
        const remH     = Math.floor(remMin / 60),  remM  = remMin % 60;
        const usedLbl  = usedM ? `${usedH}s ${usedM}dk` : `${usedH}s`;
        const blocksAdd = isFull && !isPremiumUser;
        const remLbl   = isFull ? 'Dolu' : (remM ? `${remH}s ${remM}dk` : `${remH}s`);
        const segsHtml = Array.from({length:8},(_,i)=>
            `<div style="flex:1;height:3px;border-radius:2px;background:${i<Math.min(8,Math.floor(usedMin/60))?barColor:'rgba(128,128,128,.15)'};"></div>`
        ).join('');
        const capacityLabel = isPremiumUser ? 'Yoğunluk' : 'Kapasite';
        const capacityWarnIcon = isFull
            ? (isPremiumUser
                ? `<span style="font-size:10px;color:#ff9f43;" title="Bu gün yoğun planlanmış — küçük bir mola iyi gelebilir 🌙">🌙</span>`
                : `<span style="font-size:10px;color:#ff4757;" title="Bu gün dolu — yeni görev eklenemez">🔥</span>`)
            : '';
        const capacityHtml = `
            <div style="display:flex;align-items:center;gap:8px;margin:10px 0 8px;padding:6px 10px;border-radius:8px;background:rgba(128,128,128,.06);border:1px solid rgba(128,128,128,.1);">
                <span style="font-size:10px;color:var(--text-muted,#888);white-space:nowrap;flex-shrink:0;">${capacityLabel}</span>
                <div style="flex:1;display:flex;gap:2px;">${segsHtml}</div>
                <span style="font-size:10px;font-weight:600;color:${barColor};white-space:nowrap;flex-shrink:0;">${usedLbl} / 8s${(isFull && !isPremiumUser) ? '' : ` · ${remLbl} kaldı`}</span>
                ${capacityWarnIcon}
            </div>`;


        // ── Öneri 1: Typing indicator ─────────────────────────────
        let typingHtml = '';
        if (window.PlanningCollab?.isActive()) {
            const peerState = window.PlanningCollab.getPeerState();
            const typers = Object.values(peerState).filter(p => p.typingDay === dateStr);
            if (typers.length) {
                typingHtml = `<div class="pg-pv-typing-indicator">
                    ${typers.map(p => `<span class="pg-pv-typing-avatar" style="background:${p.color||'#888'};">${esc((p.name||'?').slice(0,2).toUpperCase())}</span>`).join('')}
                    <span class="pg-pv-typing-text">${typers.map(p=>esc(p.name)).join(', ')} yazıyor</span>
                    <span class="pg-pv-typing-dots"><span></span><span></span><span></span></span>
                </div>`;
            }
        }

        // ── Öneri 2: Pending tasks (onay bekleyenler) ─────────────
        const isOwner = (window.PlanningCollab?.myRole || 'owner') === 'owner';
        const approvalOn = window.PlanningCollab?.isActive() && window.PlanningCollab?.isApprovalRequired();

        const tasksHtml = dayTasks.length
            ? dayTasks.map(t => {
                const isPending = !!t._pending;
                const addedBy   = t._addedBy;
                const addedByBadge = addedBy
                    ? `<span class="pg-pv-task-mini-avatar" style="background:${addedBy.color||'#888'};" data-name="${esc(addedBy.name)} ekledi">${esc((addedBy.name||'?').slice(0,2).toUpperCase())}</span>`
                    : '';
                const pendingActions = isPending && isOwner
                    ? `<button class="pg-pv-task-act-btn approve" data-dtapprove="${t.id}" title="Onayla"><i class="ti ti-check"></i></button>
                       <button class="pg-pv-task-act-btn danger" data-dtdel="${t.id}" title="Reddet"><i class="ti ti-x"></i></button>`
                    : (!isPending
                        ? `<button class="pg-pv-task-act-btn" data-dtedit="${t.id}" title="Düzenle"><i class="ti ti-pencil"></i></button>
                           <button class="pg-pv-task-act-btn danger" data-dtdel="${t.id}" title="Sil"><i class="ti ti-trash"></i></button>`
                        : `<span class="pg-pv-task-pending-badge"><i class="ti ti-clock"></i> Onay bekleniyor</span>`);
                const timeHtml = t.timeStart
                    ? `<span class="pg-pv-task-time">${(t.timeStart||'').slice(0,5)}${t.timeEnd ? `–${t.timeEnd.slice(0,5)}` : ''}</span>`
                    : '';
                const isConflict = conflictTaskIds.has(t.id);
                return `
                <div class="pg-pv-day-task-row${t.completed ? ' done' : ''}${isPending ? ' pg-pv-task-pending' : ''}${isConflict ? ' pg-pv-day-task-row-conflict' : ''}" data-day-task="${t.id}">
                    <div class="pg-pv-day-task-check${t.completed ? ' done' : ''}${isPending ? ' disabled' : ''}" ${isPending ? '' : `data-dtcheck="${t.id}"`}>${t.completed ? '✓' : ''}</div>
                    ${timeHtml}
                    <span class="pg-pv-task-text">${esc(t.text)}</span>
                    ${addedByBadge}
                    ${isConflict ? `<i class="ti ti-alert-triangle pg-pv-day-task-conflict-jump" data-conflict-jump="${t.id}" title="Çakışan saat — haftalık görünümde göster"></i>` : ''}
                    <div class="pg-pv-task-actions">${pendingActions}</div>
                </div>`;
            }).join('')
            : `<div class="pg-pv-day-no-tasks">Bu gün için görev yok</div>`;

        // Milestone subtasks on this day
        const msSubsHtml = ms && (ms.subtasks||[]).length ? `
            <div class="pg-pv-day-section">
                <div class="pg-pv-day-section-label"><i class="ti ti-checklist"></i> Aşama Alt Görevleri</div>
                <div class="pg-pv-day-tasks-list">
                    ${(ms.subtasks||[]).map(s => `
                        <div class="pg-pv-day-task-row${s.done ? ' done' : ''}">
                            <div class="pg-pv-day-task-check${s.done ? ' done' : ''}">${s.done ? '✓' : ''}</div>
                            <span>${esc(s.title)}</span>
                        </div>`).join('')}
                </div>
            </div>` : '';

        // Salt okunur önizlemede "Mevcut Görevlerimi Gör" açıksa: öğrencinin bu güne ait
        // KENDİ (öğretmenin planı dışındaki) görevlerini de göster, çakışanları işaretle.
        let ownTasksHtml = '';
        if (pvReadOnly && pvReadOnlyShowOwnTasks) {
            const ownTasks = allTasks.filter(t => _normYMD(t.date) === dateStr && String(t.parentGoal) !== String(g.id) && !String(t.id).startsWith('lpa_prev_task_'));
            ownTasksHtml = `
            <div class="pg-pv-day-section pg-pv-own-tasks-section">
                <div class="pg-pv-day-section-label"><i class="ti ti-user"></i> Bu Gün İçin Kendi Programın</div>
                <div class="pg-pv-day-tasks-list">
                    ${ownTasks.length ? ownTasks.map(t => {
                        const conflict = t.timeStart && t.timeEnd && dayTasks.some(dt => dt.timeStart && dt.timeEnd && _lpaOverlap(t.timeStart, t.timeEnd, dt.timeStart, dt.timeEnd));
                        const timeHtml2 = t.timeStart ? `<span class="pg-pv-task-time">${t.timeStart}${t.timeEnd ? '–' + t.timeEnd : ''}</span>` : '';
                        return `
                        <div class="pg-pv-day-task-row pg-pv-own-task-row${conflict ? ' conflict' : ''}">
                            ${timeHtml2}
                            <span class="pg-pv-task-text">${esc(t.text)}</span>
                            ${conflict ? '<span class="pg-pv-own-task-conflict-badge" title="Öğretmeninin planıyla saat çakışıyor"><i class="ti ti-alert-triangle"></i> Çakışıyor</span>' : ''}
                        </div>`;
                    }).join('') : '<div class="pg-pv-day-no-tasks">Bu gün için kendi görevin yok.</div>'}
                </div>
            </div>`;
        }

        el.innerHTML = `
            <div class="pg-pv-day-header">
                <div class="pg-pv-day-date-big">${isToday ? 'Bugün' : dateLbl}</div>
                <div class="pg-pv-day-date-sub">
                    <span>${isToday ? dateLbl : dayName}</span>
                </div>
            </div>

            ${capacityHtml}

            <div class="pg-pv-day-section" style="margin-top:12px;">
                <div class="pg-pv-day-section-label"><i class="ti ti-list-check"></i> Günün Görevleri</div>
                ${typingHtml}
                <div class="pg-pv-day-tasks-list" id="pg-pv-day-tasks-list">${tasksHtml}</div>
            </div>

            ${ownTasksHtml}

            ${msSubsHtml}

            <!-- Quick add — bireysel planlamada kapasite dolunca gizlenir; ders planında sadece uyarı verilir, engellenmez.
                 NOT: kullanıcı isteği üzerine bireysel/ortaklaşa ve ders planı artık TAMAMEN AYNI
                 görsel arayüzü kullanıyor — ayrı "lp" dalı/"Detaylar" aç-kapa butonu kaldırıldı,
                 saat aralığı her zaman görünür (bkz. .pg-pv-day-add-task-lp stiliyle birebir). -->
            ${blocksAdd ? '' : `<div class="pg-pv-day-add-task pg-pv-day-add-task-lp" id="pg-pv-day-add-task">
                <div class="pg-pv-day-add-row">
                    <input type="text" class="pg-pv-day-add-inp" id="pg-pv-day-add-inp"
                        placeholder="Görev ekle… (Enter)" autocomplete="off" maxlength="60">
                    <button class="pg-pv-day-add-btn" id="pg-pv-day-add-btn">+ Ekle</button>
                </div>
                <div class="pg-pv-day-add-char" id="pg-pv-day-add-char">0/60</div>
                <div class="pg-pv-day-detail-panel" id="pg-pv-day-detail-panel">
                    <div class="pg-pv-day-detail-row">
                        <label class="pg-pv-day-detail-label"><i class="ti ti-clock"></i></label>
                        <div class="pg-pv-day-detail-time-row">
                            <input type="time" class="pg-pv-day-time-inp" id="pg-pv-day-time-start" value="09:00">
                            <span class="pg-pv-day-time-sep">–</span>
                            <input type="time" class="pg-pv-day-time-inp" id="pg-pv-day-time-end" value="10:00">
                        </div>
                    </div>
                </div>
            </div>`}`;

        // Çakışma uyarı ikonu — haftalık görünümde ilgili saate atlar
        el.querySelectorAll('[data-conflict-jump]').forEach(icon => {
            icon.addEventListener('click', e => {
                e.stopPropagation();
                const tid = icon.dataset.conflictJump;
                const t = FocusStorage.get('tasks', []).find(x => x.id === tid);
                if (t) _pvJumpToWeekAtTask(g, t);
            });
        });

        // Toggle task done
        el.querySelectorAll('[data-dtcheck]').forEach(btn => {
            btn.addEventListener('click', () => {
                const tid = btn.dataset.dtcheck;
                const tasks = FocusStorage.get('tasks', []);
                const t = tasks.find(x => x.id === tid);
                if (t) {
                    t.completed = !t.completed;
                    FocusStorage.set('tasks', tasks);
                    if (typeof window.syncTasksFromStorage === 'function') window.syncTasksFromStorage();
                    if (window.PlanningCollab?.channel)
                        window.PlanningCollab.broadcast('task_toggle', { taskId: tid, completed: t.completed, goalId: pvGoalId });
                    pvUnsaved = true;
                }
                _pvRenderDayPanel(g, dateStr);
            });
        });

        // ── Öneri 2: Approve pending task ────────────────────────
        el.querySelectorAll('[data-dtapprove]').forEach(btn => {
            btn.addEventListener('click', () => {
                const tid = btn.dataset.dtapprove;
                const allT = FocusStorage.get('tasks', []);
                const t = allT.find(x => x.id === tid);
                if (!t) return;
                delete t._pending;
                FocusStorage.set('tasks', allT);
                if (typeof window.syncTasksFromStorage === 'function') window.syncTasksFromStorage();
                if (window.PlanningCollab?.channel)
                    window.PlanningCollab.broadcast('task_approve', { taskId: tid, goalId: pvGoalId });
                if (window.PlanningCollab?.isActive()) {
                    const me2 = window.PlanningCollab._me();
                    window.PlanningCollab._addActivity(window.PlanningCollab.roomId,
                        window.PlanningCollab._makeEntry(me2, 'approved', t.text));
                    window.PlanningCollab._refreshActivityLog();
                }
                _pvRenderDayPanel(g, dateStr);
                _pvRenderMainCal(g);
                toast('Görev onaylandı ✓', '#06d6a0');
            });
        });

        // Delete task
        el.querySelectorAll('[data-dtdel]').forEach(btn => {
            btn.addEventListener('click', () => {
                const tid = btn.dataset.dtdel;
                const hadConflicts = _pvHasUnresolvedConflicts(g);
                // dateStr YYYY-MM-DD → DD-MM-YYYY (deleteGlobalTask expects DD-MM-YYYY)
                const [y, mo, dd] = dateStr.split('-');
                const dateDDMMYYYY = `${dd}-${mo}-${y}`;
                if (typeof window.deleteGlobalTask === 'function') {
                    // tasks + calendarEvents + FocusStorage['events'] hepsini doğru temizler
                    window.deleteGlobalTask(tid, dateDDMMYYYY);
                } else {
                    const allT = FocusStorage.get('tasks', []);
                    FocusStorage.set('tasks', allT.filter(x => x.id !== tid));
                    if (typeof window.syncTasksFromStorage === 'function') window.syncTasksFromStorage();
                }
                if (window.PlanningCollab?.channel)
                    window.PlanningCollab.broadcast('task_delete', { taskId: tid, goalId: pvGoalId });
                _pvUnmirrorTask(g, tid);
                if (_pvIsLessonPlan(g)) persistGoals(); else pvUnsaved = true;
                if (hadConflicts && !_pvHasUnresolvedConflicts(g)) toast('Tüm çakışmalar çözüldü ✓', '#06d6a0');
                _pvUpdateConflictBanner(g);
                _pvRenderDayPanel(g, dateStr);
                _pvRenderMainCal(g);
            });
        });

        // Edit task (inline — metni input'a çeker, kaydedince günceller)
        el.querySelectorAll('[data-dtedit]').forEach(btn => {
            btn.addEventListener('click', () => {
                const tid = btn.dataset.dtedit;
                const tasks = FocusStorage.get('tasks', []);
                const t = tasks.find(x => x.id === tid);
                if (!t) return;
                const row = btn.closest('[data-day-task]');
                const textEl = row?.querySelector('.pg-pv-task-text');
                if (!textEl) return;
                const oldText = t.text;
                textEl.innerHTML = `<input type="text" class="pg-pv-task-edit-inp" value="${esc(oldText)}" style="flex:1;background:transparent;border:none;border-bottom:1px solid ${cat.color};outline:none;font-size:inherit;color:inherit;padding:1px 2px;width:100%;">`;
                const inp = textEl.querySelector('input');
                inp.focus(); inp.select();
                const save = () => {
                    const newText = inp.value.trim();
                    if (newText && newText !== oldText) {
                        t.text = newText;
                        FocusStorage.set('tasks', tasks);
                        if (typeof window.syncTasksFromStorage === 'function') window.syncTasksFromStorage();
                        if (typeof window.renderTasks === 'function') window.renderTasks();
                        if (String(t.parentGoal) === String(g.id)) _pvMirrorTaskToMilestone(g, t.id, t.text, _normYMD(t.date), t.timeStart, t.timeEnd);
                        if (_pvIsLessonPlan(g)) persistGoals(); else pvUnsaved = true;
                    }
                    _pvRenderDayPanel(g, dateStr);
                };
                inp.addEventListener('blur', save);
                inp.addEventListener('keydown', e => { if (e.key === 'Enter') inp.blur(); if (e.key === 'Escape') { inp.value = oldText; inp.blur(); } });
            });
        });

        // Saat aralığı paneli artık her modda (bireysel/ortaklaşa/ders planı) her zaman
        // görünür ve doğrudan doldurulur — ayrı aç/kapa butonu ve öncelik seçimi kaldırıldı,
        // görsel arayüz tüm hedef türlerinde birebir aynı olsun diye.
        const detailOpen = true;
        _pvAutoFillTime(dateStr);

        // Time-start change → auto-set end = start + 1h
        const startInp = el.querySelector('#pg-pv-day-time-start');
        const endInp   = el.querySelector('#pg-pv-day-time-end');
        startInp?.addEventListener('change', () => {
            const [h, m] = startInp.value.split(':').map(Number);
            const endH = Math.min(h + 1, 22);
            endInp.value = `${String(endH).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
        });

        // ── Öneri 1: Typing broadcast ─────────────────────────────
        const _sendTyping = (() => {
            let _t = null;
            return () => {
                clearTimeout(_t);
                if (window.PlanningCollab?.isActive()) {
                    const me = window.PlanningCollab._me();
                    window.PlanningCollab.broadcast('typing', { dateStr, user_name: me.name, user_color: me.color });
                }
            };
        })();

        // Add new task
        const addInp = el.querySelector('#pg-pv-day-add-inp');
        const addBtn = el.querySelector('#pg-pv-day-add-btn');
        const addCharEl = el.querySelector('#pg-pv-day-add-char');
        addInp?.addEventListener('input', _sendTyping);
        if (addCharEl && addInp) {
            addInp.addEventListener('input', () => {
                const max = parseInt(addInp.getAttribute('maxlength')) || 100;
                addCharEl.textContent = `${addInp.value.length}/${max}`;
                addCharEl.classList.toggle('pg-pv-day-add-char-max', addInp.value.length >= max);
            });
        }
        const doAdd  = () => {
            const text = addInp?.value.trim();
            if (!text) return;

            let timeStart, timeEnd;
            if (detailOpen && startInp?.value) {
                // User manually set times
                timeStart = startInp.value;
                timeEnd   = endInp?.value || _pvAddHour(startInp.value);
            } else {
                // Auto-find next free 1-hour slot
                const tasks = FocusStorage.get('tasks', []);
                const slot  = _pvFindFreeSlot(tasks, dateStr);
                timeStart   = slot.start;
                timeEnd     = slot.end;
            }

            const proceedAdd = () => {
            const pri = parseInt(el.querySelector('.pg-pv-day-pri-btn.selected')?.dataset.pri) || (g.priority || 2);

            // addGlobalTask expects DD-MM-YYYY (the app's internal date format)
            const [y, mo, dd] = dateStr.split('-');
            const dateDDMMYYYY = `${dd}-${mo}-${y}`;

            const newTaskId = 'dt_' + Date.now() + '_' + Math.random().toString(36).slice(2,5);
            let createdTaskId = newTaskId;
            // ── Öneri 2: Onay gerektiren durum ─────────────────────
            const collabActive = window.PlanningCollab?.isActive();
            const needsApproval = collabActive && window.PlanningCollab.isApprovalRequired() && window.PlanningCollab.myRole !== 'owner';
            const me = collabActive ? window.PlanningCollab._me() : null;

            // Öğretmen henüz bir öğrenciye ATANMAMIŞ (lpa_id yok) bir ders planı üzerinde
            // çalışıyorsa — yani sadece plan taslağını kuruyorsa — görev yine gerçek `tasks`
            // deposuna yazılır (plan-editörünün kendi Gün Paneli/takvimi bunu okuyarak
            // çalışıyor), ama `isLessonPlanDraft` bayrağıyla işaretlenir ki öğretmenin KENDİ
            // "Bugün"/Takvim görünümlerinde (script.js) bu satırlar gizlenip sızıntı önlensin.
            const isLessonPlanAuthoring = _pvIsLessonPlan(g) && !g.lpa_id;
            const draftFlag = isLessonPlanAuthoring ? { isLessonPlanDraft: true } : {};

            if (typeof window.addGlobalTask === 'function') {
                window.addGlobalTask(text, pri, g.category || '', dateDDMMYYYY, timeStart, timeEnd, '', pvGoalId);
                // Retrieve the just-added task to broadcast it
                const allT = FocusStorage.get('tasks', []);
                let added = allT.filter(t => t.text === text && t.parentGoal === pvGoalId && _normYMD(t.date) === dateStr).slice(-1)[0];
                if (added) {
                    createdTaskId = added.id;
                    if (needsApproval) {
                        // Mark as pending locally
                        added._pending = true;
                        added._addedBy = { id: me.id, name: me.name, color: me.color };
                    }
                    if (isLessonPlanAuthoring) {
                        Object.assign(added, draftFlag);
                        // calendarEvents ayrı bir depoda tutuluyor (tasks'tan bağımsız kopya) —
                        // ana takvim görünümü oradan okuyor, o yüzden aynı bayrak orada da işaretlenmeli.
                        const events = FocusStorage.get('events', {});
                        const dayEvents = events[dateDDMMYYYY] || [];
                        const ev = dayEvents.find(e => String(e.id) === String(added.id));
                        if (ev) { ev.isLessonPlanDraft = true; FocusStorage.set('events', events); }
                    }
                    if (needsApproval || isLessonPlanAuthoring) {
                        FocusStorage.set('tasks', allT);
                        if (typeof window.syncTasksFromStorage === 'function') window.syncTasksFromStorage();
                    }
                    if (window.PlanningCollab?.channel) {
                        const eventName = needsApproval ? 'task_pending' : 'task_add';
                        window.PlanningCollab.broadcast(eventName, {
                            task: added, user_name: me?.name, user_color: me?.color
                        });
                    }
                    if (!needsApproval && collabActive && me) {
                        window.PlanningCollab._addActivity(window.PlanningCollab.roomId,
                            window.PlanningCollab._makeEntry(me, 'task_add', text));
                        window.PlanningCollab._refreshActivityLog();
                    }
                }
            } else {
                const newTask = { id: newTaskId, text, completed: false, date: dateDDMMYYYY,
                    priority: pri, category: g.category || '', parentGoal: pvGoalId, timeStart, timeEnd,
                    ...draftFlag,
                    ...(needsApproval ? { _pending: true, _addedBy: { id: me.id, name: me.name, color: me.color } } : {}) };
                const tasks = FocusStorage.get('tasks', []);
                tasks.push(newTask);
                FocusStorage.set('tasks', tasks);
                if (window.PlanningCollab?.channel) {
                    const eventName = needsApproval ? 'task_pending' : 'task_add';
                    window.PlanningCollab.broadcast(eventName, { task: newTask, user_name: me?.name, user_color: me?.color });
                }
            }
            if (typeof window.renderTasks === 'function') window.renderTasks();
            if (typeof window.renderCalendarGlobal === 'function') window.renderCalendarGlobal();
            addInp.value = '';
            if (addCharEl) { addCharEl.textContent = `0/${addInp.getAttribute('maxlength') || 100}`; addCharEl.classList.remove('pg-pv-day-add-char-max'); }
            // Reset detail panel
            if (startInp) startInp.value = '09:00';
            if (endInp)   endInp.value   = '10:00';
            _pvMirrorTaskToMilestone(g, createdTaskId, text, dateStr, timeStart, timeEnd);
            if (_pvIsLessonPlan(g)) persistGoals(); else pvUnsaved = true;
            _pvRenderDayPanel(g, dateStr);
            _pvRenderMainCal(g);
            };

            if (_pvIsLessonPlan(g) && !pvSuppressBusyWarning) {
                const conflict = _pvBusyConflict(dateStr, timeStart, timeEnd);
                if (conflict) {
                    const studentName = conflict.student_id
                        ? (pvGroupMembersCache?.members.find(m => m.id === conflict.student_id)?.display_name
                            || pvGroupMembersCache?.members.find(m => m.id === conflict.student_id)?.username || null)
                        : null;
                    _pvShowConflictModal({ timeStart, timeEnd, studentName, onConfirm: proceedAdd });
                    return;
                }
            }
            proceedAdd();
        };
        addBtn?.addEventListener('click', doAdd);
        addInp?.addEventListener('keydown', e => { if (e.key === 'Enter') doAdd(); });
    }

    // ── Yardımcı: Boş 1 saatlik slot bul ───────
    function _pvFindFreeSlot(tasks, dateStr) {
        const dayTasks = tasks.filter(t => _normYMD(t.date) === dateStr && t.timeStart && t.timeEnd);
        // Build occupied minutes set (relative to 00:00)
        const occupied = new Set();
        dayTasks.forEach(t => {
            const s = _pvTimeToMin(t.timeStart);
            const e = _pvTimeToMin(t.timeEnd);
            for (let m = s; m < e; m++) occupied.add(m);
        });
        // Search 09:00–21:00 for a free 1-hour window
        const start9  = 9 * 60;
        const end22   = 22 * 60;
        for (let s = start9; s < end22; s++) {
            const e = s + 60;
            if (e > end22) break;
            let free = true;
            for (let m = s; m < e; m++) {
                if (occupied.has(m)) { free = false; break; }
            }
            if (free) return { start: _pvMinToTime(s), end: _pvMinToTime(e) };
        }
        // Fallback: stack at end
        return { start: '21:00', end: '22:00' };
    }
    function _pvTimeToMin(t) {
        const [h, m] = (t || '00:00').split(':').map(Number);
        return h * 60 + (m || 0);
    }
    function _pvMinToTime(m) {
        return `${String(Math.floor(m / 60)).padStart(2,'0')}:${String(m % 60).padStart(2,'0')}`;
    }
    function _pvAddHour(t) {
        const m = _pvTimeToMin(t) + 60;
        return _pvMinToTime(Math.min(m, 22 * 60));
    }
    window._pvAddHour = _pvAddHour;
    function _pvAutoFillTime(dateStr) {
        const tasks = FocusStorage.get('tasks', []);
        const slot  = _pvFindFreeSlot(tasks, dateStr);
        const startInp = document.getElementById('pg-pv-day-time-start');
        const endInp   = document.getElementById('pg-pv-day-time-end');
        const hint     = document.getElementById('pg-pv-day-auto-hint');
        if (startInp) startInp.value = slot.start;
        if (endInp)   endInp.value   = slot.end;
        if (hint)     hint.style.display = '';
    }

    // ── Stub: keep old names callable (no-op) ─
    function _pvRenderCenter() {}
    function _pvRenderTeam() {}

    // ── Overall Progress ──────────────────────
    function _pvUpdateOverallProgress(g) {
        const el  = document.getElementById('pg-pv-overall-progress');
        if (!el) return;
        const ms  = g.milestones || [];
        const cat = window.getCat(g.category);
        const pct = g.progress_pct || 0;
        const done = ms.filter(m => m.done).length;
        el.innerHTML = `
            <div class="pg-pv-overall-label">
                <span>Genel İlerleme</span>
                <span style="color:${cat.color};">${done}/${ms.length} · ${pct}%</span>
            </div>
            <div class="pg-pv-overall-track">
                <div class="pg-pv-overall-fill" style="width:${pct}%;background:${cat.color};"></div>
            </div>`;
    }

    // ── Celebrate ─────────────────────────────
    function _pvCelebrate(full) {
        const colors = ['#ffd166','#4ade80','#7c6eff','#ef476f','#60a5fa','#D4900E'];
        for (let i = 0; i < (full ? 16 : 8); i++) {
            const p = document.createElement('div');
            p.className = 'pg-pv-sparkle';
            const x = Math.random() * window.innerWidth;
            const y = full ? Math.random() * window.innerHeight : window.innerHeight * 0.4 + Math.random() * 200;
            const size = 6 + Math.random() * 8;
            p.style.cssText = `left:${x}px;top:${y}px;width:${size}px;height:${size}px;background:${colors[i%colors.length]};
                animation:pg-pv-sparkle-anim .8s ease forwards;transform-origin:center;`;
            document.body.appendChild(p);
            setTimeout(() => p.remove(), 900);
        }
    }

    // ── Time ago helper ───────────────────────
    function _pvTimeAgo(ts) {
        if (!ts) return '';
        const diff = (Date.now() - new Date(ts).getTime()) / 1000;
        if (diff < 60)   return 'az önce';
        if (diff < 3600) return Math.floor(diff/60) + 'dk';
        if (diff < 86400)return Math.floor(diff/3600) + 'sa';
        return Math.floor(diff/86400) + 'g';
    }

    // ── Quick-add MS in plan view ─────────────
    function _pvBindQuickAddMs() {
        const addBtn   = document.getElementById('pg-pv-add-ms-btn');
        const form     = document.getElementById('pg-pv-quick-add-ms');
        const cancelBtn= document.getElementById('pg-pv-ms-cancel');
        const saveBtn  = document.getElementById('pg-pv-ms-save');
        const inp      = document.getElementById('pg-pv-ms-inp');

        addBtn?.addEventListener('click', () => {
            form.style.display = form.style.display === 'none' ? '' : 'none';
            const g = goals.find(x => x.id === pvGoalId);
            document.getElementById('pg-pv-ms-time-row')?.classList.toggle('hidden', !_pvIsLessonPlan(g));
            if (form.style.display !== 'none') inp?.focus();
        });
        cancelBtn?.addEventListener('click', () => { form.style.display = 'none'; if(inp)inp.value=''; });
        saveBtn?.addEventListener('click',  _pvSaveQuickMs);
        inp?.addEventListener('keydown', e => { if (e.key === 'Enter') _pvSaveQuickMs(); });
    }

    function _pvSaveQuickMs() {
        const g   = goals.find(x => x.id === pvGoalId);
        if (!g) return;
        const inp  = document.getElementById('pg-pv-ms-inp');
        const dateInp = document.getElementById('pg-pv-ms-date');
        const startTimeInp = document.getElementById('pg-pv-ms-start-time');
        const endTimeInp   = document.getElementById('pg-pv-ms-end-time');
        const title = inp?.value.trim();
        if (!title) { inp?.focus(); return; }
        if (_pvIsLessonPlan(g) && !dateInp?.value) { dateInp?.focus(); toast('Ders hangi güne planlanacak?'); return; }
        if (!g.milestones) g.milestones = [];
        const newMs = { id: window.msUid(), title, description: '', due_date: dateInp?.value || '',
            done: false, order: g.milestones.length, subtasks: [], created_at: new Date().toISOString() };
        if (_pvIsLessonPlan(g)) {
            newMs.start_time = startTimeInp?.value || '';
            newMs.end_time   = endTimeInp?.value || '';
        }
        g.milestones.push(newMs);
        _recalcProgress(g); g._dirty = true;
        persistGoals(); render();
        if (inp) inp.value = '';
        if (startTimeInp) startTimeInp.value = '';
        if (endTimeInp) endTimeInp.value = '';
        if (dateInp) dateInp.value = '';
        document.getElementById('pg-pv-quick-add-ms').style.display = 'none';
        pvActiveMsId = newMs.id;
        _pvRender(g);
        toast('Aşama eklendi 🚩');
        if (window.PlanningCollab?.channel) {
            window.PlanningCollab.broadcast('ms_add', { goalId: g.id, milestone: newMs });
        }
    }

    // ── Init bindings ─────────────────────────
    function _pvInitBindings() {
        // Not: DOM click event'ini _pvHandleExitClick'e olduğu gibi vermemek lazım —
        // Event nesnesi her zaman "truthy" olduğundan bypassConflictCheck parametresine
        // sızıp çakışma kontrolünü atlatırdı, bkz. aşağıdaki sarmalayıcı ok fonksiyonları.
        document.getElementById('pg-pv-back')?.addEventListener('click', () => _pvHandleExitClick());
        document.getElementById('pg-pv-close')?.addEventListener('click', () => _pvHandleExitClick());
        document.getElementById('pg-pv-edit-goal')?.addEventListener('click', () => {
            if (!pvGoalId) return;
            const g = goals.find(x => x.id === pvGoalId);
            // closePlanView() pvGoalId'i null'a çeker — modal başlığının "Hedefi Düzenle"
            // yerine yanlışlıkla "Yeni Hedef" olarak açılmaması için id'yi önce yakala.
            const doEdit = () => { const gid = pvGoalId; closePlanView(); openGoalModal(gid); };
            if (_pvHasUnresolvedConflicts(g)) {
                _pvShowUnresolvedConflictModal({ onLeave: doEdit });
                return;
            }
            doEdit();
        });
        document.getElementById('pg-pv-seq-check')?.addEventListener('change', e => {
            pvSeqMode = e.target.checked;
            const g = goals.find(x => x.id === pvGoalId);
            if (g) _pvRenderStepper(g);
        });
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && pvGoalId) _pvHandleExitClick();
        });
        _pvBindQuickAddMs();
    }

    // ── Public API ────────────────────────────
    window.openPlanView = openPlanView;
    window.closePlanView = closePlanView;
    window.openAssignModal = openAssignModal;

    // ── Public ────────────────────────────────
    // 5.4 — "Bugün" sekmesi sprint widget
    window.renderTodaySprintWidget = function() {
        const widget   = document.getElementById('today-sprint-widget');
        const listEl   = document.getElementById('tsw-list');
        const progWrap = document.getElementById('tsw-progress-wrap');
        if (!widget || !listEl) return;

        if (!listEl._delegatedClickBound) {
            listEl._delegatedClickBound = true;
            listEl.addEventListener('click', (e) => {
                const el = e.target.closest('[data-action="toggle-sprint-milestone"]');
                if (!el) return;
                if (typeof window.setPlanningMilestoneDone === 'function') {
                    window.setPlanningMilestoneDone(el.dataset.goalId, el.dataset.msId, el.dataset.done === 'true');
                }
                window.renderTodaySprintWidget();
            });
        }

        const { start, end } = (typeof _weekRange === 'function') ? _weekRange(0) : (() => {
            const now = new Date(), dow = now.getDay(), diff = dow===0?-6:1-dow;
            const mon = new Date(now); mon.setDate(now.getDate()+diff); mon.setHours(0,0,0,0);
            const sun = new Date(mon); sun.setDate(mon.getDate()+6); sun.setHours(23,59,59,999);
            return { start: mon, end: sun };
        })();

        // plan_mode==='lesson-plan' && !lpa_id: öğretmenin başka bir öğrenci için henüz
        // atamadığı ders planı taslağı — şablonlar gibi bu widget'ta görünmemeli.
        const items = [];
        goals.filter(g => g.status !== 'archived' && !g.context?.isTemplate
            && !(g.plan_mode === 'lesson-plan' && !g.lpa_id)).forEach(g => {
            (g.milestones || []).forEach(ms => {
                if (!ms.due_date) return;
                const d = new Date(ms.due_date);
                if (d >= start && d <= end) items.push({ ms, goal: g });
            });
        });

        if (!items.length) { widget.style.display = 'none'; return; }
        widget.style.display = '';

        items.sort((a,b) => a.ms.due_date.localeCompare(b.ms.due_date));
        const done  = items.filter(x => x.ms.done).length;
        const pct   = Math.round(done / items.length * 100);

        if (progWrap) progWrap.innerHTML = `
            <div class="tsw-prog-track"><div class="tsw-prog-fill" style="width:${pct}%;"></div></div>
            <span class="tsw-prog-label">${done}/${items.length}</span>`;

        listEl.innerHTML = items.slice(0, 5).map(({ ms, goal }) => {
            const cat = goal.category || 'diger';
            const catColors = { egitim:'#7c6eff', saglik:'#ef476f', kariyer:'#06d6a0',
                finans:'#ffd166', kisisel:'#ff9f43', diger:'#a78bfa' };
            const color = catColors[cat] || '#a78bfa';
            return `<div class="tsw-item${ms.done?' done':''}">
                <div class="tsw-check${ms.done?' done':''}" style="${ms.done?'background:'+color+';border-color:'+color+';':' border-color:'+color+';'}"
                    data-action="toggle-sprint-milestone" data-goal-id="${goal.id}" data-ms-id="${ms.id}" data-done="${!ms.done}">
                    ${ms.done ? '✓' : ''}
                </div>
                <div class="tsw-body">
                    <div class="tsw-ms-title${ms.done?' done':''}">${esc(ms.title)}</div>
                    <div class="tsw-goal-name" style="color:${color};">${esc(goal.title)}</div>
                </div>
                <span class="tsw-date">${window.fmtShort(ms.due_date)}</span>
            </div>`;
        }).join('');

        if (items.length > 5) {
            listEl.innerHTML += `<div style="text-align:center;font-size:11px;color:#555;padding:6px;">+${items.length-5} milestone daha...</div>`;
        }
    };

    window.renderPlanningRef   = ()=>{ render(); };
    // addPlanningDependency/removePlanningDependency/getPlanningDependencies/
    // isPlanningGoalBlocked artık planning-dependency-graph.js'te tanımlanıyor.
    window.initPlanningModule  = init;
    window.renderPlanningStats = renderStatsCard;
    // openLessonPlanModal artık planning-lesson-plan-modal.js'te tanımlanıyor
    // (sınıf paneli/social.js gibi dış yerlerden window.openLessonPlanModal ile açılır).
    // social.js'in collab_goal_deleted bildiriminde çağırdığı API
    window._convertGoalToSoloById = _convertGoalToSolo;
    window._deleteGoalSilently    = deleteGoal;

    // F1.1 — Görev tamamlama → milestone durumu güncelle (script.js çağırır)
    window.setPlanningMilestoneDone = function(goalId, msId, done) {
        const g  = goals.find(g => g.id === goalId);
        const ms = (g?.milestones || []).find(m => m.id === msId);
        if (!g || !ms || ms.done === done) return;
        ms.done = done;
        _recalcProgress(g);
        g._dirty = true;
        persistGoals();
        render();
        if (typeof window.renderPlanningStats === 'function') window.renderPlanningStats();
        if (detailGoalId === goalId) {
            renderMilestoneList(goalId);
            refreshDetailSummary(g);
            _initDetailProgress(g);
        }
        if (done) toast('Milestone tamamlandı! 🎉');
    };

    // F1.2 — Takvim milestone event'i tıklanınca planning modülünü güncelle
    window.togglePlanningMilestoneFromCalendar = function(calEvId) {
        const msId = calEvId.replace('ms_cal_', '');
        let foundGoal = null, foundMs = null;
        for (const g of goals) {
            const ms = (g.milestones || []).find(m => m.id === msId);
            if (ms) { foundGoal = g; foundMs = ms; break; }
        }
        if (!foundGoal || !foundMs) return;
        foundMs.done = !foundMs.done;
        _recalcProgress(foundGoal);
        foundGoal._dirty = true;
        persistGoals(); // persistGoals → syncAllMilestonesToCalendar zinciri takvimi günceller
        render();
        if (detailGoalId === foundGoal.id) {
            renderMilestoneList(foundGoal.id);
            refreshDetailSummary(foundGoal);
            _initDetailProgress(foundGoal);
        }
        if (foundMs.done) toast('Milestone tamamlandı! 🎉');
    };

    if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
