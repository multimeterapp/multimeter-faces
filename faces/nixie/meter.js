// Nixie Tubes: the formatted value as glowing wire numerals, one glass tube
// per digit, on a dark plinth. Units ("%", "MB/s", the "d" and "h" of a
// countdown) glow in small print between the tubes. A little neon lamp on the
// left lights amber for a warning and red for critical (blinking at 1 Hz
// unless motion is reduced).
const NS = 'http://www.w3.org/2000/svg';

// Wire cathodes drawn in a 6 x 12 box, shaped like the numerals in old tubes.
const DIGITS = {
    '0': 'M3 0.6 C4.6 0.6 5.4 2.6 5.4 6 C5.4 9.4 4.6 11.4 3 11.4 C1.4 11.4 0.6 9.4 0.6 6 C0.6 2.6 1.4 0.6 3 0.6 Z',
    '1': 'M1.7 2.2 L3.3 0.6 V11.4',
    '2': 'M0.7 3.1 C0.7 1.5 1.7 0.6 3 0.6 C4.4 0.6 5.3 1.5 5.3 3 C5.3 5.6 0.7 8.4 0.6 11.4 H5.5',
    '3': 'M0.8 0.6 H5.2 L2.6 4.9 C4.4 4.8 5.5 6.2 5.5 8.2 C5.5 10.2 4.4 11.4 2.9 11.4 C1.8 11.4 1 10.9 0.5 10.1',
    '4': 'M4.2 11.4 V0.6 L0.5 8.2 H5.6',
    '5': 'M5.2 0.6 H1.2 L0.8 5.3 C1.3 4.7 2.1 4.4 3 4.4 C4.5 4.4 5.5 5.8 5.5 7.9 C5.5 10.1 4.4 11.4 2.9 11.4 C1.8 11.4 1 10.9 0.5 10.1',
    '6': 'M4.6 0.6 L1.2 6.4 C0.8 7 0.5 7.6 0.5 8.4 C0.5 10.2 1.6 11.4 3 11.4 C4.4 11.4 5.5 10.2 5.5 8.3 C5.5 6.4 4.4 5.3 3 5.3 C2.2 5.3 1.6 5.6 1.2 6.1',
    '7': 'M0.5 0.6 H5.5 L2.2 11.4',
    '8': 'M3 5.6 C1.7 5.6 0.9 4.6 0.9 3.1 C0.9 1.6 1.8 0.6 3 0.6 C4.2 0.6 5.1 1.6 5.1 3.1 C5.1 4.6 4.3 5.6 3 5.6 C1.5 5.6 0.5 6.8 0.5 8.5 C0.5 10.3 1.5 11.4 3 11.4 C4.5 11.4 5.5 10.3 5.5 8.5 C5.5 6.8 4.5 5.6 3 5.6 Z',
    '9': 'M1.4 11.4 L4.8 5.6 C5.2 5 5.5 4.4 5.5 3.6 C5.5 1.8 4.4 0.6 3 0.6 C1.6 0.6 0.5 1.8 0.5 3.7 C0.5 5.6 1.6 6.7 3 6.7 C3.8 6.7 4.4 6.4 4.8 5.9',
    '-': 'M1 6.2 H5'
};
const GHOST = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
const TUBE_H = 18, TOP = 2, GAP = 1;

function el(name, attrs, parent) {
    const node = document.createElementNS(NS, name);
    for (const k in attrs) node.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(node);
    return node;
}

// "1.2 MB/s" -> [digit 1 with point] [digit 2] [unit MB/s]; "12:05" -> digits
// with a colon; "3d 4h" -> 3, d, 4, h. A comma or point followed by exactly
// three digits is a thousands separator and is dropped.
function tokenize(text) {
    const tokens = [];
    const chars = Array.from(text || '');
    let unit = '';
    const flushUnit = () => { if (unit.trim()) tokens.push({ type: 'unit', text: unit.trim() }); unit = ''; };
    for (let i = 0; i < chars.length; i++) {
        const c = chars[i];
        if (/[0-9]/.test(c)) { flushUnit(); tokens.push({ type: 'digit', ch: c }); continue; }
        if ((c === '.' || c === ',') && /[0-9]/.test(chars[i - 1] || '') && /[0-9]/.test(chars[i + 1] || '')) {
            const run = /^[0-9]+/.exec(chars.slice(i + 1).join(''))[0];
            // Formats here never show three decimals, so three digits mean thousands.
            if (run.length === 3) continue;
            const last = tokens[tokens.length - 1];
            if (last && last.type === 'digit') last.point = true;
            continue;
        }
        if (c === ':' && tokens.length && tokens[tokens.length - 1].type === 'digit') { flushUnit(); tokens.push({ type: 'colon' }); continue; }
        if ((c === '-' || c === '−') && /[0-9]/.test(chars[i + 1] || '')) { flushUnit(); tokens.push({ type: 'digit', ch: '-' }); continue; }
        unit += c;
    }
    flushUnit();
    return tokens;
}

class Meter {
    constructor() {
        this.svg = document.getElementById('nixie');
        this.body = document.getElementById('body');
        this.content = document.getElementById('content');
        this.measure = el('text', { class: 'unit', x: -100, y: -100 }, this.svg);
        this.key = null;
        window.addEventListener('meterUpdate', (e) => this.render(e.detail));
        window.addEventListener('resize', () => { this.key = null; this.render(this.data || {}); });
        this.render(window.meterData || { formatted: '12:05', level: 0.5 });
        window.meterReady = true;
    }

    textWidth(text, size) {
        this.measure.setAttribute('font-size', size);
        this.measure.textContent = text;
        return this.measure.getComputedTextLength();
    }

    draw(tokens, lamp, W) {
        const c = this.content;
        c.textContent = '';
        const digits = tokens.filter((t) => t.type === 'digit').length;
        const colons = tokens.filter((t) => t.type === 'colon').length + tokens.filter((t) => t.point).length * 0.6;
        let unitSize = 7;
        const unitW = (size) => tokens.filter((t) => t.type === 'unit').reduce((s, t) => s + this.textWidth(t.text, size) + 2, 0);
        const lampW = lamp ? 5 : 0;
        const pad = 2;
        // Tube width: 8 when there is room, down to 5 before the units shrink.
        let tw = 8;
        const fits = (t, us) => pad * 2 + lampW + digits * t + Math.max(0, digits - 1) * GAP + colons * 3 + unitW(us) <= W;
        while (tw > 5 && !fits(tw, unitSize)) tw -= 0.5;
        while (unitSize > 5.5 && !fits(tw, unitSize)) unitSize -= 0.5;
        const total = lampW + digits * tw + Math.max(0, digits - 1) * GAP + colons * 3 + unitW(unitSize);
        let x = Math.max(pad, (W - total) / 2);

        if (lamp) {
            el('circle', { cx: x + 1.6, cy: 11, r: 1.9, class: 'lamp-off' }, c);
            if (lamp !== 'off') {
                el('circle', { cx: x + 1.6, cy: 11, r: 2.4, class: 'lamp-halo lit' }, c);
                el('circle', { cx: x + 1.6, cy: 11, r: 1.5, class: 'lamp lit' }, c);
            }
            x += lampW;
        }

        let prev = null;
        for (const t of tokens) {
            if (t.type === 'digit') {
                if (prev === 'digit') x += GAP;
                this.tube(c, x, tw, t);
                x += tw;
                if (t.point) {
                    // The decimal point: a tiny neon dot between the tubes.
                    x += 0.4;
                    el('circle', { cx: x + 0.9, cy: 16.4, r: 1.3, class: 'halo dp lit' }, c);
                    el('circle', { cx: x + 0.9, cy: 16.4, r: 0.75, class: 'wire dp lit' }, c);
                    x += 1.4;
                }
            } else if (t.type === 'colon') {
                for (const cy of [8, 14]) {
                    el('circle', { cx: x + 1.5, cy, r: 1.3, class: 'halo dp lit' }, c);
                    el('circle', { cx: x + 1.5, cy, r: 0.7, class: 'wire dp lit' }, c);
                }
                x += 3;
            } else {
                x += 1;
                const attrs = { x, y: 16.5, 'font-size': unitSize };
                el('text', { ...attrs, class: 'unit-halo lit' }, c).textContent = t.text;
                el('text', { ...attrs, class: 'unit lit' }, c).textContent = t.text;
                x += this.textWidth(t.text, unitSize) + 1;
            }
            prev = t.type;
        }
    }

    tube(c, x, tw, t) {
        const r = tw / 2, y0 = TOP, y1 = TOP + TUBE_H;
        // Glass envelope with a domed top, its mesh, the socket and a shine.
        const outline = `M${x} ${y1} V${y0 + r} A${r} ${r} 0 0 1 ${x + tw} ${y0 + r} V${y1} Z`;
        el('path', { d: outline, class: 'tube' }, c);
        el('path', { d: outline, class: 'mesh' }, c);
        el('rect', { x, y: y1 - 1.6, width: tw, height: 1.6, class: 'socket' }, c);
        // Numeral box: 6 x 12 scaled to the tube.
        const sx = Math.min(1, (tw - 2) / 6), sy = 0.98;
        const ox = x + (tw - 6 * sx) / 2, oy = 5.3;
        const g = el('g', { transform: `translate(${ox.toFixed(2)} ${oy}) scale(${sx.toFixed(3)} ${sy})` }, c);
        for (const d of GHOST) if (d !== t.ch) el('path', { d: DIGITS[d], class: 'ghost', 'vector-effect': 'non-scaling-stroke' }, g);
        if (t.ch && DIGITS[t.ch]) {
            el('path', { d: DIGITS[t.ch], class: 'halo lit', 'vector-effect': 'non-scaling-stroke' }, g);
            el('path', { d: DIGITS[t.ch], class: 'wire lit', 'vector-effect': 'non-scaling-stroke' }, g);
        }
        el('path', { d: `M${x + 1.1} ${y1 - 3} V${y0 + r + 0.2}`, class: 'shine' }, c);
    }

    blink(on) {
        clearTimeout(this.blinkTimer);
        document.body.classList.remove('blink-off');
        if (!on) return;
        // 1 Hz, two renders a second, only while critical.
        const tick = () => {
            document.body.classList.toggle('blink-off');
            this.blinkTimer = setTimeout(tick, 500);
        };
        this.blinkTimer = setTimeout(tick, 500);
    }

    render(data) {
        this.data = data;
        const body = document.body;
        document.documentElement.dataset.scheme = data.colorScheme || 'dark';
        const unavailable = data.available === false;
        const state = unavailable ? 'normal' : (data.state || 'normal');
        body.classList.toggle('unavailable', unavailable);

        if (state === 'critical') { body.style.setProperty('--glow', '#ff4a24'); body.style.setProperty('--core', '#ffc2a8'); }
        else if (data.tint) { body.style.setProperty('--glow', data.tint); body.style.setProperty('--core', mix(data.tint, '#ffffff', 0.62)); }
        else { body.style.removeProperty('--glow'); body.style.removeProperty('--core'); }
        body.style.setProperty('--lamp', state === 'critical' ? '#ff4a24' : state === 'warning' ? '#ffb020' : '#7fe08a');

        let tokens = tokenize(unavailable ? '--' : (data.formatted || ''));
        if (unavailable) tokens = [{ type: 'digit', ch: null }, { type: 'digit', ch: null }];
        if (!tokens.some((t) => t.type === 'digit') && tokens.length === 0) tokens = [{ type: 'digit', ch: null }];
        const lamp = state !== 'normal' ? 'on' : (data.isCharging ? 'on' : null);

        const W = Math.max(20, document.documentElement.clientWidth || window.innerWidth);
        const key = JSON.stringify([tokens, lamp, W, state]);
        if (key !== this.key) {
            this.key = key;
            this.svg.setAttribute('width', W);
            this.svg.setAttribute('viewBox', `0 0 ${W} 22`);
            this.body.setAttribute('width', W - 1);
            this.draw(tokens, lamp, W);
        }
        this.blink(state === 'critical' && !data.reduceMotion && !matchMedia('(prefers-reduced-motion: reduce)').matches);
    }
}

// Blend two #RRGGBB colors: t = 0 gives a, 1 gives b.
function mix(a, b, t) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const c = (s) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
    return `rgb(${c(16)}, ${c(8)}, ${c(0)})`;
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new Meter());
} else {
    new Meter();
}
