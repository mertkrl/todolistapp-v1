export function renderSocialStats() {
    // Liderlik tablosu ve arkadaş aktivitesi artık social.js içindeki canlı
    // Firebase abonelikleri (subscribeLeaderboard / subscribeActivity) tarafından
    // gerçek zamanlı olarak yönetiliyor. Burada statik "Sen" verisiyle üzerine
    // yazmak, eklenmiş arkadaşların listede kaybolmasına sebep oluyordu.
}

export function renderBuddyHabits() {
    const container = document.getElementById('buddy-habits-list');
    if(!container) return;

    const habits = window.__getHabitsRef();

    // Gerçek zamanlı partner durumunu Firebase'den çekebilen social.js render'ı varsa onu kullan.
    if (typeof window.renderBuddyHabitsSocial === 'function') {
        window.renderBuddyHabitsSocial(habits);
        return;
    }

    const buddyHabits = habits.filter(h => h.buddy && h.buddy !== 'none');

    if(buddyHabits.length === 0) {
        container.innerHTML = '<div class="u-text-align-center_color-var-text-muted_font-size-13px_padd-2">Henüz ortak bir alışkanlık oluşturmadın. "Alışkanlıklar" sekmesinden yeni bir hedef belirle ve partnerini seç!</div>';
        return;
    }

    let html = '';
    const todayStr = window.formatDateToString(new Date());

    buddyHabits.forEach(habit => {
        const completedDays = Object.keys(habit.history).length;
        const targetDays = habit.targetDays || 21;
        const progressPercentage = Math.min(Math.round((completedDays / targetDays) * 100), 100);

        const isUserDoneToday = !!habit.history[todayStr];
        const isBuddyDoneToday = isUserDoneToday;

        let statusClass = isUserDoneToday ? 'buddy-status-success' : 'buddy-status-waiting';
        let statusText = isUserDoneToday ? '<i class="fa-solid fa-check-double"></i> İkiniz de Tamamladınız' : '<i class="fa-solid fa-hourglass-half"></i> Bugün İçin Bekleniyor';
        let progressClass = isUserDoneToday ? 'success' : '';

        let avatarSrc = "https://ui-avatars.com/api/?name=" + encodeURIComponent(habit.buddy) + "&background=random&color=fff";

        html += `
        <div class="buddy-habit-card" data-habit-id="${habit.id}">
            <div class="buddy-header">
                <span class="buddy-title"><i class="fa-solid ${habit.icon && habit.icon.startsWith('fa-') ? window.escapeHtml(habit.icon) : 'fa-repeat'} u-color-var-primary-color-2" ></i> ${window.escapeHtml(habit.name)}</span>
                <div class="buddy-users">
                    <div class="buddy-avatar-group">
                        <img src="https://ui-avatars.com/api/?name=Sen&background=6c5ce7&color=fff" class="buddy-avatar" title="Sen">
                        <img src="${avatarSrc}" class="buddy-avatar" title="${habit.buddy}">
                    </div>
                </div>
            </div>
            <div class="buddy-progress-wrapper">
                <div class="buddy-status-text">
                    <span>Ortak İlerleme: <strong>${completedDays}/${targetDays} Gün</strong></span>
                    <span class="buddy-status-badge ${statusClass}">${statusText}</span>
                </div>
                <div class="buddy-progress-bar">
                    <div class="buddy-progress-fill ${progressClass}" ></div>
                </div>
            </div>
        </div>`;
    });

    container.innerHTML = html;
    buddyHabits.forEach(habit => {
        const completedDays = Object.keys(habit.history).length;
        const targetDays = habit.targetDays || 21;
        const progressPercentage = Math.min(Math.round((completedDays / targetDays) * 100), 100);
        const card = container.querySelector(`.buddy-habit-card[data-habit-id="${habit.id}"]`);
        const fill = card && card.querySelector('.buddy-progress-fill');
        if (fill) fill.style.width = progressPercentage + '%';
    });
}
