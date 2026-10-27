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

// Traffic Light: one lamp for the meter's state. Nothing moves.
const meter = document.getElementById('meter');
const svg = document.getElementById('light');
const lamps = { red: document.getElementById('red'), yellow: document.getElementById('yellow'), green: document.getElementById('green') };
const valueEl = document.getElementById('value');

boot({ level: 0.4, formatted: '40%', available: true, state: 'normal' }, (data) => {
    const { available, state } = applyCommon(data);
    const lit = !available ? '' : state === 'critical' ? 'red' : state === 'warning' ? 'yellow' : 'green';
    for (const [name, lamp] of Object.entries(lamps)) lamp.classList.toggle('on', name === lit);
    svg.setAttribute('class', lit ? `lit-${lit}` : '');
    fitText(meter, valueEl, available ? (data.formatted || '') : '');
});
