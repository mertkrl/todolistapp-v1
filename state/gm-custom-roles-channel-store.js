// Merkezi _gmCustomRolesSupabaseChannel deposu — Faz V. Grup üye yönetimi
// panelinin group_custom_roles realtime kanalı. Yazarlar: social-roles.js,
// social-group-details.js (panel kapanırken temizler).
export function getGmCustomRolesSupabaseChannel() {
    return window._gmCustomRolesSupabaseChannel || null;
}

export function setGmCustomRolesSupabaseChannel(ch) {
    window._gmCustomRolesSupabaseChannel = ch;
    return ch;
}

window.getGmCustomRolesSupabaseChannel = getGmCustomRolesSupabaseChannel;
