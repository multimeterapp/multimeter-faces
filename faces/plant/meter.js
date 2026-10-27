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

// Plant: perks up when the value is good and wilts as it gets bad. "Good" is
// a full battery, a mostly empty disk, an idle CPU (see goodness()).
// It wilts all the way at the critical level. Nothing moves.
const meter = document.getElementById('meter');
const el = (id) => document.getElementById(id);
const valueEl = el('value');

// Leaf colors from healthy to dry, per menu bar.
const GREENS = {
    dark: [[52, 199, 89], [176, 170, 60], [160, 112, 62]],
    light: [[30, 160, 64], [150, 140, 30], [138, 90, 44]],
};
function leafColor(health, scheme) {
    const [g, o, b] = GREENS[scheme];
    const lerp = (a, c, t) => a.map((v, i) => Math.round(v + (c[i] - v) * t));
    const rgb = health >= 0.5 ? lerp(o, g, (health - 0.5) / 0.5) : lerp(b, o, health / 0.5);
    return `rgb(${rgb.join(',')})`;
}

// A leaf from (x, y) at `angle` degrees (0 = right, negative = up), `len` long.
function leaf(x, y, angle, len, width) {
    const a = (angle * Math.PI) / 180;
    const tx = x + len * Math.cos(a), ty = y + len * Math.sin(a);
    const mx = (x + tx) / 2, my = (y + ty) / 2;
    const nx = -Math.sin(a) * width, ny = Math.cos(a) * width;
    const f = (n) => n.toFixed(2);
    return `M${f(x)} ${f(y)}Q${f(mx + nx)} ${f(my + ny)} ${f(tx)} ${f(ty)}Q${f(mx - nx)} ${f(my - ny)} ${f(x)} ${f(y)}Z`;
}

boot({ level: 0.8, formatted: '80%', available: true, alertDirection: 'below' }, (data) => {
    const { available, state } = applyCommon(data);
    const scheme = document.documentElement.dataset.scheme === 'light' ? 'light' : 'dark';
    let health = available ? goodness(data) : 0.6;
    if (state === 'critical') health = Math.min(health, 0.08);
    else if (state === 'warning') health = Math.min(health, 0.3);
    const droop = 1 - health;

    // The stem bends over to the right as it droops.
    const baseX = 9, baseY = 14;
    const tipX = baseX + 5 * droop * droop + 1.5 * droop;
    const tipY = 2.5 + 6.5 * droop * droop;
    const ctrlX = baseX - 0.5 * droop, ctrlY = 6 + 2 * droop;
    el('stem').setAttribute('d', `M${baseX} ${baseY}Q${ctrlX.toFixed(2)} ${ctrlY.toFixed(2)} ${tipX.toFixed(2)} ${tipY.toFixed(2)}`);

    // Two leaves low on the stem: reaching up when healthy, hanging when dry.
    const leafY = 10.5 + droop * 0.5;
    el('leafL').setAttribute('d', leaf(baseX - 0.25, leafY, -150 + 85 * droop, 6.5 - droop, 1.8));
    el('leafR').setAttribute('d', leaf(baseX + 0.25, leafY - 1.5, -30 + 70 * droop, 6 - droop, 1.7));

    // A flower on top when it is thriving, a small bud when it is fine.
    const flower = el('flower');
    const fx = tipX.toFixed(2), fy = tipY.toFixed(2);
    if (available && health >= 0.6) {
        let petals = '';
        for (let i = 0; i < 5; i++) {
            const a = (i * 72 - 90) * Math.PI / 180;
            petals += `<circle class="petal" cx="${(tipX + 1.7 * Math.cos(a)).toFixed(2)}" cy="${(tipY + 1.7 * Math.sin(a)).toFixed(2)}" r="1.35"/>`;
        }
        flower.innerHTML = petals + `<circle class="heart" cx="${fx}" cy="${fy}" r="1.1"/>`;
    } else if (available && health >= 0.35) {
        flower.innerHTML = `<circle class="leafy" cx="${fx}" cy="${fy}" r="1.3" fill="${leafColor(health, scheme)}"/>`;
    } else {
        flower.innerHTML = '';
    }
    document.body.style.setProperty('--leaf', available ? leafColor(health, scheme) : 'var(--muted)');
    fitText(meter, valueEl, available ? (data.formatted || `${Math.round(health * 100)}%`) : '–');
});
