// Envio para o Telegram pela API oficial (gratuita).
import { config } from './config.js';

async function chamar(metodo, corpo) {
  const { token } = config.telegram;
  const res = await fetch(`https://api.telegram.org/bot${token}/${metodo}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) throw new Error(`Telegram ${metodo}: ${json.description || res.status}`);
  return json.result;
}

export function telegramConfigurado() {
  return !!(config.telegram.token && config.telegram.chatId);
}

export async function enviarOferta({ legendaHtml, link, imagem }) {
  const { chatId } = config.telegram;
  const botao = { inline_keyboard: [[{ text: '🛒 Pegar oferta', url: link }]] };
  // Limite do Telegram: 1024 caracteres na legenda de foto
  const legenda = legendaHtml.length > 1000 ? legendaHtml.slice(0, 997) + '…' : legendaHtml;
  const texto = `${legenda}\n\n👉 ${link}`;
  if (imagem) {
    try {
      return await chamar('sendPhoto', { chat_id: chatId, photo: imagem, caption: legenda, parse_mode: 'HTML', reply_markup: botao });
    } catch (e) {
      console.warn('[telegram] foto falhou, enviando só texto:', e.message);
    }
  }
  return chamar('sendMessage', { chat_id: chatId, text: texto, parse_mode: 'HTML', reply_markup: botao, disable_web_page_preview: false });
}
