// Utilidades pequenas, sem dependências externas.
import crypto from 'node:crypto';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function brl(n) {
  return Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function sha256(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

export function escapeHtml(s = '') {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function pick(arr, seed) {
  // determinístico quando recebe seed (bom para teste), aleatório sem seed
  const i = seed != null ? Math.abs(seed) % arr.length : Math.floor(Math.random() * arr.length);
  return arr[i];
}

export function toNumber(v) {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  let s = String(v).replace(/[^\d.,]/g, '');
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

export async function fetchJson(url, opts = {}, tentativas = 3) {
  let ultimoErro;
  for (let i = 0; i < tentativas; i++) {
    try {
      const res = await fetch(url, opts);
      const texto = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status} em ${url.split('?')[0]}: ${texto.slice(0, 300)}`);
      return texto ? JSON.parse(texto) : null;
    } catch (e) {
      ultimoErro = e;
      await sleep(800 * (i + 1));
    }
  }
  throw ultimoErro;
}
