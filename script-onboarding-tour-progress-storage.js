import { FocusStorage } from './storage-manager.js';

// script-onboarding-tour.js'ten çıkarıldı: tur tamamlanma/ilerleme depolama
// yardımcıları — sadece flowId parametresine ve FocusStorage'a bağımlı.

export function tourStorageKey(flowId) {
    return flowId === 'main' ? 'tour_completed' : ('tour_completed_' + flowId);
}
export function isTourFlowCompleted(flowId) {
    const key = tourStorageKey(flowId);
    if (typeof FocusStorage !== 'undefined') return !!FocusStorage.get(key, false);
    return localStorage.getItem('focusai_' + key) === 'true';
}
export function markTourFlowCompleted(flowId, value) {
    const key = tourStorageKey(flowId);
    if (typeof FocusStorage !== 'undefined') FocusStorage.set(key, value);
    if (value) localStorage.setItem('focusai_' + key, 'true');
    else localStorage.removeItem('focusai_' + key);
}

// İlerleme kaydı (Faz 4): kullanıcı turu bitirmeden sekmeyi yenilerse/kapatırsa
// (Skip/Escape ile bilinçli çıkış DIŞINDA) bir sonraki açılışta baştan değil,
// kaldığı adımdan devam etsin diye adım index'i FocusStorage'a yazılır.
export function tourProgressKey(flowId) {
    return flowId === 'main' ? 'tour_progress' : ('tour_progress_' + flowId);
}
export function saveTourProgress(flowId, step) {
    const key = tourProgressKey(flowId);
    if (typeof FocusStorage !== 'undefined') FocusStorage.set(key, step);
    else localStorage.setItem('focusai_' + key, String(step));
}
export function getTourProgress(flowId) {
    const key = tourProgressKey(flowId);
    let val = null;
    if (typeof FocusStorage !== 'undefined') val = FocusStorage.get(key, null);
    else {
        const raw = localStorage.getItem('focusai_' + key);
        val = raw === null ? null : parseInt(raw, 10);
    }
    return (typeof val === 'number' && !isNaN(val)) ? val : null;
}
export function clearTourProgress(flowId) {
    const key = tourProgressKey(flowId);
    if (typeof FocusStorage !== 'undefined') FocusStorage.set(key, null);
    localStorage.removeItem('focusai_' + key);
}
