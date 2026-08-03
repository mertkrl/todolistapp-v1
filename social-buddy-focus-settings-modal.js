import { sendCWInvite, sendGroupFocusInvite } from './social-cw-invites.js';
import { bfpUpdatePreview } from './social-misc-isolated-utils.js';
import { setSharedFocusBreakMinutes } from './state/shared-focus-break-minutes-store.js';
import { setSharedFocusTotalRounds } from './state/shared-focus-total-rounds-store.js';

let buddyFocusSettingsBound = false;
let buddyFocusSettingsPending = null; // { targetUsername, targetName, targetColor, linkedHabit } | { isGroup: true, groupScope }

window.openBuddyFocusSettingsModal = (...a) => openBuddyFocusSettingsModal(...a);
export function openBuddyFocusSettingsModal(targetUsername, targetName, targetColor, linkedHabit) {
    const modal = document.getElementById('buddy-focus-premium-modal');
    if (!modal) {
        console.warn('[CW-DEBUG] buddy-focus-premium-modal bulunamadı, direkt sendCWInvite çağrılıyor');
        sendCWInvite(targetUsername, targetName, targetColor, linkedHabit, 25);
        return;
    }

    buddyFocusSettingsPending = { targetUsername, targetName, targetColor, linkedHabit };

    const heroSub = document.getElementById('bfp-hero-sub');
    if (heroSub) {
        heroSub.textContent = linkedHabit
            ? `${targetName || 'Partnerin'} ile "${linkedHabit.name}" için odaklanma seansı kur`
            : `${targetName || 'Partnerin'} ile birlikte odaklanma seansı kur`;
    }

    _openBuddyFocusSettingsModalShared();
}

window.openGroupFocusSettingsModal = (...a) => openGroupFocusSettingsModal(...a);
export function openGroupFocusSettingsModal(groupScope) {
    const modal = document.getElementById('buddy-focus-premium-modal');
    if (!modal) { sendGroupFocusInvite(25, 10, 4, groupScope); return; }

    buddyFocusSettingsPending = { isGroup: true, groupScope };

    const heroSub = document.getElementById('bfp-hero-sub');
    if (heroSub) heroSub.textContent = 'Kanaldaki herkese birlikte odaklanma daveti gönder';

    _openBuddyFocusSettingsModalShared();
}

function _openBuddyFocusSettingsModalShared() {
    const modal = document.getElementById('buddy-focus-premium-modal');
    // Klasik preset'i varsayılan yap
    document.querySelectorAll('.bfp-preset').forEach(b => b.classList.toggle('active', b.dataset.dur === '25'));
    const durEl = document.getElementById('bfp-duration');
    const brkEl = document.getElementById('bfp-break');
    const rndEl = document.getElementById('bfp-rounds');
    if (durEl) durEl.value = 25;
    if (brkEl) brkEl.value = 10;
    if (rndEl) rndEl.value = 4;
    bfpUpdatePreview();

    modal.classList.remove('hidden');
    ensureBuddyFocusSettingsBindings();
}

function closeBuddyFocusSettingsModal() {
    const modal = document.getElementById('buddy-focus-premium-modal');
    if (modal) modal.classList.add('hidden');
    buddyFocusSettingsPending = null;
}

function ensureBuddyFocusSettingsBindings() {
    if (buddyFocusSettingsBound) return;
    buddyFocusSettingsBound = true;

    const modal = document.getElementById('buddy-focus-premium-modal');

    // Preset chip tıklama
    document.querySelectorAll('.bfp-preset').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.bfp-preset').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            if (chip.dataset.dur) { document.getElementById('bfp-duration').value = chip.dataset.dur; }
            if (chip.dataset.brk) { document.getElementById('bfp-break').value = chip.dataset.brk; }
            if (chip.dataset.rounds) { document.getElementById('bfp-rounds').value = chip.dataset.rounds; }
            bfpUpdatePreview();
        });
    });

    // Stepper +/- butonları
    document.querySelectorAll('.bfp-step-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const input = document.getElementById(btn.dataset.target);
            if (!input) return;
            const delta = parseInt(btn.dataset.delta);
            const min = parseInt(input.min) || 1;
            const max = parseInt(input.max) || 999;
            input.value = Math.min(max, Math.max(min, (parseInt(input.value) || 0) + delta));
            document.querySelectorAll('.bfp-preset').forEach(c => c.classList.remove('active'));
            document.querySelector('.bfp-preset[data-dur=""]')?.classList.add('active');
            bfpUpdatePreview();
        });
    });

    // Input yazılınca önizlemeyi güncelle
    ['bfp-duration', 'bfp-break', 'bfp-rounds'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', bfpUpdatePreview);
    });

    // Kapat / İptal
    const closeFn = () => closeBuddyFocusSettingsModal();
    document.getElementById('bfp-x-btn')?.addEventListener('click', closeFn);
    document.getElementById('bfp-cancel-btn')?.addEventListener('click', closeFn);
    modal?.addEventListener('click', e => { if (e.target === modal) closeFn(); });

    // Daveti Gönder
    document.getElementById('bfp-send-btn')?.addEventListener('click', () => {
        if (!buddyFocusSettingsPending) { console.warn('[CW-DEBUG] buddyFocusSettingsPending boş, çıkılıyor'); return; }
        const dur    = parseInt(document.getElementById('bfp-duration')?.value) || 25;
        const brk    = parseInt(document.getElementById('bfp-break')?.value) || 10;
        const rounds = parseInt(document.getElementById('bfp-rounds')?.value) || 4;
        const pending = buddyFocusSettingsPending;
        closeBuddyFocusSettingsModal();
        setSharedFocusBreakMinutes(brk);
        setSharedFocusTotalRounds(rounds); // Güvenilir kaynak olarak sakla
        // Tur bilgisini overlay DOM'una aktar — timeline ve sayaç için
        const totalEl = document.getElementById('gf-round-total');
        const rndInput = document.getElementById('gf-rounds-input');
        if (totalEl)  totalEl.textContent = rounds;
        if (rndInput) rndInput.value      = rounds;
        if (pending.isGroup) {
            sendGroupFocusInvite(dur, brk, rounds, pending.groupScope);
        } else {
            const { targetUsername, targetName, targetColor, linkedHabit } = pending;
            sendCWInvite(targetUsername, targetName, targetColor, linkedHabit, dur);
        }
    });
}
