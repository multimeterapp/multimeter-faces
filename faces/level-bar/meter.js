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


// Level Bar: label, a bar that fills with the level, then the value.
const label = document.getElementById("label");
const fill = document.getElementById("fill");
const value = document.getElementById("value");
const fillState = {};

boot((data) => {
    applyCommon(data);
    label.textContent = data.label || "";
    label.style.display = data.label ? "" : "none";
    const level = data.available === false ? 0 : Math.max(0, Math.min(1, data.level || 0));
    tween(fillState, Math.max(level > 0 ? 0.08 : 0, level), (v) => { fill.style.width = `${v * 100}%`; }, prefersStill(data));
    value.textContent = data.available === false ? "–" : (data.formatted || `${Math.round(level * 100)}%`);
    // Long values (1.2 MB/s) squeeze the bar first, then drop the label.
    label.style.display = data.label && document.body.scrollWidth <= document.body.clientWidth ? "" : "none";
    if (data.label && label.style.display === "none") label.style.display = "";
    const meter = document.getElementById("meter");
    if (meter.scrollWidth > meter.clientWidth) label.style.display = "none";
});
