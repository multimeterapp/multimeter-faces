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
        this.data = window.meterData || { level: 0.5, isCharging: false };
        this.percentEl = document.getElementById('percent');
        this.boltEl = document.querySelector('.bolt');
        this.fillEl = document.querySelector('.battery-fill');

        window.addEventListener('meterUpdate', (e) => {
            this.data = e.detail;
            this.render();
        });

        this.render();
        window.meterReady = true;
    }

    render() {
        const level = this.data.level || 0;
        const isCharging = this.data.isCharging || false;
        const percent = Math.round(level * 100);

        // Update percent text. Other sources show their own text (CPU "37%"),
        // and the little battery only appears for batteries.
        const source = this.data.source || 'battery';
        const isBattery = source === 'battery' || source === 'bluetooth';
        const text = this.data.available === false ? '\u2013' : (this.data.formatted || `${percent}%`);
        this.percentEl.textContent = isBattery && !this.data.formatted ? `${percent}%` : text;
        const icon = document.querySelector('.battery-icon');
        if (icon) icon.style.display = isBattery ? '' : 'none';
        if (this.fillEl) this.fillEl.style.background = tintFor(this.data);

        // Update classes for color
        this.percentEl.classList.remove('low', 'medium', 'charging');
        if (isCharging) {
            this.percentEl.classList.add('charging');
        } else if (alertState(this.data, level) === 'critical') {
            this.percentEl.classList.add('low');
        } else if (alertState(this.data, level) === 'warning') {
            this.percentEl.classList.add('medium');
        }

        // Battery glyph fill (inner width is 20px body - 3px border)
        if (this.fillEl) {
            this.fillEl.style.width = `${Math.max(0, Math.min(1, level)) * 15}px`;
        }

        // Show/hide charging bolt inside battery
        if (isCharging) {
            this.boltEl.classList.add('visible');
        } else {
            this.boltEl.classList.remove('visible');
        }
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new Meter());
} else {
    new Meter();
}
