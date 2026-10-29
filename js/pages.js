/* ==========================================================================
   pages.js  -  one object per sidebar page. Each page has:
     title() / subtitle()  -> text shown in the mountain header
     render()              -> returns the page HTML
     mount(view)           -> attaches events and draws charts
   Shared state (selected month, filters...) lives in State (see app.js).
   ========================================================================== */

/* ---------- shared data helpers ---------- */
const byDateDesc = (a, b) => b.date.localeCompare(a.date) || String(b.id).localeCompare(String(a.id));
function monthStats(key) {
  const list = Store.transactions().filter(t => monthKey(t.date) === key);
  const income = sum(list.filter(t => t.type === "Income"), t => t.amount);
  const expense = sum(list.filter(t => t.type === "Expense"), t => t.amount);
  return { list, income, expense, balance: income - expense };
}
function expenseByCategory(list) {
  const cats = Store.categories().Expense, map = {};
  list.filter(t => t.type === "Expense").forEach(t => { map[t.cat] = (map[t.cat] || 0) + t.amount; });
  return Object.entries(map).map(([name, value]) => {
    const c = cats.find(x => x.name === name) || { color: "#8a9aab", icon: "dots" };
    return { name, label: name, value, color: c.color, icon: c.icon };
  }).sort((a, b) => b.value - a.value);
}
function lastMonthKeys(endKey, n) { const k = []; for (let i = n - 1; i >= 0; i--) k.push(shiftMonth(endKey, -i)); return k; }
function monthlySeries(keys, filter = () => true) {
  const all = Store.transactions().filter(filter);
  return {
    labels: keys.map(monthShort),
    income: keys.map(k => sum(all.filter(t => monthKey(t.date) === k && t.type === "Income"), t => t.amount)),
    expense: keys.map(k => sum(all.filter(t => monthKey(t.date) === k && t.type === "Expense"), t => t.amount))
  };
}
function deltaHTML(cur, prev, upIsGood) {
  const p = pctChange(cur, prev);
  if (p === null) return `<small class="muted">No data last month</small>`;
  if (p === 0) return `<small class="muted">No change from last month</small>`;
  const up = p > 0, good = up === upIsGood;
  return `<small class="delta ${good ? "good" : "bad"}">${icon(up ? "arrowup" : "arrowdown", 12)} ${Math.abs(p)}%</small> <small class="muted">from last month</small>`;
}
function todayISO() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function defaultDate() { const t = todayISO(); return monthKey(t) === State.month ? t : monthEnd(State.month); }
function budgetAlerts() {
  const s = Store.settings(); if (!s.budgetAlerts) return [];
  const b = Store.budget(), st = monthStats(State.month), spent = {};
  st.list.filter(t => t.type === "Expense").forEach(t => { spent[t.cat] = (spent[t.cat] || 0) + t.amount; });
  const out = [], thr = s.alertThreshold;
  if (b.monthly > 0 && st.expense / b.monthly * 100 >= thr) out.push({ text: `Monthly budget ${Math.round(st.expense / b.monthly * 100)}% used`, over: st.expense > b.monthly });
  Store.categories().Expense.forEach(c => {
    const lim = b.cats[c.name] || 0; if (lim <= 0) return;
    const p = (spent[c.name] || 0) / lim * 100;
    if (p >= thr) out.push({ text: `${c.name} has used ${Math.round(p)}% of its budget`, over: p > 100 });
  });
  return out;
}
const allCategoryNames = () => [...new Set([...Store.categories().Expense, ...Store.categories().Income].map(c => c.name))];
const txRowHTML = t => `<tr><td>${fmtDate(t.date)}</td><td class="desc">${esc(t.desc)}</td><td><span class="cat-cell">${catBadge(t.type, t.cat, 26)}${esc(t.cat)}</span></td><td class="amt">${money(t.amount)}</td><td><span class="pill ${t.type === "Income" ? "income" : "expense"}">${t.type}</span></td><td class="action-cell"><button class="row-action edit" data-edit="${t.id}" aria-label="Edit ${esc(t.desc)}" title="Edit">${icon("pencil", 17)}</button><button class="row-action delete" data-del="${t.id}" aria-label="Delete ${esc(t.desc)}" title="Delete">${icon("trash", 17)}</button></td></tr>`;
const emptyBlock = (msg, link = "") => `<div class="empty">${icon("wallet", 28)}<p>${msg}</p>${link}</div>`;

const Pages = {};

/* ============================ DASHBOARD ============================ */
Pages.dashboard = {
  title: () => `Welcome back, ${Store.profile().name.trim().split(/\s+/)[0] || "there"}!`,
  subtitle: () => "Keep track of your expenses and stay on budget.",
  render() {
    const key = State.month, cur = monthStats(key), prev = monthStats(shiftMonth(key, -1)), b = Store.budget();
    const usedPct = b.monthly > 0 ? Math.floor(cur.expense / b.monthly * 100) : 0, over = cur.expense > b.monthly;
    const cats = expenseByCategory(cur.list), total = sum(cats, c => c.value);
    const recent = cur.list.slice().sort(byDateDesc).slice(0, 5);
    return `
    <div class="grid-4">
      <article class="card stat"><span class="stat-ic green">${icon("wallet", 28)}</span><div><label>Total Income</label><h2>${money(cur.income)}</h2>${deltaHTML(cur.income, prev.income, true)}</div></article>
      <article class="card stat"><span class="stat-ic red">${icon("pie", 28)}</span><div><label>Total Expenses</label><h2>${money(cur.expense)}</h2>${deltaHTML(cur.expense, prev.expense, false)}</div></article>
      <article class="card stat"><span class="stat-ic blue">${icon("coins", 28)}</span><div><label>Balance</label><h2 class="${cur.balance < 0 ? "neg" : ""}">${money(cur.balance)}</h2><small class="muted">This month</small></div></article>
      <article class="card stat has-bar"><span class="stat-ic purple">${icon("target", 28)}</span><div class="grow"><label>Monthly Budget</label><h2>${money(b.monthly)}</h2></div>
        <div class="stat-bar"><div class="progress ${over ? "over" : ""}"><i style="width:${Math.min(100, usedPct)}%"></i></div><div class="progress-label"><span class="${over ? "neg" : "good"}">${usedPct}% used</span><span>${over ? "Over budget" : Math.max(0, 100 - usedPct) + "% left"}</span></div></div></article>
    </div>
    <div class="dash-mid">
      <article class="card panel"><div class="panel-head"><h3>Income vs Expenses</h3><span class="legend-inline"><i class="dot g"></i>Income <i class="dot r"></i>Expense</span></div><div class="chart" id="barChart"></div></article>
      <article class="card panel"><div class="panel-head"><h3>Expense by Category</h3><a class="link" href="#/reports">View report</a></div>
        ${total ? `<div class="donut-layout"><div class="donut" id="donut"><div class="donut-svg"></div><div class="donut-center"><b>${money(total)}</b><small>Total spent</small></div></div>
        <div class="legend">${cats.map(c => `<div class="legend-row"><i class="dot" style="background:${c.color}"></i><span>${esc(c.name)}</span><b>${Math.round(c.value / total * 100)}%</b></div>`).join("")}</div></div>` : emptyBlock("No expenses recorded for this month.")}</article>
      <article class="card panel"><div class="panel-head"><h3>Top Categories</h3><a class="link" href="#/categories">View all</a></div>
        ${total ? cats.slice(0, 6).map(c => `<div class="top-row"><span class="cat-badge" style="--c:${c.color};width:28px;height:28px">${icon(c.icon, 15)}</span><span class="name">${esc(c.name)}</span><strong>${Math.round(c.value / total * 100)}%</strong><div class="mini"><span style="width:${Math.round(c.value / cats[0].value * 100)}%;background:${c.color}"></span></div></div>`).join("") : emptyBlock("Add an expense to see your top categories.")}</article>
    </div>
    <div class="dash-bottom">
      <article class="card panel"><div class="panel-head"><h3>Recent Transactions</h3><a class="link" href="#/transactions">View All →</a></div>
        ${recent.length ? `<div class="scroll"><table class="table"><thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Amount</th><th>Type</th><th class="ctr">Action</th></tr></thead><tbody>${recent.map(txRowHTML).join("")}</tbody></table></div>` : emptyBlock("No transactions in " + monthLabel(key) + " yet.", `<a class="btn btn-primary" href="#/add-expense">Add an expense</a>`)}</article>
      <article class="stay"><small>STAY ON TRACK</small><h2>Manage your budget and achieve your financial goals.</h2><p>Small steps today can build better money habits tomorrow.</p><a class="btn btn-white" href="#/reports">View Reports　→</a><span class="leaf" aria-hidden="true">✳</span></article>
    </div>`;
  },
  mount() {
    const keys = lastMonthKeys(State.month, 6), cats = expenseByCategory(monthStats(State.month).list);
    Charts.bars($("#barChart"), monthlySeries(keys));
    if ($("#donut")) Charts.donut($("#donut"), cats);
  }
};

/* ============================ ADD EXPENSE / ADD INCOME ============================ */
function entryPage(type) {
  const isExp = type === "Expense";
  return {
    title: () => isExp ? "Add Expense" : "Add Income",
    subtitle: () => isExp ? "Record your daily expenses" : "Record your income sources",
    render() {
      const recent = Store.transactions().filter(t => t.type === type).sort(byDateDesc).slice(0, isExp ? 4 : 3);
      return `<div class="two-col">
      <section class="card form-card"><h2>${isExp ? "Expense Details" : "Income Details"}</h2>${isExp ? "" : `<p class="sub">Enter the details of your income</p>`}
        <form id="txForm" novalidate>${txFieldsHTML(type, { date: defaultDate() })}
          <div class="actions"><button type="submit" class="btn btn-primary btn-lg grow">${icon("save", 20)} Save ${type}</button><button type="button" class="btn btn-light btn-lg" id="clearBtn">Clear</button></div></form></section>
      <aside class="card recent-card"><div class="panel-head"><h3>Recent ${isExp ? "Expenses" : "Income"}</h3><a class="link" href="#/transactions" data-tx-type="${type}">View All${isExp ? "" : " →"}</a></div>
        ${recent.length ? recent.map(t => `<div class="recent-row">${catBadge(type, t.cat, 46)}<div class="grow"><b>${esc(t.desc)}</b></div><div class="right"><b>${money(t.amount)}</b><small>${fmtDate(t.date)}</small></div></div>`).join("") : emptyBlock("Nothing recorded yet.")}</aside></div>`;
    },
    mount(view) {
      const form = $("#txForm", view); bindTxForm(form, type);
      form.addEventListener("submit", async e => {
        e.preventDefault();
        const data = readTxForm(form, type); if (!data) return;
        const btn = $('button[type="submit"]', form); btn.disabled = true;
        try { await Store.addTransaction(data); toast(`${type} of ${money(data.amount)} saved to MySQL.` + (monthKey(data.date) !== State.month ? ` It is dated ${monthLabel(monthKey(data.date))} – change the month selector to see it.` : "")); refresh(); }
        catch(err) { toast(err.message || "Could not save transaction.", "error"); btn.disabled = false; }
      });
      $("#clearBtn", view).addEventListener("click", () => refresh());
    }
  };
}
Pages["add-expense"] = entryPage("Expense");
Pages["add-income"] = entryPage("Income");

/* ---------- add / edit pop-up (used by Transactions and the dashboard) ---------- */
function openTxModal(id) {
  const existing = id ? Store.transactions().find(t => String(t.id) === String(id)) : null;
  let type = existing ? existing.type : "Expense";
  const m = openModal({ title: existing ? "Edit transaction" : "Add transaction", wide: true, html: `<form id="txEdit" novalidate><div class="seg" role="group" aria-label="Transaction type"><button type="button" data-type="Expense">Expense</button><button type="button" data-type="Income">Income</button></div><div id="txFields"></div><div class="actions end"><button type="button" class="btn btn-light" data-close>Cancel</button><button type="submit" class="btn btn-primary">${icon("save", 18)} Save</button></div></form>` });
  const form = $("#txEdit", m.el);
  const draw = (vals) => {
    $$(".seg button", form).forEach(b => { b.classList.toggle("on", b.dataset.type === type); b.setAttribute("aria-pressed", b.dataset.type === type); });
    $("#txFields", form).innerHTML = txFieldsHTML(type, vals); bindTxForm(form, type);
  };
  draw(existing ? existing : { date: defaultDate() });
  $$(".seg button", form).forEach(b => b.addEventListener("click", () => {
    if (b.dataset.type === type) return;
    const keep = { amount: $("#amount", form).value, date: $("#date", form).value, desc: $("#desc", form).value };
    type = b.dataset.type; draw(keep);
  }));
  $$("[data-close]", form).forEach(b => b.addEventListener("click", m.close));
  form.addEventListener("submit", async e => {
    e.preventDefault(); const data = readTxForm(form, type); if (!data) return;
    const btn = $('button[type="submit"]', form); btn.disabled = true;
    try { if (existing) await Store.updateTransaction(existing.id, data); else await Store.addTransaction(data); m.close(); toast(existing ? "Transaction updated in MySQL." : "Transaction saved to MySQL."); refresh(); }
    catch(err) { toast(err.message || "Could not save transaction.", "error"); btn.disabled = false; }
  });
}
async function deleteTx(id) {
  const t = Store.transactions().find(x => String(x.id) === String(id));   // data-del is a string, ids are numbers
  if (!t) { toast("That transaction no longer exists. Refreshing the list…", "error"); try { await Store.init(); } catch (e) {} refresh(); return; }
  const yes = await confirmDialog({ title: "Delete transaction", message: `Delete <b>${esc(t.desc)}</b> (${money(t.amount)} on ${fmtDate(t.date)})? This cannot be undone.`, confirmText: "Delete", danger: true, iconName: "trash" });
  if (yes) {
    try { await Store.deleteTransaction(t.id); toast("Transaction deleted from MySQL."); refresh(); }
    catch(err) {
      toast(err.message || "Could not delete transaction.", "error");
      try { await Store.init(); refresh(); } catch (e) {}     // e.g. 404: someone already removed it - resync with MySQL
    }
  }
}

/* ============================ TRANSACTIONS ============================ */
Pages.transactions = {
  title: () => "Transactions", subtitle: () => "View and manage all your income and expenses.",
  render() {
    const f = State.tx;
    return `<section class="card">
      <div class="filters">
        <label class="search-box">${icon("search", 18)}<input id="txSearch" type="search" placeholder="Search transactions..." value="${esc(f.q)}" aria-label="Search transactions"></label>
        <div class="select-wrap plain"><select id="txType" aria-label="Type">${options(["All Types", "Income", "Expense"], f.type)}</select><span class="select-chev">${icon("chevron", 16)}</span></div>
        <div class="select-wrap plain"><select id="txCat" aria-label="Category">${options(["All Categories", ...allCategoryNames()], f.cat)}</select><span class="select-chev">${icon("chevron", 16)}</span></div>
        <div class="range-pill">${icon("calendar", 18)}<input type="date" id="txFrom" value="${f.from}" aria-label="From date"><span>–</span><input type="date" id="txTo" value="${f.to}" aria-label="To date"></div>
        <button class="btn btn-primary" id="addTx">${icon("plus", 18)} Add Transaction</button>
      </div>
      <div class="scroll"><table class="table big"><thead><tr><th>${sortBtn("date", "Date")}</th><th>Description</th><th>Category</th><th>${sortBtn("amount", "Amount")}</th><th>${sortBtn("type", "Type")}</th><th class="ctr">Action</th></tr></thead><tbody id="txBody"></tbody></table></div>
      <div class="table-foot"><span id="txCount"></span><nav class="pager" id="txPager" aria-label="Pagination"></nav></div></section>`;
  },
  mount(view) {
    const f = State.tx;
    $("#txSearch", view).addEventListener("input", e => { f.q = e.target.value; f.page = 1; drawTx(); });
    $("#txType", view).addEventListener("change", e => { f.type = e.target.value; f.page = 1; drawTx(); });
    $("#txCat", view).addEventListener("change", e => { f.cat = e.target.value; f.page = 1; drawTx(); });
    const range = ev => {
      const a = $("#txFrom", view).value, b = $("#txTo", view).value;
      let from = a, to = b;
      if (from && to && from > to) {
        // The picker still held the old bound from the previous month. Keep the date the user just
        // chose and open the other end instead of rejecting the choice.
        if (ev && ev.target && ev.target.id === "txTo") from = ""; else to = "";
        $("#txFrom", view).value = from; $("#txTo", view).value = to;
        toast("Start date was after end date, so the other date was cleared.");
      }
      f.from = from; f.to = to; f.page = 1; drawTx();
    };
    $("#txFrom", view).addEventListener("change", range); $("#txTo", view).addEventListener("change", range);
    $("#addTx", view).addEventListener("click", () => openTxModal());
    $$("[data-sort]", view).forEach(b => b.addEventListener("click", () => {
      f.sortDir = f.sortKey === b.dataset.sort && f.sortDir === "desc" ? "asc" : "desc"; f.sortKey = b.dataset.sort; drawTx();
    }));
    $("#txPager", view).addEventListener("click", e => { const b = e.target.closest("[data-page]"); if (b && !b.disabled) { f.page = +b.dataset.page; drawTx(); } });
    view.addEventListener("click", e => { if (e.target.closest("[data-clear-filters]")) { State.resetTx(); refresh(); } });
    drawTx();
  }
};
function sortBtn(key, label) {
  const f = State.tx, on = f.sortKey === key;
  return `<button type="button" class="th-sort ${on ? "on" : ""}" data-sort="${key}" aria-label="Sort by ${label}">${label} ${icon("sort", 13)}</button>`;
}
function filteredTx() {
  const f = State.tx, q = f.q.trim().toLowerCase();
  const list = Store.transactions().filter(t =>
    (!q || (t.desc + " " + t.cat + " " + (t.method || "")).toLowerCase().includes(q)) &&
    (f.type === "All Types" || t.type === f.type) && (f.cat === "All Categories" || t.cat === f.cat) &&
    (!f.from || t.date >= f.from) && (!f.to || t.date <= f.to));
  const dir = f.sortDir === "asc" ? 1 : -1;
  return list.sort((a, b) => dir * (f.sortKey === "amount" ? a.amount - b.amount : f.sortKey === "type" ? a.type.localeCompare(b.type) : a.date.localeCompare(b.date) || String(a.id).localeCompare(String(b.id), undefined, { numeric: true })));
}
function drawTx() {
  const f = State.tx, list = filteredTx(), per = Store.settings().rowsPerPage, pages = Math.max(1, Math.ceil(list.length / per));
  f.page = Math.min(Math.max(1, f.page), pages);
  const start = (f.page - 1) * per, rows = list.slice(start, start + per);
  $("#txBody").innerHTML = rows.length ? rows.map(txRowHTML).join("") : `<tr><td colspan="6">${emptyBlock("No transactions match your filters.", `<button class="btn btn-light" data-clear-filters>Clear filters</button>`)}</td></tr>`;
  $("#txCount").textContent = list.length ? `Showing ${start + 1}–${start + rows.length} of ${list.length} transactions` : "Showing 0 transactions";
  const set = new Set([1, 2, f.page - 1, f.page, f.page + 1, pages - 1, pages].filter(p => p >= 1 && p <= pages));
  const nums = [...set].sort((a, b) => a - b); let html = `<button data-page="${f.page - 1}" ${f.page === 1 ? "disabled" : ""} aria-label="Previous page">${icon("chevleft", 16)}</button>`, last = 0;
  nums.forEach(p => { if (p - last > 1) html += `<span class="gap">…</span>`; html += `<button data-page="${p}" class="${p === f.page ? "on" : ""}" ${p === f.page ? 'aria-current="page"' : ""}>${p}</button>`; last = p; });
  html += `<button data-page="${f.page + 1}" ${f.page === pages ? "disabled" : ""} aria-label="Next page">${icon("chevright", 16)}</button>`;
  $("#txPager").innerHTML = html;
  $$("[data-sort]").forEach(b => b.classList.toggle("on", b.dataset.sort === f.sortKey));
}

/* ============================ BUDGET ============================ */
Pages.budget = {
  title: () => "Budget", subtitle: () => "Set monthly budget and track your spending.",
  render() {
    const b = Store.budget(), key = State.month, cur = monthStats(key), prev = monthStats(shiftMonth(key, -1));
    const spent = {}; cur.list.filter(t => t.type === "Expense").forEach(t => { spent[t.cat] = (spent[t.cat] || 0) + t.amount; });
    const used = b.monthly > 0 ? Math.floor(cur.expense / b.monthly * 100) : 0, remaining = b.monthly - cur.expense, over = cur.expense > b.monthly;
    const rows = Store.categories().Expense.map(c => {
      const lim = b.cats[c.name] || 0, sp = spent[c.name] || 0, rem = lim - sp, p = lim > 0 ? Math.round(sp / lim * 100) : null;
      return `<tr><td><span class="cat-cell">${catBadge("Expense", c.name, 34)}${esc(c.name)}</span></td><td class="num">${lim > 0 ? money(lim) : '<span class="muted">Not set</span>'}</td><td class="num">${money(sp)}</td><td class="num ${lim > 0 && rem < 0 ? "neg" : ""}">${lim > 0 ? money(rem) : "—"}</td>
      <td>${p === null ? '<span class="muted">—</span>' : `<div class="prog-cell"><span class="${p > 100 ? "neg" : ""}">${p}%</span><div class="progress thin"><i style="width:${Math.min(100, p)}%;background:${p > 100 ? "#ef5358" : c.color}"></i></div></div>`}</td>
      <td class="ctr"><button class="row-action edit" data-budget-cat="${esc(c.name)}" aria-label="Edit ${esc(c.name)} budget">${icon("pencil", 17)}</button></td></tr>`;
    }).join("");
    return `<div class="grid-3">
      <article class="card stat has-bar"><span class="stat-ic purple">${icon("target", 28)}</span><div class="grow"><label>Monthly Budget</label><h2>${money(b.monthly)}</h2></div><div class="stat-bar"><div class="progress ${over ? "over" : ""}"><i style="width:${Math.min(100, used)}%"></i></div><div class="progress-label"><span class="${over ? "neg" : "good"}">${used}% used</span><span>${over ? "Over budget" : Math.max(0, 100 - used) + "% left"}</span></div></div></article>
      <article class="card stat"><span class="stat-ic red">${icon("pie", 28)}</span><div><label>Total Spent</label><h2>${money(cur.expense)}</h2>${deltaHTML(cur.expense, prev.expense, false)}</div></article>
      <article class="card stat"><span class="stat-ic green">${icon("wallet", 28)}</span><div><label>Remaining</label><h2 class="${remaining < 0 ? "neg" : ""}">${money(remaining)}</h2>${deltaHTML(remaining, b.monthly - prev.expense, true)}</div></article></div>
    <section class="card panel big-panel"><div class="panel-head"><h3 class="lg">Category Wise Budget</h3><button class="btn btn-primary" id="setBudget">${icon("plus", 18)} Set Budget</button></div>
      <div class="scroll"><table class="table big"><thead><tr><th>Category</th><th class="num">Budget (${esc(CURRENCIES[Store.settings().currency].symbol)})</th><th class="num">Spent (${esc(CURRENCIES[Store.settings().currency].symbol)})</th><th class="num">Remaining (${esc(CURRENCIES[Store.settings().currency].symbol)})</th><th>Progress</th><th class="ctr">Action</th></tr></thead><tbody>${rows}</tbody></table></div>
      <p class="note">Spending is calculated from your saved MySQL transactions for ${monthLabel(key)}. Budgets are saved separately for each month.</p></section>`;
  },
  mount(view) {
    $("#setBudget", view).addEventListener("click", () => openBudgetModal());
    $$("[data-budget-cat]", view).forEach(b => b.addEventListener("click", () => openBudgetModal(b.dataset.budgetCat)));
  }
};
function openBudgetModal(focusCat) {
  const b = Store.budget(), cats = Store.categories().Expense;
  const m = openModal({ title: "Set budget", wide: true, html: `<form id="budgetForm" novalidate>
    <div class="field" data-field="monthly"><label for="monthly">Monthly budget</label><div class="input-prefix"><span>${esc(CURRENCIES[Store.settings().currency].symbol)}</span><input id="monthly" name="monthly" type="number" min="1" step="1" value="${b.monthly}"></div><small class="err"></small></div>
    <h4 class="mt">Category budgets <small class="muted">(0 = no limit)</small></h4>
    <div class="form-grid">${cats.map((c, i) => `<div class="field" data-field="c${i}"><label for="c${i}">${esc(c.name)}</label><div class="input-prefix"><span>${esc(CURRENCIES[Store.settings().currency].symbol)}</span><input id="c${i}" data-cat="${esc(c.name)}" type="number" min="0" step="1" value="${b.cats[c.name] || 0}"></div><small class="err"></small></div>`).join("")}</div>
    <p class="note" id="budgetTotal"></p>
    <div class="actions end"><button type="button" class="btn btn-light" data-close>Cancel</button><button type="submit" class="btn btn-primary">${icon("save", 18)} Save budget</button></div></form>` });
  const form = $("#budgetForm", m.el);
  const upd = () => { const t = sum($$("[data-cat]", form), i => Number(i.value) || 0), mo = Number($("#monthly", form).value) || 0; $("#budgetTotal").textContent = `Category budgets add up to ${money(t)}` + (t > mo ? ` – that is more than your monthly budget (${money(mo)}).` : "."); };
  form.addEventListener("input", upd); upd();
  if (focusCat) { const i = $(`[data-cat="${CSS.escape(focusCat)}"]`, form); if (i) { i.focus(); i.select(); } }
  $$("[data-close]", form).forEach(x => x.addEventListener("click", m.close));
  form.addEventListener("submit", async e => {
    e.preventDefault(); clearErrors(form); let ok = true;
    const mo = Number($("#monthly", form).value); if (!isFinite(mo) || mo <= 0 || mo > 1e9) { setError(form, "monthly", "Enter a monthly budget greater than 0."); ok = false; }
    const out = {}; cats.forEach((c, i) => { const v = Number($(`#c${i}`, form).value); if (!isFinite(v) || v < 0 || v > 1e9) { setError(form, "c" + i, "Enter 0 or a positive amount."); ok = false; } else out[c.name] = v; });
    if (!ok) return;
    try { await Store.saveBudget({ monthly: mo, cats: out }); m.close(); toast("Budget saved to MySQL."); refresh(); } catch(err) { toast(err.message || "Could not save budget.", "error"); }
  });
}

/* ============================ CATEGORIES ============================ */
Pages.categories = {
  title: () => "Categories", subtitle: () => "Manage your expense and income categories.",
  render() {
    const type = State.catTab, list = Store.categories()[type], txs = Store.transactions();
    return `<section class="card cat-card"><div class="tabs-row"><div class="tabs" role="tablist"><button role="tab" class="${type === "Expense" ? "on" : ""}" data-tab="Expense">Expense Categories</button><button role="tab" class="${type === "Income" ? "on" : ""}" data-tab="Income">Income Categories</button></div><button class="btn btn-primary" id="addCat">${icon("plus", 18)} Add Category</button></div>
      <div class="cat-grid">${list.length ? list.map(c => { const n = txs.filter(t => t.type === type && t.cat === c.name).length; return `<div class="cat-item"><span class="cat-badge" style="--c:${c.color};width:64px;height:64px;border-radius:12px">${icon(c.icon, 30)}</span><div class="grow"><b>${esc(c.name)}</b><small>${n} transaction${n === 1 ? "" : "s"}</small></div><button class="row-action edit" data-cat-edit="${esc(c.name)}" aria-label="Edit ${esc(c.name)}">${icon("pencil", 18)}</button><button class="row-action delete" data-cat-del="${esc(c.name)}" aria-label="Delete ${esc(c.name)}">${icon("trash", 18)}</button></div>`; }).join("") : emptyBlock("No categories yet. Add one to get started.")}</div></section>`;
  },
  mount(view) {
    $$("[data-tab]", view).forEach(b => b.addEventListener("click", () => { State.catTab = b.dataset.tab; refresh(); }));
    $("#addCat", view).addEventListener("click", () => openCategoryModal(State.catTab));
    $$("[data-cat-edit]", view).forEach(b => b.addEventListener("click", () => openCategoryModal(State.catTab, b.dataset.catEdit)));
    $$("[data-cat-del]", view).forEach(b => b.addEventListener("click", async () => {
      const name = b.dataset.catDel, n = Store.transactions().filter(t => t.type === State.catTab && t.cat === name).length;
      if (n > 0) return toast(`"${name}" is used by ${n} transaction${n === 1 ? "" : "s"}. Edit or delete those first.`, "error");
      if (!(await confirmDialog({ title: "Delete category", message: `Delete the category <b>${esc(name)}</b>?`, confirmText: "Delete", danger: true, iconName: "trash" }))) return;
      const c = Store.categories(); c[State.catTab] = c[State.catTab].filter(x => x.name !== name);
      try { await Store.saveCategories(c); if (State.catTab === "Expense") { const bd = Store.budget(); delete bd.cats[name]; await Store.saveBudget(bd); } toast("Category deleted from MySQL."); refresh(); } catch(err) { toast(err.message || "Could not delete category.", "error"); }
    }));
  }
};
function openCategoryModal(type, oldName) {
  const cats = Store.categories(), existing = oldName ? cats[type].find(c => c.name === oldName) : null;
  let ic = existing ? existing.icon : "star", col = existing ? existing.color : COLOR_CHOICES[0];
  const m = openModal({ title: existing ? "Edit category" : `Add ${type.toLowerCase()} category`, html: `<form id="catForm" novalidate>
    <div class="field" data-field="name"><label for="catName">Category name</label><input id="catName" name="name" maxlength="24" value="${esc(oldName || "")}" placeholder="e.g. Health"><small class="err"></small></div>
    <div class="field"><label>Icon</label><div class="pick-grid" id="icPick">${ICON_CHOICES.map(n => `<button type="button" data-ic="${n}" aria-label="${n}">${icon(n, 20)}</button>`).join("")}</div></div>
    <div class="field"><label>Colour</label><div class="pick-grid" id="colPick">${COLOR_CHOICES.map(c => `<button type="button" class="sw" data-col="${c}" style="background:${c}" aria-label="Colour ${c}"></button>`).join("")}</div></div>
    <div class="preview"><span id="catPrev"></span><b id="catPrevName"></b></div>
    <div class="actions end"><button type="button" class="btn btn-light" data-close>Cancel</button><button type="submit" class="btn btn-primary">${icon("save", 18)} Save</button></div></form>` });
  const form = $("#catForm", m.el);
  const paint = () => {
    $$("[data-ic]", form).forEach(b => b.classList.toggle("on", b.dataset.ic === ic)); $$("[data-col]", form).forEach(b => b.classList.toggle("on", b.dataset.col === col));
    $("#catPrev").innerHTML = `<span class="cat-badge" style="--c:${col};width:44px;height:44px">${icon(ic, 22)}</span>`; $("#catPrevName").textContent = $("#catName").value.trim() || "Category name";
  };
  $$("[data-ic]", form).forEach(b => b.addEventListener("click", () => { ic = b.dataset.ic; paint(); }));
  $$("[data-col]", form).forEach(b => b.addEventListener("click", () => { col = b.dataset.col; paint(); }));
  $("#catName", form).addEventListener("input", () => { setError(form, "name", ""); paint(); }); paint();
  $$("[data-close]", form).forEach(x => x.addEventListener("click", m.close));
  form.addEventListener("submit", async e => {
    e.preventDefault(); const name = $("#catName", form).value.trim().replace(/\s+/g, " ");
    if (!name) return setError(form, "name", "Enter a category name.");
    if (cats[type].some(c => c.name.toLowerCase() === name.toLowerCase() && c.name !== oldName)) return setError(form, "name", "That category already exists.");
    if (existing) {
      Object.assign(existing, { name, icon: ic, color: col });
      if (name !== oldName) {
        await Store.saveTransactions(Store.transactions().map(t => t.type === type && t.cat === oldName ? { ...t, cat: name } : t));
        if (type === "Expense") { const bd = Store.budget(); if (oldName in bd.cats) { bd.cats[name] = bd.cats[oldName]; delete bd.cats[oldName]; await Store.saveBudget(bd); } }
      }
    } else cats[type].push({ name, icon: ic, color: col });
    try { await Store.saveCategories(cats); m.close(); toast(existing ? "Category updated in MySQL." : "Category added to MySQL."); refresh(); } catch(err) { toast(err.message || "Could not save category.", "error"); }
  });
}

/* ============================ REPORTS ============================ */
Pages.reports = {
  title: () => "Reports & Analytics", subtitle: () => "Analyze your spending patterns and get detailed insights.",
  render() {
    const r = State.rep;
    return `<section class="card filters report-filters">
      <div class="range-label"><span class="icon-box">${icon("calendar", 20)}</span><b>Date Range</b></div>
      <div class="range-pill">${icon("calendar", 18)}<input type="date" id="repFrom" value="${r.from}" aria-label="From date"><span>–</span><input type="date" id="repTo" value="${r.to}" aria-label="To date"></div>
      <div class="range-label"><span class="icon-box">${icon("grid", 20)}</span><b>Category</b></div>
      <div class="select-wrap plain"><select id="repCat" aria-label="Category">${options(["All Categories", ...allCategoryNames()], r.cat)}</select><span class="select-chev">${icon("chevron", 16)}</span></div>
      <div class="btn-group"><button class="btn btn-light" id="csvBtn">${icon("download", 18)} CSV</button><button class="btn btn-primary" id="pdfBtn">${icon("download", 18)} Download PDF Report</button></div></section>
    <div class="print-only"><h2>Smart Expense Tracker – Report</h2><p id="printRange"></p></div>
    <div class="grid-2">
      <article class="card panel"><div class="panel-head"><h3 class="lg">Income vs Expenses</h3><span class="legend-inline"><i class="dot g"></i>Income <i class="dot r"></i>Expense</span></div><div class="chart tall" id="repBar"></div></article>
      <article class="card panel"><div class="panel-head"><h3 class="lg">Expense by Category</h3></div><div id="repDonutBox"></div></article>
      <article class="card panel"><div class="panel-head"><h3 class="lg">Monthly Spending Trend</h3><span class="legend-inline"><i class="dot g"></i>Income <i class="dot r"></i>Expense</span></div><div class="chart tall" id="repArea"></div></article>
      <article class="card panel"><div class="panel-head"><h3 class="lg">Category Summary</h3></div><div id="repSummary"></div></article></div>`;
  },
  mount(view) {
    const r = State.rep;
    const draw = () => {
      Charts.reset();
      const catOk = t => r.cat === "All Categories" || t.cat === r.cat;
      const inRange = Store.transactions().filter(t => catOk(t) && (!r.from || t.date >= r.from) && (!r.to || t.date <= r.to));
      const endKey = monthKey(r.to || monthEnd(State.month)), series = monthlySeries(lastMonthKeys(endKey, 6), catOk);
      Charts.bars($("#repBar"), series); Charts.area($("#repArea"), series);
      const cats = expenseByCategory(inRange), total = sum(cats, c => c.value);
      $("#repDonutBox").innerHTML = total ? `<div class="donut-layout big"><div class="donut" id="repDonut"><div class="donut-svg"></div><div class="donut-center"><b>${money(total)}</b><small>Total Spent</small></div></div><div class="legend">${cats.map(c => `<div class="legend-row"><i class="dot" style="background:${c.color}"></i><span>${esc(c.name)}</span><b>${Math.round(c.value / total * 100)}%</b></div>`).join("")}</div></div>` : emptyBlock("No expenses in this range.");
      if (total) Charts.donut($("#repDonut"), cats);
      $("#repSummary").innerHTML = total ? `<div class="scroll"><table class="table summary"><thead><tr><th>Category</th><th class="num">Amount (${esc(CURRENCIES[Store.settings().currency].symbol)})</th><th>Percentage</th></tr></thead><tbody>${cats.map(c => { const p = Math.round(c.value / total * 100); return `<tr><td><span class="cat-cell">${catBadge("Expense", c.name, 26)}${esc(c.name)}</span></td><td class="num">${money(c.value)}</td><td><div class="prog-cell"><span>${p}%</span><div class="progress thin"><i style="width:${p}%;background:${c.color}"></i></div></div></td></tr>`; }).join("")}</tbody></table></div>` : emptyBlock("No expenses in this range.");
      $("#printRange").textContent = `${fmtDate(r.from)} – ${fmtDate(r.to)} · ${r.cat}`;
    };
    const range = () => {
      const a = $("#repFrom", view).value, b = $("#repTo", view).value;
      if (!a || !b) return toast("Choose both dates.", "error");
      if (a > b) { toast("The start date must be before the end date.", "error"); $("#repFrom", view).value = r.from; $("#repTo", view).value = r.to; return; }
      r.from = a; r.to = b; draw();
    };
    $("#repFrom", view).addEventListener("change", range); $("#repTo", view).addEventListener("change", range);
    $("#repCat", view).addEventListener("change", e => { r.cat = e.target.value; draw(); });
    $("#pdfBtn", view).addEventListener("click", () => { toast("In the print window, choose “Save as PDF”."); setTimeout(() => window.print(), 400); });
    $("#csvBtn", view).addEventListener("click", () => {
      const rows = Store.transactions().filter(t => (r.cat === "All Categories" || t.cat === r.cat) && t.date >= r.from && t.date <= r.to).sort(byDateDesc);
      if (!rows.length) return toast("There are no transactions in this range to export.", "error");
      const safe = v => { let s = String(v ?? ""); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return `"${s.replace(/"/g, '""')}"`; };
      const csv = "\ufeffDate,Description,Category,Type,Payment Method,Amount\n" + rows.map(t => [t.date, t.desc, t.cat, t.type, t.method || "", t.amount].map(safe).join(",")).join("\n");
      const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); a.download = `smart-expense-report_${r.from}_to_${r.to}.csv`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      toast("CSV report downloaded.");
    });
    draw();
  }
};

/* ============================ PROFILE ============================ */
function avatarHTML(p, big = false) { return p.photo ? `<img src="${esc(p.photo)}" alt="${esc(p.name)}">` : esc((p.name.trim()[0] || "?").toUpperCase()); }
function resizePhoto(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => { const img = new Image(); img.onload = () => { const c = document.createElement("canvas"); c.width = c.height = 256; const m = Math.min(img.width, img.height); c.getContext("2d").drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, 256, 256); resolve(c.toDataURL("image/jpeg", 0.85)); }; img.onerror = reject; img.src = fr.result; };
    fr.onerror = reject; fr.readAsDataURL(file);
  });
}
Pages.profile = {
  title: () => "Profile", subtitle: () => "View and update your personal details.",
  render() {
    const p = Store.profile();
    return `<section class="card profile-card"><div class="card-head"><div><h2>Profile Information</h2><p class="sub">Manage your personal details and account information.</p></div><button class="btn btn-light" id="editProfile" type="button">${icon("pencil", 18)} <span>Edit Profile</span></button></div>
    <form id="profileForm" novalidate class="profile-grid">
      <div class="photo-col"><div class="avatar-big" id="bigAvatar">${avatarHTML(p)}</div><label class="btn btn-light" for="photoInput">${icon("upload", 18)} Change Photo</label><input type="file" id="photoInput" accept="image/jpeg,image/png,image/gif" hidden><small class="muted">JPG, PNG or GIF (Max 2MB)</small><small class="err" id="photoErr"></small></div>
      <div class="form-grid">
        <div class="field full" data-field="name"><label for="pName">Full Name</label><input id="pName" name="name" value="${esc(p.name)}" readonly maxlength="60"><small class="err"></small></div>
        <div class="field full" data-field="email"><label for="pEmail">Email Address</label><input id="pEmail" name="email" type="email" value="${esc(p.email)}" readonly maxlength="100"><small class="muted">Your email is your login, so it can’t be changed here.</small><small class="err"></small></div>
        <div class="field" data-field="phone"><label for="pPhone">Phone Number</label><input id="pPhone" name="phone" type="tel" value="${esc(p.phone)}" readonly maxlength="20"><small class="err"></small></div>
        <div class="field" data-field="dob"><label for="pDob">Date of Birth</label><input id="pDob" name="dob" type="date" value="${esc(p.dob)}" readonly><small class="err"></small></div>
        <div class="field" data-field="joined"><label for="pJoined">Joined On</label><input id="pJoined" value="${esc(fmtDate(p.joined))}" disabled></div><div></div>
        <div class="field full" data-field="about"><label for="pAbout">About</label><textarea id="pAbout" name="about" rows="3" maxlength="200" readonly>${esc(p.about)}</textarea><small class="counter" id="aboutCount">${p.about.length}/200</small><small class="err"></small></div>
      </div>
      <button type="submit" class="btn btn-primary btn-lg full-row" id="updateProfile" disabled>${icon("save", 20)} Update Profile</button></form>
    </section>`;
  },
  mount(view) {
    const form = $("#profileForm", view), btn = $("#editProfile", view), upd = $("#updateProfile", view), orig = Store.profile();
    const fields = $$("input[name],textarea[name]", form); let editing = false, photo = orig.photo;
    const setEdit = on => { editing = on; fields.forEach(f => f.readOnly = !on || f.name === "email"); upd.disabled = !on; form.classList.toggle("editing", on); $("span", btn).textContent = on ? "Cancel" : "Edit Profile"; if (on) $("#pName").focus(); };
    btn.addEventListener("click", () => { if (editing) { refresh(); } else setEdit(true); });
    $("#pAbout", view).addEventListener("input", e => { $("#aboutCount").textContent = e.target.value.length + "/200"; });
    fields.forEach(f => f.addEventListener("input", () => setError(form, f.name, "")));
    $("#photoInput", view).addEventListener("change", async e => {
      const file = e.target.files[0]; if (!file) return; const err = $("#photoErr");
      if (!["image/jpeg", "image/png", "image/gif"].includes(file.type)) { err.textContent = "Please choose a JPG, PNG or GIF image."; return; }
      if (file.size > 2 * 1024 * 1024) { err.textContent = "The image is larger than 2MB."; return; }
      try { photo = await resizePhoto(file); err.textContent = ""; $("#bigAvatar").innerHTML = `<img src="${photo}" alt="">`; setEdit(true); toast("Photo ready – click Update Profile to save."); }
      catch (x) { err.textContent = "That image could not be read."; }
    });
    form.addEventListener("submit", async e => {
      e.preventDefault(); clearErrors(form); let ok = true; const bad = (n, m) => { setError(form, n, m); ok = false; };
      const v = { name: $("#pName").value.trim().replace(/\s+/g, " "), phone: $("#pPhone").value.trim(), dob: $("#pDob").value, about: $("#pAbout").value.trim() };
      if (v.name.length < 2 || v.name.length > 100) bad("name", "Enter your full name (2–100 characters).");
      if (v.phone && !(/^[+\d][\d\s\-()]*$/.test(v.phone) && v.phone.replace(/\D/g, "").length >= 7 && v.phone.replace(/\D/g, "").length <= 15)) bad("phone", "Enter a valid phone number (7–15 digits).");
      if (v.dob && (!isValidISODate(v.dob) || v.dob > todayISO())) bad("dob", "Enter a valid date of birth in the past.");
      if (v.about.length > 200) bad("about", "About must be 200 characters or fewer.");
      if (!ok) return;
      upd.disabled = true;
      const res = await apiFetch("/api/profile", { method: "PUT", body: { name: v.name, phone: v.phone, about: v.about } });   // saved in MySQL
      if (!res.ok) { upd.disabled = false; return toast(res.error || "Could not save your profile.", "error"); }
      Auth.user = { ...Auth.user, name: v.name, phone: v.phone, about: v.about };
      Store.saveProfile({ ...orig, ...v, email: orig.email, photo });   // photo and date of birth remain browser-only
      toast("Profile updated."); refresh();
    });
  }
};

/* ============================ SETTINGS ============================ */
const toggleHTML = (id, iconName, title, desc, on) => `<div class="toggle-row"><span class="tg-ic">${icon(iconName, 24)}</span><div class="grow"><b>${title}</b><small>${desc}</small></div><label class="switch"><input type="checkbox" id="${id}" ${on ? "checked" : ""} aria-label="${title}"><span></span></label></div>`;
Pages.settings = {
  title: () => "Settings", subtitle: () => "Manage your account preferences.",
  render() {
    const s = Store.settings(), tab = State.settingsTab;
    const tabs = [["general", "settings", "General"], ["security", "shield", "Security"], ["notifications", "bell", "Notifications"], ["appearance", "monitor", "Appearance"]];
    const sel = (id, label, opts, val) => `<div class="setting-row"><label for="${id}">${label}</label><div class="select-wrap plain"><select id="${id}">${opts}</select><span class="select-chev">${icon("chevron", 16)}</span></div></div>`;
    const panels = {
      general: `<h2>General Settings</h2><p class="sub">Manage your basic account preferences.</p><form id="setForm" novalidate>
        ${sel("sCurrency", "Currency", options(Object.entries(CURRENCIES).map(([k, v]) => ({ value: k, label: v.label })), s.currency))}
        ${sel("sDate", "Date Format", options(Object.entries(DATE_FORMATS).map(([k, v]) => ({ value: k, label: v })), s.dateFormat))}
        ${sel("sLang", "Language", options(["English"], s.language))}
        ${sel("sTheme", "Theme", `<option selected>Light</option><option disabled>Dark (coming soon)</option>`)}
        <div class="toggles">${toggleHTML("sEmail", "mail", "Email Notifications", "Get notified when you add an expense or income.", s.emailNotifications)}${toggleHTML("sAlerts", "target", "Budget Alerts", `Notify me when I reach ${s.alertThreshold}% of my monthly budget.`, s.budgetAlerts)}</div>
        <p class="note">Currency changes only the symbol – amounts are not converted. Email delivery needs the backend, so that switch is saved as a preference only.</p>
        <button class="btn btn-primary btn-lg full-row" type="submit">${icon("save", 20)} Save Changes</button></form>`,
      security: `<h2>Security</h2><p class="sub">Sign-in and data options.</p>
        <div class="info-box">${icon("lock", 22)}<div><b>Password and sign-in</b><p>Passwords, two-step verification and sessions need the Python backend, which is not connected yet, so nothing can be changed here.</p></div></div>
        <h4 class="mt">Data storage</h4><p class="sub">Transactions, budgets and categories are saved in your account’s MySQL database. UI preferences, date of birth and profile photo remain in this browser.</p>
        <div class="actions"><button class="btn btn-light" id="resetSample">Restore sample data</button><button class="btn btn-danger-light" id="clearAll">Delete all transactions</button></div>`,
      notifications: `<h2>Notifications</h2><p class="sub">Choose when budget alerts appear in the bell menu.</p><form id="notifForm" novalidate>
        ${sel("nThreshold", "Alert threshold", options([50, 60, 70, 80, 90, 100].map(n => ({ value: String(n), label: n + "% of budget" })), String(s.alertThreshold)))}
        <div class="toggles">${toggleHTML("nAlerts", "bell", "Show budget alerts", "Show a red dot and a list in the bell menu.", s.budgetAlerts)}</div>
        <button class="btn btn-primary btn-lg full-row" type="submit">${icon("save", 20)} Save Changes</button></form>`,
      appearance: `<h2>Appearance</h2><p class="sub">Adjust how tables look.</p><form id="appForm" novalidate>
        ${sel("aRows", "Rows per page", options([5, 8, 10, 20, 50].map(n => ({ value: String(n), label: String(n) })), String(s.rowsPerPage)))}
        <div class="toggles">${toggleHTML("aCompact", "list", "Compact tables", "Use tighter row spacing in transaction tables.", s.compactTables)}</div>
        <button class="btn btn-primary btn-lg full-row" type="submit">${icon("save", 20)} Save Changes</button></form>`
    };
    return `<section class="card settings-card"><div class="settings-layout"><nav class="settings-tabs" role="tablist">${tabs.map(t => `<button role="tab" class="${tab === t[0] ? "on" : ""}" data-stab="${t[0]}">${icon(t[1], 22)} ${t[2]}</button>`).join("")}</nav><div class="settings-panel">${panels[tab]}</div></div></section>`;
  },
  mount(view) {
    $$("[data-stab]", view).forEach(b => b.addEventListener("click", () => { State.settingsTab = b.dataset.stab; refresh(); }));
    const save = patch => { const ok = Store.saveSettings({ ...Store.settings(), ...patch }); toast(ok ? "Settings saved." : "Could not save – browser storage is full or blocked.", ok ? "" : "error"); refresh(); };
    const on = (id, fn) => { const f = $("#" + id, view); if (f) f.addEventListener("submit", e => { e.preventDefault(); fn(); }); };
    on("setForm", () => save({ currency: $("#sCurrency").value, dateFormat: $("#sDate").value, language: $("#sLang").value, theme: "Light", emailNotifications: $("#sEmail").checked, budgetAlerts: $("#sAlerts").checked }));
    on("notifForm", () => save({ alertThreshold: +$("#nThreshold").value, budgetAlerts: $("#nAlerts").checked }));
    on("appForm", () => save({ rowsPerPage: +$("#aRows").value, compactTables: $("#aCompact").checked }));
    const rs = $("#resetSample", view), ca = $("#clearAll", view);
    if (rs) rs.addEventListener("click", async () => { toast("Sample-data restore is disabled because financial records are now stored in MySQL.", "error"); });
    if (ca) ca.addEventListener("click", async () => { if (await confirmDialog({ title: "Delete all transactions", message: "Delete <b>every</b> transaction for this account from MySQL? This cannot be undone.", confirmText: "Delete all", danger: true, iconName: "trash" })) { try { await Store.clearAllRecords(); toast("All transactions deleted from MySQL."); refresh(); } catch(err) { toast(err.message || "Could not delete transactions.", "error"); } } });
  }
};
