// Merkezi DC sohbet-görünüm deposu — Faz H devamı. Açık DC/grup sohbetinin
// mesaj-render/sayfalama/yanıt state'ini tutar. Tek yazar: social.js;
// okuyanlar: social-chat-extras.js, social-dc-msg-selection.js,
// social-message-pins.js.
export function getDcCurrentGroupId() {
    return window._dcCurrentGroupId || null;
}

export function setDcCurrentGroupId(groupId) {
    window._dcCurrentGroupId = groupId;
    return groupId;
}

export function getDcCurrentMsgPath() {
    return window._dcCurrentMsgPath || null;
}

export function setDcCurrentMsgPath(path) {
    window._dcCurrentMsgPath = path;
    return path;
}

export function getDcOldestKey() {
    return window._dcOldestKey || null;
}

export function setDcOldestKey(key) {
    window._dcOldestKey = key;
    return key;
}

export function getDcReplyTo() {
    return window._dcReplyTo || null;
}

export function setDcReplyTo(replyTo) {
    window._dcReplyTo = replyTo;
    return replyTo;
}

window.getDcCurrentGroupId = getDcCurrentGroupId;
window.getDcCurrentMsgPath = getDcCurrentMsgPath;
window.getDcOldestKey = getDcOldestKey;
window.getDcReplyTo = getDcReplyTo;
