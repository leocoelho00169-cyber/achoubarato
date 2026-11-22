# Robô de ofertas do AchouBarato (100% gratuito)

Fluxo: **busca ofertas → gera link de afiliado → cria descrição → publica no site → envia no Telegram**,
rodando sozinho no GitHub Actions (4x por dia). Custo: R$ 0 (GitHub Actions + Supabase free + Telegram + APIs de afiliado).

## 1. Banco (Supabase) — 1 minuto
Supabase > SQL Editor > cole o conteúdo de `supabase/schema.sql` > Run.

## 2. Telegram
1. No Telegram, fale com **@BotFather** > `/newbot` > guarde o **token**.
2. Crie um canal/grupo, adicione o bot como **administrador**.
3. `TELEGRAM_CHAT_ID` = `@nome_do_canal` (canal público) ou o número `-100...` (use @userinfobot / getUpdates).

## 3. Credenciais de cada loja (todas gratuitas)
| Loja | O que criar | Secrets |
|---|---|---|
| Shopee | Programa de Afiliados Shopee > "Open API" > AppID e Secret | `SHOPEE_APP_ID`, `SHOPEE_SECRET` |
| Mercado Livre | App em developers.mercadolivre.com.br + seu ID de afiliado | `ML_CLIENT_ID`, `ML_CLIENT_SECRET`, `ML_MATT_TOOL`, `ML_MATT_WORD` |
| Shein | Seu programa de afiliados (ex.: Awin) | `SHEIN_LINK_TEMPLATE` |

`SHEIN_LINK_TEMPLATE` é o modelo do seu deep link, com `{url_enc}` no lugar da URL do produto. Ex. Awin:
`https://www.awin1.com/cread.php?awinmid=SEU_MID&awinaffid=SEU_ID&ued={url_enc}`
O robô **nunca publica** uma oferta cujo link de afiliado não possa gerar.

## 4. Secrets no GitHub
Repositório > Settings > Secrets and variables > Actions > New repository secret. Cadastre:
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (Supabase > Settings > API > **service_role**, nunca no site),
`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` e os da tabela acima.

## 5. Rodar
Aba **Actions > Robô de ofertas > Run workflow**. Use `dry_run = 1` para testar sem publicar.
Depois ele roda sozinho nos horários do arquivo `.github/workflows/ofertas.yml`.

## Shein (e qualquer loja sem API): fila de links
A Shein não tem API de produtos e bloqueia robôs. Solução gratuita: no Supabase, tabela `fila_links`,
insira uma linha com a `url` do produto (e `loja` = `Shein`). Na próxima rodada o robô tenta ler preço/foto;
se a loja bloquear, a linha fica com `status = erro` e você cadastra no Admin.

## Ajustes
`bot/config.js`: palavras de busca, desconto mínimo (20%), preço máximo, quantas ofertas por rodada (8), termos bloqueados.

## WhatsApp
Não existe forma gratuita e oficial de postar em **grupos** de WhatsApp a partir da nuvem. As opções gratuitas são
(a) o botão "Enviar no WhatsApp" que já existe no site, ou (b) um script no seu PC com o WhatsApp Web logado,
como no projeto de referência (PC ligado, risco de bloqueio do número). A coluna `enviado_whatsapp` já existe
na tabela para esse script saber o que falta enviar.

## Testes
`node bot/teste.js` (offline, sem credenciais).
