// ============================================================
// FOCUSAI SCRIPT-ONBOARDING-TOUR.JS
// script.js'ten çıkarılmış interaktif rehber turu (onboarding) sistemi.
// tasks/goals/calendarEvents/habits/mindDumps state'ine bağımlı değil —
// sadece kendi DOM elemanlarına (tour-*), FocusStorage'a (import) ve
// script.js'in export ettiği switchTab()'a dokunuyor.
// Orijinal DOMContentLoaded içindeki zamanlama davranışını korumak için
// kendi DOMContentLoaded sarmalayıcısına alındı.
// ============================================================
import { FocusStorage } from './storage-manager.js';
import { switchTab } from './script.js';
import { tourFlows } from './script-onboarding-tour-flows.js';
import { markTourFlowCompleted, saveTourProgress, getTourProgress, clearTourProgress } from './script-onboarding-tour-progress-storage.js';

(function () {
'use strict';
document.addEventListener('DOMContentLoaded', () => {

     // ==========================================
     // İNTERAKTİF REHBER TURU (ONBOARDING) SİSTEMİ
     // ==========================================
     const tourOverlay = document.getElementById('tour-overlay');
     const tourTooltip = document.getElementById('tour-tooltip');
     const tourTitle = document.getElementById('tour-title');
     const tourText = document.getElementById('tour-text');
     const tourDots = document.getElementById('tour-dots');
     const tourNextBtn = document.getElementById('tour-next-btn');
     const tourSkipBtn = document.getElementById('tour-skip-btn');
 
     let activeFlowId = 'main';
     let tourSteps = tourFlows[activeFlowId];
     let currentTourStep = 0;
     let highlightedElement = null;
     // Not: bu değişken orijinal script.js'te de hiçbir yerde `let`/`var` ile
     // tanımlı değildi (örtük global atamaydı) — 'use strict' eklendiğinden beri
     // (script.js IIFE sarmalaması) muhtemelen zaten ReferenceError atıyordu.
     // Burada düzgün tanımlanıyor.
     let isTourActive = false;

     // Belirtilen flow'u başlatır. resume=true ise (örn. sayfa yeniden açıldığında)
     // daha önce yarıda kalmış bir ilerleme varsa 0. adım yerine oradan devam eder;
     // resume=false (varsayılan) her zaman baştan başlar — kullanıcının bilinçli
     // "Turu Baştan Başlat" tıklaması ya da ilk kez tetiklenen bir mini-tur için.
     function startTourFlow(flowId, resume) {
         const steps = tourFlows[flowId];
         if (!steps || !steps.length) return;
         activeFlowId = flowId;
         tourSteps = steps;
         let startIndex = 0;
         if (resume) {
             const saved = getTourProgress(flowId);
             if (saved !== null && saved >= 0 && saved < steps.length) startIndex = saved;
         } else {
             clearTourProgress(flowId);
         }
         currentTourStep = startIndex;
         isTourActive = true;
         if (tourOverlay) { tourOverlay.classList.add('active'); tourOverlay.style.display = 'block'; }
         if (tourTooltip) { tourTooltip.classList.add('active'); tourTooltip.style.display = 'block'; }
         showTourStep(currentTourStep);
     }

     function renderTourDots() {
         if(!tourDots) return;
         tourDots.innerHTML = '';
         tourSteps.forEach((_, index) => {
             const dot = document.createElement('div');
             dot.className = `tour-dot ${index === currentTourStep ? 'active' : ''}`;
             tourDots.appendChild(dot);
         });
     }
 
     function showTourStep(index) {
         if (index >= tourSteps.length) {
             endTour();
             return;
         }
     
         const step = tourSteps[index];
     
         // Eğer adımın 'tab' özelliği varsa ve o sekme şu an aktif değilse, önce oraya git.
         // window.switchTab() doğrudan çağrılır — gizli eski sidebar'daki (.nav-links li)
         // her sekme için bir öğe bulunmuyor (örn. 'planlama'), o yüzden nav-link tıklama
         // simülasyonu yerine merkezi sekme geçiş fonksiyonu kullanılıyor.
         if (step.tab) {
             const sectionEl = document.getElementById(step.tab);
             const isActive = sectionEl && sectionEl.classList.contains('active');
             if (!isActive) {
                 window._restoringTab = true;  // tour geçişi lastActiveTab'ı ezmesin
                 switchTab(step.tab);
                 window._restoringTab = false;

                 // Sekme geçişinin (animasyonun) tamamlanması için 300ms bekleyip öyle çiziyoruz
                 setTimeout(() => {
                     executeTourDrawing(index);
                 }, 300);
                 return; // Mevcut çalışmayı durdur, setTimeout içinden devam edecek.
             }
         }

         executeTourDrawing(index);
     }
     
     // Görselleştirme mantığını ayrı bir fonksiyona aldık ki gecikmeli çalıştığında karışmasın
     function executeTourDrawing(index) {
         const step = tourSteps[index];
         saveTourProgress(activeFlowId, index);

         document.querySelectorAll('.tour-highlight-active').forEach(el => {
             el.classList.remove('tour-highlight-active');
         });
     
         if (window.currentTourClickHandler && window.currentTourTarget) {
             window.currentTourTarget.removeEventListener('click', window.currentTourClickHandler);
         }
     
         // step.plain: hedef zaten kendi kart/çerçeve stiline sahip (Ana Hedefler, Zihin
         // Çöplüğü, Alışkanlıklar başlıkları) ya da geniş/dinamik bir panel (Arena) —
         // turun kendi sarı vurgu kutusunu üstüne bindirmek çift çerçeve gibi görünüyordu.
         // Bu adımlarda hiç highlight kutusu çizilmez, tooltip ortalanmış şekilde gösterilir.
         const targetEl = (step.target && !step.plain) ? document.querySelector(step.target) : null;
         const nextBtn = document.getElementById('tour-next-btn');
     
        // ── UI Güncellemeleri ──
        tourTooltip.style.display = 'block';
        document.getElementById('tour-title').innerHTML = step.title;
        document.getElementById('tour-text').innerHTML  = step.text;
 
        const progressFill = document.getElementById('tour-progress-fill');
        if (progressFill) progressFill.style.width = ((index + 1) / tourSteps.length * 100) + '%';
 
        const stepCounter = document.getElementById('tour-step-counter');
        if (stepCounter) stepCounter.textContent = `${index + 1} / ${tourSteps.length}`;
 
        const tourBadge = document.getElementById('tour-badge');
        if (tourBadge && step.badge) tourBadge.textContent = step.badge;
 
        const iconWrap = document.getElementById('tour-icon-wrap');
        if (iconWrap) {
            iconWrap.style.animation = 'none';
            iconWrap.textContent = step.icon || '✨';
            requestAnimationFrame(() => { iconWrap.style.animation = ''; });
        }
 
        if (targetEl) {
            targetEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
            targetEl.classList.add('tour-highlight-active');
 
            const rect = targetEl.getBoundingClientRect();
            const pad = 8;
            const t = rect.top - pad, l = rect.left - pad;
            const r = rect.right + pad, b = rect.bottom + pad;
 
            if (tourOverlay) {
                tourOverlay.style.clipPath = `polygon(0% 0%, 0% 100%, ${l}px 100%, ${l}px ${t}px, ${r}px ${t}px, ${r}px ${b}px, ${l}px ${b}px, ${l}px 100%, 100% 100%, 100% 0%)`;
            }
 
            // ── Akıllı 4-Yönlü Konumlama ──
            const ttW = tourTooltip.offsetWidth || 340;
            const ttH = tourTooltip.offsetHeight || 300;
            const vw  = window.innerWidth, vh = window.innerHeight;
            const gap = 20;
            const arrow = document.getElementById('tour-arrow');
 
            let top, left, arrowClass, arrowOffset;
            const spaceBelow = vh - rect.bottom;
            const spaceAbove = rect.top;
 
            if (spaceBelow >= ttH + gap || spaceBelow >= spaceAbove) {
                top = rect.bottom + gap;
                left = rect.left + rect.width / 2 - ttW / 2;
                arrowClass  = 'arrow-top';
                arrowOffset = Math.min(Math.max(ttW / 2 - 7, 24), ttW - 38);
            } else {
                top = rect.top - ttH - gap;
                left = rect.left + rect.width / 2 - ttW / 2;
                arrowClass  = 'arrow-bottom';
                arrowOffset = Math.min(Math.max(ttW / 2 - 7, 24), ttW - 38);
            }
 
            left = Math.max(10, Math.min(left, vw - ttW - 10));
            top  = Math.max(10, Math.min(top,  vh - ttH - 10));
 
            tourTooltip.style.position  = 'fixed';
            tourTooltip.style.top       = top + 'px';
            tourTooltip.style.left      = left + 'px';
            tourTooltip.style.transform = 'none';
 
            if (arrow) {
                arrow.className  = 'tour-tooltip-arrow ' + arrowClass;
                arrow.style.left = arrowOffset + 'px';
                arrow.style.display = 'block';
            }
 
            if (step.requireClick || step.nextTrigger) {
                if (nextBtn) nextBtn.style.display = 'none';
                const triggerEl = step.nextTrigger ? document.querySelector(step.nextTrigger) : targetEl;
                if (triggerEl) {
                    window.currentTourTarget = triggerEl;
                    window.currentTourClickHandler = () => {
                        setTimeout(() => {
                            if (currentTourStep < tourSteps.length - 1) {
                                currentTourStep++;
                                showTourStep(currentTourStep);
                            } else { endTour(); }
                        }, 200);
                    };
                    triggerEl.addEventListener('click', window.currentTourClickHandler, { once: true });
                }
            } else {
                if (nextBtn) nextBtn.style.display = 'flex';
            }
 
        } else {
            if (tourOverlay) tourOverlay.style.clipPath = 'none';
            tourTooltip.style.position  = 'fixed';
            tourTooltip.style.top       = '50%';
            tourTooltip.style.left      = '50%';
            tourTooltip.style.transform = 'translate(-50%, -50%)';
            if (nextBtn) nextBtn.style.display = 'flex';
            const arrow = document.getElementById('tour-arrow');
            if (arrow) arrow.style.display = 'none';
        }
 
        // Noktaları güncelle
        const dots = document.querySelectorAll('.tour-dot');
        dots.forEach((dot, i) => dot.classList.toggle('active', i === index));
 
        // Geri butonu
        const prevBtn = document.getElementById('tour-prev-btn');
        if (prevBtn) prevBtn.style.visibility = (index === 0) ? 'hidden' : 'visible';
 
        // İleri / Bitir butonu
        if (nextBtn && !step.requireClick && !step.nextTrigger) {
            if (index === tourSteps.length - 1) {
                nextBtn.innerHTML = 'Harika! <i class="fa-solid fa-check"></i>';
                nextBtn.classList.add('finish');
            } else {
                nextBtn.innerHTML = 'İleri <i class="fa-solid fa-arrow-right"></i>';
                nextBtn.classList.remove('finish');
            }
        }
     }
 
     function endTour(showConfetti = true) {
         tourOverlay.classList.remove('active');
         tourTooltip.classList.remove('active');
         isTourActive = false;
         // FocusStorage.set kullan ki tamamlanma bayrağı buluta da push'lansın; ham
        // localStorage.setItem push tetiklemiyordu → profildeki değer false kalıyor,
        // her açılışta pull local'i false'a çevirip turu (ve 'bugun' sekme geçişini)
        // yeniden tetikliyordu. activeFlowId sayesinde hem ana tur hem mini-turlar
        // kendi bayraklarını ayrı ayrı işaretler (bkz. tourStorageKey).
        markTourFlowCompleted(activeFlowId, true);
        clearTourProgress(activeFlowId); // tur bitti/geçildi — artık devam edilecek yarım kalmış adım yok
         document.querySelectorAll('.tour-highlight-active').forEach(el => el.classList.remove('tour-highlight-active'));
         tourSteps.forEach(step => {
             const el = document.getElementById(step.target);
             if (el) { el.style.zIndex = ''; el.style.position = ''; }
         });
         if (showConfetti) launchTourConfetti();
     }
 
     function launchTourConfetti() {
         const colors = ['#6c5ce7','#a29bfe','#fd79a8','#00b894','#fdcb6e','#74b9ff','#ff7675'];
         for (let i = 0; i < 70; i++) {
             setTimeout(() => {
                 const p = document.createElement('div');
                 p.className = 'tour-confetti-piece';
                 p.style.left = Math.random() * 100 + 'vw';
                p.style.top = '-12px';
                p.style.background = colors[Math.floor(Math.random() * colors.length)];
                p.style.width = Math.random() * 9 + 5 + 'px';
                p.style.height = Math.random() * 9 + 5 + 'px';
                p.style.borderRadius = Math.random() > 0.5 ? '50%' : '3px';
                p.style.animationDuration = Math.random() * 2 + 1.8 + 's';
                 document.body.appendChild(p);
                 setTimeout(() => p.remove(), 4500);
             }, i * 25);
         }
     }
 
    // İleri Butonu
    if (tourNextBtn) {
     tourNextBtn.addEventListener('click', () => {
         currentTourStep++;
         showTourStep(currentTourStep);
     });
 }
 
 // Geri Butonu
 const tourPrevBtn = document.getElementById('tour-prev-btn');
 if (tourPrevBtn) {
     tourPrevBtn.addEventListener('click', () => {
         if (currentTourStep > 0) {
             currentTourStep--;
             showTourStep(currentTourStep);
         }
     });
 }
 
 // Turu Geç Butonu
 if (tourSkipBtn) {
     tourSkipBtn.addEventListener('click', () => endTour(false));
 }
 
 // YARDIM MERKEZİ (Faz 3) — sidebar/dock'taki "?" artık doğrudan turu başlatmak yerine
 // küçük bir menü (tur + kısayollar) açar.
 const restartTourSidebarBtn = document.getElementById('btn-restart-tour-sidebar');
 const helpCenterModal       = document.getElementById('help-center-modal');
 const helpRestartTourBtn    = document.getElementById('help-restart-tour-btn');
 const closeHelpCenterBtn    = document.getElementById('close-help-center-btn');

 function openHelpCenter() {
     if (!helpCenterModal) return;
     // Aktif bir tur varken üstüne binmesin — tur zaten kendi kapatma/geç seçeneklerini sunuyor.
     if (typeof isTourActive !== 'undefined' && isTourActive) return;
     helpCenterModal.classList.remove('hidden');
     // Eğer mobilde menüden tıkladıysan menüyü kapat ki modal rahat görünsün
     const mainAppContainer = document.getElementById('main-app-container');
     const sidebarOverlay = document.getElementById('sidebar-overlay');
     if (mainAppContainer) mainAppContainer.classList.remove('sidebar-open');
     if (sidebarOverlay) sidebarOverlay.classList.remove('active');
 }
 function closeHelpCenter() {
     if (helpCenterModal) helpCenterModal.classList.add('hidden');
 }

 if (restartTourSidebarBtn) restartTourSidebarBtn.addEventListener('click', openHelpCenter);
 if (closeHelpCenterBtn) closeHelpCenterBtn.addEventListener('click', closeHelpCenter);
 if (helpCenterModal) {
     helpCenterModal.addEventListener('click', (e) => {
         if (e.target === helpCenterModal) closeHelpCenter();
     });
 }
 if (helpRestartTourBtn) {
     helpRestartTourBtn.addEventListener('click', () => {
         closeHelpCenter();
         // Hafızayı zorla sıfırla (sadece ana tur — bu buton hep ana turu başlatır)
         markTourFlowCompleted('main', false);
         startTourFlow('main');
     });
 }

 // Klavye Kısayolları
 document.addEventListener('keydown', (e) => {
     if (typeof isTourActive === 'undefined' || !isTourActive) return; 
     
     if (e.key === 'ArrowRight') {
         if (currentTourStep < tourSteps.length - 1) {
             currentTourStep++;
             showTourStep(currentTourStep);
         } else if (currentTourStep === tourSteps.length - 1) {
             endTour();
         }
     } else if (e.key === 'ArrowLeft') {
         if (currentTourStep > 0) {
             currentTourStep--;
             showTourStep(currentTourStep);
         }
     } else if (e.key === 'Escape') {
         endTour(false); // ESC ile çıkışta konfeti yok
     }
 });
 
 // Uygulama ilk açıldığında turu başlat
 setTimeout(() => {
     let isTourCompleted = false;
     if(typeof FocusStorage !== 'undefined') {
         isTourCompleted = FocusStorage.get('tour_completed', false);
     } else {
         isTourCompleted = localStorage.getItem('focusai_tour_completed') === 'true';
     }
     
     // Kendi kendini onarma: bayrak kayıp/false ama kullanıcı belli ki yeni değil
     // (daha önce sekme gezmiş ya da verisi var) → turu zorla başlatma; bayrağı
     // tamir et ve buluta push'la. Tur otomatik başlarken ilk adımı 'bugun'
     // sekmesine tıkladığı için bu durum "her yenilemede Bugün'e atıyor"
     // şikayetinin kaynağıydı.
     if (!isTourCompleted && typeof FocusStorage !== 'undefined') {
         const hasHistory =
             FocusStorage.get('lastActiveTab', null) !== null ||
             (FocusStorage.get('tasks', []) || []).length > 0 ||
             (FocusStorage.get('habits', []) || []).length > 0;
         if (hasHistory) {
             FocusStorage.set('tour_completed', true);
             isTourCompleted = true;
         }
     }

     if (!isTourCompleted && tourOverlay) {
         startTourFlow('main', true); // resume: yarıda kalmış bir adım varsa oradan devam et
     }
 }, 1000);

});
})();
