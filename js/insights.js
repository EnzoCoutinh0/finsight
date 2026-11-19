/* ==========================================================================
   Motor de insights
   Analisa as transações e gera métricas, um score de saúde financeira
   e sugestões de economia com valor estimado por mês.
   ========================================================================== */
const Insights = (() => {
  const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  const money = v => BRL.format(v);
  const pct = v => `${Math.round(v * 100)}%`;
  const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const DESEJO = new Set(['Alimentação', 'Lazer', 'Compras', 'Assinaturas']);
  const ESSENCIAL = new Set(['Moradia & Contas', 'Mercado', 'Saúde', 'Transporte', 'Educação', 'Taxas & Juros']);
  const ORDER = { danger: 0, warning: 1, tip: 2, info: 3, success: 4 };

  const pad = n => String(n).padStart(2, '0');
  const monthKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  const dayKey = d => `${monthKey(d)}-${pad(d.getDate())}`;
  const sum = arr => arr.reduce((s, t) => s + t.amount, 0);
  const median = arr => { const s = [...arr].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const title = s => s.replace(/(^|\s)\S/g, c => c.toUpperCase());
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  function analyze(txs, all, period) {
    const income = sum(txs.filter(t => t.amount > 0));
    const out = txs.filter(t => t.amount < 0);
    const invTx = out.filter(t => t.category === 'Investimentos');
    const expTx = out.filter(t => t.category !== 'Investimentos');
    const invested = -sum(invTx);
    const expense = -sum(expTx);
    const months = Math.max(1, new Set(txs.map(t => monthKey(t.date))).size);
    const balance = income - expense - invested;
    const savingsRate = income > 0 ? (income - expense) / income : null;

    // --- Por categoria
    const catMap = {};
    expTx.forEach(t => {
      const c = (catMap[t.category] ??= { cat: t.category, total: 0, count: 0, txs: [] });
      c.total -= t.amount; c.count++; c.txs.push(t);
    });
    const byCategory = Object.values(catMap)
      .sort((a, b) => b.total - a.total)
      .map(c => ({ ...c, share: expense ? c.total / expense : 0 }));

    // --- Por mês (sempre do conjunto completo, para o gráfico de evolução)
    const allMonths = [...new Set(all.map(t => monthKey(t.date)))].sort();
    const byMonth = allMonths.map(k => {
      const m = all.filter(t => monthKey(t.date) === k);
      return {
        key: k,
        income: sum(m.filter(t => t.amount > 0)),
        expense: -sum(m.filter(t => t.amount < 0 && t.category !== 'Investimentos')),
        invested: -sum(m.filter(t => t.amount < 0 && t.category === 'Investimentos')),
      };
    });

    // --- Fluxo diário acumulado
    const dayMap = new Map();
    [...txs].sort((a, b) => a.date - b.date).forEach(t => {
      const k = dayKey(t.date);
      dayMap.set(k, (dayMap.get(k) || 0) + t.amount);
    });
    let acc = 0;
    const daily = [...dayMap].map(([k, v]) => ({ label: `${k.slice(8)}/${k.slice(5, 7)}`, value: (acc += v) }));

    // ======================= INSIGHTS =======================
    const ins = [];
    // opts.pin: aparece no topo · opts.umbrella: resume outras dicas, não entra na soma (evita contar em dobro)
    const add = (level, icon, titleTxt, text, saving = 0, opts = {}) => ins.push({ level, icon, title: titleTxt, text, saving: Math.max(0, saving || 0), ...opts });
    const perMonth = months > 1 ? ' por mês' : '';

    // 1. Taxa de poupança
    if (income <= 0) {
      add('info', 'info', 'Nenhuma receita no período', 'Não encontrei entradas de dinheiro. Se este arquivo for uma fatura de cartão, importe também o extrato da conta para calcular sua taxa de poupança.');
    } else if (savingsRate < 0) {
      add('danger', 'triangle-alert', 'Você gastou mais do que ganhou', `As despesas superaram as receitas em ${money(expense - income)}. Priorize cortar gastos variáveis antes que isso vire dívida.`, 0, { pin: true });
    } else if (savingsRate < 0.1) {
      add('warning', 'gauge', 'Taxa de poupança baixa', `Sobrou só ${pct(savingsRate)} da renda. A meta saudável é 20% — faltam cerca de ${money((0.2 * income - (income - expense)) / months)}${perMonth} para chegar lá.`);
    } else if (savingsRate < 0.2) {
      add('info', 'target', 'Perto da meta de 20%', `Você guardou ${pct(savingsRate)} da renda. Mais ${money((0.2 * income - (income - expense)) / months)}${perMonth} e você atinge o ideal.`);
    } else {
      add('success', 'trophy', 'Ótima taxa de poupança', `Você poupou ${pct(savingsRate)} da renda — acima dos 20% recomendados. Continue assim!`);
    }

    // 2. Regra 50/30/20
    let rule = null;
    if (income > 0) {
      const desejos = byCategory.filter(c => DESEJO.has(c.cat)).reduce((s, c) => s + c.total, 0);
      const essenciais = byCategory.filter(c => ESSENCIAL.has(c.cat)).reduce((s, c) => s + c.total, 0);
      rule = { needs: essenciais / income, wants: desejos / income, save: Math.max(0, (income - expense) / income) };
      if (rule.wants > 0.3) {
        add('tip', 'scale', 'Desejos acima de 30% da renda', `Pela regra 50/30/20, delivery, lazer, compras e assinaturas deveriam ficar em até 30% da renda. Hoje estão em ${pct(rule.wants)}.`, (desejos - 0.3 * income) / months, { umbrella: true });
      }
      if (rule.needs > 0.5) {
        add('info', 'house', 'Custos fixos pesados', `Gastos essenciais consomem ${pct(rule.needs)} da renda (ideal: até 50%). Renegociar aluguel, planos de internet/celular e seguros costuma dar resultado.`);
      }
    }

    // 3. Assinaturas e cobranças recorrentes
    const groups = {};
    expTx.forEach(t => (groups[t.key] ??= []).push(t));
    const subs = [];
    Object.values(groups).forEach(g => {
      const cat = g[0].category;
      const ms = new Set(g.map(t => monthKey(t.date))).size;
      const vals = g.map(t => -t.amount);
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      const sd = Math.sqrt(vals.reduce((s, v) => s + (v - avg) ** 2, 0) / vals.length);
      const regular = ms >= 2 && g.length <= ms + 1 && sd / avg < 0.12 && avg < 400;
      const eligible = cat === 'Assinaturas' || (regular && !['Moradia & Contas', 'Transferências', 'Educação', 'Taxas & Juros'].includes(cat));
      if (eligible) subs.push({ name: title(g[0].key), monthly: vals.reduce((a, b) => a + b, 0) / ms });
    });
    if (subs.length >= 2) {
      subs.sort((a, b) => b.monthly - a.monthly);
      const tot = subs.reduce((s, x) => s + x.monthly, 0);
      const list = subs.slice(0, 6).map(s => `${s.name} (${money(s.monthly)})`).join(', ');
      add('tip', 'repeat', `${subs.length} assinaturas somam ${money(tot)}/mês`, `${list}${subs.length > 6 ? '…' : ''}. São ${money(tot * 12)} por ano — cancelar as que você menos usa (cerca de 1/3) libera dinheiro sem esforço.`, tot / 3);
    }

    // 4. Gastos formiga
    const small = expTx.filter(t => -t.amount < 30 && (DESEJO.has(t.category) || t.category === 'Outros') && t.category !== 'Assinaturas');
    if (small.length / months >= 8) {
      const tot = -sum(small);
      add('tip', 'coffee', 'Gastos formiga', `${small.length} compras abaixo de R$ 30 somaram ${money(tot)}${months > 1 ? ` (${money(tot / months)}/mês)` : ''}. Sozinhas parecem nada; juntas pesam. Experimente um limite semanal para cafés e lanches.`, (tot * 0.4) / months);
    }

    // 5. Delivery
    const DELIV = /(^| )(ifood|rappi|uber eats|ubereats|aiqfome|ze delivery|99food|james)/;
    const deliv = expTx.filter(t => DELIV.test(Categorizer.clean(t.description)));
    const dTot = -sum(deliv);
    if (dTot / months > 150) {
      add('tip', 'bike', 'Delivery frequente', `${deliv.length} pedidos de delivery, ${money(dTot / months)}${months > 1 ? ' por mês' : ' no período'}. Trocar dois pedidos por semana por comida feita em casa corta cerca de metade disso.`, (dTot * 0.5) / months);
    }

    // 6. Juros e tarifas
    const fees = catMap['Taxas & Juros'];
    let hasJuros = false;
    if (fees) {
      const juros = fees.txs.filter(t => /juros|rotativo|mora|multa|encargo/.test(Categorizer.clean(t.description)));
      const tarifas = fees.txs.filter(t => !juros.includes(t));
      if (juros.length) {
        hasJuros = true;
        add('danger', 'flame', 'Você pagou juros', `${money(-sum(juros))} em juros e multas. Juros de cartão e cheque especial estão entre os mais caros do mercado: pagar a fatura integral é a economia mais rápida.`, -sum(juros) / months);
      }
      if (tarifas.length) {
        add('warning', 'receipt', 'Tarifas bancárias', `${money(-sum(tarifas))} em tarifas e anuidades. Muitos bancos digitais oferecem conta e cartão sem tarifa — vale negociar ou migrar.`, -sum(tarifas) / months);
      }
    }

    // 7. Gastos fora do padrão
    const anomalies = [];
    byCategory.forEach(c => {
      if (c.count < 4 || ['Transferências', 'Moradia & Contas'].includes(c.cat)) return;
      const med = median(c.txs.map(t => -t.amount));
      c.txs.forEach(t => { if (-t.amount > Math.max(med * 4, 250)) anomalies.push(t); });
    });
    anomalies.sort((a, b) => a.amount - b.amount);
    if (anomalies.length) {
      const desc = anomalies.slice(0, 3).map(t => `${title(t.key)}: ${money(-t.amount)} em ${pad(t.date.getDate())}/${pad(t.date.getMonth() + 1)}`).join(' · ');
      add('info', 'search', 'Gastos fora do padrão', `${desc}. Valores muito acima do seu normal nessa categoria — confira se foram planejados.`);
    }
    const anomIds = new Set(anomalies.map(t => t.id));

    // 8. Variação em relação aos meses anteriores
    const target = period === 'all' ? allMonths.at(-1) : period;
    const prevMs = allMonths.filter(m => m < target);
    if (target && prevMs.length) {
      const catTotal = ms => {
        const r = {};
        all.forEach(t => {
          if (t.amount < 0 && ms.includes(monthKey(t.date)) && !anomIds.has(t.id) && !['Investimentos', 'Transferências'].includes(t.category)) {
            r[t.category] = (r[t.category] || 0) - t.amount;
          }
        });
        return r;
      };
      const cur = catTotal([target]), prev = catTotal(prevMs);
      const rows = Object.keys({ ...cur, ...prev }).map(cat => {
        const avg = (prev[cat] || 0) / prevMs.length, c = cur[cat] || 0;
        return { cat, cur: c, avg, diff: c - avg };
      });
      const mName = MONTHS[+target.slice(5) - 1];
      rows.filter(x => x.avg > 50 && x.cur > x.avg * 1.3 && x.diff > 100)
        .sort((a, b) => b.diff - a.diff).slice(0, 2)
        .forEach(u => add('warning', 'trending-up', `${u.cat} subiu ${pct(u.cur / u.avg - 1)} em ${mName}`, `Foram ${money(u.cur)} contra uma média de ${money(u.avg)} nos meses anteriores. Voltar à média economiza ${money(u.diff)}.`, u.diff));
      const down = rows.filter(x => x.avg > 100 && x.cur < x.avg * 0.75 && x.avg - x.cur > 80).sort((a, b) => a.diff - b.diff)[0];
      if (down) add('success', 'trending-down', `${down.cat} caiu ${pct(1 - down.cur / down.avg)} em ${mName}`, `Você gastou ${money(down.cur)}, abaixo da média de ${money(down.avg)}. Boa — mantenha o ritmo.`);
    }

    // 9. Concentração em uma categoria
    const top = byCategory[0];
    if (top && top.share > 0.35 && top.cat !== 'Moradia & Contas') {
      add('info', 'chart-pie', `${top.cat} concentra ${pct(top.share)} dos gastos`, `É a maior fatia das suas despesas no período (${money(top.total)}). Qualquer ajuste aqui tem efeito grande no orçamento.`);
    }

    // 10. Fim de semana
    const disc = expTx.filter(t => DESEJO.has(t.category) && t.category !== 'Assinaturas');
    const discTot = -sum(disc);
    const wk = -sum(disc.filter(t => [0, 6].includes(t.date.getDay())));
    if (discTot > 300 && wk / discTot > 0.45) {
      add('info', 'calendar', 'Fim de semana caro', `${pct(wk / discTot)} dos gastos com lazer, delivery e compras acontecem no sábado e domingo. Um orçamento só para o fim de semana ajuda a segurar o impulso.`);
    }

    // 11. Investimentos e reserva
    if (invested > 0) {
      add('success', 'piggy-bank', 'Você está investindo', `${money(invested)} aplicados no período${income > 0 ? ` (${pct(invested / income)} da renda)` : ''}. Constância vale mais que valor: deixe o aporte no automático.`);
    } else if (balance > 0 && income > 0) {
      add('tip', 'shield-check', 'Monte sua reserva de emergência', `Sobraram ${money(balance)} no período. Uma reserva de 6 meses de despesas seria cerca de ${money((expense / months) * 6)} — separar a sobra todo mês é o primeiro passo.`);
    }

    // 12. Ajude o categorizador
    const outros = catMap['Outros'];
    if (outros && expense && outros.total / expense > 0.1) {
      add('info', 'brain', 'Me ajude a categorizar', `${outros.count} transações (${money(outros.total)}) ficaram em "Outros". Clique na categoria de uma transação para corrigir — eu aprendo e aplico às parecidas.`);
    }

    ins.sort((a, b) => (b.pin ? 1 : 0) - (a.pin ? 1 : 0) || ORDER[a.level] - ORDER[b.level] || b.saving - a.saving);
    const savings = ins.filter(i => !i.umbrella).reduce((s, i) => s + i.saving, 0);

    // ======================= SCORE =======================
    let score = 55;
    if (savingsRate != null) score += clamp((savingsRate - 0.1) * 200, -45, 30);
    if (rule && rule.wants > 0.3) score -= Math.min(20, (rule.wants - 0.3) * 100);
    if (hasJuros) score -= 10; else if (fees) score -= 4;
    if (invested > 0) score += 10;
    score = Math.round(clamp(score, 0, 100));

    return {
      income, expense, invested, balance, savingsRate, months,
      byCategory, byMonth, daily, insights: ins, savings, score, rule,
      incomeCount: txs.filter(t => t.amount > 0).length,
      expenseCount: expTx.length,
    };
  }

  return { analyze, monthKey };
})();
