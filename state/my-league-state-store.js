// Merkezi _myLeagueState deposu — Faz V. Kullanıcının bu haftaki lig durumu
// ({ weekStart, base, league }). Tek yazar: social-gamification.js.
export function getMyLeagueState() {
    return window._myLeagueState || null;
}

export function setMyLeagueState(state) {
    window._myLeagueState = state;
    return state;
}

window.getMyLeagueState = getMyLeagueState;
