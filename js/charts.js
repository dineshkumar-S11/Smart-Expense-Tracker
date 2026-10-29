/* ==========================================================================
   charts.js  -  small SVG charts (bar, donut, area). No libraries and no
   internet connection are needed. Each chart redraws when the window resizes.
   ========================================================================== */
const Charts = (() => {
  const registry = [];
  let gradientId = 0;
  const GREEN = "#13a36e", RED = "#ff5a5f";
  const fmtAxis = v => v === 0 ? "0" : v >= 1000 ? parseFloat((v / 1000).toFixed(1)) + "K" : String(v);

  function niceScale(max) {
    if (!(max > 0)) return { max: 1000, step: 250 };
    const rough = max / 4, pow = Math.pow(10, Math.floor(Math.log10(rough))), f = rough / pow;
    const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * pow;
    return { max: Math.ceil(max / step) * step, step };
  }
  function frame(el) {
    const w = Math.max(220, el.clientWidth || 300), h = Math.max(140, el.clientHeight || 200);
    const pad = { l: 40, r: 10, t: 10, b: 26 };
    return { w, h, pad, pw: w - pad.l - pad.r, ph: h - pad.t - pad.b };
  }
  function grid(f, sc) {
    let s = "";
    for (let v = 0; v <= sc.max + 0.001; v += sc.step) {
      const y = f.pad.t + f.ph - (v / sc.max) * f.ph;
      s += `<line x1="${f.pad.l}" x2="${f.w - f.pad.r}" y1="${y}" y2="${y}" stroke="#e9eef0" stroke-width="1"/>` +
           `<text x="${f.pad.l - 8}" y="${y + 3.5}" text-anchor="end" font-size="11" fill="#7a8794">${fmtAxis(v)}</text>`;
    }
    return s;
  }
  const empty = (el, msg) => { el.innerHTML = `<div class="chart-empty">${msg}</div>`; };

  function bars(el, d) { // d: {labels, income[], expense[]}
    const draw = () => {
      if (!d.labels.length || ![...d.income, ...d.expense].some(v => v > 0)) return empty(el, "No data for this period yet.");
      const f = frame(el), sc = niceScale(Math.max(...d.income, ...d.expense));
      const gw = f.pw / d.labels.length, bw = Math.max(6, Math.min(20, gw * 0.28));
      let s = grid(f, sc);
      d.labels.forEach((l, i) => {
        const cx = f.pad.l + gw * i + gw / 2;
        [[d.income[i], GREEN, "Income", -bw - 2], [d.expense[i], RED, "Expense", 2]].forEach(([v, c, n, dx]) => {
          const h = (v / sc.max) * f.ph;
          s += `<rect x="${cx + dx}" y="${f.pad.t + f.ph - h}" width="${bw}" height="${Math.max(h, 0)}" rx="2.5" fill="${c}"><title>${l} – ${n}: ${money(v)}</title></rect>`;
        });
        s += `<text x="${cx}" y="${f.h - 7}" text-anchor="middle" font-size="11" fill="#6b7885">${l}</text>`;
      });
      el.innerHTML = `<svg viewBox="0 0 ${f.w} ${f.h}" width="${f.w}" height="${f.h}" role="img" aria-label="Income versus expenses by month">${s}</svg>`;
    };
    draw(); registry.push({ el, draw });
  }

  function area(el, d) {
    const draw = () => {
      if (!d.labels.length || ![...d.income, ...d.expense].some(v => v > 0)) return empty(el, "No data for this period yet.");
      const f = frame(el), sc = niceScale(Math.max(...d.income, ...d.expense)), n = d.labels.length, gw = f.pw / n;
      const X = i => f.pad.l + gw * i + gw / 2, Y = v => f.pad.t + f.ph - (v / sc.max) * f.ph;
      const id = ++gradientId; let s = grid(f, sc);
      [[d.income, GREEN, "Income"], [d.expense, RED, "Expense"]].forEach(([arr, c, name], k) => {
        const pts = arr.map((v, i) => [X(i), Y(v)]), line = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
        s += `<defs><linearGradient id="g${id}${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c}" stop-opacity=".22"/><stop offset="1" stop-color="${c}" stop-opacity="0.02"/></linearGradient></defs>`;
        s += `<path d="${line} L${pts[n - 1][0]} ${f.pad.t + f.ph} L${pts[0][0]} ${f.pad.t + f.ph} Z" fill="url(#g${id}${k})"/><path d="${line}" fill="none" stroke="${c}" stroke-width="2.2" stroke-linejoin="round"/>`;
        pts.forEach((p, i) => s += `<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="${c}" stroke="#fff" stroke-width="1.5"><title>${d.labels[i]} – ${name}: ${money(arr[i])}</title></circle>`);
      });
      d.labels.forEach((l, i) => s += `<text x="${X(i)}" y="${f.h - 7}" text-anchor="middle" font-size="11" fill="#6b7885">${l}</text>`);
      el.innerHTML = `<svg viewBox="0 0 ${f.w} ${f.h}" width="${f.w}" height="${f.h}" role="img" aria-label="Monthly spending trend">${s}</svg>`;
    };
    draw(); registry.push({ el, draw });
  }

  function donut(el, parts) { // parts: [{label, value, color}]
    const draw = () => {
      const total = sum(parts, p => p.value), size = Math.max(100, Math.min(el.clientWidth || 170, el.clientHeight || 170));
      const sw = size * 0.17, r = (size - sw) / 2 - 2, C = 2 * Math.PI * r, c = size / 2;
      let s = `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="#edf1f3" stroke-width="${sw}"/>`, acc = 0;
      if (total > 0) parts.forEach(p => {
        if (p.value <= 0) return; const len = p.value / total * C;
        s += `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${p.color}" stroke-width="${sw}" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-acc}" transform="rotate(-90 ${c} ${c})"><title>${esc(p.label)}: ${money(p.value)} (${Math.round(p.value / total * 100)}%)</title></circle>`;
        acc += len;
      });
      el.querySelector(".donut-svg").innerHTML = `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="Expenses by category">${s}</svg>`;
    };
    draw(); registry.push({ el, draw });
  }

  let timer;
  window.addEventListener("resize", () => { clearTimeout(timer); timer = setTimeout(() => registry.forEach(r => { if (r.el.isConnected) r.draw(); }), 120); });
  return { bars, area, donut, reset() { registry.length = 0; } };
})();
