/* ==========================================================================
   Relatório em PDF (jsPDF + AutoTable)
   Cabeçalho, KPIs, potencial de economia, gráficos, categorias,
   insights e lista completa de transações.
   ========================================================================== */
const Report = (() => {
  const NAVY = [8, 17, 31], NAVY2 = [14, 27, 46], GREEN = [16, 185, 129], GOLD = [201, 150, 40];
  const RED = [225, 29, 72], TEXT = [30, 41, 59], MUTED = [100, 116, 139], LINE = [226, 232, 240];
  const LEVEL = { danger: [225, 29, 72], warning: [245, 158, 11], tip: [201, 150, 40], info: [14, 165, 233], success: [16, 185, 129] };
  const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const BRL0 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  // Fontes padrão do PDF usam WinAnsi: troca caracteres que ela não tem
  const clean = s => String(s).replace(/−/g, '-').replace(/[  ]/g, ' ').replace(/[–—]/g, '-');
  const money = v => clean(BRL.format(v));
  const money0 = v => clean(BRL0.format(v));
  const hexToRgb = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const pad = n => String(n).padStart(2, '0');

  function generate({ analysis: a, txs, periodLabel, fileName }) {
    if (!window.jspdf) throw new Error('Gerador de PDF indisponível. Verifique sua conexão com a internet.');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 40;
    const CW = W - 2 * M;
    let y;

    const font = (size, style = 'normal', color = TEXT) => { doc.setFont('helvetica', style); doc.setFontSize(size); doc.setTextColor(...color); };
    const ensure = h => { if (y + h > H - 50) { doc.addPage(); y = M; } };
    const section = title => {
      ensure(40);
      doc.setFillColor(...GREEN); doc.rect(M, y - 9, 3, 13, 'F');
      font(13, 'bold'); doc.text(clean(title), M + 10, y + 2);
      y += 20;
    };

    // ---------- Cabeçalho ----------
    doc.setFillColor(...NAVY); doc.rect(0, 0, W, 112, 'F');
    doc.setFillColor(...GREEN); doc.rect(0, 112, W * 0.62, 4, 'F');
    doc.setFillColor(...GOLD); doc.rect(W * 0.62, 112, W * 0.38, 4, 'F');
    font(24, 'bold', [255, 255, 255]); doc.text('Fin', M, 50);
    const finW = doc.getTextWidth('Fin');
    doc.setTextColor(52, 211, 153); doc.text('Sight', M + finW, 50);
    font(11, 'normal', [180, 195, 215]); doc.text('Relatório financeiro inteligente', M, 70);
    doc.text(clean(`Período: ${periodLabel}  ·  ${txs.length} transações`), M, 90);

    const s = a.score;
    const sc = s >= 70 ? GREEN : s >= 45 ? GOLD : RED;
    const sl = s >= 80 ? 'Excelente' : s >= 65 ? 'Saudável' : s >= 45 ? 'Atenção' : 'Crítica';
    doc.setDrawColor(...sc); doc.setLineWidth(4); doc.setFillColor(...NAVY2); doc.circle(W - M - 34, 52, 30, 'FD');
    font(20, 'bold', [255, 255, 255]); doc.text(String(s), W - M - 34, 56, { align: 'center' });
    font(8, 'normal', [180, 195, 215]); doc.text('de 100', W - M - 34, 67, { align: 'center' });
    font(9, 'bold', sc); doc.text(`Saúde: ${sl}`, W - M - 34, 100, { align: 'center' });
    y = 140;

    // ---------- KPIs ----------
    const kpis = [
      ['Receitas', money(a.income), GREEN],
      ['Despesas', money(a.expense), RED],
      ['Saldo do período', money(a.balance), a.balance < 0 ? RED : GOLD],
      ['Taxa de poupança', a.savingsRate == null ? '—' : `${(a.savingsRate * 100).toFixed(1).replace('.', ',')}%`, [14, 165, 233]],
    ];
    const kw = (CW - 30) / 4;
    kpis.forEach(([label, value, color], i) => {
      const x = M + i * (kw + 10);
      doc.setFillColor(246, 248, 251); doc.setDrawColor(...LINE); doc.setLineWidth(0.8);
      doc.roundedRect(x, y, kw, 58, 8, 8, 'FD');
      doc.setFillColor(...color); doc.roundedRect(x, y, 4, 58, 2, 2, 'F');
      font(8.5, 'normal', MUTED); doc.text(clean(label), x + 12, y + 20);
      font(12.5, 'bold', label === 'Saldo do período' && a.balance < 0 ? RED : TEXT); doc.text(value === '—' ? '-' : value, x + 12, y + 40);
    });
    y += 74;

    // ---------- Potencial de economia ----------
    doc.setFillColor(253, 246, 227); doc.setDrawColor(240, 214, 150); doc.roundedRect(M, y, CW, 44, 8, 8, 'FD');
    font(8.5, 'bold', GOLD); doc.text('POTENCIAL DE ECONOMIA', M + 14, y + 17);
    font(15, 'bold', [146, 104, 14]); doc.text(`${money0(a.savings)} /mês`, M + 14, y + 35);
    font(10, 'normal', MUTED); doc.text(a.savings > 0 ? clean(`até ${money0(a.savings * 12)} por ano seguindo as sugestões`) : 'nenhuma economia óbvia no período', W - M - 14, y + 27, { align: 'right' });
    y += 62;

    // ---------- Gráficos ----------
    section('Visão geral');
    const ph = 190, gap = 12, lw = CW * 0.6, rw = CW - lw - gap;
    const panel = (x, w, title, canvasId) => {
      doc.setFillColor(...NAVY); doc.roundedRect(x, y, w, ph, 10, 10, 'F');
      font(9, 'bold', [200, 212, 228]); doc.text(clean(title), x + 12, y + 18);
      const cv = document.getElementById(canvasId);
      if (cv && cv.width) {
        const maxW = w - 20, maxH = ph - 34;
        const ratio = Math.min(maxW / cv.width, maxH / cv.height);
        const iw = cv.width * ratio, ih = cv.height * ratio;
        doc.addImage(cv.toDataURL('image/png'), 'PNG', x + (w - iw) / 2, y + 26 + (maxH - ih) / 2, iw, ih);
      }
    };
    panel(M, lw, 'Evolução mensal', 'barChart');
    panel(M + lw + gap, rw, 'Despesas por categoria', 'donutChart');
    y += ph + 14;
    ensure(150);
    doc.setFillColor(...NAVY); doc.roundedRect(M, y, CW, 150, 10, 10, 'F');
    font(9, 'bold', [200, 212, 228]); doc.text('Fluxo acumulado (saldo dia a dia)', M + 12, y + 18);
    const lc = document.getElementById('lineChart');
    if (lc && lc.width) {
      const ratio = Math.min((CW - 20) / lc.width, 116 / lc.height);
      doc.addImage(lc.toDataURL('image/png'), 'PNG', M + (CW - lc.width * ratio) / 2, y + 26, lc.width * ratio, lc.height * ratio);
    }
    y += 168;

    // ---------- Regra 50/30/20 ----------
    if (a.rule) {
      section('Regra 50/30/20');
      [['Necessidades', a.rule.needs, 0.5, true], ['Desejos', a.rule.wants, 0.3, true], ['Poupança', a.rule.save, 0.2, false]].forEach(([label, v, ideal, isMax]) => {
        ensure(20);
        const ok = isMax ? v <= ideal : v >= ideal;
        font(10, 'normal', MUTED); doc.text(label, M, y + 8);
        const bx = M + 90, bw = CW - 200;
        doc.setFillColor(...LINE); doc.roundedRect(bx, y + 2, bw, 8, 4, 4, 'F');
        doc.setFillColor(...(ok ? GREEN : GOLD)); if (v > 0) doc.roundedRect(bx, y + 2, Math.max(8, Math.min(1, v) * bw), 8, 4, 4, 'F');
        doc.setDrawColor(...TEXT); doc.setLineWidth(1.2); doc.line(bx + ideal * bw, y - 1, bx + ideal * bw, y + 13);
        font(10, 'bold', ok ? GREEN : GOLD); doc.text(`${Math.round(v * 100)}%`, bx + bw + 12, y + 9);
        font(9, 'normal', MUTED); doc.text(`ideal ${isMax ? 'até' : 'mín.'} ${ideal * 100}%`, W - M, y + 9, { align: 'right' });
        y += 20;
      });
      y += 8;
    }

    // ---------- Categorias ----------
    section('Para onde foi o dinheiro');
    doc.autoTable({
      startY: y, margin: { left: M, right: M },
      head: [['Categoria', 'Valor', '% das despesas', 'Transações']],
      body: a.byCategory.map(c => [clean(c.cat), money(c.total), `${(c.share * 100).toFixed(1).replace('.', ',')}%`, c.count]),
      theme: 'plain',
      styles: { font: 'helvetica', fontSize: 9.5, textColor: TEXT, cellPadding: { top: 6, bottom: 6, left: 8, right: 8 } },
      headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 0: { cellPadding: { left: 22, top: 6, bottom: 6, right: 8 } }, 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
      didDrawCell: d => {
        if (d.section === 'body' && d.column.index === 0) {
          const cat = a.byCategory[d.row.index];
          doc.setFillColor(...hexToRgb(Categorizer.CATEGORIES[cat.cat].color));
          doc.circle(d.cell.x + 11, d.cell.y + d.cell.height / 2, 3.5, 'F');
        }
      },
    });
    y = doc.lastAutoTable.finalY + 26;

    // ---------- Insights ----------
    section('Insights e sugestões');
    a.insights.forEach(ins => {
      const tw = CW - 30;
      font(9.5, 'normal', MUTED);
      const lines = doc.splitTextToSize(clean(ins.text), tw);
      const h = 30 + lines.length * 12;
      ensure(h + 8);
      const color = LEVEL[ins.level];
      doc.setFillColor(250, 251, 253); doc.setDrawColor(...LINE); doc.setLineWidth(0.8);
      doc.roundedRect(M, y, CW, h, 6, 6, 'FD');
      doc.setFillColor(...color); doc.roundedRect(M, y, 4, h, 2, 2, 'F');
      font(10.5, 'bold', TEXT); doc.text(clean(ins.title), M + 16, y + 18);
      if (ins.saving >= 5) { font(9, 'bold', GOLD); doc.text(`~${money0(ins.saving)}/mês`, W - M - 12, y + 18, { align: 'right' }); }
      font(9.5, 'normal', MUTED); doc.text(lines, M + 16, y + 33);
      y += h + 8;
    });

    // ---------- Transações ----------
    doc.addPage(); y = M;
    section('Transações');
    const sorted = [...txs].sort((p, q) => p.date - q.date);
    doc.autoTable({
      startY: y, margin: { left: M, right: M, bottom: 50 },
      head: [['Data', 'Descrição', 'Categoria', 'Valor']],
      body: sorted.map(t => [`${pad(t.date.getDate())}/${pad(t.date.getMonth() + 1)}/${t.date.getFullYear()}`, clean(t.description), clean(t.category), money(t.amount)]),
      theme: 'plain',
      styles: { font: 'helvetica', fontSize: 8.5, textColor: TEXT, cellPadding: { top: 4.5, bottom: 4.5, left: 6, right: 6 }, overflow: 'ellipsize' },
      headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 0: { cellWidth: 62 }, 2: { cellWidth: 105 }, 3: { cellWidth: 80, halign: 'right', fontStyle: 'bold' } },
      didParseCell: d => { if (d.section === 'body' && d.column.index === 3 && sorted[d.row.index].amount > 0) d.cell.styles.textColor = GREEN; },
    });

    // ---------- Rodapé ----------
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setDrawColor(...LINE); doc.setLineWidth(0.6); doc.line(M, H - 34, W - M, H - 34);
      font(8, 'normal', MUTED);
      doc.text(clean(`FinSight · gerado em ${new Date().toLocaleDateString('pt-BR')} · dados processados localmente no seu navegador`), M, H - 20);
      doc.text(`${i} / ${pages}`, W - M, H - 20, { align: 'right' });
    }

    doc.save(fileName);
  }

  return { generate };
})();
