// Merkezi _mySeasonState deposu — Faz V. { season, seasonXp } — geçmiş
// haftaların toplamı. Tek yazar: social-gamification.js.
export function getMySeasonState() {
    return window._mySeasonState || null;
}

export function setMySeasonState(state) {
    window._mySeasonState = state;
    return state;
}

window.getMySeasonState = getMySeasonState;
