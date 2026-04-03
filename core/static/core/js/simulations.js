/* ═══════════════════════════════════════════════════════════════════════════
   Simulations JS — Dual Investment Simulation
   Fetches paginated simulation list from /api/simulations/
   with sorting and pagination controls.
   ═══════════════════════════════════════════════════════════════════════════ */

const API = '/api/simulations/';
const PAGE_SIZE = 24;

let currentPage = 1;
let currentOrdering = '-created_at';
let totalCount = 0;
let totalPages = 0;

// ─── Init ────────────────────────────────────────────────────────────────────

async function init() {
  bindSortButtons();
  await loadPage(1);
}

function bindSortButtons() {
  document.querySelectorAll('.sort-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      currentOrdering = btn.dataset.ordering;
      document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      await loadPage(1);
    });
  });
}

// ─── Data Fetching ────────────────────────────────────────────────────────────

async function loadPage(page) {
  currentPage = page;
  showLoading();

  const url = new URL(API, window.location.origin);
  url.searchParams.set('page', page);
  url.searchParams.set('page_size', PAGE_SIZE);
  url.searchParams.set('ordering', currentOrdering);

  try {
    const res = await fetch(url.toString(), { credentials: 'same-origin' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    totalCount = data.count ?? 0;
    totalPages = Math.ceil(totalCount / PAGE_SIZE);
    renderTable(data.results ?? []);
    renderPagination();
  } catch (err) {
    console.error('Failed to load simulations:', err);
    showLoading('Failed to load simulations. Please refresh.');
  }
}

// ─── Rendering ────────────────────────────────────────────────────────────────

function showLoading(msg = null) {
  document.getElementById('sims-loading').style.display = 'flex';
  if (msg) document.getElementById('sims-loading').innerHTML = `<i class="ph ph-warning" style="font-size:1.5rem;color:var(--danger)"></i><span>${msg}</span>`;
  document.getElementById('sims-table-wrapper').style.display = 'none';
  document.getElementById('sims-empty').style.display = 'none';
  document.getElementById('sims-pagination').style.display = 'none';
}

function renderTable(simulations) {
  const loading = document.getElementById('sims-loading');
  const tableWrapper = document.getElementById('sims-table-wrapper');
  const empty = document.getElementById('sims-empty');
  const tbody = document.getElementById('sims-tbody');

  loading.style.display = 'none';

  if (simulations.length === 0) {
    empty.style.display = 'flex';
    tableWrapper.style.display = 'none';
    return;
  }

  empty.style.display = 'none';
  tableWrapper.style.display = 'block';

  tbody.innerHTML = simulations.map(sim => {
    const lb = sim.latest_balance;
    const holdingBtc = lb && lb.btc_amount > 0;
    const badge = holdingBtc
      ? `<span class="badge badge-btc"><i class="ph ph-coin"></i> BTC</span>`
      : `<span class="badge badge-usdc"><i class="ph ph-currency-dollar"></i> USDC</span>`;
    const usdcVal = lb ? fmtNum(lb.usdc_amount, 2) : '—';
    const btcVal  = lb ? fmtNum(lb.btc_amount, 6) : '—';

    return `
      <tr>
        <td style="font-family:monospace;font-size:0.8rem;color:var(--text-muted);">${sim.id.slice(0, 8)}…</td>
        <td>${fmtDate(sim.created_at)}</td>
        <td>${sim.interval}d</td>
        <td>${fmtPct(sim.threshold_down)} / ${fmtPct(sim.threshold_up)}</td>
        <td>${fmtPct(sim.apy_down)} / ${fmtPct(sim.apy_up)}</td>
        <td>$${fmtNum(sim.initial_usdc, 0)}</td>
        <td>${badge}</td>
        <td style="color:${lb && lb.usdc_amount > 0 ? 'var(--success)' : 'var(--text-muted)'}">
          $${usdcVal}
        </td>
        <td style="color:${lb && lb.btc_amount > 0 ? 'var(--accent-gold)' : 'var(--text-muted)'}">
          ${btcVal}
        </td>
      </tr>
    `;
  }).join('');
}

function renderPagination() {
  const container = document.getElementById('sims-pagination');
  if (totalPages <= 1) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'flex';
  container.innerHTML = '';

  // Prev button
  const prevBtn = makePaginationBtn('‹', currentPage > 1, () => loadPage(currentPage - 1), 'prev-page');
  container.appendChild(prevBtn);

  // Page numbers (max 7 visible)
  const pages = getPageRange(currentPage, totalPages);
  pages.forEach(p => {
    if (p === '…') {
      const ellipsis = document.createElement('span');
      ellipsis.className = 'pagination-info';
      ellipsis.textContent = '…';
      container.appendChild(ellipsis);
    } else {
      const btn = makePaginationBtn(p, true, () => loadPage(p), `page-${p}`);
      if (p === currentPage) btn.classList.add('active');
      container.appendChild(btn);
    }
  });

  // Next button
  const nextBtn = makePaginationBtn('›', currentPage < totalPages, () => loadPage(currentPage + 1), 'next-page');
  container.appendChild(nextBtn);

  // Info
  const info = document.createElement('span');
  info.className = 'pagination-info';
  info.textContent = `${totalCount} total`;
  container.appendChild(info);
}

function makePaginationBtn(label, enabled, onClick, id) {
  const btn = document.createElement('button');
  btn.className = 'pagination-btn';
  btn.id = id;
  btn.textContent = label;
  btn.disabled = !enabled;
  if (enabled) btn.onclick = onClick;
  return btn;
}

function getPageRange(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [];
  if (current <= 4) {
    for (let i = 1; i <= 5; i++) pages.push(i);
    pages.push('…', total);
  } else if (current >= total - 3) {
    pages.push(1, '…');
    for (let i = total - 4; i <= total; i++) pages.push(i);
  } else {
    pages.push(1, '…', current - 1, current, current + 1, '…', total);
  }
  return pages;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function fmtNum(n, decimals = 2) {
  if (n == null) return '—';
  return Number(n).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtPct(n) {
  if (n == null) return '—';
  return (Number(n) * 100).toFixed(1) + '%';
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

// ─── Boot ────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
