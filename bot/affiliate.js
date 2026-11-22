// Monta o link de afiliado de cada loja.
import { config } from './config.js';
import { fetchJson, sha256 } from './util.js';

const SHOPEE_ENDPOINT = 'https://open-api.affiliate.shopee.com.br/graphql';

export async function shopeeGraphql(query) {
  const { appId, secret } = config.shopee;
  if (!appId || !secret) throw new Error('Faltam SHOPEE_APP_ID / SHOPEE_SECRET');
  const payload = JSON.stringify({ query });
  const ts = Math.floor(Date.now() / 1000);
  const signature = sha256(`${appId}${ts}${payload}${secret}`);
  const json = await fetchJson(SHOPEE_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `SHA256 Credential=${appId}, Timestamp=${ts}, Signature=${signature}`,
    },
    body: payload,
  });
  if (json?.errors?.length) throw new Error('Shopee API: ' + JSON.stringify(json.errors[0]));
  return json.data;
}

// Shopee: converte QUALQUER url de produto em link curto de afiliado (s.shopee.com.br/...)
async function shopeeShortLink(url) {
  const q = `mutation { generateShortLink(input: { originUrl: ${JSON.stringify(url)}, subIds: ["achoubarato"] }) { shortLink } }`;
  const data = await shopeeGraphql(q);
  return data?.generateShortLink?.shortLink || null;
}

function templateLink(template, url) {
  if (!template) return null;
  return template.replaceAll('{url_enc}', encodeURIComponent(url)).replaceAll('{url}', url);
}

/**
 * Retorna { link, ok }. ok=false quando NÃO foi possível gerar link de afiliado
 * (nesse caso o robô não publica, para você nunca divulgar link sem comissão).
 */
export async function gerarLinkAfiliado(loja, urlOriginal, linkJaAfiliado = null) {
  try {
    if (loja === 'Shopee') {
      // a API de busca já devolve offerLink (afiliado); para URL colada geramos o curto
      const link = linkJaAfiliado || (await shopeeShortLink(urlOriginal));
      return { link, ok: !!link };
    }
    if (loja === 'Mercado Livre') {
      // O Mercado Livre não tem API de afiliados e proíbe editar o link gerado na Central de Afiliados.
      // Por isso só usamos um link que você gerou lá (cadastrado no Admin); o robô nunca monta link ML sozinho.
      return { link: linkJaAfiliado, ok: !!linkJaAfiliado };
    }
    if (loja === 'Shein') {
      const link = templateLink(config.sheinTemplate, urlOriginal);
      return { link, ok: !!link };
    }
  } catch (e) {
    console.warn(`[afiliado] ${loja}: ${e.message}`);
  }
  return { link: null, ok: false };
}
