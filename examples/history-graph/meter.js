const canvas = document.getElementById('graph');
const ctx = canvas.getContext('2d');

function render(data) {
  // Draw at the screen's real resolution so the line stays sharp
  const scale = window.devicePixelRatio || 1;
  const w = canvas.clientWidth, h = 22;
  canvas.width = w * scale;
  canvas.height = h * scale;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const points = (data.history || []).concat(data.level ?? 0);
  if (points.length < 2) return;

  const dark = data.colorScheme !== 'light';
  const color = data.tint
    || (data.state === 'critical' ? '#ff453a' : data.state === 'warning' ? '#ff9f0a' : dark ? '#fff' : '#1d1d1f');
  const x = (i) => (i / (points.length - 1)) * (w - 2) + 1;
  const y = (v) => h - 3 - v * (h - 6);

  // Soft fill under the line, then the line
  ctx.beginPath();
  points.forEach((v, i) => (i ? ctx.lineTo(x(i), y(v)) : ctx.moveTo(x(i), y(v))));
  ctx.lineTo(x(points.length - 1), h);
  ctx.lineTo(x(0), h);
  ctx.closePath();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = color;
  ctx.fill();

  ctx.globalAlpha = 1;
  ctx.beginPath();
  points.forEach((v, i) => (i ? ctx.lineTo(x(i), y(v)) : ctx.moveTo(x(i), y(v))));
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

window.addEventListener('meterUpdate', (e) => render(e.detail));
render(window.meterData || { history: [0.2, 0.4, 0.3, 0.6, 0.5], level: 0.7 });
window.meterReady = true;
