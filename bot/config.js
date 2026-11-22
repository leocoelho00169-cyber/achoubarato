// Ajuste aqui o comportamento do robô. Segredos NÃO ficam aqui: vão em GitHub > Settings > Secrets.
const env = process.env;
const num = (v, d) => (v !== undefined && v !== '' && !Number.isNaN(Number(v)) ? Number(v) : d);

export const config = {
  dryRun: env.DRY_RUN === '1' || env.DRY_RUN === 'true', // 1 = não publica nem envia, só mostra no log

  maxPorExecucao: num(env.MAX_POR_EXECUCAO, 8),   // quantas ofertas publicar por rodada
  precoMaximo: num(env.PRECO_MAXIMO, 0),          // 0 = sem limite
  descontoMinimo: num(env.DESCONTO_MINIMO, 20),   // % mínimo para considerar oferta
  diasSemRepetir: num(env.DIAS_SEM_REPETIR, 5),   // mesmo produto não volta antes disso
  pausaEntreEnvios: num(env.PAUSA_ENTRE_ENVIOS_MS, 4000),

  // O que procurar em cada loja. Edite à vontade.
  buscas: {
    Shopee: ['fone bluetooth', 'smartwatch', 'air fryer', 'organizador', 'carregador turbo', 'luminária led'],
    'Mercado Livre': ['fone bluetooth', 'smart tv', 'cafeteira', 'ventilador', 'tênis', 'mochila'],
  },

  // Produtos com estes termos são ignorados (minúsculas)
  termosBloqueados: ['usado', 'recondicionado', 'réplica', 'replica', 'paródia', 'adulto', 'sexshop', 'vape', 'cigarro'],

  telegram: {
    token: env.TELEGRAM_BOT_TOKEN,
    chatId: env.TELEGRAM_CHAT_ID, // ex.: @seu_canal ou -100123456789
  },

  supabase: {
    // aceita o endereço com "/" no fim, com "/rest/v1" ou com espaços colados por engano
    url: (env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || '').trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, ''),
    serviceKey: (env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
  },

  shopee: { appId: env.SHOPEE_APP_ID, secret: env.SHOPEE_SECRET },

  mercadoLivre: {
    clientId: env.ML_CLIENT_ID,
    clientSecret: env.ML_CLIENT_SECRET,
  },

  // Shein e outras lojas: modelo do link de afiliado com {url} (URL do produto) e/ou {url_enc} (codificada).
  // Ex. Awin: https://www.awin1.com/cread.php?awinmid=XXXX&awinaffid=SEU_ID&ued={url_enc}
  sheinTemplate: env.SHEIN_LINK_TEMPLATE,
};
