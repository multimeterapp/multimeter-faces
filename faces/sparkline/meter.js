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

function boot(render) {
    window.addEventListener("meterUpdate", (e) => render(e.detail));
    render(window.meterData || { level: 0.42, formatted: "42%", label: "CPU", history: [] });
    window.meterReady = true;
}


// Sparkline: history drawn as a line with a soft fill. The value text hides
// itself when the meter is too narrow for it.
const graph = document.getElementById("graph");
const line = document.getElementById("line");
const area = document.getElementById("area");
const dot = document.getElementById("dot");
const valueEl = document.getElementById("value");

function splitUnit(text) {
    const m = /^\s*(-?[\d.,:]+)\s*(.*)$/.exec(text || "");
    return m ? [m[1], m[2]] : [text || "", ""];
}

boot((data) => {
    applyCommon(data);
    const [number, unit] = splitUnit(data.available === false ? "–" : data.formatted);
    valueEl.textContent = number;
    if (unit) {
        const u = document.createElement("span");
        u.className = "unit";
        u.textContent = unit.replace("/s", "");
        valueEl.appendChild(u);
    }
    valueEl.style.display = document.body.clientWidth < 52 ? "none" : "";

    const w = Math.max(20, graph.getBoundingClientRect().width), h = 18, pad = 2;
    graph.setAttribute("viewBox", `0 0 ${w} ${h}`);
    let points = (data.history || []).slice(-30);
    if (points.length === 0) points = [data.level || 0];
    if (points.length === 1) points = [points[0], points[0]];
    const step = (w - pad) / (points.length - 1);
    const xy = points.map((v, i) => [i * step, h - pad - Math.max(0, Math.min(1, v)) * (h - pad * 2)]);
    const d = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
    line.setAttribute("d", d);
    area.setAttribute("d", `${d} L${xy[xy.length - 1][0].toFixed(1)} ${h} L0 ${h} Z`);
    const [lx, ly] = xy[xy.length - 1];
    dot.setAttribute("cx", lx.toFixed(1));
    dot.setAttribute("cy", ly.toFixed(1));
});
