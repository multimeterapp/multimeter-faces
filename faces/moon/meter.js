// Moon Phase: the level as the lit part of a moon, new (0) to full (1),
// waxing from the right. The terminator is softened; the outer edge stays
// crisp. Warnings turn it to a harvest moon, critical to a red moon. The
// value prints beside it when the meter is wide enough.
const CX = 10, CY = 10, R = 8.6;

// The lit region: the right half disc plus or minus a half ellipse whose
// width follows the phase.
function phasePath(f) {
    if (f <= 0.004) return '';
    if (f >= 0.996) return `M${CX} ${CY - R} A${R} ${R} 0 1 1 ${CX} ${CY + R} A${R} ${R} 0 1 1 ${CX} ${CY - R} Z`;
    const rx = Math.abs(1 - 2 * f) * R;
    const sweep = f > 0.5 ? 1 : 0;
    return `M${CX} ${CY - R} A${R} ${R} 0 0 1 ${CX} ${CY + R} A${rx.toFixed(3)} ${R} 0 0 ${sweep} ${CX} ${CY - R} Z`;
}

// Blend two #RRGGBB colors: t = 0 gives a, 1 gives b.
function mix(a, b, t) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const c = (s) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
    return `rgb(${c(16)}, ${c(8)}, ${c(0)})`;
}

class Meter {
    constructor() {
        this.lit = document.getElementById('lit');
        this.value = document.getElementById('value');
        window.addEventListener('meterUpdate', (e) => this.render(e.detail));
        window.addEventListener('resize', () => this.render(this.data || {}));
        this.render(window.meterData || { level: 0.63, formatted: '63%' });
        window.meterReady = true;
    }

    // 30 fps timer steps, only while the phase is moving (no CSS animation).
    wax(target, instant) {
        clearTimeout(this.timer);
        const from = this.phase === undefined ? target : this.phase;
        const set = (f) => { this.phase = f; this.lit.setAttribute('d', phasePath(f)); };
        if (instant || Math.abs(target - from) < 0.01) { set(target); return; }
        const start = performance.now(), duration = 500;
        const step = () => {
            const t = Math.min(1, (performance.now() - start) / duration);
            set(from + (target - from) * (1 - Math.pow(1 - t, 3)));
            if (t < 1) this.timer = setTimeout(step, 33);
        };
        step();
    }

    render(data) {
        this.data = data;
        const body = document.body;
        document.documentElement.dataset.scheme = data.colorScheme || 'dark';
        const unavailable = data.available === false;
        const state = unavailable ? 'normal' : (data.state || 'normal');
        body.classList.toggle('unavailable', unavailable);
        body.classList.toggle('charging', !!data.isCharging && !unavailable);

        const color = state === 'critical' ? '#ff6a4d' : state === 'warning' ? '#ffbf47' : data.tint || null;
        if (color) {
            body.style.setProperty('--lit-hi', mix(color, '#ffffff', 0.72));
            body.style.setProperty('--lit-lo', mix(color, '#ffffff', 0.3));
        } else {
            body.style.removeProperty('--lit-hi');
            body.style.removeProperty('--lit-lo');
        }

        const level = unavailable ? 0 : Math.max(0, Math.min(1, Number(data.level) || 0));
        this.wax(level, !!data.reduceMotion || matchMedia('(prefers-reduced-motion: reduce)').matches);

        const W = document.documentElement.clientWidth || window.innerWidth;
        const text = unavailable ? '–' : (data.formatted || '');
        const m = /^\s*(-?[\d.,:]+)\s*(\D*)$/.exec(text);
        this.value.textContent = m ? m[1] : text;
        if (m && m[2]) {
            const u = document.createElement('span');
            u.className = 'unit';
            u.textContent = m[2].replace('/s', '');
            this.value.appendChild(u);
        }
        // Moon only when narrow, or when the text would not fit.
        // Full size, then a step smaller, before giving up on the text.
        this.value.style.display = '';
        let fits = false;
        for (const size of [11, 9.5]) {
            this.value.style.fontSize = size + 'px';
            if (W >= 34 && 22 + this.value.getBoundingClientRect().width <= W + 0.5) { fits = true; break; }
        }
        this.value.style.display = fits ? '' : 'none';
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new Meter());
} else {
    new Meter();
}
