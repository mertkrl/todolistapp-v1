import { FocusStorage } from '../js/storage-manager.js';

let habitCategories = FocusStorage.get('habit_categories', [
    { id: 'genel', name: 'Genel' }, { id: 'saglik', name: 'Sağlık' }, { id: 'kisisel-gelisim', name: 'Kişisel Gelişim' }
]);

export function getHabitCategoriesRef() {
    return habitCategories;
}

export function setHabitCategoriesRef(v) {
    habitCategories = v;
    return v;
}

window.__getHabitCategoriesRef = getHabitCategoriesRef;
window.__setHabitCategoriesRef = setHabitCategoriesRef;
