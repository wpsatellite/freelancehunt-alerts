# freelancehunt-alerts

Кожні 5 хвилин GitHub Actions перевіряє нові проєкти на Freelancehunt і Freelance.ua
(сайти, контекстна реклама / Google Ads, реклама в соцмережах / Meta Ads)
і надсилає їх у Telegram-групу.

## Налаштування
У Settings → Secrets and variables → Actions додайте:
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

Локальна перевірка без відправки: `npm run dry`.
