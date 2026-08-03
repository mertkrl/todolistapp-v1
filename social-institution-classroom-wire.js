// social-institution-classroom-wire.js
// social-institution-panel.js'ten çıkarıldı (Faz H devamı): renderClassroomTab'ın
// sekme-içi event-binding fonksiyonları (Rapor/Ders Programı/Roster/Performans/
// Ödevler sekmeleri) — hepsi el/data/ctx/refresh paketini parametre alan, module-
// seviye state'e dokunmayan jenerik DOM bağlama kodu. Davranış birebir aynı.
import { getCurrentUser } from './state/current-user-store.js';
import { _applyDynStyles } from './social-institution-panel.js';
import { _cpGenerateStudentReport } from './social-institution-student-report.js';
import {
    _cpOpenScheduleModal,
    _cpOpenScheduleViewModal,
    _cpOpenSectionDetailModal,
    _cpPatchMemberSection,
    _cpRosterPatchRowAfterMove,
    _cpRosterPatchSectionsPanelAfterMove,
    _cpSchedShowBuilder,
} from './social-institution-class-modals.js';

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

       // Performans sekmesi: üye çıkarma, rapora yönlendirme, "az veri" rozeti,
       // popover'lar ve sıralanabilir/filtrelenebilir tablo. `refresh` sadece üye
       // çıkarma sonrası tüm paneli yenilemek için gerekiyor (üst orkestratörden gelir).
       // Faz Dev-Dosya-Bölme: _wirePerformanceTabEvents'in wireKickBtns closure'ı module-
       // seviyeye taşındı — durumsuz (mutable state yok), tek kullanımlık DOM bağlama.
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
       // Faz Dev-Dosya-Bölme: wireReportDrilldown closure'ı module-seviyeye taşındı.
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
       // Faz Dev-Dosya-Bölme: wireLowSampleBadges closure'ı module-seviyeye taşındı.
       export function _ctWireLowSampleBadges(scope) {
           scope.querySelectorAll('.cp-lowsample-badge').forEach(badge => {
               badge.addEventListener('click', (e) => {
                   e.stopPropagation();
                   window.dcShowToast(badge.title, 'info');
               });
           });
       }
       // Faz Dev-Dosya-Bölme: Popover (Bu bölüm nasıl okunur / Filtrele) bağlama bloğu
       // module-seviyeye taşındı — sadece el'e ve global window.__cpPopoverOutsideClickWired
       // bayrağına ihtiyaç duyuyor, davranış birebir aynı.
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
       // Faz Dev-Dosya-Bölme: Performans tablosu sıralama/sınıf/dönem filtresi bloğu
       // module-seviyeye taşındı. ctx zaten mutable referansla paylaşılıyor (ctx.perfRows/
       // ctx.tableRows reassign'leri çağırana da yansır) — ekstra parametre gerekmiyor.
       // wireKickBtns/wireReportDrilldown/wireLowSampleBadges rerenderPerfRows içinde
       // yeniden kullanıldığı için parametre olarak geçiliyor.
       export function _ctWirePerfSortFilterEvents(el, data, ctx, refresh, wireKickBtns, wireReportDrilldown, wireLowSampleBadges) {
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
           // Faz Dev-Dosya-Bölme: gövde module-seviye _ct* fonksiyonlarında.
           const wireKickBtns = (scope) => _ctWireKickBtns(scope, data, memberLabel, refresh);
           const wireReportDrilldown = (scope) => _ctWireReportDrilldown(scope, el);
           const wireLowSampleBadges = (scope) => _ctWireLowSampleBadges(scope);
           wireKickBtns(el);
           wireReportDrilldown(el);
           wireLowSampleBadges(el);
           _ctWirePopovers(el);
           _ctWirePerfSortFilterEvents(el, data, ctx, refresh, wireKickBtns, wireReportDrilldown, wireLowSampleBadges);
       }

       // Ders Programı + Öğrenciler/Sınıflar (roster) sekmeleri — sadece isClassAdmin
       // iken çağrılır. `refresh` (tüm paneli yeniden çeken) üst orkestratörden gelir,
       // çünkü Ödevler sekmesiyle de paylaşılıyor.
       // Faz Dev-Dosya-Bölme: _wireScheduleAndRosterEvents'in ders programı (schedule) bloğu
       // module-seviyeye taşındı — bağımsız event-wiring, sadece el/data/ctx.scheduleSubjectOptions/
       // refresh'e ihtiyaç duyuyor. Davranış birebir aynı.
       export function _ctWireScheduleEvents(el, data, ctx, refresh) {
           const { classSections, scheduleSubjectOptions } = ctx;
           const buildClassChoices = () => classSections.map(s => ({ id: s.id, name: s.name }));
           el.querySelector('#cp-sched-open-modal-btn')?.addEventListener('click', () => {
               _cpOpenScheduleModal(buildClassChoices(), scheduleSubjectOptions, refresh, data._supaId);
           });
           el.querySelectorAll('.cp-sched-class-card').forEach(btn => {
               btn.addEventListener('click', () => {
                   const sectionId = btn.dataset.sectionId;
                   const sectionName = btn.dataset.sectionName;
                   const publishedId = btn.dataset.publishedId;
                   const draftId = btn.dataset.draftId;
                   // Yayınlanmış program varsa önce salt-okunur görüntüle; taslak varsa
                   // (yayın yoksa veya kendi taslağı) düzenleme ekranına götür.
                   if (publishedId) {
                       _cpOpenScheduleViewModal(data._supaId, sectionName, publishedId);
                   } else if (draftId) {
                       _cpOpenScheduleModal(buildClassChoices(), scheduleSubjectOptions, refresh, data._supaId);
                       _cpSchedShowBuilder({ groupId: data._supaId, sectionId, groupName: sectionName, programId: draftId, programStatus: 'draft' });
                   }
               });
           });
           el.querySelectorAll('.cp-sched-card-edit').forEach(btn => {
               btn.addEventListener('click', (e) => {
                   e.stopPropagation();
                   const sectionId = btn.dataset.sectionId, sectionName = btn.dataset.sectionName;
                   const programId = btn.dataset.programId, programStatus = btn.dataset.programStatus;
                   if (!programId) return;
                   _cpOpenScheduleModal(buildClassChoices(), scheduleSubjectOptions, refresh, data._supaId);
                   _cpSchedShowBuilder({ groupId: data._supaId, sectionId, groupName: sectionName, programId, programStatus });
               });
           });
           el.querySelectorAll('.cp-sched-card-del').forEach(btn => {
               btn.addEventListener('click', async (e) => {
                   e.stopPropagation();
                   const sectionName = btn.dataset.sectionName, programId = btn.dataset.programId;
                   if (!programId) return;
                   const ok = await window.showFocusaiConfirm({
                       title: 'Ders Programını Sil',
                       desc: `"${window._escapeHtml(sectionName)}" için ders programı (tüm dersleriyle birlikte) kalıcı olarak silinsin mi? Bu işlem geri alınamaz.`,
                       type: 'danger', icon: 'fa-trash-can', confirmText: 'Sil', cancelText: 'Vazgeç',
                   });
                   if (!ok) return;
                   btn.disabled = true;
                   await window.FocusSupabase.from('group_class_schedule').delete().eq('program_id', programId);
                   await window.FocusSupabase.from('group_schedule_programs').delete().eq('id', programId);
                   window.dcShowToast?.('Ders programı silindi.', 'success');
                   refresh();
               });
           });

       }
       // Faz Dev-Dosya-Bölme: _wireScheduleAndRosterEvents'in roster (öğrenciler/şubeler) bloğu
       // module-seviyeye taşındı — aynı gerekçe.
       export function _ctWireRosterEvents(el, data, ctx, refresh) {
           const { classSections, scheduleSubjectOptions, scheduleCardByClass, rosterMembers, memberLabel } = ctx;
           // Öğrenciler sekmesi: isme göre anlık arama/filtreleme
           const rosterSearchInput = el.querySelector('#cp-roster-search');
           rosterSearchInput?.addEventListener('input', () => {
               const q = rosterSearchInput.value.trim().toLocaleLowerCase('tr');
               el.querySelectorAll('.cp-roster-row').forEach(card => {
                   card.style.display = !q || (card.dataset.searchName || '').includes(q) ? '' : 'none';
               });
           });

           el.querySelectorAll('.cp-roster-remove-btn').forEach(btn => {
               btn.addEventListener('click', async () => {
                   const userId = btn.dataset.userId;
                   const name = btn.dataset.name;
                   const ok = await window.showFocusaiConfirm({
                       title: `${memberLabel === 'Çalışan' ? 'Ekipten' : 'Sınıftan'} Çıkar`,
                       desc: `<b>${window._escapeHtml(name)}</b> ${memberLabel.toLowerCase()}sini sınıftan çıkarmak istediğine emin misin?`,
                       type: 'danger', icon: 'fa-user-xmark', confirmText: 'Çıkar', cancelText: 'Vazgeç'
                   });
                   if (!ok) return;
                   btn.disabled = true;
                   const fromGroupId = btn.dataset.classId || data._supaId;
                   const { error } = await window.FocusSupabase.from('group_members').delete().eq('group_id', fromGroupId).eq('user_id', userId);
                   if (error) { window.dcShowToast('Çıkarılamadı: ' + error.message, 'error'); btn.disabled = false; return; }
                   window.dcShowToast(`${name} sınıftan çıkarıldı.`, 'success');
                   refresh();
               });
           });

           // Şubeye atama: artık ayrı bir gruba taşıma değil, AYNI grubun içinde
           // group_members.class_section_id güncellenmesi (116) — tek bir UPDATE yeterli.
           el.querySelectorAll('.cp-roster-move-select').forEach(sel => {
               sel.addEventListener('change', async () => {
                   const val = sel.value;
                   if (!val) return;
                   const userId = sel.dataset.userId;
                   const name = sel.dataset.name;
                   const targetName = val === '__unassigned__' ? 'Sınıfsız' : (classSections.find(s => s.id === val)?.name || 'Şube');
                   const ok = await window.showFocusaiConfirm({
                       title: 'Şube Değiştir',
                       desc: `<b>${window._escapeHtml(name)}</b> için şube <b>${window._escapeHtml(targetName)}</b> olarak değiştirilsin mi?`,
                       type: 'default', icon: 'fa-chalkboard-user', confirmText: 'Değiştir', cancelText: 'Vazgeç'
                   });
                   if (!ok) { sel.value = ''; return; }
                   sel.disabled = true;
                   const oldSectionId = sel.dataset.currentSectionId || null;
                   // .select() ŞART: RLS satırı reddederse Supabase hata döndürmez,
                   // sadece 0 satır etkiler — dönen satırı kontrol etmezsek "başarılı"
                   // gösterip sayfa yenilenince atama kaybolmuş gibi görünür (124/125).
                   const { data: updRows, error } = await window.FocusSupabase.from('group_members')
                       .update({ class_section_id: val === '__unassigned__' ? null : val })
                       .eq('group_id', data._supaId).eq('user_id', userId).select('user_id');
                   if (error || !updRows || updRows.length === 0) {
                       window.dcShowToast('Şube güncellenemedi' + (error ? ': ' + error.message : ' — yetki (RLS) reddetti, 124/125 migration canlıda uygulanmamış olabilir.'), 'error');
                       sel.disabled = false; sel.value = ''; return;
                   }
                   const newSectionId = val === '__unassigned__' ? null : val;
                   _cpPatchMemberSection(data, userId, newSectionId);
                   // "Şube kartına tıkla → öğrenci listesi" modalı (aşağıdaki
                   // cp-section-card-open click handler'ı) bu render'ın kapandığı
                   // `rosterMembers` dizisini filtreleyip listeliyor — sadece data.members'ı
                   // (yukarıda) veya DOM'u güncellemek bu diziyi TAZELEMEZ, kart hemen
                   // ardından tıklanınca öğrenci hâlâ eski şubede/sınıfsız görünürdü
                   // (kullanıcı bildirimi: "şubede kullanıcının kaydı gözükmüyor"). Bu
                   // kapanmış diziyi de yerinde güncelliyoruz.
                   const rmEntry = rosterMembers.find(rm => rm.userId === userId);
                   if (rmEntry) {
                       rmEntry.classId = newSectionId || '__unassigned__';
                       rmEntry.className = newSectionId ? (classSections.find(s => s.id === newSectionId)?.name || 'Şube') : 'Sınıfsız';
                   }
                   window.dcShowToast(`${name} için şube güncellendi.`, 'success');
                   // Değişikliği tüm sekmeyi yeniden yükleyip (iskelet-yükleniyor yanıp
                   // sönmesine, "sayfa yenilenmiş gibi" hissettiren gecikmeye yol açan
                   // refresh()) yerine, sadece ilgili satırı/sayacı yerinde güncelliyoruz.
                   _cpRosterPatchRowAfterMove(el, sel, userId, newSectionId, classSections, memberLabel);
                   // "Şubeler" paneli ayrı bir statik HTML bloğu olarak gömüldüğü için
                   // yukarıdaki satır-patch'i hiç görmüyordu — kart sayaçlarını da güncelle.
                   _cpRosterPatchSectionsPanelAfterMove(el, oldSectionId, newSectionId);
                   sel.dataset.currentSectionId = newSectionId || '__unassigned__';
                   sel.disabled = false;
               });
           });

           // Toplu seçim/işlem: checkbox'lardan seçileni topla, üst çubukta sayaç göster,
           // "Sınıf değiştir" / "Çıkar" işlemlerini seçili tüm üyelere sırayla uygula.
           const rosterBulkBar = el.querySelector('#cp-roster-bulk-bar');
           const rosterBulkCount = el.querySelector('#cp-roster-bulk-count');
           const rosterSelectAll = el.querySelector('#cp-roster-select-all');
           const rosterRowChecks = () => [...el.querySelectorAll('.cp-roster-row-check')];
           const updateRosterBulkBar = () => {
               const checked = rosterRowChecks().filter(cb => cb.checked);
               if (rosterBulkBar) rosterBulkBar.classList.toggle('hidden', checked.length === 0);
               if (rosterBulkCount) rosterBulkCount.textContent = `${checked.length} ${memberLabel.toLowerCase()} seçildi`;
               if (rosterSelectAll) {
                   const all = rosterRowChecks();
                   rosterSelectAll.checked = all.length > 0 && checked.length === all.length;
                   rosterSelectAll.indeterminate = checked.length > 0 && checked.length < all.length;
               }
           };
           rosterRowChecks().forEach(cb => cb.addEventListener('change', updateRosterBulkBar));
           rosterSelectAll?.addEventListener('change', () => {
               rosterRowChecks().forEach(cb => { cb.checked = rosterSelectAll.checked; });
               updateRosterBulkBar();
           });
           el.querySelector('#cp-roster-bulk-clear')?.addEventListener('click', () => {
               rosterRowChecks().forEach(cb => { cb.checked = false; });
               updateRosterBulkBar();
           });
           el.querySelector('#cp-roster-bulk-remove')?.addEventListener('click', async (ev) => {
               const checked = rosterRowChecks().filter(cb => cb.checked);
               if (!checked.length) return;
               const btn = ev.currentTarget;
               const names = checked.map(cb => cb.dataset.name);
               const ok = await window.showFocusaiConfirm({
                   title: `${memberLabel === 'Çalışan' ? 'Ekipten' : 'Sınıftan'} Çıkar`,
                   desc: `<b>${checked.length}</b> ${memberLabel.toLowerCase()} (${window._escapeHtml(names.join(', '))}) sınıftan çıkarılacak. Emin misin?`,
                   type: 'danger', icon: 'fa-user-xmark', confirmText: 'Çıkar', cancelText: 'Vazgeç'
               });
               if (!ok) return;
               btn.disabled = true;
               // Seçili öğrenciler artık farklı sınıflardan olabilir — her birini kendi
               // sınıfından (data-class-id) çıkarmak için gruplandırıp ayrı ayrı silinir.
               const byClass = {};
               checked.forEach(cb => {
                   const cid = cb.dataset.classId || data._supaId;
                   (byClass[cid] = byClass[cid] || []).push(cb.dataset.userId);
               });
               let hadError = false;
               for (const [cid, userIds] of Object.entries(byClass)) {
                   const { error } = await window.FocusSupabase.from('group_members').delete().eq('group_id', cid).in('user_id', userIds);
                   if (error) { hadError = true; window.dcShowToast('Çıkarılamadı: ' + error.message, 'error'); }
               }
               btn.disabled = false;
               if (hadError) return;
               window.dcShowToast(`${checked.length} ${memberLabel.toLowerCase()} sınıftan çıkarıldı.`, 'success');
               refresh();
           });
           el.querySelector('#cp-roster-bulk-move')?.addEventListener('change', async (ev) => {
               const sel = ev.currentTarget;
               const val = sel.value;
               if (!val) return;
               const checked = rosterRowChecks().filter(cb => cb.checked);
               if (!checked.length) { sel.value = ''; return; }
               const targetName = val === '__unassigned__' ? 'Sınıfsız' : (classSections.find(s => s.id === val)?.name || 'Şube');
               const names = checked.map(cb => cb.dataset.name).filter(Boolean);
               const ok = await window.showFocusaiConfirm({
                   title: 'Şube Değiştir',
                   desc: `<b>${checked.length}</b> ${memberLabel.toLowerCase()} (${window._escapeHtml(names.join(', '))}) için şube <b>${window._escapeHtml(targetName)}</b> olarak değiştirilsin mi?`,
                   type: 'default', icon: 'fa-chalkboard-user', confirmText: 'Değiştir', cancelText: 'Vazgeç'
               });
               if (!ok) { sel.value = ''; return; }
               sel.disabled = true;
               const userIds = checked.map(cb => cb.dataset.userId);
               // .select() ŞART — RLS sessiz 0-satır durumunu yakala (bkz. tekli atama notu)
               const { data: updRows, error } = await window.FocusSupabase.from('group_members')
                   .update({ class_section_id: val === '__unassigned__' ? null : val })
                   .eq('group_id', data._supaId).in('user_id', userIds).select('user_id');
               if (error || !updRows || updRows.length === 0) {
                   window.dcShowToast('Şube güncellenemedi' + (error ? ': ' + error.message : ' — yetki (RLS) reddetti, 124/125 migration canlıda uygulanmamış olabilir.'), 'error');
                   sel.disabled = false; sel.value = ''; return;
               }
               userIds.forEach(uid => _cpPatchMemberSection(data, uid, val === '__unassigned__' ? null : val));
               window.dcShowToast(`${checked.length} ${memberLabel.toLowerCase()} için şube güncellendi.`, 'success');
               refresh();
           });

           // "Öğrenciler" / "Sınıflar" iç-sekme geçişi
           el.querySelectorAll('.cp-roster-innertab-btn').forEach(btn => {
               btn.addEventListener('click', () => {
                   el.querySelectorAll('.cp-roster-innertab-btn').forEach(b => b.classList.remove('active'));
                   el.querySelectorAll('.cp-roster-innertab-panel').forEach(p => p.classList.add('hidden'));
                   btn.classList.add('active');
                   el.querySelector(`.cp-roster-innertab-panel[data-cprosterpanel="${btn.dataset.cprostersub}"]`)?.classList.remove('hidden');
                   el.dataset.activeRosterSubtab = btn.dataset.cprostersub;
               });
           });

           // "Şubeler" alt-görünümü: yeni şube oluştur (bu grubun İÇİNDE, group_class_sections).
           const sectionAddBtn = el.querySelector('#cp-section-add-btn');
           const sectionAddInput = el.querySelector('#cp-section-add-name');
           const sectionAddStatus = el.querySelector('#cp-section-add-status');
           const createSection = async () => {
               const name = (sectionAddInput?.value || '').trim();
               if (!name) { if (sectionAddStatus) sectionAddStatus.textContent = 'Bir şube adı yaz.'; return; }
               if (sectionAddBtn) sectionAddBtn.disabled = true;
               if (sectionAddStatus) sectionAddStatus.textContent = 'Oluşturuluyor…';
               const { error } = await window.FocusSupabase.from('group_class_sections')
                   .insert({ group_id: data._supaId, name, created_by: getCurrentUser().id });
               if (sectionAddBtn) sectionAddBtn.disabled = false;
               if (error) {
                   if (sectionAddStatus) sectionAddStatus.textContent = error.code === '23505' ? `"${name}" adında bir şube zaten var.` : 'Oluşturulamadı: ' + error.message;
                   return;
               }
               window.dcShowToast(`"${name}" şubesi oluşturuldu.`, 'success');
               refresh();
           };
           sectionAddBtn?.addEventListener('click', createSection);
           sectionAddInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') createSection(); });

           // Şube kartına tıklayınca detay modalı: şubedeki öğrenciler, ders programı,
           // adını değiştirme/silme tek yerden yapılır (bkz. _cpOpenSectionDetailModal).
           el.querySelectorAll('.cp-section-card-open').forEach(card => {
               card.addEventListener('click', () => {
                   const sectionId = card.dataset.sectionId;
                   const sectionName = card.dataset.sectionName;
                   const students = rosterMembers.filter(m => m.classId === sectionId)
                       .map(m => ({ userId: m.userId, displayName: m.displayName }));
                   _cpOpenSectionDetailModal({
                       groupId: data._supaId, groupData: data, sectionId, sectionName, memberLabel, students,
                       scheduleInfo: scheduleCardByClass[sectionId] || null,
                       subjectOptions: scheduleSubjectOptions, buildClassChoices, onChanged: refresh,
                   });
               });
               card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.click(); } });
           });
       }
       export function _wireScheduleAndRosterEvents(el, data, isClassAdmin, ctx, refresh) {
           // Not: Aylık Rapor (ve CSV dışa aktarma) kaldırıldı (2026-07-13, kullanıcı kararı) —
           // buradaki eski #cp-csv-btn bağlama kodu da bu yüzden yok.
           // Faz Dev-Dosya-Bölme: gövde module-seviye _ctWireScheduleEvents/_ctWireRosterEvents'te.
           if (isClassAdmin) {
               _ctWireScheduleEvents(el, data, ctx, refresh);
               _ctWireRosterEvents(el, data, ctx, refresh);
           }
       }

       // Ödevler sekmesi: hedef/sınıf/şablon seçiciler, ödev ekleme/silme/kapama,
       // öğrenci teslim formu, notlandırma, hatırlatma, çok-adımlı ödev işaretleme.
       // `refresh` üst orkestratörden gelir (Ders Programı/Roster ile paylaşılıyor).
       // Faz Dev-Dosya-Bölme: _wireAssignmentFormEvents'in "kurulum" yarısı (hedef/sınıf/
       // şablon seçiciler, karakter sayaçları, dosya seçici) module-seviyeye taşındı. Aşağıdaki
       // _ctWireAssignmentActions'ın (Ekle butonu vb.) ihtiyaç duyduğu DOM referansları
       // (targetAllBox/classPick/fileInput) bir `refs` paketiyle döndürülüyor — closure yerine
       // açık paylaşım, davranış birebir aynı.
       export function _ctWireAssignmentSetup(el, data, ctx) {
       const { assignments, subsByAsg, templates, allInstitutionClasses, studentMembers, targetMembers } = ctx;
       // Hedef seçici: "Tüm sınıf" kutusu işaretliyken bireysel öğrenci listesi gizli/pasif;
       // kaldırıldığında liste açılır ve seçilen kişiler target_user_ids'e yazılır.
       const targetAllBox = el.querySelector('#cp-asg-target-allbox');
       const targetStudentsBox = el.querySelector('#cp-asg-target-students');
       const targetSummaryEl = el.querySelector('#cp-asg-target-summary');
       // Tarayıcı, aynı sayfada yeniden render edilen checkbox'ların işaretli
       // durumunu bazen bir önceki render'dan "hatırlayıp" geri getiriyor
       // (form-restore davranışı) — her açılışta tümü kesin olarak boş/varsayılan
       // duruma sıfırlanır: "Tüm sınıf" işaretli, bireysel öğrenciler boş.
       if (targetAllBox) targetAllBox.checked = true;
       el.querySelectorAll('.cp-asg-target-student').forEach(cb => { cb.checked = false; });
       targetStudentsBox?.classList.add('hidden');
       const updateTargetSummary = () => {
           if (!targetSummaryEl) return;
           if (targetAllBox?.checked) { targetSummaryEl.textContent = 'Tüm sınıf'; return; }
           const n = el.querySelectorAll('.cp-asg-target-student:checked').length;
           targetSummaryEl.textContent = n ? `${n} kişi seçili` : 'Kimse seçilmedi';
       };
       targetAllBox?.addEventListener('change', () => {
           targetStudentsBox?.classList.toggle('hidden', targetAllBox.checked);
           if (targetAllBox.checked) el.querySelectorAll('.cp-asg-target-student').forEach(cb => { cb.checked = false; });
           updateTargetSummary();
       });
       el.querySelectorAll('.cp-asg-target-student').forEach(cb => cb.addEventListener('change', updateTargetSummary));

       // Sınıf seçici: başka bir sınıfa ödev vermek için o sınıfın öğrenci listesini
       // "Kime atanacak?" bölümüne yükler (bkz. cp-asg-add — ödev, seçilen sınıfın
       // group_id'sine yazılır).
       const classPick = el.querySelector('#cp-asg-class-pick');
       classPick?.addEventListener('change', () => {
           const cls = allInstitutionClasses.find(c => c.id === classPick.value);
           const members = (cls?.members || []).filter(m => m.userId && m.userId !== getCurrentUser().id);
           if (targetStudentsBox) {
               targetStudentsBox.innerHTML = members.map(s => `
                   <label class="cp-asg-target-row">
                       <input type="checkbox" class="cp-asg-target-student" value="${s.userId}">
                       <span>${window._escapeHtml(s.displayName)}</span>
                   </label>`).join('') || '<p class="cp-hint">Bu sınıfta henüz öğrenci yok.</p>';
               targetStudentsBox.querySelectorAll('.cp-asg-target-student').forEach(cb => cb.addEventListener('change', updateTargetSummary));
           }
           if (targetAllBox) { targetAllBox.checked = true; }
           targetStudentsBox?.classList.add('hidden');
           updateTargetSummary();
       });

       // Şablon seçilince formu doldurur
       const templatePick = el.querySelector('#cp-asg-template-pick');
       const templateDelBtn = el.querySelector('#cp-asg-template-del');
       templatePick?.addEventListener('change', () => {
           const t = templates.find(t => t.id === templatePick.value);
           templateDelBtn.style.display = t ? '' : 'none';
           if (!t) return;
           el.querySelector('#cp-asg-title').value = t.title || '';
           el.querySelector('#cp-asg-desc').value = t.description || '';
           el.querySelector('#cp-asg-priority').value = t.priority || 'normal';
       });
       templateDelBtn?.addEventListener('click', async () => {
           const t = templates.find(t => t.id === templatePick.value);
           if (!t) return;
           const ok = await window.showFocusaiConfirm({
               title: 'Şablonu Sil', desc: `<b>${window._escapeHtml(t.title)}</b> şablonunu silmek istediğine emin misin?`,
               type: 'danger', icon: 'fa-trash-can', confirmText: 'Sil', cancelText: 'Vazgeç'
           });
           if (!ok) return;
           await window.FocusSupabase.from('assignment_templates').delete().eq('id', t.id);
           refresh();
       });

       // Karakter sayacı — başlık ve açıklama
       const titleInput = el.querySelector('#cp-asg-title');
       const titleCountEl = el.querySelector('#cp-asg-title-count');
       titleInput?.addEventListener('input', () => {
           if (titleCountEl) titleCountEl.textContent = `${titleInput.value.length}/${titleInput.maxLength}`;
       });
       const descInput = el.querySelector('#cp-asg-desc');
       const descCountEl = el.querySelector('#cp-asg-desc-count');
       descInput?.addEventListener('input', () => {
           if (descCountEl) descCountEl.textContent = `${descInput.value.length}/${descInput.maxLength}`;
       });

       // Dosya seçilince adını göster
       const fileInput = el.querySelector('#cp-asg-file');
       const fileNameEl = el.querySelector('#cp-asg-file-name');
       fileInput?.addEventListener('change', () => {
           const f = fileInput.files?.[0];
           if (f) fileNameEl.innerHTML = `<i class="fa-solid fa-file"></i> ${window._escapeHtml(f.name)}`;
       });
           return { targetAllBox, classPick, fileInput };
       }
       // Faz Dev-Dosya-Bölme: _wireAssignmentFormEvents'in "aksiyon" yarısı (notlandırma,
       // hatırlatma, ödev ekleme, kapat/sil/geri-al, öğrenci teslimi, adım işaretleme)
       // module-seviyeye taşındı. `refs`, _ctWireAssignmentSetup'ın döndürdüğü paket.
       export function _ctWireAssignmentActions(el, data, ctx, refresh, refs) {
           const { assignments, subsByAsg, templates, allInstitutionClasses, studentMembers, targetMembers } = ctx;
           const { targetAllBox, classPick, fileInput } = refs;
       // Notlandırma: her teslim satırı için puan + geri bildirim kaydı
       el.querySelectorAll('.cp-grade-row').forEach(row => {
           row.querySelector('.cp-grade-save')?.addEventListener('click', async (e) => {
               const btn = e.currentTarget;
               const asgId = row.dataset.asgId, userId = row.dataset.userId;
               const gradeVal = row.querySelector('.cp-grade-input')?.value;
               const feedbackVal = row.querySelector('.cp-grade-feedback')?.value.trim();
               btn.disabled = true;
               const { error } = await window.FocusSupabase.from('assignment_submissions')
                   .update({
                       grade: gradeVal === '' ? null : Math.max(0, Math.min(100, parseInt(gradeVal, 10))),
                       teacher_feedback: feedbackVal || null
                   })
                   .eq('assignment_id', asgId).eq('user_id', userId);
               btn.disabled = false;
               if (error) { window.dcShowToast('Kaydedilemedi: ' + error.message, 'error'); return; }
               window.dcShowToast('Not kaydedildi.', 'success');
           });
       });

       // Teslim etmeyenlere hatırlatma bildirimi
       el.querySelectorAll('.cp-asg-remind').forEach(btn => btn.addEventListener('click', async (e) => {
           e.preventDefault();
           const asgId = btn.dataset.id;
           const a = assignments.find(x => x.id === asgId);
           if (!a) return;
           const subs = subsByAsg[asgId] || [];
           const targets = targetMembers(a).filter(m => !subs.includes(m.userId));
           if (!targets.length) return;
           btn.disabled = true;
           const rows = targets.map(m => ({
               user_id: m.userId,
               type: 'assignment_reminder',
               payload: {
                   fromName: getCurrentUser().displayName || getCurrentUser().username,
                   groupCode: data.code, groupName: data.name,
                   assignmentTitle: a.title, dueDate: a.due_date
               }
           }));
           const { error } = await window.FocusSupabase.from('notifications').insert(rows);
           if (error) { window.dcShowToast('Gönderilemedi: ' + error.message, 'error'); btn.disabled = false; return; }
           window.dcShowToast(`${targets.length} kişiye hatırlatma gönderildi.`, 'success');
           btn.textContent = 'Hatırlatma gönderildi ✓';
       }));

       // "Ekle" butonu — Bugün sekmesindeki görev ekleme çubuğuyla (td-toggle-add/td-add-form)
       // aynı davranış: form varsayılan gizli, butona basınca açılıp odak başlık alanına gider.
       const asgToggleAdd = el.querySelector('#cp-asg-toggle-add');
       const asgAddForm = el.querySelector('#cp-asg-add-form');
       if (asgToggleAdd && asgAddForm) {
           asgToggleAdd.addEventListener('click', () => {
               const open = !asgAddForm.classList.contains('is-hidden');
               asgAddForm.classList.toggle('is-hidden', open);
               asgToggleAdd.classList.toggle('is-open', !open);
               if (!open) el.querySelector('#cp-asg-title')?.focus();
           });
       }

       el.querySelector('#cp-asg-add')?.addEventListener('click', async (e) => {
           const addBtn = e.currentTarget;
           const title = el.querySelector('#cp-asg-title')?.value.trim();
           const due = el.querySelector('#cp-asg-due')?.value || null;
           const description = el.querySelector('#cp-asg-desc')?.value.trim() || '';
           const priority = el.querySelector('#cp-asg-priority')?.value || 'normal';
           const file = fileInput?.files?.[0];
           if (!title) { window.dcShowToast('Bir başlık yaz.'); return; }
           const useAll = targetAllBox?.checked !== false;
           const selectedIds = [...el.querySelectorAll('.cp-asg-target-student:checked')].map(cb => cb.value);
           if (!useAll && !selectedIds.length) { window.dcShowToast('En az bir kişi seç ya da "Tüm sınıf" kutusunu işaretle.'); return; }
           // Sınıf seçici varsa (kurumun birden fazla sınıfı varsa) ödev, seçilen sınıfa
           // yazılır — yoksa mevcut sınıfa (varsayılan davranış).
           const targetClassId = classPick?.value || data._supaId;
           const targetClass = allInstitutionClasses.find(c => c.id === targetClassId);
           addBtn.disabled = true;
           let attachment = null;
           if (file) {
               if (file.size > 15 * 1024 * 1024) { window.dcShowToast('Dosya boyutu 15MB\'ı geçemez.'); addBtn.disabled = false; return; }
               const ext = file.name.split('.').pop() || 'bin';
               const path = `assignment/${targetClassId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
               const { data: up, error: upErr } = await window.FocusSupabase.storage.from('chat-files').upload(path, file, { upsert: false });
               if (upErr) { window.dcShowToast('Dosya yüklenemedi: ' + upErr.message, 'error'); addBtn.disabled = false; return; }
               attachment = { name: file.name, size: file.size, type: file.type, bucket_path: up.path };
           }
           const { error } = await window.FocusSupabase.from('classroom_assignments').insert({
               group_id: targetClassId, created_by: getCurrentUser().id,
               title, description, priority,
               due_date: due ? new Date(due + 'T23:59:59').toISOString() : null,
               target_user_ids: useAll ? null : selectedIds,
               attachment
           });
           if (error) { window.dcShowToast('Ödev eklenemedi: ' + error.message, 'error'); addBtn.disabled = false; return; }
           // Hedeflenen öğrencilere yeni ödev bildirimi — sistem genelinde senkron olması için
           // (bugün/takvim rozetleri, "Ödevlerim" özeti) bunlar zaten Supabase realtime ile
           // classroom_assignments tablosunu dinliyor; bu sadece anlık toast/bildirim.
           const notifyIds = useAll
               ? (targetClassId === data._supaId
                   ? studentMembers.filter(m => m.userId !== getCurrentUser().id).map(m => m.userId)
                   : (targetClass?.members || []).filter(m => m.userId && m.userId !== getCurrentUser().id).map(m => m.userId))
               : selectedIds;
           if (notifyIds.length) {
               await window.FocusSupabase.from('notifications').insert(notifyIds.map(userId => ({
                   user_id: userId,
                   type: 'assignment_new',
                   payload: {
                       fromName: getCurrentUser().displayName || getCurrentUser().username,
                       groupCode: targetClass?.code || data.code, groupName: targetClass?.name || data.name,
                       assignmentTitle: title, dueDate: due ? new Date(due + 'T23:59:59').toISOString() : null
                   }
               })));
           }
           window.dcShowToast(useAll ? `${targetClass?.name || data.name} sınıfına eklendi 📋` : `${selectedIds.length} kişiye atandı 📋`, 'success');
           refresh();
       });
       el.querySelectorAll('[data-cp-act]').forEach(btn => btn.addEventListener('click', async () => {
           const id = btn.dataset.id, act = btn.dataset.cpAct;
           if (act === 'undo') {
               await window.FocusSupabase.from('assignment_submissions').delete().eq('assignment_id', id).eq('user_id', getCurrentUser().id);
           } else if (act === 'close') {
               await window.FocusSupabase.from('classroom_assignments').update({ status: 'closed' }).eq('id', id);
           } else if (act === 'delete') {
               const ok = await window.showFocusaiConfirm({
                   title: 'Ödevi Sil', desc: 'Bu ödev ve tüm teslimleri kalıcı olarak silinsin mi?',
                   type: 'danger', icon: 'fa-trash-can', confirmText: 'Sil', cancelText: 'Vazgeç'
               });
               if (!ok) return;
               await window.FocusSupabase.from('classroom_assignments').delete().eq('id', id);
           }
           refresh();
       }));

       // Öğrenci teslim formu: not + opsiyonel dosya/fotoğraf eki
       el.querySelectorAll('.cp-asg-submit-file').forEach(input => input.addEventListener('change', () => {
           const f = input.files?.[0];
           const nameEl = input.closest('.cp-asg-file-label')?.querySelector('.cp-asg-submit-file-name');
           if (f && nameEl) nameEl.innerHTML = `<i class="fa-solid fa-file"></i> ${window._escapeHtml(f.name)}`;
       }));
       el.querySelectorAll('.cp-asg-submit-confirm').forEach(btn => btn.addEventListener('click', async () => {
           const id = btn.dataset.id;
           const form = btn.closest('.cp-asg-submit-body');
           const note = (form.querySelector('.cp-asg-submit-note')?.value || '').trim().slice(0, 200);
           const file = form.querySelector('.cp-asg-submit-file')?.files?.[0];
           btn.disabled = true;
           let attachment = null;
           if (file) {
               if (file.size > 15 * 1024 * 1024) { window.dcShowToast('Dosya boyutu 15MB\'ı geçemez.'); btn.disabled = false; return; }
               const ext = file.name.split('.').pop() || 'bin';
               const path = `assignment-submission/${id}/${getCurrentUser().id}_${Date.now()}.${ext}`;
               const { data: up, error: upErr } = await window.FocusSupabase.storage.from('chat-files').upload(path, file, { upsert: true });
               if (upErr) { window.dcShowToast('Dosya yüklenemedi: ' + upErr.message, 'error'); btn.disabled = false; return; }
               attachment = { name: file.name, size: file.size, type: file.type, bucket_path: up.path };
           }
           const { error } = await window.FocusSupabase.from('assignment_submissions')
               .upsert({ assignment_id: id, user_id: getCurrentUser().id, note: note || null, attachment });
           if (error) { window.dcShowToast('Teslim edilemedi: ' + error.message, 'error'); btn.disabled = false; return; }
           if (typeof window.fireConfetti === 'function') window.fireConfetti();
           window.dcShowToast('Harika iş! Ödev teslim edildi 🎉', 'success');
           refresh();
       }));

       // Çok adımlı ödev / ders planı — öğrenci bir adımı işaretler
       el.querySelectorAll('.cp-asg-step-check').forEach(cb => cb.addEventListener('change', async () => {
           const asgId = cb.dataset.asgId, stepId = cb.dataset.stepId, doneNow = cb.checked;
           cb.disabled = true;
           const { error } = await window.FocusSupabase.from('assignment_step_progress')
               .upsert({ assignment_id: asgId, user_id: getCurrentUser().id, step_id: stepId, done: doneNow, done_at: doneNow ? new Date().toISOString() : null },
                   { onConflict: 'assignment_id,user_id,step_id' });
           if (error) { window.dcShowToast('Kaydedilemedi: ' + error.message, 'error'); cb.checked = !doneNow; cb.disabled = false; return; }
           const allChecked = [...el.querySelectorAll(`.cp-asg-step-check[data-asg-id="${asgId}"]`)].every(c => c.checked);
           if (allChecked && typeof window.fireConfetti === 'function') window.fireConfetti();
           refresh();
       }));
       }
       export function _wireAssignmentFormEvents(el, data, isClassAdmin, ctx, refresh) {
           // Faz Dev-Dosya-Bölme: gövde module-seviye _ctWireAssignmentSetup/_ctWireAssignmentActions'ta.
           const refs = _ctWireAssignmentSetup(el, data, ctx);
           _ctWireAssignmentActions(el, data, ctx, refresh, refs);
       }
