// Acesso ao Supabase via REST (PostgREST), sem biblioteca. Usa a chave service_role (só no GitHub Secrets).
import { config } from './config.js';
import { fetchJson } from './util.js';

function headers(extra = {}) {
  const k = config.supabase.serviceKey;
  return { apikey: k, Authorization: `Bearer ${k}`, 'Content-Type': 'application/json', ...extra };
}
const base = () => `${config.supabase.url}/rest/v1`;

export function dbConfigurado() {
  return !!(config.supabase.url && config.supabase.serviceKey);
}

export async function jaPublicadoRecentemente(loja, produtoId, dias) {
  const desde = new Date(Date.now() - dias * 86400000).toISOString();
  const q = `${base()}/ofertas?select=id&loja=eq.${encodeURIComponent(loja)}&produto_id=eq.${encodeURIComponent(produtoId)}&created_at=gte.${desde}&limit=1`;
  const rows = await fetchJson(q, { headers: headers() });
  return rows.length > 0;
}

export async function estatisticasPreco(loja, produtoId) {
  const q = `${base()}/historico_precos?select=preco&loja=eq.${encodeURIComponent(loja)}&produto_id=eq.${encodeURIComponent(produtoId)}&order=created_at.desc&limit=90`;
  const rows = await fetchJson(q, { headers: headers() });
  if (!rows.length) return null;
  const ps = rows.map((r) => Number(r.preco));
  return { n: ps.length, menor: Math.min(...ps), media: ps.reduce((a, b) => a + b, 0) / ps.length };
}

export async function registrarPreco(loja, produtoId, titulo, preco) {
  await fetchJson(`${base()}/historico_precos`, {
    method: 'POST', headers: headers({ Prefer: 'return=minimal' }),
    body: JSON.stringify({ loja, produto_id: produtoId, titulo, preco }),
  });
}

export async function inserirOferta(o) {
  const rows = await fetchJson(`${base()}/ofertas`, {
    method: 'POST', headers: headers({ Prefer: 'return=representation' }),
    body: JSON.stringify({ ...o, cliques: 0, ativa: true, origem: 'robo', enviado_telegram: false, enviado_whatsapp: false }),
  });
  return rows[0];
}

export async function marcar(id, campos) {
  await fetchJson(`${base()}/ofertas?id=eq.${id}`, {
    method: 'PATCH', headers: headers({ Prefer: 'return=minimal' }), body: JSON.stringify(campos),
  });
}

// Ofertas cadastradas à mão no Admin (últimas 24h) que ainda não foram para o Telegram.
export async function manuaisPendentes(limite = 10) {
  const desde = new Date(Date.now() - 24 * 3600000).toISOString();
  return fetchJson(`${base()}/ofertas?select=*&origem=eq.manual&ativa=eq.true&enviado_telegram=eq.false&created_at=gte.${desde}&order=created_at.asc&limit=${limite}`, { headers: headers() });
}

export async function linksPendentes(limite = 10) {
  return fetchJson(`${base()}/fila_links?select=*&status=eq.pendente&order=created_at.asc&limit=${limite}`, { headers: headers() });
}

export async function atualizarLink(id, campos) {
  await fetchJson(`${base()}/fila_links?id=eq.${id}`, {
    method: 'PATCH', headers: headers({ Prefer: 'return=minimal' }), body: JSON.stringify(campos),
  });
}

// Desativa ofertas do robô com mais de N dias, para a vitrine não ficar com preço velho.
export async function expirarAntigas(dias = 3) {
  const antes = new Date(Date.now() - dias * 86400000).toISOString();
  await fetchJson(`${base()}/ofertas?origem=eq.robo&ativa=eq.true&created_at=lt.${antes}`, {
    method: 'PATCH', headers: headers({ Prefer: 'return=minimal' }), body: JSON.stringify({ ativa: false }),
  });
}
