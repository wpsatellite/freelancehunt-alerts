// Freelancehunt (API) -> Telegram.
import { esc, requireEnv, process_ } from "./lib.mjs";

requireEnv();

// ID категорій (скілів) Freelancehunt API
const SKILLS = {
  96: "Сайти",
  99: "Веб-програмування",
  127: "Контекстна реклама / Google Ads",
  133: "Реклама в соцмережах / Meta Ads",
  138: "Реклама",
};
const PAGES = 2; // 2 сторінки по 10 = із запасом на 5-хвилинний інтервал

const items = [];
for (let page = 1; page <= PAGES; page++) {
  const url = `https://api.freelancehunt.com/v2/projects?filter[skill_id]=${Object.keys(SKILLS).join(",")}&page[number]=${page}`;
  const res = await fetch(url, { headers: { "User-Agent": "freelancehunt-alerts/1.0" } });
  if (!res.ok) throw new Error(`Freelancehunt API ${res.status}`);
  items.push(...(await res.json()).data);
}

function format(p) {
  const a = p.attributes;
  const b = a.budget ? `${a.budget.amount} ${a.budget.currency}` : "не вказано";
  const tags = (a.skills ?? []).map((s) => s.name).join(", ");
  const desc = (a.description ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
  return [
    `🆕 <b>${esc(a.name)}</b>  <i>(Freelancehunt)</i>`,
    `💰 ${esc(b)}`,
    tags && `🏷 ${esc(tags)}`,
    desc && `\n${esc(desc)}${(a.description ?? "").length > 300 ? "…" : ""}`,
    `\n<a href="${p.links.self.web}">Відкрити на Freelancehunt</a>`,
  ]
    .filter(Boolean)
    .join("\n");
}

await process_("freelancehunt", items, format);

// ---------------------------------------------------------------------------
// Автоматизація. У Freelancehunt немає окремої категорії, тому:
//  - ALL: категорії, де майже все по темі (боти) беремо без фільтра;
//  - FILTERED: суміжні категорії беремо лише якщо в назві/описі є слова про автоматизацію.
// Окремий файл стану (freelancehunt-auto): перший запуск мовчки запам'ятовує наявні.
// ---------------------------------------------------------------------------
const AUTO_ALL = {
  175: "AI та машинне навчання",
  189: "Автоматизація управління підприємством (ERP)",
  197: "AI-обробка текстів / контент",
  180: "Розробка ботів",
};
const AUTO_FILTERED = {
  169: "Парсинг даних",
  150: "CRM",
  190: "AI-консалтинг",
  22: "Python",
  28: "JavaScript / TypeScript",
  154: "Консалтинг",
};
const L = String.raw`(?<![\p{L}\p{N}])`; // початок слова, працює для кирилиці
const AUTO_KW = new RegExp(
  [
    `${L}автоматиз`, // автоматизація / автоматизация
    `${L}автоматичн`, // автоматичний, автоматична
    `${L}automat`, // automation, automate
    `${L}(n8n|zapier|make\\.com|integromat|pabbly)`,
    `${L}(workflow|воркфлоу|рутин)`,
    `${L}(парсинг|парсер|parser|scraper|scraping|скрейп)`,
    `${L}(інтеграці|интеграци|integration)`,
  ].join("|"),
  "iu"
);

// Перші сторінки; на 400 (сторінки закінчились) просто зупиняємось.
async function fetchSkills(ids) {
  const out = [];
  for (let page = 1; page <= PAGES; page++) {
    const url = `https://api.freelancehunt.com/v2/projects?filter[skill_id]=${ids.join(",")}&page[number]=${page}`;
    const res = await fetch(url, { headers: { "User-Agent": "freelancehunt-alerts/1.0" } });
    if (res.status === 400 && page > 1) break;
    if (!res.ok) throw new Error(`Freelancehunt API ${res.status} (automation)`);
    const data = (await res.json()).data;
    out.push(...data);
    if (data.length < 10) break;
  }
  return out;
}

const mainIds = new Set(items.map((p) => p.id));
const byId = new Map();
for (const p of await fetchSkills(Object.keys(AUTO_ALL))) byId.set(p.id, p);
for (const p of await fetchSkills(Object.keys(AUTO_FILTERED))) {
  const a = p.attributes;
  if (AUTO_KW.test(`${a.name} ${a.description ?? ""}`)) byId.set(p.id, p);
}
// найновіші першими, без тих, що вже прийшли основним потоком
const autoItems = [...byId.values()]
  .filter((p) => !mainIds.has(p.id))
  .sort((a, b) => Number(b.id) - Number(a.id));
console.log(`[freelancehunt-auto] підходить ${autoItems.length}`);

await process_("freelancehunt-auto", autoItems, (p) => format(p).replace("🆕", "🤖 Автоматизація\n🆕"));

