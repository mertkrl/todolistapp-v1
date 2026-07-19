// ============================================================
// FOCUSAI SCRIPT-MILESTONE-GOAL-ACTIONS.JS
// script.js'ten çıkarılmış: "Aşama (Milestone) Aksiyon Fonksiyonları" bölümü.
// Hedef detay drawer'ında dönüm noktası (milestone) düzenleme/silme,
// "Görev Ekle" ve "Dönüm Noktası Ekle" modallarının açılması/kaydedilmesi
// mantığını içerir (window.editMilestone, window.deleteMilestone ve
// #detail-add-task-btn / #detail-add-milestone-btn olay dinleyicileri).
// script.js'in window'a koyduğu ince sarmalayıcıları (__getGoalsRef,
// Store, showPremiumModal, hasTimeConflict, addGlobalTask,
// updateGoalDetailsUI, renderGoals, renderTasks, checkGoalDateBoundaries,
// renderCalendarRef, renderEventsRef, toInputDate, timeToMins) kullanır.
// script.js'ten SONRA, orijinal DOMContentLoaded zamanlamasını korumak
// için kendi DOMContentLoaded sarmalayıcısında yüklenir.
// ============================================================
(function () {
'use strict';
document.addEventListener('DOMContentLoaded', () => {

     // --- Aşama (Milestone) Aksiyon Fonksiyonları ---

 
     window.editMilestone = function(goalId, milestoneId) {
         const goals = window.__getGoalsRef();
         const goal = goals.find(g => String(g.id) === String(goalId));
         if (!goal || !goal.milestones) return;
         const ms = goal.milestones.find(m => String(m.id) === String(milestoneId));
         if (!ms) return;
 
         // Mevcut ms-text span'ini bul ve input'a çevir
         const allItems = document.querySelectorAll('#detail-milestone-list .detail-milestone-item');
         let targetItem = null;
         allItems.forEach(item => {
             if (item.innerHTML.includes(`'${milestoneId}'`)) targetItem = item;
         });
         if (!targetItem) return;
 
         const msTextEl = targetItem.querySelector('.ms-text');
         const msMetaEl = targetItem.querySelector('.ms-meta');
         if (!msTextEl) return;
 
         // Zaten düzenleme modundaysa çık
         if (targetItem.querySelector('.ms-edit-input')) return;
 
         const currentText = ms.text;
         const currentDate = ms.date || '';
 
         msTextEl.style.display = 'none';
         msMetaEl.style.display = 'none';
 
         const editWrapper = document.createElement('div');
         editWrapper.style.cssText = 'display:flex; flex-direction:column; gap:6px; width:100%;';
         editWrapper.innerHTML = `
             <input class="ms-edit-input premium-input" type="text" value="${escapeHtml(currentText)}" style="font-size:13px; padding:6px 10px; width:100%; box-sizing:border-box;">
             <div style="display:flex; gap:6px; align-items:center;">
                 <input class=\"ms-edit-date premium-input\" type=\"date\" value=\"${currentDate}\" ${goal.createdAt ? `min="${new Date(goal.createdAt).toISOString().split('T')[0]}"` : ''} ${goal.deadline ? `max="${goal.deadline.split('-')[0].length===4 ? goal.deadline : goal.deadline.split('-').reverse().join('-')}"` : ''} style=\"font-size:12px; padding:5px 8px; flex:1; color:#fff; cursor:pointer;\">
                 <button class="ms-edit-save primary-btn" style="padding:5px 12px; font-size:12px; background:rgba(9,132,227,0.2); border-color:rgba(9,132,227,0.4); color:#74b9ff; white-space:nowrap;"><i class="fa-solid fa-check"></i> Kaydet</button>
                 <button class="ms-edit-cancel ms-delete-btn" style="opacity:1; width:auto; padding:5px 10px; font-size:12px;"><i class="fa-solid fa-xmark"></i></button>
             </div>
         `;
 
         msTextEl.parentNode.insertBefore(editWrapper, msTextEl);
 
         const saveEdit = () => {
            const newText = editWrapper.querySelector('.ms-edit-input').value.trim();
            const newDate = editWrapper.querySelector('.ms-edit-date').value; // YYYY-MM-DD
            if (!newText) return;
            
            // --- DÖNÜM NOKTASI (MILESTONE) TARİH ARALIĞI VE ÇAKIŞMA KONTROLÜ BAŞLANGICI ---
        // 1. Kural: Seçilen dönüm noktası tarihi ana hedefin başlangıç tarihinden önce olamaz
        const _gMinISO = goal.createdAt ? new Date(goal.createdAt).toISOString().split('T')[0] : '';
        if (_gMinISO && newDate && newDate < _gMinISO) {
            showPremiumModal({
                title: 'Tarih Sınırı 📅',
                message: 'Dönüm noktası tarihi, ana hedefin başlangıç tarihinden önce olamaz!',
                type: 'warning'
            });
            return; // İşlemi durdur
        }

        // 2. Kural: Seçilen dönüm noktası tarihi ana hedefin bitiş (deadline) tarihinden sonra olamaz
        const _gMaxISO = goal.deadline ? (goal.deadline.split('-')[0].length === 4 ? goal.deadline : goal.deadline.split('-').reverse().join('-')) : '';
        if (_gMaxISO && newDate && newDate > _gMaxISO) {
            showPremiumModal({
                title: 'Tarih Sınırı 📅',
                message: 'Dönüm noktası tarihi, ana hedefin bitiş tarihinden sonra olamaz!',
                type: 'warning'
            });
            return; // İşlemi durdur
        }

        // 3. Kural: Aralık çakışması kontrolü (Yaklaşım C: sınır paylaşımı da çakışmadır)
        if (newDate) {
            const editedMs = goal.milestones.find(m => m.id === milestoneId);
            const toYMD = (d) => { if(!d) return ''; const p=d.split('-'); return p[0].length===4 ? d : `${p[2]}-${p[1]}-${p[0]}`; };
            const editedStart = toYMD(editedMs && editedMs.startDate ? editedMs.startDate : '');
            const hasRangeConflict = goal.milestones.some(m => {
                if (m.id === milestoneId || !m.date) return false;
                const mStart = toYMD(m.startDate || '');
                const mEnd = toYMD(m.date);
                const sEl = editedStart;
                const eEl = newDate; // YYYY-MM-DD
                return sEl <= mEnd && eEl >= mStart;
            });
            if (hasRangeConflict) {
                showPremiumModal({
                    title: 'Tarih Çakışması ⚠️',
                    message: 'Bu tarih aralığı başka bir dönüm noktasıyla çakışıyor. Lütfen farklı bir tarih seçin.',
                    type: 'warning'
                });
                return;
            }
        }
        // --- DÖNÜM NOKTASI (MILESTONE) TARİH ARALIĞI VE ÇAKIŞMA KONTROLÜ BİTİŞİ ---

            ms.text = newText;
            // Tarihi YYYY-MM-DD olarak kaydet (saveNewMilestone ile aynı format)
            if (newDate) ms.date = newDate;
            Store.goals.set(goals); if(window.FocusSync) window.FocusSync.pushKey('goals', goals);
            updateGoalDetailsUI(goalId);
        };
 
         editWrapper.querySelector('.ms-edit-save').addEventListener('click', saveEdit);
         editWrapper.querySelector('.ms-edit-cancel').addEventListener('click', () => updateGoalDetailsUI(goalId));
         editWrapper.querySelector('.ms-edit-input').addEventListener('keypress', e => { if (e.key === 'Enter') saveEdit(); });
         editWrapper.querySelector('.ms-edit-input').focus();
     };
 
     window.deleteMilestone = function(goalId, milestoneId) {
         const goals = window.__getGoalsRef();
         const goal = goals.find(g => String(g.id) === String(goalId));
         if(goal && goal.milestones) {
             goal.milestones = goal.milestones.filter(m => m.id !== milestoneId);
             Store.goals.set(goals); if(window.FocusSync) window.FocusSync.pushKey('goals', goals);
             updateGoalDetailsUI(goalId);
         }
     };
 
   // Görev Ekle butonuna tıklanınca modalı aç
   document.getElementById('detail-add-task-btn').addEventListener('click', () => {
     const goalId = document.getElementById('detail-active-goal-id').value;
     const goals = window.__getGoalsRef();
     const goal = goals.find(g => String(g.id) === String(goalId));
 
     // Modal başlığını güncelle
     const goalNameEl = document.getElementById('add-task-modal-goal-name');
     if (goalNameEl && goal) goalNameEl.textContent = goal.title;
 
     // Tarihi bugüne sıfırla
     const dateEl = document.getElementById('detail-task-date');
     if (dateEl) {
         // goal.createdAt milisaniyeden YYYY-MM-DD'ye çevir (native input ve flatpickr için)
         const goalMinDate = goal && goal.createdAt ? new Date(goal.createdAt) : null;
         if (goalMinDate) goalMinDate.setHours(0, 0, 0, 0);
         const goalMaxStr = goal && goal.deadline ? goal.deadline : null; // YYYY-MM-DD

         if (dateEl._flatpickr) {
             // Flatpickr varsa API üzerinden min/max/değer ata
             // NOT: min/max ve seçilen tarihi gün başlangıcına (00:00:00) sabitliyoruz.
             // Aksi halde deadline/createdAt "bugün" olduğunda saat karşılaştırması
             // yüzünden new Date() (şu anki saatle) sınırların dışına düşüp
             // flatpickr seçimi reddediyor ve alan boş kalıyordu.
             const goalMaxDate = goalMaxStr ? new Date(`${goalMaxStr}T23:59:59`) : false;
             dateEl._flatpickr.set('minDate', goalMinDate || false);
             dateEl._flatpickr.set('maxDate', goalMaxDate);
             const todayDateOnly = new Date();
             todayDateOnly.setHours(0, 0, 0, 0);
             dateEl._flatpickr.setDate(todayDateOnly, true);
         } else {
             // Fallback: native input için YYYY-MM-DD formatı
             const todayInput = toInputDate(formatDateToString(new Date()));
             if (goalMinDate) dateEl.min = toInputDate(formatDateToString(goalMinDate));
             else dateEl.removeAttribute('min');
             if (goalMaxStr) dateEl.max = goalMaxStr;
             else dateEl.removeAttribute('max');
             dateEl.value = todayInput;
         }
     }
     const tsEl = document.getElementById('detail-task-time-start');
     const teEl = document.getElementById('detail-task-time-end');
     if (tsEl && teEl) {
         const slotDateStr = dateEl && dateEl._flatpickr && dateEl._flatpickr.selectedDates.length
             ? formatDateToString(dateEl._flatpickr.selectedDates[0])
             : formatDateToString(new Date());
         const nextSlot = getNextAvailableTimeSlot(slotDateStr);
         tsEl.value = nextSlot.start;
         teEl.value = nextSlot.end;
     }
 
     // Görev adı inputunu sıfırla
     const input = document.getElementById('detail-new-task-input');
     if (input) input.value = '';

     // Modalı aç
     document.getElementById('add-task-modal').classList.remove('hidden');
     setTimeout(() => input && input.focus(), 100);
 });
 
     // Modalı kapat
     document.getElementById('close-add-task-modal-btn').addEventListener('click', () => {
         document.getElementById('add-task-modal').classList.add('hidden');
     });
     document.getElementById('add-task-modal').addEventListener('click', (e) => {
         if (e.target === e.currentTarget) e.currentTarget.classList.add('hidden');
     });
 
     // Görevi kaydet
     const saveNewTask = () => {
         const goalId = document.getElementById('detail-active-goal-id').value;
         const input = document.getElementById('detail-new-task-input');
         const text = input.value.trim();
 
         if (text && goalId) {
             const priority = document.getElementById('detail-task-priority').value;
             const dateEl = document.getElementById('detail-task-date');
             // Flatpickr selectedDates kullan; yoksa .value'dan okuyup dönüştür
             let dateStr;
             if (dateEl && dateEl._flatpickr && dateEl._flatpickr.selectedDates.length) {
                 dateStr = formatDateToString(dateEl._flatpickr.selectedDates[0]);
             } else if (dateEl && dateEl.value) {
                 dateStr = fromInputDate(dateEl.value);
             } else {
                 dateStr = formatDateToString(new Date());
             }
             const timeStartStr = document.getElementById('detail-task-time-start').value || '09:00';
             const timeEndStr = document.getElementById('detail-task-time-end').value || '10:00';
 
             const startMins = timeToMins(timeStartStr);
             const endMins = timeToMins(timeEndStr);
 
             if (startMins >= endMins) {
                 showPremiumModal({ title: 'Hatalı Zaman', message: 'Bitiş saati başlangıçtan önce olamaz.', type: 'warning' });
                 return;
             }

             // --- AKSİYON PLANI ANA HEDEF TARİH SINIRLARI DENETİMİ (YENİ ENGELLEME) ---
                if (goalId && dateStr && !window.checkGoalDateBoundaries(goalId, dateStr)) {
                    return; // Eğer tarih hedefin sınırları dışındaysa görevi eklemez, işlemi tamamen durdurur!
                }

             if (hasTimeConflict(dateStr, startMins, endMins)) {
                 showPremiumModal({ title: 'Zaman Çakışması', message: 'Bu saatte takviminizde başka plan var.', type: 'warning' });
                 return;
             }

             addGlobalTask(text, priority, 'kisisel', dateStr, timeStartStr, timeEndStr, '', goalId, '');

             // Saati otomatik 1 saat ileri at, modalı açık bırak — kullanıcı arka arkaya görev ekleyebilsin
             const tsEl = document.getElementById('detail-task-time-start');
             const teEl = document.getElementById('detail-task-time-end');
             if (tsEl) tsEl.value = timeEndStr;
             if (teEl) teEl.value = addOneHour(timeEndStr);
             input.value = '';
             input.focus();

             updateGoalDetailsUI(goalId);
             window.renderTasks();
             if (typeof renderGoals === 'function') renderGoals();
             if (typeof window.renderCalendarRef === 'function') window.renderCalendarRef();
             if (typeof window.renderEventsRef === 'function') window.renderEventsRef();
         }
     };
 
     document.getElementById('detail-add-task-confirm-btn').addEventListener('click', saveNewTask);
     document.getElementById('detail-new-task-input').addEventListener('keypress', (e) => {
         if (e.key === 'Enter') saveNewTask();
     });
 
     const detailTimeStartEl = document.getElementById('detail-task-time-start');
     const detailTimeEndEl = document.getElementById('detail-task-time-end');
     if (detailTimeStartEl && detailTimeEndEl) {
         detailTimeStartEl.addEventListener('change', () => {
             detailTimeEndEl.value = addOneHour(detailTimeStartEl.value);
         });
     }
 
     // Mevcut milestone aralıklarına bakarak müsait ilk aralığı döndür
     // Yaklaşım C: yeni milestone başlangıcı = son milestone bitişi + 1 gün (çakışma imkansız)
     // Tüm tarihler YYYY-MM-DD formatında döner (flatpickr uyumlu)
     function findNextAvailableMsRange(goal) {
         // Hedef başlangıcını YYYY-MM-DD olarak al
         const _toYMD = (d) => { if (!d) return ''; const p = d.split('-'); return p[0].length === 4 ? d : `${p[2]}-${p[1]}-${p[0]}`; };
         const _addDay = (ymd) => { const d = new Date(ymd + 'T00:00:00'); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); };
         const goalMinYMD = goal.createdAt ? new Date(goal.createdAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
         const goalMaxYMD = _toYMD(goal.deadline || '');

         if (!goal.milestones || goal.milestones.length === 0) {
             return { start: goalMinYMD, end: goalMaxYMD };
         }
         // Son milestone bitiş tarihini bul (YYYY-MM-DD)
         const lastEnd = goal.milestones
             .filter(m => m.date)
             .map(m => _toYMD(m.date))
             .sort()
             .pop();
         if (!lastEnd) return { start: goalMinYMD, end: goalMaxYMD };
         const nextStart = _addDay(lastEnd);
         if (goalMaxYMD && nextStart > goalMaxYMD) return null;
         return { start: nextStart, end: goalMaxYMD };
     }
 
     // Dönüm Noktası Ekle butonuna tıklanınca modalı aç
     document.getElementById('detail-add-milestone-btn').addEventListener('click', () => {
         const goalId = document.getElementById('detail-active-goal-id').value;
         const goals = window.__getGoalsRef();
         const goal = goals.find(g => String(g.id) === String(goalId));
         const goalNameEl = document.getElementById('add-milestone-modal-goal-name');
         if (goalNameEl && goal) goalNameEl.textContent = goal.title;
 
         const input = document.getElementById('detail-new-milestone-input');
         const startInput = document.getElementById('detail-new-milestone-start');
         const dateInput = document.getElementById('detail-new-milestone-date');
         if (input) input.value = '';
 
         if (goal) {
             // Date object kullan — flatpickr her formatta çalışır, native input YYYY-MM-DD ister
             const goalMinDate = goal.createdAt ? new Date(goal.createdAt) : new Date();
             goalMinDate.setHours(0,0,0,0);
             const goalMax = goal.deadline || null; // YYYY-MM-DD
             const available = findNextAvailableMsRange(goal);

             // Mevcut milestone'ları güncel onDayCreate ile işaretle
             const _msPalette2 = ['#0984e3','#6c5ce7','#00b894','#e17055','#fdcb6e','#fd79a8'];
             const _curMsRanges2 = (goal.milestones || []).filter(m => m.date).map((m, i) => {
                 const toYMD = (d) => { if(!d) return ''; const p=d.split('-'); return p[0].length===4 ? d : `${p[2]}-${p[1]}-${p[0]}`; };
                 return { start: toYMD(m.startDate||''), end: toYMD(m.date), color: _msPalette2[i%_msPalette2.length], text: m.text };
             });
             const _curOnDayCreate2 = (dObj, dStr, fp, dayElem) => {
                 for (const range of _curMsRanges2) {
                     if (!range.end) continue;
                     const inRange = (range.start ? dStr >= range.start : true) && dStr <= range.end;
                     if (inRange) {
                         const isEnd = dStr === range.end;
                         const isStart = range.start && dStr === range.start;
                         dayElem.style.background = `${range.color}22`;
                         dayElem.style.borderRadius = '6px';
                         if (isStart || isEnd) { dayElem.style.background = `${range.color}55`; dayElem.style.border = `1px solid ${range.color}`; }
                         if (isEnd) {
                             const dot = document.createElement('span');
                             dot.style.cssText = `display:block;width:5px;height:5px;border-radius:50%;background:${range.color};position:absolute;bottom:2px;left:50%;transform:translateX(-50%);`;
                             dayElem.style.position = 'relative';
                             dayElem.appendChild(dot);
                         }
                         dayElem.title = `🚩 ${range.text}`;
                         break;
                     }
                 }
             };

             [startInput, dateInput].forEach(el => {
                 if (!el) return;
                 const fp = el._flatpickr;
                 if (fp) {
                     fp.set('minDate', goalMinDate);
                     fp.set('maxDate', goalMax || false);
                     fp.set('onDayCreate', _curOnDayCreate2);
                     fp.set('disable', []); // Bitiş tarihleri kilitlenmiyor, bitişik aralıklara izin var
                 } else {
                     el.min = toInputDate(formatDateToString(goalMinDate));
                     if (goalMax) el.max = goalMax;
                 }
             });
 
             if (available) {
                 // Yaklaşım C: başlangıç = son bitiş + 1 gün (YYYY-MM-DD, flatpickr uyumlu)
                 const suggestedStart = available.start; // YYYY-MM-DD
                 if (startInput) {
                     const fpS = startInput._flatpickr;
                     if (fpS) {
                         // minDate'i de güncelle: son milestone bitişinden önce seçilemesin
                         if (goal.milestones && goal.milestones.length > 0) {
                             fpS.set('minDate', suggestedStart);
                         }
                         fpS.setDate(suggestedStart, true);
                     } else {
                         startInput.min = suggestedStart;
                         startInput.value = suggestedStart;
                     }
                 }
                 if (dateInput) {
                     const fpE = dateInput._flatpickr;
                     if (fpE) fpE.setDate(available.end || suggestedStart, true);
                     else dateInput.value = available.end || suggestedStart;
                 }
             } else {
                 if (startInput) startInput.value = '';
                 if (dateInput) dateInput.value = '';
             }
         }
 
         // Mevcut dönüm noktalarını görsel olarak göster
         const occupiedEl = document.getElementById('milestone-occupied-ranges');
         if (occupiedEl) {
             const msList = goal && goal.milestones && goal.milestones.length > 0
                 ? goal.milestones.filter(m => m.date)
                 : [];
             if (msList.length > 0) {
                 const colors = ['#0984e3','#6c5ce7','#00b894','#e17055','#fdcb6e','#fd79a8'];
                 const items = msList.map((ms, i) => {
                     const c = colors[i % colors.length];
                     const _fmtDisp = (d) => {
                         if (!d) return '?';
                         const p = d.split('-');
                         // YYYY-MM-DD → GG.AA.YYYY
                         return p[0].length === 4 ? `${p[2]}.${p[1]}.${p[0]}` : `${p[0]}.${p[1]}.${p[2]}`;
                     };
                     const sLabel = _fmtDisp(ms.startDate);
                     const eLabel = _fmtDisp(ms.date);
                     const done = ms.completed ? 'opacity:.45;text-decoration:line-through;' : '';
                     return `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;${done}">
                         <div style="width:10px;height:10px;border-radius:50%;background:${c};flex-shrink:0;"></div>
                         <span style="font-size:12px;color:#fff;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(ms.text)}</span>
                         <span style="font-size:11px;color:rgba(255,255,255,0.4);white-space:nowrap;">${sLabel} → ${eLabel}</span>
                         ${ms.completed ? '<span style="font-size:10px;color:#2ed573;">✓</span>' : ''}
                     </div>`;
                 }).join('');
                 occupiedEl.innerHTML = `
                     <div style="border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:10px 14px;background:rgba(0,0,0,0.2);">
                         <div style="font-size:10px;font-weight:700;letter-spacing:.6px;color:rgba(255,255,255,0.35);text-transform:uppercase;margin-bottom:8px;"><i class="fa-solid fa-flag-checkered" style="margin-right:5px;color:#0984e3;opacity:.7;"></i>Mevcut Dönüm Noktaları</div>
                         ${items}
                     </div>`;
                 occupiedEl.style.display = 'block';
             } else {
                 occupiedEl.style.display = 'none';
             }
         }

         document.getElementById('add-milestone-modal').classList.remove('hidden');
         setTimeout(() => input && input.focus(), 100);
     });
 
     // Modalı kapat
     document.getElementById('close-add-milestone-modal-btn').addEventListener('click', () => {
         document.getElementById('add-milestone-modal').classList.add('hidden');
     });
     document.getElementById('add-milestone-modal').addEventListener('click', (e) => {
         if (e.target === e.currentTarget) e.currentTarget.classList.add('hidden');
     });
 
     // Dönüm noktasını kaydet
     const saveNewMilestone = () => {
         const goalId = document.getElementById('detail-active-goal-id').value;
         const input = document.getElementById('detail-new-milestone-input');
         const startInput = document.getElementById('detail-new-milestone-start');
         const dateInput = document.getElementById('detail-new-milestone-date');
         const text = input.value.trim();
         const selectedStart = startInput ? startInput.value : '';
         const selectedDate = dateInput ? dateInput.value : '';
         const goals = window.__getGoalsRef();
         const goal = goals.find(g => String(g.id) === String(goalId));
 
         if (!text) {
             showPremiumModal({ title: 'Eksik Bilgi', message: 'Dönüm noktası adı boş olamaz.', type: 'warning' });
             return;
         }
         if (!selectedStart || !selectedDate) {
             showPremiumModal({ title: 'Eksik Tarih', message: 'Lütfen başlangıç ve bitiş tarihini seçin.', type: 'warning' });
             return;
         }
         if (selectedStart > selectedDate) {
             showPremiumModal({ title: 'Hatalı Tarih', message: 'Başlangıç tarihi bitiş tarihinden sonra olamaz.', type: 'warning' });
             return;
         }
        // --- HEDEF TARİH SINIRI KONTROLÜ ---
        const _msParse = (s) => { if(!s) return null; const p=s.split('-'); return p[0].length===4 ? new Date(p[0],p[1]-1,p[2]) : new Date(p[2],p[1]-1,p[0]); };
        const _msStartDate = _msParse(selectedStart);
        const _msEndDate   = _msParse(selectedDate);
        const _goalStartMs = goal && goal.createdAt ? new Date(goal.createdAt) : null;
        const _goalEndMs   = goal && goal.deadline  ? _msParse(goal.deadline)  : null;
        if (_goalStartMs && _msStartDate) {
            const gs = new Date(_goalStartMs.getFullYear(), _goalStartMs.getMonth(), _goalStartMs.getDate());
            if (_msStartDate < gs) {
                showPremiumModal({ title: 'Tarih Sınırı ⚠️', message: 'Dönüm noktası başlangıç tarihi, hedefin başlangıç tarihinden önce olamaz.', type: 'warning' });
                return;
            }
        }
        if (_goalEndMs && _msEndDate && _msEndDate > _goalEndMs) {
            showPremiumModal({ title: 'Tarih Sınırı ⚠️', message: 'Dönüm noktası bitiş tarihi, hedefin son tarihini aşamaz.', type: 'warning' });
            return;
        }
        if (goal && goal.milestones) {
            const conflict = goal.milestones.find(m => {
                if (!m.date) return false;
                const mStart = m.startDate || '';
                const mEnd = m.date;
                // Yaklaşım C: tarihler artık +1 gün boşlukla ayrılıyor.
                // Sınır paylaşımı da çakışma sayılır (örn. M1: 21-22 ve M2: 22-23 geçersizdir).
                const _toYMD2 = (d) => { if(!d) return ''; const p=d.split('-'); return p[0].length===4?d:`${p[2]}-${p[1]}-${p[0]}`; };
                const nS = _toYMD2(selectedStart), nE = _toYMD2(selectedDate);
                const mS = _toYMD2(mStart), mE = _toYMD2(mEnd);
                return nS <= mE && nE >= mS;
            });
            if (conflict) {
                showPremiumModal({
                    title: 'Tarih Çakışması ⚠️',
                    message: '"' + conflict.text + '" dönüm noktasıyla tarih aralığı çakışıyor. Lütfen farklı bir aralık seçin.',
                    type: 'warning'
                });
                return;
            }
        }

        if (text && goal) {
            if (!goal.milestones) goal.milestones = [];
            const msId = generateId();
            goal.milestones.push({ id: msId, text: text, startDate: selectedStart, date: selectedDate, completed: false });
            Store.goals.set(goals); if(window.FocusSync) window.FocusSync.pushKey('goals', goals);

            document.getElementById('add-milestone-modal').classList.add('hidden');
            updateGoalDetailsUI(goalId);
            if (typeof window.renderTasks === 'function') window.renderTasks();
            if (typeof renderGoals === 'function') renderGoals();
        }
     };
 
     document.getElementById('detail-add-milestone-confirm-btn').addEventListener('click', saveNewMilestone);
     document.getElementById('detail-new-milestone-input').addEventListener('keypress', (e) => {
         if (e.key === 'Enter') saveNewMilestone();
     });
 
     // --- Otomatik Aşama Parçalayıcı & Boşluk Doldurucu → script-milestone-auto-splitter.js dosyasına taşındı ---

 

});
})();
