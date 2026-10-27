// LCD Readout: the formatted value drawn as seven-segment digits, with the
// unit in small print, on an LCD whose backlight takes the meter's color.
//
// Segments:  aaa
//           f   b
//            ggg
//           e   c
//            ddd
const DIGITS = {
    '0': 'abcdef', '1': 'bc', '2': 'abged', '3': 'abgcd', '4': 'fgbc', '5': 'afgcd',
    '6': 'afgedc', '7': 'abc', '8': 'abcdefg', '9': 'abcdfg', '-': 'g', ' ': ''
};
const W = 6.2, H = 13, T = 1.35, SKEW = 0.12, GAP = 1.6;

function segmentPath(seg, x) {
    // Each segment as a hexagon-ish bar, then slanted like a real LCD.
    const h2 = H / 2, t2 = T / 2;
    const bars = {
        a: [[T, 0], [W - T, 0], [W - T - t2, T], [T + t2, T]],
        d: [[T + t2, H - T], [W - T - t2, H - T], [W - T, H], [T, H]],
        g: [[T, h2], [T + t2, h2 - t2], [W - T - t2, h2 - t2], [W - T, h2], [W - T - t2, h2 + t2], [T + t2, h2 + t2]],
        f: [[0, T * 0.6], [T, T + 0.2], [T, h2 - t2 - 0.3], [t2, h2 - 0.3], [0, h2 - t2 - 0.3]],
        b: [[W, T * 0.6], [W, h2 - t2 - 0.3], [W - t2, h2 - 0.3], [W - T, h2 - t2 - 0.3], [W - T, T + 0.2]],
        e: [[0, h2 + t2 + 0.3], [t2, h2 + 0.3], [T, h2 + t2 + 0.3], [T, H - T - 0.2], [0, H - T * 0.6]],
        c: [[W, h2 + t2 + 0.3], [W, H - T * 0.6], [W - T, H - T - 0.2], [W - T, h2 + t2 + 0.3], [W - t2, h2 + 0.3]]
    }[seg];
    return 'M' + bars.map(([px, py]) => `${(x + px + (H - py) * SKEW).toFixed(2)} ${py.toFixed(2)}`).join(' L') + ' Z';
}

// Blend two #RRGGBB colors: t = 0 gives a, 1 gives b.
function mix(a, b, t) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const ch = (p, s) => (p >> s) & 255;
    const c = (s) => Math.round(ch(pa, s) * (1 - t) + ch(pb, s) * t);
    return `rgb(${c(16)}, ${c(8)}, ${c(0)})`;
}

class Meter {
    constructor() {
        this.svg = document.getElementById('digits');
        this.unit = document.getElementById('unit');
        this.label = document.getElementById('label');
        this.flag = document.getElementById('flag');
        this.last = null;
        window.addEventListener('meterUpdate', (e) => this.render(e.detail));
        this.render(window.meterData || { formatted: '42%', level: 0.42, label: 'CPU' });
        window.meterReady = true;
    }

    // Split "1.2 MB/s" into the part drawn in segments ("1.2") and the unit ("MB/s").
    split(text) {
        const match = /^\s*(-?[\d.,:]+)\s*(.*)$/.exec(text || '');
        if (!match) return { number: '', unit: text || '' };
        return { number: match[1].replace(/,/g, ''), unit: match[2] };
    }

    drawNumber(number, minDigits) {
        const NS = 'http://www.w3.org/2000/svg';
        this.svg.innerHTML = '';
        const chars = number.split('');
        const digitCount = chars.filter((c) => c !== '.' && c !== ':').length;
        // Ghost digits in front, like an LCD that has room for more.
        for (let i = digitCount; i < minDigits; i++) chars.unshift(' ');
        let x = 0.5;
        const add = (d, on) => {
            const p = document.createElementNS(NS, 'path');
            p.setAttribute('d', d);
            p.setAttribute('class', on ? 'seg' : 'seg off');
            this.svg.appendChild(p);
        };
        for (const c of chars) {
            if (c === '.') {
                add(`M${(x - 0.4).toFixed(2)} ${H - 1.5} h1.5 v1.5 h-1.5 Z`, true);
                x += 1.5;
                continue;
            }
            if (c === ':') {
                add(`M${(x + 0.6).toFixed(2)} 3.4 h1.4 v1.4 h-1.4 Z`, true);
                add(`M${(x + 0.1).toFixed(2)} 8.4 h1.4 v1.4 h-1.4 Z`, true);
                x += 2.6;
                continue;
            }
            const lit = DIGITS[c] !== undefined ? DIGITS[c] : '';
            for (const seg of 'abcdefg') add(segmentPath(seg, x), lit.includes(seg));
            x += W + GAP;
        }
        const width = Math.max(1, x + H * SKEW - GAP + 0.5);
        this.svg.setAttribute('width', width.toFixed(1));
        this.svg.setAttribute('viewBox', `0 0 ${width.toFixed(1)} ${H}`);
    }

    render(data) {
        document.documentElement.dataset.scheme = data.colorScheme || 'dark';
        const body = document.body;
        body.classList.toggle('critical', data.state === 'critical');
        body.classList.toggle('reduce-motion', !!data.reduceMotion);

        // The backlight takes the meter's color; warnings tint it amber.
        let top = null;
        if (data.state === 'warning') top = '#f2d27a';
        else if (data.tint) top = data.tint;
        if (top) {
            body.style.setProperty('--backlight-top', mix(top, '#ffffff', 0.45));
            body.style.setProperty('--backlight-bottom', mix(top, '#8a8a8a', 0.25));
        } else {
            body.style.removeProperty('--backlight-top');
            body.style.removeProperty('--backlight-bottom');
        }

        this.label.textContent = data.label || '';
        this.label.style.display = data.label ? '' : 'none';
        this.flag.textContent = data.isCharging ? 'CHG' : '';

        const text = data.available === false ? '----' : (data.formatted || '');
        const { number, unit } = this.split(text);
        const key = number + '|' + unit;
        if (key !== this.last) {
            this.last = key;
            if (number) {
                this.drawNumber(number, 3);
                this.svg.style.display = '';
            } else {
                this.svg.style.display = 'none';
            }
            this.unit.textContent = unit;
            this.unit.style.fontSize = number ? '' : '8px';
            this.unit.style.marginBottom = number ? '' : '0';
            this.unit.style.alignSelf = number ? '' : 'center';
        }
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new Meter());
} else {
    new Meter();
}
