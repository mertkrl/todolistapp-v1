import { _normYMD } from './planning-wizard.js';
import { msUid } from './planning-utils.js';

function _pvApplyTaskChipStyles(container) {
    container?.querySelectorAll('[data-chip-top]').forEach(chip => {
        chip.style.top    = chip.dataset.chipTop + 'px';
        chip.style.height = chip.dataset.chipHeight + 'px';
        chip.style.left   = chip.dataset.chipLeft;
        chip.style.width  = chip.dataset.chipWidth;
        const color = chip.dataset.chipColor, mix = chip.dataset.chipMix;
        chip.style.background = `color-mix(in srgb,${color} ${mix}%,transparent)`;
        chip.style.borderLeftColor = color;
    });
}

function _pvMirrorTaskToMilestone(g, taskId, title, dateStr, timeStart, timeEnd) {
    if (!window._pvIsLessonPlan(g)) return;
    g.milestones = g.milestones || [];
    let ms = g.milestones.find(m => m.task_mirror_id === taskId);
    if (!ms) {
        ms = { id: msUid(), task_mirror_id: taskId, is_task_mirror: true, done: false, order: g.milestones.length, description: '' };
        g.milestones.push(ms);
    }
    ms.title = title;
    ms.due_date = dateStr;
    ms.start_date = dateStr;
    ms.start_time = timeStart || '';
    ms.end_time = timeEnd || '';
    ms.is_task_mirror = true;
    g._dirty = true;
}

function _pvBackfillMirrors(g) {
    let changed = false;
    (g.milestones || []).forEach(m => {
        if (m.task_mirror_id && !m.is_task_mirror) { m.is_task_mirror = true; changed = true; }
    });
    const myTasks = FocusStorage.get('tasks', []).filter(t => String(t.parentGoal) === String(g.id) && t.timeStart);
    const mirrored = new Set((g.milestones || []).map(m => m.task_mirror_id).filter(Boolean));
    myTasks.forEach(t => {
        if (mirrored.has(t.id)) return;
        _pvMirrorTaskToMilestone(g, t.id, t.text, _normYMD(t.date), t.timeStart, t.timeEnd);
        changed = true;
    });
    if (changed) { g._dirty = true; window.persistGoals(); }
}

function _pvUnmirrorTask(g, taskId) {
    if (!window._pvIsLessonPlan(g)) return;
    const before = (g.milestones || []).length;
    g.milestones = (g.milestones || []).filter(m => m.task_mirror_id !== taskId);
    if (g.milestones.length !== before) g._dirty = true;
}

window._pvApplyTaskChipStyles = _pvApplyTaskChipStyles;
window._pvMirrorTaskToMilestone = _pvMirrorTaskToMilestone;
window._pvBackfillMirrors = _pvBackfillMirrors;
window._pvUnmirrorTask = _pvUnmirrorTask;

export { _pvApplyTaskChipStyles, _pvMirrorTaskToMilestone, _pvBackfillMirrors, _pvUnmirrorTask };
