// Odak sesleri mikseri + Scene Bar (ortam seçici) — script.js'ten taşındı.
// Tamamen kendi kapsülünde: ambientSounds/ambientActiveOrder/... hiçbir
// dış dosyadan okunmuyor/yazılmıyor (window.saveAmbientState/ambientActiveOrder
// hariç, onlar da bu dosyanın kendi içinde export ediliyor).
document.addEventListener('DOMContentLoaded', () => {
    // ============ ODAK SESLERİ MİKSER SİSTEMİ ============
    // Birden fazla ortam sesi aynı anda çalınabilir, her birinin kendi ses
    // seviyesi vardır; açma/kapama yumuşak geçişle (crossfade) yapılır ve
    // seçimler localStorage'a kaydedilip sayfa açılışında geri yüklenir.
    const AMBIENT_STORAGE_KEY = 'focusai_ambient_state';
    const AMBIENT_FADE_SEC = 1.2;
    const DEFAULT_AMBIENT_VOLUME = 0.5;

    const audioSources = {
        'rain': 'audio/rain.wav',
        'ocean': 'audio/ocean.wav',
        'forest': 'audio/forest.wav',
        'fire': 'audio/fire.wav'
    };
    const videoSources = {
        'rain': 'video/rain.mp4',
        'ocean': 'video/ocean.mp4',
        'forest': 'video/forest.mp4',
        'fire': 'video/fire.mp4'
    };
    const soundLabels = {
        'rain': { icon: 'fa-cloud-rain', title: 'Yağmur' },
        'ocean': { icon: 'fa-water', title: 'Okyanus' },
        'forest': { icon: 'fa-tree', title: 'Orman' },
        'fire': { icon: 'fa-fire', title: 'Şömine' }
    };

    // soundType -> { audio, gainNode, analyser, volume, eqFrame }
    const ambientSounds = new Map();
    let ambientActiveOrder = []; // en son açılan en sonda — arkaplan videosu bunu takip eder
    window.ambientActiveOrder = ambientActiveOrder; // global erişim için
    let ambientCtx = null;
    let masterGainNode = null;
    let audioOnlyMode = false;
    let masterVolume = 1;
    let masterMuted = false;

    function getAmbientCtx() {
        if (!ambientCtx) {
            ambientCtx = new (window.AudioContext || window.webkitAudioContext)();
            masterGainNode = ambientCtx.createGain();
            masterGainNode.gain.value = masterMuted ? 0 : masterVolume;
            masterGainNode.connect(ambientCtx.destination);
        }
        if (ambientCtx.state === 'suspended') ambientCtx.resume();
        return ambientCtx;
    }

    function loadAmbientState() {
        try {
            const raw   = localStorage.getItem(AMBIENT_STORAGE_KEY);
            const saved = raw ? JSON.parse(raw) : null;
            // Daha önce hiç kayıt yoksa paneli kapalı başlat
            const hasRecord = saved !== null;
            return {
                sounds: saved && saved.sounds && typeof saved.sounds === 'object' ? saved.sounds : {},
                minimized: hasRecord ? !!saved.minimized : true,
                audioOnly: saved ? !!saved.audioOnly : false,
                masterVolume: saved && typeof saved.masterVolume === 'number' ? saved.masterVolume : 1,
                masterMuted: saved ? !!saved.masterMuted : false
            };
        } catch (e) {
            return { sounds: {}, minimized: true, audioOnly: false, masterVolume: 1, masterMuted: false };
        }
    }

    function saveAmbientState() {
        const sounds = {};
        ambientActiveOrder.forEach(type => {
            const entry = ambientSounds.get(type);
            sounds[type] = { volume: entry ? entry.volume : DEFAULT_AMBIENT_VOLUME };
        });
        const minimized = document.querySelector('.ambient-panel')?.classList.contains('ambient-minimized') || false;
        localStorage.setItem(AMBIENT_STORAGE_KEY, JSON.stringify({ sounds, minimized, audioOnly: audioOnlyMode, masterVolume, masterMuted }));
    }

    // ============ ANA SES SEVİYESİ / SESSİZE ALMA ============
    function applyMasterGain(immediate) {
        const ctx = getAmbientCtx();
        const target = masterMuted ? 0 : masterVolume;
        const now = ctx.currentTime;
        masterGainNode.gain.cancelScheduledValues(now);
        masterGainNode.gain.setValueAtTime(masterGainNode.gain.value, now);
        masterGainNode.gain.linearRampToValueAtTime(target, now + (immediate ? 0.05 : 0.3));
    }

    function updateMasterVolumeUI() {
        const slider = document.getElementById('ambient-master-volume');
        const pct = document.getElementById('ambient-master-pct');
        const muteBtn = document.getElementById('ambient-mute-btn');
        const effective = masterMuted ? 0 : masterVolume;
        if (slider) slider.value = effective;
        if (pct) pct.textContent = Math.round(effective * 100) + '%';
        if (muteBtn) {
            const icon = effective === 0 ? 'fa-volume-xmark' : (effective < 0.5 ? 'fa-volume-low' : 'fa-volume-high');
            muteBtn.innerHTML = `<i class="fa-solid ${icon}"></i>`;
        }
    }

    // ============ OTOMATİK OYNATMA ENGELİ İPUCU ============
    function showAmbientAudioHint() {
        document.getElementById('ambient-audio-hint')?.classList.remove('hidden');
    }

    function hideAmbientAudioHint() {
        document.getElementById('ambient-audio-hint')?.classList.add('hidden');
    }

    document.getElementById('ambient-audio-hint')?.addEventListener('click', function() {
        getAmbientCtx();
        ambientSounds.forEach((entry, type) => {
            if (ambientActiveOrder.includes(type) && entry.audio.paused) {
                entry.audio.play().catch(() => {});
            }
        });
        hideAmbientAudioHint();
    });

    // ============ ARKAPLAN VİDEOSU (global bg-video — artık kullanılmıyor, section video kullanılıyor) ============
    function setAmbientVisuals(type) {
        // Video artık #timer-scene-video üzerinden section içinde yönetiliyor
        // syncScenePills() çağrısı bunu halleder — bu fonksiyon legacy uyumluluk için boş bırakıldı
    }

    function refreshAmbientVisuals() {
        // legacy — syncScenePills ile yönetiliyor
    }

    // ============ CANLI EŞİTLEYİCİ ANİMASYONU ============
    function startAmbientEq(type) {
        const entry = ambientSounds.get(type);
        const row = document.querySelector(`.ambient-mixer-row[data-sound="${type}"]`);
        if (!entry || !row) return;
        const bars = row.querySelectorAll('.ambient-mixer-eq span');
        if (!bars.length) return;

        const data = new Uint8Array(entry.analyser.frequencyBinCount);
        function step() {
            entry.eqFrame = requestAnimationFrame(step);
            entry.analyser.getByteFrequencyData(data);
            const chunk = Math.floor(data.length / bars.length);
            bars.forEach((bar, i) => {
                let sum = 0;
                for (let j = i * chunk; j < (i + 1) * chunk; j++) sum += data[j];
                const avg = sum / chunk;
                const pct = Math.max(15, Math.min(100, (avg / 255) * 100));
                bar.style.height = pct + '%';
            });
        }
        step();
    }

    function stopAmbientEq(type) {
        const entry = ambientSounds.get(type);
        if (entry && entry.eqFrame) {
            cancelAnimationFrame(entry.eqFrame);
            entry.eqFrame = null;
        }
    }

    // ============ MİKSER BAŞLIK ROZETİ ============
    function updateAmbientMixerBadge() {
        const badge = document.getElementById('ambient-mixer-count');
        if (!badge) return;
        if (ambientActiveOrder.length > 0) {
            badge.textContent = String(ambientActiveOrder.length);
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }

    // ============ MİKSER SATIRLARI (her aktif ses için mini kaydırıcı) ============
    function renderAmbientMixerRows() {
        const container = document.getElementById('ambient-mixer-rows');
        if (!container) return;

        updateAmbientMixerBadge();
        ambientActiveOrder.forEach(type => stopAmbientEq(type));

        if (!ambientActiveOrder.length) {
            container.innerHTML = '<div class="ambient-mixer-empty">Henüz aktif ses yok. Geri dönüp bir ses seç, burada kendi ses seviyesiyle belirir.</div>';
            return;
        }

        container.innerHTML = ambientActiveOrder.map(type => {
            const entry = ambientSounds.get(type);
            const vol = entry ? Math.round(entry.volume * 100) : 50;
            const label = soundLabels[type];
            return `
                <div class="ambient-mixer-row" data-sound="${type}">
                    <i class="fa-solid ${label.icon}" title="${label.title}"></i>
                    <div class="ambient-mixer-eq"><span></span><span></span><span></span></div>
                    <input type="range" class="premium-range ambient-mixer-volume" data-sound="${type}" min="0" max="1" step="0.01" value="${vol / 100}">
                    <span class="ambient-mixer-pct">${vol}%</span>
                </div>`;
        }).join('');

        container.querySelectorAll('.ambient-mixer-volume').forEach(slider => {
            slider.addEventListener('input', function() {
                const type = this.dataset.sound;
                const entry = ambientSounds.get(type);
                if (!entry) return;
                const vol = parseFloat(this.value);
                entry.volume = vol;
                entry.gainNode.gain.cancelScheduledValues(getAmbientCtx().currentTime);
                entry.gainNode.gain.setValueAtTime(vol, getAmbientCtx().currentTime);
                const pct = this.parentElement.querySelector('.ambient-mixer-pct');
                if (pct) pct.textContent = Math.round(vol * 100) + '%';
                saveAmbientState();
            });
        });

        ambientActiveOrder.forEach(type => startAmbientEq(type));
    }

    // ============ SES AÇMA / KAPAMA (crossfade ile) ============
    function activateAmbientSound(type, targetVolume = DEFAULT_AMBIENT_VOLUME) {
        if (!audioSources[type]) return;
        const ctx = getAmbientCtx();

        let entry = ambientSounds.get(type);
        if (!entry) {
            const audio = new Audio(audioSources[type]);
            audio.loop = true;
            const source = ctx.createMediaElementSource(audio);
            const gainNode = ctx.createGain();
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 64;
            gainNode.gain.value = 0;
            source.connect(gainNode);
            gainNode.connect(analyser);
            analyser.connect(masterGainNode);
            entry = { audio, gainNode, analyser, volume: targetVolume, eqFrame: null };
            ambientSounds.set(type, entry);
        }

        entry.volume = targetVolume;
        const now = ctx.currentTime;
        entry.gainNode.gain.cancelScheduledValues(now);
        entry.gainNode.gain.setValueAtTime(entry.gainNode.gain.value, now);
        entry.gainNode.gain.linearRampToValueAtTime(targetVolume, now + AMBIENT_FADE_SEC);

        const playPromise = entry.audio.play();
        if (playPromise && typeof playPromise.then === 'function') {
            playPromise.then(hideAmbientAudioHint).catch(() => showAmbientAudioHint());
        }

        ambientActiveOrder = ambientActiveOrder.filter(t => t !== type);
        ambientActiveOrder.push(type);
        window.ambientActiveOrder = ambientActiveOrder;

        document.querySelectorAll(`.sound-btn[data-sound="${type}"]`).forEach(b => b.classList.add('active'));
        document.querySelector('.sound-btn[data-sound="none"]')?.classList.remove('active');

        refreshAmbientVisuals();
        renderAmbientMixerRows();
        saveAmbientState();
    }

    function deactivateAmbientSound(type) {
        const entry = ambientSounds.get(type);
        if (entry) {
            const ctx = getAmbientCtx();
            const now = ctx.currentTime;
            entry.gainNode.gain.cancelScheduledValues(now);
            entry.gainNode.gain.setValueAtTime(entry.gainNode.gain.value, now);
            entry.gainNode.gain.linearRampToValueAtTime(0, now + AMBIENT_FADE_SEC);
            stopAmbientEq(type);
            setTimeout(() => entry.audio.pause(), AMBIENT_FADE_SEC * 1000);
        }

        ambientActiveOrder = ambientActiveOrder.filter(t => t !== type);
        window.ambientActiveOrder = ambientActiveOrder;

        document.querySelectorAll(`.sound-btn[data-sound="${type}"]`).forEach(b => b.classList.remove('active'));
        if (!ambientActiveOrder.length) {
            document.querySelector('.sound-btn[data-sound="none"]')?.classList.add('active');
            hideAmbientAudioHint();
        }

        refreshAmbientVisuals();
        renderAmbientMixerRows();
        saveAmbientState();
    }

    function stopAllAmbientSounds() {
        [...ambientActiveOrder].forEach(type => deactivateAmbientSound(type));
    }

    // ============ BUTON OLAYLARI ============
    // Ön yüz (minimal): tek seferde sadece bir ses seçilebilir — yeni bir ses
    // seçilince önceki ses(ler) otomatik kapanır.
    document.querySelectorAll('.quick-sound-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const soundType = this.getAttribute('data-sound');
            const isActive = ambientActiveOrder.includes(soundType);
            if (isActive && ambientActiveOrder.length === 1) {
                deactivateAmbientSound(soundType);
            } else {
                [...ambientActiveOrder].filter(t => t !== soundType).forEach(t => deactivateAmbientSound(t));
                if (!isActive) activateAmbientSound(soundType);
            }
        });
    });

    // Mikser yüzü (detaylı): birden fazla ses bağımsız olarak açılıp kapanabilir
    document.querySelectorAll('.sound-card').forEach(btn => {
        btn.addEventListener('click', function() {
            const soundType = this.getAttribute('data-sound');
            if (this.classList.contains('active')) {
                deactivateAmbientSound(soundType);
            } else {
                activateAmbientSound(soundType);
            }
        });
    });

    document.getElementById('ambient-stop-all')?.addEventListener('click', stopAllAmbientSounds);

    // ============ ANA SES SEVİYESİ / SESSİZE ALMA OLAYLARI ============
    document.getElementById('ambient-mute-btn')?.addEventListener('click', function() {
        masterMuted = !masterMuted;
        applyMasterGain();
        updateMasterVolumeUI();
        saveAmbientState();
    });

    document.getElementById('ambient-master-volume')?.addEventListener('input', function() {
        masterVolume = parseFloat(this.value);
        masterMuted = masterVolume === 0;
        applyMasterGain(true);
        updateMasterVolumeUI();
        saveAmbientState();
    });

    // ============ MİKSER KARTI ÇEVİRME (360° DÖNÜŞ) ============
    const ambientTitleEl = document.querySelector('.ambient-title');
    const AMBIENT_TITLE_FRONT = '<i class="fa-solid fa-headphones"></i> Odak Sesleri & Görseller';
    const AMBIENT_TITLE_BACK = '<i class="fa-solid fa-sliders"></i> Ses Mikseri';

    function flipAmbientPanel() {
        const inner = document.querySelector('.ambient-flip-inner');
        const front = document.querySelector('.ambient-flip-front');
        const back = document.querySelector('.ambient-flip-back');
        if (!inner || !front || !back) return;

        if (!back.classList.contains('ambient-face-visible')) {
            renderAmbientMixerRows();
        }

        inner.classList.add('ambient-spin');
        setTimeout(() => {
            front.classList.toggle('ambient-face-visible');
            back.classList.toggle('ambient-face-visible');
            if (ambientTitleEl) {
                ambientTitleEl.innerHTML = back.classList.contains('ambient-face-visible')
                    ? AMBIENT_TITLE_BACK
                    : AMBIENT_TITLE_FRONT;
            }
        }, 300);
        setTimeout(() => {
            inner.style.transition = 'none';
            inner.classList.remove('ambient-spin');
            void inner.offsetWidth; // reflow ile sıfırlama anında uygula
            inner.style.transition = '';
        }, 620);
    }

    document.getElementById('ambient-mixer-btn')?.addEventListener('click', flipAmbientPanel);

    // ============ "SADECE SES" ANAHTARI (ön yüz ve mikser yüzünde, senkron) ============
    const audioOnlyToggles = document.querySelectorAll('.ambient-audio-only-input');
    audioOnlyToggles.forEach(toggle => {
        toggle.addEventListener('change', function() {
            audioOnlyMode = this.checked;
            audioOnlyToggles.forEach(t => { t.checked = audioOnlyMode; });
            refreshAmbientVisuals();
            saveAmbientState();
        });
    });

    // ============ AÇILIŞTA KALICI DURUMU GERİ YÜKLE ============
    (function restoreAmbientState() {
        const saved = loadAmbientState();

        audioOnlyMode = saved.audioOnly;
        audioOnlyToggles.forEach(t => { t.checked = audioOnlyMode; });

        masterVolume = saved.masterVolume;
        masterMuted = saved.masterMuted;
        updateMasterVolumeUI();

        Object.entries(saved.sounds).forEach(([type, info]) => {
            if (!audioSources[type]) return;
            activateAmbientSound(type, typeof info?.volume === 'number' ? info.volume : DEFAULT_AMBIENT_VOLUME);
        });
        if (!ambientActiveOrder.length) {
            document.querySelector('.sound-btn[data-sound="none"]')?.classList.add('active');
        }
        if (saved.minimized) {
            document.querySelector('.ambient-panel')?.classList.add('ambient-minimized');
        }
        // Scene UI'ı kayıtlı duruma göre sync et
        setTimeout(syncSceneUI, 200);
    })();

    // social.js'deki minimize/floating butonu bu fonksiyonu çağırarak
    // panel durumunu localStorage'a kaydedebilsin diye dışa açıyoruz
    window.saveAmbientState = saveAmbientState;

    // ============ SCENE BAR — ORTAM SEÇİCİ ============
    const timerSceneVideo = document.getElementById('timer-scene-video');
    const timerSceneSection = document.getElementById('zamanlayici');
    let mixMode = false;

    function setSceneVideo(type) {
        if (!timerSceneVideo) return;
        if (!type || !videoSources[type]) {
            timerSceneVideo.classList.remove('active');
            timerSceneSection?.classList.remove('has-scene');
            setTimeout(() => { timerSceneVideo.pause(); timerSceneVideo.removeAttribute('src'); }, 1200);
        } else {
            if (timerSceneVideo.dataset.current !== type) {
                timerSceneVideo.dataset.current = type;
                timerSceneVideo.src = videoSources[type];
                timerSceneVideo.play().catch(() => {});
            }
            timerSceneVideo.classList.add('active');
            timerSceneSection?.classList.add('has-scene');
        }
    }

    function syncSceneUI() {
        const hasActive = ambientActiveOrder.length > 0;
        const lastType = ambientActiveOrder[ambientActiveOrder.length - 1] || null;

        // Chip aktif durumu — mix modunda çoklu, değilse tekli
        document.querySelectorAll('.scene-chip').forEach(chip => {
            const t = chip.dataset.sound;
            const isNone = t === 'none';
            chip.classList.toggle('active',
                isNone ? !hasActive : (mixMode ? ambientActiveOrder.includes(t) : t === lastType)
            );
        });

        // Mixer satır aktif durumu
        document.querySelectorAll('.scene-mx-row').forEach(row => {
            row.classList.toggle('active', ambientActiveOrder.includes(row.dataset.sound));
        });

        // Aktif satır (volume + kombine)
        const activeRow = document.getElementById('scene-active-row');
        if (activeRow) activeRow.style.display = hasActive ? 'flex' : 'none';

        // Arka plan videosu — en son eklenen ortamın videosunu göster
        setSceneVideo(lastType);

        // Vol UI sync
        const slider = document.getElementById('ambient-master-volume');
        const muteBtn = document.getElementById('scene-mute-btn');
        const eff = masterMuted ? 0 : masterVolume;
        if (slider) slider.value = eff;
        if (muteBtn) {
            const icon = eff === 0 ? 'fa-volume-xmark' : eff < 0.5 ? 'fa-volume-low' : 'fa-volume-high';
            muteBtn.innerHTML = `<i class="fa-solid ${icon}"></i>`;
        }
    }

    // Chip tıklamaları
    document.querySelectorAll('.scene-chip').forEach(chip => {
        chip.addEventListener('click', function() {
            const type = this.dataset.sound;
            if (type === 'none') {
                stopAllAmbientSounds();
            } else if (mixMode) {
                // Kombine modda bağımsız toggle
                if (ambientActiveOrder.includes(type)) deactivateAmbientSound(type);
                else activateAmbientSound(type);
            } else {
                // Tek ses — diğerlerini kapat
                [...ambientActiveOrder].forEach(t => deactivateAmbientSound(t));
                activateAmbientSound(type);
            }
            syncSceneUI();
        });
    });

    // Master volume
    document.getElementById('ambient-master-volume')?.addEventListener('input', function() {
        masterVolume = parseFloat(this.value);
        masterMuted = masterVolume === 0;
        applyMasterGain(true);
        updateMasterVolumeUI();
        saveAmbientState();
        syncSceneUI();
    });

    document.getElementById('scene-mute-btn')?.addEventListener('click', function() {
        masterMuted = !masterMuted;
        applyMasterGain();
        updateMasterVolumeUI();
        saveAmbientState();
        syncSceneUI();
    });

    // Kombine toggle — popup'ı aç/kapat, sesleri değiştirme
    const mixToggleBtn = document.getElementById('scene-mix-btn');
    const mixerEl = document.getElementById('scene-mixer');

    function openMixer() {
        mixMode = true;
        mixToggleBtn?.classList.add('active');
        if (!mixerEl) return;
        // Slider değerlerini mevcut ses durumuna göre güncelle
        mixerEl.querySelectorAll('.scene-mx-vol').forEach(slider => {
            const type = slider.dataset.sound;
            const entry = ambientSounds.get(type);
            slider.value = entry ? entry.volume : 0.6;
            const pct = slider.parentElement.querySelector('.scene-mx-pct');
            if (pct) pct.textContent = Math.round(slider.value * 100) + '%';
        });
        syncSceneUI();
        mixerEl.style.display = 'flex';
    }

    function closeMixer() {
        mixMode = false;
        mixToggleBtn?.classList.remove('active');
        if (mixerEl) mixerEl.style.display = 'none';
        // Sesleri DURDURMA — kullanıcının seçimi korunur
        syncSceneUI();
    }

    mixToggleBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        mixMode ? closeMixer() : openMixer();
    });

    // Dışarı tıklayınca sadece popup'ı kapat, sesleri bozma
    document.addEventListener('click', (e) => {
        if (!mixMode || !mixerEl) return;
        if (!mixerEl.contains(e.target) && !mixToggleBtn?.contains(e.target)) {
            closeMixer();
        }
    });

    // Emoji toggle butonu — sesi aç/kapat
    document.querySelectorAll('.scene-mx-toggle').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const type = btn.dataset.sound;
            if (ambientActiveOrder.includes(type)) {
                deactivateAmbientSound(type);
            } else {
                const slider = mixerEl?.querySelector(`.scene-mx-vol[data-sound="${type}"]`);
                const vol = slider ? parseFloat(slider.value) : DEFAULT_AMBIENT_VOLUME;
                activateAmbientSound(type, vol);
            }
            syncSceneUI();
        });
    });

    // Mixer volume slider — sadece ses zaten açıksa çalıştır
    document.querySelectorAll('.scene-mx-vol').forEach(slider => {
        slider.addEventListener('input', function() {
            const type = this.dataset.sound;
            const vol = parseFloat(this.value);
            const pct = this.parentElement.querySelector('.scene-mx-pct');
            if (pct) pct.textContent = Math.round(vol * 100) + '%';
            if (!ambientActiveOrder.includes(type)) return; // kapalıysa slider sadece görsel
            const entry = ambientSounds.get(type);
            if (!entry) return;
            entry.volume = vol;
            entry.gainNode.gain.cancelScheduledValues(getAmbientCtx().currentTime);
            entry.gainNode.gain.setValueAtTime(vol, getAmbientCtx().currentTime);
            saveAmbientState();
        });
    });

    // Açılışta sync
    setTimeout(syncSceneUI, 250);

});
