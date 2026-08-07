// Faz J devamı: planning.js'in init()'i içindeki 4 _pgSetupX() yardımcı
// fonksiyonu (Faz H'de planning.js İÇİNDE ayrıştırılmıştı ama dosya dışına
// hiç çıkarılmamıştı) buraya taşındı. planning.js'ten ÖNCE yüklenmesi
// gerekiyor (bkz. inline-module-loader.js) — bu yüzden burada kullanılan tüm
// planning.js kapanış (closure) durumu window.__get/__set veya window.fn
// köprüleriyle erişiliyor, gerçek `import` DEĞİL (planning.js henüz
// çalışmamış olabilir; fonksiyon gövdeleri sadece init() çağrıldığında,
// yani planning.js tümüyle yüklendikten SONRA çalışır).
import {
    openModeSelect, closeModeSelect, openLessonPlanModal, closeLessonPlanModal,
    _lpBindExistingListEvents, _lpShowTemplateStep, _lpShowFormStep, _lpShowChoiceStep,
    _lpShowTemplatesListStep, _lpShowInstancesListStep, _lpSaveTemplate, _lpSetTarget,
    _lpLoadStudents, _lpSave, _lpRenderStudentPicker
} from './planning-lesson-plan-modal.js';
import { showMsForm, hideMsForm } from './planning-plan-view-dom-fx.js';

const CATEGORY_KEYS = ['egitim','saglik','kariyer','finans','kisisel','diger'];

export function _pgSetupFilterControls() {
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
        const activeFilters = window._pgGetActiveFilters();
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
        const activeFilters = window._pgGetActiveFilters();
        document.querySelectorAll('.pg-filter-btn').forEach(b =>
            b.classList.toggle('active', activeFilters.has(b.dataset.cat)));
        document.getElementById('pg-archive-toggle-btn')?.classList.toggle('active', activeFilters.has('__archived__'));
        document.getElementById('pg-completed-toggle-btn')?.classList.toggle('active', activeFilters.has('__completed__'));
    };
    document.querySelectorAll('.pg-filter-btn').forEach(btn=>
        btn.addEventListener('click', ()=>{
            const cat = btn.dataset.cat;
            let activeFilters = window._pgGetActiveFilters();
            if (cat === 'all') {
                // Tekil / dışlayıcı seçim: diğer her şeyi temizler
                activeFilters = new Set([cat]);
                window._pgSetActiveFilters(activeFilters);
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
            window.render();
        }));

    // Arşiv — filtre menüsünden bağımsız, kendi başına açılıp kapanan bir görünüm anahtarı
    const archiveToggleBtn = document.getElementById('pg-archive-toggle-btn');
    archiveToggleBtn?.addEventListener('click', () => {
        const isArchiveMode = window._pgGetActiveFilters().has('__archived__');
        window._pgSetActiveFilters(isArchiveMode ? new Set(['all']) : new Set(['__archived__']));
        _pgSyncFilterButtons();
        _pgUpdateFilterLabel();
        window.render();
    });

    // Başardıklarım — tamamlanan hedefler, arşivden ayrı bağımsız görünüm anahtarı
    const completedToggleBtn = document.getElementById('pg-completed-toggle-btn');
    completedToggleBtn?.addEventListener('click', () => {
        const isCompletedMode = window._pgGetActiveFilters().has('__completed__');
        window._pgSetActiveFilters(isCompletedMode ? new Set(['all']) : new Set(['__completed__']));
        _pgSyncFilterButtons();
        _pgUpdateFilterLabel();
        window.render();
    });

}
window._pgSetupFilterControls = _pgSetupFilterControls;

export function _pgSetupGoalCreationModals() {
    // New goal — mod seçimi açar
    document.getElementById('pg-new-goal-btn')?.addEventListener('click', ()=>openModeSelect());
    document.getElementById('pg-empty-add-btn')?.addEventListener('click', ()=>openModeSelect());

    // Mode select modal
    document.getElementById('pg-mode-select-close')?.addEventListener('click', closeModeSelect);
    document.getElementById('pg-mode-select-overlay')?.addEventListener('click', e => {
        if (e.target.id === 'pg-mode-select-overlay') closeModeSelect();
    });
    document.getElementById('pg-mode-solo-btn')?.addEventListener('click', () => {
        closeModeSelect();
        window.openQuickCreate('solo');
    });
    document.getElementById('pg-mode-collab-btn')?.addEventListener('click', () => {
        closeModeSelect();
        window.openQuickCreate('collab');
    });
    document.getElementById('pg-mode-lesson-plan-btn')?.addEventListener('click', () => {
        closeModeSelect();
        openLessonPlanModal();
    });

    // Ders Planı oluşturma (minimal: sınıf + açıklama)
    document.getElementById('pg-lp-modal-close')?.addEventListener('click', closeLessonPlanModal);
    document.getElementById('pg-lp-modal')?.addEventListener('click', e => {
        if (e.target.id === 'pg-lp-modal') closeLessonPlanModal();
    });
    _lpBindExistingListEvents();
    document.getElementById('pg-lp-choice-template')?.addEventListener('click', _lpShowTemplateStep);
    document.getElementById('pg-lp-choice-instance')?.addEventListener('click', () => _lpShowFormStep());
    document.getElementById('pg-lp-template-back-btn')?.addEventListener('click', _lpShowChoiceStep);
    document.getElementById('pg-lp-browse-templates')?.addEventListener('click', _lpShowTemplatesListStep);
    document.getElementById('pg-lp-browse-instances')?.addEventListener('click', _lpShowInstancesListStep);
    document.getElementById('pg-lp-templates-back-btn')?.addEventListener('click', _lpShowChoiceStep);
    document.getElementById('pg-lp-instances-back-btn')?.addEventListener('click', _lpShowChoiceStep);
    document.getElementById('pg-lp-template-save-btn')?.addEventListener('click', _lpSaveTemplate);
    document.getElementById('pg-lp-back-btn')?.addEventListener('click', _lpShowChoiceStep);
    document.getElementById('pg-lp-target-class')?.addEventListener('click', () => _lpSetTarget('class'));
    document.getElementById('pg-lp-target-student')?.addEventListener('click', () => _lpSetTarget('student'));
    document.getElementById('pg-lp-group')?.addEventListener('change', _lpLoadStudents);
    document.getElementById('pg-lp-save-btn')?.addEventListener('click', _lpSave);
    document.getElementById('pg-lp-students')?.addEventListener('change', e => {
        if (e.target.classList.contains('pg-lp-student-cb')) _lpRenderStudentPicker(document.getElementById('pg-lp-student-search')?.value);
    });
    document.getElementById('pg-lp-student-chips')?.addEventListener('click', e => {
        const chip = e.target.closest('.pg-lp-student-chip');
        if (!chip) return;
        const cb = document.getElementById(`pg-lp-student-${chip.dataset.id}`);
        if (cb) { cb.checked = false; _lpRenderStudentPicker(document.getElementById('pg-lp-student-search')?.value); }
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
                window.openGoalModal();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                const val = quickInp.value.trim();
                if (!val) return;
                const _catFilter = [...window._pgGetActiveFilters()].find(f => CATEGORY_KEYS.includes(f));
                window.addGoal({ title: val, category: _catFilter || 'diger', priority: 2 });
                quickInp.value = '';
                quickInp.blur();
            } else if (e.key === 'Escape') {
                quickInp.value = ''; quickInp.blur();
            }
        });
    }

    // Goal modal
    document.getElementById('pg-modal-close') ?.addEventListener('click', window.closeGoalModal);
    document.getElementById('pg-modal-cancel')?.addEventListener('click', window.closeGoalModal);
    document.getElementById('pg-goal-modal')  ?.addEventListener('click', e=>{ if (e.target.id==='pg-goal-modal') window.closeGoalModal(); });
    document.getElementById('pg-goal-form')   ?.addEventListener('submit', window.handleGoalSubmit);

}
window._pgSetupGoalCreationModals = _pgSetupGoalCreationModals;

export function _pgSetupDetailAndMilestonePanel() {
    // Detail panel
    document.getElementById('pg-dp-back')       ?.addEventListener('click', window.closeDetailPanel);
    document.getElementById('pg-dp-close')      ?.addEventListener('click', window.closeDetailPanel);
    document.getElementById('pg-detail-overlay')?.addEventListener('click', window.closeDetailPanel);

    // Milestone form
    document.getElementById('pg-dp-add-ms')?.addEventListener('click', showMsForm);
    document.getElementById('pg-ms-cancel')?.addEventListener('click', hideMsForm);
    document.getElementById('pg-ms-save')  ?.addEventListener('click', window.saveMsForm);
    document.getElementById('pg-ms-title') ?.addEventListener('keydown', e=>{ if (e.key==='Enter') { e.preventDefault(); window.saveMsForm(); } });

    // Progress slider
    document.getElementById('pg-dp-slider')?.addEventListener('input', e=>{
        const el=document.getElementById('pg-dp-slider-val');
        if (el) el.textContent=e.target.value+'%';
    });
    document.getElementById('pg-dp-save-progress')?.addEventListener('click', ()=>{
        const detailGoalId = window._pgGetDetailGoalId();
        if (!detailGoalId) return;
        window.updateGoalProgress(detailGoalId, parseInt(document.getElementById('pg-dp-slider')?.value||0));
        window.toast('İlerleme kaydedildi ✓');
    });

}
window._pgSetupDetailAndMilestonePanel = _pgSetupDetailAndMilestonePanel;

export function _pgSetupEscAndFinalBindings() {
    // ESC
    document.addEventListener('keydown', e=>{
        if (e.key==='Escape') {
            const wz=document.getElementById('pg-wizard-modal');
            if (wz&&!wz.classList.contains('hidden')) { window.closeWizard(); return; }
            const modal=document.getElementById('pg-goal-modal');
            if (modal&&!modal.classList.contains('hidden')) { window.closeGoalModal(); return; }
            if (window._pgGetDetailGoalId()) window.closeDetailPanel();
        }
    });

    // Plan view bindings
    window._pvInitBindings();

    // İlk yüklemede takvimi senkronize et
    if (typeof window.syncAllMilestonesToCalendar==='function')
        setTimeout(window.syncAllMilestonesToCalendar, 800);

    // render() artık planning-misc-widgets.js'te tanımlı ve planning.js'ten
    // SONRA yükleniyor (bkz. inline-module-loader.js) — init() senkron
    // çalıştığı için bare render() burada henüz tanımsız olabilir. Faz G
    // köprü dönüşümünde ortaya çıkan pre-existing bir yükleme-sırası
    // hatasıydı (bu satır planning.js'i modül olarak "errored" işaretleyip
    // ondan `import` eden TÜM planning-*.js dosyalarını da bozuyordu).
    if (typeof window.render === 'function') window.render();
}
window._pgSetupEscAndFinalBindings = _pgSetupEscAndFinalBindings;
