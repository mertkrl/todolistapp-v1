// social-institution-classroom-wire-performance.js
// social-institution-classroom-wire.js'ten çıkarıldı: Rapor sekmesi ve Performans
// sekmesi (kick/drilldown/popover/sort-filter) event-binding fonksiyonları.
// Hepsi el/data/ctx/refresh paketini parametre alan, module-seviye state'e
// dokunmayan jenerik DOM bağlama kodu.
import { getCurrentUser } from './state/current-user-store.js';
import { _applyDynStyles } from './social-institution-panel.js';
import { _cpGenerateStudentReport } from './social-institution-student-report.js';

export function _wireReportTabEvents(el, data, isClassAdmin, ctx) {
    const { isWork, memberLabel, assignments, subsByAsg, subGrades, stepDoneByAsg, submittedAtByAsgUser, scheduleRows, DAY_NAMES_TR, reportStudentOptions } = ctx;
    const reportSelect = el.querySelector('#cp-report-student-select');
    const reportSectionFilter = el.querySelector('#cp-report-section-filter');
    const reportBtn = el.querySelector('#cp-report-generate-btn');
    const reportStatus = el.querySelector('#cp-report-status');
    reportSelect?.addEventListener('change', () => {
        if (reportBtn) reportBtn.disabled = !reportSelect.value;
    });
    reportSectionFilter?.addEventListener('change', () => {
        const sectionId = reportSectionFilter.value;
        [...(reportSelect?.options || [])].forEach(opt => {
            if (!opt.value) return; // "… seç" placeholder her zaman görünür kalır
            opt.hidden = !!sectionId && opt.dataset.sectionId !== sectionId;
        });
        // Filtrelenip görünmez kalan bir öğrenci seçiliyse seçim sıfırlanır.
        const selectedOpt = reportSelect?.selectedOptions?.[0];
        if (selectedOpt && selectedOpt.hidden) {
            reportSelect.value = '';
            if (reportBtn) reportBtn.disabled = true;
        }
    });
    reportBtn?.addEventListener('click', async () => {
        const studentUserId = isClassAdmin ? reportSelect?.value : getCurrentUser().id;
        const studentEntry = isClassAdmin
            ? reportStudentOptions.find(m => m.userId === studentUserId)
            : { displayName: getCurrentUser().displayName || getCurrentUser().username };
        if (!studentUserId || !studentEntry) return;
        reportBtn.disabled = true;
        const prevLabel = reportBtn.innerHTML;
        reportBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Hazırlanıyor…';
        if (reportStatus) reportStatus.textContent = '';
        try {
            await _cpGenerateStudentReport({
                data, isWork, memberLabel, assignments, subsByAsg, subGrades, stepDoneByAsg,
                submittedAtByAsgUser, scheduleRows, DAY_NAMES_TR, studentUserId,
                studentName: studentEntry.displayName
            });
        } catch (e) {
            if (reportStatus) { reportStatus.textContent = 'Rapor oluşturulamadı: ' + (e.message || 'bilinmeyen hata'); reportStatus.style.color = '#ff6b6b'; }
        } finally {
            reportBtn.disabled = isClassAdmin ? !reportSelect.value : false;
            reportBtn.innerHTML = prevLabel;
        }
    });
}

// Performans sekmesi: üye çıkarma, rapora yönlendirme, "az veri" rozeti,
// popover'lar ve sıralanabilir/filtrelenebilir tablo. `refresh` sadece üye
// çıkarma sonrası tüm paneli yenilemek için gerekiyor (üst orkestratörden gelir).
export function _ctWireKickBtns(scope, data, memberLabel, refresh) {
    scope.querySelectorAll('.cp-row-kick-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const userId = btn.dataset.userId;
            const name = btn.dataset.name;
            const ok = await window.showFocusaiConfirm({
                title: `${memberLabel === 'Çalışan' ? 'Ekipten' : 'Sınıftan'} Çıkar`,
                desc: `<b>${window._escapeHtml(name)}</b> ${memberLabel.toLowerCase()}sini gruptan çıkarmak istediğine emin misin?`,
                type: 'danger', icon: 'fa-user-xmark', confirmText: 'Çıkar', cancelText: 'Vazgeç'
            });
            if (!ok) return;
            btn.disabled = true;
            const { error } = await window.FocusSupabase.from('group_members').delete().eq('group_id', data._supaId).eq('user_id', userId);
            if (error) { window.dcShowToast('Çıkarılamadı: ' + error.message, 'error'); btn.disabled = false; return; }
            window.dcShowToast(`${name} gruptan çıkarıldı.`, 'success');
            refresh();
        });
    });
}
export function _ctWireReportDrilldown(scope, el) {
    scope.querySelectorAll('.cp-perf-name-link').forEach(nameEl => {
        nameEl.addEventListener('click', () => {
            const userId = nameEl.dataset.userId;
            if (!userId) return;
            el.querySelector('.cp-subtab-btn[data-cpsub="rapor"]')?.click();
            const select = el.querySelector('#cp-report-student-select');
            if (select) {
                select.value = userId;
                select.dispatchEvent(new Event('change'));
                select.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        });
    });
}
export function _ctWireLowSampleBadges(scope) {
    scope.querySelectorAll('.cp-lowsample-badge').forEach(badge => {
        badge.addEventListener('click', (e) => {
            e.stopPropagation();
            window.dcShowToast(badge.title, 'info');
        });
    });
}
export function _ctWirePopovers(el) {
el.querySelectorAll('.cp-popover').forEach(pop => {
    const toggle = pop.querySelector(':scope > button');
    const panel = pop.querySelector(':scope > .cp-popover-panel');
    if (!toggle || !panel) return;
    toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const willOpen = panel.hidden;
        document.querySelectorAll('.cp-popover-panel').forEach(p => { p.hidden = true; });
        document.querySelectorAll('.cp-popover.cp-popover-open').forEach(p => p.classList.remove('cp-popover-open'));
        panel.hidden = !willOpen;
        pop.classList.toggle('cp-popover-open', willOpen);
    });
    panel.addEventListener('click', (e) => e.stopPropagation());
    panel.querySelector('.cp-popover-close')?.addEventListener('click', () => {
        panel.hidden = true;
        pop.classList.remove('cp-popover-open');
    });
});
if (!window.__cpPopoverOutsideClickWired) {
    window.__cpPopoverOutsideClickWired = true;
    document.addEventListener('click', (e) => {
        document.querySelectorAll('.cp-popover').forEach(pop => {
            if (!pop.contains(e.target)) {
                const panel = pop.querySelector(':scope > .cp-popover-panel');
                if (panel) panel.hidden = true;
                pop.classList.remove('cp-popover-open');
            }
        });
    });
}

}
export function _ctWirePerfSortFilterEvents(el, data, isClassAdmin, ctx, refresh, wireKickBtns, wireReportDrilldown, wireLowSampleBadges) {
    const { memberLabel, sectionNameById, showClassColumn, periodLabel, buildPerfRows, sortPerfRows, filterPerfRowsByClass, renderPerfRowsHtml, renderPerfDistributionHtml } = ctx;
if (isClassAdmin && ctx.tableRows.length) {
    const perfRowsWrap = el.querySelector('#cp-perf-rows');
    const perfPeriodLabelEl = el.querySelector('#cp-perf-period-label');
    const perfClassLabelEl = el.querySelector('#cp-perf-class-label');
    const perfTableMetaEl = el.querySelector('#cp-perf-table-meta');
    const perfDistWrap = el.querySelector('#cp-perf-dist-wrap');
    const rerenderPerfRows = () => {
        const visible = filterPerfRowsByClass(el.dataset.perfClass, ctx.tableRows);
        perfRowsWrap.innerHTML = renderPerfRowsHtml(sortPerfRows(el.dataset.perfSortKey, el.dataset.perfSortDir, visible));
        _applyDynStyles(perfRowsWrap);
        wireKickBtns(perfRowsWrap);
        wireReportDrilldown(perfRowsWrap);
        wireLowSampleBadges(perfRowsWrap);
        const cid = el.dataset.perfClass;
        if (perfClassLabelEl) {
            perfClassLabelEl.textContent = ' · ' + (cid === 'all' ? 'tüm sınıflar' : cid === '__unassigned__' ? 'sınıfsız' : (sectionNameById[cid] || ''));
        }
        // Filtre şeridi yalnızca varsayılandan (dönem=Tümü + sınıf=Tümü) farklıyken
        // görünür — aksi halde her zaman aynı şeyi söyleyen gereksiz bir satır olurdu.
        if (perfTableMetaEl) {
            const isDefault = el.dataset.perfPeriod === 'all' && (!showClassColumn || cid === 'all');
            perfTableMetaEl.classList.toggle('cp-perf-table-meta--hidden', isDefault);
        }
    };
    // Sıralanabilir sütun başlıkları — 3 durumlu döngü (Excel/Sheets'teki gibi):
    // 1. tık: artan (asc), 2. tık: azalan (desc), 3. tık: varsayılana (isme göre artan)
    // döner — aksi halde bir sütunda sonsuza dek asc/desc arasında sıkışıp kalır ve
    // "eski hâline dönme" yolu olmazdı.
    const PERF_DEFAULT_SORT_KEY = 'name', PERF_DEFAULT_SORT_DIR = 'asc';
    el.querySelectorAll('[data-perfsortkey]').forEach(btn => {
        btn.addEventListener('click', () => {
            const key = btn.dataset.perfsortkey;
            const sameKey = el.dataset.perfSortKey === key;
            if (sameKey && el.dataset.perfSortDir === 'desc') {
                el.dataset.perfSortKey = PERF_DEFAULT_SORT_KEY;
                el.dataset.perfSortDir = PERF_DEFAULT_SORT_DIR;
            } else if (sameKey) {
                el.dataset.perfSortDir = 'desc';
            } else {
                el.dataset.perfSortKey = key;
                el.dataset.perfSortDir = 'asc';
            }
            el.querySelectorAll('[data-perfsortkey]').forEach(b => {
                const active = b.dataset.perfsortkey === el.dataset.perfSortKey;
                b.classList.toggle('active', active);
                const icon = b.querySelector('.cp-perf-sort-arrow');
                if (icon) icon.className = 'fa-solid cp-perf-sort-arrow ' + (active ? (el.dataset.perfSortDir === 'desc' ? 'fa-arrow-down' : 'fa-arrow-up') : 'fa-sort');
            });
            rerenderPerfRows();
        });
    });
    el.querySelectorAll('[data-perfclass]').forEach(btn => {
        btn.addEventListener('click', () => {
            const classId = btn.dataset.perfclass;
            if (el.dataset.perfClass === classId) return;
            el.dataset.perfClass = classId;
            el.querySelectorAll('[data-perfclass]').forEach(b => b.classList.toggle('active', b.dataset.perfclass === classId));
            rerenderPerfRows();
        });
    });
    el.querySelectorAll('[data-perfperiod]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const period = btn.dataset.perfperiod;
            if (el.dataset.perfPeriod === period) return;
            el.dataset.perfPeriod = period;
            el.querySelectorAll('[data-perfperiod]').forEach(b => b.classList.toggle('active', b.dataset.perfperiod === period));
            if (perfPeriodLabelEl) perfPeriodLabelEl.textContent = periodLabel[period];
            ctx.perfRows = buildPerfRows(period);
            ctx.perfRows.forEach(r => { r.classId = r.classSectionId || '__unassigned__'; r.className = r.classSectionId ? (sectionNameById[r.classSectionId] || 'Sınıf') : 'Sınıfsız'; });
            ctx.tableRows = ctx.perfRows;
            if (perfDistWrap) perfDistWrap.innerHTML = renderPerfDistributionHtml(ctx.perfRows);
            rerenderPerfRows();
        });
    });
}
}
export function _wirePerformanceTabEvents(el, data, isClassAdmin, ctx, refresh) {
    const { memberLabel } = ctx;
    const wireKickBtns = (scope) => _ctWireKickBtns(scope, data, memberLabel, refresh);
    const wireReportDrilldown = (scope) => _ctWireReportDrilldown(scope, el);
    const wireLowSampleBadges = (scope) => _ctWireLowSampleBadges(scope);
    wireKickBtns(el);
    wireReportDrilldown(el);
    wireLowSampleBadges(el);
    _ctWirePopovers(el);
    _ctWirePerfSortFilterEvents(el, data, isClassAdmin, ctx, refresh, wireKickBtns, wireReportDrilldown, wireLowSampleBadges);
}
