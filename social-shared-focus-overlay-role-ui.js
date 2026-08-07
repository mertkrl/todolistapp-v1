// social-shared-focus-overlay.js dosyasından çıkarıldı — sadece kendi
// parametrelerine ve rol/izin state store'larına (cw-settings-open-to-all,
// cw-current-room) bağlı, overlay açma/kapama akışının paylaşılan
// _gfDurationSettingsBound gibi modül-seviyesi state'ine dokunmuyor.
import { getCwSettingsOpenToAll, setCwSettingsOpenToAll } from './state/cw-settings-open-to-all-store.js';
import { getCwRoomAllowRequests, setCwRoomAllowRequests } from './state/cw-current-room-store.js';

export function _cwApplyRoleBasedUI(isOwner, settingsOpenToAll, allowRequests) {
    setCwSettingsOpenToAll(!!settingsOpenToAll);
    setCwRoomAllowRequests(allowRequests !== false);
    const canSettings = isOwner || getCwSettingsOpenToAll();
    document.getElementById('gf-settings-btn')?.classList.toggle('hidden', !canSettings);
    document.getElementById('gf-end-session-btn')?.classList.toggle('hidden', !isOwner);
    document.getElementById('gf-setting-open-settings-row')?.classList.toggle('hidden', !isOwner);
    document.getElementById('gf-setting-allow-requests-row')?.classList.toggle('hidden', !isOwner);
    const toggle = document.getElementById('gf-setting-open-settings');
    if (toggle && document.activeElement !== toggle) toggle.checked = getCwSettingsOpenToAll();
    const reqToggle = document.getElementById('gf-setting-allow-requests');
    if (reqToggle && document.activeElement !== reqToggle) reqToggle.checked = getCwRoomAllowRequests();

    // İstek izni kapalıysa ve kontrol yetkim yoksa Start/Pause/Skip'i hiç
    // görmeyeyim (elimden bir şey gelmediği için buton anlamsız kalırdı).
    if (!isOwner && !getCwSettingsOpenToAll()) {
        const showControls = getCwRoomAllowRequests();
        document.getElementById('gf-start-btn')?.classList.toggle('cw-controls-hidden', !showControls);
        document.getElementById('gf-pause-btn')?.classList.toggle('cw-controls-hidden', !showControls);
        document.getElementById('gf-skip-btn')?.classList.toggle('cw-controls-hidden', !showControls);
    } else {
        document.getElementById('gf-start-btn')?.classList.remove('cw-controls-hidden');
        document.getElementById('gf-pause-btn')?.classList.remove('cw-controls-hidden');
        document.getElementById('gf-skip-btn')?.classList.remove('cw-controls-hidden');
    }
}
