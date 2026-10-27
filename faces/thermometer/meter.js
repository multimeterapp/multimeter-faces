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

// Value beside a graphic: the number, then its unit smaller and dimmer.
// Returns the width it needs (0 when it is hidden for lack of room).
function renderValue(el, data, room) {
    el.textContent = "";
    if (room < 14) { el.style.display = "none"; return 0; }
    el.style.display = "";
    const text = data.available === false ? "–" : (data.formatted || `${Math.round(clampLevel(data) * 100)}%`);
    let [num, unit] = splitUnit(text);
    unit = unit.replace(/\/.*$/, "");
    if (!/\d/.test(num)) { num = text; unit = ""; }
    const n = document.createElement("span");
    n.className = "num";
    n.textContent = num;
    el.appendChild(n);
    let numW = textWidth(num, el, "10.5px");
    // Long numbers (12:05, 3:12:40) step down a size before they would hide.
    if (numW > room && textWidth(num, el, "9px") <= room) {
        n.style.fontSize = "9px";
        numW = textWidth(num, el, "9px");
    }
    const unitW = unit ? textWidth(unit, el, "7.5px") + 1 : 0;
    if (unit && numW + unitW <= room) {
        const u = document.createElement("span");
        u.className = "unit";
        u.textContent = unit;
        el.appendChild(u);
    }
    if (data.isCharging) {
        const b = document.createElement("span");
        b.className = "bolt";
        b.textContent = "⚡︎";
        el.appendChild(b);
    }
    if (numW > room) { el.style.display = "none"; return 0; }
    return el.getBoundingClientRect().width;
}

// "#0a84ff" or "rgb(10, 132, 255)" -> [10, 132, 255].
function rgbOf(color) {
    const c = (color || "").trim();
    if (c[0] === "#") {
        const h = c.length === 4 ? c.slice(1).split("").map((x) => x + x).join("") : c.slice(1, 7);
        return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
    }
    const m = /(\d+(?:\.\d+)?)\D+(\d+(?:\.\d+)?)\D+(\d+(?:\.\d+)?)/.exec(c);
    return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [128, 128, 128];
}

function cssVar(name) {
    return getComputedStyle(document.body).getPropertyValue(name).trim();
}

// normal / warning / critical for one history sample, from the meter's thresholds.
function sampleState(data, v) {
    const w = data.warningLevel, c = data.criticalLevel;
    const below = data.alertDirection === "below";
    const past = (t) => t !== null && t !== undefined && (below ? v <= t : v >= t);
    if (past(c)) return "critical";
    if (past(w)) return "warning";
    return "normal";
}


// Thermometer: the mercury runs from the bulb along the tube. Its color moves
// from a cool blue through violet to a warm coral as the reading gets worse:
// rising values for CPU, power, thermal and the like, falling values for
// low-is-bad sources (battery, Bluetooth, timers), so a full battery reads
// cool, not hot. Yellow and red at alert levels; the tint replaces the
// cool-to-hot color.
const svg = document.getElementById("thermo");
const glass = document.getElementById("glass");
const mercury = document.getElementById("mercury");
const valueEl = document.getElementById("value");
const mercuryState = {};
const BX = 5.5, BY = 11;
let builtLen = 0;

function shape(len) {
    // Glass: bulb radius 5 joined to a tube 7 tall, rounded at the far end.
    // Edges sit on half pixels so the 1 px outline stays crisp at 1x.
    const end = len - 0.5;
    const jx = (BX + Math.sqrt(25 - 3.5 * 3.5)).toFixed(3);
    glass.setAttribute("d", `M${jx} 7.5 L${end - 3.5} 7.5 A3.5 3.5 0 0 1 ${end - 3.5} 14.5 L${jx} 14.5 A5 5 0 1 1 ${jx} 7.5 Z`);
    builtLen = len;
}

function mercuryPath(v, len) {
    const jx = BX + Math.sqrt(3.25 * 3.25 - 1.5 * 1.5);
    const tip = jx + v * (len - 0.5 - 3 - jx);
    return `M${jx.toFixed(3)} 9.5 L${tip.toFixed(2)} 9.5 A1.5 1.5 0 0 1 ${tip.toFixed(2)} 12.5 L${jx.toFixed(3)} 12.5 A3.25 3.25 0 1 1 ${jx.toFixed(3)} 9.5 Z`;
}

function coolToHot(v, light) {
    const hue = 200 + v * (370 - 200);
    return `hsl(${(hue % 360).toFixed(0)}, ${light ? 78 : 92}%, ${light ? 52 : 63}%)`;
}

const LOW_IS_BAD = ["battery", "bluetooth", "timer", "countdown"];
function heatOf(data, level) {
    const below = data.alertDirection ? data.alertDirection === "below" : LOW_IS_BAD.includes(data.source);
    return below ? 1 - level : level;
}

boot((data) => {
    applyCommon(data);
    const total = document.body.clientWidth - 2;
    const used = renderValue(valueEl, data, total >= 44 ? total - 24 : 0);
    const len = Math.max(22, Math.floor(total - (used ? used + 4 : 0)));
    svg.setAttribute("width", len);
    svg.setAttribute("viewBox", `0 0 ${len} 22`);
    if (len !== builtLen) shape(len);
    const level = clampLevel(data);
    const light = data.colorScheme === "light";
    const st = document.body.dataset.state;
    const color = st === "warning" ? cssVar("--warning") : st === "critical" ? cssVar("--critical")
        : data.isCharging ? cssVar("--charge") : data.tint || coolToHot(heatOf(data, level), light);
    document.body.style.setProperty("--mercury", color);
    tween(mercuryState, level, (v) => mercury.setAttribute("d", mercuryPath(v, len)), prefersStill(data));
});
