let _dcMembersPresenceHandler = null;

export function getDcMembersPresenceHandler() {
    return _dcMembersPresenceHandler;
}

export function setDcMembersPresenceHandler(v) {
    _dcMembersPresenceHandler = v;
    return v;
}

window.__getDcMembersPresenceHandler = getDcMembersPresenceHandler;
window.__setDcMembersPresenceHandler = setDcMembersPresenceHandler;
