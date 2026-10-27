// ---- Shared face plumbing (scheme, state, tint, motion) ----
// The menu bar's appearance: the app (and the website) put light-mode or
// dark-mode on <body>; meterData.colorScheme and the system setting are fallbacks.
function schemeOf(data) {
    const c = document.body.classList;
    if (c.contains('light-mode')) return 'light';
    if (c.contains('dark-mode')) return 'dark';
    if (data && (data.colorScheme === 'light' || data.colorScheme === 'dark')) return data.colorScheme;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

// Older apps send no state; fall back to battery-style levels.
function alertState(data, level) {
    if (data && data.state) return data.state;
    return level < 0.1 ? 'critical' : level < 0.2 ? 'warning' : 'normal';
}

// "How good is this?" on 0-1: high is good. Sources that alert when they run
// high (CPU, disk, memory, thermal) count down; time progress counts what is left.
function goodness(data) {
    const level = Math.max(0, Math.min(1, Number(data.level) || 0));
    if (data.alertDirection === 'above') return 1 - level;
    if (data.source === 'progress') return 1 - level;
    return level;
}

function applyCommon(data) {
    const level = Number(data.level) || 0;
    const available = data.available !== false;
    const state = available ? alertState(data, level) : 'unavailable';
    document.documentElement.dataset.scheme = schemeOf(data);
    const body = document.body;
    body.dataset.state = state;
    body.classList.toggle('charging', !!data.isCharging);
    body.classList.toggle('reduce-motion', !!data.reduceMotion);
    body.classList.toggle('tinted', !!data.tint);
    if (data.tint) body.style.setProperty('--tint', data.tint);
    else body.style.removeProperty('--tint');
    return { level, available, state };
}

// Calls render(data) now, on every meterUpdate, and when the menu bar flips
// between light and dark (the app changes the body class without new data).
function boot(fallback, render) {
    let data = window.meterData || fallback;
    const run = () => render(data);
    window.addEventListener('meterUpdate', (e) => { data = e.detail || data; run(); });
    new MutationObserver(run).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    run();
    window.meterReady = true;
}

// Hide the optional text when the meter is too narrow for it.
function fitText(meter, textEl, text) {
    textEl.textContent = text;
    textEl.hidden = !text;
    if (text && meter.scrollWidth > window.innerWidth) textEl.hidden = true;
}
// ---- end shared ----

// Mood: reads the meter's state, not its number. Happy while things are
// fine, flat as they get low, worried at the warning level, panicking when critical.
const meter = document.getElementById('meter');
const features = document.getElementById('features');
const valueEl = document.getElementById('value');

const FACES = {
    // Big smile, round eyes.
    happy: '<circle class="dot" cx="6.4" cy="9.2" r="1.15"/><circle class="dot" cx="11.6" cy="9.2" r="1.15"/>' +
        '<path d="M5.5 12.6Q9 16.6 12.5 12.6"/>',
    // Charging: eyes closed with joy.
    content: '<path d="M5.2 9.6Q6.4 8 7.6 9.6"/><path d="M10.4 9.6Q11.6 8 12.8 9.6"/>' +
        '<path d="M5.5 12.6Q9 16.6 12.5 12.6"/>',
    // Meh: a straight mouth.
    neutral: '<circle class="dot" cx="6.4" cy="9.4" r="1.15"/><circle class="dot" cx="11.6" cy="9.4" r="1.15"/>' +
        '<path d="M6.25 14H11.75"/>',
    // Worried: brows up in the middle, a wobbly frown.
    worried: '<path class="tear-line" d="M4.8 7.4L7.4 6.5"/><path class="tear-line" d="M13.2 7.4L10.6 6.5"/>' +
        '<circle class="dot" cx="6.4" cy="9.8" r="1.15"/><circle class="dot" cx="11.6" cy="9.8" r="1.15"/>' +
        '<path d="M6 15Q7.5 13.2 9 14.4Q10.5 15.6 12 13.8"/>',
    // Panic: wide eyes, open mouth, a bead of sweat.
    panic: '<circle class="dot" cx="6.3" cy="9" r="1.45"/><circle class="dot" cx="11.7" cy="9" r="1.45"/>' +
        '<ellipse cx="9" cy="14.2" rx="1.9" ry="2.1"/>' +
        '<path class="sweat" d="M15.3 4.6Q16.9 7 16.9 7.8A1.6 1.6 0 0 1 13.7 7.8Q13.7 7 15.3 4.6Z"/>',
    // Nothing to read: asleep.
    asleep: '<path d="M5.2 9.6H7.6"/><path d="M10.4 9.6H12.8"/><path d="M7.5 14H10.5"/>'
};

function moodFor(data, available, state) {
    if (!available) return 'asleep';
    if (state === 'critical') return 'panic';
    if (state === 'warning') return 'worried';
    if (data.isCharging) return 'content';
    // Sources with alert levels get a flat mouth on the way toward them.
    if (data.alertDirection) {
        const good = goodness(data);
        const warn = data.warningLevel;
        const edge = typeof warn === 'number'
            ? (data.alertDirection === 'above' ? 1 - warn : warn)
            : 0.2;
        if (good < Math.min(0.9, edge + 0.15)) return 'neutral';
    }
    return 'happy';
}

let shown = '';
boot({ level: 0.6, formatted: '60%', available: true }, (data) => {
    const { available, state } = applyCommon(data);
    const mood = moodFor(data, available, state);
    if (mood !== shown) { features.innerHTML = FACES[mood]; shown = mood; }
    fitText(meter, valueEl, available ? (data.formatted || '') : '');
});
