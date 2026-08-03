// inline-onclick-migration.js — index.html'deki statik onclick="…"/oninput="…"/
// onmouseover="…"/onmouseout="…" özniteliklerinin CSP script-src'den
// 'unsafe-inline' kaldırılabilmesi için addEventListener'a taşınmış hali.
// Her handler orijinal davranışıyla birebir aynı — sadece bağlanma şekli değişti.
// Klasik (type="module" DEĞİL) script olarak, DOM hazır olduktan sonra çalışır.
(function() {
    function bind(id, event, handler) {
        var el = document.getElementById(id);
        if (el) el.addEventListener(event, handler);
    }

    function wire() {
        bind('tsw-goto-planlama-btn', 'click', function() {
            if (typeof window.switchTab === 'function') window.switchTab('planlama');
        });
        bind('gf-settings-close-btn', 'click', function() {
            document.getElementById('gf-settings-modal').classList.add('hidden');
        });
        bind('close-goal-modal-btn', 'click', function() {
            if (typeof closeGoalModal === 'function') closeGoalModal();
        });
        bind('cancel-goal-btn', 'click', function() {
            if (typeof closeGoalModal === 'function') closeGoalModal();
        });
        bind('save-goal-btn', 'click', function() {
            if (typeof saveGoal === 'function') saveGoal();
        });
        bind('cancel-extend-deadline-btn', 'click', function() {
            document.getElementById('extend-deadline-modal').classList.add('hidden');
        });
        bind('save-extend-deadline-btn', 'click', function() {
            if (window.saveExtendedDeadline) window.saveExtendedDeadline();
        });
        bind('edit-goal-info-btn', 'click', function() {
            if (typeof editGoalInfo === 'function') editGoalInfo();
        });
        bind('gd-add-habit-block-btn', 'click', function() {
            var closeBtn = document.getElementById('close-goal-details-btn');
            if (closeBtn) closeBtn.click();
            var habitNav = document.querySelector('[data-target="aliskanliklar"]');
            if (habitNav) habitNav.click();
        });
        bind('close-group-mgmt-modal', 'click', function() {
            document.getElementById('group-management-modal').classList.add('hidden');
        });
        bind('close-create-room-modal', 'click', function() {
            document.getElementById('create-room-modal').classList.add('hidden');
        });
        bind('btn-close-channel-modal-cancel', 'click', function() {
            document.getElementById('create-channel-modal').classList.add('hidden');
        });
        bind('btn-close-subchannel-modal-cancel', 'click', function() {
            document.getElementById('create-subchannel-modal').classList.add('hidden');
        });
        bind('role-mgmt-close-x-btn', 'click', function() {
            document.getElementById('role-management-modal').classList.add('hidden');
        });
        bind('role-mgmt-cancel-btn', 'click', function() {
            document.getElementById('role-management-modal').classList.add('hidden');
        });
        bind('user-detail-close-x-btn', 'click', function() {
            document.getElementById('user-detail-modal').classList.add('hidden');
        });
        bind('user-detail-close-btn', 'click', function() {
            document.getElementById('user-detail-modal').classList.add('hidden');
        });

        // Hızlı görev ekle FAB — hover büyütme/gölge efekti
        var fab = document.getElementById('floating-quick-add-btn');
        if (fab) {
            fab.addEventListener('mouseover', function() {
                fab.style.transform = 'scale(1.08)';
                fab.style.boxShadow = '0 6px 28px rgba(212,144,14,0.5)';
            });
            fab.addEventListener('mouseout', function() {
                fab.style.transform = 'scale(1)';
                fab.style.boxShadow = '0 4px 20px rgba(212,144,14,0.35)';
            });
        }

        // Kullanıcı adı/rumuz alanları — sadece küçük harf + rakam + alt çizgiye izin ver
        bind('social-setup-username', 'input', function(e) {
            e.target.value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
        });
        bind('add-friend-input', 'input', function(e) {
            e.target.value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
        });
        // Avatar baş harfleri — büyük harfe çevir
        bind('setup-avatar-initials-input', 'input', function(e) {
            e.target.value = e.target.value.toUpperCase();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', wire);
    } else {
        wire();
    }
})();
