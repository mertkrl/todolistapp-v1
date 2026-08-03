// Merkezi _gmMembersSupabaseChannel deposu — Faz V. Grup üye yönetimi
// panelinin group_members realtime kanalı. Yazarlar: social-roles.js,
// social-group-details.js (panel kapanırken temizler).
export function getGmMembersSupabaseChannel() {
    return window._gmMembersSupabaseChannel || null;
}

export function setGmMembersSupabaseChannel(ch) {
    window._gmMembersSupabaseChannel = ch;
    return ch;
}

window.getGmMembersSupabaseChannel = getGmMembersSupabaseChannel;
