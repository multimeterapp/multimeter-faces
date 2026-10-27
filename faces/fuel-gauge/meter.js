// Fuel Gauge: a car dash gauge from E to F. It always shows how much is
// LEFT: battery charge as is, and for meters where high is bad (disk or
// memory in use, the day gone by) the room that's left. The pump lights
// amber for a warning and red when critical, like a low fuel lamp, and
// green while charging.
const CX = 18, CY = 19.5, R = 12.4, SWEEP = 116;

function polar(fraction, radius) {
    const angle = (-90 - SWEEP / 2 + fraction * SWEEP) * Math.PI / 180;
    return [CX + radius * Math.cos(angle), CY + radius * Math.sin(angle)];
}

function arc(from, to, radius) {
    from = Math.max(0, Math.min(1, from));
    to = Math.max(0, Math.min(1, to));
    if (to - from < 0.001) return '';
    const [x1, y1] = polar(from, radius);
    const [x2, y2] = polar(to, radius);
    return `M${x1.toFixed(2)} ${y1.toFixed(2)} A${radius} ${radius} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

// Sources whose level counts what's used up; the gauge shows the rest.
const USED_UP = ['disk', 'memory', 'progress', 'cpu'];

function fuelOf(data) {
    const level = Math.max(0, Math.min(1, Number(data.level) || 0));
    const inverted = data.alertDirection ? data.alertDirection === 'above' : USED_UP.includes(data.source);
    return { fuel: inverted ? 1 - level : level, inverted };
}

class Meter {
    constructor() {
        this.needle = document.getElementById('needle');
        this.reserve = document.getElementById('reserve');
        const ticks = document.getElementById('ticks');
        for (let i = 0; i <= 4; i++) {
            const major = i % 2 === 0;
            const [x1, y1] = polar(i / 4, R + 1.2);
            const [x2, y2] = polar(i / 4, R - (major ? 2.4 : 1.5));
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', x1.toFixed(2)); line.setAttribute('y1', y1.toFixed(2));
            line.setAttribute('x2', x2.toFixed(2)); line.setAttribute('y2', y2.toFixed(2));
            line.setAttribute('class', major ? 'tick major' : 'tick');
            ticks.appendChild(line);
        }
        window.addEventListener('meterUpdate', (e) => this.render(e.detail));
        this.render(window.meterData || { level: 0.6, state: 'normal', source: 'battery' });
        window.meterReady = true;
    }

    // Needle settles like a damped dash needle. 30 fps timer steps, not a
    // CSS transition (a transition redraws at 120 Hz in the menu bar).
    swing(target, instant) {
        clearTimeout(this.timer);
        const from = this.angle === undefined ? target : this.angle;
        const set = (a) => { this.angle = a; this.needle.style.transform = `rotate(${a.toFixed(2)}deg)`; };
        if (instant || Math.abs(target - from) < 0.5) { set(target); return; }
        const start = performance.now(), duration = 600;
        const ease = (t) => 1 - Math.pow(1 - t, 3);
        const step = () => {
            const t = Math.min(1, (performance.now() - start) / duration);
            set(from + (target - from) * ease(t));
            if (t < 1) this.timer = setTimeout(step, 33);
        };
        step();
    }

    render(data) {
        const body = document.body;
        document.documentElement.dataset.scheme = data.colorScheme || 'dark';
        const unavailable = data.available === false;
        const state = unavailable ? 'normal' : (data.state || 'normal');
        body.classList.toggle('unavailable', unavailable);

        const { fuel, inverted } = fuelOf(data);
        const shown = unavailable ? 0 : fuel;
        const reduce = !!data.reduceMotion || matchMedia('(prefers-reduced-motion: reduce)').matches;
        this.swing((shown - 0.5) * SWEEP, reduce);

        // Red reserve from E up to the critical level (in fuel terms).
        let c = typeof data.criticalLevel === 'number' ? data.criticalLevel : null;
        if (c !== null && inverted) c = 1 - c;
        this.reserve.setAttribute('d', arc(0, c !== null ? Math.min(0.5, c) : 0.12, R + 0.1));

        if (data.tint) body.style.setProperty('--needle', data.tint);
        else body.style.removeProperty('--needle');

        const lamp = state === 'critical' ? '#ff453a' : state === 'warning' ? '#ffb000' : data.isCharging ? '#34c759' : null;
        body.classList.toggle('lamp', !!lamp);
        if (lamp) body.style.setProperty('--lamp', lamp);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new Meter());
} else {
    new Meter();
}
