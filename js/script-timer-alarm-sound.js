export function createAlarmSound() {
    let alarmInterval = null;
    return {
        _playing: false,
        play() {
            if (this._playing) return Promise.resolve();
            this._playing = true;
            this._playBeep();
            alarmInterval = setInterval(() => this._playBeep(), 900);
            return Promise.resolve();
        },
        _playBeep() {
            try {
                const ctx = new (window.AudioContext || window.webkitAudioContext)();
                [880, 0, 880, 0, 1100].forEach((freq, i) => {
                    if (!freq) return;
                    const osc = ctx.createOscillator();
                    const g = ctx.createGain();
                    osc.connect(g); g.connect(ctx.destination);
                    osc.frequency.value = freq;
                    const t = ctx.currentTime + i * 0.12;
                    g.gain.setValueAtTime(0.3, t);
                    g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
                    osc.start(t); osc.stop(t + 0.1);
                });
            } catch (e) { console.warn('[FocusAI] sessiz hata:', e); }
        },
        pause()  { this._playing = false; clearInterval(alarmInterval); },
        get currentTime() { return 0; },
        set currentTime(v) {}
    };
}
