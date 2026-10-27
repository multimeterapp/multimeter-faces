// Oscilloscope: the meter's history as a phosphor trace on a little CRT with
// a graticule. The trace runs left to right like a sweep, newest sample at
// the beam; older samples fade like phosphor persistence. Wide meters also
// show the reading in the corner, the way bench scopes print measurements.
const NS = 'http://www.w3.org/2000/svg';
const SLOTS = 60;          // history holds up to 60 samples
const TOP = 3.6, BOTTOM = 18.4;

function line(parent, x1, y1, x2, y2, cls) {
    const l = document.createElementNS(NS, 'line');
    l.setAttribute('x1', x1); l.setAttribute('y1', y1);
    l.setAttribute('x2', x2); l.setAttribute('y2', y2);
    l.setAttribute('class', cls);
    parent.appendChild(l);
}

class Meter {
    constructor() {
        this.svg = document.getElementById('scope');
        this.grid = document.getElementById('grid');
        this.trace = document.getElementById('trace');
        this.halo = document.getElementById('halo');
        this.beam = document.getElementById('beam');
        this.beamHalo = document.getElementById('beamHalo');
        this.readout = document.getElementById('readout');
        this.width = '';
        window.addEventListener('meterUpdate', (e) => this.render(e.detail));
        window.addEventListener('resize', () => { this.width = ''; this.render(this.data || {}); });
        this.render(window.meterData || { level: 0.4, history: [], formatted: '40%' });
        window.meterReady = true;
    }

    // Bezel, screen and graticule only change with the meter's width and
    // the room the readout takes. SW = screen's right edge.
    frame(W, SW) {
        const key = W + '|' + SW;
        if (key === this.width) return;
        this.width = key;
        this.svg.setAttribute('width', W);
        this.svg.setAttribute('viewBox', `0 0 ${W} 22`);
        document.getElementById('bezel').setAttribute('width', W - 1);
        for (const id of ['glass', 'clipRect', 'shine']) document.getElementById(id).setAttribute('width', SW - 1.2);
        document.querySelector('#persist').setAttribute('x2', SW);

        this.grid.textContent = '';
        const left = 1.2, right = SW, mid = 11;
        // Vertical divisions about every 8 px, centred.
        const divs = Math.max(2, Math.round((right - left) / 8));
        const dx = (right - left) / divs;
        for (let i = 1; i < divs; i++) {
            const x = (left + i * dx).toFixed(1);
            line(this.grid, x, 1.7, x, 20.3, 'grid');
        }
        // Horizontal: the centre axis plus a quarter line above and below.
        for (const y of [TOP + (BOTTOM - TOP) * 0.25, BOTTOM - (BOTTOM - TOP) * 0.25]) line(this.grid, left, y.toFixed(1), right, y.toFixed(1), 'grid');
        line(this.grid, left, mid, right, mid, 'grid axis');
        // Minor ticks along the centre axis.
        for (let x = left + dx / 4; x < right; x += dx / 4) line(this.grid, x.toFixed(1), mid - 0.9, x.toFixed(1), mid + 0.9, 'grid minor');
    }

    render(data) {
        this.data = data;
        const body = document.body;
        document.documentElement.dataset.scheme = data.colorScheme || 'dark';
        const unavailable = data.available === false;
        const state = unavailable ? 'normal' : (data.state || 'normal');
        body.classList.toggle('unavailable', unavailable);
        const phosphor = state === 'critical' ? '#ff5a4a' : state === 'warning' ? '#ffcc33' : data.tint || null;
        if (phosphor) {
            body.style.setProperty('--phosphor', phosphor);
            body.style.setProperty('--core', mix(phosphor, '#ffffff', 0.7));
        } else {
            body.style.removeProperty('--phosphor');
            body.style.removeProperty('--core');
        }

        const W = Math.max(30, document.documentElement.clientWidth || window.innerWidth);

        // The reading sits on the bezel to the right of the screen, like a
        // scope's measurement panel, when the meter is wide enough.
        const text = unavailable ? '\u2013' : (data.formatted || '');
        let m = /^\s*(-?[\d.,:]+)\s*(.*)$/.exec(text);
        if (m && /\d/.test(m[2])) m = null; // "3d 4h": keep it whole
        this.readout.textContent = '';
        let SW = W - 1.2;
        if (W >= 52 && text) {
            const num = document.createElementNS(NS, 'tspan');
            num.textContent = m ? m[1] : text;
            this.readout.appendChild(num);
            if (m && m[2]) {
                const u = document.createElementNS(NS, 'tspan');
                u.setAttribute('class', 'unit');
                u.setAttribute('dx', '1');
                u.textContent = m[2].replace('/s', '');
                this.readout.appendChild(u);
            }
            this.readout.setAttribute('x', (W - 3).toFixed(1));
            const tw = this.readout.getComputedTextLength() + 1;
            // Keep at least 30 px of screen; past that the readout gives way.
            if (W - tw - 6 >= 30) SW = W - tw - 5.5;
            else this.readout.textContent = '';
        }
        this.frame(W, SW);

        let points = (data.history || []).slice(-SLOTS).map((v) => Math.max(0, Math.min(1, Number(v) || 0)));
        if (!points.length) points = [Math.max(0, Math.min(1, Number(data.level) || 0))];
        // Fixed spacing: a young meter's trace stops partway, like a sweep.
        const left = 2, right = SW - 1.2;
        const step = (right - left) / (Math.min(SLOTS, Math.max(30, points.length)) - 1);
        const xy = points.map((v, i) => [left + i * step, BOTTOM - v * (BOTTOM - TOP)]);
        if (xy.length === 1) xy.unshift([left, xy[0][1]]);
        const d = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`).join(' ');
        this.trace.setAttribute('d', d);
        this.halo.setAttribute('d', d);
        const [bx, by] = xy[xy.length - 1];
        for (const c of [this.beam, this.beamHalo]) { c.setAttribute('cx', bx.toFixed(2)); c.setAttribute('cy', by.toFixed(2)); }
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
