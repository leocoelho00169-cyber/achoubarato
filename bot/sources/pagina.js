// Lê QUALQUER página de produto (Shein, Shopee, ML...) pelos metadados públicos (JSON-LD / Open Graph).
// Usado para a fila de links que você cola (tabela fila_links). Sem custo.
import { toNumber } from '../util.js';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

export function detectarLoja(url) {
  const h = new URL(url).hostname.toLowerCase();
  if (h.includes('shein')) return 'Shein';
  if (h.includes('shopee') || h.includes('shope.ee')) return 'Shopee';
  if (h.includes('mercadolivre') || h.includes('mercadolibre') || h.includes('meli.la')) return 'Mercado Livre';
  return null;
}

const meta = (html, prop) => {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*)["']`, 'i');
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${prop}["']`, 'i');
  return (html.match(re) || html.match(re2) || [])[1] || null;
};
const decode = (s) => s && s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

function jsonLdProduto(html) {
  const blocos = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)];
  for (const b of blocos) {
    try {
      const j = JSON.parse(b[1]);
      const lista = Array.isArray(j) ? j : j['@graph'] || [j];
      const prod = lista.find((x) => x && (x['@type'] === 'Product' || (Array.isArray(x['@type']) && x['@type'].includes('Product'))));
      if (prod) return prod;
    } catch { /* ignora bloco inválido */ }
  }
  return null;
}

export async function lerPagina(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'pt-BR,pt;q=0.9' }, redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status} ao abrir a página`);
  const html = await res.text();
  const finalUrl = res.url || url;
  const ld = jsonLdProduto(html);
  const oferta = ld ? (Array.isArray(ld.offers) ? ld.offers[0] : ld.offers) : null;

  const titulo = decode(ld?.name || meta(html, 'og:title') || (html.match(/<title>([^<]*)<\/title>/i) || [])[1]);
  const preco = toNumber(oferta?.price ?? oferta?.lowPrice ?? meta(html, 'product:price:amount') ?? meta(html, 'og:price:amount'));
  const imagemLd = Array.isArray(ld?.image) ? ld.image[0] : ld?.image;
  let imagem = imagemLd || meta(html, 'og:image');
  if (imagem && imagem.startsWith('//')) imagem = 'https:' + imagem;

  if (!titulo || !preco) {
    throw new Error('Não consegui ler título/preço desta página (a loja pode bloquear robôs). Cadastre manualmente no Admin.');
  }
  const id = (finalUrl.match(/(?:-p-|\/p\/|i\.\d+\.|MLB-?)(\d{5,})/) || [])[1] || String(Math.abs(hash(finalUrl)));
  return {
    loja: detectarLoja(finalUrl),
    produtoId: id,
    titulo: titulo.slice(0, 180),
    preco,
    precoOriginal: null,
    imagem,
    url: finalUrl,
    descricaoLoja: decode(ld?.description || meta(html, 'og:description') || '') || null,
  };
}

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}
