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

// XP Bar: a game-style level and experience bar, drawn in pixel art.
// Counts you send it level up every time they pass the meter's maximum:
// with a maximum of 10, a count of 23 is level 3 with the bar 30% full.
// Time Progress shows its percentage instead of a level.

// 5x7 digits and 3x5 letters, one string per row ('1' = pixel).
const DIGITS = {
    0: ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
    1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
    2: ['01110', '10001', '00001', '00110', '01000', '10000', '11111'],
    3: ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
    4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
    5: ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
    6: ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
    7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
    8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
    9: ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
    '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
    '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
};
const SMALL = {
    L: ['100', '100', '100', '100', '111'],
    V: ['101', '101', '101', '010', '010'],
    '%': ['101', '001', '010', '100', '101'],
};

const PALETTE = {
    dark: { text: '#ffffff', badge: '#ffd60a', frame: 'rgba(255,255,255,0.85)', track: 'rgba(255,255,255,0.14)', notch: 'rgba(0,0,0,0.28)', muted: 'rgba(255,255,255,0.45)' },
    light: { text: '#000000', badge: '#a87400', frame: 'rgba(0,0,0,0.85)', track: 'rgba(0,0,0,0.10)', notch: 'rgba(0,0,0,0.22)', muted: 'rgba(0,0,0,0.4)' },
};
const FILLS = {
    normal: { dark: '#30d158', light: '#22b04b' },
    warning: { dark: '#ffd60a', light: '#e8ac00' },
    critical: { dark: '#ff453a', light: '#e0281f' },
};

function hexToRgb(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return null;
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(hex, toward, amount) {
    const c = hexToRgb(hex);
    if (!c) return hex;
    const t = toward === 'white' ? 255 : 0;
    const v = c.map((x) => Math.round(x + (t - x) * amount));
    return `rgb(${v[0]},${v[1]},${v[2]})`;
}

const canvas = document.getElementById('xp');
const ctx = canvas.getContext('2d');

function glyph(rows, x, y, color, scale = 1) {
    ctx.fillStyle = color;
    rows.forEach((row, r) => {
        for (let c = 0; c < row.length; c++) if (row[c] === '1') ctx.fillRect(x + c * scale, y + r * scale, scale, scale);
    });
    return rows[0].length * scale;
}

// What the badge says and how full the bar is.
function reading(data, available) {
    if (!available || typeof data.value !== 'number') return { prefix: 'LV', number: '-', fill: 0 };
    if (data.source === 'progress') {
        const pct = Math.round((Number(data.level) || 0) * 100);
        return { prefix: '', number: String(pct), suffix: '%', fill: pct / 100 };
    }
    const min = Number(data.min) || 0;
    const span = (Number(data.max) || 1) - min;
    const xp = span > 0 ? (data.value - min) / span : 0;
    if (xp < 0) return { prefix: 'LV', number: '0', fill: 0 };
    const level = Math.floor(xp) + 1;
    return { prefix: 'LV', number: level > 999 ? '999+' : String(level), fill: level > 999 ? 1 : xp - Math.floor(xp) };
}

boot({ source: 'push', value: 23, min: 0, max: 10, level: 1, available: true }, (data) => {
    const { available, state } = applyCommon(data);
    const scheme = document.documentElement.dataset.scheme === 'light' ? 'light' : 'dark';
    const P = PALETTE[scheme];
    const width = Math.max(1, Math.round(window.innerWidth));
    const dpr = Math.max(1, Math.round(window.devicePixelRatio || 1));
    canvas.width = width * dpr;
    canvas.height = 22 * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, width, 22);

    const r = reading(data, available);
    const top = 8; // 7-point-tall bar, centered in 22
    // Badge width first, so the bar gets the rest. The level digits are drawn
    // at 2x (14 points tall, readable at a glance) while the bar keeps at least
    // 22 points; then at 1x; under ~12 points of bar the badge is dropped.
    const prefixW = r.prefix ? 8 : 0;
    const suffixW = r.suffix ? 4 : 0;
    const pad = 1;
    const badgeW = (scale) => prefixW + r.number.length * 6 * scale - scale + suffixW;
    let scale = 2;
    let barW = width - pad * 2 - badgeW(2) - 3;
    if (barW < 22) { scale = 1; barW = width - pad * 2 - badgeW(1) - 3; }
    const showBadge = barW >= 12;
    if (!showBadge) barW = width - pad * 2;

    let x = pad;
    if (showBadge) {
        const badgeColor = available ? P.badge : P.muted;
        const textColor = available ? P.text : P.muted;
        const digitTop = scale === 2 ? 4 : top; // digits centered on the bar
        const smallTop = scale === 2 ? digitTop + 14 - 5 : top + 2; // on the digits' baseline
        if (r.prefix) {
            glyph(SMALL.L, x, smallTop, badgeColor);
            glyph(SMALL.V, x + 4, smallTop, badgeColor);
            x += prefixW;
        }
        for (const ch of r.number) x += glyph(DIGITS[ch], x, digitTop, textColor, scale) + scale;
        x -= scale;
        if (r.suffix) x += 1 + glyph(SMALL['%'], x + 1, smallTop, badgeColor);
        x += 3;
    }

    // The bar: 1-point frame, 5-point track with notches, fill with a shine row.
    ctx.fillStyle = available ? P.frame : P.muted;
    ctx.fillRect(x + 1, top, barW - 2, 1);
    ctx.fillRect(x + 1, top + 6, barW - 2, 1);
    ctx.fillRect(x, top + 1, 1, 5);
    ctx.fillRect(x + barW - 1, top + 1, 1, 5);
    const innerX = x + 1, innerW = barW - 2;
    ctx.fillStyle = P.track;
    ctx.fillRect(innerX, top + 1, innerW, 5);
    const filled = Math.round(innerW * Math.max(0, Math.min(1, r.fill)));
    if (available && filled > 0) {
        const tint = state === 'normal' && data.tint && hexToRgb(data.tint) ? data.tint : null;
        const base = tint || (FILLS[state] || FILLS.normal)[scheme];
        ctx.fillStyle = base;
        ctx.fillRect(innerX, top + 1, filled, 5);
        ctx.fillStyle = mix(base, 'white', 0.45);
        ctx.fillRect(innerX, top + 2, filled, 1);
        ctx.fillStyle = mix(base, 'black', 0.25);
        ctx.fillRect(innerX, top + 5, filled, 1);
    }
    // Notches every tenth, like a game's experience bar.
    ctx.fillStyle = P.notch;
    for (let i = 1; i < 10; i++) {
        const nx = innerX + Math.round((innerW * i) / 10);
        if (nx > innerX && nx < innerX + innerW - 1) ctx.fillRect(nx, top + 1, 1, 5);
    }
});
