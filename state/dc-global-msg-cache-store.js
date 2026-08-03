// Merkezi _dcGlobalMsgCache deposu — Faz V. Sohbet mesajlarının bellek-içi
// önbelleği (grup/DM yolu -> mesaj listesi). Tek yazar: social.js (nesne bir kez
// kurulur, sonrası hep `getDcGlobalMsgCache()[path]...` property mutasyonu —
// nesne referansı hiç değişmiyor, bu yüzden getter yeterli).
export function getDcGlobalMsgCache() {
    return window._dcGlobalMsgCache || null;
}

export function setDcGlobalMsgCache(cache) {
    window._dcGlobalMsgCache = cache;
    return cache;
}

window.getDcGlobalMsgCache = getDcGlobalMsgCache;
