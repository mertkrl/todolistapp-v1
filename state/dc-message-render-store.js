// Merkezi DC mesaj-render/sayfalama deposu — Faz H devamı (mesaj render/pagination/edit/delete
// çekirdeği çıkarma turu). Açık DC/grup sohbetinin mesaj kayıt defteri, seçim, sayfalama ve
// oturum durumunu tutar. Tek yazar: social.js; okuyanlar: social-dc-message-render.js,
// social-dc-pagination.js, social-dc-message-mutate.js, social-dc-reply-reactions.js,
// social-dc-msg-selection.js, social-typing-read-receipts.js.

export function getDcMsgRegistry() {
    if (!window._dcMsgRegistry) window._dcMsgRegistry = {};
    return window._dcMsgRegistry;
}

export function setDcMsgRegistry(registry) {
    window._dcMsgRegistry = registry;
    return registry;
}

export function getDcSelectedKeys() {
    if (!window._dcSelectedKeys) window._dcSelectedKeys = new Set();
    return window._dcSelectedKeys;
}

export function getDcRenderedKeys() {
    if (!window._dcRenderedKeys) window._dcRenderedKeys = {};
    return window._dcRenderedKeys;
}

export function getDcCurrentRole() {
    return window._dcCurrentRole || 'member';
}

export function setDcCurrentRole(role) {
    window._dcCurrentRole = role;
    return role;
}

export function getDcCurrentJoinedAt() {
    return window._dcCurrentJoinedAt || 0;
}

export function setDcCurrentJoinedAt(joinedAt) {
    window._dcCurrentJoinedAt = joinedAt;
    return joinedAt;
}

export function getDcLoadingMore() {
    return !!window._dcLoadingMore;
}

export function setDcLoadingMore(loading) {
    window._dcLoadingMore = loading;
    return loading;
}

export function getDcOldestCreatedAt() {
    return window._dcOldestCreatedAt || null;
}

export function setDcOldestCreatedAt(createdAt) {
    window._dcOldestCreatedAt = createdAt;
    return createdAt;
}

export function getDcCurrentConversation() {
    return window._dcCurrentConversation || null;
}

export function setDcCurrentConversation(conversation) {
    window._dcCurrentConversation = conversation;
    return conversation;
}

export function getDcCurrentOtherProfile() {
    return window._dcCurrentOtherProfile || null;
}

export function setDcCurrentOtherProfile(profile) {
    window._dcCurrentOtherProfile = profile;
    return profile;
}

window.getDcMsgRegistry = getDcMsgRegistry;
window.getDcSelectedKeys = getDcSelectedKeys;
window.getDcRenderedKeys = getDcRenderedKeys;
window.getDcCurrentRole = getDcCurrentRole;
window.getDcCurrentJoinedAt = getDcCurrentJoinedAt;
window.getDcLoadingMore = getDcLoadingMore;
window.getDcOldestCreatedAt = getDcOldestCreatedAt;
window.getDcCurrentConversation = getDcCurrentConversation;
window.getDcCurrentOtherProfile = getDcCurrentOtherProfile;
