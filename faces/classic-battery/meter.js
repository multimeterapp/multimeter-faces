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
        this.fill = document.getElementById('fill');
        this.bolt = document.getElementById('bolt');

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

        // Update fill width
        const fillPercent = Math.max(0, Math.min(100, level * 100));
        this.fill.style.width = `${fillPercent}%`;

        // Update fill color based on level
        this.fill.classList.remove('low', 'medium', 'charging');
        if (isCharging) {
            this.fill.classList.add('charging');
        } else if (alertState(this.data, level) === 'critical') {
            this.fill.classList.add('low');
        } else if (alertState(this.data, level) === 'warning') {
            this.fill.classList.add('medium');
        }

        // Your color from Customize
        const gradient = this.fill.querySelector('.fill-gradient');
        if (gradient) gradient.style.background = tintFor(this.data);

        // Show/hide charging bolt
        if (isCharging) {
            this.bolt.classList.add('charging');
        } else {
            this.bolt.classList.remove('charging');
        }
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new Meter());
} else {
    new Meter();
}
