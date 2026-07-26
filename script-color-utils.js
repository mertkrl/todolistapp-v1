// script-color-utils.js
// script.js'ten çıkarıldı (Faz F, 3. tur): Kategori/hedef/görev renk yardımcıları
// (getCatColor/getGoalColor/getTaskColor/getHabitCategoryLabel). script.js
// içindeki bare çağrılar (getHabitCategoryLabel/getGoalColor) hâlâ global
// scope üzerinden bu dosyadaki window.* tanımlarına ulaşır (bilinçli olarak
// bırakıldı) — ama bu dosyanın script.js'e olan OKUMA bağımlılığı (Faz G,
// 2026-07-23) artık gerçek ES import ile.
//
// Bağımlılıklar:
//  - goals → getGoalsRef() (script.js'ten import, salt-okunur referans)
//  - habitCategories → getHabitCategoriesRef() (script.js'ten import)

import { getGoalsRef, getHabitCategoriesRef } from './script.js';

// Kategori renk paleti — takvim chip/blok renklendirmesi için
const TASK_CAT_COLORS = {
    'kisisel':  { bg: 'rgba(142,92,246,0.78)',  border: '#8e5cf6', glow: 'rgba(142,92,246,0.28)',  label: 'Kişisel',  icon: 'fa-user' },
    'is':       { bg: 'rgba(255,159,67,0.78)',  border: '#ff9f43', glow: 'rgba(255,159,67,0.28)', label: 'İş',       icon: 'fa-briefcase' },
    'egitim':   { bg: 'rgba(46,213,115,0.78)',  border: '#2ed573', glow: 'rgba(46,213,115,0.25)', label: 'Eğitim',   icon: 'fa-book' },
    'saglik':   { bg: 'rgba(255,71,87,0.78)',   border: '#ff4757', glow: 'rgba(255,71,87,0.28)',  label: 'Sağlık',   icon: 'fa-heart' },
};
// Öncelik rengi (küçük köşe nokta için)
const PRIORITY_DOT_COLOR = { high: '#ff4757', medium: '#D4900E', low: '#2ed573' };
window.PRIORITY_DOT_COLOR = PRIORITY_DOT_COLOR;

export function getCatColor(catId) {
    if (TASK_CAT_COLORS[catId]) return TASK_CAT_COLORS[catId];
    // Dinamik kategoriler için hash renk üret
    let hash = 0;
    for (let i = 0; i < (catId || '').length; i++) hash = catId.charCodeAt(i) + ((hash << 5) - hash);
    const hue = Math.abs(hash) % 360;
    return { bg: `hsla(${hue},65%,55%,0.78)`, border: `hsl(${hue},65%,60%)`, glow: `hsla(${hue},65%,55%,0.25)`, label: catId, icon: 'fa-tag' };
}
window.getCatColor = getCatColor;

// Hedef renk paleti — her hedef için tutarlı, birbirinden ayrışan renkler
const GOAL_COLOR_PALETTE = [
    { bg: 'rgba(108,92,231,0.82)',  border: '#6c5ce7', glow: 'rgba(108,92,231,0.35)'  }, // violet
    { bg: 'rgba(0,206,201,0.82)',   border: '#00cec9', glow: 'rgba(0,206,201,0.32)'   }, // cyan
    { bg: 'rgba(253,203,110,0.85)', border: '#fdcb6e', glow: 'rgba(253,203,110,0.35)' }, // gold
    { bg: 'rgba(116,185,255,0.82)', border: '#74b9ff', glow: 'rgba(116,185,255,0.32)' }, // blue
    { bg: 'rgba(232,67,147,0.82)',  border: '#e84393', glow: 'rgba(232,67,147,0.32)'  }, // pink
    { bg: 'rgba(0,184,148,0.82)',   border: '#00b894', glow: 'rgba(0,184,148,0.32)'   }, // teal
    { bg: 'rgba(253,121,168,0.82)', border: '#fd79a8', glow: 'rgba(253,121,168,0.32)' }, // rose
    { bg: 'rgba(162,155,254,0.82)', border: '#a29bfe', glow: 'rgba(162,155,254,0.32)' }, // lavender
    { bg: 'rgba(85,239,196,0.82)',  border: '#55efc4', glow: 'rgba(85,239,196,0.32)'  }, // mint
    { bg: 'rgba(255,234,167,0.82)', border: '#ffeaa7', glow: 'rgba(255,234,167,0.32)' }, // cream
];

window.getGoalColor = (goalId) => getGoalColor(goalId);
export function getGoalColor(goalId) {
    if (!goalId) return null;
    const goals = getGoalsRef();
    const goal = goals.find(g => String(g.id) === String(goalId));
    if (!goal) return null;
    const idx = goals.indexOf(goal) % GOAL_COLOR_PALETTE.length;
    return { ...GOAL_COLOR_PALETTE[idx], label: goal.title, icon: 'fa-mountain-sun', isGoal: true };
}

// Görev için renk: parentGoal varsa hedef rengi, yoksa kategori rengi
export function getTaskColor(task) {
    if (!task) return getCatColor('kisisel');
    if (task.parentGoal) {
        const gc = getGoalColor(task.parentGoal);
        if (gc) return gc;
    }
    return getCatColor(task.category || 'kisisel');
}
window.getTaskColor = getTaskColor;

export function getHabitCategoryLabel(catId) {
    const cat = getHabitCategoriesRef().find(c => c.id === catId);
    return cat ? cat.name : 'Alışkanlık';
}
window.getHabitCategoryLabel = getHabitCategoryLabel;
