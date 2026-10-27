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
        this.data = window.meterData || { level: 0.7, isCharging: false };
        this.blade = document.getElementById('blade');

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

        // Update blade length
        this.blade.style.width = `${level * 100}%`;

        // Update color based on level
        this.blade.classList.remove('low', 'medium', 'charging');

        if (alertState(this.data, level) === 'critical') {
            this.blade.classList.add('low');
        } else if (alertState(this.data, level) === 'warning') {
            this.blade.classList.add('medium');
        }

        if (isCharging) {
            this.blade.classList.add('charging');
        }
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new Meter());
} else {
    new Meter();
}
