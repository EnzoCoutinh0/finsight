/* ==========================================================================
   Categorizador inteligente
   - Regras por palavra-chave (comerciantes brasileiros comuns)
   - Aprende com as correções do usuário (salvas no navegador)
   ========================================================================== */
const Categorizer = (() => {
  const CATEGORIES = {
    'Receitas':         { color: '#34d399', icon: 'wallet' },
    'Alimentação':      { color: '#f59e0b', icon: 'utensils' },
    'Mercado':          { color: '#a3e635', icon: 'shopping-cart' },
    'Transporte':       { color: '#38bdf8', icon: 'car' },
    'Moradia & Contas': { color: '#818cf8', icon: 'house' },
    'Saúde':            { color: '#f472b6', icon: 'heart-pulse' },
    'Educação':         { color: '#22d3ee', icon: 'graduation-cap' },
    'Assinaturas':      { color: '#c084fc', icon: 'repeat' },
    'Lazer':            { color: '#fb7185', icon: 'gamepad-2' },
    'Compras':          { color: '#fb923c', icon: 'shopping-bag' },
    'Taxas & Juros':    { color: '#ef4444', icon: 'receipt' },
    'Investimentos':    { color: '#e9b949', icon: 'piggy-bank' },
    'Transferências':   { color: '#94a3b8', icon: 'arrow-left-right' },
    'Outros':           { color: '#64748b', icon: 'circle-help' },
  };

  // A ordem importa: a primeira regra que casar vence.
  const RULES = [
    ['Taxas & Juros', ['tarifa', 'tar', 'pacote', 'anuidade', 'juros', 'iof', 'multa', 'encargo', 'mora', 'cesta de servicos', 'pacote servicos', 'rotativo', 'taxa de manutencao', 'taxa']],
    ['Investimentos', ['aplicacao', 'cdb', 'lci', 'lca', 'tesouro', 'corretora', 'xp invest', 'nuinvest', 'btg', 'rico', 'clear', 'poupanca', 'fundo de invest', 'previdencia', 'invest']],
    ['Assinaturas', ['netflix', 'spotify', 'amazon prime', 'prime video', 'disney', 'hbo', 'max', 'globoplay', 'youtube premium', 'youtube', 'google one', 'google storage', 'icloud', 'apple com', 'deezer', 'paramount', 'crunchyroll', 'chatgpt', 'openai', 'microsoft', 'adobe', 'xbox', 'playstation', 'psn', 'star plus', 'telecine', 'tidal', 'canva', 'dropbox', 'assinatura']],
    ['Alimentação', ['ifood', 'rappi', 'uber eats', 'ubereats', 'aiqfome', 'ze delivery', '99food', 'james delivery', 'restaurante', 'lanchonete', 'padaria', 'panificadora', 'confeitaria', 'pizzaria', 'pizza', 'burger', 'hamburg', 'mcdonald', 'mc donald', 'burger king', 'subway', 'habib', 'giraffas', 'outback', 'starbucks', 'cafe', 'cafeteria', 'sushi', 'churrasc', 'acai', 'sorveteria', 'lanche', 'bistro', 'pastelaria', 'doceria', 'espetinho']],
    ['Compras', ['mercado livre', 'mercadolivre', 'mercadolibre', 'shopee', 'aliexpress', 'shein', 'amazon', 'magalu', 'magazine luiza', 'americanas', 'casas bahia', 'ponto frio', 'renner', 'riachuelo', 'c&a', 'zara', 'hering', 'centauro', 'netshoes', 'kabum', 'pichau', 'leroy', 'decathlon', 'dafiti', 'havan', 'tok stok', 'fast shop', 'samsung', 'loja', 'shopping', 'boticario', 'natura', 'sephora']],
    ['Mercado', ['supermercado', 'supermercados', 'mercado', 'mercearia', 'hipermercado', 'carrefour', 'pao de acucar', 'extra', 'assai', 'atacadao', 'atacadista', 'big', 'hortifruti', 'sacolao', 'dia', 'sams club', 'makro', 'oba', 'sonda', 'zaffari', 'condor', 'savegnago', 'guanabara', 'prezunic', 'st marche', 'emporio', 'acougue']],
    ['Transporte', ['uber', '99app', '99 app', '99pop', 'cabify', 'indriver', 'posto', 'shell', 'ipiranga', 'petrobras', 'combustivel', 'gasolina', 'etanol', 'estacionamento', 'estapar', 'zona azul', 'sem parar', 'conectcar', 'veloe', 'pedagio', 'metro', 'bilhete unico', 'sptrans', 'onibus', 'cptm', 'localiza', 'movida', 'unidas', 'detran', 'ipva', 'mecanica', 'auto pecas', 'lava rapido', '99']],
    ['Moradia & Contas', ['aluguel', 'condominio', 'enel', 'light', 'cemig', 'copel', 'celesc', 'coelba', 'neoenergia', 'energisa', 'cpfl', 'equatorial', 'energia', 'sabesp', 'cedae', 'copasa', 'sanepar', 'embasa', 'agua', 'comgas', 'naturgy', 'gas', 'iptu', 'internet', 'vivo', 'claro', 'tim', 'oi', 'sky', 'imobiliaria', 'quintoandar', 'quinto andar']],
    ['Saúde', ['farmacia', 'drogaria', 'droga raia', 'drogasil', 'pague menos', 'panvel', 'pacheco', 'hospital', 'clinica', 'laboratorio', 'unimed', 'amil', 'sulamerica', 'bradesco saude', 'hapvida', 'notredame', 'dentista', 'odonto', 'consulta', 'medico', 'psicolog', 'fisioterap', 'academia', 'smartfit', 'smart fit', 'bluefit', 'bodytech', 'gympass', 'wellhub', 'totalpass', 'otica']],
    ['Educação', ['escola', 'colegio', 'faculdade', 'universidade', 'curso', 'udemy', 'alura', 'coursera', 'duolingo', 'livraria', 'livros', 'mensalidade escolar', 'ingles', 'idiomas', 'papelaria', 'rocketseat', 'hotmart']],
    ['Lazer', ['cinema', 'cinemark', 'kinoplex', 'ingresso', 'sympla', 'eventim', 'ticket', 'steam', 'nintendo', 'show', 'teatro', 'museu', 'parque', 'viagem', 'hotel', 'pousada', 'airbnb', 'booking', 'decolar', 'latam', 'gol', 'azul', 'cvc', 'bar', 'pub', 'boteco', 'balada', 'clube', 'boliche']],
    ['Transferências', ['pix enviado', 'pix transf', 'pix', 'transferencia', 'transf', 'ted', 'doc', 'pagamento fatura', 'pgto fatura', 'pag fatura', 'fatura cartao', 'saque', 'boleto']],
  ];

  const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Palavras curtas exigem palavra inteira; longas aceitam prefixo ("churrasc" → "churrascaria")
  const COMPILED = RULES.map(([cat, kws]) => [cat, kws.map(k =>
    new RegExp(`(^|[^a-z0-9])${escRe(k)}${k.length <= 5 ? '(?![a-z0-9])' : ''}`))]);

  const clean = s => Parser.norm(s).replace(/[^a-z0-9& ]+/g, ' ').replace(/\s+/g, ' ').trim();

  const PREFIX = /^(compra (no |com )?(cartao|debito|credito)( de)?|compra|pagamento( de)?( boleto)?|pagto|pgto|pag|pix (enviado|recebido|transf|qrs|qr code)|pix|transferencia (enviada|recebida)( pix)?|transf|ted|doc|debito automatico|deb aut|deb|cred|cartao|visa|elo|mastercard|master|electron|int|nacional)\s+/;

  /** Chave que identifica o "comerciante" de forma estável entre transações. */
  function merchantKey(desc) {
    let s = clean(desc), prev;
    do { prev = s; s = s.replace(PREFIX, ''); } while (s !== prev);
    const words = s.split(' ').filter(w => w && !/^\d+$/.test(w));
    return (words.slice(0, 2).join(' ') || clean(desc)).slice(0, 40);
  }

  const STORE = 'finsight.rules.v1';
  let learned = {};
  try { learned = JSON.parse(localStorage.getItem(STORE)) || {}; } catch { learned = {}; }
  const save = () => { try { localStorage.setItem(STORE, JSON.stringify(learned)); } catch { /* armazenamento indisponível */ } };
  const signed = (amount, key) => (amount > 0 ? '+' : '-') + key;

  function categorize(tx) {
    const key = merchantKey(tx.description);
    const learnedCat = learned[signed(tx.amount, key)];
    if (learnedCat && CATEGORIES[learnedCat]) return { category: learnedCat, source: 'learned', key };
    if (tx.amount > 0) return { category: 'Receitas', source: 'rule', key };
    const c = clean(tx.description);
    for (const [cat, regs] of COMPILED) {
      if (regs.some(r => r.test(c))) return { category: cat, source: 'rule', key };
    }
    return { category: 'Outros', source: 'default', key };
  }

  function learn(tx, category) {
    learned[signed(tx.amount, tx.key)] = category;
    save();
  }

  const learnedCount = () => Object.keys(learned).length;
  function resetLearned() { learned = {}; save(); }

  return { CATEGORIES, categorize, learn, merchantKey, clean, learnedCount, resetLearned };
})();
