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

// Candle: burns down as time (or charge) runs out. The flame flickers with a
// slow step (2.5 per second), never a CSS animation, and holds still with Reduce Motion.
const meter = document.getElementById('meter');
const el = (id) => document.getElementById(id);
const valueEl = el('value');

const BASE = 19.5;      // waxTop of the dish
const TALLEST = 12;     // wax height when full
const SHORTEST = 1.5;   // the stub that is left at the end

// Teardrop flame standing on (cx, base): w wide, h tall, tip leaning by lean.
function drop(cx, base, w, h, lean) {
    const r = w / 2;
    return `M${cx + lean} ${base - h}` +
        `C${cx + r * 0.9} ${base - h * 0.55} ${cx + r} ${base - r * 0.9} ${cx} ${base}` +
        `C${cx - r} ${base - r * 0.9} ${cx - r * 0.9} ${base - h * 0.55} ${cx + lean} ${base - h}Z`;
}

const FLICKER = [0, 0.6, -0.5, 0.3];
let frame = 0;
let flickerTimer = null;
let lit = false;
let waxTop = BASE - TALLEST;

function drawFlame() {
    const lean = lit ? FLICKER[frame] : 0;
    const stretch = lit ? (frame === 2 ? 0.5 : 0) : 0;
    el('flame').setAttribute('d', lit ? drop(6, waxTop - 0.5, 4.5, 7 + stretch, lean) : '');
    el('core').setAttribute('d', lit ? drop(6, waxTop - 0.5, 2, 3, lean * 0.4) : '');
    el('glow').setAttribute('d', lit ? drop(6, waxTop + 0.5, 7.5, 10 + stretch, lean) : '');
}

function setFlicker(on) {
    if (on && !flickerTimer) {
        const step = () => { frame = (frame + 1) % FLICKER.length; drawFlame(); flickerTimer = setTimeout(step, 400); };
        flickerTimer = setTimeout(step, 400);
    } else if (!on && flickerTimer) {
        clearTimeout(flickerTimer);
        flickerTimer = null;
        frame = 0;
    }
}

boot({ level: 0.6, formatted: '25:00', available: true }, (data) => {
    const { available } = applyCommon(data);
    const left = available ? goodness(data) : 1;
    const h = SHORTEST + (TALLEST - SHORTEST) * left;
    waxTop = Math.round((BASE - h) * 2) / 2;
    lit = available && left > 0;
    // Wax column with a soft, melted waxTop edge.
    el('wax').setAttribute('d', `M3 ${BASE}V${waxTop + 1}Q3 ${waxTop} 4 ${waxTop}H8Q9 ${waxTop} 9 ${waxTop + 1}V${BASE}Z`);
    // One drip down the side once it has burned a while.
    const dripLen = Math.min(4, h - 2);
    el('drip').setAttribute('d', lit && left < 0.97 && dripLen > 1.5
        ? `M9 ${waxTop + 1}V${waxTop + 1 + dripLen}Q9 ${waxTop + 2 + dripLen} 9.75 ${waxTop + 1.5 + dripLen}Q10.25 ${waxTop + 1 + dripLen} 10 ${waxTop + dripLen}V${waxTop + 1.5}Z` : '');
    el('wick').setAttribute('y', waxTop - 1.5);
    el('wick').setAttribute('height', 1.5);
    // Blown out: a wisp of smoke instead of a flame.
    el('smoke').setAttribute('d', available && !lit ? `M6 ${waxTop - 2}Q7.5 ${waxTop - 4} 6 ${waxTop - 6}Q4.5 ${waxTop - 8} 6 ${waxTop - 10}` : '');
    drawFlame();
    setFlicker(lit && !data.reduceMotion);
    fitText(meter, valueEl, available ? (data.formatted || `${Math.round(left * 100)}%`) : '–');
});
