/* ==========================================================================
   Parser de extratos CSV
   - Detecta delimitador (; , tab |) e codificação
   - Reconhece cabeçalhos dos principais bancos (Nubank, Inter, Itaú, BB…)
   - Entende valores no formato BR (1.234,56) e US (1,234.56)
   - Suporta colunas separadas de débito/crédito e coluna "tipo" (D/C)
   ========================================================================== */
const Parser = (() => {
  const norm = s => (s ?? '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

  function splitLine(line, d) {
    const out = [];
    let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q;
      } else if (c === d && !q) { out.push(cur); cur = ''; }
      else cur += c;
    }
    out.push(cur);
    return out.map(s => s.trim());
  }

  function detectDelimiter(lines) {
    let best = ',', bestScore = 0;
    for (const d of [';', ',', '\t', '|']) {
      const counts = lines.slice(0, 25).map(l => splitLine(l, d).length).filter(c => c > 1);
      if (!counts.length) continue;
      const freq = {};
      counts.forEach(c => (freq[c] = (freq[c] || 0) + 1));
      const [mode, n] = Object.entries(freq).sort((a, b) => b[1] - a[1])[0];
      const score = n * 10 + Number(mode);
      if (score > bestScore) { bestScore = score; best = d; }
    }
    return best;
  }

  function parseAmount(raw, brHint = true) {
    if (raw == null) return NaN;
    let s = String(raw).trim();
    if (!s) return NaN;
    let neg = false;
    if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
    if (/\s*[dD]$/.test(s)) { neg = true; s = s.replace(/\s*[dD]$/, ''); }
    else s = s.replace(/\s*[cC]$/, '');
    s = s.replace(/r\$|brl|\s/gi, '');
    if (s.endsWith('-')) { neg = !neg; s = s.slice(0, -1); }
    if (s.startsWith('-')) { neg = !neg; s = s.slice(1); }
    if (s.startsWith('+')) s = s.slice(1);

    const lc = s.lastIndexOf(','), ld = s.lastIndexOf('.');
    if (lc > -1 && ld > -1) {
      s = lc > ld ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
    } else if (lc > -1) {
      const decimals = s.length - lc - 1;
      const many = (s.match(/,/g) || []).length > 1;
      s = many || decimals === 3 ? s.replace(/,/g, '') : s.replace(',', '.');
    } else if (ld > -1) {
      const decimals = s.length - ld - 1;
      const many = (s.match(/\./g) || []).length > 1;
      if (many || (brHint && decimals === 3)) s = s.replace(/\./g, '');
    }
    if (!/^\d*\.?\d+$/.test(s)) return NaN;
    const v = parseFloat(s);
    return neg ? -v : v;
  }

  function parseDate(raw) {
    const s = String(raw ?? '').trim();
    const mk = (y, mo, d) => (mo < 1 || mo > 12 || d < 1 || d > 31) ? null : new Date(y, mo - 1, d, 12);
    let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (m) return mk(+m[1], +m[2], +m[3]);
    m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})(?!\d)/);
    if (m) {
      let y = +m[3];
      if (y < 100) y += 2000;
      return mk(y, +m[2], +m[1]);
    }
    return null;
  }

  function roleOf(cell) {
    const c = norm(cell).replace(/[^a-z0-9/ ]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!c) return null;
    if (/^saldo/.test(c)) return 'balance';
    if (/^(data|date|dt)\b/.test(c)) return 'date';
    if (/debito|saida|^debit/.test(c)) return 'debit';
    if (/credito|entrada|^credit/.test(c)) return 'credit';
    if (/^(tipo|natureza|d\/c|dc|type)\b/.test(c)) return 'type';
    if (/^(valor|amount|value|quantia|montante|vlr)\b/.test(c)) return 'amount';
    if (/descri|histor|lanca|^title|titulo|estabelec|^memo|detalhe|^transac|^nome|favorecido/.test(c)) return 'desc';
    return null;
  }

  function findHeader(lines, d) {
    for (let i = 0; i < Math.min(lines.length, 20); i++) {
      const roles = splitLine(lines[i], d).map(roleOf);
      if (roles.includes('date') && (roles.includes('amount') || roles.includes('debit') || roles.includes('credit'))) {
        const map = {};
        roles.forEach((r, idx) => { if (r && map[r] == null) map[r] = idx; });
        return { index: i, map };
      }
    }
    return null;
  }

  function inferColumns(rows, brHint) {
    const n = Math.max(...rows.map(r => r.length));
    const stats = Array.from({ length: n }, () => ({ date: 0, num: 0, len: 0 }));
    rows.slice(0, 60).forEach(r => r.forEach((c, i) => {
      if (parseDate(c)) stats[i].date++;
      else if (!isNaN(parseAmount(c, brHint))) stats[i].num++;
      else stats[i].len += c.length;
    }));
    const argmax = arr => arr.reduce((bi, v, i) => (v > arr[bi] ? i : bi), 0);
    const date = argmax(stats.map(s => s.date));
    const amount = argmax(stats.map((s, i) => (i === date ? -1 : s.num)));
    const desc = argmax(stats.map((s, i) => (i === date || i === amount ? -1 : s.len)));
    if (!stats[date].date || !stats[amount].num) return null;
    return { date, amount, desc };
  }

  function parse(text) {
    text = text.replace(/^﻿/, '');
    const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
    if (lines.length < 2) throw new Error('O arquivo está vazio ou tem poucas linhas.');

    const d = detectDelimiter(lines);
    const brHint = d !== ',';
    const header = findHeader(lines, d);
    let start = 0, map;
    if (header) { start = header.index + 1; map = header.map; }
    else {
      map = inferColumns(lines.map(l => splitLine(l, d)), brHint);
      if (!map) throw new Error('Não consegui identificar as colunas de data e valor neste CSV.');
    }

    const tx = [];
    let skipped = 0;
    for (let i = start; i < lines.length; i++) {
      const c = splitLine(lines[i], d);
      const date = parseDate(c[map.date]);
      if (!date) { skipped++; continue; }

      let desc = map.desc != null ? c[map.desc] : '';
      if (!desc) {
        desc = c.filter((v, idx) => idx !== map.date && idx !== map.amount && v && isNaN(parseAmount(v, brHint))).join(' ').trim() || 'Sem descrição';
      }
      const nd = norm(desc);
      if (/^saldo|saldo (anterior|do dia|final|disponivel|em conta)/.test(nd)) { skipped++; continue; }

      let amount;
      if (map.amount != null) amount = parseAmount(c[map.amount], brHint);
      else {
        const deb = parseAmount(c[map.debit], brHint), cre = parseAmount(c[map.credit], brHint);
        if (!isNaN(cre) && cre !== 0) amount = Math.abs(cre);
        else if (!isNaN(deb) && deb !== 0) amount = -Math.abs(deb);
        else amount = NaN;
      }
      if (map.type != null && !isNaN(amount)) {
        const t = norm(c[map.type]);
        if (t === 'c' || /^(cred|entrada|receita|deposit)/.test(t)) amount = Math.abs(amount);
        else if (t === 'd' || /^(deb|saida|despesa|pagamento|compra|saque)/.test(t)) amount = -Math.abs(amount);
      }
      if (isNaN(amount) || amount === 0) { skipped++; continue; }

      tx.push({ date, description: desc.replace(/\s+/g, ' ').trim(), amount: Math.round(amount * 100) / 100 });
    }
    if (!tx.length) throw new Error('Não encontrei transações válidas. O CSV precisa ter colunas de data, descrição e valor.');

    // Fatura de cartão (ex.: Nubank): quase todos os valores positivos = gastos
    let cardMode = false;
    const hasSignCols = map.type != null || map.debit != null || map.credit != null;
    if (!hasSignCols && tx.length >= 5 && tx.filter(t => t.amount > 0).length / tx.length >= 0.75) {
      cardMode = true;
      tx.forEach(t => (t.amount = -t.amount));
    }
    return { transactions: tx, meta: { delimiter: d, cardMode, skipped, total: tx.length } };
  }

  return { parse, parseAmount, parseDate, norm };
})();
