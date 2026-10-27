// Colors: the meter's tint, or the face's own green; yellow and red at alert levels.
function applyCommon(data) {
    document.documentElement.dataset.scheme = data.colorScheme || "dark";
    const body = document.body;
    if (data.tint) body.style.setProperty("--accent", data.tint);
    else body.style.removeProperty("--accent");
    body.dataset.state = data.available === false ? "unavailable" : (data.state || "normal");
    body.classList.toggle("reduce-motion", !!data.reduceMotion);
    body.classList.toggle("charging", !!data.isCharging);
}

// Eases a number toward a target at 30 fps. A CSS transition would make
// the menu bar redraw at the display's full 120 Hz for every update.
function tween(state, target, apply, instant) {
    clearTimeout(state.timer);
    const from = state.value === undefined ? target : state.value;
    const set = (v) => { state.value = v; apply(v); };
    if (instant || Math.abs(target - from) < 0.002) { set(target); return; }
    const start = performance.now(), duration = 380;
    const ease = (t) => 1 - Math.pow(1 - t, 3);
    const step = () => {
        const t = Math.min(1, (performance.now() - start) / duration);
        set(from + (target - from) * ease(t));
        if (t < 1) state.timer = setTimeout(step, 33);
    };
    step();
}

function prefersStill(data) {
    return !!data.reduceMotion || matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function boot(render) {
    window.addEventListener("meterUpdate", (e) => render(e.detail));
    render(window.meterData || { level: 0.42, formatted: "42%", label: "CPU", history: [] });
    window.meterReady = true;
}


// Ring: closes as the level rises; the number inside is the value without
// its unit (or the percentage when the value is long).
const arc = document.getElementById("arc");
const number = document.getElementById("number");
const CIRC = 2 * Math.PI * 8.2;
const arcState = {};
arc.style.strokeDasharray = `${CIRC}`;

boot((data) => {
    applyCommon(data);
    const level = data.available === false ? 0 : Math.max(0, Math.min(1, data.level || 0));
    tween(arcState, level, (v) => { arc.style.strokeDashoffset = `${CIRC * (1 - v)}`; }, prefersStill(data));
    arc.style.opacity = level <= 0.001 ? "0" : "1";
    const m = /^\s*(-?[\d.,]+)/.exec(data.formatted || "");
    let text = m ? m[1] : String(Math.round(level * 100));
    if (text.length > 3) text = String(Math.round(level * 100));
    if (data.available === false) text = "–";
    if (data.isCharging) text = "⚡︎";
    number.textContent = text;
    number.style.fontSize = text.length >= 3 ? "6.5px" : "";
});
