// Gera a descrição/legenda da oferta automaticamente (sem custo de API).
import { brl, escapeHtml, pick } from './util.js';

const CATEGORIAS = [
  { nome: 'tech', re: /(fone|bluetooth|smartwatch|relógio inteligente|carregador|cabo|tv|monitor|teclado|mouse|notebook|celular|caixa de som|power ?bank|webcam)/i,
    frases: ['Tecnologia com preço que não se vê todo dia 🔌', 'Pra quem gosta de gadget bom e barato 🎧', 'Upgrade no setup sem pesar no bolso 💻'] },
  { nome: 'casa', re: /(air ?fryer|cafeteira|panela|organizador|luminária|ventilador|liquidificador|aspirador|cama|toalha|jogo de|cozinha)/i,
    frases: ['Casa nova, preço bom! 🏠', 'Praticidade pra rotina da casa ✨', 'Item de casa com ótimo desconto 🍳'] },
  { nome: 'moda', re: /(tênis|tenis|camisa|camiseta|vestido|bolsa|mochila|calça|jaqueta|sandália|blusa|shorts|bermuda)/i,
    frases: ['Look novo sem estourar o orçamento 👟', 'Moda com desconto de verdade 👗', 'Estilo bom e preço melhor ainda ✨'] },
  { nome: 'beleza', re: /(perfume|hidratante|shampoo|maquiagem|batom|skincare|creme|secador|chapinha)/i,
    frases: ['Autocuidado com preço bom 💄', 'Beleza em promoção ✨'] },
];
const GENERICAS = ['🔥 Achadinho no ar!', '🚨 Olha esse preço!', '💥 Oferta que vale a pena conferir!', '🎯 Achou barato!', '🛍️ Promoção boa, corre!'];

export function categoriaDe(titulo = '') {
  return CATEGORIAS.find((c) => c.re.test(titulo)) || null;
}

function precoPorUnidade(titulo, preco) {
  const m = titulo.toLowerCase().match(/(\d+)\s*(unidades?|un\b|peças|pcs|pçs|kit)/);
  if (!m) return null;
  const q = parseInt(m[1], 10);
  return q > 1 && q <= 100 ? { q, un: preco / q } : null;
}

/**
 * @param {object} o  { titulo, loja, preco, precoOriginal, descricaoLoja, historico }
 *   historico: { menor, media, n } ou null
 * @returns {{legendaHtml:string, descricao:string}}
 *   descricao = texto simples (vai para o site); legendaHtml = para o Telegram
 */
export function gerarDescricao(o, seed) {
  const { titulo, loja, preco, precoOriginal, historico } = o;
  const cat = categoriaDe(titulo);
  const gancho = pick(cat ? cat.frases : GENERICAS, seed);

  const pontos = [];
  if (precoOriginal && precoOriginal > preco) {
    const pct = Math.round(((precoOriginal - preco) / precoOriginal) * 100);
    pontos.push(`📉 ${pct}% de desconto`);
  }
  if (historico && historico.n >= 3) {
    if (preco < historico.menor) pontos.push(`🏆 Menor preço que já registramos (antes: ${brl(historico.menor)})`);
    else if (preco <= historico.media * 0.85) pontos.push(`📊 Abaixo da média de ${brl(historico.media)} nos nossos registros`);
  }
  const u = precoPorUnidade(titulo, preco);
  if (u) pontos.push(`🧮 Sai a ${brl(u.un)} cada (${u.q} unidades)`);
  if (o.avaliacao && o.avaliacao >= 4.5) pontos.push(`⭐ Nota ${Number(o.avaliacao).toFixed(1)} dos compradores`);
  if (o.vendidos && o.vendidos >= 500) pontos.push(`🛒 +${o.vendidos} vendidos`);

  const descricao = [gancho.replace(/\s*[^\w\sÀ-ú.,!?%$()/-]+\s*$/u, ''), ...pontos.map((p) => p.replace(/^[^\wÀ-ú]+\s*/u, ''))]
    .filter(Boolean).join('. ') + '.';

  const legendaHtml = [
    gancho,
    '',
    `<b>${escapeHtml(titulo)}</b>`,
    precoOriginal && precoOriginal > preco ? `De <s>${brl(precoOriginal)}</s>` : null,
    `💰 <b>Por ${brl(preco)}</b>`,
    `🏪 ${escapeHtml(loja)}`,
    pontos.length ? '\n' + pontos.join('\n') : null,
    '\n⚠️ Preço e estoque podem mudar a qualquer momento.',
  ].filter((x) => x !== null).join('\n');

  return { descricao, legendaHtml };
}
