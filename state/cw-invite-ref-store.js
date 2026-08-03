export function getCwInviteMsgId() {
    return window._cwInviteMsgId || null;
}

export function getCwInviteScope() {
    return window._cwInviteScope || null;
}

export function setCwInviteRef(msgId, scope) {
    window._cwInviteMsgId = msgId;
    window._cwInviteScope = scope;
}
