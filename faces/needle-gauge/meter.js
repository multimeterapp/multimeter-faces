// Needle Gauge: a tiny analog panel meter. The needle sweeps 120 degrees
// across the scale; alert levels are drawn as yellow and red zones.
const CX = 15, CY = 17.2, R = 11.6, SWEEP = 120;

function polar(fraction, radius) {
    // fraction 0 = left end of the scale, 1 = right end.
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

class Meter {
    constructor() {
        this.needle = document.getElementById('needle');
        this.fillArc = document.getElementById('fillArc');
        this.warnZone = document.getElementById('warnZone');
        this.critZone = document.getElementById('critZone');
        document.getElementById('track').setAttribute('d', arc(0, 1, R));

        const ticks = document.getElementById('ticks');
        for (let i = 0; i <= 10; i++) {
            const major = i % 5 === 0;
            const [x1, y1] = polar(i / 10, R + 1.3);
            const [x2, y2] = polar(i / 10, R - (major ? 2.4 : 1.4));
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', x1.toFixed(2)); line.setAttribute('y1', y1.toFixed(2));
            line.setAttribute('x2', x2.toFixed(2)); line.setAttribute('y2', y2.toFixed(2));
            line.setAttribute('class', major ? 'tick major' : 'tick');
            ticks.appendChild(line);
        }

        window.addEventListener('meterUpdate', (e) => this.render(e.detail));
        this.render(window.meterData || { level: 0.4, state: 'normal' });
        window.meterReady = true;
    }

    // The needle swings with a little overshoot. Stepped at 30 fps with a
    // timer rather than a CSS transition: in the menu bar a transition makes
    // it redraw at the display's full 120 Hz, which costs real energy.
    swing(target, instant) {
        clearTimeout(this.timer);
        const from = this.angle === undefined ? target : this.angle;
        const set = (a) => { this.angle = a; this.needle.style.transform = `rotate(${a.toFixed(2)}deg)`; };
        if (instant || Math.abs(target - from) < 0.5) { set(target); return; }
        const start = performance.now(), duration = 450;
        const easeOutBack = (t) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);
        const step = () => {
            const t = Math.min(1, (performance.now() - start) / duration);
            set(from + (target - from) * easeOutBack(t));
            if (t < 1) this.timer = setTimeout(step, 33);
        };
        step();
    }

    render(data) {
        const body = document.body;
        document.documentElement.dataset.scheme = data.colorScheme || 'dark';
        body.classList.toggle('reduce-motion', !!data.reduceMotion);
        body.classList.toggle('charging', !!data.isCharging);
        body.classList.toggle('critical', data.state === 'critical');
        body.classList.toggle('unavailable', data.available === false);

        const level = data.available === false ? 0 : Math.max(0, Math.min(1, data.level || 0));
        this.swing((level - 0.5) * SWEEP, !!data.reduceMotion || matchMedia('(prefers-reduced-motion: reduce)').matches);

        if (data.tint) body.style.setProperty('--accent', data.tint);
        else body.style.removeProperty('--accent');
        this.fillArc.setAttribute('d', data.tint ? arc(0, level, R) : '');

        // Zones: from the warning level to the critical level, then on to the end.
        const w = data.warningLevel, c = data.criticalLevel, below = data.alertDirection === 'below';
        let warn = '', crit = '';
        if (typeof c === 'number') crit = below ? arc(0, c, R) : arc(c, 1, R);
        if (typeof w === 'number') {
            const end = typeof c === 'number' ? c : (below ? 0 : 1);
            warn = below ? arc(end, w, R) : arc(w, end, R);
        }
        this.warnZone.setAttribute('d', warn);
        this.critZone.setAttribute('d', crit);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new Meter());
} else {
    new Meter();
}
