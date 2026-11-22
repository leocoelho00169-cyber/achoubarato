// Shopee via API oficial de afiliados (gratuita; precisa de AppID e Secret do painel de Afiliados Shopee).
import { shopeeGraphql } from '../affiliate.js';
import { toNumber } from '../util.js';

export async function buscarShopee(palavra, limite = 20) {
  const q = `query { productOfferV2(keyword: ${JSON.stringify(palavra)}, sortType: 2, page: 1, limit: ${limite}) {
    nodes { itemId productName priceMin priceMax imageUrl offerLink productLink ratingStar sales priceDiscountRate shopName }
  } }`;
  const data = await shopeeGraphql(q);
  const nodes = data?.productOfferV2?.nodes || [];
  return nodes.map((n) => {
    const preco = toNumber(n.priceMin);
    const desc = Number(n.priceDiscountRate) || 0;
    const original = desc > 0 && preco ? Math.round((preco / (1 - desc / 100)) * 100) / 100 : null;
    return {
      loja: 'Shopee',
      produtoId: String(n.itemId),
      titulo: n.productName,
      preco,
      precoOriginal: original,
      imagem: n.imageUrl,
      url: n.productLink,
      linkAfiliado: n.offerLink, // já é link de afiliado
      avaliacao: toNumber(n.ratingStar),
      vendidos: Number(n.sales) || 0,
    };
  }).filter((p) => p.preco);
}
