export function getDcChannelTreeChannel() {
    return window._dcSupabaseChannelTreeChannel || null;
}

export function setDcChannelTreeChannel(v) {
    window._dcSupabaseChannelTreeChannel = v;
    return v;
}
