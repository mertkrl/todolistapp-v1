export function updateTimerDropdown() {
    const timerTodoList = document.getElementById('timer-todo-list');
    const taskDropdown = document.getElementById('timer-task-dropdown');
    const activeFocusTask = window.__getActiveFocusTaskRef();
    const tasks = window.__getTasksRef();

    if(!timerTodoList) return;
    timerTodoList.innerHTML = '';

    // --- YENİ EKLENEN: ODAĞI İPTAL ET BUTONU ---
    if (activeFocusTask) {
        const clearLi = document.createElement('li');
        clearLi.className = 'timer-todo-item';
        clearLi.innerHTML = `<i class="fa-solid fa-xmark u-color-hff4757" ></i> <span class="task-name u-color-hff4757_font-weight-600" >Odağı Kaldır</span>`;
        clearLi.onclick = (e) => {
            e.stopPropagation();
            window.clearFocusMode(); // Odağı sıfırla
            taskDropdown.classList.add('hidden'); // Menüyü kapat
        };
        timerTodoList.appendChild(clearLi);

        // Araya hafif şeffaf bir çizgi çekiyoruz ki görevlerle karışmasın
        const hr = document.createElement('hr');
        hr.style.border = '0';
        hr.style.borderTop = '1px solid rgba(255,255,255,0.1)';
        hr.style.margin = '5px 0';
        timerTodoList.appendChild(hr);
    }
    // --------------------------------------------

    const todayStr = window.formatDateToString(new Date());
    let yest = new Date();
    yest.setDate(yest.getDate() - 1);
    const yesterdayStr = window.formatDateToString(yest);

    // 1. Bugünün Görevleri (Takvim dahil) + Dünden sarkanlar
    // isLessonPlanDraft: öğretmenin başka bir öğrenci için henüz atamadığı ders planı taslağı — gizli.
    const todayTasks = tasks.filter(t =>
        !t.isLessonPlanDraft && (
            (t.date === todayStr && !t.completed) ||
            (t.date === yesterdayStr && t.isOvernight && !t.completed)
        )
    );

    // 2. Bugünün Alışkanlıkları
    const todayHabits = window.getHabitsForDate(todayStr).filter(h => !h.history[todayStr]);

    // 3. Günün Ana Hedefi
    let highlightHistory = window.FocusStorage.get('highlight_history', {});
    let todayHighlight = highlightHistory[todayStr];
    let hasHighlight = todayHighlight && !todayHighlight.completed;

    // Eğer odaklanılacak hiçbir şey kalmadıysa ve aktif odak yoksa boş uyarı ver
    if(todayTasks.length === 0 && todayHabits.length === 0 && !hasHighlight) {
        if(!activeFocusTask) {
            timerTodoList.innerHTML = '<li class="u-padding-10px_font-size-12px_color-var-text-muted_text-alig">Bugün için bekleyen plan yok.</li>';
        }
        return;
    }

    // Günün Hedefini Ekle
    if(hasHighlight) {
        const li = document.createElement('li');
        li.className = 'timer-todo-item';
        li.innerHTML = `<i class="fa-solid fa-star u-color-hff9f43" ></i> <span class="task-name u-color-hff9f43" >${window.escapeHtml(todayHighlight.text)}</span> <span class="u-font-size-10px_background-rgba255159670p2_color-hff9f43_pa">Ana Hedef</span>`;
        li.onclick = (e) => {
            e.stopPropagation();
            window.startFocusMode('highlight-task');
            taskDropdown.classList.add('hidden');
        };
        timerTodoList.appendChild(li);
    }

    // Görevleri Ekle (Takvim ve Bugün sayfasından gelenler)
    todayTasks.forEach(task => {
        const li = document.createElement('li');
        li.className = 'timer-todo-item';
        li.innerHTML = `<i class="fa-regular fa-circle"></i> <span class="task-name">${window.escapeHtml(task.text)}</span> <span class="u-font-size-10px_opacity-0p5_margin-left-auto">Görev</span>`;
        li.onclick = (e) => {
            e.stopPropagation();
            window.startFocusMode(task.id);
            taskDropdown.classList.add('hidden');
        };
        timerTodoList.appendChild(li);
    });

    // Alışkanlıkları Ekle
    todayHabits.forEach(habit => {
        const li = document.createElement('li');
        li.className = 'timer-todo-item';
        li.innerHTML = `<i class="fa-solid fa-leaf u-color-hc88ce6" ></i> <span class="task-name u-color-hc88ce6" >${window.escapeHtml(habit.name)}</span> <span class="u-font-size-10px_opacity-0p5_margin-left-auto">Alışkanlık</span>`;
        li.onclick = (e) => {
            e.stopPropagation();
            window.startFocusMode(habit.id);
            taskDropdown.classList.add('hidden');
        };
        timerTodoList.appendChild(li);
    });
}
