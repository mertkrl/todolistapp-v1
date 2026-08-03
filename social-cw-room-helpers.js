import { getCurrentUser } from './state/current-user-store.js';

export function _cwOthersLabel(room) {
    const currentUser = getCurrentUser();
    const others = (room.members || []).filter(m => m.userId !== currentUser?.id).map(m => m.displayName || 'Kullanıcı');
    if (!others.length) return null;
    if (others.length === 1) return others[0];
    if (others.length === 2) return `${others[0]} ve ${others[1]}`;
    return `${others[0]}, ${others[1]} ve ${others.length - 2} kişi daha`;
}

export function _cwIsRoomOwner(room) {
    const currentUser = getCurrentUser();
    const me = (room.members || []).find(m => m.userId === currentUser?.id);
    return !!me && me.role === 'owner';
}
