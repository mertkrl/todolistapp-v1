// Odak Modu (Faz H2, script.js'ten çıkarıldı).
//
// ÖNEMLİ — İKİ AYRI clearFocusMode/startFocusMode KEŞFİ: script.js'te (eskiden)
// AYNI kapsam içinde startFocusMode/clearFocusMode İKİ KEZ tanımlanıyordu:
//  1) İlk tanım (satır ~707-723 eski hali) `activeFocusPanel`/`focusTaskNameDisplay`
//     adlı, sonradan `display:none` ile gizlenen ESKİ tasarım DOM elemanlarını
//     kullanıyordu.
//  2) İkinci tanım (satır ~2021-2049 eski hali) `focusTaskText` adlı YENİ tasarım
//     elemanını kullanıyor ve `window.startFocusMode`/`window.clearFocusMode`'u
//     TEKRAR atayarak ilkini eziyordu.
// İnceleme sonucu:
//  - `startFocusMode`: İlk tanım YALNIZCA `window.startFocusMode = startFocusMode`
//    ataması yapıyordu, hiçbir yerde bare `startFocusMode(...)` olarak
//    çağrılmıyordu — ikinci tanım aynı senkron akışta hemen üzerine yazdığı için
//    ilk tanım fiilen HİÇBİR ZAMAN çalıştırılamayan ölü koddu. Bu yüzden ölü
//    tanım silindi, yalnızca ikinci (canlı) tanım aşağıda `startFocusMode` olarak
//    korundu.
//  - `clearFocusMode`: Durum farklı — `function clearFocusMode(){}` bildirimi
//    closure'da TEK bir yerel değişken oluşturuyor (ikinci tanım salt
//    `window.clearFocusMode = function(){}` bir property ataması, yeni bir
//    yerel değişken YARATMIYOR). script.js içindeki `clearFocusBtn` click
//    dinleyicisi VE `toggleTask` içindeki bare `clearFocusMode()` çağrısı bu
//    YEREL (ilk tanım) değişkene bağlanıyordu — yani ilk tanım da CANLI ve hâlâ
//    çalışıyordu, sadece görünmez (gizli) eski DOM elemanlarını güncelliyordu.
//    Bu yüzden HER İKİ davranış da korunmalı: `clearFocusMode` (script.js'in
//    kendi iç kullanımı için, eski/gizli DOM'u güncelleyen sürüm) ve
//    `clearFocusModeGlobal` (window.clearFocusMode'a atanan, dışarıdan/diğer
//    modüllerden çağrılan, yeni/görünür DOM'u güncelleyen sürüm) ayrı ayrı
//    export edildi.
import { switchTab } from './script-tab-switch-core.js';

export function startFocusMode(id) {
    window.__setActiveFocusTaskRef(String(id));
    let taskName = "Bilinmeyen Görev";

    // 1. Önce normal görevlerde ara (Bugün veya Takvim)
    let t = window.__getTasksRef().find(x => String(x.id) === String(id));
    if (t) taskName = t.text;

    // 2. Bulamadıysak Alışkanlıklarda ara
    if (!t) {
        let h = window.__getHabitsRef().find(x => String(x.id) === String(id));
        if (h) taskName = h.name;
    }

    // 3. Bulamadıysak Günün Ana Hedefi mi diye bak
    if (!t && id === 'highlight-task') {
        const todayStr = window.formatDateToString(new Date());
        let highlightHistory = FocusStorage.get('highlight_history', {});
        if (highlightHistory[todayStr]) taskName = highlightHistory[todayStr].text;
    }

    const focusTaskText = document.getElementById('current-focus-task-text');
    if (focusTaskText) {
        focusTaskText.innerHTML = `<i class="fa-solid fa-crosshairs u-color-hff9f43" ></i> <span class="u-color-hff9f43">${window.escapeHtml(taskName)}</span>`;
    }
    switchTab('zamanlayici');
}
window.startFocusMode = startFocusMode;

export function clearFocusMode() {
    window.__setActiveFocusTaskRef(null);
    const focusTaskNameDisplay = document.getElementById('focus-task-name');
    const activeFocusPanel = document.getElementById('active-focus-task');
    if (focusTaskNameDisplay) focusTaskNameDisplay.textContent = "Görev Adı";
    if (activeFocusPanel) activeFocusPanel.classList.add('hidden');
}

export function clearFocusModeGlobal() {
    window.__setActiveFocusTaskRef(null);
    const focusTaskText = document.getElementById('current-focus-task-text');
    if (focusTaskText) focusTaskText.innerHTML = `<i class="fa-solid fa-bullseye"></i> Odaklanılacak Hedefi Seç`;
}
window.clearFocusMode = clearFocusModeGlobal;
