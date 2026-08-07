// ============================================================
// FOCUSAI SCRIPT-HABIT-RENDER-MUTATE.JS
// script.js'ten çıkarılmış: Alışkanlık listesi render'ı (renderHabits,
// renderHabitRows, renderHabitCategories, renderHabitFilters) ve
// alışkanlık oluşturma (addHabit, openHabitModal). script.js'in window
// köprülerini (__getHabitsRef, __getGoalsRef, __getTasksRef,
// __getHabitCategoriesRef, isHabitExpired, getChallengeDays,
// getGoalColor, getHabitsForDate, saveHabits, closeHabitModal,
// showPremiumModal) kullanır — script.js önce yüklenir, bu dosya sonra.
// ============================================================
import { _setFlatpickrDate } from './script-calendar-date-utils.js';
import { populateParentHabitSelects } from './script-populate-parent-selects.js';

(function () {
'use strict';

const MAX_ACTIVE_HABITS = 7;
let currentHabitFilter = 'all';
let selectedHabitEmoji = '🔁';

const taskList = document.getElementById('task-list');
const habitList = document.getElementById('habit-list');
const habitInput = document.getElementById('habit-input');
const habitTargetInput = document.getElementById('habit-target');
const habitStartDateInput = document.getElementById('habit-start-date');
const habitCategorySelect = document.getElementById('habit-category');
const habitFilterContainer = document.getElementById('habit-filter-container');
const habitBuddySelect = document.getElementById('habit-buddy');
const habitEndDateInput = document.getElementById('habit-end-date');
const habitCreateModal = document.getElementById('habit-create-modal');
const btnOpenHabitModal = document.getElementById('btn-open-habit-modal');
const habitEmojiBtn = document.getElementById('habit-emoji-btn');
const habitEmojiPicker = document.getElementById('habit-emoji-picker');

function openHabitModal() {
    const habits = window.__getHabitsRef();
    if (!habitCreateModal) return;
    const activeHabitCount = habits.filter(h => !window.isHabitExpired(h)).length;
    if (activeHabitCount >= MAX_ACTIVE_HABITS) {
        window.showPremiumModal({
            title: 'Fazla Yüklenme 🌱',
            message: `Aynı anda en fazla ${MAX_ACTIVE_HABITS} aktif alışkanlık sürdürebilirsin. Çok sayıda yeni alışkanlığı birden başlatmak her birine ayıracağın irade ve dikkati böler, hiçbirini kalıcı hale getiremezsin. Yeni bir alışkanlık eklemeden önce mevcutlardan birini tamamla ya da süresi dolmuşları temizle.`,
            type: 'warning'
        });
        return;
    }
    habitCreateModal.classList.remove('hidden');
    if (habitTargetInput) habitTargetInput.value = 30;
    selectedHabitEmoji = '🔁';
    if (habitEmojiBtn) habitEmojiBtn.textContent = '🔁';
    if (habitEmojiPicker) habitEmojiPicker.classList.add('hidden');
    const today = new Date();
    _setFlatpickrDate(habitStartDateInput, today);
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + 29); // 30 gün - 1
    setTimeout(() => {
        _setFlatpickrDate(habitEndDateInput, endDate);
        const hint = document.getElementById('hm-sync-hint');
        if (hint) hint.textContent = '';
        habitInput && habitInput.focus();
    }, 30);
}
window.openHabitModal = openHabitModal;

function renderHabitCategories() {
    const habitCategories = window.__getHabitCategoriesRef();
    // Güncellenecek tüm kategori açılır menülerinin ID'leri
    const dropdownIds = ['task-category', 'edit-task-category', 'habit-category', 'convert-dump-habit-category', 'goal-category-input', 'calendar-task-category'];

    dropdownIds.forEach(id => {
        const select = document.getElementById(id);
        if (!select) return;

        const currentValue = select.value; // Kullanıcının mevcut seçimini hafızada tut
        select.innerHTML = ''; // İçini temizle

        // Tüm kategorileri menüye ekle
        habitCategories.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat.id;
            opt.textContent = cat.name;
            select.appendChild(opt);
        });

        // Eğer kullanıcının eski seçtiği kategori hala listedeyse, seçimi bozulmasın
        if (habitCategories.some(c => c.id === currentValue)) {
            select.value = currentValue;
        }
    });
}
window.renderHabitCategories = renderHabitCategories;

function renderHabitFilters() {
    const habitCategories = window.__getHabitCategoriesRef();
    habitFilterContainer.innerHTML = `<button class="filter-btn ${currentHabitFilter === 'all' ? 'active' : ''}" data-filter="all">Tümü</button>`;
    habitCategories.forEach(cat => {
        habitFilterContainer.innerHTML += `<button class="filter-btn ${currentHabitFilter === cat.id ? 'active' : ''}" data-filter="${cat.id}">${escapeHtml(cat.name)}</button>`;
    });
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            currentHabitFilter = e.target.getAttribute('data-filter');
            renderHabitFilters(); renderHabits();
        });
    });
}
window.renderHabitFilters = renderHabitFilters;

function renderHabits() {
    const habits = window.__getHabitsRef();
    const habitCategories = window.__getHabitCategoriesRef();
    habitList.innerHTML = '';
    const todayStr = window.formatDateToString(new Date());

    // "+ Yeni Alışkanlık" butonuna aktif/limit sayısını göster; limite ulaşınca soluklaştır
    if (btnOpenHabitModal) {
        const activeHabitCountForBtn = habits.filter(h => !window.isHabitExpired(h)).length;
        const habitAtLimit = activeHabitCountForBtn >= MAX_ACTIVE_HABITS;
        btnOpenHabitModal.innerHTML = `<i class="fa-solid fa-plus"></i> Yeni Alışkanlık <span class="u-opacity-p75_font-weight-500_font-size-12px">(${activeHabitCountForBtn}/${MAX_ACTIVE_HABITS})</span>`;
        btnOpenHabitModal.style.opacity = habitAtLimit ? '0.55' : '';
        btnOpenHabitModal.title = habitAtLimit ? `Aynı anda en fazla ${MAX_ACTIVE_HABITS} aktif alışkanlık sürdürebilirsin.` : '';
    }

    const filteredHabits = currentHabitFilter === 'all' ? habits : habits.filter(h => h.category === currentHabitFilter);

    if(filteredHabits.length === 0) {
        habitList.innerHTML = '<div class="empty-state">Bu kategoride hiç alışkanlık bulunmuyor.</div>';
        return;
    }

    filteredHabits.forEach((habit) => {
        const li = document.createElement('li');
        li.className = 'habit-item';
        li.dataset.habitId = habit.id;

        const targetDays = habit.targetDays || 21;
        const completedDays = Object.keys(habit.history).length;
        const catId = habit.category || habitCategories[0].id;
        const catObj = habitCategories.find(c => c.id === catId);
        const progressPercentage = Math.min(Math.round((completedDays / targetDays) * 100), 100);

        const challengeDays = window.getChallengeDays(habit);
        let trackerHTML = '';
        challengeDays.forEach(day => { trackerHTML += `<div class="tracker-dot ${day.status} ${day.locked}" data-date="${day.dateStr}">${day.status === 'completed' ? '' : day.dayNumber}</div>`; });

        const [sD, sM, sY] = habit.startDate.split('-').map(Number); // GÜNCELLEME: d, m, y sırasına alındı
        const sdObj = new Date(sY, sM - 1, sD);
        const edObj = new Date(sY, sM - 1, sD);
        edObj.setDate(edObj.getDate() + habit.targetDays - 1);
        const dateRangeText = `${sdObj.toLocaleDateString('tr-TR', {month:'short', day:'numeric'})} - ${edObj.toLocaleDateString('tr-TR', {month:'short', day:'numeric'})}`;

        const buddyBadge = (habit.buddy && habit.buddy !== 'none') ? `<span class="u-font-size-11px_color-h2ed573_background-rgba462131150p1_pa"><i class="fa-solid fa-user-group"></i> ${escapeHtml(habit.buddy.split(' ')[0])} ile Ortak</span>` : '';

        const linkedGoalBadges = (habit.parentGoals && habit.parentGoals.length > 0)
            ? habit.parentGoals.map(gId => {
                const gc = window.getGoalColor(gId);
                if (!gc) return '';
                return `<span title="Ana Hedef" class="u-font-size-11px_color-var-primary-color_background-rgba2121"><i class="fa-solid fa-mountain-sun"></i> ${escapeHtml(gc.label)}</span>`;
            }).join('')
            : '';

        li.innerHTML = `
            <div class="habit-icon-wrapper"><i class="fa-solid ${habit.icon && habit.icon.startsWith('fa-') ? escapeHtml(habit.icon) : 'fa-repeat'}"></i></div>
            <div class="habit-details">
                <div class="habit-header-top">
                    <span class="habit-name">${escapeHtml(habit.name)}</span>
                    ${buddyBadge}
                    ${linkedGoalBadges}
                    <span class="habit-category-tag">${escapeHtml(catObj ? catObj.name : 'Genel')}</span>
                </div>
                <div class="u-display-flex_gap-8px_align-items-center_flex-wrap-wrap">
                    <span class="habit-streak"><i class="fa-solid fa-bullseye"></i> ${targetDays} gün hedef</span>
                    <span class="u-font-size-11px_color-var-text-muted"><i class="fa-regular fa-calendar u-margin-right-3px" ></i>${dateRangeText}</span>
                </div>
                <div class="habit-progress-wrapper">
                    <div class="habit-progress-container"><div class="habit-progress-fill" ></div></div>
                    <span class="habit-progress-text">%${progressPercentage} · ${completedDays}/${targetDays} gün</span>
                </div>
                <div class="habit-tracker">${trackerHTML}</div>
            </div>
            <div class="habit-actions">
                <button class="complete-today-btn ${habit.history[todayStr] ? 'done' : ''}" data-date="${todayStr}">
                    <i class="fa-solid ${habit.history[todayStr] ? 'fa-check' : 'fa-bolt'}"></i> ${habit.history[todayStr] ? 'Tamamlandı' : 'Bugünü Tamamla'}
                </button>
                <div class="habit-side-actions">
                    <button class="edit-habit-btn" data-action="edit-habit" data-id="${habit.id}" title="Düzenle" aria-label="Düzenle"><i class="fa-solid fa-pen"></i></button>
                    <button class="habit-del-btn delete-btn" title="Sil" aria-label="Sil"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        `;
        const _habitProgFill = li.querySelector('.habit-progress-fill');
        if (_habitProgFill) _habitProgFill.style.width = progressPercentage + '%';
        habitList.appendChild(li);
    });
    window.saveHabits();
}
window.renderHabits = () => renderHabits();

// renderTasks (script-task-render-mutate.js) tarafından çağrılır — Bugün
// sekmesindeki görev listesinin altına o günün alışkanlık satırlarını ekler.
function renderHabitRows(todayStr) {
    const habits = window.__getHabitsRef();
    const goals = window.__getGoalsRef();
    const tasks = window.__getTasksRef();
    const todayHabits = window.getHabitsForDate(todayStr);

    todayHabits.forEach(habit => {
        const isCompleted = !!habit.history[todayStr];
        const catDisplay = window.getHabitCategoryLabel(habit.category);
        const buddyBadge = (habit.buddy && habit.buddy !== 'none') ? `<span class="task-category-tag u-background-rgba462131150p15_color-h2ed573_border-color-rgb" title="Ortak Partner: ${escapeHtml(habit.buddy)}"><i class="fa-solid fa-user-group"></i> ${escapeHtml(habit.buddy.split(' ')[0])}</span>` : '';

        // --- Bağlı Hedefleri Rozet Olarak Hazırla ---
        let goalBadgesHTML = '';
        if (habit.parentGoals && habit.parentGoals.length > 0) {
            habit.parentGoals.forEach(goalId => {
                const goal = goals.find(g => String(g.id) === String(goalId));
                if (goal) {
                    goalBadgesHTML += `<span class="task-category-tag u-background-rgba108922310p1_color-var-primary-color_border-" ><i class="fa-solid fa-bullseye"></i> ${escapeHtml(goal.title)}</span>`;
                }
            });
        }

        let hasPendingTaskForGoal = false;
        if (habit.parentGoals && habit.parentGoals.length > 0) {
            hasPendingTaskForGoal = tasks.some(t =>
                t.date === todayStr &&
                !t.completed &&
                t.parentGoal &&
                // Sadece sistemde hâlâ mevcut olan (silinmemiş) aktif hedeflerin görevlerini kilitler
                goals.some(g => String(g.id) === String(t.parentGoal)) &&
                habit.parentGoals.includes(String(t.parentGoal))
            );
        }

        const clickAttr = hasPendingTaskForGoal ? "" : `data-action="toggle-habit-today" data-id="${habit.id}" data-date="${todayStr}"`;
        const autoBadge = hasPendingTaskForGoal ? `<span class="task-time-badge u-background-rgba255159670p1_color-hff9f43_border-1pxsolidrg" ><i class="fa-solid fa-bolt"></i> Görevle Tamamlanacak</span>` : '';

        // GERÇEK GÖRSEL BUG DÜZELTMESİ (2026-08-06): bu satır önceden düz
        // `.task-item > .task-left/.task-meta` (tl-card/tl-rail OLMADAN)
        // render ediyordu — bu yüzden Bugün'deki asıl görev kartlarından
        // (renderHighlightGoalRow/buildTaskListItem'ın ürettiği .tl-card
        // yapısı) tamamen farklı, kenarlıksız/arka plansız çıplak bir satır
        // gibi görünüyordu. Artık AYNI tl-time-col/tl-rail/tl-card-inner
        // iskeletini kullanıyor — kullanıcı normal bir alışkanlık
        // oluşturduğunda gördüğü asıl satır budur (renderHabitRows her
        // renderTasks()'ta otomatik çağrılıyor, ayrı bir "göreve dönüştür"
        // adımı gerekmiyor).
        const li = document.createElement('li');
        li.className = `task-item habit-row ${isCompleted ? 'completed' : ''}`;
        if (hasPendingTaskForGoal) li.classList.add('habit-row-locked');

        li.innerHTML = `
            <div class="tl-time-col">
                <i class="fa-solid fa-repeat habit-row-icon" title="Tüm Gün"></i>
            </div>
            <div class="tl-rail">
                <span class="tl-rail-line"></span>
                <span class="tl-rail-dot habit-row-dot" ></span>
                <span class="tl-rail-line"></span>
            </div>
            <div class="tl-card">
                <div class="tl-card-inner habit-row-inner" >
                    <div class="task-checkbox habit-row-checkbox" ${clickAttr}></div>
                    <div class="task-left">
                        <span class="task-text habit-row-text" ${clickAttr}>${escapeHtml(habit.name)}</span>
                        <div class="task-meta">
                            <span class="task-category-tag tag-habit"><i class="fa-solid fa-leaf u-margin-right-4px" ></i>${catDisplay}</span>
                            ${buddyBadge}
                            ${goalBadgesHTML}
                            ${autoBadge}
                        </div>
                    </div>
                </div>
            </div>
        `;
        if (hasPendingTaskForGoal) {
            const _cb = li.querySelector('.habit-row-checkbox');
            if (_cb) { _cb.style.cursor = 'not-allowed'; _cb.style.borderColor = 'var(--text-muted)'; }
            const _txt = li.querySelector('.habit-row-text');
            if (_txt) _txt.style.cursor = 'not-allowed';
        }
        taskList.appendChild(li);
    });
}
window.renderHabitRows = renderHabitRows;

function addHabit() {
    const habits = window.__getHabitsRef();
    const text = habitInput.value.trim();
    const targetDays = parseInt(habitTargetInput.value) || 21;
    const category = habitCategorySelect.value;
    const startDate = habitStartDateInput.value ? window.fromInputDate(habitStartDateInput.value) : window.formatDateToString(new Date());
    const buddy = habitBuddySelect ? habitBuddySelect.value : 'none';
    const pillsContainer = document.getElementById('habit-goal-pills');
    const selectedGoals = pillsContainer ? Array.from(pillsContainer.querySelectorAll('.goal-pill.selected')).map(p => p.dataset.val) : [];

    const habitIcon = '';

    if(text !== "") {
        const activeHabitCount = habits.filter(h => !window.isHabitExpired(h)).length;
        if (activeHabitCount >= MAX_ACTIVE_HABITS) {
            window.showPremiumModal({
                title: 'Fazla Yüklenme 🌱',
                message: `Aynı anda en fazla ${MAX_ACTIVE_HABITS} aktif alışkanlık sürdürebilirsin. Yeni bir alışkanlık eklemeden önce mevcutlardan birini tamamla ya da süresi dolmuşları temizle.`,
                type: 'warning'
            });
            return;
        }
        // Ortak alışkanlık seçildiyse: alışkanlığı hemen oluşturma, partnere davet gönder.
        // Partner kabul ederse her iki tarafta da otomatik olarak oluşturulacak.
        if (buddy !== 'none' && typeof window.sendBuddyHabitInvite === 'function') {
            const sent = window.sendBuddyHabitInvite(buddy, {
                name: text,
                icon: habitIcon,
                targetDays: targetDays,
                category: category,
                startDate: startDate,
                parentGoals: selectedGoals
            });
            if (sent) {
                habitInput.value = '';
                if (habitBuddySelect) habitBuddySelect.value = 'none';
                window.showPremiumModal({ title: 'Davet Gönderildi!', message: `Partnerine "${text}" alışkanlığı için ortak hedef daveti gönderildi. Kabul ederse ikinizde de otomatik olarak oluşacak.`, type: 'success' });
            }
            return;
        }

        habits.push({
            id: generateId(),
            name: text,
            icon: habitIcon,
            targetDays: targetDays,
            category: category,
            startDate: startDate,
            buddy: 'none',
            parentGoals: selectedGoals,
            history: {}
        });
        habitInput.value = '';
        window.closeHabitModal();

        window.saveHabits(); renderHabits(); window.renderTasks();
        // Görev Ekle modalındaki "Alışkanlık" seçicisi (event-parent-habit)
        // yeni oluşturulan alışkanlığı sayfa yenilenmeden hemen görebilsin.
        populateParentHabitSelects();
        const renderCalendarRef = window.__getRenderCalendarRef();
        const renderEventsRef = window.__getRenderEventsRef();
        const renderStatisticsRef = window.__getRenderStatisticsRef();
        const renderSocialStatsRef = window.__getRenderSocialStatsRef();
        const renderBuddyHabitsRef = window.__getRenderBuddyHabitsRef();
        if(renderCalendarRef) renderCalendarRef();
        if(renderEventsRef) renderEventsRef();
        if(renderStatisticsRef && document.getElementById('istatistikler').classList.contains('active')) renderStatisticsRef();
        if(renderSocialStatsRef && document.getElementById('arkadaslar').classList.contains('active')) renderSocialStatsRef();
        if(renderBuddyHabitsRef && document.getElementById('arkadaslar').classList.contains('active')) renderBuddyHabitsRef();

        if (window.FocusAISocial && typeof window.FocusAISocial.postActivity === 'function') {
           window.FocusAISocial.postActivity(`"${text}" adında yeni bir alışkanlık oluşturdu 🌱`);
       }

        window.showPremiumModal({ title: 'Tebrikler!', message: 'Alışkanlık başarıyla oluşturuldu. Artık görev eklerken bu alışkanlığı alt görevlerinizin ana hedefi olarak seçebilirsiniz.', type: 'success' });
    }
}
window.addHabit = addHabit;

})();
