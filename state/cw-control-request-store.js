// Coworking oda "kontrol isteği" (pause/start/skip için katılımcı→sahip
// onay akışı) deposu — social.js'te üç ayrı fonksiyona ( _cwSendControlRequest,
// _cwShowIncomingControlRequest, _cwSetupSupaRoomUI'nin request_result
// broadcast callback'i) yayılmış paylaşımlı closure state'iydi, artık burada.
let cwPendingControlRequest = null;
let cwMyRequestInFlight = false;
let cwRequestSpamAttempts = 0;
let cwRequestLockoutUntil = 0;

export function getCwPendingControlRequest() {
    return cwPendingControlRequest;
}

export function setCwPendingControlRequest(value) {
    cwPendingControlRequest = value;
    return cwPendingControlRequest;
}

export function getCwMyRequestInFlight() {
    return cwMyRequestInFlight;
}

export function setCwMyRequestInFlight(value) {
    cwMyRequestInFlight = value;
    return cwMyRequestInFlight;
}

export function getCwRequestSpamAttempts() {
    return cwRequestSpamAttempts;
}

export function setCwRequestSpamAttempts(value) {
    cwRequestSpamAttempts = value;
    return cwRequestSpamAttempts;
}

export function getCwRequestLockoutUntil() {
    return cwRequestLockoutUntil;
}

export function setCwRequestLockoutUntil(value) {
    cwRequestLockoutUntil = value;
    return cwRequestLockoutUntil;
}
