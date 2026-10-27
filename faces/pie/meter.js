// Scheme, tint and state on <body>; faces style themselves from these.
function applyCommon(data) {
    document.documentElement.dataset.scheme = data.colorScheme || "dark";
    const body = document.body;
    if (data.tint) body.style.setProperty("--accent", data.tint);
    else body.style.removeProperty("--accent");
    body.classList.toggle("tinted", !!data.tint);
    body.dataset.state = data.available === false ? "unavailable" : (data.state || "normal");
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

function clampLevel(data) {
    return data.available === false ? 0 : Math.max(0, Math.min(1, Number(data.level) || 0));
}

// "1.2 MB/s" -> ["1.2", "MB/s"]; "Fair" -> ["Fair", ""].
function splitUnit(text) {
    const m = /^\s*(-?[\d.,:]+)\s*(.*)$/.exec(text || "");
    return m ? [m[1], m[2]] : [text || "", ""];
}

function boot(render) {
    let last = window.meterData || { level: 0.42, formatted: "42%", label: "CPU", history: [] };
    window.addEventListener("meterUpdate", (e) => { last = e.detail; render(last); });
    // Width changes from Customize arrive without new data; lay out again.
    window.addEventListener("resize", () => render(last));
    render(last);
    window.meterReady = true;
}

// Width of text in an element's font, without laying it out (centered rows
// that overflow hide their overflow from scrollWidth).
const measureCtx = document.createElement("canvas").getContext("2d");
function textWidth(text, el, size) {
    const cs = getComputedStyle(el);
    measureCtx.font = `${cs.fontWeight} ${size || cs.fontSize} ${cs.fontFamily}`;
    return Math.ceil(measureCtx.measureText(text).width) + 2;
}

// The first candidate text that fits in room px. By default each font size
// is tried with every candidate before going smaller; textFirst keeps the
// fuller text at a smaller size instead (units matter more than size there).
function fitText(el, candidates, room, sizes, textFirst) {
    const list = [...new Set(candidates.filter(Boolean))];
    const pairs = [];
    if (textFirst) for (const text of list) for (const size of sizes) pairs.push([text, size]);
    else for (const size of sizes) for (const text of list) pairs.push([text, size]);
    for (const [text, size] of pairs) if (textWidth(text, el, size) <= room) return { text, size, fits: true };
    return { text: list[list.length - 1] || "", size: sizes[sizes.length - 1], fits: false };
}

// "1.2 MB/s" -> ["1.2 MB/s", "1.2 MB", "1.2"]: what to try when space is short.
function shorterForms(text) {
    const [num, unit] = splitUnit(text);
    return [text, unit.includes("/") ? `${num} ${unit.replace(/\/.*$/, "")}` : "", num];
}


// Pie: a wedge from 12 o'clock, clockwise, sized by the level. No number,
// so it reads at a glance even at 16 px.
const wedge = document.getElementById("wedge");
const wedgeState = {};
const R = 5.25;

function wedgePath(v) {
    if (v <= 0.004) return "";
    if (v >= 0.996) return `M8 ${8 - R} A${R} ${R} 0 1 1 7.999 ${8 - R} Z`;
    const a = v * Math.PI * 2;
    const x = 8 + R * Math.sin(a), y = 8 - R * Math.cos(a);
    return `M8 8 L8 ${8 - R} A${R} ${R} 0 ${v > 0.5 ? 1 : 0} 1 ${x.toFixed(3)} ${y.toFixed(3)} Z`;
}

boot((data) => {
    applyCommon(data);
    const level = clampLevel(data);
    // A sliver under 4% would vanish at 1x; keep a visible minimum.
    const shown = level > 0 ? Math.max(level, 0.04) : 0;
    tween(wedgeState, shown, (v) => { wedge.setAttribute("d", wedgePath(v)); }, prefersStill(data));
    document.title = data.formatted || "";
});
