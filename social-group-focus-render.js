// ─── GRUP ODAK OVERLAY — SAF RENDER YARDIMCILARI ──────────────────────
// social.js dosyasından çıkarıldı (Faz 2, 2026-07-19). İkisi de sadece
// parametre + DOM kullanıyor, paylaşılan sohbet/oturum state'ine dokunmuyor.
function gfRenderMetroTimeline(rounds, activeIndex, focusMin, breakMin) {
    const track = document.getElementById('gf-metro-track');
    if (!track) return;
    // Tur sayısına göre boyut sınıfı uygula
    track.classList.remove('gf-metro-md', 'gf-metro-sm');
    if (rounds >= 8) track.classList.add('gf-metro-sm');
    else if (rounds >= 5) track.classList.add('gf-metro-md');
    // Durak listesi oluştur: F1,B1,F2,B2,...,FN
    const stations = [];
    for (let i = 1; i <= rounds; i++) {
        stations.push({ type: 'focus', label: `Odak ${i}`, sub: `${focusMin}dk` });
        if (i < rounds) stations.push({ type: 'brk', label: `Mola ${i}`, sub: `${breakMin}dk` });
    }
    let html = '';
    stations.forEach((st, idx) => {
        const isDone   = idx < activeIndex;
        const isActive = idx === activeIndex;
        const stateClass = isDone ? 'done' : (isActive ? 'active' : '');
        const icon = st.type === 'focus'
            ? '<i class="fa-solid fa-brain"></i>'
            : '<i class="fa-solid fa-mug-hot"></i>';
        html += `<div class="gf-metro-station ${st.type} ${stateClass}" data-idx="${idx}">
            <div class="gf-metro-dot">${icon}</div>
            <div class="gf-metro-label">${st.label}<br><span style="font-weight:400;opacity:.7">${st.sub}</span></div>
        </div>`;
        if (idx < stations.length - 1) {
            const railClass = isDone ? 'done' : 'ahead';
            html += `<div class="gf-metro-rail ${railClass}"></div>`;
        }
    });
    track.innerHTML = html;
    // Aktif durağı görünür yap (scroll)
    const activeEl = track.querySelector('.gf-metro-station.active');
    if (activeEl) activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
}
window.gfRenderMetroTimeline = gfRenderMetroTimeline;

// ── Katılımcı grid — "Birlikte Çalışalım" odasındaki kartlarla birebir aynı ──
function gfRenderParticipants(people) {
    const pcountEl = document.getElementById('gf-pcount');
    const listEl = document.getElementById('gf-participants');
    if (!pcountEl || !listEl) return;
    pcountEl.textContent = (people.length <= 1) ? 'Tek başına' : `${people.length} katılımcı`;
    listEl.innerHTML = people.map(name => `
        <div class="cws-participant-chip">
            <div class="cws-participant-avatar">${window.escapeHtml((name || '?')[0].toUpperCase())}</div>
            <span>${window.escapeHtml(name)}</span>
        </div>`).join('');
}
window.gfRenderParticipants = gfRenderParticipants;
