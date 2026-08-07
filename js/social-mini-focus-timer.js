import { getCurrentUser } from '../state/current-user-store.js';
import { getScwTimeLeft, setScwTimeLeft, getScwTimerInterval, setScwTimerInterval, setIsScwRunning, getIsScwRunning } from '../state/scw-timer-store.js';
import { getCwRoomIsHost } from '../state/cw-room-host-store.js';
import { getCwSettingsOpenToAll } from '../state/cw-settings-open-to-all-store.js';
import { getCwInviteMsgId, setCwInviteRef } from '../state/cw-invite-ref-store.js';
import { getCurrentRoomId, getCwRoomIsSupabase } from '../state/cw-current-room-store.js';
import { getSharedFocusSoloMode } from '../state/shared-focus-solo-mode-store.js';
import { getSharedFocusSession, setSharedFocusSession } from '../state/shared-focus-session-store.js';
import { getSharedFocusBreakMinutes } from '../state/shared-focus-break-minutes-store.js';
import { SHARED_FOCUS_DEFAULT_BREAK_MINUTES, buildSharedFocusResumeUpdate } from './social-shared-focus-math.js';
import { openSharedFocusOverlay } from './social-shared-focus-overlay.js';
import { startSharedFocusDerivedTimer, resetScwTimer } from './social-shared-focus-timer-ctrl.js';
import { requestSharedFocusStart, requestSharedFocusPauseToggle, requestSharedFocusReset } from './social-shared-focus-sync.js';
import { syncXP } from './social-group-listeners.js';
import { initSocial } from './social-auth-bootstrap.js';
import { _setupProfileModalListeners } from './social-setup-profile-listeners.js';
import { _setupFriendsGroupsListeners } from './social-friends-groups-listeners.js';

window.writeSharedFocusMyTask = writeSharedFocusMyTask;
function writeSharedFocusMyTask(taskId, taskText) {
    if (!getCurrentRoomId()) return;
    if (getCwRoomIsSupabase() && window.FocusSupabase && getCurrentUser()?.id) {
        window.FocusSupabase.from('cw_room_members')
            .update({ task_id: taskId || null, task_text: taskText || null })
            .eq('room_id', getCurrentRoomId()).eq('user_id', getCurrentUser().id)
            .then(({ error }) => { if (error) console.error('[FocusAI] görev yazma hatası', error); });
        return;
    }
}

window._cwHasDirectControl = _cwHasDirectControl; // social-shared-focus-overlay.js için
function _cwHasDirectControl() {
    return getCwRoomIsHost() || getCwSettingsOpenToAll();
}

window._cwDeleteInviteMessage = _cwDeleteInviteMessage; // social-shared-focus-overlay.js için
function _cwDeleteInviteMessage() {
    if (!getCwInviteMsgId() || !window.FocusSupabase) return;
    window.FocusSupabase.from('messages').delete().eq('id', getCwInviteMsgId()).then(() => {});
    setCwInviteRef(null, null);
}

function setupEventListeners() {
    _setupProfileModalListeners();
    _setupFriendsGroupsListeners();
}

function start() {
    setupEventListeners();
    initSocial();
    initScwTimer(); // Mini sayacı ayağa kaldırır
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
} else {
    setTimeout(start, 900);
}

function initScwTimer() {
    const minutesEl = document.getElementById('scw-minutes');
    const secondsEl = document.getElementById('scw-seconds');
    const startBtn = document.getElementById('scw-start-btn');
    const pauseBtn = document.getElementById('scw-pause-btn');
    const resetBtn = document.getElementById('scw-reset-btn');
    const leaveBtn = document.getElementById('scw-leave-btn');
    const modeBtns = document.querySelectorAll('.scw-mode-btn');

    if (!minutesEl) return;

    function updateDisplay(secs) {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        minutesEl.textContent = String(m).padStart(2, '0');
        secondsEl.textContent = String(s).padStart(2, '0');
    }

    // Süre Butonları (25D, 50D, 5M)
    modeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (getCurrentRoomId()) return; // Ortak odadayken süre değiştirilemez
            modeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            setScwTimeLeft(parseInt(btn.dataset.scwTime) * 60);
            updateDisplay(getScwTimeLeft());
            resetScwTimer();
        });
    });

    // Başlat / Devam Et
    startBtn.addEventListener('click', () => {
        requestSharedFocusStart();
    });

    // Duraklat
    pauseBtn.addEventListener('click', () => {
        requestSharedFocusPauseToggle();
    });

    // Sıfırla
    resetBtn.addEventListener('click', () => {
        requestSharedFocusReset();
    });
}

// Bireysel seans, "Birlikte Çalışalım" odasıyla bire bir aynı tam ekran arayüzde akar —
// oda yoksa bu fonksiyon overlay'i bireysel modda açıp aynı türetilmiş-zaman motorunu besler.
function ensureSoloFocusOverlay() {
    if (getCurrentRoomId()) return;
    const overlay = document.getElementById('group-focus-overlay');
    if (overlay && overlay.style.display === 'flex' && getSharedFocusSoloMode()) return;
    openSharedFocusOverlay(null, null, true);
}

window.startLocalScw = startLocalScw; // social-shared-focus-sync.js için
function startLocalScw() {
    if (getIsScwRunning()) return;
    const now = Date.now();
    if (getSharedFocusSession() && getSharedFocusSession().paused) {
        const upd = buildSharedFocusResumeUpdate(getSharedFocusSession(), now);
        setSharedFocusSession(Object.assign({}, getSharedFocusSession(), upd));
    } else if (!getSharedFocusSession()) {
        const focusMinutes = Math.round(getScwTimeLeft() / 60) || 25;
        const breakMinutes = getSharedFocusBreakMinutes() || SHARED_FOCUS_DEFAULT_BREAK_MINUTES;
        setSharedFocusSession({ startedAt: now, paused: false, pausedAt: null, focusMinutes, breakMinutes });
    }
    if (!getCurrentRoomId()) ensureSoloFocusOverlay();
    startSharedFocusDerivedTimer();
}

window.pauseLocalScw = pauseLocalScw; // social-shared-focus-sync.js için
function pauseLocalScw() {
    if (getSharedFocusSession() && !getSharedFocusSession().paused) {
        getSharedFocusSession().paused = true;
        getSharedFocusSession().pausedAt = Date.now();
    }
    if (getScwTimerInterval()) { clearInterval(getScwTimerInterval()); setScwTimerInterval(null); }
    setIsScwRunning(false);
    document.getElementById('scw-start-btn')?.classList.remove('hidden');
    document.getElementById('scw-pause-btn')?.classList.add('hidden');
    syncXP();
}

export { writeSharedFocusMyTask, _cwHasDirectControl, _cwDeleteInviteMessage, start, initScwTimer, ensureSoloFocusOverlay, startLocalScw, pauseLocalScw };
