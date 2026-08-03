// inline-button-failsafe.js — index.html'deki "KRİTİK BUTON FAİLSAFE" inline <script>'ten taşındı.
// script.js içinde DOMContentLoaded sırasında bir hata oluşsa bile
// bu listener'lar bağımsız çalışır ve butonların açılmasını sağlar.
(function() {
    function ensureModalListeners() {
        // FAB (+ hızlı ekle) butonu — main script listener eklemediyse devreye gir
        var fabBtn = document.getElementById('floating-quick-add-btn');
        if (fabBtn && !fabBtn._mainListenerAdded) {
            fabBtn.addEventListener('click', function() {
                if (window._focusOpenQuickAdd) {
                    window._focusOpenQuickAdd();
                } else {
                    var modal = document.getElementById('quick-add-task-modal');
                    if (modal) {
                        modal.classList.remove('hidden');
                        var inp = document.getElementById('quick-task-input');
                        if (inp) setTimeout(function() { inp.focus(); }, 100);
                    }
                }
            });
        }

        // + Yeni Hedef butonu — main script listener eklemediyse devreye gir
        var goalBtn = document.getElementById('btn-open-goal-modal');
        if (goalBtn && !goalBtn._mainListenerAdded) {
            goalBtn.addEventListener('click', function() {
                if (typeof openGoalModal === 'function') {
                    openGoalModal();
                } else {
                    var modal = document.getElementById('goal-modal');
                    if (!modal) return;
                    var titleInp = document.getElementById('goal-title-input');
                    var descInp  = document.getElementById('goal-desc-input');
                    var editId   = document.getElementById('edit-goal-id');
                    var deadlineInp = document.getElementById('goal-deadline-input');
                    if (titleInp) titleInp.value = '';
                    if (descInp)  descInp.value  = '';
                    if (editId)   editId.value   = '';
                    if (deadlineInp) {
                        var today = new Date();
                        var y = today.getFullYear();
                        var m = String(today.getMonth()+1).padStart(2,'0');
                        var d = String(today.getDate()).padStart(2,'0');
                        deadlineInp.value = y + '-' + m + '-' + d;
                    }
                    modal.classList.remove('hidden');
                    if (titleInp) setTimeout(function() { titleInp.focus(); }, 100);
                }
            });
        }

        // Bugün Ekle butonu (td-toggle-add) — sadece main script listener eklemediyse çalışır
        var tdBtn  = document.getElementById('td-toggle-add');
        var tdForm = document.getElementById('td-add-form');
        if (tdBtn && tdForm && !tdBtn._mainListenerAdded) {
            tdBtn._fsListenerAdded = true;
            tdBtn.addEventListener('click', function() {
                var open = !tdForm.classList.contains('is-hidden');
                tdForm.classList.toggle('is-hidden', open);
                if (!open) {
                    var inp = document.getElementById('task-input');
                    if (inp) setTimeout(function() { inp.focus(); }, 50);
                }
            });
        }
    }

    // ÖNEMLİ: script.js bir ES modülü (deferred) olduğu için DOMContentLoaded
    // event'i dispatch edilmeden HEMEN ÖNCE çalışır — ama bu dosya (klasik,
    // senkron <script src>) HTML parse edilirken hemen çalışıp kendi
    // DOMContentLoaded listener'ını script.js'inkinden ÖNCE kaydediyordu.
    // İki listener AYNI olayda, kayıt sırasına göre ateşleniyor: bu yüzden
    // script.js'in _mainListenerAdded=true ataması henüz gerçekleşmeden bu
    // dosyanın ensureModalListeners()'ı çalışıp KENDİ (çakışan) listener'ını
    // da ekliyordu — sonuç: "+ Ekle" gibi butonlara tıklayınca iki listener
    // birbirini geçersiz kılıp hiçbir şey olmuyormuş gibi görünüyordu.
    // 'load' event'i DOMContentLoaded'dan SONRA (ve script.js'in kendi
    // DOMContentLoaded handler'ı çalıştıktan SONRA) ateşlenir — bu yüzden
    // _mainListenerAdded kontrolü artık güvenilir.
    if (document.readyState === 'complete') {
        ensureModalListeners();
    } else {
        window.addEventListener('load', ensureModalListeners);
    }
})();
