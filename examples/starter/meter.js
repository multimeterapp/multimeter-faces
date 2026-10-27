// Multimeter meter API, version 2. The app sets window.meterData and fires
// a 'meterUpdate' event whenever anything changes. The fields you'll use most:
//
//   level        0.0 to 1.0, the value within the meter's range
//   formatted    ready-to-show text with its unit: "23%", "1.2 MB/s", "4:12"
//   label        short label ("CPU"), may be "" if hidden
//   value, unit, min, max   the raw number and its range
//   state        "normal", "warning" or "critical"
//   tint         the color picked in Customize ("#30D158"), or null
//   history      up to 60 recent levels (0 to 1), oldest first, for graphs
//   source       what it measures: "battery", "cpu", "memory", "network", "timer"...
//   available    false when there's nothing to read (no battery, URL failing)
//   battery      the Mac's battery, always: level, isCharging, isPluggedIn,
//                hasBattery, timeRemaining, timeToFullCharge, health...
//   isCharging   true only when this meter shows the battery and it's charging
//   colorScheme  "light" or "dark"; reduceMotion  true if animations should stop
//
// Full reference: https://multimeterapp.com/creating-meters

class Meter {
    constructor() {
        this.label = document.getElementById('label');
        this.fill = document.getElementById('fill');
        this.value = document.getElementById('value');
        window.addEventListener('meterUpdate', (e) => this.render(e.detail));
        if (window.meterData) this.render(window.meterData);
        window.meterReady = true;
    }

    render(data) {
        const level = Math.max(0, Math.min(1, data.level || 0));
        this.label.textContent = data.label || '';
        this.label.style.display = data.label ? '' : 'none';
        this.value.textContent = data.available === false ? '\u2013' : (data.formatted || Math.round(level * 100) + '%');
        this.fill.style.width = (level * 100) + '%';

        document.body.classList.toggle('warning', data.state === 'warning');
        document.body.classList.toggle('critical', data.state === 'critical');
        if (data.tint) document.body.style.setProperty('--accent', data.tint);
        else document.body.style.removeProperty('--accent');
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new Meter());
} else {
    new Meter();
}
