// inline-goal-modal-globals.js — index.html'deki "Goal modal global fonksiyonları" inline <script>'ten taşındı.
// script.js'deki DOMContentLoaded hataları bu fonksiyonları engellememesin diye
// ayrı bir dosyada tanımlandı. Bu dosya KLASİK (type="module" DEĞİL) script
// olarak yüklenmeli — closeGoalModal/openGoalModal/saveGoal fonksiyonlarının
// window üzerinden (bare onclick="..." çağrıları için) erişilebilir olması gerekiyor.
function closeGoalModal() {
    var modal = document.getElementById('goal-modal');
    if (modal) modal.classList.add('hidden');
}

function openGoalModal() {
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
        if (deadlineInp._flatpickr) {
            deadlineInp._flatpickr.setDate(new Date());
        } else {
            var today = new Date();
            var y = today.getFullYear();
            var m = String(today.getMonth() + 1).padStart(2, '0');
            var d = String(today.getDate()).padStart(2, '0');
            deadlineInp.value = y + '-' + m + '-' + d;
        }
    }
    modal.classList.remove('hidden');
    if (titleInp) setTimeout(function() { titleInp.focus(); }, 100);
}

function saveGoal() {
    // Gerçek implementasyon script.js'de window.saveGoal olarak atanır; bu sadece fallback
    if (window._saveGoalImpl) { window._saveGoalImpl(); return; }
    alert('Sayfa henüz yüklenmedi, lütfen bekleyin.');
}
