// Orquestra tudo: busca -> filtra -> link de afiliado -> descrição -> site (Supabase) -> Telegram.
// Uso: node bot/run.js          (DRY_RUN=1 para simular sem publicar)
import { config } from './config.js';
import { gerarLinkAfiliado } from './affiliate.js';
import { gerarDescricao } from './copy.js';
import * as db from './db.js';
import { enviarOferta, telegramConfigurado } from './telegram.js';
import { buscarShopee } from './sources/shopee.js';
import { buscarMercadoLivre } from './sources/mercadolivre.js';
import { lerPagina, detectarLoja } from './sources/pagina.js';
import { sleep } from './util.js';

export function bloqueado(titulo) {
  const t = (titulo || '').toLowerCase();
  return config.termosBloqueados.some((x) => t.includes(x));
}

export function descontoPct(c) {
  return c.precoOriginal && c.precoOriginal > c.preco ? ((c.precoOriginal - c.preco) / c.precoOriginal) * 100 : 0;
}

/** Coleta candidatos de todas as fontes; erro numa fonte não derruba as outras. */
async function coletar(deps) {
  const todos = [];
  const fontes = [
    ['Shopee', deps.buscarShopee, config.shopee.appId && config.shopee.secret],
    ['Mercado Livre', deps.buscarMercadoLivre, config.mercadoLivre.clientId && config.mercadoLivre.clientSecret],
  ];
  for (const [loja, fn, ativa] of fontes) {
    if (!ativa) { console.log(`[${loja}] sem credenciais, pulando.`); continue; }
    for (const palavra of config.buscas[loja] || []) {
      try {
        const r = await fn(palavra);
        console.log(`[${loja}] "${palavra}": ${r.length} resultados`);
        todos.push(...r);
      } catch (e) {
        console.warn(`[${loja}] "${palavra}" falhou: ${e.message}`);
      }
      await sleep(deps.pausaBusca ?? 500);
    }
  }
  return todos;
}

/** Links colados por você (Shein etc.) viram candidatos prioritários. */
async function coletarFila(deps) {
  const out = [];
  const fila = await deps.db.linksPendentes(10).catch((e) => { console.warn('[fila] ' + e.message); return []; });
  for (const item of fila) {
    try {
      const p = await deps.lerPagina(item.url);
      p.loja = item.loja || p.loja || detectarLoja(item.url);
      if (!p.loja) throw new Error('Loja não reconhecida. Preencha a coluna "loja".');
      p.filaId = item.id;
      p.manual = true;
      out.push(p);
    } catch (e) {
      console.warn(`[fila] ${item.url}: ${e.message}`);
      await deps.db.atualizarLink(item.id, { status: 'erro', erro: e.message.slice(0, 300) });
    }
  }
  return out;
}

/** Ofertas cadastradas por você no Admin: o robô cria a descrição e envia ao Telegram. */
async function processarManuais(deps, stats) {
  if (!deps.db.manuaisPendentes) return;
  const lista = await deps.db.manuaisPendentes(10).catch((e) => { console.warn('[manuais] ' + e.message); return []; });
  for (const o of lista) {
    try {
      const { descricao, legendaHtml } = gerarDescricao({
        titulo: o.titulo, loja: o.loja, preco: Number(o.preco_oferta),
        precoOriginal: o.preco_original ? Number(o.preco_original) : null, historico: null,
      }, String(o.id).length);
      if (config.dryRun) {
        console.log('\n--- [DRY RUN] enviaria oferta manual ---\n' + legendaHtml + '\nlink: ' + o.link_afiliado);
        stats.manuais++; continue;
      }
      if (!o.descricao) await deps.db.marcar(o.id, { descricao });
      if (deps.telegramOk) {
        await deps.enviarOferta({ legendaHtml, link: o.link_afiliado, imagem: o.imagem_url });
        await deps.db.marcar(o.id, { enviado_telegram: true });
      }
      stats.manuais++;
      console.log(`✅ (manual) ${o.loja}: ${o.titulo.slice(0, 70)}`);
      await sleep(config.pausaEntreEnvios);
    } catch (e) {
      stats.erros++;
      console.warn(`❌ manual ${o.id}: ${e.message}`);
    }
  }
}

export async function executar(deps) {
  const stats = { publicadas: 0, ignoradas: 0, erros: 0, manuais: 0 };
  const dry = config.dryRun;

  if (!dry) await deps.db.expirarAntigas(3).catch((e) => console.warn('[expirar] ' + e.message));
  await processarManuais(deps, stats);

  const candidatos = [...(await coletarFila(deps)), ...(await coletar(deps))];
  // melhores descontos primeiro; links colados à mão sempre na frente
  candidatos.sort((a, b) => (b.manual ? 1 : 0) - (a.manual ? 1 : 0) || descontoPct(b) - descontoPct(a) || (b.vendidos || 0) - (a.vendidos || 0));

  const vistos = new Set();
  for (const c of candidatos) {
    if (stats.publicadas >= config.maxPorExecucao) break;
    const chave = `${c.loja}:${c.produtoId}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);

    try {
      if (bloqueado(c.titulo)) { stats.ignoradas++; continue; }
      if (config.precoMaximo && c.preco > config.precoMaximo) { stats.ignoradas++; continue; }
      if (await deps.db.jaPublicadoRecentemente(c.loja, c.produtoId, config.diasSemRepetir)) { stats.ignoradas++; continue; }

      const historico = await deps.db.estatisticasPreco(c.loja, c.produtoId);
      const bateuHistorico = historico && historico.n >= 3 && (c.preco < historico.menor || c.preco <= historico.media * 0.85);
      if (!c.manual && descontoPct(c) < config.descontoMinimo && !bateuHistorico) { stats.ignoradas++; continue; }

      const { link, ok } = await deps.gerarLinkAfiliado(c.loja, c.url, c.linkAfiliado);
      if (!ok) {
        console.warn(`[${c.loja}] sem link de afiliado configurado — não publicado: ${c.titulo.slice(0, 60)}`);
        if (c.filaId) await deps.db.atualizarLink(c.filaId, { status: 'erro', erro: 'Sem link de afiliado configurado para esta loja (veja os Secrets).' });
        stats.ignoradas++; continue;
      }

      const { descricao, legendaHtml } = gerarDescricao({ ...c, historico }, c.produtoId.length);

      if (dry) {
        console.log('\n--- [DRY RUN] publicaria ---\n' + legendaHtml + '\nlink: ' + link + '\nimagem: ' + c.imagem);
        stats.publicadas++; continue;
      }

      await deps.db.registrarPreco(c.loja, c.produtoId, c.titulo, c.preco);
      const oferta = await deps.db.inserirOferta({
        titulo: c.titulo, loja: c.loja, preco_oferta: c.preco, preco_original: c.precoOriginal,
        link_afiliado: link, imagem_url: c.imagem, descricao, produto_id: c.produtoId,
      });

      if (deps.telegramOk) {
        await deps.enviarOferta({ legendaHtml, link, imagem: c.imagem });
        await deps.db.marcar(oferta.id, { enviado_telegram: true });
      }
      if (c.filaId) await deps.db.atualizarLink(c.filaId, { status: 'publicado' });

      stats.publicadas++;
      console.log(`✅ ${c.loja}: ${c.titulo.slice(0, 70)}`);
      await sleep(config.pausaEntreEnvios);
    } catch (e) {
      stats.erros++;
      console.warn(`❌ ${c.loja} ${c.produtoId}: ${e.message}`);
    }
  }
  console.log(`\nResumo: ${stats.publicadas} publicadas pelo robô, ${stats.manuais} do Admin enviadas, ${stats.ignoradas} ignoradas, ${stats.erros} erros.`);
  return stats;
}

// Execução direta (não roda quando importado pelos testes)
if (import.meta.url === `file://${process.argv[1]}`) {
  if (!config.dryRun && !db.dbConfigurado()) {
    console.error('Faltam SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.'); process.exit(1);
  }
  if (!telegramConfigurado()) console.warn('Telegram não configurado: vai publicar só no site.');
  const stats = await executar({
    db: config.dryRun && !db.dbConfigurado() ? dbVazio() : db,
    buscarShopee, buscarMercadoLivre, lerPagina, gerarLinkAfiliado, enviarOferta,
    telegramOk: telegramConfigurado() && !config.dryRun,
  });
  if (stats.publicadas === 0 && stats.erros > 0) process.exit(1);
}

function dbVazio() {
  return {
    expirarAntigas: async () => {}, linksPendentes: async () => [], atualizarLink: async () => {},
    jaPublicadoRecentemente: async () => false, estatisticasPreco: async () => null,
  };
}
