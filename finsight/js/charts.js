/* ==========================================================================
   Gráficos (Chart.js) — rosca de categorias, barras mensais e fluxo acumulado
   ========================================================================== */
const Charts = (() => {
  const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const COMPACT = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
  const SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const C = { green: '#34d399', red: '#f43f5e', gold: '#e9b949' };
  const BAR_COLORS = [C.green, C.red, C.gold];
  let donut, bars, line, ready = false, highlight = null, barKeys = [];
  let onCategory = null;

  const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };
  const money = v => BRL.format(v);
  const axisMoney = v => 'R$ ' + COMPACT.format(v);

  function init() {
    if (ready) return true;
    if (!window.Chart) return false;
    const d = Chart.defaults;
    d.color = '#8a9ab3';
    d.font.family = "'Plus Jakarta Sans', system-ui, sans-serif";
    d.font.size = 12;
    d.borderColor = 'rgba(255,255,255,.06)';
    Object.assign(d.plugins.tooltip, {
      backgroundColor: 'rgba(10,19,34,.96)', borderColor: 'rgba(255,255,255,.12)', borderWidth: 1,
      padding: 12, cornerRadius: 12, titleColor: '#e8eef8', bodyColor: '#c5d0e0', boxPadding: 6, usePointStyle: true,
    });
    ready = true;
    return true;
  }

  const barGradient = hex => ctx => {
    const { chart } = ctx;
    const area = chart.chartArea;
    const dim = highlight && barKeys[ctx.dataIndex] !== highlight;
    if (!area) return hex;
    const g = chart.ctx.createLinearGradient(0, area.bottom, 0, area.top);
    g.addColorStop(0, rgba(hex, dim ? 0.04 : 0.22));
    g.addColorStop(1, rgba(hex, dim ? 0.22 : 1));
    return g;
  };

  function updateDonut(cats) {
    const labels = cats.map(c => c.cat);
    const data = cats.map(c => +c.total.toFixed(2));
    const colors = cats.map(c => Categorizer.CATEGORIES[c.cat].color);
    if (donut) {
      donut.data.labels = labels;
      Object.assign(donut.data.datasets[0], { data, backgroundColor: colors });
      donut.update();
      return;
    }
    donut = new Chart(document.getElementById('donutChart'), {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0, hoverOffset: 12, spacing: 3, borderRadius: 6 }] },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '74%', layout: { padding: 10 },
        animation: { animateRotate: true, animateScale: true, duration: 1500, easing: 'easeOutQuart' },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ` ${money(ctx.parsed)}` } },
        },
        onClick: (e, els) => { if (els[0] && onCategory) onCategory(donut.data.labels[els[0].index]); },
        onHover: (e, els) => { e.native.target.style.cursor = els.length ? 'pointer' : 'default'; },
      },
    });
  }

  function updateBars(months) {
    barKeys = months.map(m => m.key);
    const labels = months.map(m => `${SHORT[+m.key.slice(5) - 1]}/${m.key.slice(2, 4)}`);
    const sets = [['Receitas', 'income'], ['Despesas', 'expense'], ['Investido', 'invested']];
    if (bars) {
      bars.data.labels = labels;
      sets.forEach(([, k], i) => (bars.data.datasets[i].data = months.map(m => +m[k].toFixed(2))));
      bars.update();
      return;
    }
    bars = new Chart(document.getElementById('barChart'), {
      type: 'bar',
      data: {
        labels,
        datasets: sets.map(([label, k], i) => ({
          label, data: months.map(m => +m[k].toFixed(2)),
          backgroundColor: barGradient(BAR_COLORS[i]), hoverBackgroundColor: BAR_COLORS[i],
          borderRadius: 8, borderSkipped: false, maxBarThickness: 38, categoryPercentage: 0.72, barPercentage: 0.86,
        })),
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        animation: {
          duration: 1100, easing: 'easeOutQuart',
          delay: ctx => (ctx.type === 'data' && ctx.mode === 'default' ? ctx.dataIndex * 110 + ctx.datasetIndex * 60 : 0),
        },
        scales: {
          x: { grid: { display: false }, border: { display: false } },
          y: { border: { display: false }, ticks: { callback: axisMoney, maxTicksLimit: 6 }, grid: { color: 'rgba(255,255,255,.05)' } },
        },
        plugins: {
          legend: {
            position: 'top', align: 'end',
            labels: {
              usePointStyle: true, pointStyle: 'circle', boxWidth: 8, boxHeight: 8, padding: 16,
              generateLabels: chart => chart.data.datasets.map((ds, i) => ({
                text: ds.label, fillStyle: BAR_COLORS[i], strokeStyle: BAR_COLORS[i], lineWidth: 0,
                pointStyle: 'circle', hidden: !chart.isDatasetVisible(i), datasetIndex: i, fontColor: '#8a9ab3',
              })),
            },
          },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.dataset.label}: ${money(ctx.parsed.y)}`,
              labelColor: ctx => ({ borderColor: BAR_COLORS[ctx.datasetIndex], backgroundColor: BAR_COLORS[ctx.datasetIndex] }),
            },
          },
        },
      },
    });
  }

  function updateLine(daily) {
    const labels = daily.map(p => p.label);
    const data = daily.map(p => +p.value.toFixed(2));
    if (line) {
      line.data.labels = labels;
      line.data.datasets[0].data = data;
      line.update();
      return;
    }
    line = new Chart(document.getElementById('lineChart'), {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Saldo acumulado', data, borderWidth: 2.5, tension: 0.35,
          borderColor: C.green,
          segment: { borderColor: ctx => (ctx.p1.parsed.y < 0 ? C.red : C.green) },
          fill: { target: 'origin', above: 'rgba(52,211,153,.13)', below: 'rgba(244,63,94,.15)' },
          pointRadius: 0, pointHoverRadius: 6, pointHoverBackgroundColor: C.green, pointHoverBorderColor: '#fff', pointHoverBorderWidth: 2,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        animation: { duration: 1400, easing: 'easeOutQuart' },
        scales: {
          x: { grid: { display: false }, border: { display: false }, ticks: { maxTicksLimit: 10, autoSkip: true } },
          y: { border: { display: false }, ticks: { callback: axisMoney, maxTicksLimit: 6 }, grid: { color: 'rgba(255,255,255,.05)' } },
        },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ` Saldo: ${money(ctx.parsed.y)}` } },
        },
      },
    });
  }

  function update(analysis, period) {
    if (!init()) return;
    highlight = period === 'all' ? null : period;
    updateDonut(analysis.byCategory);
    updateBars(analysis.byMonth);
    updateLine(analysis.daily);
  }

  /** Remove hover/tooltips para capturar os gráficos "limpos" no relatório PDF. */
  function clearHover() {
    [donut, bars, line].forEach(c => {
      if (!c) return;
      c.stop(); // finaliza animações em andamento para desenhar o estado final
      c.setActiveElements([]);
      c.tooltip.setActiveElements([], { x: 0, y: 0 });
      c.update('none');
      c.draw(); // garante o desenho síncrono antes da captura
    });
  }

  return { update, clearHover, onCategoryClick: fn => (onCategory = fn) };
})();
