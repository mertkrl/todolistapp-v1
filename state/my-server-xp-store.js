// Merkezi _myServerXP deposu — Faz V. Sunucudan gelen güncel XP değeri.
// Tek yazar: social-gamification.js.
export function getMyServerXP() {
    return window._myServerXP;
}

export function setMyServerXP(xp) {
    window._myServerXP = xp;
    return xp;
}

window.getMyServerXP = getMyServerXP;
