# FinSight: controle financeiro inteligente

Importa extratos bancários em **CSV ou PDF**, categoriza cada gasto automaticamente, gera insights com a economia estimada por mês e exporta um **relatório completo em PDF**.

## Como rodar

O projeto não tem etapa de build. Basta servir a pasta:

```bash
python -m http.server 5517
```

Depois abra http://localhost:5517 e clique em **"Ver com dados de exemplo"**, ou arraste o CSV do seu banco.

## Por que HTML + CSS + JavaScript

- **Interface com animações fluidas:** o navegador é a melhor plataforma para isso (CSS animations, Chart.js).
- **Privacidade:** o extrato é processado 100% no navegador e nada é enviado a nenhum servidor.
- **Zero instalação:** roda em qualquer computador ou celular.

Se um dia quiser machine learning de verdade (ex.: um classificador treinado com milhares de transações), o caminho é um backend em **Python (FastAPI + pandas + scikit-learn)** servindo esta mesma interface.

## Estrutura

| Arquivo | Função |
|---|---|
| `js/parser.js` | Lê o CSV: detecta delimitador, colunas, formatos BR/US, débito/crédito, fatura de cartão |
| `js/pdfreader.js` | Lê extratos em PDF (pdf.js): remonta as linhas e reconhece data, descrição e valor |
| `js/report.js` | Gera o relatório em PDF (jsPDF): KPIs, score, gráficos, 50/30/20, categorias, insights e transações |
| `js/categorizer.js` | Regras por palavra-chave + aprendizado com as correções do usuário (localStorage) |
| `js/insights.js` | Métricas, score de saúde financeira, regra 50/30/20 e geração de insights |
| `js/charts.js` | Gráficos (rosca, barras mensais, fluxo acumulado) |
| `js/app.js` | Fluxo da interface, filtros, menu de recategorização, exportação |
| `js/sample.js` | Gera um extrato de exemplo com 3 meses |

## Insights gerados

Taxa de poupança · regra 50/30/20 · assinaturas e cobranças recorrentes · gastos formiga · delivery · juros e tarifas · gastos fora do padrão · variação contra meses anteriores · concentração em uma categoria · gastos de fim de semana · investimentos e reserva de emergência.

## Formatos de CSV suportados

- Separadores `;` `,` tab `|`, codificação UTF-8 ou Latin-1
- Valores `1.234,56`, `1,234.56`, `(123,45)`, `123,45 D`
- Coluna única de valor, colunas separadas de Débito/Crédito, ou coluna Tipo (D/C)
- Linhas de cabeçalho/preâmbulo do banco e linhas de "SALDO" são ignoradas
- Fatura de cartão (ex.: Nubank `date,title,amount`) é detectada automaticamente

## Extratos em PDF

- Datas `05/10/2026`, `05/10` ou `05 OUT`; valores `1.234,56`, `-R$ 12,00`, `45,90 D`
- Linhas sem data herdam a data anterior (extratos agrupados por dia)
- Linhas de saldo, totais e limites são ignoradas; se o PDF não tiver sinais, entradas como salário e estorno viram receitas e o resto vira gasto
- **Limitações:** PDFs escaneados (imagem) e protegidos por senha não são lidos. Nesses casos, use o CSV. Como cada banco monta o PDF de um jeito, confira as transações depois de importar.
- O botão **"PDF de exemplo"** gera um extrato fictício para testar a importação.

## Relatório PDF

O botão **"Relatório PDF"** gera um arquivo A4 do período selecionado, com cabeçalho e score, KPIs, potencial de economia, os três gráficos, a regra 50/30/20, a tabela de categorias, todos os insights e a lista completa de transações.
