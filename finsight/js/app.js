/* ==========================================================================
   App — fluxo de importação, renderização do painel e interações
   ========================================================================== */
(() => {
  'use strict';

  const $ = s => document.querySelector(s);
  const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const BRL0 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  const fmt = v => BRL.format(v);
  const fmt0 = v => BRL0.format(v);
  const pctTxt = v => `${v.toFixed(1).replace('.', ',')}%`;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const CATS = Categorizer.CATEGORIES;
  const pad = n => String(n).padStart(2, '0');
  const monthKey = Insights.monthKey;
  const fmtDate = d => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icons = () => window.lucide && lucide.createIcons();
  const nextFrame = fn => requestAnimationFrame(() => requestAnimationFrame(fn));
  const wait = ms => new Promise(r => setTimeout(r, reduceMotion ? 0 : ms));

  const state = { all: [], period: 'all', search: '', cat: 'all', limit: 60 };

  /* ---------------- Utilidades de UI ---------------- */
  function showView(id) {
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === id));
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function toast(msg, type = 'info') {
    const meta = { success: ['circle-check', 'var(--green-2)'], error: ['circle-x', 'var(--red)'], info: ['info', 'var(--blue)'] }[type];
    const el = document.createElement('div');
    el.className = 'toast';
    el.style.setProperty('--tc', meta[1]);
    el.innerHTML = `<i data-lucide="${meta[0]}"></i><span>${esc(msg)}</span>`;
    $('#toasts').appendChild(el);
    icons();
    setTimeout(() => {
      el.classList.add('out');
      el.addEventListener('animationend', () => el.remove(), { once: true });
    }, 4500);
  }

  function countUp(el, to, format) {
    const from = parseFloat(el.dataset.v || 0);
    el.dataset.v = to;
    cancelAnimationFrame(el._raf);
    if (reduceMotion) { el.textContent = format(to); return; }
    const dur = 1200, t0 = performance.now();
    const step = now => {
      const p = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - p, 4);
      el.textContent = format(from + (to - from) * e);
      if (p < 1) el._raf = requestAnimationFrame(step);
    };
    el._raf = requestAnimationFrame(step);
  }

  function download(content, name) {
    const blob = content instanceof Blob ? content : new Blob([content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  /* ---------------- Importação ---------------- */
  async function readFile(file) {
    const buf = await file.arrayBuffer();
    try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); }
    catch { return new TextDecoder('windows-1252').decode(buf); } // muitos bancos exportam em Latin-1
  }

  const isPdf = f => /\.pdf$/i.test(f.name) || f.type === 'application/pdf';

  async function handleFiles(fileList) {
    const files = [...fileList].filter(f => isPdf(f) || /\.(csv|txt)$/i.test(f.name) || /csv/.test(f.type));
    if (!files.length) { toast('Selecione um arquivo .csv ou .pdf', 'error'); return; }
    const sources = await Promise.all(files.map(async f =>
      isPdf(f) ? { kind: 'pdf', buffer: await f.arrayBuffer() } : { kind: 'csv', text: await readFile(f) }));
    await processSources(sources);
  }

  async function processSources(sources) {
    showView('loadingView');
    const steps = [...document.querySelectorAll('.steps li')];
    steps.forEach(s => (s.className = ''));
    try {
      steps[0].classList.add('active');
      await wait(500);
      const txs = [];
      let cardMode = false;
      let fromPdf = false;
      for (const src of sources) {
        const r = src.kind === 'pdf' ? await PdfReader.parse(src.buffer) : Parser.parse(src.text);
        txs.push(...r.transactions);
        cardMode ||= r.meta.cardMode;
        fromPdf ||= src.kind === 'pdf';
      }
      steps[0].className = 'done';
      steps[1].classList.add('active');
      await wait(550);
      txs.forEach((t, i) => { t.id = 't' + i; Object.assign(t, Categorizer.categorize(t)); });
      steps[1].className = 'done';
      steps[2].classList.add('active');
      await wait(550);
      steps[2].className = 'done';
      await wait(250);

      state.all = txs.sort((a, b) => b.date - a.date);
      Object.assign(state, { period: 'all', search: '', cat: 'all', limit: 60 });
      $('#searchInput').value = '';
      buildSelects();
      showView('dashView');
      $('#topActions').hidden = false;
      $('#backBtn').hidden = false;
      render();
      toast(`${txs.length} transações importadas e categorizadas`, 'success');
      if (cardMode) toast('Os valores não tinham sinal: tratei como gastos, exceto entradas como salário e estornos.', 'info');
      if (fromPdf) toast('PDF lido! Confira as transações; se algo vier errado, corrija a categoria ou use o CSV.', 'info');
    } catch (err) {
      console.error(err);
      showView(state.all.length ? 'dashView' : 'uploadView');
      toast(err.message || 'Não foi possível ler o arquivo.', 'error');
    }
  }

  function buildSelects() {
    const keys = [...new Set(state.all.map(t => monthKey(t.date)))].sort().reverse();
    $('#periodSelect').innerHTML = '<option value="all">Todo o período</option>' +
      keys.map(k => `<option value="${k}">${MONTHS[+k.slice(5) - 1]} ${k.slice(0, 4)}</option>`).join('');
    buildCatFilter();
  }

  function buildCatFilter() {
    const present = new Set(state.all.map(t => t.category));
    $('#catFilter').innerHTML = '<option value="all">Todas as categorias</option>' +
      Object.keys(CATS).filter(c => present.has(c)).map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
    $('#catFilter').value = present.has(state.cat) ? state.cat : 'all';
    if (!present.has(state.cat)) state.cat = 'all';
  }

  /* ---------------- Renderização ---------------- */
  const periodTxs = () => (state.period === 'all' ? state.all : state.all.filter(t => monthKey(t.date) === state.period));

  function render() {
    const txs = periodTxs();
    const a = Insights.analyze(txs, state.all, state.period);
    const periodLabel = state.period === 'all' ? 'todo o período' : $('#periodSelect').selectedOptions[0].textContent;
    $('#dashSub').textContent = `${txs.length} transações · ${periodLabel} · ${a.months} ${a.months > 1 ? 'meses' : 'mês'}`;

    renderKPIs(a);
    renderScore(a);
    Charts.update(a, state.period);
    renderCategories(a);
    renderInsights(a);
    renderTable();
    icons();
  }

  function renderKPIs(a) {
    countUp($('#kpiIncome'), a.income, fmt);
    countUp($('#kpiExpense'), a.expense, fmt);
    countUp($('#kpiBalance'), a.balance, fmt);
    $('#kpiBalance').classList.toggle('neg', a.balance < 0);
    const rate = a.savingsRate == null ? 0 : a.savingsRate * 100;
    countUp($('#kpiRate'), rate, pctTxt);
    $('#kpiRate').classList.toggle('neg', rate < 0);
    $('#kpiIncomeSub').textContent = `${a.incomeCount} entradas${a.months > 1 ? ` · ${fmt0(a.income / a.months)}/mês` : ''}`;
    $('#kpiExpenseSub').textContent = `${a.expenseCount} saídas${a.months > 1 ? ` · ${fmt0(a.expense / a.months)}/mês` : ''}`;
    $('#kpiBalanceSub').textContent = a.invested > 0 ? `${fmt0(a.invested)} investidos no período` : 'receitas − despesas − investimentos';
    nextFrame(() => ($('#rateMeter').style.width = `${Math.max(0, Math.min(1, rate / 40)) * 100}%`));
  }

  function renderScore(a) {
    const s = a.score;
    const color = s >= 70 ? 'var(--green-2)' : s >= 45 ? 'var(--gold)' : 'var(--red)';
    const label = s >= 80 ? 'Excelente' : s >= 65 ? 'Saudável' : s >= 45 ? 'Atenção' : 'Crítica';
    countUp($('#scoreVal'), s, v => Math.round(v));
    const tag = $('#scoreLabel');
    tag.textContent = label;
    tag.style.setProperty('--tc', color);
    const arc = $('#gaugeArc');
    arc.style.setProperty('--gc', color);
    nextFrame(() => (arc.style.strokeDashoffset = 326.73 * (1 - s / 100)));

    const set = (id, v, ok, scale = 1) => {
      $(`#${id}V`).textContent = v == null ? '—' : `${Math.round(v * 100)}%`;
      const bar = $(`#${id}`);
      bar.style.setProperty('--rc', ok ? 'var(--green-2)' : 'var(--gold)');
      nextFrame(() => (bar.style.width = `${v == null ? 0 : Math.min(1, v * scale) * 100}%`));
    };
    const r = a.rule;
    set('rNeeds', r && r.needs, r && r.needs <= 0.5);
    set('rWants', r && r.wants, r && r.wants <= 0.3);
    set('rSave', r && r.save, r && r.save >= 0.2);
  }

  function renderCategories(a) {
    countUp($('#donutTotal'), a.expense, fmt0);
    const list = a.byCategory;
    $('#catList').innerHTML = list.length ? list.map((c, i) => {
      const m = CATS[c.cat];
      return `<button class="cat-row reveal ${state.cat === c.cat ? 'active' : ''}" style="--i:${i};--c:${m.color}" data-cat="${esc(c.cat)}">
        <span class="cat-ic"><i data-lucide="${m.icon}"></i></span>
        <span class="cat-info">
          <span class="cat-top"><b>${esc(c.cat)}</b><span>${fmt(c.total)}</span></span>
          <span class="bar"><span style="--w:${(c.share * 100).toFixed(1)}%;--i:${i}"></span></span>
        </span>
        <span class="cat-pct">${Math.round(c.share * 100)}%</span>
      </button>`;
    }).join('') : '<div class="empty">Nenhuma despesa no período.</div>';
  }

  function renderInsights(a) {
    countUp($('#savingsVal'), a.savings, fmt0);
    $('#savingsYear').innerHTML = a.savings > 0 ? `até <b>${fmt0(a.savings * 12)}</b> por ano` : 'nenhuma economia óbvia';
    $('#insCount').textContent = `${a.insights.length} descobertas`;
    $('#insightsList').innerHTML = a.insights.map((x, i) => `
      <div class="insight ${x.level} reveal" style="--i:${i}">
        <span class="in-ic"><i data-lucide="${x.icon}"></i></span>
        <div>
          <h4><span>${esc(x.title)}</span>${x.saving >= 5 ? `<span class="save-badge">~${fmt0(x.saving)}/mês</span>` : ''}</h4>
          <p>${esc(x.text)}</p>
        </div>
      </div>`).join('') || '<div class="empty">Sem insights para este período.</div>';
  }

  function renderTable() {
    let rows = periodTxs();
    if (state.cat !== 'all') rows = rows.filter(t => t.category === state.cat);
    if (state.search) {
      const q = Parser.norm(state.search);
      rows = rows.filter(t => Parser.norm(t.description).includes(q) || Parser.norm(t.category).includes(q));
    }
    $('#txCount').textContent = rows.length;
    $('#txList').innerHTML = rows.slice(0, state.limit).map((t, i) => {
      const m = CATS[t.category];
      return `<div class="tx-row" style="--i:${Math.min(i, 25)}">
        <span class="tx-date">${fmtDate(t.date)}</span>
        <span class="tx-desc" title="${esc(t.description)}">${esc(t.description)}${t.source === 'learned' ? '<small class="learned"><i data-lucide="brain"></i>aprendido</small>' : ''}</span>
        <span class="tx-chip"><button class="chip" data-id="${t.id}" style="--c:${m.color}" title="Alterar categoria"><i data-lucide="${m.icon}"></i>${esc(t.category)}<i data-lucide="chevron-down"></i></button></span>
        <span class="tx-amt ${t.amount > 0 ? 'pos' : ''}">${t.amount > 0 ? '+' : ''}${fmt(t.amount)}</span>
      </div>`;
    }).join('') || '<div class="empty">Nenhuma transação encontrada.</div>';
    $('#moreBtn').hidden = rows.length <= state.limit;
    icons();
  }

  /* ---------------- Menu de categorias (aprendizado) ---------------- */
  const menu = $('#catMenu');

  function openMenu(tx, anchor) {
    menu.innerHTML = `<div class="cm-head">Mover para…</div>
      <div class="cm-grid">${Object.entries(CATS).map(([name, m], i) =>
        `<button data-cat="${esc(name)}" class="${name === tx.category ? 'current' : ''}" style="--c:${m.color};--i:${i}"><i data-lucide="${m.icon}"></i>${esc(name)}</button>`).join('')}
      </div>
      <div class="cm-foot"><i data-lucide="sparkles"></i>Vou aplicar a todas as transações de "${esc(tx.key)}"</div>`;
    menu.dataset.id = tx.id;
    menu.hidden = false;
    icons();
    const r = anchor.getBoundingClientRect();
    const mw = menu.offsetWidth, mh = menu.offsetHeight;
    let left = Math.min(r.left, window.innerWidth - mw - 12);
    let top = r.bottom + 8;
    if (top + mh > window.innerHeight - 12) top = Math.max(12, r.top - mh - 8);
    menu.style.left = `${Math.max(12, left)}px`;
    menu.style.top = `${top}px`;
  }
  const closeMenu = () => (menu.hidden = true);

  function recategorize(id, cat) {
    const tx = state.all.find(t => t.id === id);
    if (!tx || tx.category === cat) { closeMenu(); return; }
    Categorizer.learn(tx, cat);
    const sign = Math.sign(tx.amount);
    let n = 0;
    state.all.forEach(t => {
      if (t.key === tx.key && Math.sign(t.amount) === sign) { t.category = cat; t.source = 'learned'; n++; }
    });
    closeMenu();
    buildCatFilter();
    render();
    toast(`Aprendi! "${tx.key}" agora é ${cat} (${n} ${n > 1 ? 'transações' : 'transação'}).`, 'success');
  }

  /* ---------------- Exportação ---------------- */
  function exportCSV() {
    const safe = s => (/^[=+\-@]/.test(s) ? `'${s}` : s); // evita injeção de fórmulas no Excel
    const quote = s => (/[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
    const rows = [...periodTxs()].sort((a, b) => a.date - b.date).map(t =>
      [`${fmtDate(t.date)}/${t.date.getFullYear()}`, safe(t.description), t.category, t.amount.toFixed(2).replace('.', ',')].map(quote).join(';'));
    download('﻿' + ['Data;Descrição;Categoria;Valor', ...rows].join('\r\n'), 'extrato-categorizado.csv');
    toast('CSV categorizado exportado.', 'success');
  }

  async function exportReport(btn) {
    if (!state.all.length) return;
    btn.classList.add('busy');
    try {
      Charts.clearHover();
      await wait(50); // deixa o botão mostrar o estado "gerando"
      const txs = periodTxs();
      const a = Insights.analyze(txs, state.all, state.period);
      const periodLabel = state.period === 'all' ? 'Todo o período' : $('#periodSelect').selectedOptions[0].textContent;
      Report.generate({ analysis: a, txs, periodLabel, fileName: `relatorio-finsight-${state.period === 'all' ? 'completo' : state.period}.pdf` });
      toast('Relatório PDF gerado.', 'success');
    } catch (err) {
      console.error(err);
      toast(err.message || 'Não foi possível gerar o PDF.', 'error');
    } finally {
      btn.classList.remove('busy');
    }
  }

  /* ---------------- Eventos ---------------- */
  function bind() {
    const dz = $('#dropzone');
    ['dragenter', 'dragover'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('drag'); }));
    ['dragleave', 'dragend'].forEach(ev => dz.addEventListener(ev, e => { if (!dz.contains(e.relatedTarget)) dz.classList.remove('drag'); }));
    dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('drag'); handleFiles(e.dataTransfer.files); });
    window.addEventListener('dragover', e => e.preventDefault());
    window.addEventListener('drop', e => e.preventDefault());
    $('#fileInput').addEventListener('change', e => { handleFiles(e.target.files); e.target.value = ''; });

    $('#sampleBtn').addEventListener('click', () => processSources([{ kind: 'csv', text: Sample.csv() }]));
    $('#downloadSampleBtn').addEventListener('click', () => download('﻿' + Sample.csv(), 'extrato-exemplo.csv'));
    $('#downloadSamplePdfBtn').addEventListener('click', () => {
      try { download(Sample.pdf(), 'extrato-exemplo.pdf'); }
      catch { toast('Gerador de PDF indisponível. Verifique sua conexão.', 'error'); }
    });
    $('#reportBtn').addEventListener('click', e => exportReport(e.currentTarget));
    $('#backBtn').addEventListener('click', () => { showView('dashView'); $('#topActions').hidden = false; render(); });
    $('#newFileBtn').addEventListener('click', () => { closeMenu(); showView('uploadView'); $('#topActions').hidden = true; });
    $('#exportBtn').addEventListener('click', exportCSV);

    $('#periodSelect').addEventListener('change', e => { state.period = e.target.value; state.limit = 60; render(); });
    $('#catFilter').addEventListener('change', e => { state.cat = e.target.value; state.limit = 60; renderTable(); syncCatRows(); });
    let deb;
    $('#searchInput').addEventListener('input', e => {
      clearTimeout(deb);
      deb = setTimeout(() => { state.search = e.target.value.trim(); state.limit = 60; renderTable(); }, 160);
    });
    $('#moreBtn').addEventListener('click', () => { state.limit += 80; renderTable(); });

    const filterByCat = cat => {
      state.cat = state.cat === cat ? 'all' : cat;
      $('#catFilter').value = state.cat;
      state.limit = 60;
      renderTable();
      syncCatRows();
      if (state.cat !== 'all') $('#txCard').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    };
    $('#catList').addEventListener('click', e => { const row = e.target.closest('.cat-row'); if (row) filterByCat(row.dataset.cat); });
    Charts.onCategoryClick(filterByCat);

    $('#txList').addEventListener('click', e => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      e.stopPropagation();
      const tx = state.all.find(t => t.id === chip.dataset.id);
      if (!menu.hidden && menu.dataset.id === tx.id) closeMenu(); else openMenu(tx, chip);
    });
    menu.addEventListener('click', e => { const b = e.target.closest('button[data-cat]'); if (b) recategorize(menu.dataset.id, b.dataset.cat); });
    document.addEventListener('click', e => { if (!menu.hidden && !menu.contains(e.target)) closeMenu(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
    window.addEventListener('scroll', () => { if (!menu.hidden) closeMenu(); }, { passive: true });

    // Brilho que segue o cursor nos cards
    document.addEventListener('pointermove', e => {
      const card = e.target.closest && e.target.closest('.card');
      if (!card) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - r.left}px`);
      card.style.setProperty('--my', `${e.clientY - r.top}px`);
    }, { passive: true });
  }

  function syncCatRows() {
    document.querySelectorAll('.cat-row').forEach(r => r.classList.toggle('active', r.dataset.cat === state.cat));
  }

  bind();
  icons();
})();
