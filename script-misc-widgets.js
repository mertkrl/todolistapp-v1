// ─── KÜÇÜK GÖRSEL WIDGET'LAR (SELAMLAMA/SAYAÇ/STREAK/SAYI ANİMASYONU) ──
// script.js dosyasından çıkarıldı (Faz 2, 2026-07-20). Dosya içinde birbirinden
// uzak konumlarda duran, aralarında doğrudan çağrı ilişkisi olmayan (her biri
// kendi başına) küçük DOM güncelleme yardımcıları tek dosyada toplandı:
// - updateDynamicGreeting: "Günaydın/İyi Akşamlar" saatlik selamlama metni
// - updateCharCounter: günlük/reflection textarea'larının karakter sayacı
// - updateGlobalStreak: günlük seri (streak) rozetini hesaplayıp gösterir
//   (tasks state'ini SALT-OKUNUR okur → getTasksRef())
// - animateCount + _spawnChipParticles + _celebrateDoneChip: "Bekleyen/
//   Tamamlanan" sayaç chip'lerindeki roll-up/roll-down animasyonu ve
//   tamamlanınca patlayan parçacık efekti (üçü birbirini çağırır, birlikte
//   taşındı)
//
// Yükleme sırası önemsiz — script.js ve kardeşleri dynamic import() değil
// normal <script type="module" src="..."> ile yükleniyor, script.js'in
// TÜM mantığı kendi DOMContentLoaded dinleyicisi İÇİNDE çalışıyor ve bu
// olay tüm modül script'lerinin top-level kodu çalıştıktan SONRA ateşleniyor
// (bkz. script-confetti.js/script-time-picker.js'teki aynı not).

import { getTasksRef } from './script.js';
import { formatDateToString } from './script-date-time-utils.js';

 function updateDynamicGreeting() {
     const greetingDisplay = document.getElementById('dynamic-greeting');
     if (!greetingDisplay) return;
     const currentHour = new Date().getHours();
     let greetingText = "Günün Özeti";
     let greetingEmoji = "👋";
     if (currentHour >= 5 && currentHour < 12) { greetingText = "Günaydın"; greetingEmoji = "🌅"; }
     else if (currentHour >= 12 && currentHour < 18) { greetingText = "Tünaydın"; greetingEmoji = "☀️"; }
     else if (currentHour >= 18 && currentHour < 22) { greetingText = "İyi Akşamlar"; greetingEmoji = "🌙"; }
     else { greetingText = "İyi Geceler"; greetingEmoji = "🦉"; }
     greetingDisplay.textContent = greetingText;
     const emojiEl = document.getElementById('greeting-emoji');
     if (emojiEl) emojiEl.textContent = greetingEmoji;
 }
window.updateDynamicGreeting = updateDynamicGreeting;

 function updateCharCounter(inputId, counterId, limit) {
     const inputEl = document.getElementById(inputId);
     const counterEl = document.getElementById(counterId);
     if (!inputEl || !counterEl) return;
     const len = inputEl.value.length;
     counterEl.textContent = `${len} / ${limit}`;
     // Akıllı renk aşamaları
     counterEl.classList.remove('cc-writing', 'cc-good', 'cc-warn', 'cc-limit');
     if (len === 0) { /* gri — varsayılan */ }
     else if (len < limit * 0.5) counterEl.classList.add('cc-writing');
     else if (len < limit * 0.8) counterEl.classList.add('cc-good');
     else if (len < limit)       counterEl.classList.add('cc-warn');
     else                        counterEl.classList.add('cc-limit');
 }
window.updateCharCounter = updateCharCounter;

 export function updateGlobalStreak() {
     // Tamamlanmış görev olan günleri bul (DD-MM-YYYY formatında set)
     const completedDays = new Set(
         getTasksRef().filter(t => t.completed && t.date).map(t => t.date)
     );

     // Günlük hedef tamamlanan günleri de ekle
     const highlightHistory = FocusStorage.get('highlight_history', {});
     Object.entries(highlightHistory).forEach(([dateKey, val]) => {
         if (val && val.completed) completedDays.add(dateKey);
     });

     const todayStr = formatDateToString(new Date());

     // Bugün tamamlanan görev yoksa seri sıfır — dünden saymaya başlama
     let streak = 0;
     if (completedDays.has(todayStr)) {
         let d = new Date();
         d.setHours(0, 0, 0, 0);
         while (true) {
             const ds = formatDateToString(d);
             if (completedDays.has(ds)) {
                 streak++;
                 d.setDate(d.getDate() - 1);
             } else {
                 break;
             }
         }
     }

     // DD-MM-YYYY → timestamp dönüştür, kronolojik sırala
     function ddmmyyyyToTs(ds) {
         const [dd, mm, yyyy] = ds.split('-').map(Number);
         return new Date(yyyy, mm - 1, dd).getTime();
     }
     const sorted = [...completedDays].sort((a, b) => ddmmyyyyToTs(a) - ddmmyyyyToTs(b));

     let bestStreak = 0, tempStreak = 0, prevTs = null;
     for (const ds of sorted) {
         const ts = ddmmyyyyToTs(ds);
         if (prevTs !== null && ts - prevTs === 86400000) {
             tempStreak++;
         } else {
             tempStreak = 1;
         }
         if (tempStreak > bestStreak) bestStreak = tempStreak;
         prevTs = ts;
     }
     if (streak > bestStreak) bestStreak = streak;

     // Mutlak gün sayısına göre tier — seri uzadıkça alev objektif olarak şiddetlenir
     // (önceki "kişisel rekora oranla" hesap, 3 günlük bir seriyi de rekorsa "inferno"
     // gösterip anlamsızlaştırıyordu).
     const tier = streak >= 14 ? 'inferno'
                : streak >= 7  ? 'blaze'
                : streak >= 3  ? 'warm'
                : 'ember';

     const streakBadge = document.getElementById('streak-badge');
     const streakCountDisplay = document.getElementById('streak-count');

     if(streakBadge && streakCountDisplay) {
         (() => {
             const el = streakCountDisplay;
             const newVal = streak;
             if (el.textContent !== String(newVal)) {
                 const oldVal = parseInt(el.textContent, 10);
                 const dir = isNaN(oldVal) || newVal > oldVal ? 'roll-up' : 'roll-down';
                 el.classList.remove('rolling', 'roll-up', 'roll-down');
                 void el.offsetWidth;
                 el.textContent = String(newVal);
                 el.classList.add('rolling', dir);
                 el.addEventListener('animationend', () => el.classList.remove('rolling', 'roll-up', 'roll-down'), { once: true });
             }
         })();
         streakBadge.classList.remove('streak-tier-ember','streak-tier-warm','streak-tier-blaze','streak-tier-inferno');
         if (streak > 0) streakBadge.classList.add('streak-tier-' + tier);
         streakBadge.style.display = 'flex';
         // Seri 0 iken alev sönük ve hareketsiz kalsın — "yanmıyor" hissi net olsun
         const streakFireEl = document.getElementById('td-streak-fire');
         if (streakFireEl) {
             streakFireEl.classList.toggle('tsf-unlit', streak <= 0);
             // Alev şiddeti seri gününe göre SÜREKLİ artar: logaritmik eğri
             // (ilk günlerde belirgin büyüme, sonra doyum) 30 günde ~tavana ulaşır.
             const t = streak > 0 ? Math.min(Math.log(streak + 1) / Math.log(31), 1) : 0;
             streakFireEl.style.setProperty('--fire-glow', (3 + t * 10).toFixed(1) + 'px');
             // Parlama rengi ısındıkça sarıdan kızıla kayar, opaklığı artar
             const hue = Math.round(38 - t * 24);
             streakFireEl.style.setProperty('--fire-glow-color', `hsla(${hue}, 96%, 52%, ${(0.35 + t * 0.5).toFixed(2)})`);
             if (window.TsfFlame) window.TsfFlame.setIntensity(t);
         }
     }
 }
window.updateGlobalStreak = updateGlobalStreak;

 function _spawnChipParticles(chip) {
     const COLORS = ['#4ADE80','#86EFAC','#A7F3D0','#BBF7D0','#FFFFFF','#34D399'];
     const rect = chip.getBoundingClientRect();
     const cx = rect.left + rect.width / 2;
     const cy = rect.top  + rect.height / 2;
     const count = 14;
     for (let i = 0; i < count; i++) {
         const p = document.createElement('span');
         p.className = 'chip-particle';
         const angle = (Math.PI * 2 / count) * i + (Math.random() - 0.5) * 0.6;
         const dist  = 32 + Math.random() * 38;
         const tx = Math.cos(angle) * dist;
         const ty = Math.sin(angle) * dist - (Math.random() * 18);
         const size = 3 + Math.random() * 4;
         const dur  = 550 + Math.random() * 250;
         p.style.cssText = [
             `left:${cx}px`, `top:${cy}px`,
             `width:${size}px`, `height:${size}px`,
             `background:${COLORS[i % COLORS.length]}`,
             `--tx:${tx}px`, `--ty:${ty}px`,
             `--dur:${dur}ms`,
             `border-radius:${Math.random() > 0.4 ? '50%' : '2px'}`,
             `box-shadow:0 0 4px ${COLORS[i % COLORS.length]}88`
         ].join(';');
         document.body.appendChild(p);
         p.addEventListener('animationend', () => p.remove(), { once: true });
     }
 }

 function _celebrateDoneChip(chip) {
     if (!chip || !chip.offsetParent) return;
     chip.classList.remove('celebrate');
     void chip.offsetWidth;
     chip.classList.add('celebrate');
     chip.addEventListener('animationend', () => chip.classList.remove('celebrate'), { once: true });
     window._spawnChipParticles(chip);
 }

 function animateCount(el, newVal, { celebrateChip } = {}) {
     if (!el) return;
     const oldVal = parseInt(el.textContent, 10);
     const next = String(newVal);
     if (el.textContent === next) return;
     const increased = isNaN(oldVal) || newVal > oldVal;
     const dir = increased ? 'roll-up' : 'roll-down';
     el.classList.remove('rolling', 'roll-up', 'roll-down');
     void el.offsetWidth;
     el.textContent = next;
     el.classList.add('rolling', dir);
     el.addEventListener('animationend', () => el.classList.remove('rolling', 'roll-up', 'roll-down'), { once: true });
     if (celebrateChip && increased) {
         window._celebrateDoneChip(celebrateChip);
     }
 }
window._spawnChipParticles = _spawnChipParticles;
window._celebrateDoneChip = _celebrateDoneChip;
window.animateCount = animateCount;
