// ============================================================
// FOCUSAI SCRIPT-DAY-SUMMARY-CARD.JS
// script.js'ten çıkarılmış: gün detay çekmecesinde (cdd-summary) gösterilen
// "günlük özet kartı" (o günün görevleri, alışkanlıkları, odak hedefi,
// toplam süre, tamamlanma yüzdesi, sınıf ödevleri ve not alanı).
// script.js'in window'a koyduğu ince sarmalayıcıları (__getTasksRef,
// __getCalendarEventsRef, getHabitsForDate, timeToMins, formatDateToString,
// escapeHtml, FocusStorage) kullanır.
// script.js'ten SONRA, orijinal DOMContentLoaded zamanlamasını korumak
// için kendi DOMContentLoaded sarmalayıcısında yüklenir.
// ============================================================
(function () {
'use strict';
document.addEventListener('DOMContentLoaded', () => {

     // ── GÜNLÜK ÖZET KARTI ────────────────────────────────────────
     function renderDaySummary(dateStr) {
         const el = document.getElementById('cdd-summary');
         if (!el) return;

         const tasks = window.__getTasksRef();
         const calendarEvents = window.__getCalendarEventsRef();

         const todayStr  = window.formatDateToString(new Date());
         const isPast    = dateStr < todayStr;
         const isFuture  = dateStr > todayStr;
         const isToday   = dateStr === todayStr;

         // Veriler (isLessonPlanDraft: öğretmenin ders planı taslağı — burada gizli kalmalı)
         const dayEvs    = (calendarEvents[dateStr] || []).filter(e => !e.isLessonPlanDraft);
         const dayHabits = window.getHabitsForDate(dateStr);
         const hlHistory = FocusStorage.get('highlight_history', {});
         const highlight = hlHistory[dateStr] || null;

         const evCount   = dayEvs.length;
         const habCount  = dayHabits.length;
         const hlCount   = highlight ? 1 : 0;
         const total     = evCount + habCount + hlCount;

         // Toplam görev süresi (dk)
         const totalMins = dayEvs.reduce((s, ev) => {
             const sm = window.timeToMins(ev.timeStart || '09:00');
             const em = window.timeToMins(ev.timeEnd   || '10:00');
             return s + Math.max(0, em - sm);
         }, 0);
         const durH = Math.floor(totalMins / 60);
         const durM = totalMins % 60;
         const durStr = totalMins === 0 ? null
             : durH > 0 ? `${durH}s ${durM > 0 ? durM + 'dk' : ''}`.trim()
             : `${durM}dk`;

         // Tamamlanma
         const doneEvs  = dayEvs.filter(ev => { const t = tasks.find(t => String(t.id) === String(ev.id)); return t && t.completed; }).length;
         const doneHabs = dayHabits.filter(h => !!h.history[dateStr]).length;
         const doneHl   = highlight && highlight.completed ? 1 : 0;
         const doneTotal = doneEvs + doneHabs + doneHl;

         // Burnout yüzdesi
         const burnoutPct = Math.min(100, Math.round((totalMins / 480) * 100));

         // Not (localStorage'dan)
         const notesKey  = 'cdd_notes';
         const allNotes  = FocusStorage.get(notesKey, {});
         const note      = allNotes[dateStr] || '';

         // Durum ikonu
         let statusIcon, statusColor, statusLabel;
         if (total === 0) {
             statusIcon = '🗓️'; statusColor = 'rgba(255,255,255,0.3)'; statusLabel = 'Boş gün';
         } else if (!isPast) {
             statusIcon = burnoutPct >= 100 ? '🔥' : burnoutPct >= 75 ? '⚡' : '✅';
             statusColor = burnoutPct >= 100 ? '#ff4757' : burnoutPct >= 75 ? '#ff9f43' : '#2ed573';
             statusLabel = burnoutPct >= 100 ? 'Dolu kapasite' : burnoutPct >= 75 ? 'Yoğun gün' : 'Dengeli';
         } else {
             const pct = total > 0 ? Math.round((doneTotal / total) * 100) : 0;
             statusIcon = pct === 100 ? '🏆' : pct >= 50 ? '📊' : '📋';
             statusColor = pct === 100 ? '#2ed573' : pct >= 50 ? '#ff9f43' : 'rgba(255,255,255,0.4)';
             statusLabel = pct === 100 ? 'Mükemmel gün' : `%${pct} tamamlandı`;
         }

         // Sınıf ödevleri (window.FocusAssignments, social.js) — bu tarihte teslim tarihi olanlar
         const dayAssignments = (window.FocusAssignments?.items || []).filter(a => a.due_date && window.formatDateToString(new Date(a.due_date)) === dateStr);

         // Pill'ler
         const pills = [];
         if (evCount > 0)  pills.push(`<span class="cdd-sum-pill"><i class="fa-solid fa-list-check"></i> ${evCount} görev</span>`);
         if (habCount > 0) pills.push(`<span class="cdd-sum-pill"><i class="fa-solid fa-seedling"></i> ${habCount} alışkanlık</span>`);
         if (hlCount > 0)  pills.push(`<span class="cdd-sum-pill"><i class="fa-solid fa-star"></i> Odak hedefi</span>`);
         if (durStr)       pills.push(`<span class="cdd-sum-pill"><i class="fa-regular fa-clock"></i> ${durStr}</span>`);
         if (dayAssignments.length > 0) pills.push(`<span class="cdd-sum-pill" style="color:#a29bfe; border-color:rgba(162,155,254,0.3); background:rgba(162,155,254,0.1);"><i class="fa-solid fa-clipboard-list"></i> ${dayAssignments.length} ödev</span>`);

         el.innerHTML = `
             <div class="cdd-sum-top">
                 <div class="cdd-sum-status">
                     <span class="cdd-sum-icon">${statusIcon}</span>
                     <span class="cdd-sum-label" style="color:${statusColor};">${statusLabel}</span>
                 </div>
                 <button class="cdd-sum-note-btn ${note ? 'has-note' : ''}" id="cdd-note-toggle" title="${note ? 'Notu düzenle' : 'Not ekle'}">
                     <i class="fa-${note ? 'solid' : 'regular'} fa-note-sticky"></i>
                 </button>
             </div>
             ${pills.length ? `<div class="cdd-sum-pills">${pills.join('')}</div>` : ''}
             ${dayAssignments.length ? `
             <ul class="cdd-sum-assignments">
                 ${dayAssignments.map(a => {
                     const overdue = !a.done && new Date(a.due_date) < new Date();
                     const asgColor = a.done ? '#2ed573' : overdue ? '#ff6b6b' : '#a29bfe';
                     const asgStatus = a.done ? 'done' : overdue ? 'overdue' : 'pending';
                     const statusText = a.done ? 'Teslim edildi' : overdue ? 'Süresi geçti' : 'Bekliyor';
                     return `
                     <li class="task-item cdd-sum-assignment-item" data-code="${a.groupCode || ''}" data-status="${asgStatus}" style="cursor:pointer;">
                         <div class="task-left">
                             <i class="fa-solid fa-clipboard-list" style="color: ${asgColor}; margin-right: 5px;" title="Sınıf Ödevi"></i>
                             <div class="task-checkbox" style="border-color: ${asgColor};"></div>
                             <span class="task-text">${window.escapeHtml(a.title)}</span>
                             <div style="flex-basis: 100%; height: 0;"></div>
                             <div class="task-meta">
                                 <span class="task-category-tag" style="background: ${asgColor}26; color: ${asgColor}; border: 1px solid ${asgColor}4D;">${statusText.toUpperCase()}</span>
                                 ${a.groupName ? `<span class="task-category-tag" style="background: rgba(108, 92, 231, 0.1); color: var(--primary-color); border: 1px solid rgba(108, 92, 231, 0.2); margin-left: 5px;">${window.escapeHtml(a.groupName)}</span>` : ''}
                             </div>
                         </div>
                     </li>`;
                 }).join('')}
             </ul>` : ''}
             <div class="cdd-sum-note-area" id="cdd-note-area" style="display:none;">
                 <textarea class="cdd-note-input" id="cdd-note-input" placeholder="Bu gün için not veya hatırlatıcı…" maxlength="200">${window.escapeHtml(note)}</textarea>
                 <div class="cdd-note-actions">
                     <span class="cdd-note-chars" id="cdd-note-chars">${note.length}/200</span>
                     <button class="cdd-note-save" id="cdd-note-save">Kaydet</button>
                 </div>
             </div>`;

         el.querySelectorAll('.cdd-sum-assignment-item').forEach(item => item.addEventListener('click', () => {
             const code = item.dataset.code;
             if (typeof window.switchTab === 'function') window.switchTab('arkadaslar');
             if (typeof window.dcOpenAssignmentTab === 'function') window.dcOpenAssignmentTab(code || undefined);
         }));

         // Not toggle
         const noteToggle = document.getElementById('cdd-note-toggle');
         const noteArea   = document.getElementById('cdd-note-area');
         const noteInput  = document.getElementById('cdd-note-input');
         const noteChars  = document.getElementById('cdd-note-chars');
         const noteSave   = document.getElementById('cdd-note-save');

         if (noteToggle) noteToggle.addEventListener('click', () => {
             const open = noteArea.style.display === 'none';
             noteArea.style.display = open ? '' : 'none';
             if (open) noteInput.focus();
         });
         if (noteInput) noteInput.addEventListener('input', () => {
             noteChars.textContent = noteInput.value.length + '/200';
         });
         if (noteSave) noteSave.addEventListener('click', () => {
             const val = noteInput ? noteInput.value.trim() : '';
             const notes = FocusStorage.get(notesKey, {});
             if (val) notes[dateStr] = val; else delete notes[dateStr];
             FocusStorage.set(notesKey, notes);
             noteArea.style.display = 'none';
             renderDaySummary(dateStr); // rozeti güncelle
         });
     }
     window.renderDaySummary = renderDaySummary;
     // ─────────────────────────────────────────────────────────────

});
})();
