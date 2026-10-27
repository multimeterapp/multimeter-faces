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


// Label & Value: the small label, then the value in the menu bar's own type.
const label = document.getElementById("label");
const value = document.getElementById("value");

boot((data) => {
    applyCommon(data);
    document.body.classList.toggle("tinted", !!data.tint);
    label.textContent = data.label || "";
    label.style.display = data.label ? "" : "none";
    let text = data.available === false ? "–" : (data.formatted || `${Math.round((data.level || 0) * 100)}%`);
    if (data.isCharging) text += " ⚡︎";
    value.textContent = text;
    const meter = document.getElementById("meter");
    if (meter.scrollWidth > meter.clientWidth) label.style.display = "none";
});
