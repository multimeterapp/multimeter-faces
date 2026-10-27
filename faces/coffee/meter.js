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

// Coffee Cup: the mug empties as the level falls; steam rises while charging.
const meter = document.getElementById('meter');
const coffee = document.getElementById('coffee');
const crema = document.getElementById('crema');
const steam = [document.getElementById('steam1'), document.getElementById('steam2')];
const valueEl = document.getElementById('value');

const INNER_TOP = 8.5;    // highest the coffee goes (just under the rim)
const INNER_BOTTOM = 18.5;

// Two wisps of steam; the phase swaps the wiggle so they seem to rise.
function wisp(x, phase) {
    const s = phase ? -1 : 1;
    return `M${x} 6Q${x + 1.4 * s} 4.75 ${x} 3.5Q${x - 1.4 * s} 2.25 ${x} 1`;
}
let phase = 0;
let steamTimer = null;
function drawSteam() {
    steam[0].setAttribute('d', wisp(5, phase));
    steam[1].setAttribute('d', wisp(9, 1 - phase));
}
// Slow steps (2 per second), never a CSS animation, and none with Reduce Motion.
function setSteamMotion(on) {
    if (on && !steamTimer) {
        const step = () => { phase = 1 - phase; drawSteam(); steamTimer = setTimeout(step, 500); };
        steamTimer = setTimeout(step, 500);
    } else if (!on && steamTimer) {
        clearTimeout(steamTimer);
        steamTimer = null;
    }
}

boot({ level: 0.7, formatted: '70%', available: true }, (data) => {
    const { available } = applyCommon(data);
    const left = available ? goodness(data) : 0;
    // A sliver of coffee stays visible until it is really empty.
    const h = left <= 0 ? 0 : Math.max(1, left * (INNER_BOTTOM - INNER_TOP));
    const top = INNER_BOTTOM - h;
    coffee.setAttribute('y', top);
    coffee.setAttribute('height', h + 1);
    crema.setAttribute('y', top);
    crema.style.display = h >= 2 ? '' : 'none';
    drawSteam();
    setSteamMotion(!!data.isCharging && !data.reduceMotion);
    fitText(meter, valueEl, available ? (data.formatted || `${Math.round(left * 100)}%`) : '–');
});
