// social-institution-class-modals.js
// social-institution-panel.js'ten çıkarıldı (Faz refactor turu): Sınıf/Şube
// modalları — Yeni Sınıf modalı, Sınıf Detayı modalı (öğrenci listesi/çıkarma),
// Ders Programı modalı (çok adımlı: kaynak seçimi/şablon/builder/grid) ve
// Şube Detayı modalı (rename/sil/öğrenci çıkar/program yönet). Bu grup
// social-institution-panel.js içindeki dev renderClassroomTab() fonksiyonu
// TARAFINDAN çağrılıyor ama kendi içinde tamamen izole (dışarıdan hiçbir
// window-dışı state/fonksiyona ihtiyaç duymuyor) — bu yüzden ayrı dosyaya
// güvenle taşınabildi.
//
// Dış bağımlılıklar (hepsi window.* üzerinden, gerçek import gerektirmiyor):
// window.FocusSupabase, window.dcShowToast, window.showFocusaiConfirm,
// window._escapeHtml, getCurrentUser().
//
// Bu dosyadaki fonksiyonlar social-institution-panel.js'in geri kalanı
// (renderClassroomTab) tarafından gerçek ES `import` ile kullanılıyor.

import { getCurrentUser } from './state/current-user-store.js';
import { generateGroupCode } from './social-misc-pure-utils.js';
export { _cpPatchMemberSection, _cpRosterPatchRowAfterMove, _cpRosterUpdateUnassignedWarning, _cpRosterPatchSectionsPanelAfterMove } from './social-institution-class-modals-roster-patch.js';

       // ─── Sınıflar modalları (Yeni Sınıf / Sınıf Detayı) ──────────────
       // Bu iki modal index.html'de sabit (panel yeniden render olsa da DOM'dan
       // kaybolmuyor) — bu yüzden içindeki butonlara SADECE BİR KEZ event listener
       // bağlanır (dataset.bound guard'ı ile); tıklama anındaki hedef, her açılışta
       // güncellenen paylaşılan bir state objesinden okunur, kapanmış closure'dan değil.
       window._cpNewClassState = window._cpNewClassState || { institutionId: null, onCreated: null };
       window._cpClassDetailState = window._cpClassDetailState || { groupId: null, groupName: null, onChanged: null };

       export function _cpRenderClassDetailMembers(members) {
           const listEl = document.getElementById('cp-classdetail-members');
           if (!listEl) return;
           listEl.innerHTML = members.length
               ? members.map(m => `
                   <div class="cp-inst-class-member-row u-display-flex_align-items-center_justify-content-space-betw-14" data-user-id="${m.userId}" >
                       <span class="u-font-size-12p5px_color-hfff_overflow-hidden_text-overflow-">${window._escapeHtml(m.displayName)}</span>
                       <button class="cp-classdetail-member-remove-btn control-btn secondary u-font-size-11px_padding-3px8px_flex-shrink-0" data-user-id="${m.userId}" data-name="${window._escapeHtml(m.displayName)}" title="Sınıftan çıkar" aria-label="Sınıftan çıkar"><i class="fa-solid fa-user-xmark"></i></button>
                   </div>`).join('')
               : `<p class="cp-hint">Henüz öğrenci yok — yukarıdan ekleyebilirsin.</p>`;
           // Bu liste modal açıkken sık sık yeniden çiziliyor (innerHTML ile) — bu yüzden
           // "Çıkar" butonlarını her seferinde yeniden bağlamak güvenli (eski DOM'la birlikte
           // eski listener'lar da düşer, sızıntı olmaz).
           listEl.querySelectorAll('.cp-classdetail-member-remove-btn').forEach(btn => {
               btn.addEventListener('click', async () => {
                   const userId = btn.dataset.userId;
                   const name = btn.dataset.name;
                   const groupId = window._cpClassDetailState.groupId;
                   const ok = await window.showFocusaiConfirm({
                       title: 'Sınıftan Çıkar',
                       desc: `<b>${window._escapeHtml(name)}</b> sınıftan çıkarılsın mı?`,
                       type: 'danger', icon: 'fa-user-xmark', confirmText: 'Çıkar', cancelText: 'Vazgeç'
                   });
                   if (!ok) return;
                   btn.disabled = true;
                   const { error } = await window.FocusSupabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', userId);
                   if (error) { window.dcShowToast('Çıkarılamadı: ' + error.message, 'error'); btn.disabled = false; return; }
                   window.dcShowToast(`${name} sınıftan çıkarıldı.`, 'success');
                   if (typeof window._cpClassDetailState.onChanged === 'function') window._cpClassDetailState.onChanged();
               });
           });
       }

       export function _cpOpenNewClassModal(institutionId, onCreated) {
           window._cpNewClassState.institutionId = institutionId;
           window._cpNewClassState.onCreated = onCreated;
           const modal = document.getElementById('cp-newclass-modal');
           const nameInput = document.getElementById('cp-newclass-modal-name');
           const statusEl = document.getElementById('cp-newclass-modal-status');
           if (nameInput) nameInput.value = '';
           if (statusEl) statusEl.textContent = '';
           modal?.classList.remove('hidden');
           nameInput?.focus();

           if (modal && !modal.dataset.bound) {
               modal.dataset.bound = '1';
               document.getElementById('cp-newclass-modal-close')?.addEventListener('click', () => modal.classList.add('hidden'));
               document.getElementById('cp-newclass-modal-create-btn')?.addEventListener('click', async () => {
                   const btn = document.getElementById('cp-newclass-modal-create-btn');
                   const nInput = document.getElementById('cp-newclass-modal-name');
                   const sEl = document.getElementById('cp-newclass-modal-status');
                   const className = (nInput?.value || '').trim();
                   const institutionId = window._cpNewClassState.institutionId;
                   if (!className) { if (sEl) sEl.textContent = 'Bir sınıf adı gir.'; return; }
                   if (!institutionId) return;
                   btn.disabled = true;
                   if (sEl) sEl.textContent = 'Oluşturuluyor…';
                   try {
                       let newGroup = null;
                       for (let attempt = 0; attempt < 5; attempt++) {
                           const code = generateGroupCode();
                           const { data: g, error } = await window.FocusSupabase.from('groups').insert({
                               code, name: className, classroom_type: 'classroom', institution_id: institutionId,
                               created_by: getCurrentUser().id,
                           }).select().single();
                           if (!error) { newGroup = g; break; }
                           if (error.code !== '23505') throw error;
                       }
                       if (!newGroup) throw new Error('Sınıf kodu üretilemedi, tekrar dene.');
                       await window.FocusSupabase.from('group_members').insert({ group_id: newGroup.id, user_id: getCurrentUser().id, role: 'admin' });
                       await window.FocusSupabase.from('group_custom_roles').insert([
                           { group_id: newGroup.id, name: 'Öğretmen', color: '00b894', manage_rooms: true, kick_members: true, lock_rooms: true, assign_roles: true, priority: 200 },
                           { group_id: newGroup.id, name: 'Öğrenci', color: '74b9ff', manage_rooms: false, kick_members: false, lock_rooms: false, assign_roles: false, priority: 50 }
                       ]);
                       window.dcShowToast(`"${className}" sınıfı oluşturuldu.`, 'success');
                       modal.classList.add('hidden');
                       // Sidebar'daki kurum klasörü yeni sınıfı hemen göstersin.
                       if (typeof window.loadUserGroupsForDc === 'function') window.loadUserGroupsForDc();
                       if (typeof window._cpNewClassState.onCreated === 'function') window._cpNewClassState.onCreated();
                   } catch (e) {
                       if (sEl) sEl.textContent = 'Oluşturulamadı: ' + e.message;
                   } finally {
                       btn.disabled = false;
                   }
               });
           }
       }

       // ─── Ders Programı modalı — çok adımlı (Planlama > Ders Planı modalıyla aynı desen):
       // Seçim (Yeni Program / Şablon Oluştur / Şablonlarım) → [Yeni Program: sınıf seç →
       // sıfırdan/şablondan] → oluşturucu (7 günlük grid + ekleme formu). Şablonlar
       // schedule_templates + schedule_template_slots tablolarında (103. migration),
       // sınıfa bağlı değil, "owner_id = auth.uid()" ile korunuyor.
       window._cpSchedState = window._cpSchedState || { classes: [], pendingClass: null, target: null, onAdded: null };
       const CP_SCHEDULE_MODAL_DAY_NAMES = ['Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi','Pazar'];
       const CP_SCHED_STEP_IDS = ['choice','classpick','source','templatepick','templatename','templateslist','builder'];

       export function _cpSchedShowStep(name) {
           CP_SCHED_STEP_IDS.forEach(id => {
               document.getElementById(`cp-sched-step-${id}`)?.classList.toggle('hidden', id !== name);
           });
           // Sadece grid (builder) adımında modalı genişlet — diğer adımlar dar/dikey kalsın.
           const contentEl = document.getElementById('cp-schedule-modal-content');
           if (contentEl) {
               // Builder adımında modal sabit bir boyutta kalsın — ders eklendikçe
               // kutunun kendisi büyümesin, sadece içindeki grid kayar (bkz. kullanıcı
               // geri bildirimi: "ders ekledikçe uzamaya devam ediyor").
               if (name === 'builder') { contentEl.style.maxWidth = 'min(1100px, 94vw)'; contentEl.style.width = '94vw'; contentEl.style.height = '88vh'; }
               else { contentEl.style.maxWidth = '460px'; contentEl.style.width = ''; contentEl.style.height = ''; }
           }
           if (name !== 'builder') {
               const titleEl = document.getElementById('cp-schedule-modal-title');
               if (titleEl) titleEl.innerHTML = '<i class="fa-solid fa-calendar-days u-color-h4ecdc4" ></i> Ders Programı';
           }
       }

       // Bir sınıf için bu adminin devam eden taslak programı varsa onu döndürür,
       // yoksa yeni bir taslak program oluşturur. Yayınlanmış program buradan
       // etkilenmez — "Yayınla" denene kadar öğrenciler taslağı göremez.
       // sectionId: bu grubun İÇİNDEKİ şube (group_class_sections.id) ya da '__general__'/null
       // ("Genel" — hiçbir şubeye özel olmayan program). groupId artık her zaman aynı grup
       // (window._cpSchedState.groupId, tek grup modeli) ama birden çok şubenin ayrı ayrı
       // programı olabildiğinden class_section_id ile ayrıştırılır (117).
       export async function _cpSchedGetOrCreateDraftProgram(sectionId) {
           const groupId = window._cpSchedState.groupId;
           const secId = (sectionId && sectionId !== '__general__') ? sectionId : null;
           let q = window.FocusSupabase.from('group_schedule_programs').select('*')
               .eq('group_id', groupId).eq('created_by', getCurrentUser().id).eq('status', 'draft');
           q = secId ? q.eq('class_section_id', secId) : q.is('class_section_id', null);
           const { data: existing } = await q.order('created_at', { ascending: false }).limit(1).maybeSingle();
           if (existing) return existing;
           const { data: created, error } = await window.FocusSupabase
               .from('group_schedule_programs')
               .insert({ group_id: groupId, class_section_id: secId, created_by: getCurrentUser().id, status: 'draft' })
               .select().single();
           if (error) { window.dcShowToast('Taslak oluşturulamadı: ' + error.message, 'error'); return null; }
           return created;
       }

       export async function _cpSchedUpdateTemplatesCount() {
           const el = document.getElementById('cp-sched-templates-count');
           if (!el || !window.FocusSupabase || !getCurrentUser()?.id) return;
           const { count } = await window.FocusSupabase
               .from('schedule_templates').select('id', { count: 'exact', head: true }).eq('owner_id', getCurrentUser().id);
           el.textContent = count || 0;
       }

       export function _cpSchedShowChoice() {
           _cpSchedShowStep('choice');
           _cpSchedUpdateTemplatesCount();
       }

       export function _cpSchedShowClassPick() {
           _cpSchedShowStep('classpick');
           const listEl = document.getElementById('cp-sched-classpick-list');
           if (!listEl) return;
           listEl.innerHTML = window._cpSchedState.classes.map(c => `
               <button type="button" class="glass-panel cp-sched-classpick-card u-padding-12px8px_border-1pxsolidrgba2552552550p07_border-ra" data-id="${c.id}" data-name="${window._escapeHtml(c.name)}" >
                   <i class="fa-solid fa-chalkboard u-color-h4ecdc4_font-size-16px_margin-bottom-4px_display-blo" ></i>
                   <div class="u-font-weight-600_color-hfff_font-size-12px_overflow-hidden_">${window._escapeHtml(c.name)}</div>
               </button>`).join('');
           listEl.querySelectorAll('.cp-sched-classpick-card').forEach(btn => {
               btn.addEventListener('click', () => _cpSchedShowSource({ id: btn.dataset.id, name: btn.dataset.name }));
           });
       }

       export function _cpSchedShowSource(cls) {
           window._cpSchedState.pendingClass = cls;
           const label = document.getElementById('cp-sched-source-label');
           if (label) label.innerHTML = `<b>${window._escapeHtml(cls.name)}</b> için program nasıl hazırlansın?`;
           _cpSchedShowStep('source');
       }

       export async function _cpSchedShowTemplatePickForApply() {
           _cpSchedShowStep('templatepick');
           const listEl = document.getElementById('cp-sched-templatepick-list');
           if (!listEl || !window.FocusSupabase || !getCurrentUser()?.id) return;
           listEl.innerHTML = '<p class="cp-hint">Yükleniyor…</p>';
           const { data: templates } = await window.FocusSupabase
               .from('schedule_templates').select('id, name').eq('owner_id', getCurrentUser().id).order('created_at', { ascending: false });
           if (!templates || !templates.length) {
               listEl.innerHTML = '<p class="cp-hint">Henüz şablonun yok — önce ana ekrandan "Şablon Oluştur" ile bir tane hazırla.</p>';
               return;
           }
           listEl.innerHTML = templates.map(t => `
               <button type="button" class="control-btn secondary cp-sched-template-apply-btn u-width-100pct_justify-content-space-between_font-size-12p5p" data-id="${t.id}" data-name="${window._escapeHtml(t.name)}" >
                   <span><i class="fa-solid fa-copy"></i> ${window._escapeHtml(t.name)}</span> <i class="fa-solid fa-arrow-right"></i>
               </button>`).join('');
           listEl.querySelectorAll('.cp-sched-template-apply-btn').forEach(btn => {
               btn.addEventListener('click', async () => {
                   const cls = window._cpSchedState.pendingClass;
                   if (!cls) return;
                   btn.disabled = true;
                   try {
                       const program = await _cpSchedGetOrCreateDraftProgram(cls.id);
                       if (!program) return;
                       const { data: slots } = await window.FocusSupabase
                           .from('schedule_template_slots').select('day_of_week, time_start, time_end, subject').eq('template_id', btn.dataset.id);
                       if (slots && slots.length) {
                           await window.FocusSupabase.from('group_class_schedule').insert(
                               slots.map(s => ({ program_id: program.id, group_id: window._cpSchedState.groupId, day_of_week: s.day_of_week, time_start: s.time_start, time_end: s.time_end, subject: s.subject, created_by: getCurrentUser().id }))
                           );
                       }
                       window.dcShowToast(`"${btn.dataset.name}" şablonu "${cls.name}" sınıfına taslak olarak uygulandı.`, 'success');
                       _cpSchedShowBuilder({ groupId: window._cpSchedState.groupId, sectionId: cls.id, groupName: cls.name, programId: program.id, programStatus: program.status });
                   } finally {
                       btn.disabled = false;
                   }
               });
           });
       }

       export function _cpSchedShowTemplateNameStep() {
           _cpSchedShowStep('templatename');
           const input = document.getElementById('cp-sched-templatename-input');
           const status = document.getElementById('cp-sched-templatename-status');
           if (input) input.value = '';
           if (status) status.textContent = '';
       }

       export async function _cpSchedShowTemplatesList() {
           _cpSchedShowStep('templateslist');
           const listEl = document.getElementById('cp-sched-templateslist-list');
           if (!listEl || !window.FocusSupabase || !getCurrentUser()?.id) return;
           listEl.innerHTML = '<p class="cp-hint">Yükleniyor…</p>';
           const { data: templates } = await window.FocusSupabase
               .from('schedule_templates').select('id, name').eq('owner_id', getCurrentUser().id).order('created_at', { ascending: false });
           if (!templates || !templates.length) {
               listEl.innerHTML = '<p class="cp-hint">Henüz şablonun yok.</p>';
               return;
           }
           const { data: allSlots } = await window.FocusSupabase
               .from('schedule_template_slots').select('template_id').in('template_id', templates.map(t => t.id));
           const countByTemplate = {};
           (allSlots || []).forEach(s => { countByTemplate[s.template_id] = (countByTemplate[s.template_id] || 0) + 1; });
           listEl.innerHTML = templates.map(t => `
               <div class="cp-asg-card u-display-flex_align-items-center_justify-content-space-betw-15" >
                   <span class="u-font-size-12p5px_overflow-hidden_text-overflow-ellipsis_wh"><i class="fa-solid fa-copy u-color-h4ecdc4" ></i> ${window._escapeHtml(t.name)} <span class="cp-hint">· ${countByTemplate[t.id] || 0} ders</span></span>
                   <div class="u-display-flex_gap-6px_flex-shrink-0">
                       <button class="control-btn secondary cp-sched-tpl-edit-btn u-font-size-11px_padding-4px8px" data-id="${t.id}" data-name="${window._escapeHtml(t.name)}" title="Düzenle" aria-label="Düzenle"><i class="fa-solid fa-pen"></i></button>
                       <button class="control-btn secondary cp-sched-tpl-apply-btn u-font-size-11px_padding-4px8px" data-id="${t.id}" data-name="${window._escapeHtml(t.name)}" title="Bir sınıfa uygula" aria-label="Bir sınıfa uygula"><i class="fa-solid fa-share"></i></button>
                       <button class="control-btn secondary cp-sched-tpl-del-btn u-font-size-11px_padding-4px8px" data-id="${t.id}" data-name="${window._escapeHtml(t.name)}" title="Sil" aria-label="Sil"><i class="fa-solid fa-trash-can"></i></button>
                   </div>
               </div>`).join('');
           listEl.querySelectorAll('.cp-sched-tpl-edit-btn').forEach(btn => {
               btn.addEventListener('click', () => _cpSchedShowBuilder({ templateId: btn.dataset.id, templateName: btn.dataset.name }));
           });
           listEl.querySelectorAll('.cp-sched-tpl-apply-btn').forEach(btn => {
               btn.addEventListener('click', () => {
                   window._cpSchedState.pendingApplyTemplate = { id: btn.dataset.id, name: btn.dataset.name };
                   _cpSchedShowStep('classpick');
                   const listEl2 = document.getElementById('cp-sched-classpick-list');
                   if (!listEl2) return;
                   listEl2.innerHTML = window._cpSchedState.classes.map(c => `
                       <button type="button" class="glass-panel cp-sched-classpick-card u-padding-12px8px_border-1pxsolidrgba2552552550p07_border-ra" data-id="${c.id}" data-name="${window._escapeHtml(c.name)}" >
                           <i class="fa-solid fa-chalkboard u-color-h4ecdc4_font-size-16px_margin-bottom-4px_display-blo" ></i>
                           <div class="u-font-weight-600_color-hfff_font-size-12px_overflow-hidden_">${window._escapeHtml(c.name)}</div>
                       </button>`).join('');
                   listEl2.querySelectorAll('.cp-sched-classpick-card').forEach(cardBtn => {
                       cardBtn.addEventListener('click', async () => {
                           const cls = { id: cardBtn.dataset.id, name: cardBtn.dataset.name };
                           const tpl = window._cpSchedState.pendingApplyTemplate;
                           if (!tpl) return;
                           const program = await _cpSchedGetOrCreateDraftProgram(cls.id);
                           if (!program) return;
                           const { data: slots } = await window.FocusSupabase
                               .from('schedule_template_slots').select('day_of_week, time_start, time_end, subject').eq('template_id', tpl.id);
                           if (slots && slots.length) {
                               await window.FocusSupabase.from('group_class_schedule').insert(
                                   slots.map(s => ({ program_id: program.id, group_id: window._cpSchedState.groupId, day_of_week: s.day_of_week, time_start: s.time_start, time_end: s.time_end, subject: s.subject, created_by: getCurrentUser().id }))
                               );
                           }
                           window.dcShowToast(`"${tpl.name}" şablonu "${cls.name}" sınıfına taslak olarak uygulandı.`, 'success');
                           _cpSchedShowBuilder({ groupId: window._cpSchedState.groupId, sectionId: cls.id, groupName: cls.name, programId: program.id, programStatus: program.status });
                       });
                   });
               });
           });
           listEl.querySelectorAll('.cp-sched-tpl-del-btn').forEach(btn => {
               btn.addEventListener('click', async () => {
                   const ok = await window.showFocusaiConfirm({
                       title: 'Şablonu Sil', desc: `<b>${window._escapeHtml(btn.dataset.name)}</b> şablonunu silmek istediğine emin misin?`,
                       type: 'danger', icon: 'fa-trash-can', confirmText: 'Sil', cancelText: 'Vazgeç'
                   });
                   if (!ok) return;
                   await window.FocusSupabase.from('schedule_templates').delete().eq('id', btn.dataset.id);
                   _cpSchedShowTemplatesList();
               });
           });
       }

       export async function _cpSchedFetchSlots(target) {
           if (!window.FocusSupabase) return [];
           if (target.groupId) {
               if (!target.programId) return [];
               const { data } = await window.FocusSupabase.from('group_class_schedule').select('*').eq('program_id', target.programId);
               return data || [];
           }
           const { data } = await window.FocusSupabase.from('schedule_template_slots').select('*').eq('template_id', target.templateId);
           return data || [];
       }

       export async function _cpSchedRefreshBuilderGrid() {
           const target = window._cpSchedState.target;
           if (!target) return;
           const rows = await _cpSchedFetchSlots(target);
           _cpRenderScheduleModalGrid(rows);
       }

       export function _cpRenderScheduleModalGrid(rows) {
           const gridEl = document.getElementById('cp-schedule-modal-grid');
           if (!gridEl) return;
           const byDay = {};
           rows.forEach(r => { (byDay[r.day_of_week] = byDay[r.day_of_week] || []).push(r); });
           Object.values(byDay).forEach(list => list.sort((a, b) => (a.time_start || '').localeCompare(b.time_start || '')));
           gridEl.innerHTML = CP_SCHEDULE_MODAL_DAY_NAMES.map((dayName, i) => {
               const items = byDay[i] || [];
               return `
               <div class="cp-sched-day-col">
                   <div class="cp-sched-day-head">${dayName}</div>
                   ${items.length ? items.map(r => `
                   <div class="cp-sched-slot" data-id="${r.id}">
                       <div class="cp-sched-slot-time">${(r.time_start || '').slice(0,5)}–${(r.time_end || '').slice(0,5)}</div>
                       <div class="cp-sched-slot-subject">${window._escapeHtml(r.subject)}</div>
                       <span class="cp-sched-slot-actions">
                           <button class="cp-sched-slot-edit cp-schedule-modal-slot-edit" data-id="${r.id}" data-day="${r.day_of_week}" data-start="${(r.time_start||'').slice(0,5)}" data-end="${(r.time_end||'').slice(0,5)}" data-subject="${window._escapeHtml(r.subject)}" title="Düzenle" aria-label="Düzenle"><i class="fa-solid fa-pen"></i></button>
                           <button class="cp-sched-slot-del cp-schedule-modal-slot-del" data-id="${r.id}" title="Sil" aria-label="Sil"><i class="fa-solid fa-xmark"></i></button>
                       </span>
                   </div>`).join('') : `<div class="cp-sched-day-empty">—</div>`}
               </div>`;
           }).join('');
           gridEl.querySelectorAll('.cp-schedule-modal-slot-del').forEach(btn => {
               btn.addEventListener('click', async () => {
                   const target = window._cpSchedState.target;
                   if (!target) return;
                   const table = target.groupId ? 'group_class_schedule' : 'schedule_template_slots';
                   const { error } = await window.FocusSupabase.from(table).delete().eq('id', btn.dataset.id);
                   if (error) { window.dcShowToast('Silinemedi: ' + error.message, 'error'); return; }
                   if (window._cpSchedState.editingId === btn.dataset.id) _cpSchedCancelEdit();
                   await _cpSchedRefreshBuilderGrid();
               });
           });
           gridEl.querySelectorAll('.cp-schedule-modal-slot-edit').forEach(btn => {
               btn.addEventListener('click', () => {
                   window._cpSchedState.editingId = btn.dataset.id;
                   const dayInput = document.getElementById('cp-schedule-modal-day');
                   const startInput = document.getElementById('cp-schedule-modal-start');
                   const endInput = document.getElementById('cp-schedule-modal-end');
                   const sInput = document.getElementById('cp-schedule-modal-subject');
                   if (dayInput) dayInput.value = btn.dataset.day;
                   if (startInput) startInput.value = btn.dataset.start;
                   if (endInput) endInput.value = btn.dataset.end;
                   if (sInput) sInput.value = btn.dataset.subject;
                   const addBtn = document.getElementById('cp-schedule-modal-add-btn');
                   if (addBtn) { addBtn.innerHTML = '<i class="fa-solid fa-check"></i>'; addBtn.title = 'Güncelle'; }
                   sInput?.focus();
               });
           });
       }

       export function _cpSchedCancelEdit() {
           window._cpSchedState.editingId = null;
           const addBtn = document.getElementById('cp-schedule-modal-add-btn');
           if (addBtn) { addBtn.innerHTML = '<i class="fa-solid fa-plus"></i>'; addBtn.title = 'Ekle'; }
       }

       export function _cpSchedShowBuilder(target) {
           window._cpSchedState.target = target;
           _cpSchedCancelEdit();
           _cpSchedShowStep('builder');
           // Sınıf adı + durum rozeti artık ayrı bir satır yerine modal başlığında —
           // dikey yer kazanıp takvime daha fazla alan bırakıyor (bkz. kullanıcı geri bildirimi).
           const titleEl = document.getElementById('cp-schedule-modal-title');
           if (titleEl) {
               if (target.groupId) {
                   const badge = target.programStatus === 'published'
                       ? `<span class="u-font-size-10p5px_font-weight-600_padding-2px8px_border-rad"><i class="fa-solid fa-circle-check"></i> Yayında</span>`
                       : `<span class="u-font-size-10p5px_font-weight-600_padding-2px8px_border-rad-2"><i class="fa-solid fa-pen"></i> Taslak</span>`;
                   titleEl.innerHTML = `<i class="fa-solid fa-chalkboard u-color-h4ecdc4" ></i> ${window._escapeHtml(target.groupName)} — Ders Programı ${badge}`;
               } else {
                   titleEl.innerHTML = `<i class="fa-solid fa-copy u-color-h4ecdc4" ></i> ${window._escapeHtml(target.templateName)} — Şablon`;
               }
           }
           const publishBtn = document.getElementById('cp-sched-publish-btn');
           if (publishBtn) publishBtn.classList.toggle('hidden', !target.groupId);
           const subjectInput = document.getElementById('cp-schedule-modal-subject');
           const statusEl = document.getElementById('cp-schedule-modal-status');
           const dayInput = document.getElementById('cp-schedule-modal-day');
           const startInput = document.getElementById('cp-schedule-modal-start');
           const endInput = document.getElementById('cp-schedule-modal-end');
           if (subjectInput) subjectInput.value = '';
           if (statusEl) { statusEl.textContent = ''; statusEl.style.color = ''; }
           if (dayInput) dayInput.value = '0';
           if (startInput) startInput.value = '08:00';
           if (endInput) endInput.value = '09:00';
           _cpSchedRefreshBuilderGrid();
       }

       // Bir sınıfın YAYINLANMIŞ programını salt-okunur gösterir — kart listesinden
       // tıklanınca açılır, düzenleme burada yapılmaz (bkz. renderClassroomTab, kart tıklama).
       export async function _cpOpenScheduleViewModal(groupId, groupName, programId) {
           const modal = document.getElementById('cp-schedule-view-modal');
           const titleEl = document.getElementById('cp-schedule-view-modal-title');
           const gridEl = document.getElementById('cp-schedule-view-modal-grid');
           if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-calendar-days u-color-h4ecdc4" ></i> ${window._escapeHtml(groupName)} — Ders Programı`;
           if (gridEl) gridEl.innerHTML = '<p class="cp-hint">Yükleniyor…</p>';
           modal?.classList.remove('hidden');
           if (modal && !modal.dataset.bound) {
               modal.dataset.bound = '1';
               document.getElementById('cp-schedule-view-modal-close')?.addEventListener('click', () => modal.classList.add('hidden'));
           }
           const { data: rows } = await window.FocusSupabase
               .from('group_class_schedule').select('*').eq('program_id', programId)
               .order('day_of_week', { ascending: true }).order('time_start', { ascending: true });
           if (!gridEl) return;
           const byDay = {};
           (rows || []).forEach(r => { (byDay[r.day_of_week] = byDay[r.day_of_week] || []).push(r); });
           gridEl.innerHTML = CP_SCHEDULE_MODAL_DAY_NAMES.map((dayName, i) => {
               const items = byDay[i] || [];
               return `
               <div class="cp-sched-day-col">
                   <div class="cp-sched-day-head">${dayName}</div>
                   ${items.length ? items.map(r => `
                   <div class="cp-sched-slot">
                       <div class="cp-sched-slot-time">${(r.time_start || '').slice(0,5)}–${(r.time_end || '').slice(0,5)}</div>
                       <div class="cp-sched-slot-subject">${window._escapeHtml(r.subject)}${r.location ? ` <span class="cp-sched-slot-loc">· ${window._escapeHtml(r.location)}</span>` : ''}</div>
                   </div>`).join('') : `<div class="cp-sched-day-empty">—</div>`}
               </div>`;
           }).join('');
       }

       // _cpOpenScheduleModal'ın tek-seferlik olay bağlama katmanı — modal DOM'a zaten
       // eklenmiş olmalı. Faz S devamı, dev fonksiyon refactoru.
       function _cpWireScheduleModalEvents(modal) {
               // Ders eklerken/silerken alttaki Sınıf Paneli'ni her seferinde tam yeniden
               // render etmek (renderClassroomTab) sayfa yenileniyormuş gibi göz kırpıyordu
               // (bkz. kullanıcı geri bildirimi) — bu yüzden panel, modal içindeki her
               // aksiyonda değil, sadece modal tamamen kapanınca bir kez tazeleniyor.
               document.getElementById('cp-schedule-modal-close')?.addEventListener('click', () => {
                   modal.classList.add('hidden');
                   if (typeof window._cpSchedState.onAdded === 'function') window._cpSchedState.onAdded();
               });
               document.querySelectorAll('.cp-sched-step-back').forEach(btn => {
                   btn.addEventListener('click', () => {
                       const back = btn.dataset.back;
                       if (back === 'choice') _cpSchedShowChoice();
                       else if (back === 'classpick') _cpSchedShowClassPick();
                       else if (back === 'source') _cpSchedShowSource(window._cpSchedState.pendingClass);
                   });
               });
               document.getElementById('cp-sched-builder-back')?.addEventListener('click', () => _cpSchedShowChoice());
               document.getElementById('cp-sched-choice-new')?.addEventListener('click', () => {
                   if (!window._cpSchedState.classes.length) {
                       window.dcShowToast('Önce Sınıflar/Öğrenciler > Şubeler sekmesinden bir şube oluştur.', 'info');
                       return;
                   }
                   if (window._cpSchedState.classes.length === 1) _cpSchedShowSource(window._cpSchedState.classes[0]);
                   else _cpSchedShowClassPick();
               });
               document.getElementById('cp-sched-choice-template')?.addEventListener('click', () => _cpSchedShowTemplateNameStep());
               document.getElementById('cp-sched-browse-templates')?.addEventListener('click', () => _cpSchedShowTemplatesList());
               document.getElementById('cp-sched-source-scratch')?.addEventListener('click', async () => {
                   const cls = window._cpSchedState.pendingClass;
                   if (!cls) return;
                   const program = await _cpSchedGetOrCreateDraftProgram(cls.id);
                   if (!program) return;
                   _cpSchedShowBuilder({ groupId: window._cpSchedState.groupId, sectionId: cls.id, groupName: cls.name, programId: program.id, programStatus: program.status });
               });
               document.getElementById('cp-sched-source-template')?.addEventListener('click', () => _cpSchedShowTemplatePickForApply());
               document.getElementById('cp-sched-templatename-create-btn')?.addEventListener('click', async () => {
                   const btn = document.getElementById('cp-sched-templatename-create-btn');
                   const input = document.getElementById('cp-sched-templatename-input');
                   const status = document.getElementById('cp-sched-templatename-status');
                   const name = (input?.value || '').trim();
                   if (!name) { if (status) status.textContent = 'Bir şablon adı gir.'; return; }
                   btn.disabled = true;
                   try {
                       const { data: tpl, error } = await window.FocusSupabase
                           .from('schedule_templates').insert({ owner_id: getCurrentUser().id, name }).select().single();
                       if (error) { if (status) status.textContent = 'Oluşturulamadı: ' + error.message; return; }
                       _cpSchedShowBuilder({ templateId: tpl.id, templateName: tpl.name });
                   } finally {
                       btn.disabled = false;
                   }
               });
               // Gün değişince saat aralığı 08:00–09:00'a sıfırlanır — bir önceki günün
               // saatleri yeni güne taşınmasın.
               document.getElementById('cp-schedule-modal-day')?.addEventListener('change', () => {
                   const startInput = document.getElementById('cp-schedule-modal-start');
                   const endInput = document.getElementById('cp-schedule-modal-end');
                   if (startInput) startInput.value = '08:00';
                   if (endInput) endInput.value = '09:00';
               });
               document.getElementById('cp-schedule-modal-add-btn')?.addEventListener('click', async () => {
                   const btn = document.getElementById('cp-schedule-modal-add-btn');
                   const target = window._cpSchedState.target;
                   if (!target) return;
                   const day = parseInt(document.getElementById('cp-schedule-modal-day')?.value, 10);
                   const startInput = document.getElementById('cp-schedule-modal-start');
                   const endInput = document.getElementById('cp-schedule-modal-end');
                   const start = startInput?.value;
                   const end = endInput?.value;
                   const sInput = document.getElementById('cp-schedule-modal-subject');
                   const subject = (sInput?.value || '').trim();
                   const sEl = document.getElementById('cp-schedule-modal-status');
                   if (sEl) sEl.style.color = '';
                   if (!subject) { if (sEl) sEl.textContent = 'Ders adı gir.'; return; }
                   if (!start || !end || start >= end) { if (sEl) sEl.textContent = 'Geçerli bir saat aralığı gir.'; return; }
                   btn.disabled = true;
                   try {
                       const existing = await _cpSchedFetchSlots(target);
                       const overlaps = existing.filter(r => r.day_of_week === day && String(r.id) !== String(window._cpSchedState.editingId || '')).some(r =>
                           start < (r.time_end || '').slice(0,5) && end > (r.time_start || '').slice(0,5));
                       if (overlaps) {
                           if (sEl) { sEl.textContent = 'Bu saat aralığı mevcut bir dersle çakışıyor.'; sEl.style.color = '#ff6b6b'; }
                           window.dcShowToast('Bu saat aralığı mevcut bir dersle çakışıyor.', 'error');
                           return;
                       }
                       const table = target.groupId ? 'group_class_schedule' : 'schedule_template_slots';
                       const editingId = window._cpSchedState.editingId;
                       let error;
                       if (editingId) {
                           ({ error } = await window.FocusSupabase.from(table)
                               .update({ day_of_week: day, time_start: start, time_end: end, subject })
                               .eq('id', editingId));
                       } else {
                           const row = target.groupId
                               ? { program_id: target.programId, group_id: target.groupId, day_of_week: day, time_start: start, time_end: end, subject, created_by: getCurrentUser().id }
                               : { template_id: target.templateId, day_of_week: day, time_start: start, time_end: end, subject };
                           ({ error } = await window.FocusSupabase.from(table).insert(row));
                       }
                       if (error) { if (sEl) { sEl.textContent = (editingId ? 'Güncellenemedi: ' : 'Eklenemedi: ') + error.message; sEl.style.color = '#ff6b6b'; } return; }
                       if (sEl) sEl.textContent = '';
                       if (sInput) sInput.value = '';
                       const wasEditing = !!editingId;
                       if (wasEditing) _cpSchedCancelEdit();
                       // Bir sonraki dersi hızlı girebilsin diye saat aralığını otomatik 1 saat ileri kaydır.
                       if (!wasEditing && startInput && endInput) {
                           const [eh, em] = end.split(':').map(Number);
                           const newEndMinutes = eh * 60 + em + 60;
                           startInput.value = end;
                           endInput.value = `${String(Math.floor(newEndMinutes / 60) % 24).padStart(2,'0')}:${String(newEndMinutes % 60).padStart(2,'0')}`;
                       }
                       await _cpSchedRefreshBuilderGrid();
                   } finally {
                       btn.disabled = false;
                   }
               });

               // Yayınla: bu programı 'published' yapar, sınıfın varsa önceki yayındaki
               // programını arşivler — böylece her sınıfın her an tek bir aktif programı olur.
               document.getElementById('cp-sched-publish-btn')?.addEventListener('click', async () => {
                   const publishBtn = document.getElementById('cp-sched-publish-btn');
                   const target = window._cpSchedState.target;
                   if (!target || !target.groupId || !target.programId) return;
                   const rows = await _cpSchedFetchSlots(target);
                   if (!rows.length) { window.dcShowToast('Yayınlamadan önce en az bir ders ekle.', 'error'); return; }
                   publishBtn.disabled = true;
                   try {
                       // Sadece AYNI şubenin (class_section_id) önceki yayınını arşivle — artık
                       // aynı grupta birden çok şube olabildiğinden, filtre olmadan başka bir
                       // şubenin hâlâ geçerli yayınını yanlışlıkla arşivlerdi (117).
                       const secId = (target.sectionId && target.sectionId !== '__general__') ? target.sectionId : null;
                       let archiveQ = window.FocusSupabase.from('group_schedule_programs')
                           .update({ status: 'archived' })
                           .eq('group_id', target.groupId).eq('status', 'published');
                       archiveQ = secId ? archiveQ.eq('class_section_id', secId) : archiveQ.is('class_section_id', null);
                       await archiveQ;
                       const { error } = await window.FocusSupabase.from('group_schedule_programs')
                           .update({ status: 'published', published_at: new Date().toISOString() })
                           .eq('id', target.programId);
                       if (error) { window.dcShowToast('Yayınlanamadı: ' + error.message, 'error'); return; }
                       window.dcShowToast(`"${target.groupName}" sınıfının ders programı yayınlandı! 🎉`, 'success');
                       document.getElementById('cp-schedule-modal')?.classList.add('hidden');
                       if (typeof window._cpSchedState.onAdded === 'function') window._cpSchedState.onAdded();
                   } finally {
                       publishBtn.disabled = false;
                   }
               });
       }

       export function _cpOpenScheduleModal(classes, subjectOptions, onAdded, groupId) {
           window._cpSchedState.classes = classes || [];
           window._cpSchedState.onAdded = onAdded;
           window._cpSchedState.groupId = groupId;
           window._cpSchedState.pendingClass = null;
           window._cpSchedState.target = null;
           const modal = document.getElementById('cp-schedule-modal');
           const datalistEl = document.getElementById('cp-schedule-modal-subject-list');
           if (datalistEl) datalistEl.innerHTML = (subjectOptions || []).map(s => `<option value="${window._escapeHtml(s)}">`).join('');
           modal?.classList.remove('hidden');
           _cpSchedShowChoice();

           if (modal && !modal.dataset.bound) {
               modal.dataset.bound = '1';
               _cpWireScheduleModalEvents(modal);
           }
       }

       export function _cpOpenClassDetailModal(groupId, groupCode, groupName, members, onChanged) {
           window._cpClassDetailState.groupId = groupId;
           window._cpClassDetailState.groupCode = groupCode;
           window._cpClassDetailState.groupName = groupName;
           window._cpClassDetailState.onChanged = onChanged;
           const modal = document.getElementById('cp-classdetail-modal');
           const titleEl = document.getElementById('cp-classdetail-modal-title');
           const statusEl = document.getElementById('cp-classdetail-add-status');
           const uInput = document.getElementById('cp-classdetail-add-username');
           if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-chalkboard-user u-color-h4ecdc4" ></i> ${window._escapeHtml(groupName)}`;
           if (statusEl) statusEl.textContent = '';
           if (uInput) uInput.value = '';
           _cpRenderClassDetailMembers(members);
           modal?.classList.remove('hidden');

           if (modal && !modal.dataset.bound) {
               modal.dataset.bound = '1';
               document.getElementById('cp-classdetail-modal-close')?.addEventListener('click', () => modal.classList.add('hidden'));
               document.getElementById('cp-classdetail-add-btn')?.addEventListener('click', async () => {
                   const btn = document.getElementById('cp-classdetail-add-btn');
                   const nInput = document.getElementById('cp-classdetail-add-username');
                   const sEl = document.getElementById('cp-classdetail-add-status');
                   const username = (nInput?.value || '').trim().replace(/^@/, '');
                   if (!username) { if (sEl) sEl.textContent = 'Bir kullanıcı adı yaz.'; return; }
                   const targetGroupId = window._cpClassDetailState.groupId;
                   if (!targetGroupId) return;
                   btn.disabled = true;
                   if (sEl) sEl.textContent = 'Aranıyor…';
                   try {
                       const { data: target, error: sErr } = await window.FocusSupabase
                           .from('profiles').select('id, username, display_name').ilike('username', username).maybeSingle();
                       if (sErr) throw sErr;
                       if (!target) { if (sEl) sEl.textContent = 'Bu kullanıcı adıyla kimse bulunamadı.'; return; }
                       // add_or_move_student_to_class (115): aynı kurumdaki başka bir sınıftaysa
                       // oradan otomatik çıkarılıp buraya taşınır (bir öğrenci tek sınıfta olur).
                       const { error: mErr } = await window.FocusSupabase.rpc('add_or_move_student_to_class', {
                           p_group_id: targetGroupId, p_user_id: target.id,
                       });
                       if (mErr) {
                           if (mErr.code === '23505') { if (sEl) sEl.textContent = `@${target.username} zaten bu sınıfta.`; }
                           else { if (sEl) sEl.textContent = 'Eklenemedi: ' + mErr.message; }
                           return;
                       }
                       window.dcShowToast(`@${target.username} eklendi.`, 'success');
                       if (nInput) nInput.value = '';
                       if (sEl) sEl.textContent = '';
                       if (typeof window._cpClassDetailState.onChanged === 'function') window._cpClassDetailState.onChanged();
                   } catch (e) {
                       if (sEl) sEl.textContent = 'Eklenemedi: ' + e.message;
                   } finally {
                       btn.disabled = false;
                   }
               });
           }
       }

       // Şube detay modalı (Sınıflar/Öğrenciler > Şubeler kartına tıklayınca açılır) —
       // şube adını değiştirme/silme, şubedeki öğrencileri görüp şubeden çıkarma ve
       // şubenin ders programını görüntüleme/düzenleme/oluşturma tek yerden yapılır.
       // group_class_sections güncellemesi Supabase'e yazıldıktan sonra ekrandaki grup
       // önbelleğini (data.members, showGroupDetails tarafından doldurulan _normalizeSupabaseGroup
       // çıktısı) de aynı anda güncelliyoruz — aksi halde refresh() aynı `data` referansını tekrar
       // render ederken hâlâ eski class_section_id'yi görür ve değişiklik ancak sayfa
       // yenilenip grup verisi Supabase'ten yeniden çekilince görünür olurdu.
       export function _cpRenderSectionDetailModal() {
           const st = window._cpSectionDetailState;
           if (!st) return;
           const titleEl = document.getElementById('cp-section-detail-modal-title');
           if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-chalkboard u-color-h4ecdc4" ></i> ${window._escapeHtml(st.sectionName)}`;
           const countEl = document.getElementById('cp-section-detail-student-count');
           if (countEl) countEl.textContent = `(${(st.students || []).length})`;
           const studentsEl = document.getElementById('cp-section-detail-students');
           if (studentsEl) {
               studentsEl.innerHTML = (st.students && st.students.length) ? st.students.map(m => `
                   <div class="cp-roster-row">
                       <span class="cp-roster-row-name">${window._escapeHtml(m.displayName)}</span>
                       <button type="button" class="cp-section-detail-unassign-btn cp-roster-iconbtn" data-user-id="${m.userId}" data-name="${window._escapeHtml(m.displayName)}" title="Şubeden çıkar" aria-label="Şubeden çıkar"><i class="fa-solid fa-right-from-bracket"></i></button>
                   </div>`).join('') : `<p class="cp-hint u-margin-0" >Bu şubede henüz ${st.memberLabel.toLowerCase()} yok.</p>`;
           }
           const schedEl = document.getElementById('cp-section-detail-schedule');
           if (schedEl) {
               const info = st.scheduleInfo;
               if (info && info.hasPublished) {
                   schedEl.innerHTML = `
                   <div class="u-display-flex_align-items-center_justify-content-space-betw-4">
                       <span class="u-font-size-12p5px_font-weight-600_color-h2ecc71"><i class="fa-solid fa-circle-check"></i> Yayında</span>
                       <span class="u-display-flex_gap-6px">
                           <button type="button" class="cp-section-detail-sched-view cp-roster-pillbtn" data-program-id="${info.program.id}">Görüntüle</button>
                           <button type="button" class="cp-section-detail-sched-del cp-roster-iconbtn cp-roster-iconbtn--danger" data-program-id="${info.program.id}" title="Sil" aria-label="Sil"><i class="fa-solid fa-trash-can"></i></button>
                       </span>
                   </div>`;
               } else if (info && info.draftProgram) {
                   schedEl.innerHTML = `
                   <div class="u-display-flex_align-items-center_justify-content-space-betw-4">
                       <span class="u-font-size-12p5px_font-weight-600_color-hffc107"><i class="fa-solid fa-pen"></i> Taslak</span>
                       <span class="u-display-flex_gap-6px">
                           <button type="button" class="cp-section-detail-sched-edit cp-roster-pillbtn" data-program-id="${info.draftProgram.id}">Devam Et</button>
                           <button type="button" class="cp-section-detail-sched-del cp-roster-iconbtn cp-roster-iconbtn--danger" data-program-id="${info.draftProgram.id}" title="Sil" aria-label="Sil"><i class="fa-solid fa-trash-can"></i></button>
                       </span>
                   </div>`;
               } else {
                   schedEl.innerHTML = `<button type="button" class="cp-section-detail-sched-create cp-roster-pillbtn cp-roster-pillbtn--accent"><i class="fa-solid fa-plus"></i> Ders Programı Oluştur</button>`;
               }
           }
       }
       export function _cpOpenSectionDetailModal(opts) {
           // opts: { groupId, sectionId, sectionName, memberLabel, students, scheduleInfo,
           //         subjectOptions, buildClassChoices, onChanged }
           window._cpSectionDetailState = { ...opts, dirty: false };
           const modal = document.getElementById('cp-section-detail-modal');
           document.getElementById('cp-section-detail-rename-row')?.classList.add('hidden');
           const renameStatus = document.getElementById('cp-section-detail-rename-status');
           if (renameStatus) renameStatus.textContent = '';
           _cpRenderSectionDetailModal();
           modal?.classList.remove('hidden');
           if (modal && !modal.dataset.bound) {
               modal.dataset.bound = '1';
               // Modalı sadece kapatmak (hiçbir değişiklik yapılmadan) ağır bir yeniden-yükleme
               // tetiklememeli — arka plandaki panel yalnızca modal içinde gerçek bir değişiklik
               // (rename/sil/şubeden çıkar/program sil) olduysa bir kez tazelenir.
               document.getElementById('cp-section-detail-modal-close')?.addEventListener('click', () => {
                   modal.classList.add('hidden');
                   const st = window._cpSectionDetailState;
                   if (st?.dirty && typeof st.onChanged === 'function') st.onChanged();
               });
               // Yeniden adlandırma artık native window.prompt() yerine, "Yeni şube adı" ekleme
               // kutusuyla aynı görsel dilde satır-içi bir giriş kutusuyla yapılır.
               document.getElementById('cp-section-detail-rename-btn')?.addEventListener('click', () => {
                   const st = window._cpSectionDetailState;
                   if (!st) return;
                   const row = document.getElementById('cp-section-detail-rename-row');
                   const input = document.getElementById('cp-section-detail-rename-input');
                   if (input) input.value = st.sectionName;
                   row?.classList.remove('hidden');
                   input?.focus();
                   input?.select();
               });
               const cancelRename = () => {
                   document.getElementById('cp-section-detail-rename-row')?.classList.add('hidden');
                   if (renameStatus) renameStatus.textContent = '';
               };
               document.getElementById('cp-section-detail-rename-cancel')?.addEventListener('click', cancelRename);
               const saveRename = async () => {
                   const st = window._cpSectionDetailState;
                   if (!st) return;
                   const input = document.getElementById('cp-section-detail-rename-input');
                   const newName = (input?.value || '').trim();
                   if (!newName) { if (renameStatus) renameStatus.textContent = 'Bir şube adı yaz.'; return; }
                   if (newName === st.sectionName) { cancelRename(); return; }
                   const { error } = await window.FocusSupabase.from('group_class_sections').update({ name: newName }).eq('id', st.sectionId);
                   if (error) { if (renameStatus) renameStatus.textContent = error.code === '23505' ? `"${newName}" adında bir şube zaten var.` : 'Yeniden adlandırılamadı: ' + error.message; return; }
                   st.sectionName = newName;
                   st.dirty = true;
                   window.dcShowToast('Şube adı güncellendi.', 'success');
                   cancelRename();
                   _cpRenderSectionDetailModal();
               };
               document.getElementById('cp-section-detail-rename-save')?.addEventListener('click', saveRename);
               document.getElementById('cp-section-detail-rename-input')?.addEventListener('keydown', (e) => {
                   if (e.key === 'Enter') saveRename();
                   else if (e.key === 'Escape') cancelRename();
               });
               document.getElementById('cp-section-detail-delete-btn')?.addEventListener('click', async () => {
                   const st = window._cpSectionDetailState;
                   if (!st) return;
                   const count = (st.students || []).length;
                   const ok = await window.showFocusaiConfirm({
                       title: 'Şubeyi Sil',
                       desc: `<b>${window._escapeHtml(st.sectionName)}</b> şubesini silmek istediğine emin misin?${count ? ` Bu şubedeki ${count} ${st.memberLabel.toLowerCase()} "Sınıfsız" duruma düşecek.` : ''}`,
                       type: 'danger', icon: 'fa-trash-can', confirmText: 'Sil', cancelText: 'Vazgeç'
                   });
                   if (!ok) return;
                   const { error } = await window.FocusSupabase.from('group_class_sections').delete().eq('id', st.sectionId);
                   if (error) { window.dcShowToast('Silinemedi: ' + error.message, 'error'); return; }
                   window.dcShowToast(`"${st.sectionName}" şubesi silindi.`, 'success');
                   document.getElementById('cp-section-detail-modal')?.classList.add('hidden');
                   if (typeof st.onChanged === 'function') st.onChanged();
               });
               document.getElementById('cp-section-detail-students')?.addEventListener('click', async (e) => {
                   const btn = e.target.closest('.cp-section-detail-unassign-btn');
                   if (!btn) return;
                   const st = window._cpSectionDetailState;
                   if (!st) return;
                   const userId = btn.dataset.userId;
                   const name = btn.dataset.name;
                   const ok = await window.showFocusaiConfirm({
                       title: 'Şubeden Çıkar',
                       desc: `<b>${window._escapeHtml(name)}</b> "${window._escapeHtml(st.sectionName)}" şubesinden çıkarılsın mı? ${st.memberLabel === 'Çalışan' ? 'Ekipten' : 'Gruptan'} çıkarılmaz, sadece "Sınıfsız" duruma düşer.`,
                       type: 'danger', icon: 'fa-right-from-bracket', confirmText: 'Çıkar', cancelText: 'Vazgeç'
                   });
                   if (!ok) return;
                   btn.disabled = true;
                   const { data: updRows, error } = await window.FocusSupabase.from('group_members').update({ class_section_id: null }).eq('group_id', st.groupId).eq('user_id', userId).select('user_id');
                   if (error || !updRows || updRows.length === 0) { window.dcShowToast('Güncellenemedi' + (error ? ': ' + error.message : ' — yetki (RLS) reddetti, 124/125 migration canlıda uygulanmamış olabilir.'), 'error'); btn.disabled = false; return; }
                   _cpPatchMemberSection(st.groupData, userId, null);
                   window.dcShowToast(`${name} şubeden çıkarıldı.`, 'success');
                   st.students = (st.students || []).filter(m => m.userId !== userId);
                   st.dirty = true;
                   _cpRenderSectionDetailModal();
               });
               document.getElementById('cp-section-detail-schedule')?.addEventListener('click', async (e) => {
                   const st = window._cpSectionDetailState;
                   if (!st) return;
                   const viewBtn = e.target.closest('.cp-section-detail-sched-view');
                   const editBtn = e.target.closest('.cp-section-detail-sched-edit');
                   const createBtn = e.target.closest('.cp-section-detail-sched-create');
                   const delBtn = e.target.closest('.cp-section-detail-sched-del');
                   if (viewBtn) {
                       _cpOpenScheduleViewModal(st.groupId, st.sectionName, viewBtn.dataset.programId);
                   } else if (editBtn) {
                       st.dirty = true;
                       _cpOpenScheduleModal(st.buildClassChoices(), st.subjectOptions, st.onChanged, st.groupId);
                       _cpSchedShowBuilder({ groupId: st.groupId, sectionId: st.sectionId, groupName: st.sectionName, programId: editBtn.dataset.programId, programStatus: 'draft' });
                   } else if (createBtn) {
                       st.dirty = true;
                       _cpOpenScheduleModal(st.buildClassChoices(), st.subjectOptions, st.onChanged, st.groupId);
                       _cpSchedShowSource({ id: st.sectionId, name: st.sectionName });
                   } else if (delBtn) {
                       const programId = delBtn.dataset.programId;
                       if (!programId) return;
                       const ok = await window.showFocusaiConfirm({
                           title: 'Ders Programını Sil',
                           desc: `"${window._escapeHtml(st.sectionName)}" için ders programı (tüm dersleriyle birlikte) kalıcı olarak silinsin mi? Bu işlem geri alınamaz.`,
                           type: 'danger', icon: 'fa-trash-can', confirmText: 'Sil', cancelText: 'Vazgeç',
                       });
                       if (!ok) return;
                       delBtn.disabled = true;
                       await window.FocusSupabase.from('group_class_schedule').delete().eq('program_id', programId);
                       await window.FocusSupabase.from('group_schedule_programs').delete().eq('id', programId);
                       window.dcShowToast?.('Ders programı silindi.', 'success');
                       st.scheduleInfo = null;
                       st.dirty = true;
                       _cpRenderSectionDetailModal();
                   }
               });
           }
       }
