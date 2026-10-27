// 8-bit pixel art heart pattern (13x12 pixels)
// 0 = transparent, 1 = dark red outline, 2 = red fill, 3 = pink highlight
const HEART_FULL = [
    [0,0,1,1,0,0,0,1,1,0,0,0,0],
    [0,1,2,2,1,0,1,2,2,1,0,0,0],
    [1,2,3,2,2,1,2,2,2,2,1,0,0],
    [1,2,2,2,2,2,2,2,2,2,1,0,0],
    [1,2,2,2,2,2,2,2,2,2,1,0,0],
    [0,1,2,2,2,2,2,2,2,1,0,0,0],
    [0,0,1,2,2,2,2,2,1,0,0,0,0],
    [0,0,0,1,2,2,2,1,0,0,0,0,0],
    [0,0,0,0,1,2,1,0,0,0,0,0,0],
    [0,0,0,0,0,1,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0]
];

const HEART_EMPTY = [
    [0,0,1,1,0,0,0,1,1,0,0,0,0],
    [0,1,0,0,1,0,1,0,0,1,0,0,0],
    [1,0,0,0,0,1,0,0,0,0,1,0,0],
    [1,0,0,0,0,0,0,0,0,0,1,0,0],
    [1,0,0,0,0,0,0,0,0,0,1,0,0],
    [0,1,0,0,0,0,0,0,0,1,0,0,0],
    [0,0,1,0,0,0,0,0,1,0,0,0,0],
    [0,0,0,1,0,0,0,1,0,0,0,0,0],
    [0,0,0,0,1,0,1,0,0,0,0,0,0],
    [0,0,0,0,0,1,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0]
];

// Half heart (left half filled)
const HEART_HALF = [
    [0,0,1,1,0,0,0,1,1,0,0,0,0],
    [0,1,2,2,1,0,1,0,0,1,0,0,0],
    [1,2,3,2,2,1,0,0,0,0,1,0,0],
    [1,2,2,2,2,1,0,0,0,0,1,0,0],
    [1,2,2,2,2,1,0,0,0,0,1,0,0],
    [0,1,2,2,2,1,0,0,0,1,0,0,0],
    [0,0,1,2,2,1,0,0,1,0,0,0,0],
    [0,0,0,1,2,1,0,1,0,0,0,0,0],
    [0,0,0,0,1,1,1,0,0,0,0,0,0],
    [0,0,0,0,0,1,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0]
];

const COLORS = {
    0: 'transparent',
    1: '#4a0000',  // Dark red outline
    2: '#e31b23',  // Red fill
    3: '#ff6b6b'   // Pink highlight
};

// Meter API v2 sends the alert state from the meter's own settings; data from
// older versions of the app falls back to the classic battery levels.
function alertState(data, level) {
    if (data && data.state) return data.state;
    return level < 0.1 ? 'critical' : level < 0.2 ? 'warning' : 'normal';
}

// The meter's color from Customize, used only while nothing needs attention.
function tintFor(data) {
    return data && data.tint && (data.state || 'normal') === 'normal' && !data.isCharging ? data.tint : '';
}

class Meter {
    constructor() {
        this.data = window.meterData || { level: 0.8, isCharging: false };
        this.heartsContainer = document.getElementById('hearts');
        this.numHearts = 5;
        this.canvases = [];

        window.addEventListener('meterUpdate', (e) => {
            this.data = e.detail;
            this.render();
        });

        this.createHearts();
        this.render();
        window.meterReady = true;
    }

    createHearts() {
        this.heartsContainer.innerHTML = '';
        this.canvases = [];

        for (let i = 0; i < this.numHearts; i++) {
            const heartDiv = document.createElement('div');
            heartDiv.className = 'heart';

            const canvas = document.createElement('canvas');
            canvas.width = 13;
            canvas.height = 12;
            heartDiv.appendChild(canvas);

            this.heartsContainer.appendChild(heartDiv);
            this.canvases.push({ canvas, div: heartDiv });
        }
    }

    drawHeart(canvas, pattern) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, 13, 12);

        for (let y = 0; y < pattern.length; y++) {
            for (let x = 0; x < pattern[y].length; x++) {
                const colorIndex = pattern[y][x];
                if (colorIndex !== 0) {
                    ctx.fillStyle = COLORS[colorIndex];
                    ctx.fillRect(x, y, 1, 1);
                }
            }
        }
    }

    render() {
        const level = this.data.level || 0;
        const isCharging = this.data.isCharging || false;

        // Calculate fill - each heart = 20%, support half hearts
        const totalHalves = level * this.numHearts * 2;

        // Low health: the first heart blinks while the meter is critical.
        document.body.classList.toggle('critical', alertState(this.data, level) === 'critical');
        document.body.classList.toggle('reduce-motion', !!this.data.reduceMotion);

        this.canvases.forEach(({ canvas, div }, index) => {
            div.classList.remove('charging');

            const heartStart = index * 2;
            const halvesInThisHeart = Math.max(0, Math.min(2, totalHalves - heartStart));

            if (halvesInThisHeart <= 0) {
                this.drawHeart(canvas, HEART_EMPTY);
            } else if (halvesInThisHeart < 2) {
                this.drawHeart(canvas, HEART_HALF);
            } else {
                this.drawHeart(canvas, HEART_FULL);
            }

            // Charging animation on partially filled heart
            if (isCharging && halvesInThisHeart > 0 && halvesInThisHeart < 2) {
                div.classList.add('charging');
            }
        });
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new Meter());
} else {
    new Meter();
}
