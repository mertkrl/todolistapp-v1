(function() {
    let isFullscreen = false;
    const btn = document.getElementById('cal-fullscreen-btn');
    const section = document.getElementById('takvim');
    if (!btn || !section) return;

    function toggleCalFullscreen() {
        isFullscreen = !isFullscreen;

        if (isFullscreen) {
            section._fsOriginalParent = section.parentNode;
            section._fsOriginalNextSibling = section.nextSibling;

            document.body.appendChild(section);

            section.classList.add('cal-is-fullscreen');
            document.body.classList.add('has-cal-fullscreen');
            btn.classList.add('fs-active');
            btn.querySelector('i').className = 'fa-solid fa-compress';
            btn.title = 'Küçült (F veya Esc)';

            window.switchCalView('monthly');

        } else {
            section.classList.add('cal-is-closing');
            btn.classList.remove('fs-active');
            btn.querySelector('i').className = 'fa-solid fa-expand';
            btn.title = 'Tam Ekran (F)';

            setTimeout(() => {
                section.classList.remove('cal-is-fullscreen');
                section.classList.remove('cal-is-closing');
                document.body.classList.remove('has-cal-fullscreen');

                if (section._fsOriginalParent) {
                    section._fsOriginalParent.insertBefore(
                        section,
                        section._fsOriginalNextSibling || null
                    );
                }

                requestAnimationFrame(() => {
                   if (window.__getCurrentCalView() === 'monthly') {
                        if (typeof window.renderCalendar === 'function') window.renderCalendar();
                        if (typeof window.renderEvents === 'function') window.renderEvents();
                   } else if (window.__getCurrentCalView() === 'weekly') {
                        if (typeof window.renderWeeklyView === 'function') window.renderWeeklyView();
                    } else {
                        if (typeof window.renderDailyView === 'function') window.renderDailyView();
                    }
                });
            }, 850);
        }
    }

    btn.addEventListener('click', (e) => { e.stopPropagation(); toggleCalFullscreen(); });

    document.addEventListener('keydown', (e) => {
        const onCalPage = document.getElementById('takvim')?.classList.contains('active');
        if (!onCalPage) return;
        if (e.key === 'Escape' && isFullscreen) { toggleCalFullscreen(); return; }
        if (e.key === 'f' || e.key === 'F') {
            const tag = document.activeElement?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            toggleCalFullscreen();
        }
    });
})();
