// Freelance.ua (RSS) -> Telegram. Беремо замовлення про сайти, ботів, рекламу,
// соцмережі та автоматизацію.
import { esc, requireEnv, process_ } from "./lib.mjs";

requireEnv();

const L = String.raw`(?<![\p{L}\p{N}])`; // початок слова (працює і для кирилиці)
const E = String.raw`(?![\p{L}\p{N}])`; // кінець слова
const KEYWORDS = new RegExp(
  [
    `${L}сайт`, // сайт, сайти, сайтів, веб-сайт
    `${L}веб`, // веб-розробка, веб-дизайн
    `${L}(landing|лендінг|лендинг)`,
    `${L}(інтернет|интернет)[\\s-]*(магазин|майданчик|площадк)`,
    `${L}(wordpress|woocommerce|shopify|tilda|тильд)`,
    `${L}(чат[\\s-]*)?(telegram[\\s-]*|телеграм[\\s-]*)?(бот|bot)(и|ы|а|у|ів|ов|ом|ами|ах|е|ы)?${E}`,
    `${L}реклам`, // реклама, рекламу, рекламний
    `${L}(таргет|ppc|google[\\s-]*ads|meta[\\s-]*ads|facebook[\\s-]*ads|контекст)`,
    `${L}(соц[\\p{L}]*[\\s.-]*(мереж|сет)|social[\\s-]*media)`,
    `${L}(smm|смм|instagram|інстаграм|инстаграм|facebook|фейсбук|tiktok|тікток|тик[\\s-]?ток)`,
    `${L}автоматиз`, // автоматизація / автоматизация
    `${L}(zapier|make\\.com|n8n)`,
  ].join("|"),
  "iu"
);

const decode = (s) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

const tag = (xml, name) => {
  const m = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  return m ? decode(m[1]).trim() : "";
};

const res = await fetch("https://freelance.ua/orders/rss", {
  headers: { "User-Agent": "Mozilla/5.0 freelancehunt-alerts/1.0" },
});
if (!res.ok) throw new Error(`Freelance.ua RSS ${res.status}`);
const xml = await res.text();

const all = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => ({
  id: tag(m[1], "guid") || tag(m[1], "link"),
  title: tag(m[1], "title"),
  link: tag(m[1], "link"),
  description: tag(m[1], "description"),
  category: tag(m[1], "category"),
}));

const matched = all.filter((o) =>
  KEYWORDS.test(`${o.title} ${o.category} ${o.description}`)
);
console.log(`[freelanceua] у стрічці ${all.length}, підходить ${matched.length}`);
if (process.env.SHOW) {
  for (const o of all) console.log(matched.includes(o) ? "✔" : "✘", o.title, "|", o.category);
}

const format = (o) => {
  const desc = o.description.replace(/\s+/g, " ").trim();
  return [
    `🆕 <b>${esc(o.title)}</b>  <i>(Freelance.ua)</i>`,
    o.category && `🏷 ${esc(o.category)}`,
    desc && `\n${esc(desc.slice(0, 300))}${desc.length > 300 ? "…" : ""}`,
    `\n<a href="${o.link}">Відкрити на Freelance.ua</a>`,
  ]
    .filter(Boolean)
    .join("\n");
};

await process_("freelanceua", matched, format);
