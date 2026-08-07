import { getCurrentUser } from '../state/current-user-store.js';

export function _isSupabaseGroupAdmin(groupCode) {
    const g = window.getMyGroupsDataCache()[groupCode];
    const currentUser = getCurrentUser();
    const me = currentUser && currentUser.username;
    if (!g || !me || !g.members || !g.members[me]) return false;
    return g.members[me].role === 'admin';
}
window._isSupabaseGroupAdmin = _isSupabaseGroupAdmin;
