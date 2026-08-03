export function showDcSkeleton(streamEl) {
    if (!streamEl) return;
    const rows = [
        { side: 'left',  width: '60%' },
        { side: 'right', width: '40%' },
        { side: 'left',  width: '70%' },
        { side: 'left',  width: '45%' },
        { side: 'right', width: '55%' },
    ];
    streamEl.innerHTML = `<div class="dc-skeleton-wrap">${rows.map(r => `
        <div class="dc-msg-skeleton-row${r.side === 'right' ? ' right' : ''}">
            <div class="dc-skel-avatar"></div>
            <div class="dc-skel-bubble"></div>
        </div>
    `).join('')}</div>`;
    streamEl.querySelectorAll('.dc-skel-bubble').forEach((el, i) => {
        el.style.width = rows[i].width;
    });
}
window.showDcSkeleton = showDcSkeleton;

export const _dcRoomMsgCounts = {};

export function setupDcScrollButton(streamEl) {
    const btn = document.getElementById('dc-scroll-bottom-btn');
    if (!btn || btn.dataset.bound) return;
    btn.dataset.bound = '1';

    btn.addEventListener('click', () => {
        streamEl.scrollTo({ top: streamEl.scrollHeight, behavior: 'smooth' });
        btn.style.display = 'none';
        const badge = document.getElementById('dc-scroll-bottom-badge');
        if (badge) { badge.style.display = 'none'; badge.textContent = ''; }
    });

    // passive:true — bu handler preventDefault çağırmıyor, tarayıcı scroll'u
    // bloklamadan hemen işleyebilsin diye.
    streamEl.addEventListener('scroll', () => {
        const distFromBottom = streamEl.scrollHeight - streamEl.scrollTop - streamEl.clientHeight;
        if (distFromBottom > 150) {
            btn.style.display = 'flex';
        } else {
            btn.style.display = 'none';
            const badge = document.getElementById('dc-scroll-bottom-badge');
            if (badge) { badge.style.display = 'none'; badge.textContent = ''; }
        }
    }, { passive: true });
}
window.setupDcScrollButton = setupDcScrollButton;

export function dcHandleScrollAfterRender(streamEl, path, total, wasAtBottom, forceScroll) {
    const btn = document.getElementById('dc-scroll-bottom-btn');
    const badge = document.getElementById('dc-scroll-bottom-badge');
    const prevCount = _dcRoomMsgCounts[path];
    _dcRoomMsgCounts[path] = total;

    if (wasAtBottom || forceScroll) {
        streamEl.scrollTop = streamEl.scrollHeight;
        if (btn) btn.style.display = 'none';
        if (badge) { badge.style.display = 'none'; badge.textContent = ''; }
        return;
    }

    if (prevCount !== undefined && total > prevCount && btn) {
        const newCount = (parseInt(badge && badge.textContent, 10) || 0) + (total - prevCount);
        if (badge) {
            badge.textContent = newCount > 99 ? '99+' : String(newCount);
            badge.style.display = 'flex';
        }
        btn.style.display = 'flex';
    }
}
window.dcHandleScrollAfterRender = dcHandleScrollAfterRender;
