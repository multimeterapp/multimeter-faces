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
        this.data = window.meterData || { level: 0.5, timeRemaining: null, isCharging: false };
        this.timeEl = document.getElementById('time');
        this.suffixEl = document.getElementById('suffix');
        this.fillEl = document.getElementById('fill');
        this.boltEl = document.getElementById('bolt');

        window.addEventListener('meterUpdate', (e) => {
            this.data = e.detail;
            this.render();
        });

        this.render();
        window.meterReady = true;
    }

    formatTime(minutes) {
        if (minutes === null || minutes === undefined || minutes < 0) {
            return '\u2013:\u2013\u2013';
        }
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours}:${mins.toString().padStart(2, '0')}`;
    }

    render() {
        const level = this.data.level || 0;
        const isCharging = this.data.isCharging || false;
        const timeRemaining = this.data.timeRemaining;
        const timeToFullCharge = this.data.timeToFullCharge;

        // Update time display. Everything has to fit the 80px status item, so
        // charging shows just the time plus the bolt (no "until full"), and a
        // Mac that's plugged in but not charging shows its percentage instead
        // of a meaningless "0:00 left".
        const isPluggedIn = this.data.isPluggedIn || false;
        const source = this.data.source || 'battery';
        if (source !== 'battery') {
            // Timers and countdowns: their own time text, the bar runs down.
            this.timeEl.textContent = this.data.available === false ? '\u2013:\u2013\u2013' : (this.data.formatted || '');
            this.suffixEl.textContent = '';
        } else if (isCharging && timeToFullCharge !== null && timeToFullCharge !== undefined && timeToFullCharge > 0) {
            this.timeEl.textContent = this.formatTime(timeToFullCharge);
            this.suffixEl.textContent = '';
        } else if (!isCharging && isPluggedIn) {
            this.timeEl.textContent = `${Math.round(level * 100)}%`;
            this.suffixEl.textContent = '';
        } else if (!isCharging && timeRemaining !== null && timeRemaining !== undefined && timeRemaining > 0) {
            this.timeEl.textContent = this.formatTime(timeRemaining);
            // The app sends the word translated (data.strings.timeLeft); it may
            // be empty in languages without a short word for it.
            const strings = this.data.strings || {};
            this.suffixEl.textContent = typeof strings.timeLeft === 'string' ? strings.timeLeft : 'left';
        } else {
            // macOS is still estimating
            this.timeEl.textContent = '\u2013:\u2013\u2013';
            this.suffixEl.textContent = '';
        }
        this.suffixEl.style.display = this.suffixEl.textContent ? '' : 'none';

        // Update progress bar
        this.fillEl.style.width = `${level * 100}%`;
        this.fillEl.style.background = tintFor(this.data);
        const state = alertState(this.data, source === 'battery' ? level : 1);
        this.fillEl.classList.toggle('low', state === 'critical');
        this.fillEl.classList.toggle('medium', state === 'warning');

        // Update charging state
        if (isCharging) {
            this.fillEl.classList.add('charging');
            this.boltEl.classList.add('visible');
        } else {
            this.fillEl.classList.remove('charging');
            this.boltEl.classList.remove('visible');
        }
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new Meter());
} else {
    new Meter();
}
