import { getCurrentUser } from './state/current-user-store.js';
import { getMyGroupsDataCache } from './state/my-groups-data-cache-store.js';
import { openDcGroupChannelSupabase } from './social-dc-room-lifecycle.js';

export function openGroupMentionNotif(groupCode, scopeType, scopeId, displayLabel) {
    const supaGroup = window.FocusSupabase && getCurrentUser()?.id ? getMyGroupsDataCache()[groupCode] : null;
    if (supaGroup?._supaId && scopeType && scopeId) {
        openDcGroupChannelSupabase(groupCode, supaGroup, { type: scopeType, id: scopeId }, displayLabel || '# genel');
    }
}

window.openGroupMentionNotif = openGroupMentionNotif;
