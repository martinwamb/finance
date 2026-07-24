import "dotenv/config";
import { db } from "../src/lib/db";
import { resolveCikByTicker } from "../src/lib/edgar";

// Deterministic small offset so companies sharing an exchange don't stack on
// exactly the same globe coordinate.
function jitter(seed: string, spread = 1.2): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return ((hash % 1000) / 1000) * spread - spread / 2;
}

const EXCHANGES = [
  { code: "NSE", name: "Nairobi Securities Exchange", country: "Kenya", lat: -1.2921, lng: 36.8219 },
  { code: "NASDAQ", name: "Nasdaq", country: "United States", lat: 40.7561, lng: -73.9868 },
  { code: "NYSE", name: "New York Stock Exchange", country: "United States", lat: 40.7069, lng: -74.0113 },
];

const NSE_COMPANIES = [
  { ticker: "SCOM", name: "Safaricom PLC", sector: "Telecommunications" },
  { ticker: "EQTY", name: "Equity Group Holdings", sector: "Banking" },
  { ticker: "KCB", name: "KCB Group", sector: "Banking" },
  { ticker: "COOP", name: "Co-operative Bank of Kenya", sector: "Banking" },
  { ticker: "ABSA", name: "Absa Bank Kenya", sector: "Banking" },
  { ticker: "SCBK", name: "Standard Chartered Bank Kenya", sector: "Banking" },
  { ticker: "NCBA", name: "NCBA Group", sector: "Banking" },
  { ticker: "DTK", name: "Diamond Trust Bank Kenya", sector: "Banking" },
  { ticker: "IMH", name: "I&M Group", sector: "Banking" },
  { ticker: "SBIC", name: "Stanbic Holdings", sector: "Banking" },
  { ticker: "HFCK", name: "HF Group", sector: "Banking" },
  { ticker: "EABL", name: "East African Breweries", sector: "Manufacturing" },
  { ticker: "BAT", name: "British American Tobacco Kenya", sector: "Manufacturing" },
  { ticker: "BAMB", name: "Bamburi Cement", sector: "Manufacturing" },
  { ticker: "CRWN", name: "Crown Paints Kenya", sector: "Manufacturing" },
  { ticker: "UNGA", name: "Unga Group", sector: "Manufacturing" },
  { ticker: "CARB", name: "Carbacid Investments", sector: "Manufacturing" },
  { ticker: "KEGN", name: "KenGen", sector: "Energy" },
  { ticker: "KPLC", name: "Kenya Power and Lighting Company", sector: "Energy" },
  { ticker: "TOTL", name: "TotalEnergies Marketing Kenya", sector: "Energy" },
  { ticker: "KUKZ", name: "Kakuzi", sector: "Agriculture" },
  { ticker: "SASN", name: "Sasini", sector: "Agriculture" },
  { ticker: "KAPC", name: "Kapchorua Tea Company", sector: "Agriculture" },
  { ticker: "WTK", name: "Williamson Tea Kenya", sector: "Agriculture" },
  { ticker: "LIMT", name: "Limuru Tea Company", sector: "Agriculture" },
  { ticker: "JUB", name: "Jubilee Holdings", sector: "Insurance" },
  { ticker: "BRIT", name: "Britam Holdings", sector: "Insurance" },
  { ticker: "CIC", name: "CIC Insurance Group", sector: "Insurance" },
  { ticker: "SLAM", name: "Sanlam Kenya", sector: "Insurance" },
  { ticker: "KNRE", name: "Kenya Reinsurance Corporation", sector: "Insurance" },
  { ticker: "CTUM", name: "Centum Investment Company", sector: "Investment" },
  { ticker: "NMG", name: "Nation Media Group", sector: "Media" },
  { ticker: "SCAN", name: "WPP Scangroup", sector: "Marketing & Advertising" },
];

const NASDAQ_COMPANIES = [
  { ticker: "AAPL", name: "Apple Inc.", sector: "Technology" },
  { ticker: "MSFT", name: "Microsoft Corporation", sector: "Technology" },
  { ticker: "AMZN", name: "Amazon.com, Inc.", sector: "Consumer Discretionary" },
  { ticker: "GOOGL", name: "Alphabet Inc.", sector: "Communication Services" },
  { ticker: "META", name: "Meta Platforms, Inc.", sector: "Communication Services" },
  { ticker: "NVDA", name: "NVIDIA Corporation", sector: "Technology" },
  { ticker: "TSLA", name: "Tesla, Inc.", sector: "Consumer Discretionary" },
  { ticker: "NFLX", name: "Netflix, Inc.", sector: "Communication Services" },
  { ticker: "ADBE", name: "Adobe Inc.", sector: "Technology" },
  { ticker: "CSCO", name: "Cisco Systems, Inc.", sector: "Technology" },
  { ticker: "INTC", name: "Intel Corporation", sector: "Technology" },
  { ticker: "PEP", name: "PepsiCo, Inc.", sector: "Consumer Staples" },
  { ticker: "COST", name: "Costco Wholesale Corporation", sector: "Consumer Staples" },
];

const NYSE_COMPANIES = [
  { ticker: "BRK-B", name: "Berkshire Hathaway Inc.", sector: "Financials" },
  { ticker: "JPM", name: "JPMorgan Chase & Co.", sector: "Financials" },
  { ticker: "V", name: "Visa Inc.", sector: "Financials" },
  { ticker: "JNJ", name: "Johnson & Johnson", sector: "Healthcare" },
  { ticker: "WMT", name: "Walmart Inc.", sector: "Consumer Staples" },
  { ticker: "PG", name: "Procter & Gamble Company", sector: "Consumer Staples" },
  { ticker: "MA", name: "Mastercard Incorporated", sector: "Financials" },
  { ticker: "HD", name: "Home Depot, Inc.", sector: "Consumer Discretionary" },
  { ticker: "KO", name: "Coca-Cola Company", sector: "Consumer Staples" },
  { ticker: "XOM", name: "Exxon Mobil Corporation", sector: "Energy" },
  { ticker: "CVX", name: "Chevron Corporation", sector: "Energy" },
  { ticker: "CRM", name: "Salesforce, Inc.", sector: "Technology" },
  { ticker: "PFE", name: "Pfizer Inc.", sector: "Healthcare" },
  { ticker: "MCD", name: "McDonald's Corporation", sector: "Consumer Discretionary" },
  { ticker: "NKE", name: "Nike, Inc.", sector: "Consumer Discretionary" },
  { ticker: "DIS", name: "Walt Disney Company", sector: "Communication Services" },
  { ticker: "BA", name: "Boeing Company", sector: "Industrials" },
  { ticker: "IBM", name: "International Business Machines Corporation", sector: "Technology" },
];

async function main() {
  const exchanges = new Map<string, string>();
  for (const ex of EXCHANGES) {
    const row = await db.exchange.upsert({
      where: { code: ex.code },
      update: { name: ex.name, country: ex.country, lat: ex.lat, lng: ex.lng },
      create: ex,
    });
    exchanges.set(ex.code, row.id);
  }

  for (const c of NSE_COMPANIES) {
    const exchangeId = exchanges.get("NSE")!;
    const exchange = EXCHANGES.find((e) => e.code === "NSE")!;
    await db.company.upsert({
      where: { exchangeId_ticker: { exchangeId, ticker: c.ticker } },
      update: { name: c.name, sector: c.sector },
      create: {
        ...c,
        exchangeId,
        lat: exchange.lat + jitter(c.ticker),
        lng: exchange.lng + jitter(c.ticker + "lng"),
      },
    });
  }

  for (const [code, list] of [
    ["NASDAQ", NASDAQ_COMPANIES],
    ["NYSE", NYSE_COMPANIES],
  ] as const) {
    const exchangeId = exchanges.get(code)!;
    const exchange = EXCHANGES.find((e) => e.code === code)!;
    for (const c of list) {
      console.log(`Resolving CIK for ${c.ticker}...`);
      // SEC's mapping uses the hyphenated class-share form as-is (e.g. "BRK-B"),
      // not dot notation — no reformatting needed.
      const cik = await resolveCikByTicker(c.ticker);
      await db.company.upsert({
        where: { exchangeId_ticker: { exchangeId, ticker: c.ticker } },
        update: { name: c.name, sector: c.sector, cik },
        create: {
          ...c,
          cik,
          exchangeId,
          lat: exchange.lat + jitter(c.ticker),
          lng: exchange.lng + jitter(c.ticker + "lng"),
        },
      });
    }
  }

  console.log("Seed complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
