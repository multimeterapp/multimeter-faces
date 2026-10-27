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
        this.dotsContainer = document.getElementById('dots');
        this.numDots = 5;

        window.addEventListener('meterUpdate', (e) => {
            this.data = e.detail;
            this.render();
        });

        this.createDots();
        this.render();
        window.meterReady = true;
    }

    createDots() {
        this.dotsContainer.innerHTML = '';
        for (let i = 0; i < this.numDots; i++) {
            const dot = document.createElement('div');
            dot.className = 'dot';
            this.dotsContainer.appendChild(dot);
        }
    }

    render() {
        const level = this.data.level || 0;
        const isCharging = this.data.isCharging || false;

        // Calculate how many dots should be filled
        const filledDots = Math.ceil(level * this.numDots);

        const dots = this.dotsContainer.querySelectorAll('.dot');
        dots.forEach((dot, index) => {
            // Remove all state classes
            dot.classList.remove('filled', 'low', 'medium', 'charging');

            dot.style.background = '';
            if (index < filledDots) {
                dot.classList.add('filled');
                if (tintFor(this.data)) dot.style.background = tintFor(this.data);

                // Color based on overall level
                if (alertState(this.data, level) === 'critical') {
                    dot.classList.add('low');
                } else if (alertState(this.data, level) === 'warning') {
                    dot.classList.add('medium');
                }

                // Add charging animation to the last filled dot
                if (isCharging && index === filledDots - 1) {
                    dot.classList.add('charging');
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
