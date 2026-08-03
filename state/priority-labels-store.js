const _priorityLabels = { 'high': 'Yüksek', 'medium': 'Orta', 'low': 'Düşük' };

export function getPriorityLabels() {
    return _priorityLabels;
}

window.__getPriorityLabelsRef = getPriorityLabels;
