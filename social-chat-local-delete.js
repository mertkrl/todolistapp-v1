// ─── SADECE BENDEN SİL (yerel — sadece bu cihazda/kullanıcıda) ──────
// social.js dosyasından çıkarıldı (Faz 2, 2026-07-19). "Sohbeti temizle" ve
// "sadece benden sil" işlemleri Firebase/Supabase'den silmez, sadece bu
// kullanıcının arayüzünde mesajları gizler. Sıfır paylaşılan state
// bağımlılığı — sadece localStorage + kendi parametreleri kullanıyor.
function dcClearedAtKey(path) {
    return `dc_cleared_at_${path}`;
}

function dcGetClearedAt(path) {
    return parseInt(localStorage.getItem(dcClearedAtKey(path)) || '0', 10) || 0;
}
window.dcGetClearedAt = dcGetClearedAt;

function dcSetClearedAt(path, ts) {
    localStorage.setItem(dcClearedAtKey(path), String(ts));
}
window.dcSetClearedAt = dcSetClearedAt;

function dcDeletedForMeKey(path) {
    return `dc_deleted_for_me_${path}`;
}

function dcGetDeletedForMe(path) {
    try {
        return new Set(JSON.parse(localStorage.getItem(dcDeletedForMeKey(path)) || '[]'));
    } catch {
        return new Set();
    }
}
window.dcGetDeletedForMe = dcGetDeletedForMe;

function dcAddDeletedForMe(path, keys) {
    const set = dcGetDeletedForMe(path);
    keys.forEach(k => set.add(k));
    localStorage.setItem(dcDeletedForMeKey(path), JSON.stringify(Array.from(set)));
}
window.dcAddDeletedForMe = dcAddDeletedForMe;
