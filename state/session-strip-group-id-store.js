// Merkezi _sessionStripGroupId deposu — Faz H devamı (2026-07-30). Seans
// şeridinin hangi grup için render edildiğini takip eder (async fetch sırasında
// kanal değişirse eski sonucu iptal etmek için). Tek yazar/okuyucu:
// social-dc-session-strip.js.
export function getSessionStripGroupId() {
    return window._sessionStripGroupId || null;
}

export function setSessionStripGroupId(id) {
    window._sessionStripGroupId = id;
    return id;
}
