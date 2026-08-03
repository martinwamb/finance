# Finance Insights

Corporate financial insights distilled from annual/quarterly reports across 15 exchanges
in the Americas, Europe, Asia-Pacific and Africa. An interactive globe is the entry
point; every point is a listed company, and clicking one shows a dashboard built from
that company's own filings.

Live at [finance.wambugumartin.com](https://finance.wambugumartin.com).

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind + shadcn/ui · Prisma + PostgreSQL ·
`react-globe.gl` · Recharts · nodemailer (mailcow SMTP) · Ollama (`qwen2.5:14b`, server-hosted)

## Data pipeline

- **SEC EDGAR** (`scripts/ingest-edgar.ts`) — free, no key. Pulls XBRL financials for
  curated NASDAQ/NYSE tickers and queues a `PENDING` `Report` per fiscal year. Runs
  weekly, Monday 20:00 UTC.
- **Yahoo fundamentals** (`scripts/ingest-yahoo.ts`) — free, no key, no crumb. Covers the
  European and Asian venues (LSE, Xetra, Euronext Paris/Amsterdam, SIX, Tokyo, HKEX,
  SGX, NSE India, BSE, Shanghai, Shenzhen), which have no EDGAR equivalent. Runs weekly,
  Monday 20:30 UTC. The endpoint is undocumented, so `src/lib/yahoo.ts` parses
  defensively and backs off on 429; `scripts/verify-symbols.ts` re-checks every seeded
  symbol after edits to `prisma/data/international.ts`.
- **PDF upload** (`/admin/upload`) — for NSE Kenya and any market without a usable API.
  Extracts text server-side (`pdf-parse`) and queues a `PENDING` `Report`.
- **Analysis worker** (`scripts/analyze-reports.ts`) — turns `PENDING` reports into an
  `Insight` (structured metrics + narrative) via the server's Ollama instance. **Only
  runs inside the box's 22:00–06:00 UTC off-peak window** (no GPU on the server —
  Ollama is stopped outside that window by `ollama-window-start/stop.timer`). Scheduled
  nightly at 22:15 UTC via PM2 `cron_restart`, clear of every other project's jobs in
  that window (see `ecosystem.config.js` for the current map — recheck `crontab -l` and
  `pm2 list` on the server before adding new off-peak jobs). It works to a wall-clock
  deadline (`ANALYZE_DEADLINE_UTC`, default 05:30) rather than a fixed report count, and
  retries `FAILED` reports up to `REPORT_ANALYSIS_MAX_ATTEMPTS`.
- **Newsletter** (`/api/cron/newsletter`) — `?mode=generate` drafts an issue from the
  most recently analyzed reports grouped by region, `?mode=send` emails all confirmed
  subscribers. Protected by an `x-cron-secret` header, triggered from the server's
  crontab (not PM2), Tue/Fri — mirrors the pattern already used for wambugumartin.com's
  own newsletter. A run that produces nothing emails `ADMIN_ALERT_EMAIL`.

### Two things that will silently break this pipeline

1. **A reasoning model.** `OLLAMA_MODEL` must be a non-reasoning model. `qwen3:14b` emits
   a long `<think>` block before answering; on this CPU-only box that pushed every
   generation past the request timeout, and for weeks nothing was ever analysed and no
   newsletter was ever sent. Ollama calls also **must** use `stream: true` — with
   `stream: false` the response headers are withheld until generation completes, and
   undici caps that wait at 300s regardless of any signal you pass.
2. **Currency.** Figures are stored per-`Report` in `Report.currency`, read from the
   source, never inferred from the exchange — Shell files in USD despite listing in
   London. Always pass it to `formatCompact(value, currency)`.

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
