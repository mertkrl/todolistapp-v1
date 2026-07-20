// ─── PLANLAMA — DERS PLANI OLUŞTURMA MODALI ────────────────────────────
// planning.js dosyasından çıkarıldı (Faz 2, 2026-07-20). Mod seçim ekranı
// (Bireysel Hedef / Ders Planı) + Ders Planı modalının tüm adımları:
// seçim → şablon/uygulama listesi gözat → yeni şablon oluştur → form
// (sınıf/öğrenci seç, şablondan başlat) → kaydet. Kaydedilince normal
// planlama ekranına (openPlanView) yönlendirir.
//
// ÖNEMLİ: Bu dosya index.html'de/inline-module-loader.js'de planning.js'ten
// ÖNCE yüklenmeli — planning.js'in init() fonksiyonu bu modüldeki
// fonksiyonları (openModeSelect, closeModeSelect, openLessonPlanModal, vb.)
// SENKRON olarak addEventListener'a bağlıyor (bkz. Faz 2 metodolojisi,
// sıralama kontrolü adımı — planning-dependency-graph.js'te de aynı tuzak).
//
// Dış bağımlılıklar (planning.js'te kalıyor, window.* köprüsüyle açıldı):
// - goals → window._pgGetGoals() (referans — find/filter/unshift çalışır)
// - esc, toast, persistGoals, render, openPlanView, uid → window.*
// - _deleteGoalWithUndo, _pvIsLessonPlan, _normYMD → window.*
// - _wzLessonPlanGroups (önbellek) → window._wzGetLessonPlanGroups()
// - _wzCheckLessonPlanGroups → window._wzCheckLessonPlanGroups()
// - window.msUid / window.getCat → planning-utils.js (zaten global)
// - window.addGlobalTask / FocusStorage / window.FocusSupabase /
//   window.currentUser → zaten global

function openModeSelect() {
    document.getElementById('pg-mode-select-overlay')?.classList.remove('hidden');
    const lpBtn = document.getElementById('pg-mode-lesson-plan-btn');
    if (lpBtn) {
        lpBtn.classList.add('hidden');
        (window._wzGetLessonPlanGroups() ? Promise.resolve(window._wzGetLessonPlanGroups()) : window._wzCheckLessonPlanGroups())
            .then(groups => lpBtn.classList.toggle('hidden', !groups?.length));
    }
}
window.openModeSelect = openModeSelect;

function closeModeSelect() {
    document.getElementById('pg-mode-select-overlay')?.classList.add('hidden');
}
window.closeModeSelect = closeModeSelect;

// ══════════════════════════════════════════
// DERS PLANI — Oluşturma (minimal: sınıf + açıklama)
// Kaydedilince normal planlama ekranına (openPlanView) gider —
// aşama/milestone eklemek isteğe bağlıdır, tıpkı bireysel planlamada olduğu gibi.
// ══════════════════════════════════════════
let _lpStudents = [];   // seçili sınıfın üyeleri: [{id, display_name, username}]
let _lpTarget = 'class'; // 'class' | 'student' — Uygulama Planı'nda hedef türü

function openLessonPlanModal() {
    const modal = document.getElementById('pg-lp-modal');
    if (!modal) return;
    document.getElementById('pg-lp-desc').value = '';
    document.getElementById('pg-lp-name').value = '';
    document.getElementById('pg-lp-template-name').value = '';
    document.getElementById('pg-lp-template-desc').value = '';
    _lpShowChoiceStep();
    modal.classList.remove('hidden');
}
window.openLessonPlanModal = openLessonPlanModal;

function _lpHideAllSteps() {
    document.getElementById('pg-lp-choice-step')?.classList.add('hidden');
    document.getElementById('pg-lp-templates-step')?.classList.add('hidden');
    document.getElementById('pg-lp-templates-footer')?.classList.add('hidden');
    document.getElementById('pg-lp-instances-step')?.classList.add('hidden');
    document.getElementById('pg-lp-instances-footer')?.classList.add('hidden');
    document.getElementById('pg-lp-template-step')?.classList.add('hidden');
    document.getElementById('pg-lp-template-footer')?.classList.add('hidden');
    document.getElementById('pg-lp-form-step')?.classList.add('hidden');
    document.getElementById('pg-lp-form-footer')?.classList.add('hidden');
}
window._lpHideAllSteps = _lpHideAllSteps;

function _lpShowChoiceStep() {
    _lpHideAllSteps();
    document.getElementById('pg-lp-choice-step')?.classList.remove('hidden');
    _lpUpdateBrowseCounts();
}
window._lpShowChoiceStep = _lpShowChoiceStep;

function _lpUpdateBrowseCounts() {
    const goals = window._pgGetGoals();
    const tplCount = goals.filter(g => g.plan_mode === 'lesson-plan' && g.context?.isTemplate).length;
    const instCount = goals.filter(g => g.plan_mode === 'lesson-plan' && !g.context?.isTemplate).length;
    const tplEl = document.getElementById('pg-lp-templates-count');
    const instEl = document.getElementById('pg-lp-instances-count');
    if (tplEl) tplEl.textContent = tplCount;
    if (instEl) instEl.textContent = instCount;
}
window._lpUpdateBrowseCounts = _lpUpdateBrowseCounts;

// "Şablonlarım" / "Ders Planlarım" gözat ekranları — ayrı bir adımda listelenir,
// "Düzenle" butonuna basınca planlama arayüzüne (openPlanView) gidilir.
function _lpRenderListStep(kind) {
    const isTemplates = kind === 'templates';
    const goals = window._pgGetGoals();
    const items = goals.filter(g => g.plan_mode === 'lesson-plan' && !!g.context?.isTemplate === isTemplates);
    const listEl = document.getElementById(isTemplates ? 'pg-lp-templates-list' : 'pg-lp-instances-list');
    if (!listEl) return;
    if (!items.length) {
        listEl.innerHTML = `<p class="pg-cw-empty">${isTemplates ? 'Henüz bir şablonun yok.' : 'Henüz bir uygulama planın yok.'}</p>`;
        return;
    }
    listEl.innerHTML = items.map(g => {
        let meta = '';
        if (!isTemplates) {
            const gName = (window._wzGetLessonPlanGroups() || []).find(x => x.id === g.context?.lessonPlanGroupId)?.name || 'Sınıf';
            meta = g.context?.lessonPlanStudentId ? `${gName} · Kişiye Özel` : gName;
        } else {
            const msCount = (g.milestones || []).length;
            const tkCount = _cloneTasksForTemplate(g.id).length;
            const parts = [];
            if (msCount) parts.push(`${msCount} aşama`);
            if (tkCount) parts.push(`${tkCount} görev`);
            meta = parts.length ? parts.join(' · ') : 'Boş şablon';
        }
        return `
            <div class="pg-lp-existing-row" data-id="${g.id}">
                <span class="pg-lp-existing-row-title">${window.esc(g.title)}</span>
                ${meta ? `<span class="pg-lp-existing-row-meta">${window.esc(meta)}</span>` : ''}
                <div class="pg-lp-existing-row-actions">
                    ${isTemplates ? `<button class="pg-lp-existing-use" data-id="${g.id}" title="Bu şablondan Uygulama Planı oluştur"><i class="ti ti-target-arrow"></i> Kullan</button>` : ''}
                    <button class="pg-lp-existing-edit" data-id="${g.id}"><i class="ti ti-pencil"></i> Düzenle</button>
                    <button class="pg-lp-existing-delete" data-id="${g.id}" title="Sil"><i class="ti ti-trash"></i></button>
                </div>
            </div>`;
    }).join('');
}
window._lpRenderListStep = _lpRenderListStep;

function _lpShowTemplatesListStep() {
    _lpHideAllSteps();
    document.getElementById('pg-lp-templates-step')?.classList.remove('hidden');
    document.getElementById('pg-lp-templates-footer')?.classList.remove('hidden');
    _lpRenderListStep('templates');
}
window._lpShowTemplatesListStep = _lpShowTemplatesListStep;

function _lpShowInstancesListStep() {
    _lpHideAllSteps();
    document.getElementById('pg-lp-instances-step')?.classList.remove('hidden');
    document.getElementById('pg-lp-instances-footer')?.classList.remove('hidden');
    _lpRenderListStep('instances');
}
window._lpShowInstancesListStep = _lpShowInstancesListStep;

function _lpBindExistingListEvents() {
    const modal = document.getElementById('pg-lp-modal');
    if (!modal || modal._lpListBound) return;
    modal._lpListBound = true;
    modal.addEventListener('click', e => {
        const editBtn = e.target.closest('.pg-lp-existing-edit');
        const delBtn  = e.target.closest('.pg-lp-existing-delete');
        const useBtn  = e.target.closest('.pg-lp-existing-use');
        if (delBtn) {
            e.stopPropagation();
            window._deleteGoalWithUndo(delBtn.dataset.id);
            _lpRenderListStep(document.getElementById('pg-lp-templates-step')?.classList.contains('hidden') ? 'instances' : 'templates');
            _lpUpdateBrowseCounts();
            return;
        }
        if (useBtn) {
            e.stopPropagation();
            _lpShowFormStep(useBtn.dataset.id);
            return;
        }
        if (editBtn) {
            e.stopPropagation();
            const id = editBtn.dataset.id;
            closeLessonPlanModal();
            setTimeout(() => window.openPlanView(id), 200);
        }
    });
}
window._lpBindExistingListEvents = _lpBindExistingListEvents;

function _lpShowTemplateStep() {
    _lpHideAllSteps();
    document.getElementById('pg-lp-template-step')?.classList.remove('hidden');
    document.getElementById('pg-lp-template-footer')?.classList.remove('hidden');
    setTimeout(() => document.getElementById('pg-lp-template-name')?.focus(), 100);
}
window._lpShowTemplateStep = _lpShowTemplateStep;

async function _lpShowFormStep(presetTemplateId) {
    _lpHideAllSteps();
    document.getElementById('pg-lp-form-step')?.classList.remove('hidden');
    document.getElementById('pg-lp-form-footer')?.classList.remove('hidden');
    _lpSetTarget('class');
    const nameEl = document.getElementById('pg-lp-name');
    if (nameEl) nameEl.value = '';
    const groupSel = document.getElementById('pg-lp-group');
    if (groupSel) {
        groupSel.innerHTML = '<option value="">Yükleniyor…</option>';
        // Önbellek boşsa (ör. sayfa açılışında henüz doldurulmadıysa) burada
        // yeniden çekilir — aksi halde stale/boş önbellek "Sınıf bulunamadı"
        // uyarısını yanlışlıkla tetikler.
        const cached = window._wzGetLessonPlanGroups();
        const groups = (cached && cached.length) ? cached : await window._wzCheckLessonPlanGroups();
        groupSel.innerHTML = groups.map(g => `<option value="${g.id}">${window.esc(g.name)}</option>`).join('') || '<option value="">Sınıf bulunamadı</option>';
        _lpLoadStudents();
    }
    const tplSel = document.getElementById('pg-lp-form-template');
    if (tplSel) {
        const templates = window._pgGetGoals().filter(x => x.plan_mode === 'lesson-plan' && x.context?.isTemplate);
        tplSel.innerHTML = '<option value="">Boş başla</option>' +
            templates.map(t => `<option value="${t.id}">${window.esc(t.title)}</option>`).join('');
        tplSel.value = presetTemplateId || '';
    }
    setTimeout(() => document.getElementById('pg-lp-name')?.focus(), 100);
}
window._lpShowFormStep = _lpShowFormStep;

function _lpSetTarget(target) {
    _lpTarget = target;
    document.getElementById('pg-lp-target-class')?.classList.toggle('active', target === 'class');
    document.getElementById('pg-lp-target-student')?.classList.toggle('active', target === 'student');
    document.getElementById('pg-lp-student-group')?.classList.toggle('hidden', target !== 'student');
}
window._lpSetTarget = _lpSetTarget;

// Şablon içeriği: aşama/görev İSKELETİNİ (başlık, açıklama, alt görevler, sıra) klonlar —
// tarih/durum bilgisi taşınmaz, çünkü şablon farklı dönemlerde yeniden tarihlenerek kullanılır.
function _cloneMilestonesForTemplate(sourceMilestones) {
    return (sourceMilestones || []).map((m, i) => ({
        id: window.msUid(), title: m.title, description: m.description || '',
        due_date: '', start_date: '', done: false, order: m.order ?? i,
        subtasks: (m.subtasks || []).map(s => ({ id: window.uid(), title: s.title, done: false, date: '' })),
    }));
}
window._cloneMilestonesForTemplate = _cloneMilestonesForTemplate;

// Ders planında asıl içerik genelde aşama değil, gün-saat gridine eklenen GÖREVLERdir
// (FocusStorage['tasks'], parentGoal ile bağlı). Şablona kaydederken bunları da klonlamak gerekir —
// gerçek tarih yerine ilk görevden itibaren GÖRECELİ gün farkı (dayOffset) saklanır, çünkü şablon
// farklı dönemlerde farklı bir başlangıç tarihiyle yeniden uygulanacaktır.
function _cloneTasksForTemplate(goalId) {
    const tasks = (FocusStorage.get('tasks', []) || []).filter(t => String(t.parentGoal) === String(goalId) && t.date);
    if (!tasks.length) return [];
    const minYMD = tasks.reduce((min, t) => { const y = window._normYMD(t.date); return (!min || y < min) ? y : min; }, null);
    const minDate = new Date(minYMD + 'T00:00:00');
    return tasks.map(t => {
        const d = new Date(window._normYMD(t.date) + 'T00:00:00');
        const dayOffset = Math.round((d - minDate) / 86400000);
        return { text: t.text, priority: t.priority || 2, category: t.category || '', timeStart: t.timeStart || '', timeEnd: t.timeEnd || '', dayOffset };
    });
}
window._cloneTasksForTemplate = _cloneTasksForTemplate;

// Bir şablonun kayıtlı görevlerini yeni bir plana, bugünden başlayarak (dayOffset korunarak) uygular.
// Bu fonksiyonun iki çağrı yeri de (şablon oluşturma / şablondan ders planı oluşturma) HER ZAMAN
// öğretmen tarafında, henüz kimseye atanmamış bir plan üzerinde çalışır (newGoalId'nin `lpa_id`'si
// yoktur). Görev yine gerçek `tasks` deposuna yazılır (plan-editörünün kendi Gün Paneli/takvimi
// bunu okuyor), ama `isLessonPlanDraft` bayrağıyla işaretlenir ki öğretmenin KENDİ "Bugün"/Takvim
// görünümlerinde (script.js) gizlenip öğretmenin kendi takvimine sızması önlensin.
function _applyTemplateTasksToGoal(templateTasks, newGoalId) {
    if (!templateTasks?.length || typeof window.addGlobalTask !== 'function') return;
    const g = window._pgGetGoals().find(x => x.id === newGoalId);
    const isLessonPlanAuthoring = !!(g && window._pvIsLessonPlan(g) && !g.lpa_id);
    const base = new Date(); base.setHours(0, 0, 0, 0);
    templateTasks.forEach(tt => {
        const d = new Date(base); d.setDate(d.getDate() + tt.dayOffset);
        const dateDDMMYYYY = `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`;
        window.addGlobalTask(tt.text, tt.priority, tt.category, dateDDMMYYYY, tt.timeStart || '09:00', tt.timeEnd || '10:00', '', newGoalId);
    });
    if (isLessonPlanAuthoring) {
        const allT = FocusStorage.get('tasks', []);
        let changed = false;
        allT.forEach(t => {
            if (String(t.parentGoal) === String(newGoalId) && !t.isLessonPlanDraft) { t.isLessonPlanDraft = true; changed = true; }
        });
        if (changed) FocusStorage.set('tasks', allT);
        // calendarEvents ayrı bir depoda tutuluyor — ana takvim görünümü oradan okuyor.
        const events = FocusStorage.get('events', {});
        let eventsChanged = false;
        Object.keys(events).forEach(dateKey => {
            (events[dateKey] || []).forEach(e => {
                if (String(e.parentGoal) === String(newGoalId) && !e.isLessonPlanDraft) { e.isLessonPlanDraft = true; eventsChanged = true; }
            });
        });
        if (eventsChanged) FocusStorage.set('events', events);
        if (changed || eventsChanged) {
            if (typeof window.syncTasksFromStorage === 'function') window.syncTasksFromStorage();
        }
    }
}
window._applyTemplateTasksToGoal = _applyTemplateTasksToGoal;

// Var olan bir Uygulama Planı'nı (dolu haldeki aşama/görev yapısıyla) yeniden kullanılabilir bir Şablona dönüştürür.
// Şablonun görevleri de KENDİ id'sine bağlı gerçek FocusStorage görevleri olarak materialize edilir —
// böylece şablon, diğer ders planları gibi openPlanView'de normal şekilde açılıp düzenlenebilir,
// ve "Uygulama Planı" akışında _cloneTasksForTemplate(template.id) ile tutarlı biçimde okunur.
function _pvSaveGoalAsTemplate(g) {
    const templateTasks = _cloneTasksForTemplate(g.id);
    if (!g?.milestones?.length && !templateTasks.length) { window.toast('Şablon olarak kaydetmek için önce en az bir aşama veya görev ekleyin 📋'); return; }
    const newGoal = {
        id: window.uid(), title: `${g.title} (Şablon)`, description: g.description || '',
        category: g.category || 'egitim', color: g.color || window.getCat('egitim').color,
        deadline: '', priority: g.priority || 2,
        status: 'active', progress_pct: 0,
        milestones: _cloneMilestonesForTemplate(g.milestones),
        work_days: [], hours_per_week: g.hours_per_week || 5,
        context: { isTemplate: true },
        plan_mode: 'lesson-plan',
        created_at: new Date().toISOString(), _dirty: true,
    };
    window._pgGetGoals().unshift(newGoal);
    window.persistGoals();
    if (templateTasks.length) {
        _applyTemplateTasksToGoal(templateTasks, newGoal.id);
        if (typeof window.renderTasks === 'function') window.renderTasks();
        if (typeof window.renderCalendarGlobal === 'function') window.renderCalendarGlobal();
    }
    window.render();
    window.toast('Plan şablon olarak kaydedildi — yeni dönemlerde tekrar kullanabilirsin 📋');
}
window._pvSaveGoalAsTemplate = _pvSaveGoalAsTemplate;

// "Şablon Oluştur" — sınıf/öğrenci seçimi olmadan, ad+açıklama girilip doğrudan planlama arayüzüne geçilir
function _lpSaveTemplate() {
    const name = document.getElementById('pg-lp-template-name')?.value.trim();
    const desc = document.getElementById('pg-lp-template-desc')?.value.trim();
    if (!name) { window.toast('Şablona bir ad verin 📋'); return; }

    const newGoal = {
        id: window.uid(), title: name,
        description: desc, category: 'egitim', color: window.getCat('egitim').color,
        deadline: '', priority: 2,
        status: 'active', progress_pct: 0, milestones: [],
        work_days: [], hours_per_week: 5,
        context: { isTemplate: true },
        plan_mode: 'lesson-plan',
        created_at: new Date().toISOString(), _dirty: true,
    };
    window._pgGetGoals().unshift(newGoal);
    window.persistGoals();
    window.render();
    closeLessonPlanModal();
    window.toast('Şablon oluşturuldu! 📋');
    setTimeout(() => window.openPlanView(newGoal.id), 350);
}
window._lpSaveTemplate = _lpSaveTemplate;

async function _lpLoadStudents() {
    const groupId = document.getElementById('pg-lp-group')?.value;
    const box = document.getElementById('pg-lp-students');
    if (!groupId || !box || !window.FocusSupabase) { _lpStudents = []; return; }
    const sb = window.FocusSupabase, myId = window.currentUser?.id;
    box.innerHTML = '<div class="pg-cw-loading"><span class="pg-cw-pulse-dot"></span> Öğrenciler yükleniyor…</div>';
    let rows;
    try {
        ({ data: rows } = await sb
            .from('group_members').select('user_id, profiles(id, display_name, username)')
            .eq('group_id', groupId));
    } catch (e) {
        console.warn('[FocusAI] _lpLoadStudents:', e);
        box.innerHTML = '<p class="pg-cw-empty">Öğrenciler yüklenemedi. Tekrar dene.</p>';
        _lpStudents = [];
        return;
    }
    _lpStudents = (rows || []).map(r => r.profiles).filter(p => p && p.id !== myId);
    _lpRenderStudentPicker();
    const searchEl = document.getElementById('pg-lp-student-search');
    if (searchEl && !searchEl._lpBound) {
        searchEl._lpBound = true;
        searchEl.addEventListener('input', () => _lpRenderStudentPicker(searchEl.value));
    }
}
window._lpLoadStudents = _lpLoadStudents;

// Minimalist öğrenci seçici: arama kutusu + seçilenler üstte "chip" olarak,
// altta filtrelenebilir kompakt bir liste — büyük sınıflarda (çok öğrenci)
// uzun checkbox listesi yerine ölçeklenebilir bir arayüz sağlar.
function _lpRenderStudentPicker(query) {
    const box = document.getElementById('pg-lp-students');
    const chipsBox = document.getElementById('pg-lp-student-chips');
    if (!box) return;
    const selectedIds = new Set(Array.from(document.querySelectorAll('.pg-lp-student-cb:checked')).map(cb => cb.value));
    if (!_lpStudents.length) { box.innerHTML = '<p class="pg-cw-empty">Bu grupta henüz öğrenci yok.</p>'; if (chipsBox) chipsBox.innerHTML = ''; return; }

    if (chipsBox) {
        const selected = _lpStudents.filter(s => selectedIds.has(s.id));
        chipsBox.innerHTML = selected.map(s => `
            <span class="pg-lp-student-chip" data-id="${s.id}">${window.esc(s.display_name || s.username)} <i class="ti ti-x"></i></span>`).join('');
    }

    const q = (query || '').trim().toLowerCase();
    const list = q ? _lpStudents.filter(s => (s.display_name || s.username || '').toLowerCase().includes(q)) : _lpStudents;
    box.innerHTML = list.length
        ? list.map(s => `
            <label class="pg-assign-student-row" for="pg-lp-student-${s.id}">
                <input type="checkbox" class="pg-lp-student-cb" id="pg-lp-student-${s.id}" value="${s.id}" ${selectedIds.has(s.id) ? 'checked' : ''}>
                <span class="pg-assign-checkbox"></span>
                <span class="pg-assign-student-name">${window.esc(s.display_name || s.username)}</span>
            </label>`).join('')
        : '<p class="pg-cw-empty">Eşleşen öğrenci yok.</p>';
}
window._lpRenderStudentPicker = _lpRenderStudentPicker;

function closeLessonPlanModal() {
    document.getElementById('pg-lp-modal')?.classList.add('hidden');
}
window.closeLessonPlanModal = closeLessonPlanModal;

function _lpSave() {
    const groupId = document.getElementById('pg-lp-group')?.value;
    const planName = document.getElementById('pg-lp-name')?.value.trim();
    const desc = document.getElementById('pg-lp-desc')?.value.trim();
    const isPersonal = _lpTarget === 'student';
    const studentIds = isPersonal
        ? Array.from(document.querySelectorAll('.pg-lp-student-cb:checked')).map(cb => cb.value)
        : [];
    if (!planName) { window.toast('Plana bir isim verin ✏️'); return; }
    if (!groupId) { window.toast('Bir sınıf/ders grubu seçin 🏫'); return; }
    if (isPersonal && !studentIds.length) { window.toast('En az bir öğrenci seçin 👤'); return; }
    const groupName = (window._wzGetLessonPlanGroups() || []).find(g => g.id === groupId)?.name || 'Sınıf';
    const nameOf = id => (_lpStudents.find(s => s.id === id)?.display_name || _lpStudents.find(s => s.id === id)?.username || 'Öğrenci');
    const templateId = document.getElementById('pg-lp-form-template')?.value || '';
    const goals = window._pgGetGoals();
    const template = templateId ? goals.find(x => x.id === templateId) : null;
    // Şablonun görevleri her zaman KENDİ id'sine bağlı canlı FocusStorage görevlerinden okunur —
    // şablon "Şablon Oluştur" akışında (görevler doğrudan eklenmiş) veya "Şablon Olarak Kaydet" akışında
    // (görevler _pvSaveGoalAsTemplate ile materialize edilmiş) oluşturulmuş olsun fark etmez.
    const templateTasks = template ? _cloneTasksForTemplate(template.id) : [];

    // Kişiye özel + birden fazla öğrenci seçilmişse her öğrenci için ayrı bir plan oluşturulur
    // (her öğrencinin dolu saatleri farklı olacağından tek plan yeterli olmaz).
    // Şablon seçildiyse aşama/görev yapısı her öğrenci/sınıf planına ayrı ayrı klonlanır (paylaşılan referans değil).
    const targets = isPersonal ? studentIds : [null];
    const createdGoals = targets.map(studentId => ({
        id: window.uid(), title: (isPersonal && targets.length > 1) ? `${planName} — ${nameOf(studentId)}` : planName,
        description: desc || template?.description || '', category: 'egitim', color: window.getCat('egitim').color,
        deadline: '', priority: 2,
        status: 'active', progress_pct: 0,
        milestones: template ? _cloneMilestonesForTemplate(template.milestones) : [],
        work_days: [], hours_per_week: 5,
        context: { lessonPlanGroupId: groupId, lessonPlanStudentId: studentId || null },
        plan_mode: 'lesson-plan',
        created_at: new Date().toISOString(), _dirty: true,
    }));
    goals.unshift(...createdGoals);
    window.persistGoals();
    if (templateTasks.length) {
        createdGoals.forEach(cg => _applyTemplateTasksToGoal(templateTasks, cg.id));
        if (typeof window.renderTasks === 'function') window.renderTasks();
        if (typeof window.renderCalendarGlobal === 'function') window.renderCalendarGlobal();
    }
    window.render();
    closeLessonPlanModal();
    window.toast(createdGoals.length > 1 ? `${createdGoals.length} öğrenci için ders planı oluşturuldu! 🎓` : 'Ders planı oluşturuldu! 🎓');

    // Sınıfa atama artık burada değil — öğretmen planlamayı bitirince
    // plan ekranındaki "Sınıfa Ata" butonuyla kendi belirlediği anda yapar.
    setTimeout(() => window.openPlanView(createdGoals[0].id), 350);
}
window._lpSave = _lpSave;
