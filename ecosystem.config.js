// Workers below only do real work inside the server's 22:00-06:00 UTC Ollama
// off-peak window (no GPU on the box). Minutes are chosen clear of every other
// project's cron_restart/crontab entries — recheck `crontab -l` and `pm2 list`
// on the server before changing them. See finance's README for the full map.
module.exports = {
  apps: [
    {
      name: "finance",
      cwd: "/home/admin/apps/finance",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3005",
      interpreter: "node",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      min_uptime: "30s",
      restart_delay: 5000,
      kill_timeout: 8000,
      env: { NODE_ENV: "production", PORT: "3005" },
      out_file: "/home/admin/logs/finance-out.log",
      error_file: "/home/admin/logs/finance-error.log",
      merge_logs: true,
      time: true,
    },
    {
      // Weekly, before the off-peak window opens — just queues PENDING
      // reports from SEC EDGAR, no Ollama call, so it doesn't need to run
      // inside the window itself.
      name: "finance-ingest-edgar",
      script: "node_modules/.bin/tsx",
      args: "scripts/ingest-edgar.ts",
      cwd: "/home/admin/apps/finance",
      cron_restart: "0 20 * * 1",
      autorestart: false,
      watch: false,
      env: { NODE_ENV: "production" },
      out_file: "/home/admin/logs/finance-ingest-edgar.log",
      error_file: "/home/admin/logs/finance-ingest-edgar.log",
      merge_logs: true,
      time: true,
    },
    {
      // Weekly, right after the EDGAR job. Non-US venues (Europe + Asia) come
      // from Yahoo's fundamentals endpoint; like EDGAR this only queues PENDING
      // reports, no Ollama call, so it can run outside the off-peak window.
      name: "finance-ingest-yahoo",
      script: "node_modules/.bin/tsx",
      args: "scripts/ingest-yahoo.ts",
      cwd: "/home/admin/apps/finance",
      cron_restart: "30 20 * * 1",
      autorestart: false,
      watch: false,
      env: { NODE_ENV: "production" },
      out_file: "/home/admin/logs/finance-ingest-yahoo.log",
      error_file: "/home/admin/logs/finance-ingest-yahoo.log",
      merge_logs: true,
      time: true,
    },
    {
      // Nightly at 22:15 UTC, as the Ollama window opens. The script works to a
      // wall-clock deadline (05:30 UTC) rather than a fixed report count, so it
      // uses whatever window is available and stops cleanly before Ollama is
      // shut down at 06:00. 22:15 is clear of learn
      // (23:15/01:15/02:15/04:30/05:05), local-dialect (00:15/00:45/05:15), and
      // port/publisher-site (02:00/02:30/03:30).
      name: "finance-analyze",
      script: "node_modules/.bin/tsx",
      args: "scripts/analyze-reports.ts",
      cwd: "/home/admin/apps/finance",
      cron_restart: "15 22 * * *",
      autorestart: false,
      watch: false,
      env: { NODE_ENV: "production" },
      out_file: "/home/admin/logs/finance-analyze.log",
      error_file: "/home/admin/logs/finance-analyze.log",
      merge_logs: true,
      time: true,
    },
  ],
};
