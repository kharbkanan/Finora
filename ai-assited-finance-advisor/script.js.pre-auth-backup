// ========== STORAGE (empty by default — user adds everything) ==========
function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}
function save(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

let transactions = load('afa_tx', []);   // EMPTY
let budgets = load('afa_budgets', []);   // EMPTY
let goals = load('afa_goals', []);       // EMPTY

const CAT_COLORS = {
  Food: '#f97316', Transport: '#3b82f6', Shopping: '#a855f7', Bills: '#ef4444',
  Entertainment: '#ec4899', Health: '#10b981', Education: '#6366f1',
  Salary: '#10b981', Freelance: '#14b8a6', Other: '#64748b'
};

// ========== HELPERS ==========
function rupee(n) {
  return '₹' + Number(n).toLocaleString('en-IN');
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function today() {
  return new Date().toISOString().slice(0, 10);
}
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  el.classList.add('show');
  setTimeout(() => { el.classList.add('hidden'); el.classList.remove('show'); }, 2500);
}
function getIncome() {
  return transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
}
function getExpense() {
  return transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
}
function getCategorySpend() {
  const map = {};
  transactions.filter(t => t.type === 'expense').forEach(t => {
    map[t.category] = (map[t.category] || 0) + t.amount;
  });
  return map;
}
function spentInCategory(cat) {
  return transactions
    .filter(t => t.type === 'expense' && t.category === cat)
    .reduce((s, t) => s + t.amount, 0);
}

// ========== NAV ==========
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  const btn = document.querySelector('[data-page="' + name + '"]');
  if (btn) btn.classList.add('active');

  const titles = { dashboard: 'Dashboard', chat: 'AI Advisor', expenses: 'Expenses', budget: 'Budget & Goals', reports: 'Reports' };
  document.getElementById('pageTitle').textContent = titles[name] || 'Dashboard';
  closeSidebar();

  if (name === 'dashboard') updateDashboard();
  if (name === 'expenses') { renderExpenses(); setDefaultDate(); }
  if (name === 'budget') renderBudget();
  if (name === 'reports') updateReports();
  if (name === 'chat') initChat();
}
function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('overlay').classList.remove('hidden');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('overlay').classList.add('hidden');
}
function setDefaultDate() {
  const el = document.getElementById('expDate');
  if (el && !el.value) el.value = today();
}

// ========== DASHBOARD ==========
let spendChartObj = null, pieChartObj = null;

function updateDashboard() {
  const income = getIncome();
  const expense = getExpense();
  const balance = income - expense;
  const rate = income > 0 ? ((balance / income) * 100).toFixed(1) : 0;

  document.getElementById('card-balance').textContent = rupee(balance);
  document.getElementById('card-income').textContent = rupee(income);
  document.getElementById('card-expense').textContent = rupee(expense);
  document.getElementById('card-savings').textContent = rate + '%';

  const qbar = document.getElementById('quickAddBar');
  if (qbar) qbar.style.display = transactions.length ? 'none' : 'flex';

  document.getElementById('card-balance-sub').textContent = transactions.length ? (balance >= 0 ? 'Positive balance' : 'Negative balance') : 'Add income & expenses';
  document.getElementById('card-income-sub').textContent = income ? transactions.filter(t => t.type === 'income').length + ' income entries' : 'No income yet';
  document.getElementById('card-expense-sub').textContent = expense ? transactions.filter(t => t.type === 'expense').length + ' expense entries' : 'No expenses yet';
  document.getElementById('card-savings-sub').textContent = income ? (rate >= 20 ? 'Healthy savings' : rate >= 0 ? 'Can improve' : 'Spending more than income') : 'Add data to calculate';

  // AI insight from real data
  const insight = document.getElementById('aiInsight');
  if (!transactions.length) {
    insight.textContent = 'Add some income and expenses, then come back — I will give personalised tips based on your real data.';
  } else {
    const catSpend = getCategorySpend();
    const top = Object.keys(catSpend).sort((a, b) => catSpend[b] - catSpend[a])[0];
    if (top) {
      insight.innerHTML = 'Your top expense is <b class="text-white">' + top + '</b> at <b class="text-white">' + rupee(catSpend[top]) + '</b>. Savings rate is <b class="text-amber-400">' + rate + '%</b>. ' +
        (rate < 20 ? 'Try cutting ' + top + ' a bit to boost savings.' : 'You are doing well — keep it up!');
    } else {
      insight.textContent = 'You have income but no expenses recorded yet. Add expenses to get better insights.';
    }
  }

  // Recent
  const recent = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
  const recentEl = document.getElementById('recentList');
  if (!recent.length) {
    recentEl.innerHTML = `<div class="empty-state">
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
        <div class="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white" style="background:${CAT_COLORS[t.category] || '#64748b'}">${t.category[0]}</div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium truncate">${t.title}</p>
          <p class="text-xs text-slate-400">${fmtDate(t.date)} • ${t.category}</p>
        </div>
        <p class="text-sm font-semibold ${t.type === 'income' ? 'text-emerald-600' : ''}">${t.type === 'income' ? '+' : '-'}${rupee(t.amount)}</p>
      </div>
    `).join('');
  }

  initDashboardCharts();
}

function initDashboardCharts() {
  const catSpend = getCategorySpend();
  const labels = Object.keys(catSpend);
  const values = Object.values(catSpend);
  const hasExpense = values.length > 0;
  const hasAny = transactions.length > 0;

  document.getElementById('spendEmpty').style.display = hasAny ? 'none' : 'flex';
  document.getElementById('pieEmpty').style.display = hasExpense ? 'none' : 'flex';

  // Monthly income/expense for last 6 months from user data
  const months = {};
  transactions.forEach(t => {
    const key = t.date ? t.date.slice(0, 7) : 'unknown';
    if (!months[key]) months[key] = { income: 0, expense: 0 };
    if (t.type === 'income') months[key].income += t.amount;
    else months[key].expense += t.amount;
  });
  const sortedKeys = Object.keys(months).sort();
  const lineLabels = sortedKeys.map(k => {
    const [y, m] = k.split('-');
    return new Date(y, m - 1).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
  });
  const lineIncome = sortedKeys.map(k => months[k].income);
  const lineExpense = sortedKeys.map(k => months[k].expense);

  const ctx1 = document.getElementById('spendChart');
  if (spendChartObj) spendChartObj.destroy();
  if (hasAny && ctx1) {
    spendChartObj = new Chart(ctx1, {
      type: 'line',
      data: {
        labels: lineLabels.length ? lineLabels : ['No data'],
        datasets: [
          { label: 'Expenses', data: lineExpense.length ? lineExpense : [0], borderColor: '#0ea5e9', backgroundColor: 'rgba(14,165,233,0.1)', fill: true, tension: 0.4 },
          { label: 'Income', data: lineIncome.length ? lineIncome : [0], borderColor: '#10b981', tension: 0.4 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'top' } },
        scales: { y: { beginAtZero: true, ticks: { callback: v => '₹' + (v >= 1000 ? (v / 1000) + 'k' : v) } } }
      }
    });
  }

  const ctx2 = document.getElementById('pieChart');
  if (pieChartObj) pieChartObj.destroy();
  if (hasExpense && ctx2) {
    pieChartObj = new Chart(ctx2, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: labels.map(l => CAT_COLORS[l] || '#64748b'),
          borderWidth: 0
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } } } },
        cutout: '65%'
      }
    });
  }
}

// ========== EXPENSES ==========
function renderExpenses() {
  const filterCat = document.getElementById('filterCat')?.value || 'all';
  const filterType = document.getElementById('filterType')?.value || 'all';
  const search = (document.getElementById('searchTx')?.value || '').toLowerCase().trim();
  const sort = document.getElementById('sortTx')?.value || 'date-desc';

  let list = [...transactions];
  if (filterCat !== 'all') list = list.filter(t => t.category === filterCat);
  if (filterType !== 'all') list = list.filter(t => t.type === filterType);
  if (search) list = list.filter(t => t.title.toLowerCase().includes(search) || t.category.toLowerCase().includes(search));

  if (sort === 'date-desc') list.sort((a, b) => new Date(b.date) - new Date(a.date));
  else if (sort === 'date-asc') list.sort((a, b) => new Date(a.date) - new Date(b.date));
  else if (sort === 'amt-desc') list.sort((a, b) => b.amount - a.amount);
  else if (sort === 'amt-asc') list.sort((a, b) => a.amount - b.amount);

  const inc = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const exp = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const sumI = document.getElementById('sumIncome');
  const sumE = document.getElementById('sumExpense');
  const sumN = document.getElementById('sumNet');
  if (sumI) sumI.textContent = rupee(inc);
  if (sumE) sumE.textContent = rupee(exp);
  if (sumN) sumN.textContent = rupee(inc - exp);

  document.getElementById('txCount').textContent = '(' + transactions.length + ')';
  const tbody = document.getElementById('expTable');

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="6">
      <div class="empty-state">
        <div class="icon-wrap"><i class="fas fa-wallet"></i></div>
        <p class="text-slate-500 text-sm font-medium mb-1">No transactions</p>
        <p class="text-slate-400 text-xs">Upar wale form se pehli entry add karo</p>
      </div>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(t => `
    <tr class="hover:bg-slate-50 dark-row">
      <td class="px-5 py-3 font-medium">${escapeHtml(t.title)}</td>
      <td class="px-5 py-3"><span class="inline-block px-2 py-0.5 rounded-full text-xs text-white" style="background:${CAT_COLORS[t.category] || '#64748b'}">${t.category}</span></td>
      <td class="px-5 py-3 text-slate-500">${fmtDate(t.date)}</td>
      <td class="px-5 py-3"><span class="text-xs font-medium ${t.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}">${t.type === 'income' ? 'Income' : 'Expense'}</span></td>
      <td class="px-5 py-3 text-right font-semibold ${t.type === 'income' ? 'text-emerald-600' : ''}">${t.type === 'income' ? '+' : '-'}${rupee(t.amount)}</td>
      <td class="px-5 py-3 text-center whitespace-nowrap">
        <button onclick="editExpense(${t.id})" class="text-slate-400 hover:text-sky-500 p-1" title="Edit"><i class="fas fa-pen"></i></button>
        <button onclick="deleteExpense(${t.id})" class="text-slate-400 hover:text-red-500 p-1" title="Delete"><i class="fas fa-trash-alt"></i></button>
      </td>
    </tr>
  `).join('');
}

function addExpense(e) {
  e.preventDefault();
  const title = document.getElementById('expTitle').value.trim();
  const amount = parseInt(document.getElementById('expAmount').value, 10);
  const category = document.getElementById('expCategory').value;
  const type = document.getElementById('expType').value;
  const date = document.getElementById('expDate').value || today();
  const editId = document.getElementById('editId')?.value;

  if (!title || !amount || amount < 1) {
    toast('Please fill title and valid amount');
    return;
  }

  if (editId) {
    const i = transactions.findIndex(t => t.id === Number(editId));
    if (i >= 0) {
      transactions[i] = { ...transactions[i], title, amount, category, type, date };
      toast('Transaction updated');
    }
    document.getElementById('editId').value = '';
    const btnText = document.getElementById('saveBtnText');
    if (btnText) btnText.textContent = 'Save';
  } else {
    transactions.unshift({ id: Date.now(), title, amount, category, type, date });
    toast('Transaction added');
  }
  save('afa_tx', transactions);
  e.target.reset();
  setDefaultDate();
  renderExpenses();
}

function editExpense(id) {
  const t = transactions.find(x => x.id === id);
  if (!t) return;
  document.getElementById('editId').value = t.id;
  document.getElementById('expTitle').value = t.title;
  document.getElementById('expAmount').value = t.amount;
  document.getElementById('expCategory').value = t.category;
  document.getElementById('expType').value = t.type;
  document.getElementById('expDate').value = t.date;
  const btnText = document.getElementById('saveBtnText');
  if (btnText) btnText.textContent = 'Update';
  document.getElementById('expTitle').scrollIntoView({ behavior: 'smooth', block: 'center' });
  document.getElementById('expTitle').focus();
  toast('Editing — change & click Update');
}

function exportCSV() {
  if (!transactions.length) { toast('No data to export'); return; }
  const rows = [['Title', 'Amount', 'Category', 'Type', 'Date']];
  transactions.forEach(t => rows.push([t.title, t.amount, t.category, t.type, t.date]));
  const csv = rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'finance-transactions.csv';
  a.click();
  toast('CSV downloaded');
}

function toggleDark() {
  document.body.classList.toggle('dark-mode');
  const on = document.body.classList.contains('dark-mode');
  localStorage.setItem('afa_dark', on ? '1' : '0');
  const btn = document.getElementById('darkBtn');
  if (btn) btn.innerHTML = on ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
}

function deleteExpense(id) {
  if (!confirm('Delete this transaction?')) return;
  transactions = transactions.filter(t => t.id !== id);
  save('afa_tx', transactions);
  renderExpenses();
  toast('Deleted');
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// ========== BUDGET ==========
function renderBudget() {
  const listEl = document.getElementById('budgetList');
  if (!budgets.length) {
    listEl.innerHTML = `<div class="empty-state py-6">
      <div class="icon-wrap"><i class="fas fa-bullseye"></i></div>
      <p class="text-slate-500 text-sm font-medium">No budgets yet</p>
      <p class="text-slate-400 text-xs mt-1">Upar se category limit set karo</p>
    </div>`;
  } else {
    listEl.innerHTML = budgets.map((b, i) => {
      const spent = spentInCategory(b.category);
      const pct = Math.min(100, Math.round((spent / b.limit) * 100));
      const over = pct >= 90;
      return `
        <div>
          <div class="flex justify-between mb-1 items-center">
            <span class="text-sm font-medium">${b.category}</span>
            <div class="flex items-center gap-2">
              <span class="text-xs text-slate-500">${rupee(spent)} / ${rupee(b.limit)}</span>
              <button onclick="deleteBudget(${i})" class="text-slate-400 hover:text-red-500 text-xs"><i class="fas fa-trash-alt"></i></button>
            </div>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width:${pct}%;background:${over ? '#ef4444' : (CAT_COLORS[b.category] || '#0ea5e9')}"></div>
          </div>
          <p class="text-xs mt-1 ${over ? 'text-red-500' : 'text-slate-400'}">${pct}% used ${over ? '— Near / over limit' : ''}</p>
        </div>
      `;
    }).join('');
  }

  const goalsEl = document.getElementById('goalsList');
  if (!goals.length) {
    goalsEl.innerHTML = `<div class="empty-state py-4">
      <div class="icon-wrap"><i class="fas fa-flag"></i></div>
      <p class="text-slate-500 text-sm font-medium">No goals yet</p>
    </div>`;
  } else {
    goalsEl.innerHTML = goals.map((g, i) => {
      const pct = Math.min(100, Math.round((g.current / g.target) * 100));
      return `
        <div class="p-4 rounded-xl bg-slate-50 border">
          <div class="flex justify-between mb-2 items-start">
            <div>
              <p class="font-medium text-sm">${escapeHtml(g.name)}</p>
              <p class="text-xs text-slate-400">${rupee(g.current)} of ${rupee(g.target)}</p>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-sm font-semibold text-sky-600">${pct}%</span>
              <button onclick="updateGoalProgress(${i})" class="text-slate-400 hover:text-sky-500 text-xs" title="Update saved"><i class="fas fa-plus-circle"></i></button>
              <button onclick="deleteGoal(${i})" class="text-slate-400 hover:text-red-500 text-xs"><i class="fas fa-trash-alt"></i></button>
            </div>
          </div>
          <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:#0ea5e9"></div></div>
        </div>
      `;
    }).join('');
  }

  // AI tip
  const tip = document.getElementById('budgetAITip');
  const income = getIncome();
  const expense = getExpense();
  if (!transactions.length && !budgets.length) {
    tip.textContent = 'Set budgets and goals, add transactions — then I will give recommendations based on your numbers.';
  } else if (budgets.length) {
    const over = budgets.filter(b => spentInCategory(b.category) >= b.limit * 0.9);
    if (over.length) {
      tip.textContent = 'Watch out: ' + over.map(b => b.category).join(', ') + ' ' + (over.length > 1 ? 'are' : 'is') + ' near or over budget. Review those categories.';
    } else {
      tip.textContent = 'Your budgets look under control. Income: ' + rupee(income) + ', Expenses: ' + rupee(expense) + '. Keep tracking regularly.';
    }
  } else {
    tip.textContent = 'You have transactions but no budgets. Set category limits so I can warn you when you overspend.';
  }
}

function addBudget(e) {
  e.preventDefault();
  const category = document.getElementById('budCategory').value;
  const limit = parseInt(document.getElementById('budLimit').value, 10);
  if (!limit || limit < 1) return;

  const existing = budgets.findIndex(b => b.category === category);
  if (existing >= 0) {
    budgets[existing].limit = limit;
    toast('Budget updated for ' + category);
  } else {
    budgets.push({ category, limit });
    toast('Budget added');
  }
  save('afa_budgets', budgets);
  e.target.reset();
  renderBudget();
}

function deleteBudget(i) {
  if (!confirm('Remove this budget?')) return;
  budgets.splice(i, 1);
  save('afa_budgets', budgets);
  renderBudget();
  toast('Budget removed');
}

function addGoal(e) {
  e.preventDefault();
  const name = document.getElementById('goalName').value.trim();
  const target = parseInt(document.getElementById('goalTarget').value, 10);
  const current = parseInt(document.getElementById('goalCurrent').value, 10) || 0;
  if (!name || !target) return;

  goals.push({ id: Date.now(), name, target, current });
  save('afa_goals', goals);
  e.target.reset();
  document.getElementById('goalCurrent').value = 0;
  renderBudget();
  toast('Goal added');
}

function deleteGoal(i) {
  if (!confirm('Remove this goal?')) return;
  goals.splice(i, 1);
  save('afa_goals', goals);
  renderBudget();
  toast('Goal removed');
}

// ========== REPORTS ==========
let barChartObj = null, reportPieObj = null;

function updateReports() {
  const income = getIncome();
  const expense = getExpense();
  const catSpend = getCategorySpend();
  const top = Object.keys(catSpend).sort((a, b) => catSpend[b] - catSpend[a])[0];

  document.getElementById('rep-count').textContent = transactions.length;
  document.getElementById('rep-top').textContent = top || '—';
  document.getElementById('rep-balance').textContent = rupee(income - expense);

  const hasAny = transactions.length > 0;
  const hasExpense = Object.keys(catSpend).length > 0;
  document.getElementById('barEmpty').style.display = hasAny ? 'none' : 'flex';
  document.getElementById('reportPieEmpty').style.display = hasExpense ? 'none' : 'flex';

  // Group by month
  const months = {};
  transactions.forEach(t => {
    const key = t.date ? t.date.slice(0, 7) : 'unknown';
    if (!months[key]) months[key] = { income: 0, expense: 0 };
    if (t.type === 'income') months[key].income += t.amount;
    else months[key].expense += t.amount;
  });
  const keys = Object.keys(months).sort();
  const labels = keys.map(k => {
    const [y, m] = k.split('-');
    return new Date(y, m - 1).toLocaleDateString('en-IN', { month: 'short' });
  });

  const ctx1 = document.getElementById('barChart');
  if (barChartObj) barChartObj.destroy();
  if (hasAny && ctx1) {
    barChartObj = new Chart(ctx1, {
      type: 'bar',
      data: {
        labels: labels.length ? labels : ['—'],
        datasets: [
          { label: 'Income', data: keys.map(k => months[k].income), backgroundColor: '#10b981', borderRadius: 6 },
          { label: 'Expenses', data: keys.map(k => months[k].expense), backgroundColor: '#f43f5e', borderRadius: 6 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: { y: { beginAtZero: true, ticks: { callback: v => '₹' + (v >= 1000 ? (v / 1000) + 'k' : v) } } }
      }
    });
  }

  const ctx2 = document.getElementById('reportPie');
  if (reportPieObj) reportPieObj.destroy();
  if (hasExpense && ctx2) {
    const labels2 = Object.keys(catSpend);
    reportPieObj = new Chart(ctx2, {
      type: 'doughnut',
      data: {
        labels: labels2,
        datasets: [{ data: Object.values(catSpend), backgroundColor: labels2.map(l => CAT_COLORS[l] || '#64748b'), borderWidth: 0 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } } } },
        cutout: '60%'
      }
    });
  }
}

// ========== AI CHAT (uses YOUR real data) ==========
function buildAIReply(userText) {
  const t = userText.toLowerCase();
  const income = getIncome();
  const expense = getExpense();
  const balance = income - expense;
  const rate = income > 0 ? ((balance / income) * 100).toFixed(1) : 0;
  const catSpend = getCategorySpend();
  const topCat = Object.keys(catSpend).sort((a, b) => catSpend[b] - catSpend[a])[0];
  const topAmt = topCat ? catSpend[topCat] : 0;

  if (!transactions.length) {
    return 'You have not added any transactions yet.\n\nGo to Expenses → add your salary (Income) and some expenses. Then ask me again — I will analyse YOUR numbers.';
  }

  if (t.includes('save') || t.includes('saving') || t.includes('bachat')) {
    let tips = 'Based on your data:\n\n';
    tips += '• Income: ' + rupee(income) + '\n• Expenses: ' + rupee(expense) + '\n• Balance: ' + rupee(balance) + '\n• Savings rate: ' + rate + '%\n\n';
    if (topCat) tips += '1. Your biggest spend is ' + topCat + ' (' + rupee(topAmt) + '). Try cutting 10–15% there.\n';
    tips += '2. Aim for at least 20% savings rate' + (rate >= 20 ? ' — you are already there!' : ' — currently ' + rate + '%.') + '\n';
    tips += '3. Set category budgets on the Budget page so you get alerts before overspending.';
    return tips;
  }

  if (t.includes('analyze') || t.includes('spending') || t.includes('expense') || t.includes('analysis')) {
    let msg = 'Your spending analysis:\n\n';
    msg += '• Total Income: ' + rupee(income) + '\n';
    msg += '• Total Expenses: ' + rupee(expense) + '\n';
    msg += '• Net Balance: ' + rupee(balance) + '\n';
    msg += '• Savings Rate: ' + rate + '%\n';
    msg += '• Transactions: ' + transactions.length + '\n\n';
    if (topCat) {
      msg += 'Top category: ' + topCat + ' — ' + rupee(topAmt);
      if (expense > 0) msg += ' (' + Math.round((topAmt / expense) * 100) + '% of expenses)';
      msg += '\n\n';
    }
    const sorted = Object.entries(catSpend).sort((a, b) => b[1] - a[1]);
    if (sorted.length) {
      msg += 'Breakdown:\n';
      sorted.forEach(([c, a]) => { msg += '  • ' + c + ': ' + rupee(a) + '\n'; });
    }
    return msg;
  }

  if (t.includes('budget')) {
    if (income <= 0) return 'Add your income first (Expenses → Type: Income), then I can suggest a 50/30/20 budget.';
    const needs = Math.round(income * 0.5);
    const wants = Math.round(income * 0.3);
    const sav = Math.round(income * 0.2);
    return 'Suggested 50/30/20 budget for your income of ' + rupee(income) + ':\n\n' +
      '• Needs (Food, Bills, Transport): ' + rupee(needs) + ' (50%)\n' +
      '• Wants (Shopping, Entertainment): ' + rupee(wants) + ' (30%)\n' +
      '• Savings & Goals: ' + rupee(sav) + ' (20%)\n\n' +
      'Your current expenses: ' + rupee(expense) + '. ' +
      (expense <= needs + wants ? 'You are within the suggested limits.' : 'You are above suggested needs+wants — review discretionary spends.');
  }

  if (t.includes('goal') || t.includes('target')) {
    if (!goals.length) return 'You have no savings goals yet. Go to Budget & Goals and add one (e.g. Emergency Fund, Vacation).';
    let msg = 'Your goals:\n\n';
    goals.forEach(g => {
      const pct = Math.min(100, Math.round((g.current / g.target) * 100));
      msg += '• ' + g.name + ': ' + rupee(g.current) + ' / ' + rupee(g.target) + ' (' + pct + '%)\n';
    });
    msg += '\nKeep adding monthly savings toward these targets.';
    return msg;
  }

  if (t.includes('hello') || t.includes('hi') || t.includes('hey')) {
    return 'Hi! I am your AI Finance Advisor.\n\nI use the transactions YOU added.\n\nTry: "Analyze my spending" | "How can I save more?" | "Suggest a budget"';
  }

  return 'I can help with:\n\n• "Analyze my spending" — breakdown of your data\n• "How can I save more?" — tips from your numbers\n• "Suggest a budget" — 50/30/20 plan\n• "Show my goals" — goal progress\n\nYour current balance: ' + rupee(balance) + ' | Savings rate: ' + rate + '%';
}

function initChat() {
  const box = document.getElementById('chatBox');
  if (box.dataset.ready) return;
  box.dataset.ready = '1';
  box.innerHTML = `
    <div class="flex gap-3">
      <div class="w-8 h-8 rounded-lg bg-sky-500 flex items-center justify-center text-white text-xs flex-shrink-0"><i class="fas fa-robot"></i></div>
      <div class="bg-white rounded-2xl rounded-tl-md px-4 py-3 shadow-sm border max-w-[85%] text-sm">
        Hi! I analyse only the data you add.<br><br>
        First add Income & Expenses, then ask me anything.
        <div class="flex flex-wrap gap-2 mt-3">
          <button onclick="quickChat('Analyze my spending')" class="text-xs bg-sky-50 text-sky-700 px-3 py-1.5 rounded-full hover:bg-sky-100">Analyze my spending</button>
          <button onclick="quickChat('How can I save more?')" class="text-xs bg-sky-50 text-sky-700 px-3 py-1.5 rounded-full hover:bg-sky-100">How can I save more?</button>
          <button onclick="quickChat('Suggest a budget')" class="text-xs bg-sky-50 text-sky-700 px-3 py-1.5 rounded-full hover:bg-sky-100">Suggest a budget</button>
        </div>
      </div>
    </div>
  `;
}

function quickChat(text) {
  document.getElementById('chatInput').value = text;
  sendChat({ preventDefault: () => {} });
}

function sendChat(e) {
  e.preventDefault();
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';

  const box = document.getElementById('chatBox');
  box.innerHTML += `
    <div class="flex gap-3 justify-end">
      <div class="bg-sky-500 text-white rounded-2xl rounded-tr-md px-4 py-3 max-w-[80%] text-sm">${escapeHtml(text)}</div>
      <div class="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center text-xs font-bold flex-shrink-0">U</div>
    </div>
  `;
  box.scrollTop = box.scrollHeight;

  setTimeout(() => {
    const reply = buildAIReply(text);
    box.innerHTML += `
      <div class="flex gap-3">
        <div class="w-8 h-8 rounded-lg bg-sky-500 flex items-center justify-center text-white text-xs flex-shrink-0"><i class="fas fa-robot"></i></div>
        <div class="bg-white rounded-2xl rounded-tl-md px-4 py-3 shadow-sm border max-w-[85%] text-sm whitespace-pre-line">${escapeHtml(reply)}</div>
      </div>
    `;
    box.scrollTop = box.scrollHeight;
  }, 500);
}

function updateGoalProgress(i) {
  const g = goals[i];
  if (!g) return;
  const val = prompt('Current saved amount for "' + g.name + '" (₹):', g.current);
  if (val === null) return;
  const n = parseInt(val, 10);
  if (isNaN(n) || n < 0) { toast('Invalid amount'); return; }
  goals[i].current = n;
  save('afa_goals', goals);
  renderBudget();
  toast('Goal updated');
}

// ========== CLEAR ==========
function clearAllData() {
  if (!confirm('Delete ALL transactions, budgets and goals? This cannot be undone.')) return;
  transactions = [];
  budgets = [];
  goals = [];
  localStorage.removeItem('afa_tx');
  localStorage.removeItem('afa_budgets');
  localStorage.removeItem('afa_goals');
  toast('All data cleared');
  showPage('dashboard');
}

// ========== START ==========
document.addEventListener('DOMContentLoaded', () => {
  if (localStorage.getItem('afa_dark') === '1') {
    document.body.classList.add('dark-mode');
    const btn = document.getElementById('darkBtn');
    if (btn) btn.innerHTML = '<i class="fas fa-sun"></i>';
  }
  showPage('dashboard');
});
