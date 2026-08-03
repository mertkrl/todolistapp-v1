// ============================================================
// FOCUSAI SCRIPT-CALENDAR-HOVER-POPUP.JS
// script.js'ten çıkarılmış: aylık takvim görünümünde bir gün hücresinin
// üzerine gelindiğinde gösterilen özet popup (o günün görevleri,
// alışkanlıkları ve "günün hedefi" bilgisi). script.js'in window'a
// koyduğu ince sarmalayıcıları (getTasksRef, getTaskColor, getCatColor,
// escapeHtml, FocusStorage) kullanır.
// script.js'ten SONRA, orijinal DOMContentLoaded zamanlamasını korumak
// için kendi DOMContentLoaded sarmalayıcısında yüklenir.
// Faz G: getTasksRef/getTaskColor/getCatColor gerçek import'a çevrildi
// (escapeHtml/FocusStorage export edilmediği için window/bare olarak kaldı).
// ============================================================
import { getTasksRef } from './script.js';
import { getCatColor, getTaskColor } from './script-color-utils.js';
(function () {
'use strict';
document.addEventListener('DOMContentLoaded', () => {

     // ─── Aylık Takvim Hover Popup ───────────────────────────────
     let _chpEl = null, _chpTimer = null;

     function getChpEl() {
         if (_chpEl) return _chpEl;
         _chpEl = document.createElement('div');
         _chpEl.id = 'cal-hover-popup';
         document.body.appendChild(_chpEl);
         _chpEl.addEventListener('mouseenter', () => { if (_chpTimer) { clearTimeout(_chpTimer); _chpTimer = null; } });
         _chpEl.addEventListener('mouseleave', hideCalHoverPopup);
         return _chpEl;
     }

     function showCalHoverPopup(e, dateStr, dayEvents, dayHabits, hasHighlight) {
         if (_chpTimer) { clearTimeout(_chpTimer); _chpTimer = null; }
         const totalItems = dayEvents.length + dayHabits.length + (hasHighlight ? 1 : 0);
         if (totalItems === 0) return;

         const [d2, m2, y2] = dateStr.split('-').map(Number);
         const dateObj = new Date(y2, m2 - 1, d2);
         const dayName = dateObj.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' });

         const tasks = getTasksRef ? getTasksRef() : [];

         let rows = '';
         let dotIdx = 0;
         const dotStyles = [];
         if (hasHighlight) {
             const hl = (FocusStorage.get('highlight_history', {}))[dateStr];
             const hlText = hl ? (hl.text || 'Günün Hedefi') : 'Günün Hedefi';
             dotStyles.push({ background: '#ff9f43', boxShadow: '0 0 5px #ff9f43', borderRadius: '3px' });
             rows += `<div class="chp-row chp-highlight"><span class="chp-dot" data-dot-idx="${dotIdx++}"></span><span class="chp-text">⭐ ${escapeHtml(hlText)}</span></div>`;
         }
         dayEvents.slice(0, 6).forEach(ev => {
             const t = tasks.find(t => String(t.id) === String(ev.id));
             const done = t && t.completed;
             const cc = getTaskColor(t);
             const timeStr = ev.timeStart ? `${ev.timeStart}${ev.timeEnd ? ' → ' + ev.timeEnd : ''}` : '';
             dotStyles.push({ background: cc.border, boxShadow: `0 0 4px ${cc.glow}`, borderRadius: cc.isGoal ? '3px' : '' });
             rows += `<div class="chp-row${done ? ' chp-done' : ''}"><span class="chp-dot" data-dot-idx="${dotIdx++}"></span><span class="chp-text">${done ? '<i class="fa-solid fa-check chp-check"></i> ' : ''}${escapeHtml(ev.text)}${timeStr ? '<span class="chp-time"> · ' + timeStr + '</span>' : ''}</span></div>`;
         });
         if (dayEvents.length > 6) rows += `<div class="chp-more">+${dayEvents.length - 6} görev daha</div>`;
         dayHabits.slice(0, 3).forEach(h => {
             const cc = getCatColor(h.category || 'kisisel');
             dotStyles.push({ background: cc.border, opacity: '0.7' });
             rows += `<div class="chp-row"><span class="chp-dot" data-dot-idx="${dotIdx++}"></span><span class="chp-text chp-habit"><i class="fa-solid fa-leaf"></i> ${escapeHtml(h.name)}</span></div>`;
         });
         if (dayHabits.length > 3) rows += `<div class="chp-more">+${dayHabits.length - 3} alışkanlık daha</div>`;

         const el = getChpEl();
         el.innerHTML = `<div class="chp-header">${dayName}</div><div class="chp-body">${rows}</div><div class="chp-footer">Tıkla → detay</div>`;
         el.querySelectorAll('.chp-dot[data-dot-idx]').forEach(dot => {
             const s = dotStyles[parseInt(dot.dataset.dotIdx, 10)];
             if (!s) return;
             dot.style.background = s.background || '';
             if (s.boxShadow) dot.style.boxShadow = s.boxShadow;
             if (s.borderRadius) dot.style.borderRadius = s.borderRadius;
             if (s.opacity) dot.style.opacity = s.opacity;
         });
         el.style.display = 'block';
         el.style.opacity = '0';
         el.style.transform = 'scale(0.92) translateY(4px)';

         const rect = e.currentTarget.getBoundingClientRect();
         const popW = 240;
         const spaceRight = window.innerWidth - rect.right;
         const left = spaceRight >= popW + 8 ? rect.right + 6 : rect.left - popW - 6;
         const top  = Math.min(rect.top + window.scrollY, window.innerHeight + window.scrollY - 320);
         el.style.left = `${Math.max(6, left)}px`;
         el.style.top  = `${top}px`;

         requestAnimationFrame(() => {
             el.style.transition = 'opacity 0.16s, transform 0.16s';
             el.style.opacity = '1';
             el.style.transform = 'scale(1) translateY(0)';
         });
     }

     function hideCalHoverPopup() {
         _chpTimer = setTimeout(() => {
             if (!_chpEl) return;
             _chpEl.style.transition = 'opacity 0.12s, transform 0.12s';
             _chpEl.style.opacity = '0';
             _chpEl.style.transform = 'scale(0.95) translateY(3px)';
             setTimeout(() => { if (_chpEl) _chpEl.style.display = 'none'; }, 130);
             _chpTimer = null;
         }, 80);
     }
     // ────────────────────────────────────────────────────────────

     window.showCalHoverPopup = showCalHoverPopup;
     window.hideCalHoverPopup = hideCalHoverPopup;

});
})();
