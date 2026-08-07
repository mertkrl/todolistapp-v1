// social-institution-classroom-wire.js
// social-institution-panel.js'ten çıkarıldı (Faz H devamı): renderClassroomTab'ın
// sekme-içi event-binding fonksiyonları (Rapor/Ders Programı/Roster/Performans/
// Ödevler sekmeleri) — hepsi el/data/ctx/refresh paketini parametre alan, module-
// seviye state'e dokunmayan jenerik DOM bağlama kodu. Davranış birebir aynı.
//
// Faz refactor devamı: alt-gruplar (Rapor+Performans / Ders Programı+Roster /
// Ödevler) ayrı dosyalara çıkarıldı, burada re-export edilip generic 2 fonksiyon
// (sekme geçişi/ödev filtresi) kaldı.
export {
    _wireReportTabEvents,
    _ctWireKickBtns,
    _ctWireReportDrilldown,
    _ctWireLowSampleBadges,
    _ctWirePopovers,
    _ctWirePerfSortFilterEvents,
    _wirePerformanceTabEvents,
} from './social-institution-classroom-wire-performance.js';
export {
    _ctWireScheduleEvents,
    _ctWireRosterEvents,
    _wireScheduleAndRosterEvents,
} from './social-institution-classroom-wire-schedule-roster.js';
export {
    _ctWireAssignmentSetup,
    _ctWireAssignmentActions,
    _wireAssignmentFormEvents,
} from './social-institution-classroom-wire-assignments.js';

// Ana sekme (Performans/Ödevler/Program/Sınıflar/Rapor) geçişi — jenerik, ctx gerekmez.
export function _wireSubtabSwitching(el, data) {
    el.querySelectorAll('.cp-subtab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            el.dataset.activeSubtab = btn.dataset.cpsub;
            el.querySelectorAll('.cp-subtab-btn').forEach(b => b.classList.remove('active'));
            el.querySelectorAll('.cp-subtab-panel').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            el.querySelector(`.cp-subtab-panel[data-cpsubpanel="${btn.dataset.cpsub}"]`)?.classList.add('active');
            // Sınıf Paneli'nin hangi alt sekmesinde olunduğunu da kaydet — sayfa
            // yenilemesinde grup paneli geri açıldığında aynı alt sekmeye düşülsün.
            if (typeof window._dcPersistLastOpen === 'function') window._dcPersistLastOpen({ fn: 'group-panel', code: data.code, gtab: 'classroom', subtab: btn.dataset.cpsub });
        });
    });
}

// Ödevler sekmesi içi: "Hızlı Ödev/Ders Planları" alt-geçiş + Tümü/Ödev/Ders Planı
// filtresi + "Geçmiş ödevleri göster" aç/kapa — hepsi jenerik DOM toggle, ctx gerekmez.
export function _wireAssignmentFilterEvents(el) {
    // "Hızlı Ödev" / "Ders Planları" iç-sekme geçişi (sadece öğretmen tarafında var)
    el.querySelectorAll('.cp-asg-innertab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            el.querySelectorAll('.cp-asg-innertab-btn').forEach(b => b.classList.remove('active'));
            el.querySelectorAll('.cp-asg-innertab-panel').forEach(p => p.classList.add('hidden'));
            btn.classList.add('active');
            el.querySelector(`.cp-asg-innertab-panel[data-cpasgpanel="${btn.dataset.cpasgsub}"]`)?.classList.remove('hidden');
        });
    });

    // Öğrenci "Tümü/Ödevler/Ders Planları" filtresi — veri yeniden çekilmez, sadece
    // ilgili blok(lar) gösterilir/gizlenir.
    el.querySelectorAll('.cp-list-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            el.querySelectorAll('.cp-list-filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const filter = btn.dataset.cplistfilter;
            el.querySelectorAll('[data-cplist-type]').forEach(block => {
                block.classList.toggle('hidden', filter !== 'all' && block.dataset.cplistType !== filter);
            });
        });
    });

    // "Geçmiş ödevleri göster" açılır-kapanır bağlantı — önceden ayrı bir Aktif/Geçmiş
    // sekme çubuğuydu ("kafa karıştırıcı" geri bildirimi üzerine kaldırıldı); artık aktif
    // liste her zaman görünür, geçmiş sadece istenirse tek tıkla altta açılır.
    el.querySelectorAll('[data-cpasghist-toggle]').forEach(btn => {
        btn.addEventListener('click', () => {
            const panel = btn.nextElementSibling;
            if (!panel || !panel.matches('[data-cpasghist-panel]')) return;
            const willShow = panel.classList.contains('hidden');
            panel.classList.toggle('hidden', !willShow);
            btn.classList.toggle('is-open', willShow);
            const label = btn.querySelector('.cp-asg-history-toggle-label');
            if (label) label.textContent = willShow ? 'Geçmiş ödevleri gizle' : 'Geçmiş ödevleri göster';
        });
    });
}
