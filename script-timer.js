// ─── POMODORO / ODAK ZAMANLAYICISI ──────────────────────────────────────
// script.js dosyasından çıkarıldı (Faz 2, 2026-07-20). Zamanlayıcı motoru
// (start/pause/reset, mod geçişleri, sekme değişince "hayalet mod"),
// zamanlayıcı profilleri (oluştur/düzenle/sil/uygula), XP/sosyal entegrasyonu
// (window.FocusXP, window.FocusAISocial), sayfa yenilenince kaldığı yerden
// devam ettirme (localStorage'a yansıtılan çalışma durumu) — tamamı kendi
// modül-içi state'i (timerInterval/totalTime/timeLeft/isRunning/timerProfiles/
// timerSettings vb.) ile kapalı bir alt sistem. script.js'in ya da başka hiçbir
// kardeş dosyanın bu kümedeki fonksiyonları DOĞRUDAN çağırmadığı doğrulandı
// (script-task-end-question.js bile DOM click() tetikleyerek .mode-btn
// event listener'larına dokunuyor, JS fonksiyon çağrısıyla değil) — bu yüzden
// window.* köprüsü SADECE dışarıdan OKUNAN paylaşılan state için gerekti.
//
// Dış bağımlılıklar (hepsi script.js'te kalıyor, window.* köprüsüyle açıldı):
// - tasks/goals → getTasksRef()/__getGoalsRef() (script.js'te
//   ÖNCEDEN var olan salt-okunur getter'lar)
// - activeFocusTask (odaklanılan görev id'si, script.js'te startFocusMode/
//   clearFocusMode tarafından yönetiliyor) → getActiveFocusTaskRef()
//   (script.js'te ÖNCEDEN vardı)
// - renderStatisticsRef/renderSocialStatsRef (sekme render fonksiyon
//   işaretçileri) → getRenderStatisticsRef()/__getRenderSocialStatsRef()
//   (bu çıkarmada YENİ eklendi)
// - generateId, showPremiumModal, renderGoals, updateGoalDetailsUI → window.*
//   (script.js'te zaten dışa açık fonksiyonlar/köprüler)
// - escapeHtml, Store, window.FocusXP, window.FocusAISocial, window.TsfFlame,
//   FocusStorage → zaten global (bare escapeHtml/Store, script.js'in kendi
//   header yorumunda belgelenen window-fallthrough mekanizmasıyla çalışır)
//
// Yükleme sırası önemsiz — script.js ve kardeşleri dynamic import() değil
// normal <script type="module" src="..."> ile yükleniyor (bkz.
// script-confetti.js/script-time-picker.js/script-misc-widgets.js'teki aynı not).

import { getTasksRef, getGoalsRef, getRenderSocialStatsRef, getRenderStatisticsRef, getActiveFocusTaskRef, clearFocusMode, showPremiumModal, updateGoalDetailsUI } from './script.js';
import { formatDateToString } from './script-date-time-utils.js';
import { generateId } from './storage-manager.js';
import { renderGoals } from './script-goal-modal.js';

 let timerInterval;
 let totalTime = 25 * 60;
 let timeLeft = 25 * 60;
 let isRunning = false;
 let idleTimeout;
 let endTime = 0; // Arka plan koruması için hedeflenen bitiş zamanını tutacak
 let pomodoroCount = 0; // Pomodoro döngüsünü sayacak

 // Sayfa yenilenince zamanlayıcının sıfırlanmaması için çalışma durumunu localStorage'a
 // yansıtıyoruz (endTime mutlak zaman damgası olduğu için yenileme sonrası kalan süre
 // güvenle yeniden hesaplanabiliyor). Bulut senkronuna dahil olmayan, sadece bu cihaza
 // özgü geçici bir anahtar — FocusStorage.set bunu otomatik olarak fark edip görmezden gelir.
 function _saveTimerRunState() {
     const activeBtn = document.querySelector('.mode-btn.active');
     const mode = activeBtn ? activeBtn.getAttribute('data-mode') : 'pomodoro';
     FocusStorage.set('timer_run_state', { isRunning, endTime, totalTime, timeLeft, mode, loopCount: pomodoroCount });
 }
 function _clearTimerRunState() {
     FocusStorage.set('timer_run_state', null);
 }
 // Çalışıyorsa / duraklatılmış ama ilerlemesi varsa durumu kaydet, taze/bitmiş durumdaysa temizle.
 function _syncTimerRunState() {
     if (isRunning) { _saveTimerRunState(); }
     else if (timeLeft > 0 && timeLeft !== totalTime) { _saveTimerRunState(); }
     else { _clearTimerRunState(); }
 }
 // Zamanlayıcı bir grup seansından ("Odaklan" butonu) başlatıldıysa o seansın id'sini tutar —
 // presence'a eklenip grup takviminde "şu an bu seansa kimler odaklanıyor" gösterilebilsin diye.
 let _activeGroupSessionId = null;
 // Sunucu tarafı odak XP doğrulaması (057): mevcut geri sayımın sunucuda
 // damgalanmış seans kimliği. Taze bir başlangıçta start_focus_session()
 // ile doldurulur, bitişte finish_focus_session()'a taşınıp sıfırlanır.
 let _serverFocusSessionId = null;
 // Etkileşim doğrulaması (059): en son gerçek fare/klavye/dokunma zamanı +
 // seans boyunca periyodik heartbeat interval'ı. "Sekmeyi açık bırakıp
 // beklemek" açığını kapatmak için — heartbeat yalnızca gerçek etkileşim
 // varken ve sekme görünür/odaklıyken gönderilir (bkz. _startFocusHeartbeat).
 let _lastUserActivityAt = Date.now();
 let _focusHeartbeatInterval = null;
 ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'].forEach(evt => {
     document.addEventListener(evt, () => { _lastUserActivityAt = Date.now(); }, { passive: true });
 });
 function _startFocusHeartbeat() {
     _stopFocusHeartbeat();
     _focusHeartbeatInterval = setInterval(() => {
         if (!_serverFocusSessionId || !window.FocusXP) return;
         const idleMs = Date.now() - _lastUserActivityAt;
         if (document.visibilityState !== 'visible' || !document.hasFocus() || idleMs > 90000) return; // etkileşimsiz aralık sayılmaz
         window.FocusXP.heartbeat(_serverFocusSessionId);
     }, 45000);
 }
 function _stopFocusHeartbeat() {
     if (_focusHeartbeatInterval) { clearInterval(_focusHeartbeatInterval); _focusHeartbeatInterval = null; }
 }
 let alarmInterval = null;
 const alarmSound = {
     _playing: false,
     play() {
         if (this._playing) return Promise.resolve();
         this._playing = true;
         this._playBeep();
         alarmInterval = setInterval(() => this._playBeep(), 900);
         return Promise.resolve();
     },
     _playBeep() {
         try {
             const ctx = new (window.AudioContext || window.webkitAudioContext)();
             [880, 0, 880, 0, 1100].forEach((freq, i) => {
                 if (!freq) return;
                 const osc = ctx.createOscillator();
                 const g = ctx.createGain();
                 osc.connect(g); g.connect(ctx.destination);
                 osc.frequency.value = freq;
                 const t = ctx.currentTime + i * 0.12;
                 g.gain.setValueAtTime(0.3, t);
                 g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
                 osc.start(t); osc.stop(t + 0.1);
             });
         } catch (e) { console.warn('[FocusAI] sessiz hata:', e); }
     },
     pause()  { this._playing = false; clearInterval(alarmInterval); },
     get currentTime() { return 0; },
     set currentTime(v) {}
 };
 
 // Temsilci Dinleyici: Butonlar yenilense bile tıklamayı her zaman yakalar
 document.addEventListener('click', (e) => {
     if (e.target.closest('#premium-modal-confirm-btn') || e.target.closest('#premium-modal-cancel-btn') || e.target.closest('.modal-overlay')) {
         alarmSound.pause();
         alarmSound.currentTime = 0;
     }
 });
 
 const minutesDisplay = document.getElementById('minutes');
 const secondsDisplay = document.getElementById('seconds');
 const startBtn = document.getElementById('start-btn');
 const pauseBtn = document.getElementById('pause-btn');
 const resetBtn = document.getElementById('reset-btn');
 const finishEarlyBtn = document.getElementById('finish-early-btn');
 const modeBtns = document.querySelectorAll('.mode-btn');
 const timerCircle = document.querySelector('.timer-circle');
 const timerProgressRing = document.getElementById('timer-progress-ring');
 const nextStageBtn = document.getElementById('next-stage-btn');

 // Çember rengi moda göre değişsin: odaklanma (pomodoro/derin çalışma) mor,
 // kısa mola yeşil, uzun mola turuncu — bkz. style.css .timer-mode-*.
 function applyTimerModeColor(mode) {
     if (!timerCircle) return;
     timerCircle.classList.remove('timer-mode-focus', 'timer-mode-short', 'timer-mode-long');
     if (mode === 'pomodoro' || mode === 'ultradian') timerCircle.classList.add('timer-mode-focus');
     else if (mode === 'shortBreak') timerCircle.classList.add('timer-mode-short');
     else if (mode === 'longBreak') timerCircle.classList.add('timer-mode-long');
 }
 applyTimerModeColor(document.querySelector('.mode-btn.active')?.getAttribute('data-mode') || 'pomodoro');

 const focusQuotes = [
     "Başlamak için mükemmel olmak zorunda değilsin, ama mükemmel olmak için başlamak zorundasın.",
     "Zorluklar, başarının süsüdür. Odaklan ve aş.",
     "Odağını nereye verirsen, enerjin oraya akar.",
     "Küçük ve istikrarlı adımlar, en büyük dağları aşırır.",
     "Başarı, her gün tekrarlanan küçük çabaların toplamıdır."
 ];
 const quoteDisplay = document.getElementById('focus-quote');
 setInterval(() => {
     quoteDisplay.style.opacity = 0;
     setTimeout(() => {
         quoteDisplay.textContent = `"${focusQuotes[Math.floor(Math.random() * focusQuotes.length)]}"`;
         quoteDisplay.style.opacity = 1;
     }, 1400);
 }, 15000);
 
 function resetIdleTimer() {
     clearTimeout(idleTimeout);
     document.body.classList.remove('ghost-mode-active');
     // Hayalet Mod SADECE kullanıcı "Odak Modu"na bilinçli olarak bastığında
     // (focus-mode-active) devreye girmeli. Önceden sadece `isRunning` kontrol
     // ediliyordu; bu da zamanlayıcı Odak Modu'na hiç girilmeden başlatılır
     // başlatılmaz, 3sn hareketsizlikte ekranın "sadece süre ve söz kalacak
     // şekilde" soluklaşmasına yol açıyordu.
     if (isRunning && document.body.classList.contains('focus-mode-active')) {
         idleTimeout = setTimeout(() => {
             // Hayalet Mod sadece Zamanlayıcı sekmesindeyken uygulanmalı. Bu zamanlayıcı
             // (mousemove/keydown gibi) TÜM sayfada global dinleyicilere bağlı olduğundan,
             // kullanıcı zamanlayıcı çalışırken başka bir sekmede (örn. Sosyal) 3sn hareketsiz
             // kalırsa, oradaki .section-header (sıralama/seri listesi başlığı gibi) da
             // yanlışlıkla soluklaşıyordu — .ghost-mode-active kuralı sekmeye özgü değil, body
             // seviyesinde global.
             const timerTab = document.getElementById('zamanlayici');
             if (timerTab && timerTab.classList.contains('active') && document.body.classList.contains('focus-mode-active')) {
                 document.body.classList.add('ghost-mode-active');
             }
         }, 3000);
     }
 }
 
 ['mousemove', 'mousedown', 'keydown', 'touchstart'].forEach(evt => {
     document.addEventListener(evt, resetIdleTimer);
 });
 
 const focusModeBtn = document.getElementById('focus-mode-btn');
 const focusExitBtn = document.getElementById('focus-exit-btn');

 // Sosyal'daki "odak kalkanı" (sohbet + sıralama/seri kartının soluklaşması)
 // sadece kullanıcı gerçekten tam ekran Odak Modu'na girmişse/çıkmışsa yeniden
 // değerlendirilmeli — zamanlayıcının salt çalışıyor olması yeterli değil.
 function _syncSocialHushWithFocusMode() {
     if (!(window.FocusAISocial && typeof window.FocusAISocial.setFocusState === 'function')) return;
     const activeModeBtn = document.querySelector('.mode-btn.active');
     const activeMode = activeModeBtn ? activeModeBtn.getAttribute('data-mode') : null;
     const isFocusMode = isRunning && (activeMode === 'pomodoro' || activeMode === 'ultradian');
     window.FocusAISocial.setFocusState(isFocusMode, activeMode, isFocusMode ? _activeGroupSessionId : null);
 }

 function enterFocusMode() {
     document.body.classList.add('focus-mode-active');
     resetIdleTimer();
     _syncSocialHushWithFocusMode();
 }
 function exitFocusMode() {
     document.body.classList.remove('focus-mode-active');
     document.body.classList.remove('ghost-mode-active');
     clearTimeout(idleTimeout);
     _syncSocialHushWithFocusMode();
 }

 focusModeBtn.addEventListener('click', () => {
     if (document.body.classList.contains('focus-mode-active')) exitFocusMode();
     else enterFocusMode();
 });
 if (focusExitBtn) focusExitBtn.addEventListener('click', exitFocusMode);
 
// ============ ODAK SESLERİ MİKSER SİSTEMİ + SCENE BAR → script-ambient-sounds.js dosyasına taşındı ============
 
 function updateNavBadge() {
 const badge = document.getElementById('timer-nav-badge');
 const dockIcon = document.getElementById('dock-timer-icon');
 if (isRunning) {
     const m = Math.floor(timeLeft / 60);
     const s = timeLeft % 60;
     const timeStr = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
     if (badge) {
         badge.innerHTML = `<span class="tnb-dot"></span>${timeStr}`;
         badge.style.display = 'inline-flex';
     }
     // Dock ikonu (gerçek görünür sidebar) çalışırken yeşile döner.
     if (dockIcon) dockIcon.classList.add('timer-running');
 } else {
     if (badge) badge.style.display = 'none';
     if (dockIcon) dockIcon.classList.remove('timer-running');
 }
 _refreshDockTimerHoverPopup(); // açık duruyorsa (hover'da) içeriğini canlı güncelle
 }

 // Dock zamanlayıcı ikonunun üzerine gelince açılan popup — hangi sekmede olunursa olsun
 // "kaçıncı dakikadasın" bilgisini gösterir. .dock'un overflow-y:auto'su normal .tip
 // tooltip'ini (dock dışına taşan kısmını) kırptığı için ayrı, position:fixed bir katman.
 const _dockTimerIcon  = document.getElementById('dock-timer-icon');
 const _dockTimerPopup = document.getElementById('dock-timer-hover-popup');
 const _dockTimerPopupTitle = document.getElementById('dock-timer-hover-title');
 const _dockTimerPopupTime  = document.getElementById('dock-timer-hover-time');

 function _refreshDockTimerHoverPopup() {
 if (!_dockTimerPopup || _dockTimerPopup.classList.contains('hidden')) return;
 // Sadece zamanlayıcı gerçekten çalışırken popup göster — duraklatılmış/taze durumda
 // hover'da hiçbir şey çıkmamalı.
 if (!isRunning) {
     _dockTimerPopup.classList.add('hidden');
     return;
 }
 const activeBtn = document.querySelector('.mode-btn.active');
 const modeType = activeBtn ? activeBtn.getAttribute('data-mode') : 'pomodoro';
 const modeLabel = (modeType === 'shortBreak') ? 'Kısa Mola' : (modeType === 'longBreak') ? 'Uzun Mola' : 'Odaklanma';
 const m = Math.floor(timeLeft / 60), s = timeLeft % 60;
 if (_dockTimerPopupTitle) _dockTimerPopupTitle.textContent = `${modeLabel} çalışıyor`;
 if (_dockTimerPopupTime)  _dockTimerPopupTime.textContent  = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')} kaldı`;
 }

 if (_dockTimerIcon && _dockTimerPopup) {
 _dockTimerIcon.addEventListener('mouseenter', () => {
     if (!isRunning) return; // çalışmıyorken popup hiç gösterilmez
     const rect = _dockTimerIcon.getBoundingClientRect();
     _dockTimerPopup.style.top = Math.round(rect.top) + 'px';
     _dockTimerPopup.style.left = Math.round(rect.right + 10) + 'px';
     _dockTimerPopup.classList.remove('hidden');
     _refreshDockTimerHoverPopup();
 });
 _dockTimerIcon.addEventListener('mouseleave', () => {
     _dockTimerPopup.classList.add('hidden');
 });
 }
 
 function updateTimerDisplay() {
     const m = Math.floor(timeLeft / 60); const s = timeLeft % 60;
     minutesDisplay.textContent = String(m).padStart(2, '0');
     secondsDisplay.textContent = String(s).padStart(2, '0');
     updateNavBadge();
     
     // --- YENİ EKLENEN: ÇEMBER ERİME ANİMASYONU ---
     if (timerProgressRing) {
         const circumference = 691.15;
         const percent = timeLeft / totalTime;
         const offset = circumference - (percent * circumference);
         timerProgressRing.style.strokeDashoffset = offset;
     }
     updateTimerProfileBarVisibility();
 }
 
 function startTimer() {
     if (!isRunning && timeLeft > 0) {
         
         if ("Notification" in window && Notification.permission === "default") {
             Notification.requestPermission();
         }
 
         isRunning = true;
         startBtn.classList.add('hidden'); pauseBtn.classList.remove('hidden');
         if (finishEarlyBtn) finishEarlyBtn.classList.remove('hidden'); // Erken bitirme butonunu göster
         timerCircle.classList.add('running'); timerCircle.classList.remove('paused');
         resetIdleTimer();
 
         const activeMode = document.querySelector('.mode-btn.active').getAttribute('data-mode');
         if (activeMode === 'shortBreak' || activeMode === 'longBreak') {
             timerCircle.classList.add('breathing-active');
         }

         // Sunucu tarafı odak XP doğrulaması (057): taze bir odak başlangıcında
         // (mola değil, ve daha önce duraklatılmış bir seansın devamı değil)
         // sunucuda zaman damgalı bir seans aç. Duraklat/devam et arasında
         // aynı seans kimliği korunur — resetTimer/mod değişimi sıfırlar.
         if ((activeMode === 'pomodoro' || activeMode === 'ultradian') && timeLeft === totalTime && !_serverFocusSessionId) {
             if (window.FocusXP && typeof window.FocusXP.startFocusSession === 'function') {
                 window.FocusXP.startFocusSession().then(id => {
                     _serverFocusSessionId = id;
                     _lastUserActivityAt = Date.now(); // seans başlangıcı = etkileşim anı
                     _startFocusHeartbeat();
                 });
             }
         }

         // Grup panellerindeki "Canlı Çalışan Üyeler" gerçek odaklanma durumunu
         // yansıtsın diye sadece odaklanma modlarında (mola değil) presence'ı işaretle.
         // Bir grup seansından başlatıldıysa sessionId de eklenir — böylece grup takviminde
         // "şu an bu seansa kimler odaklanıyor" canlı olarak gösterilebilir.
         if (window.FocusAISocial && typeof window.FocusAISocial.setFocusState === 'function') {
             const isFocusMode = activeMode === 'pomodoro' || activeMode === 'ultradian';
             window.FocusAISocial.setFocusState(isFocusMode, activeMode, isFocusMode ? _activeGroupSessionId : null);
         }

         endTime = Date.now() + (timeLeft * 1000);
         // Sıfırla/Sıradaki Aşama görünürlüğünü, dock ikonunun yeşile dönmesini ve kaydedilen
         // çalışma durumunu (endTime dahil) setInterval'ın ilk tick'ini (≈1sn) beklemeden hemen
         // güncelle. NOT: bu çağrı endTime hesaplanmadan ÖNCE yapılırsa, kaydedilen durum eski/sıfır
         // bir endTime taşır — kullanıcı tam o anda sayfayı yenilerse zamanlayıcı sıfırlanırdı.
         updateTimerDisplay();
 
         timerInterval = setInterval(() => {
             timeLeft = Math.round((endTime - Date.now()) / 1000);
             
             if (timeLeft <= 0) {
                 timeLeft = 0; 
                 updateTimerDisplay(); 
                 
                 clearInterval(timerInterval); isRunning = false;
                 if (window.FocusAISocial && typeof window.FocusAISocial.setFocusState === 'function') {
                     window.FocusAISocial.setFocusState(false, null);
                 }
                 _activeGroupSessionId = null;
                 timerCircle.classList.remove('running');
                 timerCircle.classList.remove('paused');
                 timerCircle.classList.remove('breathing-active');
                 startBtn.classList.remove('hidden'); pauseBtn.classList.add('hidden');
                 
                 clearTimeout(idleTimeout); 
                 document.body.classList.remove('ghost-mode-active');
                 
                 alarmSound.play().catch(e => console.log("Tarayıcı sesi engelledi."));
                 if ("Notification" in window && Notification.permission === "granted") {
                     new Notification("Zamanlayıcı Bitti!", { 
                         body: "Odaklanma veya mola süren tamamlandı.",
                         icon: "https://cdn-icons-png.flaticon.com/512/4305/4305432.png"
                     });
                 }
                 
                 const activeBtn = document.querySelector('.mode-btn.active');
                 const modeType = activeBtn.getAttribute('data-mode'); 
                 
                 if(modeType === 'pomodoro' || modeType === 'ultradian') {
                     const modeMins = parseInt(activeBtn.getAttribute('data-time'));
                     totalFocusMinutes += modeMins;
                     FocusStorage.set('focus_minutes', totalFocusMinutes);
                     if (window.FocusXP) window.FocusXP.finishFocusSession(_serverFocusSessionId, modeMins);
                     _serverFocusSessionId = null;
                     _stopFocusHeartbeat();

                     if (window.FocusAISocial && typeof window.FocusAISocial.postActivity === 'function') {
                         window.FocusAISocial.postActivity(`${modeMins} dakika odaklandı ⏱️`);
                     }

                     // Günlük odak ve kategori geçmişini hafızaya ekleyen akıllı motor
                     const todayDateStr = formatDateToString(new Date());
                     let focusHistory = FocusStorage.get('focus_history', {});
                     focusHistory[todayDateStr] = (focusHistory[todayDateStr] || 0) + modeMins;
                     FocusStorage.set('focus_history', focusHistory);
 
                     let activeCategory = 'kategorisiz';
                     if (getActiveFocusTaskRef()) {
                         if (getActiveFocusTaskRef() !== 'highlight-task') {
                             const focusedTask = getTasksRef().find(t => String(t.id) === String(getActiveFocusTaskRef()));
                             if (focusedTask && focusedTask.category) activeCategory = focusedTask.category;
                         } else {
                             activeCategory = 'kisisel';
                         }
                     }
                     let categoryFocus = FocusStorage.get('category_focus', {});
                     if (!categoryFocus[todayDateStr]) categoryFocus[todayDateStr] = {};
                     categoryFocus[todayDateStr][activeCategory] = (categoryFocus[todayDateStr][activeCategory] || 0) + modeMins;
                     FocusStorage.set('category_focus', categoryFocus);
                     // Saatlik odak dağılımı için saat kaydı
                     const currentHour = String(new Date().getHours()).padStart(2, '0');
                     let focusHours = FocusStorage.get('focus_hours', {});
                     if (!focusHours[todayDateStr]) focusHours[todayDateStr] = {};
                     focusHours[todayDateStr][currentHour] = (focusHours[todayDateStr][currentHour] || 0) + modeMins;
                     FocusStorage.set('focus_hours', focusHours);
                     if(getRenderStatisticsRef() && document.getElementById('istatistikler').classList.contains('active')) getRenderStatisticsRef()();
                     if(getRenderSocialStatsRef() && document.getElementById('arkadaslar').classList.contains('active')) getRenderSocialStatsRef()();
 
                     // --- HEDEFE ODAK SÜRESİ EKLEME ---
                     if(getActiveFocusTaskRef() && getActiveFocusTaskRef() !== 'highlight-task') {
                         const focusedTask = getTasksRef().find(t => String(t.id) === String(getActiveFocusTaskRef()));
                         if(focusedTask && focusedTask.parentGoal) {
                             const goalToCredit = getGoalsRef().find(g => String(g.id) === String(focusedTask.parentGoal));
                             if(goalToCredit) {
                                 goalToCredit.focusTime = (goalToCredit.focusTime || 0) + modeMins;
                                 Store.goals.set(getGoalsRef());
                                 if(typeof renderGoals === 'function') renderGoals();
                                 if(!document.getElementById('goal-details-modal').classList.contains('hidden') && document.getElementById('detail-active-goal-id').value === String(goalToCredit.id)) {
                                     updateGoalDetailsUI(goalToCredit.id);
                                 }
                             }
                         }
                     }
                     // ----------------------------------------------
                     // ----------------------------------------------
                     
                     // Sonraki mola türünü belirle
                     let breakType = 'shortBreak';
                     if(modeType === 'ultradian') {
                         breakType = 'longBreak';
                     } else {
                         pomodoroCount++;
                         const tc = timerSettings.targetCycles || 4;
                         let currentLoop = pomodoroCount % tc === 0 ? tc : pomodoroCount % tc;
                         const loopSpan = document.getElementById('loop-count');
                         if (loopSpan) loopSpan.textContent = currentLoop;
                         if (pomodoroCount % tc === 0) breakType = 'longBreak';
                     }
 
                     // --- YENİ: GÖREV SEÇİLİYSE SORU SOR, DEĞİLSE DİREKT MOLAYA GEÇ ---
                     if(getActiveFocusTaskRef()) {
                         window.__nextBreakMode = breakType;
                         document.getElementById('task-complete-check-modal').classList.remove('hidden');
                     } else {
                         if (timerSettings.autoStart) {
                             // Otomatik geçiş: sessizce moda geç ve başlat
                             document.querySelector(`.mode-btn[data-mode="${breakType}"]`).click();
                             setTimeout(() => startTimer(), 300);
                         } else {
                             if (breakType === 'longBreak') {
                                 showPremiumModal({ title: 'Harika!', message: 'Uzun bir molayı hak ettin.', type: 'success' });
                             } else {
                                 showPremiumModal({ title: 'Tebrikler!', message: 'Bir seansı tamamladın! Şimdi kısa mola zamanı.', type: 'success' });
                             }
                             document.querySelector(`.mode-btn[data-mode="${breakType}"]`).click();
                         }
                     }

                 } else {
                     if (timerSettings.autoStart) {
                         // Mola bitti, otomatik odaklanmaya geç
                         document.querySelector('.mode-btn[data-mode="pomodoro"]').click();
                         setTimeout(() => startTimer(), 300);
                     } else {
                         showPremiumModal({ title: 'Mola Bitti!', message: 'Tekrar odaklanma zamanı. Hadi başlayalım!', type: 'info' });
                         document.querySelector('.mode-btn[data-mode="pomodoro"]').click();
                     }
                 }
             } else {
                 updateTimerDisplay(); 
             }
         }, 1000);
     }
 }
 
 function pauseTimer() {
     clearInterval(timerInterval); isRunning = false;
     if (window.FocusAISocial && typeof window.FocusAISocial.setFocusState === 'function') {
         window.FocusAISocial.setFocusState(false, null);
     }
     startBtn.classList.remove('hidden'); pauseBtn.classList.add('hidden');
     timerCircle.classList.add('paused');
     timerCircle.classList.remove('breathing-active'); // Duraklatıldığında animasyonu kaldır
     clearTimeout(idleTimeout); document.body.classList.remove('ghost-mode-active');
     updateNavBadge();
     _syncTimerRunState(); // duraklatılan ilerlemeyi hemen kaydet — aksi halde yenilemede eski "çalışıyor" durumu geri gelirdi
 }

 function resetTimer() {
     pauseTimer(); const active = document.querySelector('.mode-btn.active');
     totalTime = parseInt(active.getAttribute('data-time')) * 60;
     timeLeft = totalTime;
     updateTimerDisplay();
     if (finishEarlyBtn) finishEarlyBtn.classList.add('hidden'); // Sıfırlanınca butonu gizle
     _activeGroupSessionId = null;
     _serverFocusSessionId = null; // XP verilmeden vazgeçildi — sunucudaki açık seans 6 saat sonra kendiliğinden temizlenir
     _stopFocusHeartbeat();
 }

 // Uygulamanın kendi içinden (goToNextStage, otomatik faz geçişleri vb.) zaten
 // kendi onayını almış bir .mode-btn .click() tetiklendiğinde ikinci bir "emin misin"
 // sorusu çıkmasın diye bu bayrak bir sonraki tıklamayı sorgusuz geçirir.
 let _skipModeSwitchConfirm = false;

 function _switchTimerMode(btn) {
     _activeGroupSessionId = null; // kullanıcı elle başka bir moda geçti — artık grup seansına bağlı değil
     _serverFocusSessionId = null; // mod değişti — eski seans XP'siz kaldı, sunucuda 6 saat sonra kendiliğinden temizlenir
     _stopFocusHeartbeat();
     modeBtns.forEach(b => b.classList.remove('active')); btn.classList.add('active');
     pauseTimer();
     totalTime = parseInt(btn.getAttribute('data-time')) * 60;
     timeLeft = totalTime;
     updateTimerDisplay();
     applyTimerModeColor(btn.getAttribute('data-mode'));
 }

 modeBtns.forEach(btn => {
     // gf-* overlay butonları (data-phase) bireysel zamanlayıcıyı etkilememelidir
     if (btn.hasAttribute('data-phase') && !btn.hasAttribute('data-mode')) return;
     btn.addEventListener('click', () => {
         // Zaten aktif olan moda tekrar basmak hiçbir şeyi değiştirmemeli.
         if (btn.classList.contains('active')) return;
         if (_skipModeSwitchConfirm) {
             _skipModeSwitchConfirm = false;
             _switchTimerMode(btn);
             return;
         }
         // Bu aşamada kaydedilmiş ilerleme varsa (sıfırlama butonuyla aynı mantık),
         // mod değiştirmeden önce kullanıcıya sor — aksi halde sessizce siliniyordu.
         // timeLeft === 0 (süre doğal olarak bittiğinde otomatik mola/odak geçişi) hariç —
         // o durumda seans zaten kredilendirilmiş, sorulmadan geçilmeli.
         if (isRunning || (timeLeft > 0 && timeLeft !== totalTime)) {
             showPremiumModal({
                 title: 'Modu Değiştir',
                 message: 'Bu aşamada kaydettiğin ilerleme silinecek. Moda geçmek istediğine emin misin?',
                 type: 'warning',
                 showCancel: true,
                 confirmText: 'Geç',
                 cancelText: 'Vazgeç',
                 onConfirm: () => _switchTimerMode(btn)
             });
         } else {
             _switchTimerMode(btn);
         }
     });
 });

 startBtn.addEventListener('click', startTimer);
 pauseBtn.addEventListener('click', pauseTimer);

 // Sıfırlama, o ana kadar bu aşamada geçen süreyi siler — sadece kaybedilecek
 // bir ilerleme varsa (taze/hiç başlamamış bir sayaçta gereksiz yere sormadan) uyarı gösterilir.
 resetBtn.addEventListener('click', () => {
     if (timeLeft !== totalTime) {
         showPremiumModal({
             title: 'Zamanlayıcıyı Sıfırla',
             message: 'Bu aşamada kaydettiğin ilerleme silinecek. Sıfırlamak istediğine emin misin?',
             type: 'warning',
             showCancel: true,
             confirmText: 'Sıfırla',
             cancelText: 'Vazgeç',
             onConfirm: resetTimer
         });
     } else {
         resetTimer();
     }
 });

 // Erken bitirme ve "Sıradaki Aşama"nın ortak kullandığı kredilendirme mantığı:
 // o ana kadar odaklanmada geçen dakikayı istatistiklere/XP'ye/hedefe işler.
 function creditFocusMinutes(minutesSpent) {
     totalFocusMinutes += minutesSpent;
     FocusStorage.set('focus_minutes', totalFocusMinutes);
     if (window.FocusXP) window.FocusXP.finishFocusSession(_serverFocusSessionId, minutesSpent);
     _serverFocusSessionId = null;
     _stopFocusHeartbeat();

     const todayDateStr = formatDateToString(new Date());
     let focusHistory = FocusStorage.get('focus_history', {});
     focusHistory[todayDateStr] = (focusHistory[todayDateStr] || 0) + minutesSpent;
     FocusStorage.set('focus_history', focusHistory);

     let activeCategory = 'kategorisiz';
     if (getActiveFocusTaskRef()) {
         if (getActiveFocusTaskRef() !== 'highlight-task') {
             const focusedTask = getTasksRef().find(t => String(t.id) === String(getActiveFocusTaskRef()));
             if (focusedTask && focusedTask.category) activeCategory = focusedTask.category;
         } else {
             activeCategory = 'kisisel';
         }
     }
     let categoryFocus = FocusStorage.get('category_focus', {});
     if (!categoryFocus[todayDateStr]) categoryFocus[todayDateStr] = {};
     categoryFocus[todayDateStr][activeCategory] = (categoryFocus[todayDateStr][activeCategory] || 0) + minutesSpent;
     FocusStorage.set('category_focus', categoryFocus);

     const currentHour = String(new Date().getHours()).padStart(2, '0');
     let focusHours = FocusStorage.get('focus_hours', {});
     if (!focusHours[todayDateStr]) focusHours[todayDateStr] = {};
     focusHours[todayDateStr][currentHour] = (focusHours[todayDateStr][currentHour] || 0) + minutesSpent;
     FocusStorage.set('focus_hours', focusHours);

     if (getActiveFocusTaskRef() && getActiveFocusTaskRef() !== 'highlight-task') {
         const focusedTask = getTasksRef().find(t => String(t.id) === String(getActiveFocusTaskRef()));
         if (focusedTask && focusedTask.parentGoal) {
             const goalToCredit = getGoalsRef().find(g => String(g.id) === String(focusedTask.parentGoal));
             if (goalToCredit) {
                 goalToCredit.focusTime = (goalToCredit.focusTime || 0) + minutesSpent;
                 Store.goals.set(getGoalsRef());
                 if (typeof renderGoals === 'function') renderGoals();
                 if (!document.getElementById('goal-details-modal').classList.contains('hidden') &&
                     document.getElementById('detail-active-goal-id').value === String(goalToCredit.id)) {
                     updateGoalDetailsUI(goalToCredit.id);
                 }
             }
         }
     }

     if (window.FocusAISocial && typeof window.FocusAISocial.postActivity === 'function') {
         window.FocusAISocial.postActivity(`${minutesSpent} dakika odaklandı ⏱️`);
     }
     if (getRenderStatisticsRef() && document.getElementById('istatistikler').classList.contains('active')) getRenderStatisticsRef()();
     if (getRenderSocialStatsRef() && document.getElementById('arkadaslar').classList.contains('active')) getRenderSocialStatsRef()();
 }

 // "Sıradaki Aşama": mevcut aşamayı (odaklanma/mola) bitirmeyi beklemeden bir
 // sonraki mantıklı aşamaya atlar — odaklanmadan sonra sırası gelen molaya
 // (kısa/uzun, döngü sayısına göre), moladan sonra tekrar odaklanmaya geçer.
 // Odaklanma modundan çıkılıyorsa o ana kadar geçen süre "erken bitirme" gibi
 // kaydedilir (istatistik/XP/hedef); moladan çıkışta kaydedilecek bir şey yoktur.
 function goToNextStage() {
     const activeBtn = document.querySelector('.mode-btn.active');
     if (!activeBtn) return;
     const modeType = activeBtn.getAttribute('data-mode');

     if (modeType === 'pomodoro' || modeType === 'ultradian') {
         const secondsSpent = totalTime - timeLeft;
         const minutesSpent = Math.floor(secondsSpent / 60);
         if (minutesSpent > 0) creditFocusMinutes(minutesSpent);
         else { _serverFocusSessionId = null; _stopFocusHeartbeat(); }
     } else {
         _serverFocusSessionId = null;
         _stopFocusHeartbeat();
     }

     let nextMode;
     if (modeType === 'pomodoro') {
         pomodoroCount++;
         const tc = (typeof timerSettings !== 'undefined' && timerSettings.targetCycles) || 4;
         const currentLoop = pomodoroCount % tc === 0 ? tc : pomodoroCount % tc;
         const loopSpan = document.getElementById('loop-count');
         if (loopSpan) loopSpan.textContent = currentLoop;
         nextMode = (pomodoroCount % tc === 0) ? 'longBreak' : 'shortBreak';
     } else if (modeType === 'ultradian') {
         nextMode = 'longBreak';
     } else {
         nextMode = 'pomodoro';
     }
     const nextBtn = document.querySelector(`.mode-btn[data-mode="${nextMode}"]`);
     // nextStageBtn zaten kendi onayını aldı — mode-btn handler'ı ikinci kez sormasın.
     if (nextBtn) { _skipModeSwitchConfirm = true; nextBtn.click(); }
 }
 // Uyarı metni moda göre değişir: odaklanmadan çıkarken geçen süre kaydedileceği
 // belirtilir, moladan çıkarken sadece molanın kesileceği belirtilir. Taze/hiç
 // başlamamış bir sayaçta (kaybedilecek ilerleme yokken) hiç sorulmadan geçilir.
 if (nextStageBtn) {
     nextStageBtn.addEventListener('click', () => {
         const activeBtn = document.querySelector('.mode-btn.active');
         const modeType = activeBtn ? activeBtn.getAttribute('data-mode') : null;
         const isFocusMode = modeType === 'pomodoro' || modeType === 'ultradian';

         if (timeLeft !== totalTime) {
             let message;
             if (isFocusMode) {
                 const minutesSpent = Math.floor((totalTime - timeLeft) / 60);
                 message = minutesSpent > 0
                     ? `Mevcut odaklanman (${minutesSpent} dakika) kaydedilecek ve sıradaki aşamaya geçilecek. Devam etmek istiyor musun?`
                     : 'Henüz 1 dakika bile tamamlanmadı, bu yüzden kaydedilecek bir süre yok. Yine de sıradaki aşamaya geçmek istiyor musun?';
             } else {
                 message = 'Molan burada kesilecek ve odaklanma aşamasına geçilecek. Devam etmek istiyor musun?';
             }
             showPremiumModal({
                 title: 'Sıradaki Aşamaya Geç',
                 message,
                 type: 'warning',
                 showCancel: true,
                 confirmText: 'Geç',
                 cancelText: 'Vazgeç',
                 onConfirm: goToNextStage
             });
         } else {
             goToNextStage();
         }
     });
 }

 // Grup seans takvimi gibi dış modüllerin "Şimdi Başla" aksiyonuyla zamanlayıcıyı
 // planlanan seans süresine göre kurup otomatik başlatabilmesi için açılan köprü.
 // "Odaklanma" (pomodoro) düğmesinin süresini geçici olarak seans süresine çeker —
 // tıpkı zamanlayıcı ayarlarının yaptığı gibi (bkz. applyTimerSettings) — böylece
 // tamamlanınca eklenen istatistikler de gerçek seans süresini yansıtır.
 window.startGroupFocusSession = function(minutes, sessionId) {
     const mins = Math.max(1, Math.round(minutes || 25));
     const pomodoroBtn = document.querySelector('.mode-btn[data-mode="pomodoro"]');
     if (!pomodoroBtn) return false;
     if (isRunning) pauseTimer();
     modeBtns.forEach(b => b.classList.remove('active'));
     pomodoroBtn.classList.add('active');
     pomodoroBtn.setAttribute('data-time', mins);
     totalTime = mins * 60;
     timeLeft = totalTime;
     updateTimerDisplay();
     applyTimerModeColor('pomodoro');
     if (finishEarlyBtn) finishEarlyBtn.classList.add('hidden');
     _activeGroupSessionId = sessionId || null;
     _serverFocusSessionId = null; // taze seans — startTimer() sunucuda yeni bir tane açacak
     _stopFocusHeartbeat();
     startTimer();
     return true;
 };
 if (finishEarlyBtn) {
     finishEarlyBtn.addEventListener('click', () => {
         // Eğer süre hiç başlamadıysa veya zaten sıfırdaysa işlem yapma
         if (timeLeft === totalTime) return;
 
        // Kronometrenin durduğu ana kadar harcanan net süreyi (saniye ve dakika) hesapla
        const secondsSpent = totalTime - timeLeft;
        const minutesSpent = Math.floor(secondsSpent / 60);

        if (minutesSpent > 0) {
            creditFocusMinutes(minutesSpent);
            showPremiumModal({
                title: 'Odaklanma Tamamlandı ⏱️',
                message: `Oturumu erken bitirmene rağmen, kazandığın ${minutesSpent} dakikalık derin odaklanma süresi tüm hedeflerine ve istatistiklerine başarıyla işlendi!`,
                type: 'success'
            });
        } else {
            showPremiumModal({
                title: 'Süre Çok Kısa',
                message: 'Henüz 1 dakika bile tamamlanmadığı için süre kaydedilmedi. İvme kazanmak için biraz daha odaklanmayı dene!',
                type: 'info'
            });
        }
 
         // Zamanlayıcıyı pürüzsüzce sıfırla ve kapat
         pauseTimer();
         const activeMode = document.querySelector('.mode-btn.active');
         totalTime = parseInt(activeMode.getAttribute('data-time')) * 60;
         timeLeft = totalTime;
         updateTimerDisplay();
         finishEarlyBtn.classList.add('hidden');
         clearFocusMode(); // Aktif odak seçimini temizle
 
         // Sayfa yenilenmeden İstatistikleri ve Arkadaşlar panelini anlık güncelle
         if (getRenderStatisticsRef() && document.getElementById('istatistikler').classList.contains('active')) getRenderStatisticsRef()();
         if (getRenderSocialStatsRef() && document.getElementById('arkadaslar').classList.contains('active')) getRenderSocialStatsRef()();
     });
 }
 
 // --- ZAMANLAYICI PROFİLLERİ (eski sabit Odaklanma/Derin Çalışma/Kısa-Uzun Mola
 // butonlarının yerini alan, kullanıcı tanımlı profil sistemi) ---
 // NOT: Faz motoru (odaklanma<->mola otomatik geçişleri, döngü sayacı, grup
 // seansları vb.) hâlâ gizlenmiş .mode-btn'lerin data-time/active durumuna dayanıyor —
 // bu yüzden o mekanizmaya dokunmadık. Bir profil sadece bu gizli butonların
 // data-time değerlerini ve döngü sayısını besliyor (applyTimerSettings üzerinden).
 const timerSettingsModal      = document.getElementById('timer-settings-modal');
 const timerProfileModalTitle  = document.getElementById('timer-profile-modal-title');
 const closeTimerSettingsBtn   = document.getElementById('close-timer-settings-btn');
 const saveTimerSettingsBtn    = document.getElementById('save-timer-settings-btn');
 const deleteTimerProfileBtn   = document.getElementById('delete-timer-profile-btn');
 const timerProfileBar         = document.getElementById('timer-profile-bar');
 const timerProfileCards       = document.getElementById('timer-profile-cards');
 const timerProfileAddBtn      = document.getElementById('timer-profile-add-btn');
 const timerActiveProfilePill  = document.getElementById('timer-active-profile-pill');
 const activeProfilePillName   = document.getElementById('active-profile-pill-name');

 const settingProfileName      = document.getElementById('setting-profile-name');
 const settingProfileNameCount = document.getElementById('setting-profile-name-count');
 const PROFILE_NAME_MAX_LEN = 24;
 if (settingProfileName) {
     settingProfileName.addEventListener('input', () => {
         const len = settingProfileName.value.length;
         if (settingProfileNameCount) {
             settingProfileNameCount.textContent = `${len}/${PROFILE_NAME_MAX_LEN}`;
             settingProfileNameCount.style.color = len >= PROFILE_NAME_MAX_LEN ? '#fdcb6e' : 'var(--text-muted)';
         }
     });
 }
 const settingPomodoro     = document.getElementById('setting-pomodoro');
 const settingShortBreak   = document.getElementById('setting-shortBreak');
 const settingLongBreak    = document.getElementById('setting-longBreak');
 const settingTargetCycles = document.getElementById('setting-targetCycles');
 const settingAutoStart    = document.getElementById('setting-autoStart');

 const MAX_TIMER_PROFILES = 5;

 // 1. Profilleri hafızadan çek — yoksa psikologların/araştırmaların önerdiği
 // iki hazır profille tohumla: Klasik Pomodoro (Cirillo Tekniği) ve
 // Ultradiyen Ritim (Kleitman'ın temel dinlenme-aktivite döngüsü araştırmasına dayanan derin çalışma bloğu).
 let timerProfiles = FocusStorage.get('timer_profiles', null);
 if (!Array.isArray(timerProfiles) || timerProfiles.length === 0) {
     timerProfiles = [
         { id: generateId(), name: 'Klasik Pomodoro', focus: 25, shortBreak: 5, longBreak: 15, cycles: 4 },
         { id: generateId(), name: 'Derin Çalışma', focus: 90, shortBreak: 20, longBreak: 20, cycles: 2 },
     ];
     FocusStorage.set('timer_profiles', timerProfiles);
 } else {
     // Migrasyon: eski varsayılan profil adı sadeleştirildi
     let _renamed = false;
     timerProfiles.forEach(p => {
         if (p.name === 'Derin Çalışma (Ultradiyen Ritim)') { p.name = 'Derin Çalışma'; _renamed = true; }
     });
     if (_renamed) FocusStorage.set('timer_profiles', timerProfiles);
 }

 let activeTimerProfileId = FocusStorage.get('active_timer_profile_id', null);
 if (!activeTimerProfileId || !timerProfiles.some(p => p.id === activeTimerProfileId)) {
     activeTimerProfileId = timerProfiles[0].id;
     FocusStorage.set('active_timer_profile_id', activeTimerProfileId);
 }

 // timerSettings artık sadece autoStart (genel, profile bağlı olmayan bir davranış) için
 // kalıcı — pomodoro/shortBreak/longBreak/targetCycles alanları aktif profilden türetilir.
 let timerSettings = FocusStorage.get('timer_settings', { autoStart: false });
 if (timerSettings.autoStart === undefined) timerSettings.autoStart = false;

 function applyTimerSettings() {
     document.querySelector('.mode-btn[data-mode="pomodoro"]').setAttribute('data-time', timerSettings.pomodoro);
     document.querySelector('.mode-btn[data-mode="shortBreak"]').setAttribute('data-time', timerSettings.shortBreak);
     document.querySelector('.mode-btn[data-mode="longBreak"]').setAttribute('data-time', timerSettings.longBreak);

     // Pomodoro sayacı gösterimini tur sayısına göre güncelle
     const counterEl = document.getElementById('pomodoro-counter');
     if (counterEl) {
         const loopSpan = document.getElementById('loop-count');
         const curLoop = loopSpan ? loopSpan.textContent : '0';
         counterEl.innerHTML = `<i class="fa-solid fa-repeat"></i> Döngü: <span id="loop-count">${curLoop}</span>/${timerSettings.targetCycles}`;
     }

     // Sayaç çalışmıyorsa ekrandaki süreyi güncelle
     if (!isRunning) {
         const activeModeBtn = document.querySelector('.mode-btn.active');
         totalTime = parseInt(activeModeBtn.getAttribute('data-time')) * 60;
         timeLeft = totalTime;
         updateTimerDisplay();
     }
 }

 // Aktif profili sisteme uygula + arayüzü tazele
 function applyActiveProfile() {
     const p = timerProfiles.find(x => x.id === activeTimerProfileId) || timerProfiles[0];
     if (!p) return;
     timerSettings.pomodoro     = p.focus;
     timerSettings.shortBreak   = p.shortBreak;
     timerSettings.longBreak    = p.longBreak;
     timerSettings.targetCycles = p.cycles;
     applyTimerSettings();
     renderTimerProfiles();
     updateActiveProfilePill();
 }

 function updateActiveProfilePill() {
     const p = timerProfiles.find(x => x.id === activeTimerProfileId);
     if (activeProfilePillName && p) activeProfilePillName.textContent = p.name;
 }

 // Zamanlayıcı "taze" (henüz başlamamış / ilerlemesi olmayan) durumdaysa profil
 // çubuğunu, aksi halde (çalışıyor ya da duraklatılmış ilerleme varsa) sadece
 // aktif profilin adını gösteren küçük bir rozeti göster.
 function updateTimerProfileBarVisibility() {
     if (!timerProfileBar || !timerActiveProfilePill) return;
     const fresh = typeof isRunning !== 'undefined' && !isRunning && timeLeft === totalTime;
     timerProfileBar.classList.toggle('hidden', !fresh);
     timerActiveProfilePill.classList.toggle('hidden', fresh);
     // Taze (henüz hiç başlamamış) durumda sadece "Başlat" görünsün; Sıfırla/Sıradaki
     // Aşama ancak bir seans başladıktan/ilerleme kaydedildikten sonra ortaya çıksın.
     if (resetBtn)      resetBtn.classList.toggle('hidden', fresh);
     if (nextStageBtn)  nextStageBtn.classList.toggle('hidden', fresh);
     _syncTimerRunState();
 }

 function renderTimerProfiles() {
     if (!timerProfileCards) return;
     timerProfileCards.innerHTML = '';
     timerProfiles.forEach(p => {
         const card = document.createElement('div');
         card.className = 'timer-profile-card' + (p.id === activeTimerProfileId ? ' active' : '');
         card.dataset.profileId = p.id;
         card.innerHTML = `
             <div class="tpc-name">${escapeHtml(p.name)}</div>
             <div class="tpc-meta">
                 <span title="Odaklanma"><i class="fa-solid fa-bullseye"></i> ${p.focus}dk</span>
                 <span title="Kısa Mola"><i class="fa-solid fa-mug-hot"></i> ${p.shortBreak}dk</span>
                 <span title="Uzun Mola"><i class="fa-solid fa-couch"></i> ${p.longBreak}dk</span>
             </div>
             <div class="tpc-actions">
                 <button class="tpc-edit-btn" title="Düzenle"><i class="fa-solid fa-pen"></i></button>
                 <button class="tpc-del-btn" title="Sil"><i class="fa-solid fa-trash"></i></button>
             </div>
         `;
         card.addEventListener('click', (e) => {
             if (e.target.closest('.tpc-edit-btn') || e.target.closest('.tpc-del-btn')) return;
             if (p.id === activeTimerProfileId || isRunning) return;
             activeTimerProfileId = p.id;
             FocusStorage.set('active_timer_profile_id', activeTimerProfileId);
             applyActiveProfile();
         });
         card.querySelector('.tpc-edit-btn').addEventListener('click', (e) => {
             e.stopPropagation();
             openTimerProfileModal(p.id);
         });
         card.querySelector('.tpc-del-btn').addEventListener('click', (e) => {
             e.stopPropagation();
             deleteTimerProfile(p.id);
         });
         timerProfileCards.appendChild(card);
     });
     if (timerProfileAddBtn) timerProfileAddBtn.disabled = timerProfiles.length >= MAX_TIMER_PROFILES;
 }

 let _editingTimerProfileId = null; // null = yeni profil oluşturuluyor

 function openTimerProfileModal(profileId) {
     if (!timerSettingsModal) return;
     if (profileId) {
         const p = timerProfiles.find(x => x.id === profileId);
         if (!p) return;
         _editingTimerProfileId = p.id;
         if (settingProfileName) settingProfileName.value = p.name;
         settingPomodoro.value  = p.focus;
         settingShortBreak.value = p.shortBreak;
         settingLongBreak.value  = p.longBreak;
         if (settingTargetCycles) settingTargetCycles.value = p.cycles;
         if (timerProfileModalTitle) timerProfileModalTitle.innerHTML = '<i class="fa-solid fa-gear" style="color: var(--primary-color);"></i> Profili Düzenle';
         if (deleteTimerProfileBtn) deleteTimerProfileBtn.classList.remove('hidden');
     } else {
         if (timerProfiles.length >= MAX_TIMER_PROFILES) {
             showPremiumModal({ title: 'Profil Limiti Doldu', message: `En fazla ${MAX_TIMER_PROFILES} zamanlayıcı profili oluşturabilirsin. Yeni bir profil eklemeden önce kullanmadığın birini silebilirsin.`, type: 'warning' });
             return;
         }
         _editingTimerProfileId = null;
         if (settingProfileName) settingProfileName.value = '';
         settingPomodoro.value  = 25;
         settingShortBreak.value = 5;
         settingLongBreak.value  = 15;
         if (settingTargetCycles) settingTargetCycles.value = 4;
         if (timerProfileModalTitle) timerProfileModalTitle.innerHTML = '<i class="fa-solid fa-gear" style="color: var(--primary-color);"></i> Yeni Zamanlayıcı Profili';
         if (deleteTimerProfileBtn) deleteTimerProfileBtn.classList.add('hidden');
     }
     if (settingAutoStart) settingAutoStart.checked = timerSettings.autoStart;
     if (settingProfileNameCount) {
         const len = settingProfileName ? settingProfileName.value.length : 0;
         settingProfileNameCount.textContent = `${len}/${PROFILE_NAME_MAX_LEN}`;
         settingProfileNameCount.style.color = 'var(--text-muted)';
     }
     timerSettingsModal.classList.remove('hidden');
 }

 function deleteTimerProfile(id) {
     if (timerProfiles.length <= 1) {
         showPremiumModal({ title: 'Son Profil', message: 'En az bir zamanlayıcı profilin olmalı. Bunu silmeden önce yeni bir profil oluşturmalısın.', type: 'warning' });
         return;
     }
     const p = timerProfiles.find(x => x.id === id);
     if (!p) return;
     showPremiumModal({
         title: 'Profili Sil',
         message: `"${escapeHtml(p.name)}" profilini silmek istediğine emin misin?`,
         type: 'warning', showCancel: true, confirmText: 'Sil', cancelText: 'Vazgeç',
         onConfirm: () => {
             timerProfiles = timerProfiles.filter(x => x.id !== id);
             FocusStorage.set('timer_profiles', timerProfiles);
             if (activeTimerProfileId === id) {
                 activeTimerProfileId = timerProfiles[0].id;
                 FocusStorage.set('active_timer_profile_id', activeTimerProfileId);
             }
             applyActiveProfile();
         }
     });
 }

 if (timerProfileAddBtn) timerProfileAddBtn.addEventListener('click', () => openTimerProfileModal(null));

 function closeTimerSettingsModal() {
     timerSettingsModal.classList.add('hidden');
 }

 if (closeTimerSettingsBtn) closeTimerSettingsBtn.addEventListener('click', closeTimerSettingsModal);

 // Modalın dışındaki siyah alana tıklayınca da kapat
 timerSettingsModal.addEventListener('click', (e) => {
     if (e.target === timerSettingsModal) closeTimerSettingsModal();
 });

 if (deleteTimerProfileBtn) {
     deleteTimerProfileBtn.addEventListener('click', () => {
         if (!_editingTimerProfileId) return;
         const idToDelete = _editingTimerProfileId;
         closeTimerSettingsModal();
         deleteTimerProfile(idToDelete);
     });
 }

 // 3. Profili Kaydetme (yeni oluşturma ya da düzenleme)
 if (saveTimerSettingsBtn) {
     saveTimerSettingsBtn.addEventListener('click', () => {
         const nameVal = (settingProfileName?.value || '').trim().slice(0, PROFILE_NAME_MAX_LEN);
         const pVal = parseInt(settingPomodoro.value) || 25;
         const sVal = parseInt(settingShortBreak.value) || 5;
         const lVal = parseInt(settingLongBreak.value) || 15;

         if (!nameVal) {
             showPremiumModal({ title: 'İsim Gerekli', message: 'Lütfen profiline bir isim ver.', type: 'warning' });
             return;
         }
         // --- BİLİMSEL SINIRLAR (Ultradian Ritim) ---
         if (pVal < 5 || pVal > 120) {
             showPremiumModal({ title: 'Bilimsel Sınır Aşıldı', message: 'İnsan beyni aralıksız maksimum 90-120 dakika odaklanabilir. Lütfen odaklanma süresini 5 ile 120 dakika arasında belirleyin.', type: 'warning' });
             return;
         }
         if (sVal < 1 || sVal > 30) {
             showPremiumModal({ title: 'Geçersiz Kısa Mola', message: 'Kısa molalar zihni tazelemek içindir. Eğer 30 dakikayı geçerse zihin tamamen soğur. Lütfen 1 ile 30 dakika arası bir süre girin.', type: 'warning' });
             return;
         }
         if (lVal < 5 || lVal > 60) {
             showPremiumModal({ title: 'Geçersiz Uzun Mola', message: 'Uzun molalar derin dinlenme içindir ancak 60 dakikayı aşarsa tekrar işe dönmek imkansızlaşır. Lütfen 5 ile 60 dakika arası bir süre girin.', type: 'warning' });
             return;
         }

         const cVal = parseInt(settingTargetCycles?.value) || 4;
         const aVal = settingAutoStart?.checked || false;
         if (cVal < 1 || cVal > 10) {
             showPremiumModal({ title: 'Geçersiz Tur Sayısı', message: 'Tur sayısı 1 ile 10 arasında olmalıdır.', type: 'warning' });
             return;
         }

         timerSettings.autoStart = aVal;
         FocusStorage.set('timer_settings', timerSettings);

         if (_editingTimerProfileId) {
             const p = timerProfiles.find(x => x.id === _editingTimerProfileId);
             if (p) {
                 p.name = nameVal; p.focus = pVal; p.shortBreak = sVal; p.longBreak = lVal; p.cycles = cVal;
             }
         } else {
             if (timerProfiles.length >= MAX_TIMER_PROFILES) {
                 showPremiumModal({ title: 'Profil Limiti Doldu', message: `En fazla ${MAX_TIMER_PROFILES} zamanlayıcı profili oluşturabilirsin.`, type: 'warning' });
                 return;
             }
             const newProfile = { id: generateId(), name: nameVal, focus: pVal, shortBreak: sVal, longBreak: lVal, cycles: cVal };
             timerProfiles.push(newProfile);
             activeTimerProfileId = newProfile.id;
             FocusStorage.set('active_timer_profile_id', activeTimerProfileId);
         }
         FocusStorage.set('timer_profiles', timerProfiles);
         applyActiveProfile();
         closeTimerSettingsModal();
     });
 }

 // Kaydedilmiş bir seans durumu var mı — applyActiveProfile()/updateTimerProfileBarVisibility()
 // "taze" (henüz başlamamış) sayıp bunu temizlemeden ÖNCE yakala.
 const _savedTimerRunState = FocusStorage.get('timer_run_state', null);

 // Sayfa yüklendiğinde aktif profili uygula
 applyActiveProfile();
 updateTimerProfileBarVisibility();

 // Yarım kalmış bir seans varsa (sayfa yenilendiğinde) kaldığı yerden devam ettir.
 (function _restoreTimerRunState() {
     const st = _savedTimerRunState;
     if (!st || !st.mode) return;

     const btn = document.querySelector(`.mode-btn[data-mode="${st.mode}"]`);
     if (btn) {
         modeBtns.forEach(b => b.classList.remove('active'));
         btn.classList.add('active');
         applyTimerModeColor(st.mode);
     }
     pomodoroCount = st.loopCount || 0;
     const tc = timerSettings.targetCycles || 4;
     const loopSpan = document.getElementById('loop-count');
     if (loopSpan) loopSpan.textContent = pomodoroCount % tc === 0 ? (pomodoroCount > 0 ? tc : 0) : pomodoroCount % tc;
     totalTime = st.totalTime || totalTime;

     if (st.isRunning) {
         const remaining = Math.max(0, Math.round((st.endTime - Date.now()) / 1000));
         if (remaining > 0) {
             timeLeft = remaining;
             updateTimerDisplay();
             startTimer(); // kaldığı yerden devam ettir (interval'i yeniden kurar)
         } else {
             // Sekmeden uzakken süre zaten dolmuş — sıfır göster, kullanıcı tekrar başlatsın
             timeLeft = 0;
             updateTimerDisplay();
             _clearTimerRunState();
         }
     } else if (typeof st.timeLeft === 'number' && st.timeLeft > 0 && st.timeLeft !== totalTime) {
         timeLeft = st.timeLeft;
         updateTimerDisplay();
     }
 })();
