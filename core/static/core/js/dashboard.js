/* ═══════════════════════════════════════════════════════════════════════════
   Dashboard JS — Dual Investment Simulation
   Fetches top simulations from /api/simulations/top-simulations/
   and renders the overlay chart + individual simulation cards.
   ═══════════════════════════════════════════════════════════════════════════ */

const CHART_COLORS = [
  '#F0B90B', // gold
  '#0ECB81', // green
  '#F6465D', // red
  '#7B68EE', // violet
  '#00C8FF', // cyan
];

const API_TOP = '/api/simulations/top-simulations/';
const API_SIMS = '/api/simulations/';

let overlayChart = null;
let overlayMode = 'usdc';
let topSimsData = { top_usdc: [], top_btc: [] };
let individualCharts = {};

// ─── Fetch & Boot ────────────────────────────────────────────────────────────

async function fetchTopSimulations() {
  const res = await fetch(API_TOP, { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchTotalCount() {
  const res = await fetch(`${API_SIMS}?page_size=1`, { credentials: 'same-origin' });
  if (!res.ok) return null;
  const data = await res.json();
  return data.count ?? null;
}

async function init() {
  try {
    const [data, total] = await Promise.all([fetchTopSimulations(), fetchTotalCount()]);
    topSimsData = data;

    // Fill stats
    document.getElementById('stat-total-sims').textContent = total ?? '—';

    const bestUsdc = data.top_usdc[0]?.latest_balance?.usdc_amount;
    document.getElementById('stat-best-usdc').textContent = bestUsdc != null
      ? '$' + fmtNum(bestUsdc, 2)
      : '—';

    const bestBtc = data.top_btc[0]?.latest_balance?.btc_amount;
    document.getElementById('stat-best-btc').textContent = bestBtc != null
      ? fmtNum(bestBtc, 6) + ' BTC'
      : '—';

    renderOverlayChart();
    renderSimCards();
  } catch (err) {
    console.error('Dashboard init failed:', err);
  }
}

// ─── Overlay Chart ────────────────────────────────────────────────────────────

function buildOverlayDatasets(mode) {
  const simulations = mode === 'usdc' ? topSimsData.top_usdc : topSimsData.top_btc;
  return simulations.map((sim, i) => {
    const history = sim.balance_history ?? [];
    const shortId = sim.id.slice(0, 8);
    const data = history.map(b => ({
      x: new Date(b.created_at),
      y: mode === 'usdc' ? b.usdc_amount : b.btc_amount,
    }));
    return {
      label: shortId,
      data,
      borderColor: CHART_COLORS[i % CHART_COLORS.length],
      backgroundColor: CHART_COLORS[i % CHART_COLORS.length] + '18',
      borderWidth: 2.5,
      pointRadius: 3,
      pointHoverRadius: 6,
      tension: 0.35,
      fill: false,
    };
  });
}

function renderOverlayChart() {
  const ctx = document.getElementById('overlay-chart').getContext('2d');
  const datasets = buildOverlayDatasets(overlayMode);

  if (overlayChart) overlayChart.destroy();

  overlayChart = new Chart(ctx, {
    type: 'line',
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: { color: '#848E9C', font: { family: 'Montserrat Alternates', size: 12 } },
        },
        tooltip: {
          backgroundColor: '#1E2329',
          titleColor: '#EAECEF',
          bodyColor: '#848E9C',
          borderColor: 'rgba(255,255,255,0.07)',
          borderWidth: 1,
          callbacks: {
            label: ctx => {
              const v = ctx.parsed.y;
              return overlayMode === 'usdc'
                ? ` ${ctx.dataset.label}: $${fmtNum(v, 2)}`
                : ` ${ctx.dataset.label}: ${fmtNum(v, 6)} BTC`;
            },
          },
        },
      },
      scales: {
        x: {
          type: 'time',
          time: { tooltipFormat: 'MMM d, yyyy' },
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#848E9C', font: { family: 'Montserrat Alternates', size: 11 } },
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: {
            color: '#848E9C',
            font: { family: 'Montserrat Alternates', size: 11 },
            callback: v => overlayMode === 'usdc' ? '$' + fmtNum(v, 0) : fmtNum(v, 4),
          },
        },
      },
    },
  });
}

function switchOverlayMode(mode) {
  overlayMode = mode;
  document.getElementById('chart-toggle-usdc').classList.toggle('active', mode === 'usdc');
  document.getElementById('chart-toggle-btc').classList.toggle('active', mode === 'btc');
  renderOverlayChart();
}

// ─── Simulation Cards ─────────────────────────────────────────────────────────

function renderSimCards() {
  const grid = document.getElementById('top-sims-grid');
  const loading = document.getElementById('top-sims-loading');

  const allSims = [
    ...topSimsData.top_usdc.map(s => ({ ...s, _category: 'usdc' })),
    ...topSimsData.top_btc.map(s => ({ ...s, _category: 'btc' })),
  ];

  // Deduplicate by id (a sim could appear in both lists)
  const seen = new Set();
  const unique = allSims.filter(s => {
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });

  grid.innerHTML = '';

  if (unique.length === 0) {
    loading.innerHTML = '<i class="ph ph-magnifying-glass" style="font-size:2rem;color:var(--text-muted)"></i><span>No simulations yet.</span>';
    return;
  }

  loading.style.display = 'none';
  grid.style.display = 'grid';

  unique.forEach((sim, i) => {
    const card = buildSimCard(sim, i);
    grid.appendChild(card);
  });

  // Render individual charts after cards are in DOM
  unique.forEach((sim, i) => renderSimMiniChart(sim, i));
}

function buildSimCard(sim, index) {
  const lb = sim.latest_balance;
  const holdingBtc = lb && lb.btc_amount > 0;
  const balanceBadge = holdingBtc
    ? `<span class="badge badge-btc"><i class="ph ph-coin"></i> BTC</span>`
    : `<span class="badge badge-usdc"><i class="ph ph-currency-dollar"></i> USDC</span>`;
  const balanceValue = holdingBtc
    ? `${fmtNum(lb.btc_amount, 6)} BTC`
    : `$${fmtNum(lb?.usdc_amount ?? 0, 2)}`;

  const card = document.createElement('div');
  card.className = 'card sim-card';
  card.setAttribute('data-sim-id', sim.id);
  card.style.animation = `fadeInUp 0.35s ease ${index * 0.06}s both`;
  card.innerHTML = `
    <style>
      @keyframes fadeInUp {
        from { opacity: 0; transform: translateY(16px); }
        to   { opacity: 1; transform: translateY(0); }
      }
    </style>
    <div class="card-header">
      <span style="font-family:monospace;font-size:0.8rem;color:var(--text-muted);">${sim.id.slice(0, 8)}…</span>
      ${balanceBadge}
    </div>
    <div class="sim-card-meta">
      <div class="sim-meta-item">
        <span class="sim-meta-label">Created</span>
        <span class="sim-meta-value">${fmtDate(sim.created_at)}</span>
      </div>
      <div class="sim-meta-item">
        <span class="sim-meta-label">Interval</span>
        <span class="sim-meta-value">${sim.interval}d</span>
      </div>
      <div class="sim-meta-item">
        <span class="sim-meta-label">Threshold ↓/↑</span>
        <span class="sim-meta-value">${fmtPct(sim.threshold_down)} / ${fmtPct(sim.threshold_up)}</span>
      </div>
      <div class="sim-meta-item">
        <span class="sim-meta-label">APY ↓/↑</span>
        <span class="sim-meta-value">${fmtPct(sim.apy_down)} / ${fmtPct(sim.apy_up)}</span>
      </div>
      <div class="sim-meta-item">
        <span class="sim-meta-label">Current Balance</span>
        <span class="sim-meta-value" style="color:var(--accent-gold)">${balanceValue}</span>
      </div>
      <div class="sim-meta-item">
        <span class="sim-meta-label">Initial USDC</span>
        <span class="sim-meta-value">$${fmtNum(sim.initial_usdc, 0)}</span>
      </div>
    </div>
    <div class="chart-controls" style="margin-bottom:0.5rem;">
      <button class="btn btn-ghost btn-sm active" onclick="switchCardMode('${sim.id}', 'usdc', this)" id="card-usdc-${index}">
        <i class="ph ph-currency-dollar"></i> USDC
      </button>
      <button class="btn btn-ghost btn-sm" onclick="switchCardMode('${sim.id}', 'btc', this)" id="card-btc-${index}">
        <i class="ph ph-coin"></i> BTC
      </button>
    </div>
    <div class="chart-container" style="height:140px;">
      <canvas id="mini-chart-${index}"></canvas>
    </div>
  `;
  return card;
}

function renderSimMiniChart(sim, index, mode = 'usdc') {
  const ctx = document.getElementById(`mini-chart-${index}`)?.getContext('2d');
  if (!ctx) return;

  const history = sim.balance_history ?? [];
  const color = mode === 'usdc' ? '#26a69a' : '#F0B90B';
  const data = history.map(b => ({
    x: new Date(b.created_at),
    y: mode === 'usdc' ? b.usdc_amount : b.btc_amount,
  }));

  if (individualCharts[sim.id]) individualCharts[sim.id].destroy();

  individualCharts[sim.id] = new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [{
        data,
        borderColor: color,
        backgroundColor: color + '20',
        borderWidth: 2,
        pointRadius: 2,
        tension: 0.35,
        fill: true,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: {
        backgroundColor: '#1E2329',
        titleColor: '#EAECEF',
        bodyColor: '#848E9C',
        callbacks: {
          label: ctx => mode === 'usdc'
            ? ` $${fmtNum(ctx.parsed.y, 2)}`
            : ` ${fmtNum(ctx.parsed.y, 6)} BTC`,
        },
      }},
      scales: {
        x: { type: 'time', display: false },
        y: { display: false },
      },
    },
  });

  // Store index so we can re-render with the right sim
  individualCharts[sim.id]._simRef = sim;
  individualCharts[sim.id]._indexRef = index;
}

function switchCardMode(simId, mode, btn) {
  // Toggle button classes in the parent card
  const card = document.querySelector(`[data-sim-id="${simId}"]`);
  card.querySelectorAll('.chart-controls .btn-ghost').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  // Re-render mini chart
  const existing = individualCharts[simId];
  if (existing) {
    renderSimMiniChart(existing._simRef, existing._indexRef, mode);
  }
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
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Boot ────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
