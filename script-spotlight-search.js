// Faz F: Spotlight (Ctrl+K / Cmd+K) hızlı arama modalı — script.js'ten çıkarıldı.
// Bağımlılıklar: window.__get/setTasksRef, window.__getCalendarEventsRef,
// window.__get/setCurrentDateRef, window.__get/setSelectedDateRef, window.monthNamesShort,
// window.escapeHtml, window.switchTab, window.renderCalendar, window.renderEvents.
(function () {
    const spotlightModal = document.getElementById('spotlight-search-modal');
    const spotlightInput = document.getElementById('spotlight-input');
    const closeSpotlightBtn = document.getElementById('close-spotlight-btn');
    const openSpotlightBtn = document.getElementById('open-spotlight-btn');
    const spotlightResultsWrapper = document.getElementById('spotlight-results-wrapper');
    const spotlightResultsList = document.getElementById('spotlight-results-list');

    if (!spotlightModal || !spotlightInput || !spotlightResultsWrapper || !spotlightResultsList) return;

    function openSpotlight() {
        spotlightModal.classList.remove('hidden');
        spotlightInput.value = '';
        spotlightResultsWrapper.classList.add('hidden');
        spotlightResultsList.innerHTML = '';
        setTimeout(() => spotlightInput.focus(), 100);
    }

    function closeSpotlight() {
        spotlightModal.classList.add('hidden');
    }

    window.openSpotlight = openSpotlight;
    window.closeSpotlight = closeSpotlight;

    if (openSpotlightBtn) openSpotlightBtn.addEventListener('click', openSpotlight);
    if (closeSpotlightBtn) closeSpotlightBtn.addEventListener('click', closeSpotlight);

    spotlightModal.addEventListener('click', (e) => {
        if (e.target === spotlightModal) closeSpotlight();
    });

    // Spotlight için Klavye Kısayolu (Ctrl+K veya Cmd+K)
    document.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            if (spotlightModal.classList.contains('hidden')) openSpotlight();
            else closeSpotlight();
        }
        if (e.key === 'Escape' && !spotlightModal.classList.contains('hidden')) {
            closeSpotlight();
        }
    });

    spotlightInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        if (query.length < 2) {
            spotlightResultsWrapper.classList.add('hidden');
            spotlightResultsList.innerHTML = '';
            return;
        }

        const tasks = window.__getTasksRef ? window.__getTasksRef() : [];
        const calendarEvents = window.__getCalendarEventsRef ? window.__getCalendarEventsRef() : {};
        const monthNamesShort = window.monthNamesShort || [];
        const escapeHtml = window.escapeHtml || (s => String(s));

        let results = [];

        // 1. Takvim Kayıtlarında Ara
        for (let dateStr in calendarEvents) {
            calendarEvents[dateStr].forEach(ev => {
                if (ev.text.toLowerCase().includes(query)) {
                    results.push({ id: ev.id, text: ev.text, date: dateStr, time: ev.timeStart, type: 'Takvim Planı', icon: 'fa-calendar-check' });
                }
            });
        }

        // 2. Görevlerde Ara
        tasks.forEach(t => {
            if (t.text.toLowerCase().includes(query) && !results.some(r => r.id === t.id)) {
                results.push({ id: t.id, text: t.text, date: t.date, time: t.timeStart, type: 'Görev', icon: 'fa-check-circle' });
            }
        });

        // Tarihe göre sırala (GÜNCELLEME: Gün-Ay-Yıl formatına göre akıllı sıralama)
        results.sort((a, b) => {
            const [dA, mA, yA] = a.date.split('-').map(Number);
            const [dB, mB, yB] = b.date.split('-').map(Number);
            return new Date(yA, mA - 1, dA) - new Date(yB, mB - 1, dB);
        });

        spotlightResultsList.innerHTML = '';
        if (results.length === 0) {
            spotlightResultsList.innerHTML = '<li style="padding: 20px; text-align: center; color: var(--text-muted);">Sonuç bulunamadı.</li>';
        } else {
            results.forEach(res => {
                const [d, m, y] = res.date.split('-'); // GÜNCELLEME: d, m, y sırasına alındı
                const shortDate = `${parseInt(d)} ${monthNamesShort[parseInt(m)-1]} ${y}`;

                const li = document.createElement('li');
                li.className = 'spotlight-result-item';
                li.innerHTML = `
                    <div class="s-res-info">
                        <span class="s-res-title"><i class="fa-solid ${res.icon}" style="color: var(--primary-color); margin-right: 8px;"></i>${escapeHtml(res.text)}</span>
                        <div class="s-res-meta">
                            <span><i class="fa-regular fa-calendar"></i> ${shortDate}</span>
                            <span><i class="fa-regular fa-clock"></i> ${res.time || 'Tüm Gün'}</span>
                            <span style="background: rgba(255,255,255,0.05); padding: 2px 8px; border-radius: 8px; color: #a29bfe;">${res.type}</span>
                        </div>
                    </div>
                    <i class="fa-solid fa-arrow-right" style="color: var(--text-muted); opacity: 0.5;"></i>
                `;

                li.onclick = () => {
                    // Takvime ve hedeflenen tarihe ışınlan
                    const [ty, tm, td] = res.date.split('-').map(Number);
                    if (window.__setCurrentDateRef) window.__setCurrentDateRef(new Date(ty, tm - 1, td));
                    if (window.__setSelectedDateRef) window.__setSelectedDateRef(new Date(ty, tm - 1, td));

                    if (window.switchTab) window.switchTab('takvim');
                    if (window.renderCalendar) window.renderCalendar();
                    if (window.renderEvents) window.renderEvents();
                    closeSpotlight();
                };
                spotlightResultsList.appendChild(li);
            });
        }
        spotlightResultsWrapper.classList.remove('hidden');
    });
})();
