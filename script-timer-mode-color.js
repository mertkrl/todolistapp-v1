export function applyTimerModeColor(timerCircle, mode) {
    if (!timerCircle) return;
    timerCircle.classList.remove('timer-mode-focus', 'timer-mode-short', 'timer-mode-long');
    if (mode === 'pomodoro' || mode === 'ultradian') timerCircle.classList.add('timer-mode-focus');
    else if (mode === 'shortBreak') timerCircle.classList.add('timer-mode-short');
    else if (mode === 'longBreak') timerCircle.classList.add('timer-mode-long');
}
