/* ==========================================================================
   ui.js  -  shared helpers used by every page: icons, formatting, toast,
   modal dialogs, confirm dialog and form-validation helpers.
   ========================================================================== */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ---------- icons (simple line icons, 24x24) ---------- */
const ICONS = {
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5h13V10"/><path d="M10 19.5v-5h4v5"/>',
  plus: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
  list: '<rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4"/>',
  bars: '<path d="M4 20h16"/><rect x="5" y="11" width="3" height="9" rx=".8"/><rect x="10.5" y="5" width="3" height="15" rx=".8"/><rect x="16" y="9" width="3" height="11" rx=".8"/>',
  grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="2"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="2"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="2"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="2"/>',
  report: '<rect x="3.5" y="3.5" width="17" height="17" rx="2.5"/><path d="m7 15 3.2-3.5 2.6 2.2L17 8.5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c.8-4 3.7-6 7.5-6s6.7 2 7.5 6"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.6M12 18.6v2.6M4.6 7.4l2.2 1.3M17.2 15.3l2.2 1.3M4.6 16.6l2.2-1.3M17.2 8.7l2.2-1.3"/><circle cx="12" cy="12" r="7.2"/>',
  logout: '<path d="M10 4.5H6.5A2 2 0 0 0 4.5 6.5v11a2 2 0 0 0 2 2H10"/><path d="M15 8l4 4-4 4M19 12H9.5"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  bell: '<path d="M6 17.5V11a6 6 0 0 1 12 0v6.5l1.5 1.5h-15z"/><path d="M10 21.5h4"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  chevleft: '<path d="m15 6-6 6 6 6"/>',
  chevright: '<path d="m9 6 6 6-6 6"/>',
  pencil: '<path d="M4 20l1-4.2L16.6 4.2a2 2 0 0 1 2.8 0l.4.4a2 2 0 0 1 0 2.8L8.2 19z"/><path d="m14.5 6.3 3.2 3.2"/>',
  trash: '<path d="M4.5 7h15M9.5 7V4.8h5V7"/><path d="M6.5 7l.8 12.2a1.5 1.5 0 0 0 1.5 1.3h6.4a1.5 1.5 0 0 0 1.5-1.3L17.5 7"/><path d="M10 11v6M14 11v6"/>',
  save: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>',
  download: '<path d="M12 4v11M7.5 11l4.5 4.5 4.5-4.5M5 20h14"/>',
  upload: '<path d="M12 16V5M7.5 9 12 4.5 16.5 9M5 20h14"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  wallet: '<path d="M4 8.5V7a2.5 2.5 0 0 1 2.5-2.5H17"/><rect x="3.5" y="7.5" width="17" height="12" rx="2.5"/><path d="M15.5 12.5h5v3h-5a1.5 1.5 0 0 1 0-3z"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
  pie: '<path d="M12 3.5v8.5h8.5A8.5 8.5 0 1 1 12 3.5z"/><path d="M14.5 3.8a8.5 8.5 0 0 1 5.7 5.7h-5.7z"/>',
  coins: '<ellipse cx="10" cy="6.5" rx="6" ry="2.7"/><path d="M4 6.5v4c0 1.5 2.7 2.7 6 2.7M4 10.5v4c0 1.5 2.7 2.7 6 2.7"/><circle cx="16.5" cy="15.5" r="4.5"/><path d="M16.5 13.5v4M14.7 15.5h3.6"/>',
  utensils: '<path d="M7 3.5v7.5M4.5 3.5v5a2.5 2.5 0 0 0 5 0v-5M7 11v9.5"/><path d="M17 20.5V3.5c-2.3 1.2-3.5 3.7-3.5 6.5v3h3.5"/>',
  bus: '<rect x="4.5" y="3.5" width="15" height="14.5" rx="3"/><path d="M4.5 11.5h15M8 18v2.5M16 18v2.5"/><circle cx="8.3" cy="14.8" r=".9"/><circle cx="15.7" cy="14.8" r=".9"/>',
  cart: '<path d="M3 4h2.5l2.2 10.5h9.6L19.5 8H6.2"/><circle cx="9.5" cy="19" r="1.4"/><circle cx="16.5" cy="19" r="1.4"/>',
  file: '<path d="M6 3.5h8l4.5 4.5v12.5H6z"/><path d="M14 3.5V8h4.5M9 12.5h6M9 16h6"/>',
  star: '<path d="m12 3.8 2.5 5.2 5.7.8-4.1 4 1 5.7-5.1-2.7-5.1 2.7 1-5.7-4.1-4 5.7-.8z"/>',
  dots: '<circle cx="6" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="18" cy="12" r="1.6"/>',
  bolt: '<path d="M13 3 5.5 13.5H11L10 21l7.5-10.5H12z"/>',
  gift: '<rect x="4" y="9" width="16" height="11" rx="1.5"/><path d="M3 9h18v3.5H3zM12 9v11M12 9c-2.5 0-4-1-4-2.5S9.5 4 11 5s1 4 1 4zM12 9c2.5 0 4-1 4-2.5S14.5 4 13 5s-1 4-1 4z"/>',
  briefcase: '<rect x="3.5" y="7.5" width="17" height="12" rx="2"/><path d="M9 7.5V5.5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5.5v2M3.5 13h17"/>',
  bank: '<path d="M3.5 9.5 12 4.5l8.5 5zM5.5 10v7M10 10v7M14 10v7M18.5 10v7M3.5 19.5h17"/>',
  film: '<rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="M4 9h16M4 15h16M9 4v16M15 4v16"/>',
  health: '<path d="M12 20.5S4 15.5 4 9.8A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 8 2.2c0 5.700-8 10.700-8 10.700z"/>',
  book: '<path d="M5 4.5h10a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h10"/>',
  plane: '<path d="M21 3.5 3.5 10.5l6 2.200 2.200 6z"/><path d="m21 3.5-11.500 9.200"/>',
  coffee: '<path d="M4.500 8.500h11v6a4 4 0 0 1-4 4h-3a4 4 0 0 1-4-4z"/><path d="M15.500 10h1.800a2.200 2.200 0 0 1 0 4.500h-1.800M8 3.500v2M11 3.500v2"/>',
  paw: '<circle cx="7" cy="10" r="1.800"/><circle cx="17" cy="10" r="1.800"/><circle cx="10" cy="6" r="1.800"/><circle cx="14" cy="6" r="1.800"/><path d="M12 11.500c-3 0-5 2.500-5 4.500 0 1.700 1.500 2.500 3 2.500.8 0 1.300-.3 2-.3s1.200.3 2 .3c1.500 0 3-.8 3-2.500 0-2-2-4.500-5-4.500z"/>',
  mail: '<rect x="3.5" y="5.500" width="17" height="13" rx="2"/><path d="m4 7 8 6 8-6"/>',
  shield: '<path d="M12 3.500 5 6v5.500c0 4.200 2.800 7.300 7 9 4.200-1.700 7-4.800 7-9V6z"/><path d="m9 12 2.200 2.200L15.500 10"/>',
  monitor: '<rect x="3.500" y="4.500" width="17" height="12" rx="2"/><path d="M9 20.500h6M12 16.500v4"/>',
  check: '<path d="m5 12.500 4.500 4.500L19 7.500"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  arrowup: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  arrowdown: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  sort: '<path d="m8 9 4-4 4 4M8 15l4 4 4-4"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  lock: '<rect x="5" y="10.500" width="14" height="10" rx="2"/><path d="M8 10.500V8a4 4 0 0 1 8 0v2.500"/>',
  print: '<path d="M7 9V4h10v5M7 17H5a1.500 1.500 0 0 1-1.500-1.500v-5A1.500 1.500 0 0 1 5 9h14a1.500 1.500 0 0 1 1.500 1.500v5A1.500 1.500 0 0 1 19 17h-2"/><rect x="7" y="14" width="10" height="6.500"/>'
};
function icon(name, size = 20, cls = "") {
  return `<svg class="ic ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.dots}</svg>`;
}
function hydrateIcons(root = document) {
  $$("[data-icon]", root).forEach(el => { if (!el.firstElementChild) el.innerHTML = icon(el.dataset.icon, +el.dataset.size || 22); });
}
const ICON_CHOICES = ["utensils","bus","cart","file","star","bolt","gift","briefcase","bank","user","film","health","book","plane","coffee","paw","wallet","dots"];
const COLOR_CHOICES = ["#2878e8","#8155d9","#ffad36","#ef5358","#ef6bb6","#8a9aab","#16a36a","#0ea5a4","#f97316","#6366f1"];

/* ---------- formatting (respects the Settings page) ---------- */
const CURRENCIES = {
  INR: { symbol: "₹", locale: "en-IN", label: "INR (₹) - Indian Rupee" },
  USD: { symbol: "$", locale: "en-US", label: "USD ($) - US Dollar" },
  EUR: { symbol: "€", locale: "de-DE", label: "EUR (€) - Euro" },
  GBP: { symbol: "£", locale: "en-GB", label: "GBP (£) - British Pound" }
};
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTHS_FULL = ["January","February","March","April","May","June","July","August","September","October","November","December"];
function money(n) {
  const c = CURRENCIES[Store.settings().currency] || CURRENCIES.INR;
  const v = Number(n) || 0;
  const hasDecimals = Math.abs(v % 1) > 0.0001;
  return (v < 0 ? "-" : "") + c.symbol + Math.abs(v).toLocaleString(c.locale === "de-DE" ? "en-US" : c.locale, { minimumFractionDigits: hasDecimals ? 2 : 0, maximumFractionDigits: 2 });
}
const DATE_FORMATS = { "DD MMM YYYY": "DD MMM YYYY (27 Jun 2026)", "DD-MM-YYYY": "DD-MM-YYYY (27-06-2026)", "MM-DD-YYYY": "MM-DD-YYYY (06-27-2026)", "YYYY-MM-DD": "YYYY-MM-DD (2026-06-27)" };
function fmtDate(iso, fmt = Store.settings().dateFormat) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ""); if (!m) return iso || "";
  const [, y, mo, d] = m;
  if (fmt === "DD-MM-YYYY") return `${d}-${mo}-${y}`;
  if (fmt === "MM-DD-YYYY") return `${mo}-${d}-${y}`;
  if (fmt === "YYYY-MM-DD") return `${y}-${mo}-${d}`;
  return `${d} ${MONTHS[+mo - 1]} ${y}`;
}
const isValidISODate = s => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ""); if (!m) return false;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return d.getFullYear() === +m[1] && d.getMonth() === +m[2] - 1 && d.getDate() === +m[3] && +m[1] >= 2000 && +m[1] <= 2100;
};
const monthKey = iso => (iso || "").slice(0, 7);
const monthLabel = key => { const [y, m] = key.split("-"); return `${MONTHS_FULL[+m - 1]} ${y}`; };
const monthShort = key => MONTHS[+key.split("-")[1] - 1];
const monthStart = key => key + "-01";
const monthEnd = key => { const [y, m] = key.split("-").map(Number); return `${key}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`; };
const shiftMonth = (key, delta) => { const [y, m] = key.split("-").map(Number); const d = new Date(y, m - 1 + delta, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const sum = (list, f = x => x) => list.reduce((a, b) => a + f(b), 0);
const pctChange = (cur, prev) => prev ? Math.round((cur - prev) / prev * 100) : null;

/* ---------- category look-ups (icon + colour) ---------- */
function findCategory(type, name) { return (Store.categories()[type] || []).find(c => c.name === name); }
function catBadge(type, name, size = 34) {
  const c = findCategory(type, name) || { icon: "dots", color: "#8a9aab" };
  return `<span class="cat-badge" style="--c:${c.color};width:${size}px;height:${size}px">${icon(c.icon, Math.round(size * 0.52))}</span>`;
}

/* ---------- toast ---------- */
let toastTimer;
function toast(msg, kind = "") {
  const t = $("#toast"); t.textContent = msg; t.className = "show " + kind;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
}

/* ---------- modal + confirm dialog ---------- */
function openModal({ title, html, wide = false }) {
  const root = $("#modalRoot");
  const prevFocus = document.activeElement;
  const back = document.createElement("div");
  back.className = "modal-backdrop";
  back.innerHTML = `<div class="modal ${wide ? "wide" : ""}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal-head"><h3>${esc(title)}</h3><button type="button" class="icon-btn" data-close aria-label="Close">${icon("x", 18)}</button></div><div class="modal-body">${html}</div></div>`;
  root.appendChild(back);
  const close = () => { back.remove(); document.removeEventListener("keydown", onKey); if (prevFocus && prevFocus.focus) prevFocus.focus(); };
  const onKey = e => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", onKey);
  back.addEventListener("mousedown", e => { if (e.target === back) close(); });
  $$("[data-close]", back).forEach(b => b.addEventListener("click", close));
  const first = $("input:not([type=hidden]):not([disabled]), select, textarea, button.btn", back); if (first) first.focus();
  return { el: back, close };
}
function confirmDialog({ title, message, confirmText = "Confirm", danger = false, iconName = "logout" }) {
  return new Promise(resolve => {
    const m = openModal({ title, html: `<div class="confirm"><span class="confirm-ic ${danger ? "danger" : ""}">${icon(iconName, 24)}</span><p>${message}</p></div><div class="actions end"><button type="button" class="btn btn-light" data-no>Cancel</button><button type="button" class="btn ${danger ? "btn-danger" : "btn-primary"}" data-yes>${esc(confirmText)}</button></div>` });
    let answered = false;
    const done = v => { if (answered) return; answered = true; m.close(); resolve(v); };
    $("[data-yes]", m.el).addEventListener("click", () => done(true));
    $("[data-no]", m.el).addEventListener("click", () => done(false));
    $$("[data-close]", m.el).forEach(b => b.addEventListener("click", () => done(false)));
    m.el.addEventListener("mousedown", e => { if (e.target === m.el) done(false); });
    $("[data-no]", m.el).focus();
  });
}

/* ---------- form helpers ---------- */
function setError(form, name, msg) {
  const field = form.querySelector(`[data-field="${name}"]`); if (!field) return;
  field.classList.toggle("has-error", !!msg);
  const e = field.querySelector(".err"); if (e) e.textContent = msg || "";
  const input = field.querySelector("input,select,textarea"); if (input) input.setAttribute("aria-invalid", msg ? "true" : "false");
}
function clearErrors(form) { $$("[data-field]", form).forEach(f => setError(form, f.dataset.field, "")); }
function selectWithIcon(id, label, optionsHTML, iconName, extra = "") {
  return `<div class="field" data-field="${id}"><label for="${id}">${label}</label><div class="select-wrap"><span class="select-ic" data-selic>${icon(iconName, 18)}</span>${extra}<select id="${id}" name="${id}">${optionsHTML}</select><span class="select-chev">${icon("chevron", 16)}</span></div><small class="err"></small></div>`;
}
function options(list, selected) { return list.map(o => { const v = typeof o === "string" ? o : o.value, l = typeof o === "string" ? o : o.label; return `<option value="${esc(v)}" ${v === selected ? "selected" : ""}>${esc(l)}</option>`; }).join(""); }

const PAYMENT_METHODS = { Expense: ["UPI", "Cash", "Debit Card", "Credit Card", "Net Banking"], Income: ["Bank Transfer", "UPI", "Cash", "Cheque"] };
const METHOD_ICONS = { "UPI": "wallet", "Cash": "coins", "Debit Card": "file", "Credit Card": "file", "Net Banking": "bank", "Bank Transfer": "bank", "Cheque": "file" };

/* A transaction form (used by Add Expense, Add Income and the edit pop-up) */
function txFieldsHTML(type, v = {}) {
  const cats = Store.categories()[type];
  const catName = v.cat && cats.some(c => c.name === v.cat) ? v.cat : (cats[0] && cats[0].name);
  const method = v.method || PAYMENT_METHODS[type][0];
  const methods = PAYMENT_METHODS[type].includes(method) ? PAYMENT_METHODS[type] : [method, ...PAYMENT_METHODS[type]];
  const label = type === "Expense" ? "Category" : "Income Source";
  return `
  <div class="form-grid">
    <div class="field" data-field="amount"><label for="amount">Amount</label><div class="input-prefix"><span>${esc((CURRENCIES[Store.settings().currency] || CURRENCIES.INR).symbol)}</span><input id="amount" name="amount" type="number" inputmode="decimal" step="0.01" min="0.01" placeholder="Enter amount" value="${v.amount ?? ""}"></div><small class="err"></small></div>
    <div class="field" data-field="date"><label for="date">Date</label><input id="date" name="date" type="date" value="${esc(v.date || "")}"><small class="err"></small></div>
    ${selectWithIcon("cat", label, options(cats.map(c => c.name), catName), (findCategory(type, catName) || {}).icon || "dots")}
    ${selectWithIcon("method", "Payment Method", options(methods, method), METHOD_ICONS[method] || "wallet")}
    <div class="field full" data-field="desc"><label for="desc">Description</label><textarea id="desc" name="desc" rows="3" maxlength="120" placeholder="Add a short note (optional)">${esc(v.desc || "")}</textarea><small class="err"></small></div>
  </div>`;
}
function bindTxForm(form, type) {
  const catSel = $("#cat", form), methSel = $("#method", form);
  const upd = () => {
    const c = findCategory(type, catSel.value); $('[data-field="cat"] [data-selic]', form).innerHTML = icon(c ? c.icon : "dots", 18);
    $('[data-field="method"] [data-selic]', form).innerHTML = icon(METHOD_ICONS[methSel.value] || "wallet", 18);
  };
  catSel.addEventListener("change", upd); methSel.addEventListener("change", upd); upd();
  $$("input,select,textarea", form).forEach(el => el.addEventListener("input", () => setError(form, el.name || el.id, "")));
}
function readTxForm(form, type) {
  clearErrors(form);
  const amountRaw = $("#amount", form).value.trim(), amount = Number(amountRaw);
  const date = $("#date", form).value, cat = $("#cat", form).value, method = $("#method", form).value, desc = $("#desc", form).value.trim();
  let ok = true; const bad = (n, m) => { setError(form, n, m); ok = false; };
  if (!amountRaw) bad("amount", "Enter an amount.");
  else if (!isFinite(amount) || amount <= 0) bad("amount", "Amount must be greater than 0.");
  else if (amount > 100000000) bad("amount", "Amount is too large.");
  else if (!/^\d+(\.\d{1,2})?$/.test(amountRaw)) bad("amount", "Use at most 2 decimal places.");
  if (!date) bad("date", "Choose a date."); else if (!isValidISODate(date)) bad("date", "Enter a valid date.");
  if (!cat || !findCategory(type, cat)) bad("cat", type === "Expense" ? "Choose a category." : "Choose an income source.");
  if (!method) bad("method", "Choose a payment method.");
  if (desc.length > 120) bad("desc", "Keep the description under 120 characters.");
  if (!ok) { const first = $(".has-error input, .has-error select, .has-error textarea", form); if (first) first.focus(); return null; }
  return { type, amount: Math.round(amount * 100) / 100, date, cat, method, desc: desc || cat };
}
