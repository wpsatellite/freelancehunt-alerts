// Перевіряє нові проєкти на Freelancehunt і шле їх у Telegram.
import { readFile, writeFile } from "node:fs/promises";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const DRY = process.env.DRY_RUN === "1";
const STATE_FILE = new URL("../state/seen.json", import.meta.url);

// ID категорій (скілів) Freelancehunt API
const SKILLS = {
  96: "Сайти",
  99: "Веб-програмування",
  127: "Контекстна реклама / Google Ads",
  133: "Реклама в соцмережах / Meta Ads",
  138: "Реклама",
};
const PAGES = 2; // 2 сторінки по 10 = із запасом на 5-хвилинний інтервал
const MAX_SEEN = 2000;

if (!DRY && (!TOKEN || !CHAT_ID)) {
  console.error("Потрібні TELEGRAM_BOT_TOKEN і TELEGRAM_CHAT_ID");
  process.exit(1);
}

const esc = (s = "") =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function fetchProjects() {
  const all = [];
  for (let page = 1; page <= PAGES; page++) {
    const url = `https://api.freelancehunt.com/v2/projects?filter[skill_id]=${Object.keys(SKILLS).join(",")}&page[number]=${page}`;
    const res = await fetch(url, { headers: { "User-Agent": "freelancehunt-alerts/1.0" } });
    if (!res.ok) throw new Error(`Freelancehunt API ${res.status}`);
    all.push(...(await res.json()).data);
  }
  return all;
}

function format(p) {
  const a = p.attributes;
  const b = a.budget ? `${a.budget.amount} ${a.budget.currency}` : "не вказано";
  const tags = (a.skills ?? []).map((s) => s.name).join(", ");
  const desc = (a.description ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
  return [
    `🆕 <b>${esc(a.name)}</b>`,
    `💰 ${esc(b)}`,
    tags && `🏷 ${esc(tags)}`,
    desc && `\n${esc(desc)}${(a.description ?? "").length > 300 ? "…" : ""}`,
    `\n<a href="${p.links.self.web}">Відкрити на Freelancehunt</a>`,
  ]
    .filter(Boolean)
    .join("\n");
}

async function send(text) {
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

async function loadState() {
  try {
    return JSON.parse(await readFile(STATE_FILE, "utf8"));
  } catch {
    return null; // перший запуск
  }
}

const state = await loadState();
const projects = await fetchProjects();
const seen = new Set(state?.seen ?? []);

// Перший запуск: лише запам'ятовуємо поточні, щоб не завалити чат старими
if (!state) {
  console.log(`Перший запуск: запам'ятовую ${projects.length} проєктів без сповіщень`);
  projects.forEach((p) => seen.add(p.id));
} else {
  const fresh = projects.filter((p) => !seen.has(p.id)).reverse(); // старіші першими
  console.log(`Нових: ${fresh.length}`);
  for (const p of fresh) {
    if (DRY) console.log("DRY:", p.attributes.name);
    else {
      await send(format(p));
      await new Promise((r) => setTimeout(r, 1100)); // ліміт Telegram
    }
    seen.add(p.id);
  }
}

if (!DRY) {
  const list = [...seen].slice(-MAX_SEEN);
  await writeFile(STATE_FILE, JSON.stringify({ seen: list }, null, 1) + "\n");
}
