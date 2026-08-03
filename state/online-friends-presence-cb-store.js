// Merkezi _onlineFriendsPresenceCb deposu — Faz V. Çevrimiçi arkadaş listesi
// presence olay dinleyicisinin referansı (kaldırılabilmesi için tutuluyor).
// Yazarlar: social.js (ilk null), social-online-friends.js (bind/unbind).
export function getOnlineFriendsPresenceCb() {
    return window._onlineFriendsPresenceCb || null;
}

export function setOnlineFriendsPresenceCb(cb) {
    window._onlineFriendsPresenceCb = cb;
    return cb;
}

window.getOnlineFriendsPresenceCb = getOnlineFriendsPresenceCb;
