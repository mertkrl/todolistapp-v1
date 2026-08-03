let _dcMembersSupabaseChannel = null;

export function getDcMembersSupabaseChannel() {
    return _dcMembersSupabaseChannel;
}

export function setDcMembersSupabaseChannel(v) {
    _dcMembersSupabaseChannel = v;
    return v;
}

window.__getDcMembersSupabaseChannel = getDcMembersSupabaseChannel;
window.__setDcMembersSupabaseChannel = setDcMembersSupabaseChannel;
