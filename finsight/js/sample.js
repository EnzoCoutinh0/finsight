/* ==========================================================================
   Gerador de extrato de exemplo (determinístico) — 3 meses, formato BR
   ========================================================================== */
const Sample = (() => {
  function mulberry32(a) {
    return () => {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function buildRows() {
    const rnd = mulberry32(2026);
    const r = (a, b) => a + rnd() * (b - a);
    const day = () => 1 + Math.floor(rnd() * 28);
    const pick = arr => arr[Math.floor(rnd() * arr.length)];
    const rows = [];
    const add = (y, m, d, desc, v) => rows.push({ date: new Date(y, m - 1, d, 12), desc, v: Math.round(v * 100) / 100 });

    [[2026, 8], [2026, 9], [2026, 10]].forEach(([y, m], i) => {
      const last = i === 2;
      add(y, m, 5, 'SALARIO ACME TECNOLOGIA LTDA', 7450);
      if (i === 1) add(y, m, 19, 'PIX RECEBIDO - FREELA DESIGN', 1200);
      add(y, m, 1, 'TARIFA PACOTE SERVICOS', -34.9);
      add(y, m, 6, 'PAGAMENTO ALUGUEL IMOBILIARIA', -1850);
      add(y, m, 10, 'CONDOMINIO RESIDENCIAL JARDINS', -480);
      add(y, m, 12, 'ENEL DISTRIBUICAO SP', -r(150, 215));
      add(y, m, 13, 'SABESP', -r(68, 95));
      add(y, m, 15, 'VIVO FIBRA INTERNET', -119.9);
      add(y, m, 16, 'CLARO CELULAR', -59.99);
      add(y, m, 3, 'SMARTFIT MENSALIDADE', -129.9);
      add(y, m, 8, 'NETFLIX.COM', -55.9);
      add(y, m, 9, 'SPOTIFY', -21.9);
      add(y, m, 11, 'DISNEY PLUS', -33.9);
      add(y, m, 14, 'AMAZON PRIME', -19.9);
      add(y, m, 18, 'HBO MAX', -29.9);
      add(y, m, 21, 'YOUTUBE PREMIUM', -24.9);
      for (let k = 0; k < (last ? 17 : 9); k++) add(y, m, day(), pick(['IFOOD *RESTAURANTE SABOR', 'IFOOD *BURGER HOUSE', 'IFOOD *SUSHI DAY', 'RAPPI *PIZZARIA NAPOLI']), -r(32, 88));
      for (let k = 0; k < 11; k++) add(y, m, day(), pick(['UBER *TRIP', 'UBER *TRIP', '99APP *CORRIDA']), -r(14, 42));
      for (let k = 0; k < 3; k++) add(y, m, 3 + k * 9 + Math.floor(rnd() * 3), pick(['CARREFOUR HIPER', 'PAO DE ACUCAR', 'ASSAI ATACADISTA']), -r(160, 340));
      for (let k = 0; k < 14; k++) add(y, m, day(), pick(['PADARIA PAO QUENTE', 'STARBUCKS', 'CAFE DO PONTO', 'LANCHONETE DA ESQUINA']), -r(7, 26));
      for (let k = 0; k < 2; k++) add(y, m, day(), pick(['POSTO SHELL', 'POSTO IPIRANGA']), -r(170, 240));
      add(y, m, day(), pick(['DROGASIL', 'DROGA RAIA']), -r(35, 120));
      for (let k = 0; k < 2; k++) add(y, m, day(), pick(['SHOPEE *LOJA OFICIAL', 'MERCADOLIVRE*COMPRA', 'AMAZON MARKETPLACE', 'RENNER']), -r(60, 260));
      add(y, m, day(), pick(['CINEMARK', 'BAR DO ZE', 'SYMPLA *SHOW']), -r(60, 180));
      add(y, m, day(), 'PIX ENVIADO - MARIA SOUZA', -r(50, 180));
      if (!last) add(y, m, 6, 'APLICACAO CDB LIQUIDEZ DIARIA', -600);
      if (last) {
        add(y, m, 22, 'KABUM *NOTEBOOK GAMER', -2499);
        add(y, m, 25, 'JUROS ROTATIVO CARTAO', -86.4);
        add(y, m, day(), 'ESTORNO COMPRA', 49.9);
      }
    });

    return rows.sort((a, b) => a.date - b.date);
  }

  const pad = n => String(n).padStart(2, '0');
  const money = v => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dateStr = d => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;

  function csv() {
    return ['Data;Descrição;Valor']
      .concat(buildRows().map(x => `${dateStr(x.date)};${x.desc};${money(x.v)}`))
      .join('\r\n');
  }

  /** Extrato de exemplo em PDF, no estilo de um banco (para testar a importação de PDF). */
  function pdf() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
    const header = () => {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.text('Banco Exemplo S.A. - Extrato de Conta Corrente', 40, 50);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text('Agência 0001  Conta 12345-6  Período 01/08/2026 a 31/10/2026', 40, 66);
      doc.setFont('helvetica', 'bold'); doc.text('Data', 40, 92); doc.text('Lançamento', 110, 92); doc.text('Valor (R$)', W - 40, 92, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      return 110;
    };
    let y = header();
    doc.text('01/08/2026', 40, y); doc.text('SALDO ANTERIOR', 110, y); doc.text('2.300,00', W - 40, y, { align: 'right' }); y += 15;
    buildRows().forEach(x => {
      if (y > H - 50) { doc.addPage(); y = header(); }
      doc.text(dateStr(x.date), 40, y);
      doc.text(x.desc, 110, y);
      doc.text(money(x.v), W - 40, y, { align: 'right' });
      y += 15;
    });
    return doc.output('blob');
  }

  return { csv, pdf };
})();
