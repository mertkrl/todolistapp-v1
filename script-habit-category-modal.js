// Alışkanlık kaydetme + Alışkanlık/Kategori modallarını aç-kapa (Faz H2,
// script.js'ten çıkarıldı). DOM elemanları burada tekrar document.getElementById
// ile alınıyor (script-daily-highlight.js gibi diğer çıkarılmış dosyalarla aynı
// desen) — closure paylaşımı gerekmiyor. `habits` closure state'i için
// window.__getHabitsRef() köprüsü kullanılıyor (script.js'te setter yok, sadece
// okunuyor, saveHabits reassignment yapmıyor).
import { populateParentHabitSelects } from './script-populate-parent-selects.js';

export function saveHabits() {
    Store.habits.set(window.__getHabitsRef());
    populateParentHabitSelects();
}
window.saveHabits = saveHabits;

export function closeHabitModal() {
    const habitCreateModal = document.getElementById('habit-create-modal');
    if (!habitCreateModal) return;
    habitCreateModal.classList.add('hidden');
}
window.closeHabitModal = closeHabitModal;

export function openCategoryModal() {
    const categoryModal = document.getElementById('category-modal');
    const newCategoryInput = document.getElementById('new-category-input');
    if (!categoryModal) return;
    categoryModal.classList.remove('hidden');
    if (newCategoryInput) newCategoryInput.value = '';
    setTimeout(() => { if (newCategoryInput) newCategoryInput.focus(); }, 100);
}
window.openCategoryModal = openCategoryModal;

export function closeCategoryModal() {
    const categoryModal = document.getElementById('category-modal');
    if (categoryModal) categoryModal.classList.add('hidden');
}
window.closeCategoryModal = closeCategoryModal;
