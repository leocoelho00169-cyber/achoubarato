// Mercado Livre via API pública oficial (gratuita). Precisa criar um app em developers.mercadolivre.com.br
// para obter ML_CLIENT_ID e ML_CLIENT_SECRET.
import { config } from '../config.js';
import { fetchJson } from '../util.js';

let tokenCache = null;

async function token() {
  if (tokenCache) return tokenCache;
  const { clientId, clientSecret } = config.mercadoLivre;
  if (!clientId || !clientSecret) throw new Error('Faltam ML_CLIENT_ID / ML_CLIENT_SECRET');
  const body = new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret });
  const j = await fetchJson('https://api.mercadolibre.com/oauth/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body,
  });
  tokenCache = j.access_token;
  return tokenCache;
}

export async function buscarMercadoLivre(palavra, limite = 30) {
  const t = await token();
  const url = `https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(palavra)}&limit=${limite}&condition=new`;
  const j = await fetchJson(url, { headers: { Authorization: `Bearer ${t}`, Accept: 'application/json' } });
  return (j.results || []).map((r) => ({
    loja: 'Mercado Livre',
    produtoId: String(r.id),
    titulo: r.title,
    preco: Number(r.price),
    precoOriginal: r.original_price ? Number(r.original_price) : null,
    imagem: (r.thumbnail || '').replace('http://', 'https://').replace(/-I\.jpg$/, '-O.jpg'),
    url: r.permalink,
    linkAfiliado: null, // gerado em affiliate.js
    vendidos: r.sold_quantity || 0,
  })).filter((p) => p.preco);
}
