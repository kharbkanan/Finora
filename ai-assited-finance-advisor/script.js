// ========== API CONFIG ==========
const API_BASE_URL = "http://127.0.0.1:8000";

async function apiRequest(path, options = {}) {
  const token = sessionStorage.getItem("afa_access_token");

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      typeof data.detail === "string"
        ? data.detail
        : "Request failed. Please try again.";

    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return data;
}

// ========== AUTH VISIBILITY ==========
function setAuthVisibility(isLoggedIn) {
  const authScreen = document.getElementById("authScreen");
  const appShell = document.getElementById("appShell");

  if (!authScreen || !appShell) {
    console.error(
      "Missing #authScreen or #appShell in index.html."
    );
    return;
  }

  authScreen.style.display = isLoggedIn ? "none" : "flex";
  appShell.style.display = isLoggedIn ? "block" : "none";
}

// ========== USER PROFILE ==========

let currentUserEmail = "";

function updateUserProfile(email){

  currentUserEmail = email || currentUserEmail;

  const userEmail=document.getElementById("userEmail");
  const userName=document.getElementById("userName");
  const avatar=document.getElementById("userAvatar");
  const greeting=document.getElementById("greetingText");

  if(!currentUserEmail) return;

  const name=currentUserEmail.split("@")[0];

  const displayName=name
      .replace(/[._-]/g," ")
      .replace(/\b\w/g,c=>c.toUpperCase());

  const hour=new Date().getHours();

  let greet="Hello";

  if(hour<12) greet="Good Morning";
  else if(hour<17) greet="Good Afternoon";
  else greet="Good Evening";

  userEmail.textContent=currentUserEmail;
  userName.textContent=displayName;
  avatar.textContent=displayName.charAt(0).toUpperCase();

  if(greeting){
      greeting.textContent=`${greet}, ${displayName}!`;
  }
}

// ========== LOGIN / SIGNUP ==========
let authMode = "login";

function updateAuthMode() {
  const registering = authMode === "register";

  document.getElementById("authHeading").textContent =
    registering ? "Create your account" : "Login to your account";

  document.getElementById("authSubmit").textContent =
    registering ? "Create account" : "Login";

  document.getElementById("authSwitchText").textContent =
    registering
      ? "Already have an account?"
      : "Don't have an account?";

  document.getElementById("authSwitch").textContent =
    registering ? "Login" : "Sign up";

  document.getElementById("authPassword").autocomplete =
    registering ? "new-password" : "current-password";

  document.getElementById("authError").textContent = "";
}

function logout() {
  sessionStorage.removeItem("afa_access_token");
  sessionStorage.removeItem("afa_user_email");

  localStorage.removeItem("afa_tx");
  localStorage.removeItem("afa_budgets");
  localStorage.removeItem("afa_goals");

  transactions = [];
  budgets = [];
  goals = [];

  setAuthVisibility(false);

  const authForm = document.getElementById("authForm");
  const authError = document.getElementById("authError");

  if (authForm) authForm.reset();
  if (authError) authError.textContent = "";

  authMode = "login";
  updateAuthMode();

  toast("You have been logged out.");
}

document.getElementById("authSwitch").addEventListener("click", () => {
  authMode = authMode === "login" ? "register" : "login";
  updateAuthMode();
});

async function handleAuthSubmit(event) {
  event.preventDefault();

  const email = document
    .getElementById("authEmail")
    .value.trim()
    .toLowerCase();

  const password = document.getElementById("authPassword").value;
  const submit = document.getElementById("authSubmit");
  const error = document.getElementById("authError");

  submit.disabled = true;
  submit.textContent = "Please wait...";
  error.textContent = "";

  try {
    if (authMode === "register") {
      await apiRequest("/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
    }

    const result = await apiRequest("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });

    if (!result.access_token) {
      throw new Error("Login response did not contain an access token.");
    }

    sessionStorage.setItem(
      "afa_access_token",
      result.access_token
    );
    sessionStorage.setItem("afa_user_email", email);
    updateUserProfile(email); 
    
    setAuthVisibility(true);
    document.getElementById("authPassword").value = "";

    await loadTransactionsFromBackend();
    await loadBudgetGoalsFromBackend();

    showPage("dashboard");

  } catch (err) {
    console.error("Authentication error:", err);

    error.textContent =
      err.message || "Unable to sign in. Please try again.";

  } finally {
    submit.disabled = false;
    submit.textContent =
      authMode === "register" ? "Create account" : "Login";
  }
}

document
  .getElementById("authForm")
  .addEventListener("submit", handleAuthSubmit);

// ========== STORAGE ==========
function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function save(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

let transactions = load("afa_tx", []);
let budgets = load("afa_budgets", []);
let goals = load("afa_goals", []);

const CAT_COLORS = {
  Food: "#f97316",
  Transport: "#3b82f6",
  Shopping: "#a855f7",
  Bills: "#ef4444",
  Entertainment: "#ec4899",
  Health: "#10b981",
  Education: "#6366f1",
  Salary: "#10b981",
  Freelance: "#14b8a6",
  Other: "#64748b"
};

// ========== TRANSACTIONS FROM BACKEND ==========
async function loadTransactionsFromBackend() {
  if (!sessionStorage.getItem("afa_access_token")) return;

  try {
    const data = await apiRequest("/transactions");

    transactions = data.map(t => ({
      id: t.id,
      title: t.title,
      amount: Number(t.amount),
      category: t.category,
      type: t.transaction_type,
      date: String(t.transaction_date).slice(0, 10)
    }));

    save("afa_tx", transactions);
    renderExpenses();
    updateDashboard();

  } catch (err) {
    console.error("Could not load transactions:", err);
    toast(err.message || "Could not load transactions");
  }
}

// ========== HELPERS ==========
function rupee(n) {
  return "₹" + Number(n).toLocaleString("en-IN");
}

function fmtDate(d) {
  if (!d) return "—";

  return new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function toast(msg) {
  const el = document.getElementById("toast");
  if (!el) return;

  el.textContent = msg;
  el.classList.remove("hidden");
  el.classList.add("show");

  setTimeout(() => {
    el.classList.add("hidden");
    el.classList.remove("show");
  }, 2500);
}

function getIncome() {
  return transactions
    .filter(t => t.type === "income")
    .reduce((s, t) => s + t.amount, 0);
}

function getExpense() {
  return transactions
    .filter(t => t.type === "expense")
    .reduce((s, t) => s + t.amount, 0);
}

function getCategorySpend() {
  const map = {};

  transactions
    .filter(t => t.type === "expense")
    .forEach(t => {
      map[t.category] = (map[t.category] || 0) + t.amount;
    });

  return map;
}

function spentInCategory(cat) {
  return transactions
    .filter(t => t.type === "expense" && t.category === cat)
    .reduce((s, t) => s + t.amount, 0);
}

function escapeHtml(value) {
  const d = document.createElement("div");
  d.textContent = String(value ?? "");
  return d.innerHTML;
}

// ========== NAVIGATION ==========
function showPage(name) {
  if (!sessionStorage.getItem("afa_access_token")) {
    setAuthVisibility(false);
    return;
  }
  if (name === "planner") {
    loadSavingsPlanner();
  }

  if (name === "budget") {
    loadBillsFromBackend();
  }

  document.querySelectorAll(".page").forEach(p => {
    p.classList.remove("active");
  });

  document.querySelectorAll(".nav-btn").forEach(b => {
    b.classList.remove("active");
  });

  const page = document.getElementById("page-" + name);

  if (page) page.classList.add("active");

  const btn = document.querySelector('[data-page="' + name + '"]');
  if (btn) btn.classList.add("active");

  const titles = {
    dashboard: "Dashboard",
    chat: "AI Advisor",
    expenses: "Expenses",
    "money-owed": "Money Owed",
    budget: "Budget & Goals",
    reports: "Reports",
    wrapped: "Money Wrapped",
    twin: "Financial Digital Twin",
    scamprotection: "Fraud & Scam Alerts"
  };

  const pageTitle = document.getElementById("pageTitle");
  if (pageTitle) pageTitle.textContent = titles[name] || "Dashboard";

  closeSidebar();

  if (name === "dashboard") updateDashboard();
 if (name === "wrapped") {
  requestAnimationFrame(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  });

  loadMoneyWrapped();
}
  if (name === "scam-protection") loadFraudRiskAlerts();

  if (name === "expenses") {
    renderExpenses();
    setDefaultDate();
  }

  if (name === "budget") renderBudget();
  if (name === "money-owed") loadMoneyOwedFromBackend();
  if (name === "reports") updateReports();
  if (name === "chat") initChat();
  if (name === "twin") loadDigitalTwin();
}

function openSidebar() {
  document.getElementById("sidebar").classList.add("open");
  document.getElementById("overlay").classList.remove("hidden");
}

function closeSidebar() {
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("overlay");

  if (sidebar) sidebar.classList.remove("open");
  if (overlay) overlay.classList.add("hidden");
}

function setDefaultDate() {
  const el = document.getElementById("expDate");
  if (el && !el.value) el.value = today();
}

// ========== DASHBOARD ==========
let spendChartObj = null;
let pieChartObj = null;

function updateDashboard() {
  const income = getIncome();
  const expense = getExpense();
  const balance = income - expense;
  const rate = income > 0
    ? ((balance / income) * 100).toFixed(1)
    : 0;

  document.getElementById("card-balance").textContent = rupee(balance);
  document.getElementById("card-income").textContent = rupee(income);
  document.getElementById("card-expense").textContent = rupee(expense);
  document.getElementById("card-savings").textContent = rate + "%";

  const qbar = document.getElementById("quickAddBar");
  if (qbar) qbar.style.display = transactions.length ? "none" : "flex";

  document.getElementById("card-balance-sub").textContent =
    transactions.length
      ? (balance >= 0 ? "Positive balance" : "Negative balance")
      : "Add income & expenses";

  document.getElementById("card-income-sub").textContent =
    income
      ? transactions.filter(t => t.type === "income").length + " income entries"
      : "No income yet";

  document.getElementById("card-expense-sub").textContent =
    expense
      ? transactions.filter(t => t.type === "expense").length + " expense entries"
      : "No expenses yet";

  document.getElementById("card-savings-sub").textContent =
    income
      ? (rate >= 20
          ? "Healthy savings"
          : rate >= 0
            ? "Can improve"
            : "Spending more than income")
      : "Add data to calculate";

  const insight = document.getElementById("aiInsight");

  if (!transactions.length) {
    insight.textContent =
      "Add some income and expenses, then come back — I will give personalised tips based on your real data.";
  } else {
    const catSpend = getCategorySpend();
    const top = Object.keys(catSpend).sort(
      (a, b) => catSpend[b] - catSpend[a]
    )[0];

    if (top) {
      insight.innerHTML =
        "Your top expense is <b class=\"text-white\">" +
        escapeHtml(top) +
        "</b> at <b class=\"text-white\">" +
        rupee(catSpend[top]) +
        "</b>. Savings rate is <b class=\"text-amber-400\">" +
        rate +
        "%</b>. " +
        (rate < 20
          ? "Try cutting " + escapeHtml(top) + " a bit to boost savings."
          : "You are doing well — keep it up!");
    } else {
      insight.textContent =
        "You have income but no expenses recorded yet. Add expenses to get better insights.";
    }
  }

  const recent = [...transactions]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);

  const recentEl = document.getElementById("recentList");

  if (!recent.length) {
    recentEl.innerHTML = `
      <div class="empty-state">
        <div class="icon-wrap"><i class="fas fa-receipt"></i></div>
        <p class="text-slate-500 text-sm font-medium mb-1">No transactions yet</p>
        <p class="text-slate-400 text-xs mb-4">Salary aur expenses yahan dikhenge</p>
        <button onclick="showPage('expenses')" class="btn-primary">
          <i class="fas fa-plus mr-1.5"></i> Add Transaction
        </button>
      </div>`;
  } else {
    recentEl.innerHTML = recent.map(t => `
      <div class="flex items-center gap-3 py-2">
        <div class="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white"
             style="background:${CAT_COLORS[t.category] || "#64748b"}">
          ${escapeHtml((t.category || "?")[0])}
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium truncate">${escapeHtml(t.title)}</p>
          <p class="text-xs text-slate-400">${fmtDate(t.date)} • ${escapeHtml(t.category)}</p>
        </div>
        <p class="text-sm font-semibold ${t.type === "income" ? "text-emerald-600" : ""}">
          ${t.type === "income" ? "+" : "-"}${rupee(t.amount)}
        </p>
      </div>
    `).join("");
  }

  initDashboardCharts();
  loadMoneyWeather();
}

function initDashboardCharts() {
  const catSpend = getCategorySpend();
  const labels = Object.keys(catSpend);
  const values = Object.values(catSpend);
  const hasExpense = values.length > 0;
  const hasAny = transactions.length > 0;

  document.getElementById("spendEmpty").style.display =
    hasAny ? "none" : "flex";

  document.getElementById("pieEmpty").style.display =
    hasExpense ? "none" : "flex";

  const months = {};

  transactions.forEach(t => {
    const key = t.date ? t.date.slice(0, 7) : "unknown";

    if (!months[key]) months[key] = { income: 0, expense: 0 };

    if (t.type === "income") {
      months[key].income += t.amount;
    } else {
      months[key].expense += t.amount;
    }
  });

  const sortedKeys = Object.keys(months).sort();

  const lineLabels = sortedKeys.map(k => {
    const [y, m] = k.split("-");
    return new Date(Number(y), Number(m) - 1)
      .toLocaleDateString("en-IN", {
        month: "short",
        year: "2-digit"
      });
  });

  const lineIncome = sortedKeys.map(k => months[k].income);
  const lineExpense = sortedKeys.map(k => months[k].expense);

  const ctx1 = document.getElementById("spendChart");

  if (spendChartObj) {
    spendChartObj.destroy();
    spendChartObj = null;
  }

  if (hasAny && ctx1) {
    spendChartObj = new Chart(ctx1, {
      type: "line",
      data: {
        labels: lineLabels.length ? lineLabels : ["No data"],
        datasets: [
          {
            label: "Expenses",
            data: lineExpense.length ? lineExpense : [0],
            borderColor: "#0ea5e9",
            backgroundColor: "rgba(14,165,233,0.1)",
            fill: true,
            tension: 0.4
          },
          {
            label: "Income",
            data: lineIncome.length ? lineIncome : [0],
            borderColor: "#10b981",
            tension: 0.4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "top" } },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: v => "₹" + (
                v >= 1000 ? (v / 1000) + "k" : v
              )
            }
          }
        }
      }
    });
  }

  const ctx2 = document.getElementById("pieChart");

  if (pieChartObj) {
    pieChartObj.destroy();
    pieChartObj = null;
  }

  if (hasExpense && ctx2) {
    pieChartObj = new Chart(ctx2, {
      type: "doughnut",
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: labels.map(l => CAT_COLORS[l] || "#64748b"),
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "right",
            labels: { boxWidth: 12, font: { size: 11 } }
          }
        },
        cutout: "65%"
      }
    });
  }
}

// ========== EXPENSES ==========
function renderExpenses() {
  const filterCat = document.getElementById("filterCat")?.value || "all";
  const filterType = document.getElementById("filterType")?.value || "all";
  const search = (
    document.getElementById("searchTx")?.value || ""
  ).toLowerCase().trim();
  const sort = document.getElementById("sortTx")?.value || "date-desc";

  let list = [...transactions];

  if (filterCat !== "all") {
    list = list.filter(t => t.category === filterCat);
  }

  if (filterType !== "all") {
    list = list.filter(t => t.type === filterType);
  }

  if (search) {
    list = list.filter(t =>
      (t.title || "").toLowerCase().includes(search) ||
      (t.category || "").toLowerCase().includes(search)
    );
  }

  if (sort === "date-desc") {
    list.sort((a, b) => new Date(b.date) - new Date(a.date));
  } else if (sort === "date-asc") {
    list.sort((a, b) => new Date(a.date) - new Date(b.date));
  } else if (sort === "amt-desc") {
    list.sort((a, b) => b.amount - a.amount);
  } else if (sort === "amt-asc") {
    list.sort((a, b) => a.amount - b.amount);
  }

  const inc = getIncome();
  const exp = getExpense();

  const sumI = document.getElementById("sumIncome");
  const sumE = document.getElementById("sumExpense");
  const sumN = document.getElementById("sumNet");

  if (sumI) sumI.textContent = rupee(inc);
  if (sumE) sumE.textContent = rupee(exp);
  if (sumN) sumN.textContent = rupee(inc - exp);

  document.getElementById("txCount").textContent =
    "(" + transactions.length + ")";

  const tbody = document.getElementById("expTable");

  if (!list.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6">
          <div class="empty-state">
            <div class="icon-wrap"><i class="fas fa-wallet"></i></div>
            <p class="text-slate-500 text-sm font-medium mb-1">No transactions</p>
            <p class="text-slate-400 text-xs">Upar wale form se pehli entry add karo</p>
          </div>
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = list.map(t => `
    <tr class="hover:bg-slate-50 dark-row">
      <td class="px-5 py-3 font-medium">${escapeHtml(t.title)}</td>
      <td class="px-5 py-3">
        <span class="inline-block px-2 py-0.5 rounded-full text-xs text-white"
              style="background:${CAT_COLORS[t.category] || "#64748b"}">
          ${escapeHtml(t.category)}
        </span>
      </td>
      <td class="px-5 py-3 text-slate-500">${fmtDate(t.date)}</td>
      <td class="px-5 py-3">
        <span class="text-xs font-medium ${
          t.type === "income" ? "text-emerald-600" : "text-rose-600"
        }">
          ${t.type === "income" ? "Income" : "Expense"}
        </span>
      </td>
      <td class="px-5 py-3 text-right font-semibold ${
        t.type === "income" ? "text-emerald-600" : ""
      }">
        ${t.type === "income" ? "+" : "-"}${rupee(t.amount)}
      </td>
      <td class="px-5 py-3 text-center whitespace-nowrap">
        <button onclick="editExpense(${Number(t.id)})"
                class="text-slate-400 hover:text-sky-500 p-1"
                title="Edit">
          <i class="fas fa-pen"></i>
        </button>
        <button onclick="deleteExpense(${Number(t.id)})"
                class="text-slate-400 hover:text-red-500 p-1"
                title="Delete">
          <i class="fas fa-trash-alt"></i>
        </button>
      </td>
    </tr>
  `).join("");
}

async function addExpense(e) {
  e.preventDefault();

  const title = document.getElementById("expTitle").value.trim();
  const amount = Number(document.getElementById("expAmount").value);
  const category = document.getElementById("expCategory").value;
  const type = document.getElementById("expType").value;
  const date = document.getElementById("expDate").value || today();
  const editId = document.getElementById("editId")?.value;

  if (!title || !Number.isFinite(amount) || amount <= 0) {
    toast("Please fill title and enter a valid amount");
    return;
  }

  const payload = {
    title,
    amount,
    category,
    transaction_type: type,
    transaction_date: date
  };

  try {
    let saved;

    if (editId) {
      saved = await apiRequest(`/transactions/${editId}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });

      const updated = {
        id: saved.id,
        title: saved.title,
        amount: Number(saved.amount),
        category: saved.category,
        type: saved.transaction_type,
        date: String(saved.transaction_date).slice(0, 10)
      };

      const index = transactions.findIndex(
        t => String(t.id) === String(editId)
      );

      if (index >= 0) {
        transactions[index] = updated;
      } else {
        transactions.unshift(updated);
      }

      toast("Transaction updated successfully");

    } else {
      saved = await apiRequest("/transactions", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      transactions.unshift({
        id: saved.id,
        title: saved.title,
        amount: Number(saved.amount),
        category: saved.category,
        type: saved.transaction_type,
        date: String(saved.transaction_date).slice(0, 10)
      });

      toast("Transaction saved to your account");
    }

    e.target.reset();

    const editField = document.getElementById("editId");
    if (editField) editField.value = "";

    const btnText = document.getElementById("saveBtnText");
    if (btnText) btnText.textContent = "Save";

    setDefaultDate();
    renderExpenses();
    updateDashboard();
    save("afa_tx", transactions);

  } catch (err) {
    toast(err.message || "Could not save transaction");
  }
}

function editExpense(id) {
  const t = transactions.find(x => String(x.id) === String(id));
  if (!t) return;

  document.getElementById("editId").value = t.id;
  document.getElementById("expTitle").value = t.title;
  document.getElementById("expAmount").value = t.amount;
  document.getElementById("expCategory").value = t.category;
  document.getElementById("expType").value = t.type;
  document.getElementById("expDate").value = t.date;

  const btnText = document.getElementById("saveBtnText");
  if (btnText) btnText.textContent = "Update";

  document.getElementById("expTitle").scrollIntoView({
    behavior: "smooth",
    block: "center"
  });

  document.getElementById("expTitle").focus();
  toast("Editing — change & click Update");
}

async function deleteExpense(id) {
  if (!confirm("Delete this transaction?")) return;

  try {
    await apiRequest(`/transactions/${id}`, {
      method: "DELETE"
    });

    transactions = transactions.filter(
      t => String(t.id) !== String(id)
    );

    save("afa_tx", transactions);
    renderExpenses();
    updateDashboard();
    toast("Transaction deleted");

  } catch (err) {
    toast(err.message || "Could not delete transaction");
  }
}

function exportCSV() {
  if (!transactions.length) {
    toast("No data to export");
    return;
  }

  const rows = [["Title", "Amount", "Category", "Type", "Date"]];

  transactions.forEach(t => {
    rows.push([t.title, t.amount, t.category, t.type, t.date]);
  });

  const csv = rows
    .map(row =>
      row.map(c =>
        '"' + String(c).replace(/"/g, '""') + '"'
      ).join(",")
    )
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = "finance-transactions.csv";
  a.click();

  URL.revokeObjectURL(url);
  toast("CSV downloaded");
}

function toggleDark() {
  document.body.classList.toggle("dark-mode");

  const on = document.body.classList.contains("dark-mode");

  localStorage.setItem("afa_dark", on ? "1" : "0");

  const btn = document.getElementById("darkBtn");

  if (btn) {
    btn.innerHTML = on
      ? '<i class="fas fa-sun"></i>'
      : '<i class="fas fa-moon"></i>';
  }
}

// ========== BUDGETS AND SAVINGS GOALS ==========
async function loadBudgetGoalsFromBackend() {
  if (!sessionStorage.getItem("afa_access_token")) return;

  try {
    const now = new Date();

    const monthStart = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      "01"
    ].join("-");

    const [budgetData, goalData] = await Promise.all([
      apiRequest(`/budgets?month_start=${monthStart}`),
      apiRequest("/savings-goals")
    ]);

    budgets = budgetData.map(b => ({
      id: b.id,
      category: b.category,
      limit: Number(b.budget_amount),
      month_start: String(b.month_start).slice(0, 10)
    }));

    goals = goalData.map(g => ({
      id: g.id,
      name: g.goal_name,
      target: Number(g.target_amount),
      current: Number(g.current_amount),
      target_date: g.target_date || null
    }));

    save("afa_budgets", budgets);
    save("afa_goals", goals);

    renderBudget();
    updateReportBudgetComparison();

  } catch (err) {
    console.error("Could not load budgets and goals:", err);
    toast(err.message || "Could not load budgets and goals");
  }
}

function renderBudget() {
  const listEl = document.getElementById("budgetList");

  if (!budgets.length) {
    listEl.innerHTML = `
      <div class="empty-state py-6">
        <div class="icon-wrap"><i class="fas fa-bullseye"></i></div>
        <p class="text-slate-500 text-sm font-medium">No budgets yet</p>
        <p class="text-slate-400 text-xs mt-1">Upar se category limit set karo</p>
      </div>`;
  } else {
    listEl.innerHTML = budgets.map((b, i) => {
      const spent = spentInCategory(b.category);
      const pct = b.limit > 0
        ? Math.min(100, Math.round((spent / b.limit) * 100))
        : 0;
      const over = pct >= 90;

      return `
        <div>
          <div class="flex justify-between mb-1 items-center">
            <span class="text-sm font-medium">${escapeHtml(b.category)}</span>
            <div class="flex items-center gap-2">
              <span class="text-xs text-slate-500">
                ${rupee(spent)} / ${rupee(b.limit)}
              </span>
              <button onclick="deleteBudget(${i})"
                      class="text-slate-400 hover:text-red-500 text-xs">
                <i class="fas fa-trash-alt"></i>
              </button>
            </div>
          </div>
          <div class="progress-bar">
            <div class="progress-fill"
                 style="width:${pct}%;background:${
                   over ? "#ef4444" : (CAT_COLORS[b.category] || "#0ea5e9")
                 }">
            </div>
          </div>
          <p class="text-xs mt-1 ${
            over ? "text-red-500" : "text-slate-400"
          }">
            ${pct}% used ${over ? "— Near / over limit" : ""}
          </p>
        </div>`;
    }).join("");
  }

  const goalsEl = document.getElementById("goalsList");

  if (!goals.length) {
    goalsEl.innerHTML = `
      <div class="empty-state py-4">
        <div class="icon-wrap"><i class="fas fa-flag"></i></div>
        <p class="text-slate-500 text-sm font-medium">No goals yet</p>
      </div>`;
  } else {
    goalsEl.innerHTML = goals.map((g, i) => {
      const pct = g.target > 0
        ? Math.min(100, Math.round((g.current / g.target) * 100))
        : 0;

      return `
        <div class="p-4 rounded-xl bg-slate-50 border">
          <div class="flex justify-between mb-2 items-start">
            <div>
              <p class="font-medium text-sm">${escapeHtml(g.name)}</p>
              <p class="text-xs text-slate-400">
                ${rupee(g.current)} of ${rupee(g.target)}
              </p>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-sm font-semibold text-sky-600">${pct}%</span>
              <button onclick="updateGoalProgress(${i})"
                      class="text-slate-400 hover:text-sky-500 text-xs"
                      title="Update saved">
                <i class="fas fa-plus-circle"></i>
              </button>
              <button onclick="deleteGoal(${i})"
                      class="text-slate-400 hover:text-red-500 text-xs">
                <i class="fas fa-trash-alt"></i>
              </button>
            </div>
          </div>
          <div class="progress-bar">
            <div class="progress-fill"
                 style="width:${pct}%;background:#0ea5e9">
            </div>
          </div>
        </div>`;
    }).join("");
  }

  const tip = document.getElementById("budgetAITip");
  const income = getIncome();
  const expense = getExpense();

  if (!transactions.length && !budgets.length) {
    tip.textContent =
      "Set budgets and goals, add transactions — then I will give recommendations based on your numbers.";
  } else if (budgets.length) {
    const over = budgets.filter(
      b => spentInCategory(b.category) >= b.limit * 0.9
    );

    if (over.length) {
      tip.textContent =
        "Watch out: " +
        over.map(b => b.category).join(", ") +
        " " +
        (over.length > 1 ? "are" : "is") +
        " near or over budget. Review those categories.";
    } else {
      tip.textContent =
        "Your budgets look under control. Income: " +
        rupee(income) +
        ", Expenses: " +
        rupee(expense) +
        ". Keep tracking regularly.";
    }
  } else {
    tip.textContent =
      "You have transactions but no budgets. Set category limits so I can warn you when you overspend.";
  }
}

async function addBudget(e) {
  e.preventDefault();

  const category = document.getElementById("budCategory").value;
  const limit = Number(document.getElementById("budLimit").value);

  if (!category || !Number.isFinite(limit) || limit <= 0) {
    toast("Enter a valid budget amount");
    return;
  }

  const now = new Date();

  const monthStart = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    "01"
  ].join("-");

  const existing = budgets.find(b =>
    b.category === category &&
    b.month_start === monthStart
  );

  const payload = {
    category,
    budget_amount: limit,
    month_start: monthStart
  };

  try {
    if (existing) {
      await apiRequest(`/budgets/${existing.id}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });

      toast("Budget updated for " + category);

    } else {
      await apiRequest("/budgets", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      toast("Budget saved to your account");
    }

    e.target.reset();
    await loadBudgetGoalsFromBackend();

  } catch (err) {
    toast(err.message || "Could not save budget");
  }
}

async function deleteBudget(i) {
  const budget = budgets[i];
  if (!budget) return;

  if (!confirm("Remove this budget?")) return;

  try {
    await apiRequest(`/budgets/${budget.id}`, {
      method: "DELETE"
    });

    await loadBudgetGoalsFromBackend();
    toast("Budget removed");

  } catch (err) {
    toast(err.message || "Could not remove budget");
  }
}

async function addGoal(e) {
  e.preventDefault();

  const name = document.getElementById("goalName").value.trim();
  const target = Number(document.getElementById("goalTarget").value);
  const current = Number(
    document.getElementById("goalCurrent").value
  ) || 0;

  if (
    !name ||
    !Number.isFinite(target) ||
    target <= 0 ||
    !Number.isFinite(current) ||
    current < 0
  ) {
    toast("Enter a valid goal name and amount");
    return;
  }

  try {
    await apiRequest("/savings-goals", {
      method: "POST",
      body: JSON.stringify({
        goal_name: name,
        target_amount: target,
        current_amount: current,
        target_date: null
      })
    });

    e.target.reset();
    document.getElementById("goalCurrent").value = 0;

    await loadBudgetGoalsFromBackend();
    toast("Savings goal saved to your account");

  } catch (err) {
    toast(err.message || "Could not save goal");
  }
}

async function deleteGoal(i) {
  const goal = goals[i];
  if (!goal) return;

  if (!confirm("Remove this goal?")) return;

  try {
    await apiRequest(`/savings-goals/${goal.id}`, {
      method: "DELETE"
    });

    await loadBudgetGoalsFromBackend();
    toast("Goal removed");

  } catch (err) {
    toast(err.message || "Could not remove goal");
  }
}

async function updateGoalProgress(i) {
  const goal = goals[i];
  if (!goal) return;

  const value = prompt(
    'Current saved amount for "' + goal.name + '" (₹):',
    goal.current
  );

  if (value === null) return;

  const amount = Number(value);

  if (!Number.isFinite(amount) || amount < 0) {
    toast("Enter a valid amount");
    return;
  }

  try {
    await apiRequest(
      `/savings-goals/${goal.id}/progress?current_amount=${encodeURIComponent(amount)}`,
      { method: "PATCH" }
    );

    await loadBudgetGoalsFromBackend();
    toast("Goal progress saved");

  } catch (err) {
    toast(err.message || "Could not update goal");
  }
}

// ========== REPORTS ==========
let barChartObj = null;
let reportPieObj = null;

function updateReports() {
  const income = getIncome();
  const expense = getExpense();
  const catSpend = getCategorySpend();


  const savingsRate = income > 0
    ? ((income - expense) / income) * 100
    : 0;

  const reportIncomeEl = document.getElementById("rep-income");
  const reportExpensesEl = document.getElementById("rep-expenses");
  const reportSavingsRateEl = document.getElementById("rep-savings-rate");

  if (reportIncomeEl) reportIncomeEl.textContent = rupee(income);
  if (reportExpensesEl) reportExpensesEl.textContent = rupee(expense);
  if (reportSavingsRateEl) {
    reportSavingsRateEl.textContent = `${savingsRate.toFixed(1)}%`;
  }

  const top = Object.keys(catSpend).sort(
    (a, b) => catSpend[b] - catSpend[a]
  )[0];

  document.getElementById("rep-count").textContent = transactions.length;
  document.getElementById("rep-top").textContent = top || "—";
  document.getElementById("rep-balance").textContent =
    rupee(income - expense);

  const hasAny = transactions.length > 0;
  const hasExpense = Object.keys(catSpend).length > 0;

  document.getElementById("barEmpty").style.display =
    hasAny ? "none" : "flex";

  document.getElementById("reportPieEmpty").style.display =
    hasExpense ? "none" : "flex";

  const months = {};

  transactions.forEach(t => {
    const key = t.date ? t.date.slice(0, 7) : "unknown";

    if (!months[key]) {
      months[key] = { income: 0, expense: 0 };
    }

    if (t.type === "income") {
      months[key].income += t.amount;
    } else {
      months[key].expense += t.amount;
    }
  });

  const keys = Object.keys(months).sort();

  const labels = keys.map(k => {
    const [y, m] = k.split("-");
    return new Date(Number(y), Number(m) - 1)
      .toLocaleDateString("en-IN", { month: "short" });
  });

  const ctx1 = document.getElementById("barChart");


  if (barChartObj) {
    barChartObj.destroy();
    barChartObj = null;
  }

  if (hasAny && ctx1) {
    barChartObj = new Chart(ctx1, {
      type: "bar",
      data: {
        labels: labels.length ? labels : ["—"],
        datasets: [
          {
            label: "Income",
            data: keys.map(k => months[k].income),
            backgroundColor: "#10b981",
            borderRadius: 6
          },
          {
            label: "Expenses",
            data: keys.map(k => months[k].expense),
            backgroundColor: "#f43f5e",
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: v => "₹" + (
                v >= 1000 ? (v / 1000) + "k" : v
              )
            }
          }
        }
      }
    });
    updateMonthlySavingsChart();
  }

  const ctx2 = document.getElementById("reportPie");

  if (reportPieObj) {
    reportPieObj.destroy();
    reportPieObj = null;
  }

  if (hasExpense && ctx2) {
    const labels2 = Object.keys(catSpend);

    reportPieObj = new Chart(ctx2, {
      type: "doughnut",
      data: {
        labels: labels2,
        datasets: [{
          data: Object.values(catSpend),
          backgroundColor: labels2.map(l => CAT_COLORS[l] || "#64748b"),
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "right",
            labels: { boxWidth: 12, font: { size: 11 } }
          }
        },
        cutout: "60%"
      }
    });
  }
  updateReportBudgetComparison();
}


let monthlySavingsChartObj = null;

function updateMonthlySavingsChart() {
  const canvas = document.getElementById("monthlySavingsChart");
  const empty = document.getElementById("monthlySavingsEmpty");

  if (!canvas || !empty) return;

  const monthly = {};

  transactions.forEach((t) => {
    const month = t.date ? t.date.slice(0, 7) : "";
    if (!month) return;

    if (!monthly[month]) monthly[month] = { income: 0, expenses: 0 };

    if (t.type === "income") {
      monthly[month].income += Number(t.amount || 0);
    } else if (t.type === "expense") {
      monthly[month].expenses += Number(t.amount || 0);
    }
  });

  const keys = Object.keys(monthly).sort().slice(-6);
  empty.style.display = keys.length ? "none" : "flex";

  if (monthlySavingsChartObj) {
    monthlySavingsChartObj.destroy();
    monthlySavingsChartObj = null;
  }

  if (!keys.length) return;

  const labels = keys.map((key) => {
    const [year, month] = key.split("-");
    return new Date(Number(year), Number(month) - 1)
      .toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
  });

  monthlySavingsChartObj = new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Income",
          data: keys.map((key) => monthly[key].income),
          borderColor: "#10b981",
          backgroundColor: "#10b981",
          tension: 0.3
        },
        {
          label: "Expenses",
          data: keys.map((key) => monthly[key].expenses),
          borderColor: "#f43f5e",
          backgroundColor: "#f43f5e",
          tension: 0.3
        },
        {
          label: "Savings",
          data: keys.map((key) => monthly[key].income - monthly[key].expenses),
          borderColor: "#6366f1",
          backgroundColor: "#6366f1",
          tension: 0.3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
}



function updateReportBudgetComparison() {
  const output = document.getElementById("report-budget-comparison");
  if (!output) return;

  output.replaceChildren();

  if (!Array.isArray(budgets) || budgets.length === 0) {
    output.textContent =
      "No budgets loaded. Open Budget & Goals and make sure your saved budgets are visible.";
    return;
  }

  const now = new Date();
  const currentMonth =
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const currentBudgets = budgets.filter(
    b => !b.month_start || String(b.month_start).slice(0, 7) === currentMonth
  );

  if (currentBudgets.length === 0) {
    output.textContent =
      "No budgets found for this month. Set a budget for the current month in Budget & Goals.";
    return;
  }

  currentBudgets.forEach(budget => {
    const category = String(budget.category || "Other").trim();
    const limit = Number(budget.limit || 0);

    const actual = transactions
      .filter(t =>
        t.type === "expense" &&
        String(t.category || "Other").trim() === category &&
        String(t.date || "").slice(0, 7) === currentMonth
      )
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);

    const remaining = limit - actual;
    const percent = limit > 0 ? actual / limit * 100 : 0;
    const overBudget = actual > limit;

    const card = document.createElement("div");
    card.className = "rounded-xl border border-slate-200 p-4 mb-3";

    const title = document.createElement("div");
    title.className = "flex justify-between items-center gap-2 flex-wrap";

    const name = document.createElement("p");
    name.className = "font-semibold text-slate-800";
    name.textContent = category;

    const status = document.createElement("span");
    status.className = overBudget
      ? "text-sm font-semibold text-rose-600"
      : "text-sm font-semibold text-emerald-700";
    status.textContent = overBudget ? "Over budget" : "Within budget";

    title.append(name, status);

    const amounts = document.createElement("p");
    amounts.className = "text-sm text-slate-600 mt-2";
    amounts.textContent =
      `Actual: ${rupee(actual)} / Budget: ${rupee(limit)}`;

    const track = document.createElement("div");
    track.className = "mt-3 h-2 w-full rounded-full bg-slate-100 overflow-hidden";

    const bar = document.createElement("div");
    bar.className = `h-2 rounded-full ${overBudget ? "bg-rose-500" : "bg-emerald-500"}`;
    bar.style.width = `${Math.min(100, Math.max(0, percent))}%`;
    track.appendChild(bar);

    const remainingText = document.createElement("p");
    remainingText.className = `text-xs mt-2 ${overBudget ? "text-rose-600" : "text-slate-500"}`;
    remainingText.textContent = overBudget
      ? `Exceeded by ${rupee(Math.abs(remaining))}`
      : `Remaining: ${rupee(remaining)}`;

    card.append(title, amounts, track, remainingText);
    output.appendChild(card);
  });
}



// ========== AI CHAT ==========
function buildAIReply(userText) {
  const t = userText.toLowerCase();

  const income = getIncome();
  const expense = getExpense();
  const balance = income - expense;

  const rate = income > 0
    ? ((balance / income) * 100).toFixed(1)
    : 0;

  const catSpend = getCategorySpend();

  const topCat = Object.keys(catSpend).sort(
    (a, b) => catSpend[b] - catSpend[a]
  )[0];

  const topAmt = topCat ? catSpend[topCat] : 0;

  if (!transactions.length) {
    return "You have not added any transactions yet.\n\n" +
      "Go to Expenses → add your salary (Income) and some expenses. " +
      "Then ask me again — I will analyse YOUR numbers.";
  }

  if (
    t.includes("save") ||
    t.includes("saving") ||
    t.includes("bachat")
  ) {
    let tips = "Based on your data:\n\n";

    tips += "• Income: " + rupee(income) + "\n";
    tips += "• Expenses: " + rupee(expense) + "\n";
    tips += "• Balance: " + rupee(balance) + "\n";
    tips += "• Savings rate: " + rate + "%\n\n";

    if (topCat) {
      tips += "1. Your biggest spend is " + topCat +
        " (" + rupee(topAmt) + "). Try cutting 10–15% there.\n";
    }

    tips += "2. Aim for at least 20% savings rate" +
      (rate >= 20
        ? " — you are already there!"
        : " — currently " + rate + "%.") + "\n";

    tips += "3. Set category budgets on the Budget page so you get alerts before overspending.";

    return tips;
  }

  if (
    t.includes("analyze") ||
    t.includes("spending") ||
    t.includes("expense") ||
    t.includes("analysis")
  ) {
    let msg = "Your spending analysis:\n\n";

    msg += "• Total Income: " + rupee(income) + "\n";
    msg += "• Total Expenses: " + rupee(expense) + "\n";
    msg += "• Net Balance: " + rupee(balance) + "\n";
    msg += "• Savings Rate: " + rate + "%\n";
    msg += "• Transactions: " + transactions.length + "\n\n";

    if (topCat) {
      msg += "Top category: " + topCat + " — " + rupee(topAmt);

      if (expense > 0) {
        msg += " (" + Math.round((topAmt / expense) * 100) +
          "% of expenses)";
      }

      msg += "\n\n";
    }

    const sorted = Object.entries(catSpend).sort(
      (a, b) => b[1] - a[1]
    );

    if (sorted.length) {
      msg += "Breakdown:\n";

      sorted.forEach(([c, a]) => {
        msg += "  • " + c + ": " + rupee(a) + "\n";
      });
    }

    return msg;
  }

  if (t.includes("budget")) {
    if (income <= 0) {
      return "Add your income first (Expenses → Type: Income), " +
        "then I can suggest a 50/30/20 budget.";
    }

    const needs = Math.round(income * 0.5);
    const wants = Math.round(income * 0.3);
    const sav = Math.round(income * 0.2);

    return "Suggested 50/30/20 budget for your income of " +
      rupee(income) + ":\n\n" +
      "• Needs (Food, Bills, Transport): " + rupee(needs) + " (50%)\n" +
      "• Wants (Shopping, Entertainment): " + rupee(wants) + " (30%)\n" +
      "• Savings & Goals: " + rupee(sav) + " (20%)\n\n" +
      "Your current expenses: " + rupee(expense) + ". " +
      (expense <= needs + wants
        ? "You are within the suggested limits."
        : "You are above suggested needs+wants — review discretionary spends.");
  }

  if (t.includes("goal") || t.includes("target")) {
    if (!goals.length) {
      return "You have no savings goals yet. Go to Budget & Goals " +
        "and add one (e.g. Emergency Fund, Vacation).";
    }

    let msg = "Your goals:\n\n";

    goals.forEach(g => {
      const pct = g.target > 0
        ? Math.min(100, Math.round((g.current / g.target) * 100))
        : 0;

      msg += "• " + g.name + ": " + rupee(g.current) +
        " / " + rupee(g.target) + " (" + pct + "%)\n";
    });

    msg += "\nKeep adding monthly savings toward these targets.";
    return msg;
  }

  if (
    t.includes("hello") ||
    t.includes("hi") ||
    t.includes("hey")
  ) {
    return "Hi! I am your AI Finance Advisor.\n\n" +
      "I use the transactions YOU added.\n\n" +
      'Try: "Analyze my spending" | "How can I save more?" | "Suggest a budget"';
  }

  return "I can help with:\n\n" +
    '• "Analyze my spending" — breakdown of your data\n' +
    '• "How can I save more?" — tips from your numbers\n' +
    '• "Suggest a budget" — 50/30/20 plan\n' +
    '• "Show my goals" — goal progress\n\n' +
    "Your current balance: " + rupee(balance) +
    " | Savings rate: " + rate + "%";
}

function initChat() {
  const box = document.getElementById("chatBox");

  if (!box || box.dataset.ready) return;

  box.dataset.ready = "1";

  box.innerHTML = `
    <div class="flex gap-3">
      <div class="w-8 h-8 rounded-lg bg-sky-500 flex items-center justify-center text-white text-xs flex-shrink-0">
        <i class="fas fa-robot"></i>
      </div>
      <div class="bg-white rounded-2xl rounded-tl-md px-4 py-3 shadow-sm border max-w-[85%] text-sm">
        Hi! I analyse only the data you add.<br><br>
        First add Income & Expenses, then ask me anything.
        <div class="flex flex-wrap gap-2 mt-3">
          <button onclick="quickChat('Analyze my spending')"
                  class="text-xs bg-sky-50 text-sky-700 px-3 py-1.5 rounded-full hover:bg-sky-100">
            Analyze my spending
          </button>
          <button onclick="quickChat('How can I save more?')"
                  class="text-xs bg-sky-50 text-sky-700 px-3 py-1.5 rounded-full hover:bg-sky-100">
            How can I save more?
          </button>
          <button onclick="quickChat('Suggest a budget')"
                  class="text-xs bg-sky-50 text-sky-700 px-3 py-1.5 rounded-full hover:bg-sky-100">
            Suggest a budget
          </button>
        </div>
      </div>
    </div>`;
}

function quickChat(text) {
  document.getElementById("chatInput").value = text;
  sendChat({ preventDefault: () => {} });
}

async function sendChat(e) {
  e.preventDefault();

  const input = document.getElementById("chatInput");
  const text = input.value.trim();

  if (!text) return;

  input.value = "";

  const box = document.getElementById("chatBox");

  const userMessage = document.createElement("div");
  userMessage.className = "flex gap-3 justify-end";

  const userBubble = document.createElement("div");
  userBubble.className =
    "bg-sky-500 text-white rounded-2xl rounded-tr-md px-4 py-3 max-w-[80%] text-sm";
  userBubble.textContent = text;

  const userAvatar = document.createElement("div");
  userAvatar.className =
    "w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center text-xs font-bold flex-shrink-0";
  userAvatar.textContent = "U";

  userMessage.append(userBubble, userAvatar);
  box.appendChild(userMessage);

  const replyBubble = document.createElement("div");
  replyBubble.className =
    "bg-white rounded-2xl rounded-tl-md px-4 py-3 shadow-sm border max-w-[85%] text-sm whitespace-pre-line";
  replyBubble.textContent = "Analysing your financial data...";

  const replyMessage = document.createElement("div");
  replyMessage.className = "flex gap-3";

  const botAvatar = document.createElement("div");
  botAvatar.className =
    "w-8 h-8 rounded-lg bg-sky-500 flex items-center justify-center text-white text-xs flex-shrink-0";
  botAvatar.innerHTML = '<i class="fas fa-robot"></i>';

  replyMessage.append(botAvatar, replyBubble);
  box.appendChild(replyMessage);
  box.scrollTop = box.scrollHeight;

   try {
    const parsedTransaction = parseNaturalTransaction(text);

    if (parsedTransaction) {
      replyMessage.remove();
      showNaturalTransactionPreview(parsedTransaction, box);
      return;
    }

    let reply = buildAIReply(text);
    const query = text.toLowerCase();

    const needsRecommendations =
      /save|saving|bachat|budget|spend|spending|expense|analyse|analyze|analysis|recommend|overspend|financial|advice|suggestion/.test(query);

    if (
      needsRecommendations &&
      sessionStorage.getItem("afa_access_token")
    ) {
      try {
        const data = await apiRequest(
          "/financial-analysis/recommendations"
        );

        const recommendations = Array.isArray(data.recommendations)
          ? data.recommendations
          : [];

        const formatted = recommendations
          .map(item => {
            if (typeof item === "string") return item;

            if (item && typeof item === "object") {
              return (
                item.recommendation ||
                item.message ||
                item.description ||
                item.title ||
                ""
              );
            }

            return "";
          })
          .filter(Boolean);

        if (formatted.length) {
          reply +=
            "\n\nPersonalized recommendations from your financial analysis:\n\n" +
            formatted.map(item => "• " + item).join("\n");
        } else {
          reply +=
            "\n\nYour financial analysis did not return any additional recommendations yet.";
        }

      } catch (apiError) {
        console.error("AI recommendation request failed:", apiError);

        reply +=
          "\n\nI couldn't load additional backend recommendations right now. " +
          "The summary above uses your available transaction data.";
      }
    }

    replyBubble.textContent = reply;

  } catch (error) {
    console.error("AI Advisor error:", error);

    replyBubble.textContent =
      "Sorry, I couldn't prepare your response. Please try again.";
  }

  box.scrollTop = box.scrollHeight;
}

// ========== CLEAR DATA ==========
function clearAllData() {
  if (
    !confirm(
      "Delete ALL transactions, budgets and goals? This cannot be undone."
    )
  ) {
    return;
  }

  transactions = [];
  budgets = [];
  goals = [];

  localStorage.removeItem("afa_tx");
  localStorage.removeItem("afa_budgets");
  localStorage.removeItem("afa_goals");

  updateDashboard();
  renderExpenses();
  renderBudget();
  updateReports();

  toast("All data cleared");
  showPage("dashboard");
}


/* ========== BILL MANAGEMENT ========== */

let bills = [];

function getBillDateStatus(bill) {
  if (bill.is_paid) return "Paid";

  const parts = String(bill.due_date).split("-");
  const dueDate = new Date(
    Number(parts[0]),
    Number(parts[1]) - 1,
    Number(parts[2])
  );

  const now = new Date();
  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  const daysLeft = Math.round(
    (dueDate.getTime() - today.getTime()) / 86400000
  );

  if (daysLeft < 0) return "Overdue";
  if (daysLeft <= 7) return "Due Soon";
  return "Upcoming";
}

function formatBillAmount(amount) {
  return "₹" + Number(amount).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

async function loadBillsFromBackend() {
  const list = document.getElementById("billList");

  if (list) {
    list.innerHTML =
      '<p class="text-sm text-slate-500">Loading bills...</p>';
  }

  try {
    bills = await apiRequest("/bills");
    syncBillNotifications();
    renderBills();
  } catch (error) {
    if (list) {
      list.innerHTML =
        '<p class="text-sm text-rose-600">Could not load bills: ' +
        escapeHtml(error.message) +
        "</p>";
    }

    toast(error.message || "Could not load bills");
  }
}

function renderBills() {
  const list = document.getElementById("billList");
  const summary = document.getElementById("billSummary");

  if (!list || !summary) return;

  const pendingBills = bills.filter(bill => !bill.is_paid);

  const pendingAmount = pendingBills.reduce(
    (total, bill) => total + Number(bill.amount),
    0
  );

  const overdueBills = pendingBills.filter(
    bill => getBillDateStatus(bill) === "Overdue"
  );

  const upcomingBills = pendingBills.filter(
    bill => getBillDateStatus(bill) !== "Overdue"
  );

  summary.innerHTML = `
    <div class="rounded-xl bg-sky-50 p-4">
      <p class="text-xs font-semibold text-sky-700">Pending Amount</p>
      <p class="text-xl font-bold text-sky-900 mt-2">
        ${formatBillAmount(pendingAmount)}
      </p>
    </div>
    <div class="rounded-xl bg-rose-50 p-4">
      <p class="text-xs font-semibold text-rose-700">Overdue Bills</p>
      <p class="text-xl font-bold text-rose-900 mt-2">
        ${overdueBills.length}
      </p>
    </div>
    <div class="rounded-xl bg-emerald-50 p-4">
      <p class="text-xs font-semibold text-emerald-700">Upcoming Bills</p>
      <p class="text-xl font-bold text-emerald-900 mt-2">
        ${upcomingBills.length}
      </p>
    </div>
  `;

  if (bills.length === 0) {
    list.innerHTML = `
      <div class="text-center py-8">
        <i class="fas fa-file-invoice text-3xl text-slate-300 mb-3"></i>
        <p class="text-slate-500">No bills added yet.</p>
        <p class="text-sm text-slate-400 mt-1">
          Add your first bill using the form above.
        </p>
      </div>
    `;
    return;
  }

  const sortedBills = [...bills].sort((a, b) => {
    if (a.is_paid !== b.is_paid) return a.is_paid ? 1 : -1;
    return String(a.due_date).localeCompare(String(b.due_date));
  });

  list.innerHTML = sortedBills.map(bill => {
    const status = getBillDateStatus(bill);

    const statusClasses = {
      Paid: "bg-emerald-100 text-emerald-700",
      Overdue: "bg-rose-100 text-rose-700",
      "Due Soon": "bg-amber-100 text-amber-700",
      Upcoming: "bg-sky-100 text-sky-700"
    };

    return `
      <div class="border border-slate-200 rounded-xl p-4 mb-3">
        <div class="flex flex-col sm:flex-row sm:items-center
                    justify-between gap-3">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <h4 class="font-semibold text-slate-800">
                ${escapeHtml(bill.title)}
              </h4>
              <span class="text-xs font-semibold px-2 py-1 rounded-full
                ${statusClasses[status]}">
                ${status}
              </span>
            </div>

            <p class="text-sm text-slate-500 mt-1">
              ${escapeHtml(bill.category)}
              · Due ${escapeHtml(bill.due_date)}
            </p>

            ${bill.notes ? `
              <p class="text-sm text-slate-500 mt-1">
                ${escapeHtml(bill.notes)}
              </p>
            ` : ""}

            ${bill.is_recurring ? `
              <p class="text-xs text-sky-600 mt-1">
                <i class="fas fa-sync-alt mr-1"></i>
                Recurring bill
              </p>
            ` : ""}
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <span class="font-bold text-slate-900 mr-2">
              ${formatBillAmount(bill.amount)}
            </span>

            ${!bill.is_paid ? `
              <button type="button"
                onclick="markBillPaid(${Number(bill.id)})"
                class="px-3 py-2 rounded-lg bg-emerald-600
                       text-white text-sm hover:bg-emerald-700">
                <i class="fas fa-check mr-1"></i> Mark Paid
              </button>
            ` : ""}

            <button type="button"
              onclick="deleteBill(${Number(bill.id)})"
              class="px-3 py-2 rounded-lg bg-rose-50
                     text-rose-700 text-sm hover:bg-rose-100">
              <i class="fas fa-trash mr-1"></i> Delete
            </button>
          </div>
        </div>
      </div>
    `;
  }).join("");
  renderDashboardBills();
}


function renderDashboardBills() {
  const stats = document.getElementById("dashboardBillStats");
  const list = document.getElementById("dashboardBillList");

  if (!stats || !list) return;

  const pending = bills.filter(bill => !bill.is_paid);

  const overdue = pending.filter(
    bill => getBillDateStatus(bill) === "Overdue"
  );

  const dueInSevenDays = pending.filter(bill => {
    const status = getBillDateStatus(bill);
    return status === "Due Soon";
  });

  const pendingAmount = pending.reduce(
    (sum, bill) => sum + Number(bill.amount),
    0
  );

  stats.innerHTML = `
    <div class="rounded-xl bg-sky-50 p-4">
      <p class="text-xs font-semibold text-sky-700">Pending Amount</p>
      <p class="text-xl font-bold text-sky-900 mt-2">
        ${formatBillAmount(pendingAmount)}
      </p>
    </div>
    <div class="rounded-xl bg-rose-50 p-4">
      <p class="text-xs font-semibold text-rose-700">Overdue Bills</p>
      <p class="text-xl font-bold text-rose-900 mt-2">
        ${overdue.length}
      </p>
    </div>
    <div class="rounded-xl bg-amber-50 p-4">
      <p class="text-xs font-semibold text-amber-700">Due in 7 Days</p>
      <p class="text-xl font-bold text-amber-900 mt-2">
        ${dueInSevenDays.length}
      </p>
    </div>
  `;

  const priorityBills = [...pending].sort((a, b) => {
    const statusOrder = { Overdue: 0, "Due Soon": 1, Upcoming: 2 };
    const difference =
      statusOrder[getBillDateStatus(a)] -
      statusOrder[getBillDateStatus(b)];

    return difference || String(a.due_date).localeCompare(String(b.due_date));
  }).slice(0, 4);

  if (priorityBills.length === 0) {
    list.innerHTML = `
      <div class="rounded-xl bg-emerald-50 p-4">
        <p class="font-semibold text-emerald-800">
          <i class="fas fa-check-circle mr-2"></i>You're all caught up!
        </p>
        <p class="text-sm text-emerald-700 mt-1">
          No pending bills. New reminders will appear here when you add bills.
        </p>
      </div>
    `;
    return;
  }

  list.innerHTML = priorityBills.map(bill => {
    const status = getBillDateStatus(bill);

    const statusClass = status === "Overdue"
      ? "text-rose-600"
      : status === "Due Soon"
        ? "text-amber-600"
        : "text-sky-600";

    return `
      <div class="flex flex-wrap items-center justify-between gap-3
                  border-t border-slate-100 py-3">
        <div>
          <p class="font-semibold text-slate-800">
            ${escapeHtml(bill.title)}
          </p>
          <p class="text-sm text-slate-500 mt-1">
            Due: ${escapeHtml(bill.due_date)}
          </p>
        </div>
        <div class="text-right">
          <p class="font-bold text-slate-800">
            ${formatBillAmount(bill.amount)}
          </p>
          <p class="text-xs font-semibold mt-1 ${statusClass}">
            ${status}
          </p>
        </div>
      </div>
    `;
  }).join("");
}


async function addBill(event) {
  event.preventDefault();

  const payload = {
    title: document.getElementById("billTitle").value.trim(),
    amount: Number(document.getElementById("billAmount").value),
    category: document.getElementById("billCategory").value,
    due_date: document.getElementById("billDueDate").value,
    is_recurring: document.getElementById("billRecurring").checked,
    notes: document.getElementById("billNotes").value.trim() || null
  };

  if (
    !payload.title ||
    !Number.isFinite(payload.amount) ||
    payload.amount <= 0 ||
    !payload.due_date
  ) {
    toast("Please enter valid bill details");
    return;
  }

  try {
    await apiRequest("/bills", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    document.getElementById("billForm").reset();

    toast("Bill added successfully!");

    await loadBillsFromBackend();
  } catch (error) {
    toast(error.message || "Could not add bill");
  }
}

async function markBillPaid(billId) {
  try {
    await apiRequest(`/bills/${billId}/paid`, {
      method: "PATCH"
    });

    toast("Bill marked as paid!");

    await loadBillsFromBackend();
  } catch (error) {
    toast(error.message || "Could not update bill");
  }
}

async function deleteBill(billId) {
  if (!confirm("Are you sure you want to delete this bill?")) {
    return;
  }

  try {
    await apiRequest(`/bills/${billId}`, {
      method: "DELETE"
    });

    toast("Bill deleted successfully!");

    await loadBillsFromBackend();
  } catch (error) {
    toast(error.message || "Could not delete bill");
  }
}
   

// ========== START ==========
document.addEventListener("DOMContentLoaded", async () => {
  if (localStorage.getItem("afa_dark") === "1") {
    document.body.classList.add("dark-mode");

    const btn = document.getElementById("darkBtn");

    if (btn) {
      btn.innerHTML = '<i class="fas fa-sun"></i>';
    }
  }

  const token = sessionStorage.getItem("afa_access_token");
   
  const savedEmail=sessionStorage.getItem("afa_user_email");

  if(savedEmail){
    updateUserProfile(savedEmail);
  }

  if (!token) {
    setAuthVisibility(false);
    return;
  }

  try {
    // Validate the saved token with a protected backend request.
    await apiRequest("/transactions");

    setAuthVisibility(true);

    await loadTransactionsFromBackend();
    await loadBudgetGoalsFromBackend();
    await loadBillsFromBackend();

    showPage("dashboard");

  } catch (error) {
    console.error("Session validation failed:", error);

    // Clear invalid sessions, but don't log the user out
    // simply because the backend is temporarily unreachable.
    if (error.status === 401 || error.status === 403) {
      sessionStorage.removeItem("afa_access_token");
      setAuthVisibility(false);

      document.getElementById("authError").textContent =
        "Your session may have expired. Please log in again.";
    } else {
      setAuthVisibility(true);

      toast(
        "Cannot connect to the backend. Check that your FastAPI server is running."
      );
    }
  }
});

// ==========================================
// SMART SAVINGS PLANNER
// ==========================================

function getPlannerGoals() {
    try {
        const savedGoals = JSON.parse(
            localStorage.getItem("afa_goals") || "[]"
        );

        return Array.isArray(savedGoals) ? savedGoals : [];
    } catch (error) {
        console.error("Unable to load savings goals:", error);
        return [];
    }
}

function plannerGoalValue(goal, possibleKeys, fallback = 0) {
    for (const key of possibleKeys) {
        const value = Number(goal?.[key]);

        if (
            goal?.[key] !== undefined &&
            goal?.[key] !== null &&
            goal?.[key] !== "" &&
            Number.isFinite(value)
        ) {
            return value;
        }
    }

    return fallback;
}

function plannerGoalName(goal) {
    return String(
        goal?.name ||
        goal?.goalName ||
        goal?.title ||
        "Savings Goal"
    );
}

function plannerMoney(amount) {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0
    }).format(Number.isFinite(amount) ? amount : 0);
}

function loadSavingsPlanner() {
    const select = document.getElementById("plannerGoal");

    if (!select) return;

    const goals = getPlannerGoals();
    const previousValue = select.value;

    select.replaceChildren();

    if (goals.length === 0) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "No savings goals found";
        select.appendChild(option);

        calculateSavingsPlan();
        return;
    }

    goals.forEach((goal, index) => {
        const option = document.createElement("option");
        option.value = String(index);
        option.textContent = plannerGoalName(goal);
        select.appendChild(option);
    });

    if (
        previousValue !== "" &&
        Number(previousValue) >= 0 &&
        Number(previousValue) < goals.length
    ) {
        select.value = previousValue;
    }

    calculateSavingsPlan();
}

function calculateSavingsPlan() {
    const select = document.getElementById("plannerGoal");
    const monthlyInput = document.getElementById(
        "plannerMonthlySavings"
    );

    if (!select || !monthlyInput) return;

    const goals = getPlannerGoals();
    const selectedIndex = Number(select.value);
    const hasGoal =
        select.value !== "" &&
        Number.isInteger(selectedIndex) &&
        selectedIndex >= 0 &&
        selectedIndex < goals.length;

    const goal = hasGoal ? goals[selectedIndex] : null;

    const setText = (id, value) => {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    };

    const setProgress = (percentage) => {
        const bar = document.getElementById("plannerProgressBar");

        if (bar) {
            bar.style.width = `${percentage}%`;
        }
    };

    if (!goal) {
        setText("plannerGoalName", "No savings goal selected");
        setText("plannerTarget", "₹0");
        setText("plannerCurrent", "₹0");
        setText("plannerProgressText", "0%");
        setText("plannerRemaining", "₹0");
        setText("plannerMonths", "—");
        setText("plannerDate", "");
        setText("plannerMonthlyResult", "₹0");
        setText("plannerOldMonthly", "—");
        setText("plannerOldMonths", "Add a savings goal first.");
        setText("plannerNewMonthly", "—");
        setText("plannerComparison", "No goal available to compare.");
        setProgress(0);
        return;
    }

    const target = Math.max(0, plannerGoalValue(
        goal,
        ["target", "goalTarget", "targetAmount", "target_amount"]
    ));

    const current = Math.max(0, plannerGoalValue(
        goal,
        ["current", "goalCurrent", "currentAmount", "current_amount", "saved"]
    ));

    const remaining = Math.max(0, target - current);
    const progress = target > 0
        ? Math.min(100, (current / target) * 100)
        : 100;

    const monthly = Number(monthlyInput.value);

    // Supports common property names for an existing monthly contribution.
    const currentMonthlyInput = document.getElementById(
    "plannerCurrentMonthlySavings"
  );

   const oldMonthly = currentMonthlyInput
    ? Math.max(0, Number(currentMonthlyInput.value) || 0)
    : 0;

    setText("plannerGoalName", plannerGoalName(goal));
    setText("plannerTarget", plannerMoney(target));
    setText("plannerCurrent", plannerMoney(current));
    setText("plannerProgressText", `${progress.toFixed(1)}%`);
    setText("plannerRemaining", plannerMoney(remaining));
    setProgress(progress);

    const validMonthly = Number.isFinite(monthly) && monthly > 0;

    if (remaining === 0) {
        setText("plannerMonths", "Goal achieved!");
        setText("plannerDate", "You've reached your target.");
    } else if (validMonthly) {
        const months = Math.ceil(remaining / monthly);
        const completionDate = new Date();
        completionDate.setDate(1);
        completionDate.setMonth(completionDate.getMonth() + months);

        setText(
            "plannerMonths",
            `${months} month${months === 1 ? "" : "s"}`
        );

        setText(
            "plannerDate",
            `Estimated completion: ${completionDate.toLocaleDateString(
                "en-IN",
                { month: "long", year: "numeric" }
            )}`
        );
    } else {
        setText("plannerMonths", "Enter a valid amount");
        setText("plannerDate", "Monthly savings must be greater than ₹0.");
    }

    setText(
        "plannerMonthlyResult",
        validMonthly ? plannerMoney(monthly) : "—"
    );

    setText(
        "plannerOldMonthly",
        oldMonthly > 0 ? plannerMoney(oldMonthly) : "Not set"
    );

    setText(
        "plannerNewMonthly",
        validMonthly ? plannerMoney(monthly) : "—"
    );

    if (remaining === 0) {
        setText("plannerOldMonths", "Goal already achieved.");
        setText("plannerComparison", "Congratulations! Your goal is complete.");
    } else {
        const oldMonths = oldMonthly > 0
            ? Math.ceil(remaining / oldMonthly)
            : null;

        setText(
            "plannerOldMonths",
            oldMonths !== null
                ? `Estimated completion: ${oldMonths} month${oldMonths === 1 ? "" : "s"}`
                : "Set a current monthly contribution to compare."
        );

        if (!validMonthly) {
            setText("plannerComparison", "Enter a monthly savings amount.");
        } else if (oldMonths === null) {
            setText(
                "plannerComparison",
                "Your new plan is calculated. Add your current monthly contribution for a time comparison."
            );
        } else {
            const newMonths = Math.ceil(remaining / monthly);
            const difference = oldMonths - newMonths;

            if (difference > 0) {
                setText(
                    "plannerComparison",
                    `You'll reach your goal about ${difference} month${difference === 1 ? "" : "s"} sooner.`
                );
            } else if (difference < 0) {
                setText(
                    "plannerComparison",
                    `This plan takes about ${Math.abs(difference)} month${Math.abs(difference) === 1 ? "" : "s"} longer.`
                );
            } else {
                setText(
                    "plannerComparison",
                    "Both plans have the same estimated completion time."
                );
            }
        }
    }
}

// ==========================================
// GOAL-AWARE FINANCE COACH
// ==========================================

function generateGoalCoachAdvice() {
    const output = document.getElementById("goalCoachContent");
    const select = document.getElementById("plannerGoal");
    const currentInput = document.getElementById(
        "plannerCurrentMonthlySavings"
    );
    const adjustedInput = document.getElementById(
        "plannerMonthlySavings"
    );

    if (!output || !select || !adjustedInput) return;

    const goals = getPlannerGoals();
    const index = Number(select.value);

    if (
        select.value === "" ||
        !Number.isInteger(index) ||
        index < 0 ||
        index >= goals.length
    ) {
        output.textContent = "Please select a savings goal first.";
        return;
    }

    const goal = goals[index];

    const target = Math.max(0, plannerGoalValue(
        goal,
        ["target", "goalTarget", "targetAmount", "target_amount"]
    ));

    const saved = Math.max(0, plannerGoalValue(
        goal,
        ["current", "goalCurrent", "currentAmount", "current_amount", "saved"]
    ));

    const remaining = Math.max(0, target - saved);
    const currentMonthly = currentInput
        ? Number(currentInput.value)
        : 0;
    const adjustedMonthly = Number(adjustedInput.value);

    const money = (amount) => plannerMoney(amount);
    const advice = [];

    if (remaining === 0) {
        advice.push({
            title: "Congratulations!",
            message: "You've reached this savings goal. You can now decide whether to build your emergency fund or work toward another goal."
        });
    } else if (!Number.isFinite(adjustedMonthly) || adjustedMonthly <= 0) {
        advice.push({
            title: "Choose a monthly savings amount",
            message: "Enter a monthly contribution greater than ₹0 so I can estimate your goal timeline."
        });
    } else {
        const adjustedMonths = Math.ceil(remaining / adjustedMonthly);

        advice.push({
            title: "Your goal",
            message: `${plannerGoalName(goal)} has ${money(remaining)} remaining. At ${money(adjustedMonthly)} per month, the estimated timeline is ${adjustedMonths} month${adjustedMonths === 1 ? "" : "s"}.`
        });

        if (Number.isFinite(currentMonthly) && currentMonthly > 0) {
            const currentMonths = Math.ceil(remaining / currentMonthly);
            const difference = currentMonths - adjustedMonths;

            if (difference > 0) {
                advice.push({
                    title: "Potential time saved",
                    message: `Increasing your monthly contribution from ${money(currentMonthly)} to ${money(adjustedMonthly)} could help you reach the goal about ${difference} month${difference === 1 ? "" : "s"} sooner.`
                });
            } else if (difference < 0) {
                advice.push({
                    title: "Review the adjusted amount",
                    message: `This contribution could take about ${Math.abs(difference)} month${Math.abs(difference) === 1 ? "" : "s"} longer than your current plan.`
                });
            } else {
                advice.push({
                    title: "Plan comparison",
                    message: "Both monthly contribution amounts give the same estimated timeline."
                });
            }
        }

        advice.push({
            title: "Keep the plan practical",
            message: "Choose a contribution you can maintain after essential bills and regular expenses. Avoid reducing necessary spending just to meet a savings target."
        });
    }

    output.replaceChildren();

    advice.forEach((item) => {
        const card = document.createElement("div");
        card.className = "mb-4 last:mb-0";

        const heading = document.createElement("h4");
        heading.className = "font-semibold text-gray-800 mb-1";
        heading.textContent = item.title;

        const paragraph = document.createElement("p");
        paragraph.className = "text-sm text-gray-600";
        paragraph.textContent = item.message;

        card.append(heading, paragraph);
        output.appendChild(card);
    });
}

// ==========================================
// BACKEND-INTEGRATED GOAL FINANCE COACH
// ==========================================

async function generateGoalCoachAdviceWithBackend() {
    // Keep the existing goal-specific advice working.
    generateGoalCoachAdvice();

    const output = document.getElementById("goalCoachContent");

    if (!output) return;

    const token = sessionStorage.getItem("afa_access_token");

    if (!token) {
        const message = document.createElement("p");
        message.className = "text-sm text-amber-700 mt-3";
        message.textContent =
            "Please log in to load personalized recommendations from your financial data.";
        output.appendChild(message);
        return;
    }

    const loading = document.createElement("p");
    loading.id = "goalCoachBackendLoading";
    loading.className = "text-sm text-gray-500 mt-3";
    loading.textContent = "Loading your financial recommendations...";
    output.appendChild(loading);

    try {
        // Reuse the existing API helper so the configured API URL
        // and Authorization header remain consistent with your app.
        const data = await apiRequest(
            "/financial-analysis/recommendations"
        );

        loading.remove();

        const recommendations = Array.isArray(data?.recommendations)
            ? data.recommendations
            : [];

        const heading = document.createElement("h4");
        heading.className = "font-semibold text-gray-800 mt-4 mb-2";
        heading.textContent = "Recommendations from your financial data";
        output.appendChild(heading);

        if (recommendations.length === 0) {
            const empty = document.createElement("p");
            empty.className = "text-sm text-gray-600";
            empty.textContent =
                "The backend did not return any recommendations yet.";
            output.appendChild(empty);
            return;
        }

        const list = document.createElement("ul");
        list.className = "list-disc pl-5 space-y-2 text-sm text-gray-700";

        recommendations.forEach((recommendation) => {
            const item = document.createElement("li");

            // Support either plain-text recommendations or common
            // object formats, without rendering untrusted HTML.
            let message = "";

            if (typeof recommendation === "string") {
                message = recommendation;
            } else if (recommendation && typeof recommendation === "object") {
                message = [
                    recommendation.title,
                    recommendation.message,
                    recommendation.description,
                    recommendation.recommendation
                ].find(
                    (value) => typeof value === "string" && value.trim()
                ) || JSON.stringify(recommendation);
            } else {
                message = String(recommendation);
            }

            item.textContent = message;
            list.appendChild(item);
        });

        output.appendChild(list);

    } catch (error) {
        const loadingMessage = document.getElementById(
            "goalCoachBackendLoading"
        );

        if (loadingMessage) loadingMessage.remove();

        const errorMessage = document.createElement("p");
        errorMessage.className = "text-sm text-red-600 mt-3";
        errorMessage.textContent =
            "Your goal advice is available, but backend recommendations could not be loaded. Please check that the backend is running and your login is valid.";

        output.appendChild(errorMessage);
        console.error("Goal Coach backend error:", error);
    }
}


/* ========== NOTIFICATION SYSTEM ========== */

let financeNotifications = [];
let notificationPanelOpen = false;

function toggleNotifications() {
  const panel = document.getElementById("notificationPanel");
  const bell = document.getElementById("notificationBell");

  if (!panel) return;

  notificationPanelOpen = panel.classList.contains("hidden");

  panel.classList.toggle("hidden", !notificationPanelOpen);

  if (bell) {
    bell.setAttribute("aria-expanded", String(notificationPanelOpen));
  }

  if (notificationPanelOpen) {
    renderNotifications();
  }
}

function renderNotifications() {
  const list = document.getElementById("notificationList");
  const badge = document.getElementById("notificationBadge");

  if (!list || !badge) return;

  const unreadCount = financeNotifications.filter(n => !n.read).length;

  badge.textContent = unreadCount > 99 ? "99+" : String(unreadCount);
  badge.classList.toggle("hidden", unreadCount === 0);
  badge.classList.toggle("flex", unreadCount > 0);

  if (financeNotifications.length === 0) {
    list.innerHTML = `
      <div class="p-5 text-center">
        <i class="fas fa-bell-slash text-2xl text-slate-300"></i>
        <p class="text-sm text-slate-500 mt-2">No notifications yet.</p>
      </div>`;
    return;
  }

  list.innerHTML = financeNotifications.map((n, index) => `
    <div class="p-3 mb-2 rounded-xl ${
      n.read ? "bg-white" : "bg-sky-50"
    } border border-slate-100">
      <div class="flex gap-3">
        <i class="fas ${n.icon} mt-1 ${
          n.type === "overdue" ? "text-rose-500" : "text-sky-600"
        }"></i>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold text-slate-800">${escapeHtml(n.title)}</p>
          <p class="text-xs text-slate-600 mt-1">${escapeHtml(n.message)}</p>
          ${
            n.read ? "" : `
              <button type="button"
                onclick="markNotificationRead(${index})"
                class="text-xs text-sky-700 font-semibold mt-2">
                Mark as read
              </button>`
          }
        </div>
      </div>
    </div>
  `).join("");
}

function markNotificationRead(index) {
  if (!financeNotifications[index]) return;
  financeNotifications[index].read = true;
  renderNotifications();
}

function markAllNotificationsRead() {
  financeNotifications.forEach(n => {
    n.read = true;
  });
  renderNotifications();
}

async function requestBrowserNotificationPermission() {
  if (!("Notification" in window)) {
    toast("Your browser does not support notifications.");
    return;
  }

  if (!window.isSecureContext) {
    toast("Open the website using localhost or HTTPS.");
    return;
  }

  try {
    const permission = await Notification.requestPermission();

    if (permission === "granted") {
      toast("Browser notifications enabled!");

      new Notification("AI Finance Advisor", {
        body: "Notifications are enabled successfully!",
        icon: "/favicon.ico"
      });
    } else {
      toast("Notification permission was not granted.");
    }
  } catch (error) {
    console.error("Browser notification error:", error);
    toast("Could not enable browser notifications.");
  }
}

function syncBillNotifications() {
  financeNotifications = [];

  const pendingBills = bills.filter(bill => !bill.is_paid);

  pendingBills.forEach(bill => {
    const status = getBillDateStatus(bill);
    const amount = formatBillAmount(bill.amount);

    if (status === "Overdue") {
      financeNotifications.push({
        title: "Bill Overdue",
        message: `${bill.title}: ${amount}. Please check its due date (${bill.due_date}).`,
        type: "overdue",
        icon: "fa-exclamation-circle",
        read: false
      });
    } else if (status === "Due Soon") {
      financeNotifications.push({
        title: "Bill Due Soon",
        message: `${bill.title}: ${amount}, due on ${bill.due_date}.`,
        type: "upcoming",
        icon: "fa-calendar-alt",
        read: false
      });
    }
  });

  renderNotifications();
  showBrowserBillNotifications();
}

function showBrowserBillNotifications() {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  const urgentBills = bills.filter(bill => {
    if (bill.is_paid) return false;
    const status = getBillDateStatus(bill);
    return status === "Overdue" || status === "Due Soon";
  });

  // Avoid repeatedly showing the same popup during this page session.
  if (!window.shownBillNotificationIds) {
    window.shownBillNotificationIds = new Set();
  }

  urgentBills.forEach(bill => {
    if (window.shownBillNotificationIds.has(bill.id)) return;

    const status = getBillDateStatus(bill);
    try {
      new Notification(
        status === "Overdue" ? "Bill Overdue!" : "Bill Due Soon!",
        {
          body: `${bill.title}: ${formatBillAmount(bill.amount)}. Due date: ${bill.due_date}.`
        }
      );
      window.shownBillNotificationIds.add(bill.id);
    } catch (error) {
      console.error("Could not show bill notification:", error);
    }
  });
}

function handleGlobalSearch(){

  const value=document
      .getElementById("globalSearch")
      ?.value
      .trim()
      .toLowerCase();

  const txSearch=document.getElementById("searchTx");

  if(txSearch){
      txSearch.value=value;
      txSearch.dispatchEvent(new Event("input"));
  }
}

// ========== FINANCIAL DIGITAL TWIN ==========
function twinMoney(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "₹0";
  return number.toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  });
}


async function calculateTwinProjection() {
  const monthly = Math.max(
    0,
    Number(document.getElementById("twin-monthly")?.value) || 0
  );

  const months = Math.max(
    1,
    Number(document.getElementById("twin-months")?.value) || 12
  );

  const output = document.getElementById("twin-projection");
  const note = document.getElementById("twin-projection-note");

  if (output) output.textContent = "Calculating...";

  try {
    const result = await apiRequest(
      `/ml/what-if-simulator?monthly_savings=${encodeURIComponent(monthly)}&months=${encodeURIComponent(months)}`
    );

    if (result.status !== "success") {
      if (output) output.textContent = twinMoney(monthly * months);
      if (note) note.textContent =
        result.message || "Add income and expense transactions for a personalized estimate.";
      return;
    }

    if (output) {
      output.textContent = twinMoney(result.planned_total_savings);
    }

    if (note) {
      const affordable = result.estimated_affordable_monthly_savings;
      const surplus = result.estimated_monthly_surplus;

      note.textContent =
        `Your plan: ${twinMoney(monthly)} per month for ${months} months. ` +
        `Recorded monthly income averages ${twinMoney(result.monthly_income_average)} ` +
        `and expenses average ${twinMoney(result.monthly_expenses_average)}. ` +
        `Estimated monthly surplus: ${twinMoney(surplus)}. ` +
        `Your planned savings are ${monthly <= affordable ? "within" : "above"} ` +
        `the estimated monthly surplus of ${twinMoney(affordable)}. ` +
        `This is an estimate, not a guarantee.`;
    }
  } catch (error) {
    if (output) output.textContent = twinMoney(monthly * months);
    if (note) note.textContent =
      "Could not load personalized estimates. Check the backend or log in again.";
  }
}


async function loadDigitalTwin() {
  const insight = document.getElementById("twin-insight");
  if (insight) insight.textContent = "Loading your financial data...";

  try {
    const [summaryResult, transactionsResult] = await Promise.allSettled([
      apiRequest("/summary"),
      apiRequest("/transactions")
    ]);

    const summary = summaryResult.status === "fulfilled"
      ? summaryResult.value : {};
    const transactions = transactionsResult.status === "fulfilled"
      && Array.isArray(transactionsResult.value)
      ? transactionsResult.value : [];

    const findNumber = (obj, keys) => {
      for (const key of keys) {
        if (obj && obj[key] !== undefined && obj[key] !== null) {
          const value = Number(obj[key]);
          if (Number.isFinite(value)) return value;
        }
      }
      return null;
    };
    loadSpendingAnomalies();
    loadGoalPredictions();
    loadFinancialCoach();
    loadFinancialHealthScore();

    let income = findNumber(summary, [
      "total_income", "income", "monthly_income", "totalIncome"
    ]);
    let expenses = findNumber(summary, [
      "total_expenses", "expenses", "monthly_expenses", "totalExpenses"
    ]);
    let balance = findNumber(summary, [
      "balance", "net_balance", "netBalance", "total_balance"
    ]);

    if (income === null && transactions.length) {
      income = transactions.filter(t => t.transaction_type === "income")
        .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    }
    if (expenses === null && transactions.length) {
      expenses = transactions.filter(t => t.transaction_type === "expense")
        .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    }
    if (balance === null && income !== null && expenses !== null) {
      balance = income - expenses;
    }

    const incomeEl = document.getElementById("twin-income");
    const expensesEl = document.getElementById("twin-expenses");
    const balanceEl = document.getElementById("twin-balance");

    if (incomeEl) incomeEl.textContent = income === null ? "Unavailable" : twinMoney(income);
    if (expensesEl) expensesEl.textContent = expenses === null ? "Unavailable" : twinMoney(expenses);
    if (balanceEl) balanceEl.textContent = balance === null ? "Unavailable" : twinMoney(balance);

    if (insight) {
      if (summaryResult.status === "rejected" && transactionsResult.status === "rejected") {
        insight.textContent = "Could not load financial data. Check that the backend is running and log in again.";
      } else if (income === null || expenses === null) {
        insight.textContent = `Loaded ${transactions.length} transactions. Some summary fields could not be identified, so check your backend summary response if values show as unavailable.`;
      } else {
        const ratio = income > 0 ? Math.round((expenses / income) * 100) : null;
        insight.textContent = ratio === null
          ? "Add income transactions to see your spending-to-income ratio."
          : `Your recorded expenses are ${ratio}% of your recorded income. ${
              ratio > 80
                ? "Consider reviewing flexible expenses and building an emergency fund."
                : "Keep tracking expenses and contributing regularly to your savings goals."
            }`;
      }
    }
  } catch (error) {
    if (insight) insight.textContent = error.message || "Unable to load financial data.";
  }

  loadTwinForecast();
  calculateTwinProjection();
}


async function loadTwinForecast() {
  const valueEl = document.getElementById("twin-forecast-value");
  const noteEl = document.getElementById("twin-forecast-note");
  if (!valueEl || !noteEl) return;

  try {
    const result = await apiRequest("/ml/expense-prediction");

    if (result.status !== "success" || result.predicted_expense == null) {
      valueEl.textContent = "Not enough data";
      noteEl.textContent =
        `Record expenses across at least 3 months. Available months: ${result.months_used ?? 0}.`;
      return;
    }

    valueEl.textContent = twinMoney(result.predicted_expense);
    noteEl.textContent =
      `Linear Regression estimate based on ${result.months_used} months of history. Actual expenses may differ.`;
  } catch (error) {
    valueEl.textContent = "Unavailable";
    noteEl.textContent = error.message || "Could not load the forecast.";
  }
}


async function loadSpendingAnomalies() {
  const output = document.getElementById("twin-anomalies");
  if (!output) return;

  output.textContent = "Analyzing your spending...";

  try {
    const data = await apiRequest("/ml/spending-anomalies");

    if (data.status !== "success") {
      output.textContent = data.message || "More transaction history is needed.";
      return;
    }

    if (!data.anomalies || data.anomalies.length === 0) {
      output.textContent =
        `${data.message} Latest month checked: ${data.latest_month}.`;
      return;
    }

    output.replaceChildren();

    const heading = document.createElement("p");
    heading.className = "font-semibold text-amber-700 mb-3";
    heading.textContent =
      `Unusual spending found for ${data.latest_month}:`;
    output.appendChild(heading);

    data.anomalies.forEach(item => {
      const card = document.createElement("div");
      card.className =
        "rounded-xl border border-amber-200 bg-amber-50 p-4 mb-3";

      const title = document.createElement("p");
      title.className = "font-bold text-gray-800";
      title.textContent = item.category;

      const amount = document.createElement("p");
      amount.className = "mt-1 text-gray-700";
      amount.textContent =
        `Latest: ${twinMoney(item.latest_amount)} | ` +
        `Previous average: ${twinMoney(item.historical_average)}`;

      const reason = document.createElement("p");
      reason.className = "mt-1 text-sm text-amber-800";
      reason.textContent =
        `Spending is ${twinMoney(item.increase)} above the historical average` +
        (item.increase_percent === null
          ? "."
          : ` (${item.increase_percent}% higher).`);

      card.append(title, amount, reason);
      output.appendChild(card);
    });
  } catch (error) {
    output.textContent =
      error.message || "Unable to analyze spending. Check the backend.";
  }
}


async function loadGoalPredictions() {
  const output = document.getElementById("twin-goal-predictions");
  if (!output) return;

  output.textContent = "Predicting your savings progress...";

  try {
    const data = await apiRequest("/ml/goal-predictions");

    output.replaceChildren();

    if (data.status !== "success" || !data.goals?.length) {
      output.textContent =
        data.message || "Create a savings goal to see predictions.";
      return;
    }

    data.goals.forEach((goal) => {
      const card = document.createElement("div");
      card.className =
        "rounded-xl border border-gray-200 p-4 space-y-2";

      const title = document.createElement("h4");
      title.className = "font-bold text-gray-800";
      title.textContent = goal.goal_name;

      const progress = document.createElement("div");
      progress.className = "w-full h-2 rounded-full bg-gray-100 overflow-hidden";

      const bar = document.createElement("div");
      bar.className = "h-2 rounded-full bg-emerald-600";
      bar.style.width = `${goal.progress_percent}%`;
      progress.appendChild(bar);

      const amounts = document.createElement("p");
      amounts.className = "text-sm text-gray-600";
      amounts.textContent =
        `Saved: ${twinMoney(goal.current_amount)} / ` +
        `${twinMoney(goal.target_amount)} (${goal.progress_percent}%)`;

      const remaining = document.createElement("p");
      remaining.className = "text-sm text-gray-600";
      remaining.textContent =
        `Remaining: ${twinMoney(goal.remaining_amount)}`;

      const recommendation = document.createElement("p");
      recommendation.className = "text-sm font-semibold text-emerald-800";
      recommendation.textContent =
        goal.required_monthly_savings !== null
          ? `Required monthly saving: ${twinMoney(goal.required_monthly_savings)}`
          : "No deadline set for this goal.";

      const prediction = document.createElement("p");
      prediction.className = "text-sm text-gray-700";
      prediction.textContent = goal.estimated_months_to_goal !== null
        ? `Estimated time at recent savings rate: ${goal.estimated_months_to_goal} months`
        : "Estimated completion time unavailable from recent transactions.";

      const status = document.createElement("p");
      status.className = "text-sm font-bold";
      status.textContent =
        `${goal.status.replaceAll("_", " ").toUpperCase()}: ${goal.message}`;

      card.append(title, progress, amounts, remaining, recommendation, prediction, status);
      output.appendChild(card);
    });

    const note = document.createElement("p");
    note.className = "text-xs text-gray-500";
    note.textContent = data.note || "Estimates are not guarantees.";
    output.appendChild(note);

  } catch (error) {
    output.textContent =
      error.message || "Could not load savings goal predictions.";
  }
}


async function loadFinancialCoach() {
  const output = document.getElementById("twin-financial-coach");
  if (!output) return;

  output.textContent = "Preparing your personalized advice...";

  try {
    const data = await apiRequest("/ml/financial-coach");
    output.replaceChildren();

    if (data.status !== "success" || !data.advice?.length) {
      output.textContent =
        data.message || "Add more financial transactions to receive advice.";
      return;
    }

    data.advice.forEach((item) => {
      const card = document.createElement("div");
      card.className = "rounded-xl border border-gray-200 p-4";

      const title = document.createElement("h4");
      title.className = "font-bold text-[#234735]";
      title.textContent = item.title;

      const priority = document.createElement("p");
      priority.className = "text-xs font-semibold uppercase text-emerald-700 mt-1";
      priority.textContent = `${item.priority} priority`;

      const message = document.createElement("p");
      message.className = "text-sm text-gray-600 mt-2";
      message.textContent = item.message;

      card.append(title, priority, message);
      output.appendChild(card);
    });

    const note = document.createElement("p");
    note.className = "text-xs text-gray-500";
    note.textContent = data.note || "Advice is based on recorded financial data.";
    output.appendChild(note);
  } catch (error) {
    output.textContent =
      error.message || "Could not load advice. Check the backend or log in again.";
  }
}


async function loadFinancialHealthScore() {
  const output = document.getElementById("twin-health-score");
  if (!output) return;

  output.textContent = "Calculating your financial health...";

  try {
    const data = await apiRequest("/ml/financial-health-score");
    output.replaceChildren();

    const score = document.createElement("p");
    score.className = "text-4xl font-extrabold text-[#234735]";
    score.textContent = `${data.score}/100`;

    const rating = document.createElement("p");
    rating.className = "mt-1 text-lg font-bold text-emerald-700";
    rating.textContent = data.rating;

    const progress = document.createElement("div");
    progress.className = "mt-4 h-3 w-full rounded-full bg-gray-100 overflow-hidden";

    const bar = document.createElement("div");
    bar.className = "h-3 rounded-full bg-emerald-600";
    bar.style.width = `${data.score}%`;
    progress.appendChild(bar);

    const summary = document.createElement("p");
    summary.className = "mt-4 text-sm text-gray-600";
    summary.textContent =
      `Average monthly income: ${twinMoney(data.average_monthly_income)} | ` +
      `Expenses: ${twinMoney(data.average_monthly_expenses)} | ` +
      `Surplus: ${twinMoney(data.estimated_monthly_surplus)}`;

    const tipsHeading = document.createElement("h4");
    tipsHeading.className = "mt-5 font-bold text-[#234735]";
    tipsHeading.textContent = "Ways to improve";

    const tipsList = document.createElement("ul");
    tipsList.className = "mt-2 list-disc pl-5 space-y-2 text-sm text-gray-600";

    (data.tips || []).forEach((tip) => {
      const item = document.createElement("li");
      item.textContent = tip;
      tipsList.appendChild(item);
    });

    const note = document.createElement("p");
    note.className = "mt-4 text-xs text-gray-500";
    note.textContent = data.note || "This is an indicative financial health score.";

    output.append(score, rating, progress, summary, tipsHeading, tipsList, note);
  } catch (error) {
    output.textContent =
      error.message || "Could not calculate your financial health score.";
  }
}

// ========== AI CHAT VOICE INPUT ==========
function startChatVoiceInput() {
  const input = document.getElementById("chatInput");

  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    toast("Voice input is not supported in this browser. Please try Chrome.");
    return;
  }

  const recognition = new SpeechRecognition();

  recognition.lang = "en-IN";
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onstart = function () {
    toast("Listening... Speak your transaction.");
  };

  recognition.onresult = function (event) {
    input.value = event.results[0][0].transcript;
    input.focus();
  };

  recognition.onerror = function (event) {
    console.error("Voice input error:", event.error);
    toast("Could not recognize speech. Please try again.");
  };

  recognition.start();
}
// ========== NATURAL LANGUAGE TRANSACTION PARSER ==========
function parseNaturalTransaction(text) {
  const input = text.trim();

  const amountMatch = input.match(
    /(?:₹|rs\.?\s*)?(\d+(?:,\d{3})*(?:\.\d{1,2})?)/i
  );

  if (!amountMatch) return null;

  const amount = Number(amountMatch[1].replace(/,/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const iouMatch = input.match(
    /(?:he|she|they|rahul|rohan|riya)?\s*(?:owes?\s+me|owe\s+me|will\s+pay\s+me\s+back|pay\s+me\s+back)\s*(?:₹|rs\.?\s*)?(\d+(?:,\d{3})*(?:\.\d{1,2})?)/i
  );

  const iouAmount = iouMatch
    ? Number(iouMatch[1].replace(/,/g, ""))
    : 0;

  const categoryRules = [
    [/food|dinner|lunch|breakfast|restaurant|swiggy|zomato|pizza/i, "Food"],
    [/uber|ola|petrol|fuel|metro|bus|train|taxi|transport/i, "Transport"],
    [/rent|electricity|water bill|recharge|internet/i, "Bills"],
    [/movie|game|shopping|clothes|entertainment/i, "Shopping"],
    [/doctor|medicine|hospital|pharmacy/i, "Healthcare"],
    [/salary|freelance|bonus/i, "Income"]
  ];

  let category = "Other";

  for (const [pattern, name] of categoryRules) {
    if (pattern.test(input)) {
      category = name;
      break;
    }
  }

  const isIncome = category === "Income";
  const type = isIncome ? "income" : "expense";

  const title = input
    .replace(/(?:₹|rs\.?\s*)?\d+(?:,\d{3})*(?:\.\d{1,2})?/gi, "")
    .replace(/\b(?:he|she|they)\s+owes?\s+me\b/gi, "")
    .replace(/\bowe\s+me\b|\bpay\s+me\s+back\b|\bwill\s+pay\s+me\s+back\b/gi, "")
    .replace(/\s+/g, " ")
    .replace(/^[\s,.-]+|[\s,.-]+$/g, "")
    .trim();

  return {
    title: title || "Natural language transaction",
    amount,
    category,
    type,
    date: today(),
    iouAmount,
    iouPerson: iouMatch
      ? (input.match(/\bwith\s+([a-z]+)/i)?.[1] || "")
      : ""
  };
}

// ========== NATURAL TRANSACTION CONFIRMATION PREVIEW ==========
function showNaturalTransactionPreview(transaction, chatBox) {
  const card = document.createElement("div");
  card.className =
    "bg-white rounded-2xl p-4 shadow-sm border border-emerald-200 max-w-[90%] text-sm space-y-3";

  const heading = document.createElement("h4");
  heading.className = "font-bold text-slate-800";
  heading.textContent = "Review transaction before saving";

  const details = document.createElement("div");
  details.className = "space-y-2 text-slate-600";

  const rows = [
    ["Description", transaction.title],
    ["Amount", "₹" + transaction.amount.toFixed(2)],
    ["Category", transaction.category],
    ["Type", transaction.type],
    ["Date", transaction.date]
  ];

  if (transaction.iouAmount > 0) {
    rows.push([
      "Receivable",
      "₹" + transaction.iouAmount.toFixed(2) +
        (transaction.iouPerson ? " from " + transaction.iouPerson : "")
    ]);
  }

  rows.forEach(([label, value]) => {
    const row = document.createElement("div");
    row.className = "flex justify-between gap-4";

    const left = document.createElement("span");
    left.textContent = label;

    const right = document.createElement("strong");
    right.className = "text-slate-800 text-right";
    right.textContent = value;

    row.append(left, right);
    details.appendChild(row);
  });

  const note = document.createElement("p");
  note.className = "text-xs text-amber-700";
  note.textContent =
    transaction.iouAmount > 0
      ? "Nothing has been saved yet. Confirm only after checking both amounts."
      : "Nothing has been saved yet. Confirm to continue.";

  const actions = document.createElement("div");
  actions.className = "flex gap-2";

  const confirmButton = document.createElement("button");
  confirmButton.type = "button";
  confirmButton.className =
    "px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium";
  confirmButton.textContent = "Confirm";

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.className =
    "px-4 py-2 rounded-lg border border-slate-200 text-slate-700";
  cancelButton.textContent = "Cancel";

  cancelButton.addEventListener("click", () => {
    card.remove();
    toast("Transaction cancelled");
  });

  confirmButton.addEventListener("click", async () => {
    if (!sessionStorage.getItem("afa_access_token")) {
      toast("Please log in before saving a transaction.");
      return;
    }

    if (transaction.iouAmount > 0 && !transaction.iouPerson) {
      toast("Please include the person's name, e.g. with Rahul.");
      return;
    }

    if (
      transaction.iouAmount > 0 &&
      transaction.iouAmount > transaction.amount
    ) {
      toast("The receivable cannot exceed the expense amount.");
      return;
    }

    confirmButton.disabled = true;
    confirmButton.textContent = "Saving...";

    const payload = {
      title: transaction.title,
      amount: transaction.amount,
      category: transaction.category,
      transaction_type: transaction.type,
      transaction_date: transaction.date,
      notes: null,
      iou_person: transaction.iouAmount > 0 ? transaction.iouPerson : null,
      iou_amount: transaction.iouAmount > 0 ? transaction.iouAmount : null
    };

    try {
      const result = await apiRequest("/transactions/natural", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      card.remove();

      const confirmation = document.createElement("div");
      confirmation.className =
        "bg-white rounded-2xl rounded-tl-md px-4 py-3 shadow-sm border border-emerald-200 max-w-[85%] text-sm whitespace-pre-line";

      confirmation.textContent =
        "✅ Saved successfully!\\n" +
        transaction.title + " — ₹" + transaction.amount.toFixed(2) +
        " expense recorded." +
        (result.iou
          ? "\\n💰 ₹" + Number(result.iou.amount).toFixed(2) +
            " receivable recorded from " + result.iou.person_name + "."
          : "");

      const confirmationRow = document.createElement("div");
      confirmationRow.className = "flex gap-3";

      const confirmationAvatar = document.createElement("div");
      confirmationAvatar.className =
        "w-8 h-8 rounded-lg bg-sky-500 flex items-center justify-center text-white text-xs flex-shrink-0";
      confirmationAvatar.innerHTML = '<i class="fas fa-robot"></i>';

      confirmationRow.append(confirmationAvatar, confirmation);
      chatBox.appendChild(confirmationRow);
      chatBox.scrollTop = chatBox.scrollHeight;

      toast(
        result.iou
          ? "Expense and receivable saved successfully!"
          : "Transaction saved successfully!"
      );

      if (typeof loadTransactionsFromBackend === "function") {
        try {
          await loadTransactionsFromBackend();
        } catch (refreshError) {
          console.error("Transaction refresh failed:", refreshError);
        }
      }

      if (typeof loadMoneyOwedFromBackend === "function") {
        try {
          await loadMoneyOwedFromBackend();
        } catch (refreshError) {
          console.error("Money Owed refresh failed:", refreshError);
        }
      }
    } catch (error) {
      console.error("Natural transaction save failed:", error);
      toast(error.message || "Could not save. Please try again.");
      confirmButton.disabled = false;
      confirmButton.textContent = "Confirm";
    }
  });

  actions.append(confirmButton, cancelButton);
  card.append(heading, details, note, actions);
  chatBox.appendChild(card);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// ========== MONEY OWED ==========
async function loadMoneyOwedFromBackend() {
  const list = document.getElementById("iou-list");
  const pendingTotal = document.getElementById("iou-total-pending");
  const peopleCount = document.getElementById("iou-people-count");

  if (!list) return;

  const token = sessionStorage.getItem("afa_access_token");
  if (!token) {
    list.textContent = "Please log in to view your receivables.";
    return;
  }

  list.textContent = "Loading your receivables...";

  try {
    const response = await apiRequest("/ious");
    const ious = Array.isArray(response) ? response : [];

    const pending = ious.filter(
      item => String(item.status).toLowerCase() === "pending"
    );

    const total = pending.reduce(
      (sum, item) => sum + Number(item.amount || 0), 0
    );

    if (pendingTotal) {
      pendingTotal.textContent = total.toLocaleString("en-IN", {
        style: "currency",
        currency: "INR"
      });
    }

    if (peopleCount) {
      peopleCount.textContent = new Set(
        pending.map(item => String(item.person_name || "").trim().toLowerCase())
      ).size;
    }

    list.replaceChildren();

    if (ious.length === 0) {
      list.textContent = "No receivables yet. Add an expense where someone owes you money through AI Advisor.";
      return;
    }

    for (const item of ious) {
      const isReceived = String(item.status).toLowerCase() === "received";
      const card = document.createElement("div");
      card.className = "border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3";

      const details = document.createElement("div");
      const name = document.createElement("p");
      name.className = "font-semibold text-slate-800";
      name.textContent = item.person_name || "Unknown person";

      const amount = document.createElement("p");
      amount.className = "text-xl font-bold mt-1";
      amount.textContent = Number(item.amount || 0).toLocaleString("en-IN", {
        style: "currency",
        currency: "INR"
      });

      const info = document.createElement("p");
      info.className = "text-sm text-slate-500 mt-1";
      info.textContent = "Expense ID: " + item.transaction_id;

      details.append(name, amount, info);

      const actions = document.createElement("div");
      actions.className = "flex items-center gap-3";

      const status = document.createElement("span");
      status.className = isReceived
        ? "text-sm font-semibold text-green-700"
        : "text-sm font-semibold text-amber-700";
      status.textContent = isReceived ? "Received" : "Pending";
      actions.appendChild(status);

      if (!isReceived) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "px-3 py-2 rounded-lg bg-green-600 text-white text-sm hover:bg-green-700";
        button.textContent = "Mark as Received";
        button.addEventListener("click", async () => {
          button.disabled = true;
          button.textContent = "Updating...";

          try {
            await apiRequest("/ious/" + item.id + "/received", {
              method: "PATCH"
            });
            if (typeof showToast === "function") {
              showToast("Payment marked as received!");
            }
            await loadMoneyOwedFromBackend();
          } catch (error) {
            button.disabled = false;
            button.textContent = "Mark as Received";
            alert(error.message || "Could not update payment status.");
          }
        });
        actions.appendChild(button);
      }

      card.append(details, actions);
      list.appendChild(card);
    }
  } catch (error) {
    list.textContent = "Could not load receivables: " + (error.message || "Please try again.");
  }
}


function checkScamMessage() {
  const input = document.getElementById("scam-message");
  const result = document.getElementById("scam-result");

  if (!input || !result) return;

  const message = input.value.trim();

  if (!message) {
    alert("Please paste a message or link to analyze.");
    return;
  }

  let score = 0;
  const indicators = [];
  const lower = message.toLowerCase();

  function detect(pattern, points, explanation) {
    if (pattern.test(message)) {
      score += points;
      indicators.push(explanation);
    }
  }

  detect(
    /\b(otp|one[- ]time password|upi pin|atm pin|cvv|password)\b/i,
    30,
    "The message mentions sensitive credentials or authentication details."
  );

  detect(
    /\b(share|send|tell|reveal|confirm|verify)\b.{0,45}\b(otp|pin|cvv|password)\b/i,
    35,
    "It appears to request sensitive credentials."
  );

  detect(
    /\b(account.{0,20}(blocked|suspended|frozen)|kyc.{0,20}(expired|update|required)|account.{0,20}will be closed)\b/i,
    20,
    "It uses an account-blocking or KYC urgency claim."
  );

  detect(
    /\b(urgent|immediately|act now|last warning|within \d+ minutes|expires today)\b/i,
    15,
    "It uses pressure or urgency to encourage a quick decision."
  );

  detect(
    /\b(prize|lottery|you have won|claim your reward|free gift|cashback approved)\b/i,
    15,
    "It makes a prize or reward claim that should be independently verified."
  );

  detect(
    /\b(send money|pay processing fee|security deposit|advance payment|refund fee)\b/i,
    25,
    "It mentions a payment or fee that could be used in a scam."
  );

  detect(
    /\b(remote access|install this app|screen sharing|anydesk|teamviewer)\b/i,
    25,
    "It mentions remote access or screen-sharing software."
  );

  const urls = message.match(/https?:\/\/[^\s<>"']+/gi) || [];

  if (urls.length) {
    for (const rawUrl of urls) {
      try {
        const url = new URL(rawUrl.replace(/[),.!?]+$/, ""));
        const host = url.hostname.toLowerCase();

        if (url.protocol !== "https:") {
          score += 10;
          indicators.push("A link does not use HTTPS.");
        }

        if (url.username || url.password) {
          score += 25;
          indicators.push("A link contains unusual login information.");
        }

        if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
          score += 20;
          indicators.push("A link uses an IP address instead of a normal domain.");
        }

        if (host.startsWith("xn--") || host.split(".").some(part => part.startsWith("xn--"))) {
          score += 20;
          indicators.push("A link contains an internationalized domain that deserves extra scrutiny.");
        }

        if (/(bit\.ly|tinyurl\.com|t\.co|cutt\.ly|rb\.gy)$/i.test(host)) {
          score += 15;
          indicators.push("A shortened link hides its final destination.");
        }

        if (/(paypa1|g00gle|amaz0n|faceb00k|app1e)/i.test(host)) {
          score += 25;
          indicators.push("The domain contains a possible brand impersonation pattern.");
        }
      } catch {
        score += 10;
        indicators.push("A URL could not be parsed normally.");
      }
    }
  }

  score = Math.min(score, 100);

  let risk;
  let badgeClass;
  let summary;

  if (score >= 60) {
    risk = "HIGH RISK";
    badgeClass = "bg-red-100 text-red-800";
    summary = "Multiple warning signs were detected. Do not click links, share credentials or send money until you verify independently.";
  } else if (score >= 30) {
    risk = "MEDIUM RISK";
    badgeClass = "bg-amber-100 text-amber-800";
    summary = "Some warning signs were detected. Verify the sender through an official channel before taking action.";
  } else {
    risk = "LOWER DETECTED RISK";
    badgeClass = "bg-green-100 text-green-800";
    summary = "Few warning signs were detected by these rules. This does not mean the message or link is safe.";
  }

  if (!indicators.length) {
    indicators.push("No known warning patterns were detected by this basic checker.");
  }

  const advice = [
    "Never share your OTP, UPI PIN, CVV or password with anyone.",
    "Do not click suspicious links or install apps at a stranger's request.",
    "Contact your bank or service provider using its official app or website.",
    "If you already lost money in India, contact your bank immediately and report it through the official cybercrime helpline 1930 or cybercrime.gov.in."
  ];

  document.getElementById("scam-risk-badge").textContent = risk;
  document.getElementById("scam-risk-badge").className =
    "inline-block rounded-full px-4 py-2 font-bold mb-4 " + badgeClass;

  document.getElementById("scam-risk-score").textContent =
    "Indicator score: " + score + "/100";

  document.getElementById("scam-summary").textContent = summary;

  const indicatorList = document.getElementById("scam-indicators");
  indicatorList.replaceChildren();

  indicators.forEach(item => {
    const li = document.createElement("li");
    li.textContent = item;
    indicatorList.appendChild(li);
  });

  const adviceList = document.getElementById("scam-advice");
  adviceList.replaceChildren();

  advice.forEach(item => {
    const li = document.createElement("li");
    li.textContent = item;
    adviceList.appendChild(li);
  });

  result.classList.remove("hidden");
  result.scrollIntoView({ behavior: "smooth", block: "start" });
}

function clearScamChecker() {
  document.getElementById("scam-message").value = "";
  document.getElementById("scam-result").classList.add("hidden");
}



// ========== AUTOMATIC FRAUD ALERTS FRONTEND ==========
async function loadFraudRiskAlerts() {
  const container = document.getElementById("fraudRiskAlerts");
  if (!container) return;

  if (!sessionStorage.getItem("afa_access_token")) {
    container.innerHTML =
      '<p class="text-sm text-slate-500">Please log in to view fraud alerts.</p>';
    return;
  }

  container.innerHTML =
    '<p class="text-sm text-slate-500">Checking transactions for unusual patterns...</p>';

  try {
    const data = await apiRequest("/fraud-risk/transactions");
    const alerts = Array.isArray(data.alerts) ? data.alerts : [];

    if (alerts.length === 0) {
      container.innerHTML = `
        <div class="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p class="font-semibold text-emerald-800">No suspicious patterns detected</p>
          <p class="mt-1 text-sm text-emerald-700">
            Your recorded expenses did not trigger the current risk rules.
            This does not guarantee that every transaction is safe.
          </p>
        </div>`;
      return;
    }

    container.innerHTML = `
      <div class="mb-3 text-sm text-slate-600">
        ${alerts.length} transaction(s) need review.
      </div>
      <div class="space-y-3">
        ${alerts.map(alert => {
          const level = String(alert.risk_level || "medium").toLowerCase();
          const color = level === "high"
            ? "border-red-200 bg-red-50 text-red-800"
            : "border-amber-200 bg-amber-50 text-amber-800";

          const reasons = Array.isArray(alert.reasons)
            ? alert.reasons
            : [];

          return `
            <article class="rounded-xl border p-4 ${color}">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <h4 class="font-semibold">${escapeHtml(alert.title || "Expense")}</h4>
                <span class="rounded-full border px-3 py-1 text-xs font-bold uppercase">
                  ${escapeHtml(level)} risk
                </span>
              </div>
              <p class="mt-2 font-medium">
                Amount: ₹${Number(alert.amount || 0).toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })}
              </p>
              <p class="mt-1 text-sm">
                Risk score: ${Number(alert.risk_score || 0)}/100
              </p>
              <ul class="mt-2 list-disc space-y-1 pl-5 text-sm">
                ${reasons.map(reason =>
                  `<li>${escapeHtml(reason)}</li>`
                ).join("")}
              </ul>
              <p class="mt-2 text-sm">${escapeHtml(alert.message || "Please review this transaction.")}</p>
            </article>`;
        }).join("")}
      </div>`;
  } catch (error) {
    console.error("Could not load fraud alerts:", error);
    container.innerHTML = `
      <div class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Fraud alerts could not be loaded. Check that the backend is running and you are logged in.
      </div>`;
  }
}



let moneyWrappedStories = [];
let moneyWrappedIndex = 0;

async function loadMoneyWrapped() {
  const heading = document.getElementById("wrapped-heading");
  const description = document.getElementById("wrapped-description");
  const emoji = document.getElementById("wrapped-emoji");

  if (!heading || !description || !emoji) return;

  heading.textContent = "Your money story is loading...";
  description.textContent = "Gathering your recorded transactions.";
  emoji.textContent = "✨";

  try {
    const data = await apiRequest("/money-wrapped");

    const money = value =>
      new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2
      }).format(Number(value) || 0);

    const category = data.top_category;
    const biggest = data.biggest_expense;
    const income = Number(data.total_income) || 0;
    const expenses = Number(data.total_expenses) || 0;
    const balance = Number(data.net_balance) || 0;
    const weekend = Number(data.weekend_spending) || 0;
    const weekday = Number(data.weekday_spending) || 0;

    let spendingInsight;

    if (expenses === 0) {
      spendingInsight =
        "Record some expenses to start discovering your spending habits.";
    } else if (weekend > weekday) {
      spendingInsight =
        "Your recorded weekend spending is higher than your weekday spending.";
    } else if (weekday > weekend) {
      spendingInsight =
        "Your recorded weekday spending is higher than your weekend spending.";
    } else {
      spendingInsight =
        "Your recorded weekend and weekday spending are equal.";
    }
    
    moneyWrappedStories = [
  {
    emoji: "💸",
    heading: category
      ? `${category.name} tera sabse bada pyaar hai! 😍`
      : "Tera paisa abhi chhupa hua hai 🕵️",
    description: category
      ? `Is mahine tune ${category.name} pe ${money(category.amount)} udaye. Tere kul kharche ka ${category.percentage}% sirf isi pe gaya. Wallet ne bola: "Bhai, thoda mujhe bhi dekh le."`
      : "Kuch expenses add kar, phir dekh tera paisa kahan ghoomta hai."
  },
  {
    emoji: "🛍️",
    heading: biggest
      ? "Aaj ka sabse bada 'Jo hua so hua' moment! 🫢"
      : "Abhi koi bada kaand nahi hua 😇",
    description: biggest
      ? `${biggest.date ? `${biggest.date} ko ` : ""}tune ${biggest.title} pe ${money(biggest.amount)} kharch kiye. Us din tera dil aur wallet dono alag alag baat kar rahe the.`
      : "Jaise hi tu koi bada kharcha karega, uski kahani yahan aayegi."
  },
  {
    emoji: "🎉",
    heading: weekend > weekday
      ? "Tu Weekend ka Raja/Rani hai! 👑"
      : weekday > weekend
        ? "Tu Weekday Warrior hai! 💼"
        : "Tera kharcha ekdum balanced hai ⚖️",
    description: weekend > weekday
      ? `Weekend pe ${money(weekend)} aur baaki din ${money(weekday)}. Lagta hai Monday ko tu saving karta hai, aur Saturday ko sab bhool jaata hai.`
      : weekday > weekend
        ? `Weekday pe ${money(weekday)} aur weekend pe sirf ${money(weekend)}. Office ki chai aur canteen ne tera budget khaa liya. ☕`
        : `Weekday aur weekend dono pe lagbhag ${money(weekday)}. Itna balance to yoga teacher ke paas bhi nahi hota.`
  },
  {
    emoji: "💰",
    heading: balance >= 0 ? "Wallet abhi muskura raha hai 😄" : "Wallet thoda ro raha hai 🥲",
    description: balance >= 0
      ? `Kamaye ${money(income)}, udaye ${money(expenses)}, aur bache ${money(balance)}. Isi tarah chalta reh, future tu bhi thank you bolega.`
      : `Kamaye ${money(income)}, udaye ${money(expenses)}, aur ${money(Math.abs(balance))} zyada nikal gaye. Koi baat nahi, agle mahine comeback story likhte hain. 💪`
  },
  {
    emoji: "📊",
    heading: "Teri paise wali kahani 🎬",
    description: spendingInsight
  },
  {
    emoji: "✨",
    heading: data.personality?.title || "Tera Money Personality abhi load ho raha hai ⏳",
    description:
      data.personality?.description ||
      "Thode aur transactions add kar, aur hum bataenge tu paise ke saath kaisa hai."
  }
];

    moneyWrappedIndex = 0;
    renderMoneyWrappedStory();
    setupWrappedSwipe();
  } catch (error) {
    heading.textContent = "Your story couldn't load";
    description.textContent =
      error.message || "Please try again in a moment.";
    emoji.textContent = "💜";
  }
}

function renderMoneyWrappedStory() {
  if (!moneyWrappedStories.length) return;

  const story = moneyWrappedStories[moneyWrappedIndex];
  const heading = document.getElementById("wrapped-heading");
  const description = document.getElementById("wrapped-description");
  const emoji = document.getElementById("wrapped-emoji");
  const count = document.getElementById("wrapped-count");
  const pageNumber = document.getElementById("wrapped-page-number");
  const previous = document.getElementById("wrapped-prev");
  const next = document.getElementById("wrapped-next");
  const progress = document.getElementById("wrapped-progress");

  heading.textContent = story.heading;
  description.textContent = story.description;
  emoji.textContent = story.emoji;
  count.textContent =
    `YOUR STORY · ${moneyWrappedIndex + 1} OF ${moneyWrappedStories.length}`;
  pageNumber.textContent =
    `${moneyWrappedIndex + 1} / ${moneyWrappedStories.length}`;

  previous.disabled = moneyWrappedIndex === 0;
  next.innerHTML = moneyWrappedIndex === moneyWrappedStories.length - 1
    ? 'Finish <i class="fas fa-check ml-2"></i>'
    : 'Next <i class="fas fa-arrow-right ml-2"></i>';

  Array.from(progress.children).forEach((bar, index) => {
    bar.className =
      "h-1.5 flex-1 rounded-full " +
      (index <= moneyWrappedIndex ? "bg-purple-500" : "bg-purple-100");
  });
}

function changeWrappedStory(direction) {
  if (!moneyWrappedStories.length) return;

  const nextIndex = moneyWrappedIndex + direction;

  if (nextIndex < 0) return;

  if (nextIndex >= moneyWrappedStories.length) {
    showPage("dashboard");
    return;
  }

  moneyWrappedIndex = nextIndex;
  renderMoneyWrappedStory();
}

function setupWrappedSwipe() {
  const story = document.getElementById("wrapped-story");
  if (!story || story.dataset.swipeBound === "true") return;

  story.dataset.swipeBound = "true";
  let startX = 0;

  story.addEventListener("touchstart", event => {
    startX = event.changedTouches[0].screenX;
  }, { passive: true });

  story.addEventListener("touchend", event => {
    const endX = event.changedTouches[0].screenX;
    const difference = endX - startX;

    if (Math.abs(difference) > 50) {
      changeWrappedStory(difference < 0 ? 1 : -1);
    }
  }, { passive: true });
}




async function loadMoneyWeather() {
  const token = sessionStorage.getItem("afa_access_token");
  if (!token) return;

  const message = document.getElementById("money-weather-message");
  if (!message) return;

  try {
    const response = await fetch(`${API_BASE_URL}/money-weather`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error("Could not load Money Weather");
    }

    const data = await response.json();
    console.log("Money Weather API status:", response.status);
    console.log("Money Weather API data:", data);
    renderMoneyWeather(data);
  } catch (error) {
    console.error("Money Weather error:", error);
    message.textContent =
      "Your financial forecast is temporarily unavailable. Please try again.";
  }
}


function renderMoneyWeather(data) {
  const icon = document.getElementById("money-weather-icon");
  const message = document.getElementById("money-weather-message");
  const bills = document.getElementById("money-weather-bills");
  const balance = document.getElementById("money-weather-balance");
  const tip = document.getElementById("money-weather-tip");

  if (!icon || !message || !bills || !balance || !tip) {
    console.error("Money Weather: one or more HTML elements are missing.");
    return;
  }

  const formatMoney = value =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(Number(value) || 0);

  const forecasts = {
    sunny: {
      icon: "☀️",
      message: "Your upcoming bills look manageable.",
      tip: "Keep a little buffer for unexpected expenses."
    },
    cloudy: {
      icon: "🌤️",
      message: "Your available money may get tight soon.",
      tip: "Review non-essential spending this week."
    },
    rainy: {
      icon: "🌧️",
      message: "Upcoming payments may leave you with a low balance.",
      tip: "Prioritise essential bills and pause avoidable purchases."
    },
    stormy: {
      icon: "⛈️",
      message: "Your projected balance may not cover upcoming bills.",
      tip: "Review due dates and available funds before new purchases."
    }
  };

  const status = String(data.status || "cloudy").toLowerCase();
  const forecast = forecasts[status] || forecasts.cloudy;
  const titleIcon = document.getElementById("money-weather-title-icon");
const titleStatus = document.getElementById("money-weather-title-status");

if (titleIcon) titleIcon.textContent = forecast.icon;
if (titleStatus) {
  titleStatus.textContent =
    status.charAt(0).toUpperCase() + status.slice(1);
}

  icon.textContent = forecast.icon;
  message.textContent = data.message || forecast.message;
  bills.textContent = formatMoney(data.upcoming_bills_total);
  balance.textContent = formatMoney(data.projected_balance);
  tip.textContent = data.tip || forecast.tip;
}
