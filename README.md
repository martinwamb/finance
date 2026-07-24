# Finance Insights

Corporate financial insights distilled from annual/quarterly reports — NSE Kenya, NASDAQ,
and NYSE at launch. An interactive globe is the entry point; every point is a listed
company, and clicking one shows a dashboard built from that company's own filings.

Live at [finance.wambugumartin.com](https://finance.wambugumartin.com).

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind + shadcn/ui · Prisma + PostgreSQL ·
`react-globe.gl` · Recharts · nodemailer (mailcow SMTP) · Ollama (`qwen3:14b`, server-hosted)

## Data pipeline

- **SEC EDGAR** (`scripts/ingest-edgar.ts`) — free, no key. Pulls XBRL financials for
  curated NASDAQ/NYSE tickers and queues a `PENDING` `Report` per fiscal year. Runs
  weekly, Monday 20:00 UTC.
- **PDF upload** (`/admin/upload`) — for NSE Kenya and any market without a usable API.
  Extracts text server-side (`pdf-parse`) and queues a `PENDING` `Report`.
- **Analysis worker** (`scripts/analyze-reports.ts`) — turns `PENDING` reports into an
  `Insight` (structured metrics + narrative) via the server's Ollama instance. **Only
  runs inside the box's 22:00–06:00 UTC off-peak window** (no GPU on the server —
  Ollama is stopped outside that window by `ollama-window-start/stop.timer`). Scheduled
  Tue/Fri 03:15 UTC via PM2 `cron_restart`, clear of every other project's jobs in that
  window (see `ecosystem.config.js` for the current map — recheck `crontab -l` and
  `pm2 list` on the server before adding new off-peak jobs).
- **Newsletter** (`/api/cron/newsletter`) — `?mode=generate` drafts an issue from the
  most recently analyzed reports, `?mode=send` emails all confirmed subscribers.
  Protected by an `x-cron-secret` header, triggered from the server's crontab (not
  PM2), Tue/Fri — mirrors the pattern already used for wambugumartin.com's own
  newsletter.

## Local development

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL, ADMIN_SESSION_SECRET, ADMIN_PASSWORD_HASH
npx prisma db push
npm run db:seed        # seeds exchanges + curated company list
npm run dev
```

The Ollama-backed analysis worker and EDGAR ingestion won't do anything useful without
a reachable Postgres + (for analysis) an Ollama instance with `qwen3:14b` pulled.

## Deployment

Pushes to `main` deploy automatically via `.github/workflows/deploy.yml` (SSH +
`pm2 startOrReload`), following the same pattern as the other apps on this server
(`/home/admin/apps/*`). See that project's own deploy history for the shape this was
copied from.
