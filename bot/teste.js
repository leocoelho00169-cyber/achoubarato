// Teste offline: node bot/teste.js  (não usa internet nem credenciais)
import assert from 'node:assert/strict';
process.env.SHEIN_LINK_TEMPLATE = 'https://www.awin1.com/cread.php?awinmid=1&awinaffid=9&ued={url_enc}';
process.env.SHOPEE_APP_ID = 'x'; process.env.SHOPEE_SECRET = 'y';
process.env.ML_CLIENT_ID = 'x'; process.env.ML_CLIENT_SECRET = 'y';
process.env.PAUSA_ENTRE_ENVIOS_MS = '0';

const { executar, bloqueado } = await import('./run.js');
const { gerarLinkAfiliado } = await import('./affiliate.js');
const { gerarDescricao } = await import('./copy.js');
const { toNumber } = await import('./util.js');

// util
assert.equal(toNumber('R$ 1.299,90'), 1299.9);
assert.equal(toNumber('49.9'), 49.9);

// afiliado
const ml = await gerarLinkAfiliado('Mercado Livre', 'https://produto.mercadolivre.com.br/MLB-123-x');
assert.equal(ml.ok, false);                                   // nunca monta link ML sozinho
const ml2 = await gerarLinkAfiliado('Mercado Livre', 'https://produto.mercadolivre.com.br/MLB-123-x', 'https://meli.la/abc');
assert.ok(ml2.ok && ml2.link === 'https://meli.la/abc');
const sh = await gerarLinkAfiliado('Shein', 'https://br.shein.com/a-p-1.html');
assert.ok(sh.ok && sh.link.includes('ued=https%3A%2F%2Fbr.shein.com'));
const sp = await gerarLinkAfiliado('Shopee', 'https://shopee.com.br/x', 'https://s.shopee.com.br/abc');
assert.equal(sp.link, 'https://s.shopee.com.br/abc');
assert.equal((await gerarLinkAfiliado('Amazon', 'https://amazon.com.br/x')).ok, false);

// descrição
const d = gerarDescricao({ titulo: 'Organizadores Casa 10 unidades', loja: 'Shopee', preco: 50, precoOriginal: 100,
  historico: { n: 5, menor: 60, media: 90 }, avaliacao: 4.8, vendidos: 1200 }, 1);
assert.match(d.legendaHtml, /50% de desconto/);
assert.match(d.legendaHtml, /Menor preço/);
assert.match(d.legendaHtml, /R\$\s?5,00 cada/);
assert.ok(d.descricao.length > 20 && !/<[a-z]/.test(d.descricao));

// bloqueio
assert.ok(bloqueado('Celular USADO bom'));

// fluxo completo com fakes
const publicadas = [], enviadas = [], marcadas = [], historico = [], filaAtualizada = [];
const deps = {
  telegramOk: true,
  buscarShopee: async () => [
    { loja: 'Shopee', produtoId: '1', titulo: 'Fone Bluetooth X', preco: 40, precoOriginal: 80, imagem: 'https://i/1.jpg', url: 'https://shopee.com.br/1', linkAfiliado: 'https://s.shopee.com.br/1' },
    { loja: 'Shopee', produtoId: '2', titulo: 'Coisa sem desconto', preco: 99, precoOriginal: 100, imagem: 'https://i/2.jpg', url: 'https://shopee.com.br/2', linkAfiliado: 'https://s.shopee.com.br/2' },
    { loja: 'Shopee', produtoId: '3', titulo: 'Celular usado', preco: 10, precoOriginal: 100, imagem: 'x', url: 'https://shopee.com.br/3', linkAfiliado: 'https://s.shopee.com.br/3' },
    { loja: 'Shopee', produtoId: '4', titulo: 'Já postado ontem', preco: 10, precoOriginal: 100, imagem: 'x', url: 'https://shopee.com.br/4', linkAfiliado: 'https://s.shopee.com.br/4' },
  ],
  buscarMercadoLivre: async () => [
    { loja: 'Mercado Livre', produtoId: 'MLB9', titulo: 'Air Fryer 4L', preco: 200, precoOriginal: 400, imagem: 'https://i/9.jpg', url: 'https://produto.mercadolivre.com.br/MLB-9', linkAfiliado: 'https://meli.la/xyz' },
  ],
  lerPagina: async (url) => ({ loja: null, produtoId: 'S1', titulo: 'Vestido Shein', preco: 59.9, precoOriginal: null, imagem: 'https://i/s.jpg', url }),
  gerarLinkAfiliado,
  enviarOferta: async (o) => { enviadas.push(o); },
  pausaBusca: 0,
  db: {
    expirarAntigas: async () => {},
    linksPendentes: async () => [{ id: 7, url: 'https://br.shein.com/vestido-p-1.html', loja: 'Shein' }],
    atualizarLink: async (id, c) => filaAtualizada.push([id, c]),
    jaPublicadoRecentemente: async (l, id) => id === '4',
    estatisticasPreco: async () => null,
    registrarPreco: async (...a) => historico.push(a),
    inserirOferta: async (o) => { publicadas.push(o); return { id: publicadas.length }; },
    marcar: async (id, c) => marcadas.push([id, c]),
  },
};
const stats = await executar(deps);

assert.equal(stats.publicadas, 3, JSON.stringify(stats));      // Shein (fila) + Fone + Air Fryer
assert.equal(publicadas.length, 3);
assert.equal(enviadas.length, 3);
assert.equal(publicadas[0].loja, 'Shein');                      // fila manual vem primeiro
assert.ok(publicadas.every((p) => p.descricao && p.link_afiliado && p.imagem_url));
assert.equal(publicadas.find((p) => p.loja === 'Mercado Livre').link_afiliado, 'https://meli.la/xyz');
assert.deepEqual(filaAtualizada, [[7, { status: 'publicado' }]]);
assert.equal(historico.length, 3);
// ofertas cadastradas no Admin (ex.: Shopee sem API) -> descrição + Telegram
const env2 = [], marc2 = [];
const st2 = await executar({
  telegramOk: true, pausaBusca: 0, buscarShopee: async () => [], buscarMercadoLivre: async () => [],
  lerPagina: async () => { throw new Error('nao deveria ler'); }, gerarLinkAfiliado,
  enviarOferta: async (o) => { env2.push(o); },
  db: {
    expirarAntigas: async () => {}, linksPendentes: async () => [], atualizarLink: async () => {},
    jaPublicadoRecentemente: async () => false, estatisticasPreco: async () => null,
    manuaisPendentes: async () => [{ id: 42, titulo: 'Fone Bluetooth Shopee', loja: 'Shopee', preco_oferta: 39.9, preco_original: 79.9,
      link_afiliado: 'https://s.shopee.com.br/meulink', imagem_url: 'https://i/f.jpg', descricao: null }],
    marcar: async (id, c) => marc2.push([id, c]),
  },
});
assert.equal(st2.manuais, 1);
assert.equal(env2.length, 1);
assert.equal(env2[0].link, 'https://s.shopee.com.br/meulink');
assert.ok(marc2.some(([id, c]) => id === 42 && c.descricao));
assert.ok(marc2.some(([id, c]) => id === 42 && c.enviado_telegram === true));
console.log('\nTODOS OS TESTES PASSARAM ✅');
