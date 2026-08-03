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
// - window.FocusSupabase / getCurrentUser() → zaten global

import { getCurrentUser } from './state/current-user-store.js';
export function loadDependencies() {
    window._pgSetDependencies(JSON.parse(localStorage.getItem('planning_deps') || '[]', window._safeJsonReviver));
}
window.loadDependencies = loadDependencies;

export function saveDependencies() {
    const dependencies = window._pgGetDependencies();
    localStorage.setItem('planning_deps', JSON.stringify(dependencies));
    if (window.FocusSupabase && getCurrentUser()) {
        // Tüm bağımlılıkları upsert et
        const uid = getCurrentUser().id;
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

export function isBlocked(goalId) {
    const goals = window._pgGetGoals();
    return window._pgGetDependencies()
        .filter(d => d.to === goalId)
        .some(d => {
            const dep = goals.find(g => g.id === d.from);
            return dep && dep.status !== 'completed';
        });
}
window.isPlanningGoalBlocked = isBlocked;

export function addDependency(fromId, toId) {
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

export function removeDependency(depId) {
    window._pgSetDependencies(window._pgGetDependencies().filter(d => d.id !== depId));
    saveDependencies();
    window.render();
}
window.removePlanningDependency = removeDependency;

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
