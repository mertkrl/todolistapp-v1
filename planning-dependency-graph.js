// ─── PLANLAMA — HEDEF BAĞIMLILIK GRAFİĞİ ───────────────────────────────
// planning.js dosyasından çıkarıldı (Faz 2, 2026-07-20). Hedefler arası
// "X bitmeden Y başlamasın" bağımlılıklarını yönetir (localStorage +
// Supabase goal_dependencies tablosu) ve döngü kontrolü yapar.
//
// ÖNEMLİ: Bu dosya index.html'de/inline-module-loader.js'de planning.js'ten
// ÖNCE yüklenmeli — planning.js'in init() fonksiyonu window.loadDependencies()'i
// SENKRON, üst-düzey olarak çağırıyor (bkz. Faz 2 metodolojisi, sıralama
// kontrolü adımı).
//
// Dış bağımlılıklar (planning.js'te kalıyor, window.* köprüsüyle açıldı):
// - goals → window._pgGetGoals() (salt-okunur referans, find() çalışır)
// - dependencies → window._pgGetDependencies() / window._pgSetDependencies()
//   (referans — push/find çalışır; reassign edildiği için setter da gerekli)
// - toast, render → window.*
// - window.FocusSupabase / window.currentUser → zaten global

function loadDependencies() {
    window._pgSetDependencies(JSON.parse(localStorage.getItem('planning_deps') || '[]'));
}
window.loadDependencies = loadDependencies;

function saveDependencies() {
    const dependencies = window._pgGetDependencies();
    localStorage.setItem('planning_deps', JSON.stringify(dependencies));
    if (window.FocusSupabase && window.currentUser) {
        // Tüm bağımlılıkları upsert et
        const uid = window.currentUser.id;
        window.FocusSupabase.from('goal_dependencies')
            .delete().eq('user_id', uid).then(() => {
                if (!dependencies.length) return;
                window.FocusSupabase.from('goal_dependencies').insert(
                    dependencies.map(d => ({ ...d, user_id: uid }))
                ).then(() => {}).catch(() => {});
            });
    }
}
window.saveDependencies = saveDependencies;

function isBlocked(goalId) {
    const goals = window._pgGetGoals();
    return window._pgGetDependencies()
        .filter(d => d.to === goalId)
        .some(d => {
            const dep = goals.find(g => g.id === d.from);
            return dep && dep.status !== 'completed';
        });
}
window.isPlanningGoalBlocked = isBlocked;

function addDependency(fromId, toId) {
    const dependencies = window._pgGetDependencies();
    if (fromId === toId) return;
    if (dependencies.find(d => d.from === fromId && d.to === toId)) return;
    // Döngü kontrolü
    if (_wouldCreateCycle(fromId, toId)) { window.toast('⚠️ Bu bağımlılık döngü oluşturur'); return; }
    dependencies.push({ id: 'dep_' + Date.now(), from: fromId, to: toId });
    saveDependencies();
    window.render();
    window.toast('Bağımlılık eklendi ✓');
}
window.addPlanningDependency = addDependency;

function removeDependency(depId) {
    window._pgSetDependencies(window._pgGetDependencies().filter(d => d.id !== depId));
    saveDependencies();
    window.render();
}
window.removePlanningDependency = removeDependency;

window.getPlanningDependencies = () => window._pgGetDependencies();

function _wouldCreateCycle(fromId, toId) {
    const dependencies = window._pgGetDependencies();
    const visited = new Set();
    const stack   = [toId];
    while (stack.length) {
        const cur = stack.pop();
        if (cur === fromId) return true;
        if (visited.has(cur)) continue;
        visited.add(cur);
        dependencies.filter(d => d.from === cur).forEach(d => stack.push(d.to));
    }
    return false;
}

// Timeline'da bağımlılık oklarını çiz (şu an hiçbir yerden çağrılmıyor —
// taşınmadan önce de kullanılmayan bir yardımcıydı, olduğu gibi taşındı).
function _drawDependencyArrows(active, xOfFn, ROW_H, HEADER_H) {
    const dependencies = window._pgGetDependencies();
    if (!dependencies.length) return '';
    let arrows = '';
    dependencies.forEach(dep => {
        const fi = active.findIndex(g => g.id === dep.from);
        const ti = active.findIndex(g => g.id === dep.to);
        if (fi === -1 || ti === -1) return;
        const fromG = active[fi], toG = active[ti];
        // Ok: from hedefin deadline'ından to hedefin başına
        const x1 = fromG.deadline ? xOfFn(fromG.deadline) : xOfFn(fromG.created_at);
        const y1 = HEADER_H + fi * ROW_H + ROW_H / 2;
        const x2 = toG.created_at ? xOfFn(toG.created_at.split('T')[0]) : x1 + 20;
        const y2 = HEADER_H + ti * ROW_H + ROW_H / 2;
        const blocked = toG.status !== 'completed' && fromG.status !== 'completed';
        const color   = blocked ? '#f87171' : '#4ade80';
        const mx = (x1 + x2) / 2;
        arrows += `<path d="M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}"
            fill="none" stroke="${color}" stroke-width="1.5" stroke-dasharray="4 3" opacity=".6"
            marker-end="url(#dep-arrow-${blocked?'red':'green'})"/>`;
    });
    // Arrow markers
    const defs = `<defs>
        <marker id="dep-arrow-red" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="#f87171"/>
        </marker>
        <marker id="dep-arrow-green" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="#4ade80"/>
        </marker>
    </defs>`;
    return defs + arrows;
}
window._drawDependencyArrows = _drawDependencyArrows;
