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
        this.batteryEl = document.getElementById('battery');
        this.segments = document.querySelectorAll('.segment');
        this.numSegments = 5;

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

        // Calculate how many segments to fill
        const filledSegments = Math.ceil(level * this.numSegments);

        // Determine color class based on level
        let colorClass = '';
        if (isCharging) {
            colorClass = 'charging';
        } else if (alertState(this.data, level) === 'critical') {
            colorClass = 'low';
        } else if (alertState(this.data, level) === 'warning') {
            colorClass = 'medium';
        }

        // Update battery charging class
        this.batteryEl.classList.toggle('charging', isCharging);

        // Update each segment
        this.segments.forEach((segment, index) => {
            segment.classList.remove('filled', 'low', 'medium', 'charging');

            segment.style.background = '';
            if (index < filledSegments) {
                segment.classList.add('filled');
                if (tintFor(this.data)) segment.style.background = tintFor(this.data);
                if (colorClass) {
                    segment.classList.add(colorClass);
                }
            }
        });
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new Meter());
} else {
    new Meter();
}
