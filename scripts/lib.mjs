import { readFile, writeFile } from "node:fs/promises";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
export const DRY = process.env.DRY_RUN === "1";
const MAX_SEEN = 2000;

export function requireEnv() {
  if (!DRY && (!TOKEN || !CHAT_ID)) {
    console.error("Потрібні TELEGRAM_BOT_TOKEN і TELEGRAM_CHAT_ID");
    process.exit(1);
  }
}

export const esc = (s = "") =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function send(text) {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  if (!res.ok) throw new Error(`Telegram ${res.status}: ${await res.text()}`);
}

/**
 * Спільна логіка: items = [{id, ...}] від найновіших до найстаріших.
 * Перший запуск (нема файла стану) лише запам'ятовує, без сповіщень.
 */
export async function process_(stateName, items, format) {
  const file = new URL(`../state/${stateName}.json`, import.meta.url);
  let state = null;
  try {
    state = JSON.parse(await readFile(file, "utf8"));
  } catch {}
  const seen = new Set(state?.seen ?? []);

  if (!state) {
    console.log(`[${stateName}] Перший запуск: запам'ятовую ${items.length}, без сповіщень`);
    items.forEach((i) => seen.add(i.id));
  } else {
    const fresh = items.filter((i) => !seen.has(i.id)).reverse();
    console.log(`[${stateName}] Нових: ${fresh.length}`);
    for (const i of fresh) {
      if (DRY) console.log("DRY:", i.id);
      else {
        await send(format(i));
        await new Promise((r) => setTimeout(r, 1100)); // ліміт Telegram
      }
      seen.add(i.id);
    }
  }
  if (!DRY) {
    await writeFile(file, JSON.stringify({ seen: [...seen].slice(-MAX_SEEN) }, null, 1) + "\n");
  }
}
