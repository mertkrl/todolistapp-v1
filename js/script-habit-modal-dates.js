// ============================================================
// FOCUSAI SCRIPT-HABIT-MODAL-DATES.JS
// script.js'ten çıkarılmış: Alışkanlık oluşturma modalındaki
// başlangıç/bitiş tarihi ve hedef gün sayısı senkronizasyonu
// (_syncEndDateFromTarget, _syncTargetFromEndDate) ve bunlara
// bağlı olay dinleyicileri (target-minus/target-plus/habit-target
// değişimi, habit-start-date/habit-end-date değişimi, açılışta
// ilk senkronizasyon). DOM elemanları paylaşılan const değil,
// aynı ID'lerle burada ayrıca sorgulanıyor (script.js'teki diğer
// kullanım yerleri kendi const'larını korur, aynı canlı DOM
// elemanına işaret ettikleri için senkron kalırlar).
// window._setFlatpickrDate/_getDateFromFlatpickr → script-calendar-date-utils.js
// script.js önce yüklenir, bu dosya sonra.
// ============================================================

(function () {
'use strict';

const habitTargetInput = document.getElementById('habit-target');
const habitStartDateInput = document.getElementById('habit-start-date');
const habitEndDateInput = document.getElementById('habit-end-date');
const hmSyncHint = document.getElementById('hm-sync-hint');
const targetMinusBtn = document.getElementById('target-minus');
const targetPlusBtn = document.getElementById('target-plus');

function _syncEndDateFromTarget() {
    const start = window._getDateFromFlatpickr(habitStartDateInput);
    const days = parseInt(habitTargetInput.value) || 30;
    if (!start) return;
    const end = new Date(start);
    end.setDate(end.getDate() + days - 1);
    window._setFlatpickrDate(habitEndDateInput, end);
    if (hmSyncHint) hmSyncHint.textContent = '';
}
function _syncTargetFromEndDate() {
    const start = window._getDateFromFlatpickr(habitStartDateInput);
    const end = window._getDateFromFlatpickr(habitEndDateInput);
    if (!start || !end) return;
    const days = Math.round((end - start) / 86400000) + 1;
    if (days < 1) {
        if (hmSyncHint) hmSyncHint.textContent = '⚠ Bitiş başlangıçtan önce olamaz';
        return;
    }
    if (days > 365) {
        if (hmSyncHint) hmSyncHint.textContent = '⚠ En fazla 365 gün';
        return;
    }
    habitTargetInput.value = days;
    if (hmSyncHint) hmSyncHint.textContent = '';
}

window._syncEndDateFromTarget = _syncEndDateFromTarget;
window._syncTargetFromEndDate = _syncTargetFromEndDate;

if (habitStartDateInput) {
    if (habitStartDateInput._flatpickr) { habitStartDateInput._flatpickr.setDate(new Date()); }
    else { habitStartDateInput.value = window.toInputDate(window.formatDateToString(new Date())); }
    _syncEndDateFromTarget();
}

if (targetMinusBtn) {
    targetMinusBtn.addEventListener('click', () => {
        let val = parseInt(habitTargetInput.value) || 21;
        if (val > 1) { habitTargetInput.value = val - 1; _syncEndDateFromTarget(); }
    });
}

if (targetPlusBtn) {
    targetPlusBtn.addEventListener('click', () => {
        let val = parseInt(habitTargetInput.value) || 21;
        if (val < 365) { habitTargetInput.value = val + 1; _syncEndDateFromTarget(); }
    });
}

if (habitTargetInput) {
    habitTargetInput.addEventListener('change', () => {
        let val = parseInt(habitTargetInput.value);
        if (isNaN(val) || val < 1) val = 1;
        if (val > 365) val = 365;
        habitTargetInput.value = val;
        _syncEndDateFromTarget();
    });
}

if (habitStartDateInput) {
    habitStartDateInput.addEventListener('change', _syncEndDateFromTarget);
}
if (habitEndDateInput) {
    habitEndDateInput.addEventListener('change', _syncTargetFromEndDate);
}

})();
