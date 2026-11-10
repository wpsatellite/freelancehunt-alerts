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
