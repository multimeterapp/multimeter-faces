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

// Tally Marks: counts as groups of five strokes, like on a notepad. Past 25
// (or when the meter is too narrow) it shows one group and the number instead.
const meter = document.getElementById('meter');
const svg = document.getElementById('marks');
const valueEl = document.getElementById('value');

const MAX_MARKS = 25;
const STEP = 3;          // between strokes in a group
const GROUP = 15;        // from one group to the next
const TOP = 5.5, BOTTOM = 16.5;

// Small, repeatable wobble so the strokes look hand-drawn but never jump around.
function wobble(i, k) {
    const s = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
    return (s - Math.floor(s)) - 0.5;
}

function marksPath(count) {
    const parts = [];
    for (let i = 0; i < count; i++) {
        const group = Math.floor(i / 5), pos = i % 5;
        const x0 = 1.5 + group * GROUP;
        const f = (n) => n.toFixed(2);
        if (pos < 4) {
            const x = x0 + pos * STEP;
            parts.push(`<path d="M${f(x + wobble(i, 1) * 0.7)} ${f(TOP + wobble(i, 2) * 0.8)}L${f(x + wobble(i, 3) * 0.7)} ${f(BOTTOM + wobble(i, 4) * 0.6)}"/>`);
        } else {
            parts.push(`<path class="slash" d="M${f(x0 - 1.5)} ${f(14 + wobble(i, 5) * 0.6)}L${f(x0 + 3 * STEP + 1.5)} ${f(8 + wobble(i, 6) * 0.6)}"/>`);
        }
    }
    return parts.join('');
}
function widthFor(count) {
    if (count <= 0) return 0;
    const groups = Math.ceil(count / 5);
    const last = count % 5 === 0 ? 5 : count % 5;
    const lastW = last === 5 ? 3 * STEP + 3 : (last - 1) * STEP + 3;
    return (groups - 1) * GROUP + lastW;
}

let shown = null;
boot({ value: 7, formatted: '7', available: true }, (data) => {
    const { available } = applyCommon(data);
    const n = available && typeof data.value === 'number' ? Math.round(data.value) : null;
    const room = window.innerWidth - 2;
    const fits = n !== null && n > 0 && n <= MAX_MARKS && widthFor(n) <= room;
    const key = `${n}|${fits}|${room}`;
    if (key === shown) return;
    shown = key;
    document.body.classList.toggle('compact', !fits);
    if (fits) {
        svg.setAttribute('width', widthFor(n));
        svg.setAttribute('viewBox', `0 0 ${widthFor(n)} 22`);
        svg.innerHTML = marksPath(n);
        svg.style.display = '';
        valueEl.hidden = true;
    } else {
        // One full group as an icon, then the number.
        const w = widthFor(5);
        svg.setAttribute('width', w);
        svg.setAttribute('viewBox', `0 0 ${w} 22`);
        svg.innerHTML = marksPath(5);
        const text = n === null ? '–' : (n === Math.round(Number(data.value)) && data.formatted && !/[^\d.,\s  '-]/.test(data.formatted) ? data.formatted : n.toLocaleString());
        valueEl.hidden = false;
        valueEl.textContent = text;
        svg.style.display = '';
        if (meter.scrollWidth > window.innerWidth) svg.style.display = 'none';
    }
});
