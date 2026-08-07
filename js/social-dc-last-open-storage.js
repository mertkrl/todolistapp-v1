// ─── DC SOHBET — "SON AÇIK OLAN" / "GİRİLEN ODA" localStorage KALICILIĞI ────
// social.js dosyasından çıkarıldı (Faz O, social.js turu, 4. tur): sayfa
// yenilenince açık sohbetin/girilen çalışma odasının hangisi olduğunu
// localStorage'da saklayan/silen 4 fonksiyon. İkisinin anahtar adları
// (DC_LAST_OPEN_KEY/DC_ENTERED_ROOM_KEY) DEĞİŞMEYEN string sabitler —
// mutable state değil, bu yüzden bridge gerekmeden burada da tanımlanabildi.
//
// window._dcPersistLastOpen/window._dcClearLastOpen/
// window._dcPersistEnteredRoom/window._dcClearEnteredRoom köprüleri
// KORUNDU — social-group-details.js, social-institution-panel.js,
// social-server-tree.js, social-room-presence.js hâlâ window.* üzerinden
// çağırıyor.

// Sayfa yenilenince kullanıcı DM/kanal/çalışma odası sohbetinden atılıp
// varsayılan görünüme düşüyordu. Açık sohbetin kimliğini localStorage'da
// tutup, yükleme sonrası (login + grup cache hazır olunca) geri açıyoruz.
const DC_LAST_OPEN_KEY = 'focusai_dc_last_open';
window._dcPersistLastOpen = _dcPersistLastOpen;
function _dcPersistLastOpen(info) {
    try { localStorage.setItem(DC_LAST_OPEN_KEY, JSON.stringify(info)); } catch (_) { console.warn('[FocusAI] sessiz hata:', _); }
}
window._dcClearLastOpen = _dcClearLastOpen;
function _dcClearLastOpen() {
    try { localStorage.removeItem(DC_LAST_OPEN_KEY); } catch (_) { console.warn('[FocusAI] sessiz hata:', _); }
}

// "Çalışma odası" (group_subchannel, çift tıkla girilen presence odası)
// girişini ayrıca hatırlar — sohbet restore'u geri açtıktan sonra presence'ı
// da geri kurup "Odadasın" çubuğunu göstermek için kullanılır.
const DC_ENTERED_ROOM_KEY = 'focusai_dc_entered_room';
window._dcPersistEnteredRoom = _dcPersistEnteredRoom; // social-server-tree.js için
function _dcPersistEnteredRoom(info) {
    try { localStorage.setItem(DC_ENTERED_ROOM_KEY, JSON.stringify(info)); } catch (_) { console.warn('[FocusAI] sessiz hata:', _); }
}
window._dcClearEnteredRoom = _dcClearEnteredRoom;
function _dcClearEnteredRoom() {
    try { localStorage.removeItem(DC_ENTERED_ROOM_KEY); } catch (_) { console.warn('[FocusAI] sessiz hata:', _); }
}

// Faz O: gerçek export (social.js bu dosyadan SONRA yüklendiği için güvenli
// — bkz. inline-module-loader.js).
export { _dcPersistLastOpen, _dcClearLastOpen, _dcPersistEnteredRoom, _dcClearEnteredRoom };
