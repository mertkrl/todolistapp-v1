// Merkezi coworking oda deposu — currentRoomId/_cwRoomIsSupabase/
// _cwRoomSupaChannel/_cwRoomAllowRequests artık social.js'te bare `let`
// değil, buradan okunup yazılıyor. Önceki window._cwGetRoomId() vb.
// salt-okunur köprüler kaldırıldı; bağımlı dosyalar artık bu store'u
// doğrudan import ediyor.
let currentRoomId = null;
let cwRoomIsSupabase = false;
let cwRoomSupaChannel = null;
let cwRoomAllowRequests = true;

export function getCurrentRoomId() {
    return currentRoomId;
}

export function setCurrentRoomId(value) {
    currentRoomId = value;
    return currentRoomId;
}

export function getCwRoomIsSupabase() {
    return cwRoomIsSupabase;
}

export function setCwRoomIsSupabase(value) {
    cwRoomIsSupabase = value;
    return cwRoomIsSupabase;
}

export function getCwRoomSupaChannel() {
    return cwRoomSupaChannel;
}

export function setCwRoomSupaChannel(value) {
    cwRoomSupaChannel = value;
    return cwRoomSupaChannel;
}

export function getCwRoomAllowRequests() {
    return cwRoomAllowRequests;
}

export function setCwRoomAllowRequests(value) {
    cwRoomAllowRequests = value;
    return cwRoomAllowRequests;
}

window.getCurrentRoomId = getCurrentRoomId;
