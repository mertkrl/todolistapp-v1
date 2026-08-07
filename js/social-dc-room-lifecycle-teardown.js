// ─── ÜYE LİSTESİ / GENEL DC DİNLEYİCİ TEMİZLEME ──────────────────────────
// social-dc-room-lifecycle.js dosyasından çıkarıldı — bu iki fonksiyon sadece
// window üzerindeki global kanal/handler referanslarını ve import edilen
// teardown fonksiyonlarını kullanıyor, dosyanın modül-seviyesi
// (_dcSupabaseMsgChannel vb.) state'ine dokunmuyor, bu yüzden bağımsız
// bir dosyaya taşınabildi.
import { teardownDcRoomPresenceStripChannels } from './social-room-presence.js';
import {
    teardownDcTyping, teardownDcReadReceipt, teardownDcGroupReadReceipt
} from './social-typing-read-receipts.js';

// Üye listesi paneli için Supabase realtime kanalını ve presence dinleyicisini kapatır
window.teardownDcMembersSupabase = teardownDcMembersSupabase; // social-room-presence.js için
export function teardownDcMembersSupabase() {
    if (window.__getDcMembersSupabaseChannel()) { window.FocusSupabase.removeChannel(window.__getDcMembersSupabaseChannel()); window.__setDcMembersSupabaseChannel(null); }
    if (window.__getDcMembersPresenceHandler()) { window.removeEventListener('focusai:presence-changed', window.__getDcMembersPresenceHandler()); window.__setDcMembersPresenceHandler(null); }
}

window.detachDcListeners = detachDcListeners; // social-dc-init.js gibi ayrı script scope'larından erişim için
export function detachDcListeners() {
    teardownDcMembersSupabase();
    teardownDcRoomPresenceStripChannels();
    teardownDcTyping();
    teardownDcReadReceipt();
    teardownDcGroupReadReceipt();
}
