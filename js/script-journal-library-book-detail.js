// script-journal-library.js dosyasından çıkarıldı — "book-detail-modal" (günlük
// kitap detay penceresi) render/kapatma mantığı, defter içindeki diğer render
// fonksiyonlarından (raf/takvim/ZK modalları) bağımsız, kendi kapalı alt sistemi.
import { FocusStorage } from './storage-manager.js';

// Tarih format utility: günlük YYYY-MM-DD → görev/alışkanlık storage DD-MM-YYYY
export function journalDateToStorageKey(isoDate) {
    const parts = isoDate.split('-');
    return (parts.length === 3 && parts[0].length === 4)
        ? `${parts[2]}-${parts[1]}-${parts[0]}`
        : isoDate;
}

export function showGrandBookDetails(entry, isPast) {
   const modal = document.getElementById("book-detail-modal");
   if (!modal) return;
   modal.setAttribute('data-active-date', entry.date);

   // Tarihi kullanıcı dostu uzun Türkçe formatına çeviriyoruz (Örn: 25 Mayıs 2026)
   let longDate = entry.date;
   try {
       longDate = new Date(entry.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
   } catch (e) { console.warn('[FocusAI] sessiz hata:', e); }

   // Yeni defter alanlarına veriyi basıyoruz
   document.getElementById("book-detail-cover-date").textContent = longDate;
   document.getElementById("book-detail-achieve").textContent = entry.achieve || "Bugün gurur duyulacak çok şey vardı ama kağıda dökülmedi...";
   document.getElementById("book-detail-improve").textContent = entry.improve || "Her gün bir öğrenme fırsatıdır, yarın yeni bir sayfa açılacak.";

   // ── O GÜNE AİT GERÇEK İSTATİSTİKLERİ HESAPLAMA MOTORU ──
   try {
       const _dateStr = journalDateToStorageKey(entry.date);

       // Yardımcı: boş durum için em dash, dolu için değer
       function setStatVal(el, value, emptyClass) {
           if (!el) return;
           if (!value) {
               el.textContent = '—';
               el.classList.add('is-empty');
               el.style.color = '';
           } else {
               el.textContent = value;
               el.classList.remove('is-empty');
           }
       }

       // 1. Görev Sayısı
       const _allTasks = typeof tasks !== 'undefined' ? tasks : FocusStorage.get('tasks', []);
       const _dayTasks = _allTasks.filter(t => t.date === _dateStr);
       const tasksEl = document.getElementById('book-stat-tasks-val');
       if (_dayTasks.length === 0) {
           setStatVal(tasksEl, null);
       } else {
           const done = _dayTasks.filter(t => t.completed).length;
           setStatVal(tasksEl, `${done}/${_dayTasks.length}`);
       }

       // 2. Odak Süresi
       const _focusHistory = FocusStorage.get('focus_history', {});
       const _focusMin = _focusHistory[_dateStr] || 0;
       const focusText = _focusMin >= 60
           ? `${Math.floor(_focusMin/60)}s ${_focusMin % 60}dk`
           : _focusMin > 0 ? `${_focusMin}dk` : null;
       setStatVal(document.getElementById('book-stat-focus-val'), focusText);

       // 3. Alışkanlıklar — badge sistemi
       const _allHabits = typeof habits !== 'undefined' ? habits : FocusStorage.get('habits', []);
       const habitsContainer = document.getElementById('book-stat-habits-val');
       if (habitsContainer) {
           habitsContainer.innerHTML = '';
           if (_allHabits.length === 0) {
               const empty = document.createElement('span');
               empty.className = 'bsi-value is-empty';
               empty.textContent = '—';
               habitsContainer.appendChild(empty);
           } else {
               _allHabits.forEach(h => {
                   const badge = document.createElement('span');
                   badge.className = 'bsi-habit-badge ' + (h.history && h.history[_dateStr] ? 'done' : 'missed');
                   badge.textContent = h.name || h.title;
                   habitsContainer.appendChild(badge);
               });
           }
       }

       // 4. Ana Hedef
       const _highlightHistory = FocusStorage.get('highlight_history', {});
       const _hl = _highlightHistory[_dateStr];
       const highlightElement = document.getElementById('book-stat-highlight-val');
       if (highlightElement) {
           const hlText = _hl && (_hl.text || _hl.title) ? (_hl.text || _hl.title) : null;
           setStatVal(highlightElement, hlText);
           if (hlText) {
               highlightElement.style.color = _hl.completed ? '#2ed573' : '#ff4757';
           }
       }
   } catch(e) {
       console.error("Kitap istatistikleri yüklenirken bir hata oluştu:", e);
   }
   // ─────────────────────────────────────────────────────

   const editBtn = document.getElementById("book-edit-btn");
   const deleteBtn = document.getElementById("book-delete-btn");

   if (isPast) {
       if (editBtn) editBtn.style.display = "none";
       if (deleteBtn) deleteBtn.style.display = "none";
   } else {
       if (editBtn) editBtn.style.display = "inline-block";
       if (deleteBtn) deleteBtn.style.display = "inline-block";
   }

   modal.classList.remove("hidden");
   void modal.offsetHeight;
   modal.classList.add("animate-open");
}

// Modal kapatma — sinematik kapanış animasyonu
export function closeBookDetailModal() {
    const modal = document.getElementById("book-detail-modal");
    if (!modal || modal.classList.contains("hidden")) return;

    const panel = modal.querySelector('.notebook-layout') || modal.querySelector('.book-detail-panel');

    if (panel) {
        // Kapanış: sağa katlanarak uzaklaşır
        panel.style.transition = [
            'transform 0.35s cubic-bezier(0.6, 0, 0.8, 0.4)',
            'opacity 0.28s ease 0.04s',
            'filter 0.28s ease'
        ].join(', ');
        panel.style.transform = 'perspective(1600px) rotateY(62deg) rotateX(-8deg) scale(0.80) translateZ(-140px) translateY(16px)';
        panel.style.opacity = '0';
        panel.style.filter = 'brightness(0.5)';

        // Overlay da fade out
        modal.style.transition = 'background 0.30s ease, backdrop-filter 0.30s ease';
        modal.style.background = 'rgba(0,0,0,0)';
        modal.style.backdropFilter = 'blur(0px)';

        setTimeout(() => {
            modal.classList.add("hidden");
            modal.classList.remove("animate-open");
            // Temizle
            panel.style.transform = '';
            panel.style.opacity = '';
            panel.style.filter = '';
            panel.style.transition = '';
            modal.style.transition = '';
            modal.style.background = '';
            modal.style.backdropFilter = '';
        }, 340);
    } else {
        modal.classList.add("hidden");
        modal.classList.remove("animate-open");
    }
}

export function initBookDetailModalClose() {
    document.getElementById("close-book-detail-btn")?.addEventListener("click", closeBookDetailModal);
    document.getElementById("book-detail-modal")?.addEventListener("click", (e) => {
        if (e.target === e.currentTarget) closeBookDetailModal();
    });
}
