import { fmtDate, getCat } from './planning-utils.js';
// ─── MİLESTONE WİZARD (Hedef Detay Paneli içi) ─────────────────────
// planning.js dosyasından çıkarıldı (Faz 6): Hedef Detay Panelinin
// (PlanView) 5 adımlı sohbet-tarzı aşama sihirbazı — welcome/count/
// names/dates/summary/done akışı.
//
// NOT: bu, önceden çıkarılmış `planning-milestone-wizard.js`'ten FARKLI
// bir sihirbaz — o dosya "Hedef Oluşturma Sihirbazı" (yeni hedef açarken),
// bu dosya PlanView'in İÇİNDE, VAR OLAN bir hedefin aşamalarını
// oluşturma/tarihleme akışı.
//
// Dış bağımlılıklar (PlanView çekirdeğine — planning.js'te KALIYOR):
// - window.persistGoals / window.toast / window.esc / window.uid /
//   window.fmtDate → zaten window.* köprülüydü
// - window._pvRenderStepper / window._pvRenderMainCal /
//   window._pvRenderDayPanel / window._pvRenderPlanSummary → bu çıkarmada
//   YENİ window.* köprüsü eklendi (tanımları planning.js'te kalıyor)
// - window._pgGetGoals() → mevcut goals köprüsü (salt-okunur, bu kümede
//   sadece .find() ile okunuyor, reassign edilmiyor)
// - window.__getPvGoalId() → salt-okunur getter (pvGoalId planning.js'te
//   kalıyor, PlanView'in geri kalanında da kullanılıyor)
// - window.__getPvWiz()/__setPvWiz() → pvWiz planning.js'te kalıyor (PlanView
//   collab/broadcast kodu da okuyup yazıyor), getter+setter köprüsü kuruldu;
//   property mutasyonları (`pvWiz.step = ...` gibi) getter referansı
//   üzerinden çalışmaya devam eder, sadece WHOLESALE reassignment setter
//   gerektirir (bu kümede tek bir yerde oluyor)
// - _pvWizAutoFinish/_pvWizAddBubble/_pvWizAddUserBubble/_pvDayAfter/
//   _liveG/goTo → sadece bu kümede kullanılıyor, köprü gerekmedi
// - _localToday/_normYMD → SADECE bu kümede tanımlı ama planning.js'in
//   geri kalanından da çağrılıyor, bu yüzden window.* köprüsü eklenip
//   planning.js'teki çağrı noktaları güncellendi
// - _pvRenderWizard/_pvWizAssignDate/_pvBroadcastWizState → planning.js'in
//   geri kalanından (Header/Stepper, Ana Takvim, Gün Paneli) bare çağrılıyordu,
//   window.* köprüsü eklenip planning.js'teki 4 çağrı noktası güncellendi
    // ══════════════════════════════════════════
    // MİLESTONE WİZARD
    // ══════════════════════════════════════════

    window._pvBroadcastWizState = _pvBroadcastWizState; // planning.js için
    function _pvBroadcastWizState() {
        if (window.PlanningCollab?.channel && window.__getPvWiz())
            window.PlanningCollab.broadcast('wiz_state', { goalId: window.__getPvGoalId(), wiz: JSON.parse(JSON.stringify(window.__getPvWiz())) });
    }

    window._pvRenderWizard = _pvRenderWizard; // planning.js için
    // _pvRenderWizard'ın 'welcome' adımı — Faz S devamı, dev fonksiyon refactoru.
    function _pvRenderWizardWelcome(g, container, cat, quote, _liveG) {
            container.innerHTML = `
            <div class="pvwiz-welcome">
                <div class="pvwiz-welcome-glow"></div>
                <div class="pvwiz-welcome-icon">${cat.icon}</div>
                <div class="pvwiz-welcome-goal">${window.esc(g.title)}</div>
                <div class="pvwiz-welcome-quote">"${window.esc(quote)}"</div>
                <div class="pvwiz-welcome-hint">Hedefine giden yolu birlikte çizelim</div>
                <button class="pvwiz-start-btn" id="pvwiz-start">
                    <i class="ti ti-rocket"></i> Planlamaya Başla
                </button>
            </div>`;
            const _glowEl = container.querySelector('.pvwiz-welcome-glow');
            if (_glowEl) _glowEl.style.background = cat.color;
            const _iconEl = container.querySelector('.pvwiz-welcome-icon');
            if (_iconEl) _iconEl.style.color = cat.color;
            const _startBtn = container.querySelector('#pvwiz-start');
            if (_startBtn) _startBtn.style.setProperty('--wiz-color', cat.color);
            document.getElementById('pvwiz-start')?.addEventListener('click', () => {
                if (!window.__getPvWiz()) window.__setPvWiz({ step: 'welcome' });
                window.__getPvWiz().step = 'count';
                _pvBroadcastWizState();
                const _g = _liveG();
                window._pvRenderStepper(_g);
                window._pvRenderMainCal(_g);
            });
            return;
    }

    // _pvRenderWizard'ın 'count' adımı — Faz S devamı, dev fonksiyon refactoru.
    function _pvRenderWizardCount(chat, _liveG) {
            _pvWizAddBubble(chat, '👋', 'Merhaba! Hedefinizi kaç aşamaya bölmek istersiniz?', 0, () => {
                const row = document.createElement('div');
                row.className = 'pvwiz-count-cards';
                row.innerHTML = [3,4,5,6].map(n => `
                    <button class="pvwiz-count-card" data-n="${n}">
                        <span class="pvwiz-count-num">${n}</span>
                        <span class="pvwiz-count-lbl">aşama</span>
                    </button>`).join('');
                chat.appendChild(row);
                setTimeout(() => row.classList.add('visible'), 50);
                row.querySelectorAll('.pvwiz-count-card').forEach(btn => {
                    btn.addEventListener('click', () => {
                        row.querySelectorAll('.pvwiz-count-card').forEach(b => b.classList.remove('selected'));
                        btn.classList.add('selected');
                        const n = parseInt(btn.dataset.n);
                        setTimeout(() => {
                            window.__getPvWiz().step    = 'names';
                            window.__getPvWiz().count   = n;
                            window.__getPvWiz().names   = Array(n).fill('');
                            window.__getPvWiz().nameIdx = 0;
                            _pvBroadcastWizState();
                            window._pvRenderStepper(_liveG());
                            window._pvRenderMainCal(_liveG());
                        }, 350);
                    });
                });
            });
            return;
    }

    // _pvRenderWizard'ın 'names' adımı — Faz S devamı, dev fonksiyon refactoru.
    function _pvRenderWizardNames(chat, cat, _liveG) {
            const idx   = window.__getPvWiz().nameIdx || 0;
            const count = window.__getPvWiz().count;

            _pvWizAddBubble(chat, '🤖',
                `Harika! ${count} aşama seçildi.\nŞimdi her birine isim verelim 📝`,
                0, () => {
                    const card = document.createElement('div');
                    card.className = 'pvwiz-name-card pvwiz-name-wrap';
                    card.innerHTML = `
                        <div class="pvwiz-name-card-header">
                            <span class="pvwiz-name-card-pos" id="pvwiz-pos">${idx + 1} / ${count}</span>
                            <span class="pvwiz-name-card-label">Aşama <span id="pvwiz-num">${idx + 1}</span></span>
                        </div>
                        <input class="pvwiz-name-inp" id="pvwiz-name-inp" type="text"
                            placeholder="Aşama adı…" maxlength="40" autocomplete="off"
                            value="${window.esc(window.__getPvWiz().names[idx] || '')}">
                        <div class="pvwiz-name-card-nav">
                            <button class="pvwiz-nav-btn pvwiz-nav-back" id="pvwiz-back"
                                ${idx === 0 ? 'disabled' : ''}>
                                <i class="ti ti-arrow-left"></i> Geri
                            </button>
                            <div class="pvwiz-name-progress" id="pvwiz-dots">
                                ${Array(count).fill(0).map((_,i) =>
                                    `<div class="pvwiz-name-dot${i < idx ? ' done' : i === idx ? ' active' : ''}" data-dot-i="${i}"></div>`
                                ).join('')}
                            </div>
                            <button class="pvwiz-nav-btn pvwiz-nav-fwd" id="pvwiz-fwd">
                                ${idx < count - 1 ? 'İleri <i class="ti ti-arrow-right"></i>' : 'Tarihler <i class="ti ti-calendar"></i>'}
                            </button>
                        </div>`;
                    chat.appendChild(card);
                    card.querySelector('#pvwiz-back')?.style.setProperty('--wiz-color', cat.color);
                    card.querySelector('#pvwiz-fwd')?.style.setProperty('--wiz-color', cat.color);
                    card.querySelectorAll('.pvwiz-name-dot').forEach(dot => {
                        const i = parseInt(dot.dataset.dotI, 10);
                        if (i <= idx) dot.style.setProperty('--wiz-color', cat.color);
                    });
                    setTimeout(() => card.classList.add('visible'), 30);

                    const inp  = card.querySelector('#pvwiz-name-inp');
                    const fwd  = card.querySelector('#pvwiz-fwd');
                    const back = card.querySelector('#pvwiz-back');
                    setTimeout(() => inp?.focus(), 150);

                    const goTo = (newIdx) => {
                        // Save current
                        window.__getPvWiz().names[window.__getPvWiz().nameIdx] = inp.value.trim();
                        if (newIdx < 0) {
                            // Back to count step
                            window.__getPvWiz().step = 'count';
                            _pvBroadcastWizState();
                            window._pvRenderStepper(_liveG());
                            return;
                        }
                        window.__getPvWiz().nameIdx = newIdx;
                        _pvBroadcastWizState();

                        // Update card inline (no full re-render = smoother)
                        const curIdx = window.__getPvWiz().nameIdx;
                        card.querySelector('#pvwiz-pos').textContent  = `${curIdx + 1} / ${count}`;
                        card.querySelector('#pvwiz-num').textContent  = curIdx + 1;
                        inp.value       = window.__getPvWiz().names[curIdx] || '';
                        inp.placeholder = `Aşama ${curIdx + 1} adı…`;
                        back.disabled   = curIdx === 0;
                        fwd.innerHTML   = curIdx < count - 1
                            ? 'İleri <i class="ti ti-arrow-right"></i>'
                            : 'Tarihler <i class="ti ti-calendar"></i>';

                        // Animate dots
                        card.querySelectorAll('.pvwiz-name-dot').forEach((dot, i) => {
                            dot.className = 'pvwiz-name-dot' + (i < curIdx ? ' done' : i === curIdx ? ' active' : '');
                            if (i <= curIdx) dot.style.setProperty('--wiz-color', cat.color);
                        });
                        setTimeout(() => inp?.focus(), 80);
                    };

                    fwd.addEventListener('click', () => {
                        const val = inp.value.trim();
                        if (!val) {
                            inp.classList.add('pvwiz-shake');
                            setTimeout(() => inp.classList.remove('pvwiz-shake'), 500);
                            return;
                        }
                        window.__getPvWiz().names[window.__getPvWiz().nameIdx] = val;
                        if (window.__getPvWiz().nameIdx >= count - 1) {
                            // All named → create milestones & go to dates
                            const g2 = window._pgGetGoals().find(x => x.id === window.__getPvGoalId());
                            if (g2) {
                                const todayIso = _localToday();
                                g2.milestones = window.__getPvWiz().names.map((name, i) => ({
                                    id: window.uid(), title: name.trim() || `Aşama ${i+1}`,
                                    due_date: '', start_date: i === 0 ? todayIso : '',
                                    done: false, order: i, subtasks: [],
                                    created_at: new Date().toISOString(),
                                }));
                                window.persistGoals();
                                if (window.PlanningCollab?.channel)
                                    window.PlanningCollab.broadcast('ms_batch_set', { goalId: window.__getPvGoalId(), milestones: g2.milestones });
                            }
                            window.__getPvWiz().step    = 'dates';
                            window.__getPvWiz().dateIdx = 0;
                            _pvBroadcastWizState();
                            window._pvRenderStepper(_liveG());
                            window._pvRenderMainCal(_liveG());
                        } else {
                            goTo(window.__getPvWiz().nameIdx + 1);
                        }
                    });
                    back.addEventListener('click', () => {
                        if (window.__getPvWiz().nameIdx === 0) goTo(-1);
                        else goTo(window.__getPvWiz().nameIdx - 1);
                    });
                    inp.addEventListener('keydown', e => {
                        if (e.key === 'Enter') fwd.click();
                        if (e.key === 'Backspace' && inp.value === '') back.click();
                    });
                });
            return;
    }

    // _pvRenderWizard'ın 'dates' adımı — Faz S devamı, dev fonksiyon refactoru.
    function _pvRenderWizardDates(g, chat) {
            const g2     = window._pgGetGoals().find(x => x.id === window.__getPvGoalId()) || g;
            const msList  = g2.milestones || [];
            const total   = msList.length;
            const askUpto = total - 1; // user picks dates for all except last
            const idx     = window.__getPvWiz().dateIdx || 0;

            // History: already-picked dates
            msList.slice(0, idx).forEach((m, i) => {
                _pvWizAddBubble(chat, '🤖', i === 0
                    ? `Süper! Şimdi her aşamanın bitiş tarihini takvimden seçin 👇\n"${window.esc(m.title)}" ne zaman bitmeli?`
                    : `"${window.esc(m.title)}" ne zaman bitmeli?`, i * 50, null, false);
                _pvWizAddUserBubble(chat, `📅 ${fmtDate(m.due_date)}`, i * 50 + 25);
            });

            if (idx >= askUpto) {
                // Only the last milestone remains — auto-assign
                _pvWizAutoFinish(g2);
                return;
            }

            const cur = msList[idx];
            const minDate = idx === 0
                ? new Date().toISOString().split('T')[0]
                : _pvDayAfter(msList[idx - 1].due_date);

            const delay = idx * 50;
            _pvWizAddBubble(chat, '🤖',
                idx === 0
                    ? `Süper! Takvimde her aşamanın bitiş tarihini seçin 👇\n"${window.esc(cur.title)}" ne zaman bitmeli?`
                    : `"${window.esc(cur.title)}" ne zaman bitmeli?`,
                delay, () => {
                    const hint = document.createElement('div');
                    hint.className = 'pvwiz-cal-hint';
                    hint.innerHTML = `<i class="ti ti-hand-click"></i> Takvimde bir güne tıklayın
                        ${minDate ? `<span class="pvwiz-min-hint">(${fmtDate(minDate)} ve sonrası)</span>` : ''}`;
                    chat.appendChild(hint);
                    setTimeout(() => hint.classList.add('visible'), 30);
                });
            return;
    }

    function _pvRenderWizard(g, container) {
        // Always prefer live goal from window._pgGetGoals() array to avoid stale closure issues
        const _liveG = () => window._pgGetGoals().find(x => x.id === window.__getPvGoalId()) || g;
        const cat    = getCat(g.category);
        const quotes = window.PV_MOTIVATION[g.category] || window.PV_MOTIVATION.diger;
        const quote  = quotes[Math.floor(Date.now() / 86400000) % quotes.length];

        if (window.__getPvWiz().step === 'welcome') return _pvRenderWizardWelcome(g, container, cat, quote, _liveG);

        // Chat container
        container.innerHTML = `<div class="pvwiz-chat" id="pvwiz-chat"></div>`;
        const chat = container.querySelector('#pvwiz-chat');

        if (window.__getPvWiz().step === 'count') return _pvRenderWizardCount(chat, _liveG);
        if (window.__getPvWiz().step === 'names') return _pvRenderWizardNames(chat, cat, _liveG);
        if (window.__getPvWiz().step === 'dates') return _pvRenderWizardDates(g, chat);

        if (window.__getPvWiz().step === 'summary') {
            window._pvRenderPlanSummary(g, container);
            return;
        }
    }

    // Auto-assign last milestone's date = goal deadline
    function _pvWizAutoFinish(g2) {
        const msList = g2.milestones || [];
        const last   = msList[msList.length - 1];
        if (!last) return;
        const deadline = g2.deadline || _pvDayAfter(msList[msList.length - 2]?.due_date || _localToday());
        last.due_date   = deadline;
        last.start_date = _pvDayAfter(msList[msList.length - 2]?.due_date || _localToday());
        g2._dirty = true;   // sadece tüm tarihler atandığında Supabase'e sync et
        window.persistGoals();
        if (window.PlanningCollab?.channel)
            window.PlanningCollab.broadcast('ms_batch_set', { goalId: window.__getPvGoalId(), milestones: g2.milestones });
        window.__getPvWiz().step = 'summary';
        _pvBroadcastWizState();
        window._pvRenderStepper(g2);
        window._pvRenderMainCal(g2);
        window.toast('🎉 Aşamalar planlandı!');
    }

    function _pvWizAddBubble(container, avatar, text, delay, afterCb, animated = true) {
        const typing = document.createElement('div');
        typing.className = 'pvwiz-typing';
        typing.innerHTML = `<div class="pvwiz-avatar">${avatar}</div><div class="pvwiz-typing-dots"><span></span><span></span><span></span></div>`;
        container.appendChild(typing);
        const showTime = animated ? 380 : 0;
        setTimeout(() => {
            typing.remove();
            const bubble = document.createElement('div');
            bubble.className = 'pvwiz-bubble pvwiz-bubble-bot';
            bubble.innerHTML = `<div class="pvwiz-avatar">${avatar}</div><div class="pvwiz-bubble-text">${window.esc(text).replace(/\n/g,'<br>')}</div>`;
            container.appendChild(bubble);
            requestAnimationFrame(() => bubble.classList.add('in'));
            container.scrollTop = container.scrollHeight;
            if (afterCb) setTimeout(afterCb, animated ? 280 : 0);
        }, animated ? delay + showTime : delay);
        if (animated) setTimeout(() => typing.classList.add('visible'), delay);
    }

    function _pvWizAddUserBubble(container, text, delay) {
        setTimeout(() => {
            const bubble = document.createElement('div');
            bubble.className = 'pvwiz-bubble pvwiz-bubble-user';
            bubble.innerHTML = `<div class="pvwiz-bubble-text">${window.esc(text)}</div>`;
            container.appendChild(bubble);
            requestAnimationFrame(() => bubble.classList.add('in'));
            container.scrollTop = container.scrollHeight;
        }, delay);
    }

    function _pvDayAfter(dateStr) {
        if (!dateStr) return _localToday();
        const d = new Date(dateStr + 'T00:00:00');
        d.setDate(d.getDate() + 1);
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }

    window._localToday = _localToday; // planning.js için
    function _localToday() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }

    // Normalize any date to YYYY-MM-DD (handles DD-MM-YYYY from the main app)
    function _normYMD(d) {
        if (!d) return '';
        const p = d.split('-');
        if (p.length !== 3) return d;
        return p[0].length === 2 ? `${p[2]}-${p[1]}-${p[0]}` : d;
    }
    window._normYMD = _normYMD;

    // Called from calendar when wizard dates step is active
    window._pvWizAssignDate = _pvWizAssignDate; // planning.js için
    function _pvWizAssignDate(g, dateStr) {
        if (!window.__getPvWiz() || window.__getPvWiz().step !== 'dates') return false;
        const g2    = window._pgGetGoals().find(x => x.id === window.__getPvGoalId()) || g;
        const msList = g2.milestones;
        const idx   = window.__getPvWiz().dateIdx;
        const total = msList.length;
        const askUpto = total - 1;

        // Validate: must be after previous milestone's end
        if (idx > 0 && dateStr <= msList[idx - 1].due_date) {
            window.toast(`⚠️ Tarih önceki aşamanın bitişinden sonra olmalı`);
            return false;
        }

        const ms = msList[idx];
        if (!ms) return false;
        ms.due_date   = dateStr;
        ms.start_date = idx === 0
            ? _localToday()
            : _pvDayAfter(msList[idx - 1].due_date);

        // Set next milestone's start_date immediately
        if (idx + 1 < total) {
            msList[idx + 1].start_date = _pvDayAfter(dateStr);
        }

        window.__getPvWiz().dateIdx++;
        window.persistGoals();
        if (window.PlanningCollab?.channel) {
            window.PlanningCollab.broadcast('ms_update', { goalId: window.__getPvGoalId(), msId: ms.id, fields: { due_date: ms.due_date, start_date: ms.start_date } });
            if (idx + 1 < total)
                window.PlanningCollab.broadcast('ms_update', { goalId: window.__getPvGoalId(), msId: msList[idx+1].id, fields: { start_date: msList[idx+1].start_date } });
        }
        _pvBroadcastWizState();

        if (window.__getPvWiz().dateIdx >= askUpto) {
            // Auto-finish last milestone
            _pvWizAutoFinish(g2);
        } else {
            window._pvRenderStepper(g2);
            window._pvRenderMainCal(g2);
        }
        window._pvRenderDayPanel(g2, dateStr);
        return true;
    }

// Faz G: gerçek export eklendi (planning.js/planning-plan-header.js için,
// bu dosya loader sırasında onlardan ÖNCE yüklendiği için güvenli).
// window.* köprüleri KALDIRILMADI: planning-lesson-plan-modal.js (bu
// dosyadan ÖNCE yüklenir) hâlâ window._normYMD üzerinden çağırıyor.
export { _pvBroadcastWizState, _pvRenderWizard, _localToday, _normYMD, _pvWizAssignDate };
