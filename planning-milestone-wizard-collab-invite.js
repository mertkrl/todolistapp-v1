// planning-milestone-wizard-collab-invite.js
// planning-milestone-wizard.js'ten çıkarıldı (Faz H devamı, 2. tur): Adım 1'deki
// ortaklaşa (collab) mod seçilince görünen davet kutusu — kod üretme/kopyalama +
// üye listesini yenileme. wizardState'e sadece PROPERTY bazlı erişiyor
// (reassignment yok), ana dosyadaki canlı binding üzerinden okunup/mutate ediliyor.
import { wizardState } from './planning-milestone-wizard.js';

export function _wzUpdateModeHint() {
    const hint = document.getElementById('pg-wz-mode-toggle-hint');
    if (hint) {
        if (wizardState?.mode === 'collab') {
            hint.textContent = 'Arkadaşlarınla gerçek zamanlı birlikte takip edin';
            hint.style.color = '#7c6eff';
        } else {
            hint.textContent = 'Kendi planını kendi hızında ilerlet';
            hint.style.color = '#555';
        }
    }
    const invArea = document.getElementById('pg-wz-collab-invite-area');
    if (invArea) {
        if (wizardState?.mode === 'collab') { invArea.classList.add('visible'); _wzInitCollabInvite(); }
        else invArea.classList.remove('visible');
    }
}

function _wzInitCollabInvite() {
    if (wizardState._collabInviteInit) {
        _wzRefreshCollabMembers();
        return;
    }
    wizardState._collabInviteInit = true;

    // Generate a temporary invite code stored in wizardState
    if (!wizardState._tempInviteCode) {
        wizardState._tempInviteCode = Math.random().toString(36).slice(2, 8).toUpperCase();
        // Store pending collab session in localStorage so others can "join" via invite flow
        const pending = JSON.parse(localStorage.getItem('_wz_pending_collab') || '{}', window._safeJsonReviver);
        pending[wizardState._tempInviteCode] = {
            code: wizardState._tempInviteCode,
            created: Date.now(),
            members: [],
        };
        localStorage.setItem('_wz_pending_collab', JSON.stringify(pending));
    }

    const codeBox = document.getElementById('pg-wz-collab-code-box');
    if (codeBox) codeBox.textContent = wizardState._tempInviteCode;

    const copyBtn = document.getElementById('pg-wz-collab-copy-btn');
    if (copyBtn && !copyBtn._wzBound) {
        copyBtn._wzBound = true;
        copyBtn.addEventListener('click', () => {
            const url = window.location.href.split('?')[0] + '?collab_invite=' + wizardState._tempInviteCode;
            navigator.clipboard.writeText(url).then(() => {
                copyBtn.textContent = 'Kopyalandı!';
                setTimeout(() => { copyBtn.textContent = 'Kopyala'; }, 1800);
            }).catch(() => {
                copyBtn.textContent = wizardState._tempInviteCode;
            });
        });
    }

    const refreshBtn = document.getElementById('pg-wz-collab-refresh-btn');
    if (refreshBtn && !refreshBtn._wzBound) {
        refreshBtn._wzBound = true;
        refreshBtn.addEventListener('click', _wzRefreshCollabMembers);
    }

    _wzRefreshCollabMembers();
}

export function _wzRefreshCollabMembers() {
    const listEl = document.getElementById('pg-wz-collab-members-list');
    if (!listEl || !wizardState?._tempInviteCode) return;
    const pending = JSON.parse(localStorage.getItem('_wz_pending_collab') || '{}', window._safeJsonReviver);
    const session = pending[wizardState._tempInviteCode] || { members: [] };
    const members = session.members || [];
    if (!members.length) {
        listEl.innerHTML = '<div class="u-font-size-12px_color-h555">Henüz katılan yok…</div>';
    } else {
        listEl.innerHTML = members.map(m => `
            <div class="pg-wz-collab-member-item">
                <div class="pg-wz-collab-member-avatar">${window.esc((m.name||'?')[0].toUpperCase())}</div>
                <span>${window.esc(m.name || m.email || 'Kullanıcı')}</span>
                <span class="pg-wz-collab-member-status ${m.accepted ? 'accepted' : 'pending'}">
                    ${m.accepted ? 'Kabul etti' : 'Bekleniyor'}
                </span>
            </div>`).join('');
    }
    // Also check via Supabase if available
    if (wizardState?._wzRoomId && window.PlanningCollab?.getMembers) {
        window.PlanningCollab.getMembers(wizardState._wzRoomId).then(dbMembers => {
            if (dbMembers?.length > 1) {
                // At least one non-owner member joined
                wizardState._collabAccepted = true;
                const members = dbMembers.filter(m => m.role !== 'owner');
                listEl.innerHTML = members.map(m => `
                    <div class="pg-wz-collab-member-item">
                        <div class="pg-wz-collab-member-avatar">${window.esc((m.user_id||'?')[0].toUpperCase())}</div>
                        <span>${window.esc(m.user_id)}</span>
                        <span class="pg-wz-collab-member-status accepted">Kabul etti</span>
                    </div>`).join('');
            }
        }).catch(() => {});
    }
}
