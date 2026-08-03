export function populateParentHabitSelects() {
    const habits = window.__getHabitsRef();
    const goals = window.__getGoalsRef();

  // 1. Görevler İçin Eski Alışkanlık Menüleri (Takvim, Odak vb.)
  const habitSelects = [
    document.getElementById('wiz-parent-habit')
];
    habitSelects.forEach(select => {
        if (!select) return;
        const currentValue = select.value;
        select.innerHTML = '<option value="" selected>Bağımsız Görev</option>';
        habits.forEach(h => {
            const opt = document.createElement('option');
            opt.value = h.id; opt.textContent = h.name;
            select.appendChild(opt);
        });
        if (currentValue && habits.some(h => String(h.id) === String(currentValue))) select.value = currentValue;
    });

// 2. Bugün Sekmesi Ana Hedef Seçicileri (OPSİYONEL YAPILDI)
const goalSelects = [
 document.getElementById('wiz-parent-goal'),
 document.getElementById('highlight-parent-goal'),
 document.getElementById('task-parent-goal'),
 document.getElementById('edit-task-parent-goal'),
 document.getElementById('event-parent-goal'),
 document.getElementById('convert-dump-parent-goal')
];
    goalSelects.forEach(select => {
        if (!select) return;
        const currentValue = select.value;
        select.innerHTML = '<option value="">🎯 Hedef (Opsiyonel)</option>'; // Zorunluluk kalktı
        goals.forEach(g => {
            const opt = document.createElement('option');
            opt.value = g.id; opt.textContent = g.title;
            select.appendChild(opt);
        });
        if (currentValue && goals.some(g => String(g.id) === String(currentValue))) select.value = currentValue;
    });

    // 3. Premium Hap Butonlar (Alışkanlıklar İçin)
    const pillContainers = [
        { id: 'habit-goal-pills', selectedIds: window.tempHabitGoals || [] },
        { id: 'edit-habit-goal-pills', selectedIds: window.tempEditHabitGoals || [] }
    ];

    pillContainers.forEach(containerObj => {
        const container = document.getElementById(containerObj.id);
        if (!container) return;

        let currentSelected = Array.from(container.querySelectorAll('.goal-pill.selected')).map(p => p.dataset.val);
        if(containerObj.selectedIds.length > 0) currentSelected = containerObj.selectedIds;

        container.innerHTML = '';
        if(goals.length === 0) {
            container.innerHTML = '<span class="u-font-size-12px_color-var-text-muted">Önce bir Ana Hedef oluşturmalısın.</span>';
            return;
        }

        goals.forEach(g => {
            const pill = document.createElement('div');
            pill.className = `goal-pill ${currentSelected.includes(g.id) ? 'selected' : ''}`;
            pill.dataset.val = g.id;
            pill.innerHTML = `<i class="fa-solid fa-bullseye"></i> ${window.escapeHtml(g.title)}`;
            pill.onclick = () => { pill.classList.toggle('selected'); };
            container.appendChild(pill);
        });

        if(containerObj.id === 'edit-habit-goal-pills') window.tempEditHabitGoals = [];
    });
}
