// Split-Flap: the formatted value on flip cards, like a station departures
// board. Digits, "%" and one-letter units ("3d 4h") get cards of their own;
// longer units ("MB/s") are printed small beside the cards. When a card
// changes it shows one quick mid-flip frame (skipped when motion is reduced).
const FLIP_MS = 90;

// Same reading of the text as the Nixie face: a comma or point followed by
// exactly three digits is a thousands separator and is dropped.
function tokenize(text) {
    const out = [];
    const chars = Array.from(text || '');
    let word = '';
    const flush = () => {
        const w = word.trim();
        word = '';
        if (!w) return;
        for (const part of w.split(/\s+/)) {
            if (part.length <= 1 || part === '%') out.push({ type: 'card', ch: part, letter: true });
            else out.push({ type: 'caption', text: part });
        }
    };
    for (let i = 0; i < chars.length; i++) {
        const c = chars[i];
        if (/[0-9]/.test(c)) { flush(); out.push({ type: 'card', ch: c }); continue; }
        if ((c === '.' || c === ',') && /[0-9]/.test(chars[i - 1] || '') && /[0-9]/.test(chars[i + 1] || '')) {
            const run = /^[0-9]+/.exec(chars.slice(i + 1).join(''))[0];
            if (run.length !== 3) out.push({ type: 'sep', ch: c });
            continue;
        }
        if (c === ':' && /[0-9]/.test(chars[i - 1] || '')) { flush(); out.push({ type: 'sep', ch: ':' }); continue; }
        if ((c === '-' || c === '−') && /[0-9]/.test(chars[i + 1] || '')) { flush(); out.push({ type: 'card', ch: '-' }); continue; }
        word += c;
    }
    flush();
    return out;
}

class Meter {
    constructor() {
        this.board = document.getElementById('board');
        this.shown = [];
        this.key = null;
        window.addEventListener('meterUpdate', (e) => this.render(e.detail));
        window.addEventListener('resize', () => { this.key = null; this.render(this.data || {}); });
        this.render(window.meterData || { formatted: '63%', level: 0.63 });
        window.meterReady = true;
    }

    // Text with no digits at all ("Fair", "Serious"): every letter on a card
    // when it fits, otherwise printed small.
    wordsToCards(tokens, W) {
        if (tokens.some((t) => t.type === 'card' && !t.letter)) return tokens;
        const text = tokens.map((t) => t.ch || t.text).join(' ');
        const letters = Array.from(text.toUpperCase());
        if (letters.length * 7 + 6 <= W) return letters.map((ch) => ({ type: 'card', ch: ch === ' ' ? '' : ch, letter: true }));
        return [{ type: 'caption', text }];
    }

    layout(tokens, W) {
        const cards = tokens.filter((t) => t.type === 'card').length;
        const seps = tokens.filter((t) => t.type === 'sep').length;
        const captions = tokens.filter((t) => t.type === 'caption').map((t) => t.text.length * 4.4 + 2).reduce((a, b) => a + b, 0);
        // Card width 9 when there's room, down to 6; the type follows.
        let cw = 9;
        while (cw > 6 && 6 + cards * (cw + 1) + seps * 4 + captions > W) cw -= 0.5;
        document.body.style.setProperty('--cw', cw + 'px');
        document.body.style.setProperty('--fs', Math.round(cw * 1.3) + 'px');
    }

    render(data) {
        this.data = data;
        const body = document.body;
        document.documentElement.dataset.scheme = data.colorScheme || 'dark';
        const unavailable = data.available === false;
        const state = unavailable ? 'normal' : (data.state || 'normal');
        body.classList.toggle('unavailable', unavailable);
        const ink = state === 'critical' ? '#ff6b5c' : state === 'warning' ? '#ffcf3f' : data.tint ? mix(data.tint, '#ffffff', 0.35) : null;
        if (ink) body.style.setProperty('--ink', ink); else body.style.removeProperty('--ink');

        const W = Math.max(20, document.documentElement.clientWidth || window.innerWidth);
        let tokens = unavailable ? [{ type: 'card', ch: '-' }, { type: 'card', ch: '-' }] : tokenize(data.formatted || '');
        tokens = this.wordsToCards(tokens, W);
        if (!tokens.length) tokens = [{ type: 'card', ch: '' }];

        const key = JSON.stringify([tokens, W]);
        if (key === this.key) return;
        this.key = key;
        this.layout(tokens, W);

        const animate = !data.reduceMotion && !matchMedia('(prefers-reduced-motion: reduce)').matches;
        const before = this.shown;
        const flipping = [];
        this.board.textContent = '';
        tokens.forEach((t, i) => {
            const node = document.createElement('div');
            if (t.type === 'card') {
                node.className = 'card' + (t.letter && /[A-Za-z%]/.test(t.ch) ? ' letter' : '') + (t.ch ? '' : ' blank');
                const ch = document.createElement('span');
                ch.textContent = t.ch || '0';
                node.appendChild(ch);
                const old = before[i];
                if (animate && old !== undefined && old !== t.ch) flipping.push(node);
            } else if (t.type === 'sep') {
                node.className = 'sep';
                node.textContent = t.ch;
            } else {
                node.className = 'caption';
                node.textContent = t.text;
            }
            this.board.appendChild(node);
        });
        this.shown = tokens.map((t) => t.ch);
        // Still too wide at the smallest cards: the printed unit goes first.
        if (this.board.scrollWidth > this.board.clientWidth + 0.5) {
            this.board.querySelectorAll('.caption').forEach((n) => n.remove());
        }

        // One frame mid-flip, then settle. Two renders, no running animation.
        clearTimeout(this.flipTimer);
        if (flipping.length) {
            flipping.forEach((n) => n.classList.add('flip'));
            this.flipTimer = setTimeout(() => flipping.forEach((n) => n.classList.remove('flip')), FLIP_MS);
        }
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
