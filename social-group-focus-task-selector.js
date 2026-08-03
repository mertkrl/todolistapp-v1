// ─── GRUP ODAK OVERLAY — GÖREV SEÇİMİ ─────────────────────────────────
// social.js dosyasından çıkarıldı (Faz 2, 2026-07-19).
// Bireysel sistemdeki .active-task-selector/.timer-task-dropdown deseniyle
// birebir aynı; seçilen görev Firebase'e (writeSharedFocusMyTask) yazılır.
//
// Dış bağımlılıklar:
// - sharedFocusMyTaskId/sharedFocusMyTaskText → social.js'te kalıyor (başka
//   yerlerden de okunuyor: buildSoloFocusRoomLike, exitCWRoomLocal), bu
//   yüzden window._gfGetMyTask() / window._gfSetMyTask(id, text) ile
//   okunuyor/yazılıyor.
// - currentRoomLinkedHabit → window._cwGetLinkedHabit() (salt-okunur, 23
//   başka yerde de kullanılan paylaşılan oda state'i — taşınmadı)
// - writeSharedFocusMyTask → window.* köprüsü (social.js'te kalıyor)
// - _escapeHtml → window.escapeHtml
export function gfApplyActiveTaskDisplay() {
    const panel = document.getElementById('gf-active-focus-task');
    const nameEl = document.getElementById('gf-focus-task-name');
    const selText = document.getElementById('gf-current-task-text');
    const { id: myTaskId, text: myTaskText } = window._gfGetMyTask();
    if (myTaskId && myTaskText) {
        if (panel) panel.classList.remove('hidden');
        if (nameEl) nameEl.textContent = myTaskText;
        if (selText) selText.innerHTML = `<i class="fa-solid fa-crosshairs u-color-hff9f43" ></i> <span class="u-color-hff9f43">${window.escapeHtml(myTaskText)}</span>`;
    } else {
        if (panel) panel.classList.add('hidden');
        if (selText) selText.innerHTML = `<i class="fa-solid fa-bullseye"></i> Odaklanılacak Hedefi Seç`;
    }
}
window.gfApplyActiveTaskDisplay = gfApplyActiveTaskDisplay;

export function gfSelectMyTask(taskId, taskText) {
    window._gfSetMyTask(taskId, taskText);
    gfApplyActiveTaskDisplay();
    window.writeSharedFocusMyTask(taskId, taskText);
    document.getElementById('gf-task-dropdown')?.classList.add('hidden');
}
window.gfSelectMyTask = gfSelectMyTask;

export function gfClearMyTask() {
    window._gfSetMyTask(null, '');
    gfApplyActiveTaskDisplay();
    window.writeSharedFocusMyTask(null, null);
    document.getElementById('gf-task-dropdown')?.classList.add('hidden');
}
window.gfClearMyTask = gfClearMyTask;

export function gfPopulateTaskDropdown() {
    const listEl = document.getElementById('gf-task-list');
    if (!listEl) return;
    listEl.innerHTML = '';
    const tasks = (typeof window.getTodayTasksForFocus === 'function') ? window.getTodayTasksForFocus() : [];
    const { id: myTaskId } = window._gfGetMyTask();
    const linkedHabit = window._cwGetLinkedHabit();

    if (myTaskId) {
        const clearLi = document.createElement('li');
        clearLi.className = 'timer-todo-item';
        clearLi.innerHTML = `<i class="fa-solid fa-xmark si-red"></i> <span class="task-name u-color-hff4757_font-weight-600-2" >Odağı Kaldır</span>`;
        clearLi.onclick = (e) => { e.stopPropagation(); gfClearMyTask(); };
        listEl.appendChild(clearLi);
        const hr = document.createElement('hr');
        hr.style.border = '0';
        hr.style.borderTop = '1px solid rgba(255,255,255,0.1)';
        hr.style.margin = '5px 0';
        listEl.appendChild(hr);
    }

    if (linkedHabit && linkedHabit.id) {
        const li = document.createElement('li');
        li.className = 'timer-todo-item';
        li.innerHTML = `<i class="fa-solid fa-people-arrows si-purple"></i> <span class="task-name si-purple">🤝 Ortak Alışkanlık: ${window.escapeHtml(linkedHabit.name)}</span>`;
        li.onclick = (e) => { e.stopPropagation(); gfSelectMyTask(`habit:${linkedHabit.id}`, linkedHabit.name); };
        listEl.appendChild(li);
    }

    if (tasks.length === 0 && !(linkedHabit && linkedHabit.id)) {
        if (!myTaskId) {
            listEl.innerHTML += '<li class="u-padding-10px_font-size-12px_color-var-text-muted_text-alig">Bugün için bekleyen görev yok.</li>';
        }
        return;
    }

    tasks.forEach(t => {
        const li = document.createElement('li');
        li.className = 'timer-todo-item';
        li.innerHTML = `<i class="fa-regular fa-circle"></i> <span class="task-name">${window.escapeHtml(t.text)}</span>`;
        li.onclick = (e) => { e.stopPropagation(); gfSelectMyTask(t.id, t.text); };
        listEl.appendChild(li);
    });
}
window.gfPopulateTaskDropdown = gfPopulateTaskDropdown;

let gfTaskSelectorBound = false;
export function gfEnsureTaskSelectorBindings() {
    if (gfTaskSelectorBound) return;
    gfTaskSelectorBound = true;
    const selector = document.getElementById('gf-active-task-selector');
    const dropdown = document.getElementById('gf-task-dropdown');
    const clearBtn = document.getElementById('gf-clear-focus-btn');
    if (selector) {
        selector.addEventListener('click', (e) => {
            if (e.target.closest('#gf-task-dropdown')) return;
            gfPopulateTaskDropdown();
            dropdown?.classList.toggle('hidden');
        });
        document.addEventListener('click', (e) => {
            if (!selector.contains(e.target)) dropdown?.classList.add('hidden');
        });
    }
    if (clearBtn) clearBtn.addEventListener('click', (e) => { e.stopPropagation(); gfClearMyTask(); });
}
window.gfEnsureTaskSelectorBindings = gfEnsureTaskSelectorBindings;
