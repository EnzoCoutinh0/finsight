/* ==========================================================================
   Leitor de extratos em PDF (pdf.js)
   - Extrai o texto de cada página e remonta as linhas pela posição
   - Reconhece datas (05/10/2026, 05/10, 05 OUT) e valores (1.234,56 / -R$ 12,00 / 45,90 D)
   - Linhas sem data herdam a data anterior (extratos agrupados por dia)
   Obs.: PDFs escaneados (imagem) não têm texto — nesses casos use o CSV.
   ========================================================================== */
const PdfReader = (() => {
  const WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const MONTHS = { jan: 1, fev: 2, feb: 2, mar: 3, abr: 4, apr: 4, mai: 5, may: 5, jun: 6, jul: 7, ago: 8, aug: 8, set: 9, sep: 9, out: 10, oct: 10, nov: 11, dez: 12, dec: 12 };
  const DATE_RE = /^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?(?!\d)|^(\d{1,2})\s+(jan|fev|feb|mar|abr|apr|mai|may|jun|jul|ago|aug|set|sep|out|oct|nov|dez|dec)[a-z]*\.?(?:\s+(\d{4}))?(?![a-z])/i;
  const MONEY_RE = /\(?-?\s?(?:R\$\s?)?-?\s?\d{1,3}(?:\.\d{3})*,\d{2}\)?(?:\s?[DC](?![a-z]))?-?/gi;
  const SKIP_RE = /saldo|total|limite|resumo|fatura anterior|pagamento minimo|valor minimo|cet\b|taxa de juros|juros do rotativo para|proxima fatura|vencimento/;
  const CREDIT_RE = /(recebid|salario|deposito|estorno|credito em conta|rendimento|reembolso|cashback|devolucao|provento)/;

  async function readLines(buffer) {
    if (!window.pdfjsLib) throw new Error('Leitor de PDF indisponível. Verifique sua conexão com a internet.');
    pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER;
    let pdf;
    try {
      pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
    } catch (e) {
      if (e && e.name === 'PasswordException') throw new Error('Este PDF é protegido por senha. Exporte o extrato sem senha ou use o CSV.');
      throw new Error('Não consegui abrir este PDF.');
    }
    const lines = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const { items } = await page.getTextContent();
      const rows = [];
      items.forEach(it => {
        if (!it.str || !it.str.trim()) return;
        const x = it.transform[4], y = it.transform[5];
        let row = rows.find(r => Math.abs(r.y - y) < 3);
        if (!row) rows.push((row = { y, items: [] }));
        row.items.push({ x, s: it.str });
      });
      rows.sort((a, b) => b.y - a.y).forEach(r =>
        lines.push(r.items.sort((a, b) => a.x - b.x).map(i => i.s).join(' ').replace(/\s+/g, ' ').trim()));
    }
    return lines;
  }

  function parseLines(lines) {
    // Ano padrão: o mais frequente no documento (para datas sem ano)
    const years = {};
    lines.join(' ').replace(/\b(20\d{2})\b/g, (_, y) => (years[y] = (years[y] || 0) + 1));
    const defaultYear = +(Object.entries(years).sort((a, b) => b[1] - a[1])[0]?.[0] || new Date().getFullYear());

    const tx = [];
    let lastDate = null;
    for (const line of lines) {
      let date = null, rest = line;
      const m = line.match(DATE_RE);
      if (m) {
        let d, mo, y;
        if (m[1]) { d = +m[1]; mo = +m[2]; y = m[3] ? +m[3] : null; }
        else { d = +m[4]; mo = MONTHS[m[5].toLowerCase().slice(0, 3)]; y = m[6] ? +m[6] : null; }
        if (y && y < 100) y += 2000;
        if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
          date = new Date(y || defaultYear, mo - 1, d, 12);
          rest = line.slice(m[0].length).trim().replace(/^\d{1,2}[/.-]\d{1,2}([/.-]\d{2,4})?\s+/, '');
        }
      }
      if (date) lastDate = date;
      const useDate = date || lastDate;
      if (!useDate || SKIP_RE.test(Parser.norm(line))) continue;

      const monies = [...rest.matchAll(MONEY_RE)];
      if (!monies.length) continue;
      const first = monies[0];
      const description = rest.slice(0, first.index).replace(/[\s\-–|:]+$/, '').trim();
      if (description.length < 2 || !/[a-z]/i.test(description)) continue;
      const amount = Parser.parseAmount(first[0].replace(/\s/g, ''), true);
      if (isNaN(amount) || amount === 0) continue;
      tx.push({ date: useDate, description: description.replace(/\s+/g, ' '), amount: Math.round(amount * 100) / 100 });
    }
    if (!tx.length) throw new Error('Não encontrei transações neste PDF. Se ele for uma imagem escaneada, exporte o extrato em CSV.');

    // Sem nenhum valor negativo: fatura de cartão ou extrato sem sinal → infere pelo texto
    const signless = !tx.some(t => t.amount < 0);
    if (signless) tx.forEach(t => { if (!CREDIT_RE.test(Parser.norm(t.description))) t.amount = -t.amount; });
    return { transactions: tx, meta: { cardMode: signless, pdf: true, total: tx.length } };
  }

  async function parse(buffer) {
    return parseLines(await readLines(buffer));
  }

  return { parse, parseLines };
})();
