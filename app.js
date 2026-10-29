/* ==========================================================================
   app.js  -  starts the app: page routing (#/dashboard, #/transactions ...),
   the shared header (month selector, bell, profile menu), the sidebar,
   the logout confirmation and global click handling.
   ========================================================================== */
const State = {
  month: "2026-06",
  catTab: "Expense",
  settingsTab: "general",
  tx: {}, rep: {},
  resetTx() { this.tx = { q: "", type: "All Types", cat: "All Categories", from: monthStart(this.month), to: monthEnd(this.month), sortKey: "date", sortDir: "desc", page: 1 }; },
  resetRep() { this.rep = { from: monthStart(this.month), to: monthEnd(this.month), cat: "All Categories" }; }
};
const ROUTES = ["dashboard", "add-expense", "add-income", "transactions", "budget", "categories", "reports", "profile", "settings"];
const currentRoute = () => { const h = location.hash.replace(/^#\/?/, "").split("?")[0]; return ROUTES.includes(h) ? h : "dashboard"; };

/* ---------- render the current page ---------- */
function renderPage() {
  const route = currentRoute(), page = Pages[route], view = $("#view");
  Charts.reset();
  $("#pageTitle").textContent = page.title();
  $("#pageSubtitle").textContent = page.subtitle();
  document.title = `${page.title()} – Smart Expense Tracker`;
  $$("#nav [data-page]").forEach(a => { const on = a.dataset.page === route; a.classList.toggle("active", on); on ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current"); });
  view.dataset.page = route;
  view.innerHTML = page.render();
  page.mount(view);
  document.body.classList.toggle("compact", Store.settings().compactTables);
  closeSidebar();
}
function refresh() { updateHeader(); renderPage(); }

/* ---------- header: month selector, bell, profile ---------- */
function updateHeader() {
  const sel = $("#monthSelect"), keys = new Set([State.month]);
  for (let m = 1; m <= 12; m++) keys.add(`2026-${String(m).padStart(2, "0")}`);
  Store.transactions().forEach(t => keys.add(monthKey(t.date)));
  sel.innerHTML = [...keys].sort().map(k => `<option value="${k}" ${k === State.month ? "selected" : ""}>${monthLabel(k)}</option>`).join("");
  const p = Store.profile();   // name/email come from the logged-in account, so header and welcome heading always match
  $("#headerName").textContent = p.name;
  $("#headerAvatar").innerHTML = avatarHTML(p);
  const alerts = budgetAlerts();
  $("#bellDot").hidden = alerts.length === 0;
  $("#bellMenu").innerHTML = `<div class="dd-title">Notifications</div>` + (alerts.length ? alerts.map(a => `<a class="dd-item ${a.over ? "over" : ""}" href="#/budget">${icon("target", 18)}<span>${esc(a.text)}</span></a>`).join("") : `<div class="dd-empty">No budget alerts for ${monthLabel(State.month)}.</div>`);
}
function closeMenus(except) { $$(".dropdown.open").forEach(d => { if (d !== except) { d.classList.remove("open"); const b = $("[data-dd]", d); if (b) b.setAttribute("aria-expanded", "false"); } }); }
function openSidebar() { $("#sidebar").classList.add("open"); $("#backdrop").classList.add("show"); }
function closeSidebar() { $("#sidebar").classList.remove("open"); $("#backdrop").classList.remove("show"); }

/* ---------- authentication (the Flask session is the source of truth) ---------- */
const Auth = { user: null };

async function fetchCurrentUser() {            // -> user object, or null when not logged in
  const r = await fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" });
  if (r.status === 401) return null;
  if (!r.ok) throw new Error("Server error " + r.status);
  return r.json();
}
function toLogin() { Auth.user = null; Store.forget(); location.replace("/login"); }

/* fetch wrapper for the Flask API: sends the session cookie, sends the user to /login on 401 */
async function apiFetch(url, { method = "GET", body } = {}) {
  try {
    const r = await fetch(url, { method, credentials: "same-origin", cache: "no-store", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
    if (r.status === 401) { toLogin(); return { ok: false, status: 401, error: "Your session has ended. Please log in again." }; }
    const data = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, data, error: data.error };
  } catch (e) { return { ok: false, status: 0, error: "Could not reach the server." }; }
}

async function logout() {
  const yes = await confirmDialog({ title: "Log out", message: "Are you sure you want to log out of Smart Expense Tracker?", confirmText: "Log out", iconName: "logout" });
  if (!yes) return;
  const res = await apiFetch("/api/auth/logout", { method: "POST" });   // clears the server-side session
  if (!res.ok && res.status !== 401) return toast("Could not log out – check your connection and try again.", "error");
  try { sessionStorage.clear(); } catch (e) {}
  toLogin();
}

/* Re-check the session when the tab becomes visible or is restored from the Back/Forward cache:
   covers "logged out in another tab" and "pressed Back after logout". */
async function verifySession() {
  try {
    const u = await fetchCurrentUser();
    if (!u) return toLogin();
    if (Auth.user && u.id !== Auth.user.id) return location.reload();   // a different account logged in elsewhere
    document.body.classList.remove("auth-pending");
  } catch (e) { /* server unreachable: leave the page as it is */ }
}

/* ---------- start ---------- */
document.addEventListener("DOMContentLoaded", async () => {
  hydrateIcons();
  let user;
  try { user = await fetchCurrentUser(); }
  catch (e) { $("#appError").hidden = false; $("#reloadBtn").addEventListener("click", () => location.reload()); return; }
  if (!user) return toLogin();                                        // not logged in -> /login
  Auth.user = user; Store.useUser(user.id);
  try { await Store.init(user); } catch (e) { console.error("Could not load account data:", e); $("#appError").hidden = false; $("#appError").textContent = e.message || "Could not load account data from MySQL."; $("#reloadBtn").addEventListener("click", () => location.reload()); return; }
  State.month = Store.month(); State.resetTx(); State.resetRep();
  document.body.classList.remove("auth-pending");

  $("#monthSelect").addEventListener("change", async e => { State.month = e.target.value; try { await Store.saveMonth(State.month); State.resetTx(); State.resetRep(); refresh(); } catch(err) { toast(err.message || "Could not load month data.", "error"); } });
  $("#menuToggle").addEventListener("click", openSidebar);
  $("#backdrop").addEventListener("click", closeSidebar);
  $("#logoutBtn").addEventListener("click", e => { e.preventDefault(); closeSidebar(); logout(); });
  $("#menuLogout").addEventListener("click", () => { closeMenus(); logout(); });
  $$("[data-dd]").forEach(b => b.addEventListener("click", e => { e.stopPropagation(); const d = b.closest(".dropdown"); closeMenus(d); const open = d.classList.toggle("open"); b.setAttribute("aria-expanded", open); }));
  document.addEventListener("click", e => { if (!e.target.closest(".dropdown")) closeMenus(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") { closeMenus(); closeSidebar(); } });

  /* one click handler for edit / delete buttons and "View All" links that pre-set a filter */
  document.addEventListener("click", e => {
    const ed = e.target.closest("[data-edit]"); if (ed) return openTxModal(ed.dataset.edit);
    const del = e.target.closest("[data-del]"); if (del) return deleteTx(del.dataset.del);
    const tl = e.target.closest("[data-tx-type]"); if (tl) { State.resetTx(); State.tx.type = tl.dataset.txType; State.tx.from = ""; State.tx.to = ""; }
    if (e.target.closest("#menuProfile a, .dd-item")) closeMenus();
  });

  window.addEventListener("hashchange", () => { closeMenus(); renderPage(); window.scrollTo(0, 0); });
  window.addEventListener("pageshow", e => { if (e.persisted) { document.body.classList.add("auth-pending"); verifySession(); } });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") verifySession(); });
  if (!location.hash) history.replaceState(null, "", "#/dashboard");
  updateHeader(); renderPage();
});
