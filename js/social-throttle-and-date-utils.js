// ─── GENEL AMAÇLI: EYLEM KISITLAMA (THROTTLE) + TÜRKİYE HAFTA BAŞI ─────────
// social.js dosyasından çıkarıldı (Faz O, social.js turu, 5. tur): birbiriyle
// tematik ilgisi olmayan ama ikisi de social.js'in paylaşılan durumuna
// dokunmayan iki bağımsız yardımcı. `_throttleTimestamps` SADECE
// `_throttleAction` tarafından kullanılıyor (kendi kapsamına özel cache),
// dışarıdan hiç okunmuyor/yazılmıyor.

// Genel amaçlı, hafızada (client-side) basit "throttle" kontrolü — ekstra DB
// okuma/yazma maliyeti olmadan, kullanıcının aynı eylemi çok hızlı tekrarlamasını
// (spam tıklama, bot vb.) engellemek için kullanılır. Sayfa yenilenince sıfırlanır.
const _throttleTimestamps = {};
function _throttleAction(key, minIntervalMs) {
    const now = Date.now();
    const last = _throttleTimestamps[key] || 0;
    if (now - last < minIntervalMs) return false;
    _throttleTimestamps[key] = now;
    return true;
}
// social-activity-feed.js gibi ayrı script scope'larından erişim için
window._throttleAction = _throttleAction;

window._trWeekStart = (d) => _trWeekStart(d); // Faz 6: social-institution-panel.js için
function _trWeekStart(d) {
    const base = d || new Date();
    const tr = new Date(base.getTime() + 3 * 3600 * 1000);
    const day = tr.getUTCDay(); // 0=Pazar
    const diff = (day === 0 ? -6 : 1 - day);
    tr.setUTCDate(tr.getUTCDate() + diff);
    return tr.toISOString().slice(0, 10);
}

// Faz O: gerçek export (social.js bu dosyadan SONRA yüklendiği için güvenli
// — bkz. inline-module-loader.js). window.* köprüleri KORUNDU.
export { _throttleAction, _trWeekStart };
