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


// Pill: the capsule fills with the level; the value sits centered inside.
const pill = document.getElementById("pill");
const fill = document.getElementById("fill");
const under = document.getElementById("under");
const over = document.getElementById("over");
const fillState = {};
// Where the text sits and its two colors, for the "fill edge cuts the text" case.
const textAt = { left: 0, right: 0, onTrack: "", onFill: "" };

// Text on the fill is black or white, whichever reads better on its color.
function onFillColor() {
    const c = getComputedStyle(fill).backgroundColor;
    const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/.exec(c);
    if (!m) return "";
    const a = m[4] === undefined ? 1 : Number(m[4]);
    if (a < 0.95) return "";
    const [r, g, b] = [m[1], m[2], m[3]].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return lum > 0.3 ? "#000" : "#fff";
}

// Two-tone text reads as two half words when the fill edge runs through it at
// narrow widths. Then the value is drawn once, in the color of the side that
// covers most of it, with a thin halo in the other color so the rest reads too.
function placeFill(v, width) {
    const edge = v * width;
    fill.style.width = `${edge.toFixed(2)}px`;
    const cut = textAt.onTrack !== textAt.onFill && edge > textAt.left + 0.5 && edge < textAt.right - 0.5;
    pill.classList.toggle("cut", cut);
    if (!cut) { under.style.color = ""; under.style.textShadow = ""; return; }
    const mostlyFill = edge - textAt.left >= textAt.right - edge;
    const [color, halo] = mostlyFill ? [textAt.onFill, textAt.onTrack] : [textAt.onTrack, textAt.onFill];
    under.style.color = color;
    under.style.textShadow = `0 0 1px ${halo}, 0 0 1.5px ${halo}, 0 0 2px ${halo}`;
}

boot((data) => {
    applyCommon(data);
    const width = pill.clientWidth;
    const formatted = data.formatted || `${Math.round(clampLevel(data) * 100)}%`;
    const candidates = data.available === false ? ["–"] : [data.isCharging ? `${formatted} ⚡︎` : "", ...shorterForms(formatted)];
    const fit = fitText(under, candidates, width - 8, ["10px", "9px", "8px"]);
    for (const el of [under, over]) {
        el.textContent = fit.text;
        el.style.width = `${width}px`;
        el.style.fontSize = fit.size;
    }
    over.style.color = onFillColor();
    under.style.color = "";
    const textW = fit.text ? textWidth(fit.text, under, fit.size) - 2 : 0;
    textAt.left = (width - textW) / 2;
    textAt.right = textAt.left + textW;
    textAt.onTrack = getComputedStyle(under).color;
    textAt.onFill = getComputedStyle(over).color;
    const level = clampLevel(data);
    tween(fillState, level, (v) => placeFill(v, width), prefersStill(data));
});
