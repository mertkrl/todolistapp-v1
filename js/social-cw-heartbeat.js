// ─── ORTAK ÇALIŞMA ODASI — HEARTBEAT (cw_rooms.last_seen_at TAZELEME) ──────
// social.js dosyasından çıkarıldı (Faz O, social.js turu, 5. tur): odaklanma
// arayüzü açıkken periyodik olarak cw_rooms.last_seen_at'i tazeleyen çift.
// `_cwHeartbeatInterval` (setInterval handle) SADECE bu iki fonksiyon
// tarafından kullanılıyor (grep ile doğrulandı) — dışarıdan hiçbir okuma/
// yazma yok, bu yüzden bridge gerekmeden yeni dosyada YEREL state olarak
// tutulabildi.

let _cwHeartbeatInterval = null;

function _cwStartHeartbeat(roomId) {
    _cwStopHeartbeat();
    if (!roomId || !window.FocusSupabase) return;
    const tick = () => window.FocusSupabase.rpc('cw_room_heartbeat', { p_room_id: roomId }).then(() => {}).catch(() => {});
    tick();
    _cwHeartbeatInterval = setInterval(tick, 15000);
}

function _cwStopHeartbeat() {
    if (_cwHeartbeatInterval) { clearInterval(_cwHeartbeatInterval); _cwHeartbeatInterval = null; }
}

// Faz O: gerçek export (social.js bu dosyadan SONRA yüklendiği için güvenli
// — bkz. inline-module-loader.js).
export { _cwStartHeartbeat, _cwStopHeartbeat };
