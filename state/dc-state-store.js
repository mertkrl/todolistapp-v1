// Merkezi _dcState deposu — Faz V (currentUser/active-chat-target store'larının devamı).
// Şu an açık olan grup sohbeti bağlamını (groupCode/roomId/chanId) tutan paylaşılan
// nesne. Tek yazar: social.js (ilk kurulum + `.prop = x` property mutasyonları).
// Okuyucular (4 dosya) window._dcState yerine getDcState() kullanır — dönen nesne
// AYNI referans olduğu için `getDcState().groupCode = x` gibi property mutasyonları
// öncekiyle birebir aynı şekilde çalışmaya devam eder, davranış değişmiyor.
export function getDcState() {
    return window._dcState || null;
}

export function setDcState(state) {
    window._dcState = state;
    return state;
}

window.getDcState = getDcState;
