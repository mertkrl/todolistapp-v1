// ============================================================
// FOCUSAI SCRIPT-COMMAND-PALETTE.JS
// script.js'ten çıkarılmış Ctrl+K komut paleti.
// tasks/goals/habits/mindDumps'a artık bare closure erişimi yok — script.js
// tarafından ES module export edilen getTasksRef/getGoalsRef/getHabitsRef/
// getMindDumpsRef() accessor'ları üzerinden okuyor. script.js'ten SONRA
// yüklenmeli.
// ============================================================
import { getTasksRef, getGoalsRef, getHabitsRef, getMindDumpsRef } from './script.js';
import { escapeHtml } from './storage-manager.js';

(function () {
'use strict';

 // ===== CTRL+K KOMUT PALETİ =====
 (function() {
     const overlay  = document.getElementById('command-palette-overlay');
     const input    = document.getElementById('cmd-input');
     const results  = document.getElementById('cmd-results');
     if (!overlay || !input || !results) return;
 
     let activeIndex = -1;
 
     // --- Aç / Kapat ---
     function openPalette() {
         overlay.classList.remove('hidden');
         input.value = '';
         activeIndex = -1;
         renderResults('');
         setTimeout(() => input.focus(), 50);
     }
 
     function closePalette() {
         overlay.classList.add('hidden');
         input.value = '';
         results.innerHTML = '';
     }
 
    // Ctrl+Shift+K veya Cmd+Shift+K
    document.addEventListener('keydown', (e) => {
     if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'k') {
         e.preventDefault();
         overlay.classList.contains('hidden') ? openPalette() : closePalette();
     }
     if (e.key === 'Escape') closePalette();
 });
 
     overlay.addEventListener('click', (e) => { if (e.target === overlay) closePalette(); });
     input.addEventListener('input', (e) => { activeIndex = -1; renderResults(e.target.value.trim().toLowerCase()); });
 
     // Ok tuşu + Enter navigasyon
     input.addEventListener('keydown', (e) => {
         const items = results.querySelectorAll('.cmd-item');
         if (!items.length) return;
         if (e.key === 'ArrowDown') {
             e.preventDefault();
             activeIndex = (activeIndex + 1) % items.length;
             updateActive(items);
         } else if (e.key === 'ArrowUp') {
             e.preventDefault();
             activeIndex = (activeIndex - 1 + items.length) % items.length;
             updateActive(items);
         } else if (e.key === 'Enter') {
             e.preventDefault();
             const active = results.querySelector('.cmd-item.active');
             if (active) active.click();
             else if (items[0]) items[0].click();
         }
     });
 
     function updateActive(items) {
         items.forEach((el, i) => el.classList.toggle('active', i === activeIndex));
         const activeEl = items[activeIndex];
         if (activeEl) activeEl.scrollIntoView({ block: 'nearest' });
     }
 
     // --- Sayfaya Git ---
     function goToPage(target) {
         const navItem = document.querySelector(`.nav-links li[data-target="${target}"]`);
         if (navItem) navItem.click();
         closePalette();
     }
 
     // --- Sonuçları Render Et ---
     function renderResults(query) {
         results.innerHTML = '';
         activeIndex = -1;
 
         const sections = [
             { target: 'bugun',          icon: 'fa-sun',           color: '#feca57', bg: 'rgba(254,202,87,.15)',  label: 'Bugün' },
             { target: 'hedefler',       icon: 'fa-mountain-sun',  color: '#ff9f43', bg: 'rgba(255,159,67,.15)', label: 'Ana Hedefler' },
             { target: 'zihin-coplugu',  icon: 'fa-inbox',         color: '#00cec9', bg: 'rgba(0,206,201,.15)',  label: 'Zihin Çöplüğü' },
             { target: 'aliskanliklar',  icon: 'fa-leaf',          color: '#2ed573', bg: 'rgba(46,213,115,.15)', label: 'Alışkanlıklar' },
             { target: 'zamanlayici',    icon: 'fa-stopwatch',     color: '#6c5ce7', bg: 'rgba(108,92,231,.15)', label: 'Zamanlayıcı' },
             { target: 'takvim',         icon: 'fa-calendar-days', color: '#0984e3', bg: 'rgba(9,132,227,.15)',  label: 'Takvim' },
             { target: 'istatistikler',  icon: 'fa-chart-pie',     color: '#a29bfe', bg: 'rgba(162,155,254,.15)',label: 'İstatistikler' },
             { target: 'gunluk',         icon: 'fa-book-open',     color: '#fd79a8', bg: 'rgba(253,121,168,.15)',label: 'Günlük' },
             { target: 'arkadaslar',     icon: 'fa-users',         color: '#55efc4', bg: 'rgba(85,239,196,.15)', label: 'Arkadaşlar' },
         ];
 
         // Boş sorgu → varsayılan hızlı eylemler
         if (!query) {
             appendGroup('⚡ Hızlı Eylemler');
             appendItem({
                 icon: 'fa-plus', iconColor: '#2ed573', iconBg: 'rgba(46,213,115,.15)',
                 title: 'Yeni Görev Ekle', sub: 'Ctrl+N',
                 badge: null, badgeColor: null,
                 onClick: () => {
                     closePalette();
                     const fab = document.getElementById('floating-quick-add-btn');
                     if (fab) fab.click();
                 }
             });
 
             appendGroup('🧭 Sayfalar');
             sections.forEach(s => {
                 appendItem({
                     icon: s.icon, iconColor: s.color, iconBg: s.bg,
                     title: s.label, sub: null, badge: null,
                     onClick: () => goToPage(s.target)
                 });
             });
             return;
         }
 
         let found = false;
 
         // --- GÖREVLER ---
         const matchedTasks = (getTasksRef() || [])
             .filter(t => t.text && t.text.toLowerCase().includes(query))
             .slice(0, 5);
 
         if (matchedTasks.length) {
             found = true;
             appendGroup('✅ Görevler');
             matchedTasks.forEach(t => {
                 const priorityMap = { high: { label: 'Yüksek', color: '#ff6b6b', bg: 'rgba(255,107,107,.15)' }, medium: { label: 'Orta', color: '#feca57', bg: 'rgba(254,202,87,.15)' }, low: { label: 'Düşük', color: '#2ed573', bg: 'rgba(46,213,115,.15)' } };
                 const p = priorityMap[t.priority] || priorityMap.medium;
                 appendItem({
                     icon: t.completed ? 'fa-circle-check' : 'fa-circle',
                     iconColor: t.completed ? '#2ed573' : '#a0a0b0',
                     iconBg: 'rgba(255,255,255,.05)',
                     title: highlight(t.text, query),
                     sub: t.date || null,
                     badge: p.label, badgeColor: p.color, badgeBg: p.bg,
                     onClick: () => goToPage('bugun')
                 });
             });
         }
 
         // --- HEDEFLER ---
         const matchedGoals = (getGoalsRef() || [])
             .filter(g => g.title && g.title.toLowerCase().includes(query))
             .slice(0, 4);
 
         if (matchedGoals.length) {
             found = true;
             appendGroup('🎯 Hedefler');
             matchedGoals.forEach(g => {
                 appendItem({
                     icon: 'fa-mountain-sun', iconColor: '#ff9f43', iconBg: 'rgba(255,159,67,.15)',
                     title: highlight(g.title, query),
                     sub: g.category || null,
                     badge: null, badgeColor: null,
                     onClick: () => goToPage('hedefler')
                 });
             });
         }
 
         // --- ALIŞKANLIKLAR ---
         const matchedHabits = (getHabitsRef() || [])
             .filter(h => h.name && h.name.toLowerCase().includes(query))
             .slice(0, 4);
 
         if (matchedHabits.length) {
             found = true;
             appendGroup('🌿 Alışkanlıklar');
             matchedHabits.forEach(h => {
                 appendItem({
                     icon: 'fa-leaf', iconColor: '#2ed573', iconBg: 'rgba(46,213,115,.15)',
                     title: highlight(h.name, query),
                     sub: h.frequency || null,
                     badge: null, badgeColor: null,
                     onClick: () => goToPage('aliskanliklar')
                 });
             });
         }
 
         // --- ZİHİN ÇÖPLÜĞÜ ---
         const matchedDumps = (getMindDumpsRef() || [])
             .filter(d => d.text && d.text.toLowerCase().includes(query))
             .slice(0, 3);
 
         if (matchedDumps.length) {
             found = true;
             appendGroup('💭 Zihin Çöplüğü');
             matchedDumps.forEach(d => {
                 appendItem({
                     icon: 'fa-inbox', iconColor: '#00cec9', iconBg: 'rgba(0,206,201,.15)',
                     title: highlight(d.text, query),
                     sub: null, badge: null, badgeColor: null,
                     onClick: () => goToPage('zihin-coplugu')
                 });
             });
         }
 
         // --- SAYFA ARAMALARI ---
         const matchedSections = sections.filter(s => s.label.toLowerCase().includes(query));
         if (matchedSections.length) {
             found = true;
             appendGroup('🧭 Sayfalar');
             matchedSections.forEach(s => {
                 appendItem({
                     icon: s.icon, iconColor: s.color, iconBg: s.bg,
                     title: highlight(s.label, query),
                     sub: null, badge: null, badgeColor: null,
                     onClick: () => goToPage(s.target)
                 });
             });
         }
 
         if (!found) {
             results.innerHTML = `
                 <div class="cmd-empty">
                     <i class="fa-solid fa-magnifying-glass"></i>
                     "<strong>${escapeHtml(query)}</strong>" için sonuç bulunamadı
                 </div>`;
         }
     }
 
     // --- Yardımcılar ---
     function appendGroup(label) {
         const el = document.createElement('div');
         el.className = 'cmd-group-label';
         el.textContent = label;
         results.appendChild(el);
     }
 
     function appendItem({ icon, iconColor, iconBg, title, sub, badge, badgeColor, badgeBg, onClick }) {
         const el = document.createElement('div');
         el.className = 'cmd-item';
         el.innerHTML = `
             <div class="cmd-item-icon">
                 <i class="fa-solid ${icon}"></i>
             </div>
             <div class="cmd-item-text">
                 <div class="cmd-item-title">${title}</div>
                 ${sub ? `<div class="cmd-item-sub">${escapeHtml(sub)}</div>` : ''}
             </div>
             ${badge ? `<span class="cmd-item-badge">${badge}</span>` : ''}
         `;
         const iconEl = el.querySelector('.cmd-item-icon');
         iconEl.style.background = iconBg;
         iconEl.style.color = iconColor;
         const badgeEl = el.querySelector('.cmd-item-badge');
         if (badgeEl) {
             badgeEl.style.color = badgeColor;
             badgeEl.style.background = badgeBg || 'rgba(255,255,255,.07)';
         }
         el.addEventListener('click', onClick);
         results.appendChild(el);
     }
 
     function highlight(text, query) {
         // Kullanıcı verisi (görev/hedef/alışkanlık/zihin çöplüğü metni) burada
         // innerHTML'e gidiyor — önce escapeHtml, SONRA <mark> enjekte ediliyor
         // ki hem metin güvenli olsun hem eklediğimiz <mark> etiketi bozulmasın.
         const safeText = escapeHtml(text);
         if (!query) return safeText;
         const safeQuery = escapeHtml(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
         if (!safeQuery) return safeText;
         return safeText.replace(new RegExp(`(${safeQuery})`, 'gi'), '<mark class="u-background-rgba108922310p4_color-hfff_border-radius-3px_pa">$1</mark>');
     }
 
     // Sidebar'a tıklanabilir search ikonu ekle (opsiyonel)
     const logo = document.querySelector('.sidebar .logo');
     if (logo) {
         const searchBtn = document.createElement('div');
         searchBtn.title = 'Ara (Ctrl+Shift+K)';
         searchBtn.style.display = 'flex';
         searchBtn.style.alignItems = 'center';
         searchBtn.style.gap = '8px';
         searchBtn.style.background = 'rgba(255,255,255,0.05)';
         searchBtn.style.border = '1px solid var(--glass-border)';
         searchBtn.style.borderRadius = '10px';
         searchBtn.style.padding = '8px 14px';
         searchBtn.style.cursor = 'pointer';
         searchBtn.style.marginBottom = '20px';
         searchBtn.style.color = 'var(--text-muted)';
         searchBtn.style.fontSize = '13px';
         searchBtn.style.transition = 'all 0.2s';
         searchBtn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i><span class="u-flex-1">Ara...</span><kbd class="u-background-rgba2552552550p07_border-1pxsolidvar-glass-bord">⌘⇧K</kbd>';       searchBtn.addEventListener('mouseenter', () => searchBtn.style.background = 'rgba(255,255,255,0.09)');
         searchBtn.addEventListener('mouseleave', () => searchBtn.style.background = 'rgba(255,255,255,0.05)');
         searchBtn.addEventListener('click', openPalette);
         logo.after(searchBtn);
     }
 })();

})();
