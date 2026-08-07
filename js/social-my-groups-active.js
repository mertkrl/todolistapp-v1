import { getCurrentUser } from '../state/current-user-store.js';
import { getCurrentActiveGroupCode } from '../state/current-active-group-code-store.js';
import { getMyGroupsDataCache } from '../state/my-groups-data-cache-store.js';
import { computeActiveNowCount } from './social-group-discover.js';

export function refreshMyGroupsActiveNow() {
    Object.entries(getMyGroupsDataCache()).forEach(([groupCode, groupData]) => {
        const activeNow = computeActiveNowCount(groupData);
        const el = document.getElementById(`my-group-active-${groupCode}`);
        if (el) {
            el.innerHTML = activeNow > 0
                ? `<span class="my-group-card-active-mini"><i class="fa-solid fa-circle"></i> ${activeNow}</span>`
                : "";
        }
        if (groupCode === getCurrentActiveGroupCode()) {
            const statEl = document.getElementById("group-overview-active-now");
            if (statEl) statEl.textContent = activeNow;
        }
    });
}
window.refreshMyGroupsActiveNow = refreshMyGroupsActiveNow;

export function loadMyGroups() {
    const myGroupsContainer = document.getElementById("my-groups-container");
    if (!getCurrentUser() || !myGroupsContainer) return;

    if (window.FocusSupabase && getCurrentUser().id) {
        window.loadMyGroupsSupabase();
        return;
    }
}
window.loadMyGroups = loadMyGroups;
