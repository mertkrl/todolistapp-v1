// planning-ghost-toast.js
// planning.js'ten taşındı — Öneri 3: Ghost Toast bildirimi.
// Collab planlama görünümünde diğer üyelerden gelen olayları (görev ekleme,
// silme, tamamlama vb.) tek bir "ghost toast" kutusunda gösterir ve
// başlıktaki bildirim rozetini günceller.

const esc = window.escapeHtml || (s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'));

let _ghostToastTimer = null;
export function _pvUpdateActivityFeed(entry) {
        if (!entry || !window.PlanningCollab?.isActive()) return;
        // Notification badge on plan header
        const log = window.PlanningCollab.getActivity(window.PlanningCollab.roomId);
        const badge = document.getElementById('pg-pv-notif-badge');
        const notifBtn = document.getElementById('pg-pv-notif-btn');
        if (badge && notifBtn) {
            notifBtn.style.display = '';
            badge.style.display = '';
            badge.textContent = log.length > 9 ? '9+' : String(log.length);
        }
        // Ghost Toast
        const actionIcons = { task_add:'📌', task_delete:'🗑️', task_toggle:'✓', task_pending:'⏳',
            ms_add:'🚩', ms_toggle:'✓', ms_delete:'🗑️', comment:'💬', approved:'✅', join:'👋' };
        let container = document.getElementById('pg-ghost-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'pg-ghost-toast-container';
            document.body.appendChild(container);
        }
        // Tek bir toast kutusu: yeni bildirim gelince alt alta yığmak yerine
        // mevcut kutunun içeriğini günceller (sohbetteki gibi yerinde değişir).
        let toast = container.querySelector('.pg-ghost-toast');
        const isNew = !toast;
        if (!toast) {
            toast = document.createElement('div');
            toast.className = 'pg-ghost-toast';
            container.appendChild(toast);
        }
        toast.innerHTML = `
            <span class="pg-ghost-toast-avatar">${esc((entry.user_name||'?').slice(0,2).toUpperCase())}</span>
            <span class="pg-ghost-toast-body">
                <span class="pg-ghost-toast-name">${esc(entry.user_name)}</span>
                <span class="pg-ghost-toast-action">${esc(entry.action_label)}</span>
                ${entry.target ? `<span class="pg-ghost-toast-target">"${esc(entry.target.slice(0,28))}"</span>` : ''}
            </span>
            <span class="pg-ghost-toast-icon">${actionIcons[entry.action]||'·'}</span>`;
        toast.querySelector('.pg-ghost-toast-avatar').style.background = entry.user_color || '#888';
        toast.querySelector('.pg-ghost-toast-name').style.color = entry.user_color || '#aaa';
        toast.classList.remove('hiding');
        if (isNew) {
            requestAnimationFrame(() => toast.classList.add('visible'));
        } else {
            toast.classList.add('visible');
        }
        clearTimeout(_ghostToastTimer);
        _ghostToastTimer = setTimeout(() => {
            toast.classList.remove('visible');
            toast.classList.add('hiding');
            setTimeout(() => toast.remove(), 400);
        }, 3200);
}

window._pvUpdateActivityFeed = _pvUpdateActivityFeed;
