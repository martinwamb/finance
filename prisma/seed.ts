import "dotenv/config";
import { db } from "../src/lib/db";
import { resolveCikByTicker } from "../src/lib/edgar";
import { REGION_CENTROIDS, FALLBACK_CENTROID } from "./data/regions";
import { INTERNATIONAL_EXCHANGES } from "./data/international";
import sp500 from "./data/sp500.json";

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5)); // ~137.5°, even point spacing

// Sunflower-spiral offset so companies sharing a region/exchange fan out into a
// visible cluster instead of stacking on one coordinate — a tight stack of 30+
// points is unclickable once the globe is rotating. maxRadiusDeg scales with
// group size so a region with 1 company barely moves and one with 70 spreads wide.
function spiralOffset(index: number, total: number, centerLat: number, maxRadiusDeg: number) {
  const angle = index * GOLDEN_ANGLE;
  const radius = maxRadiusDeg * Math.sqrt((index + 0.5) / total);
  const dLat = radius * Math.sin(angle);
  const dLng = (radius * Math.cos(angle)) / Math.cos((centerLat * Math.PI) / 180);
  return { dLat, dLng };
}

const EXCHANGES = [
  { code: "NSE", name: "Nairobi Securities Exchange", country: "Kenya", region: "EMEA" as const, timezone: "Africa/Nairobi", yahooSuffix: null, lat: -1.2921, lng: 36.8219 },
  { code: "NASDAQ", name: "Nasdaq", country: "United States", region: "AMERICAS" as const, timezone: "America/New_York", yahooSuffix: null, lat: 40.7561, lng: -73.9868 },
  { code: "NYSE", name: "New York Stock Exchange", country: "United States", region: "AMERICAS" as const, timezone: "America/New_York", yahooSuffix: null, lat: 40.7069, lng: -74.0113 },
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

interface Sp500Row {
  ticker: string;
  exchange: "NASDAQ" | "NYSE";
  name: string;
  sector: string;
  subIndustry: string;
  hqCity: string;
  hqRegion: string;
}

async function main() {
  const exchanges = new Map<string, string>();
  for (const ex of EXCHANGES) {
    const row = await db.exchange.upsert({
      where: { code: ex.code },
      // These three already exist in production, so the update branch is the
      // one that actually runs — it must carry the new columns too.
      update: {
        name: ex.name,
        country: ex.country,
        region: ex.region,
        timezone: ex.timezone,
        yahooSuffix: ex.yahooSuffix,
        lat: ex.lat,
        lng: ex.lng,
      },
      create: ex,
    });
    exchanges.set(ex.code, row.id);
  }

  // NSE Kenya — no free API, uploaded manually — spiral around Nairobi.
  const nseExchangeId = exchanges.get("NSE")!;
  const nseCenter = EXCHANGES.find((e) => e.code === "NSE")!;
  await Promise.all(
    NSE_COMPANIES.map((c, i) => {
      const { dLat, dLng } = spiralOffset(i, NSE_COMPANIES.length, nseCenter.lat, 4);
      return db.company.upsert({
        where: { exchangeId_ticker: { exchangeId: nseExchangeId, ticker: c.ticker } },
        update: { name: c.name, sector: c.sector },
        create: {
          ...c,
          exchangeId: nseExchangeId,
          lat: nseCenter.lat + dLat,
          lng: nseCenter.lng + dLng,
        },
      });
    })
  );

  // S&P 500 — group by HQ region so each state/country cluster spirals
  // around its own real centroid instead of every company sharing one point.
  const rows = sp500 as Sp500Row[];
  const byRegion = new Map<string, Sp500Row[]>();
  for (const row of rows) {
    const list = byRegion.get(row.hqRegion) ?? [];
    list.push(row);
    byRegion.set(row.hqRegion, list);
  }

  let resolved = 0;
  for (const [region, companies] of byRegion) {
    const center = REGION_CENTROIDS[region] ?? FALLBACK_CENTROID;
    const maxRadius = Math.min(2.5 + Math.sqrt(companies.length) * 1.1, 9);

    for (let i = 0; i < companies.length; i++) {
      const c = companies[i];
      const exchangeId = exchanges.get(c.exchange)!;
      const { dLat, dLng } = spiralOffset(i, companies.length, center.lat, maxRadius);

      const cik = await resolveCikByTicker(c.ticker.replace(".", "-"));
      resolved++;
      if (resolved % 50 === 0) console.log(`Resolved ${resolved}/${rows.length} CIKs...`);

      await db.company.upsert({
        where: { exchangeId_ticker: { exchangeId, ticker: c.ticker } },
        update: { name: c.name, sector: c.sector, cik },
        create: {
          ticker: c.ticker,
          name: c.name,
          sector: c.sector,
          cik,
          exchangeId,
          lat: center.lat + dLat,
          lng: center.lng + dLng,
        },
      });
    }
  }

  // European and Asian venues. No per-company HQ data for these, so each list
  // spirals around its own exchange (same treatment as NSE Kenya above).
  let international = 0;
  for (const ex of INTERNATIONAL_EXCHANGES) {
    const row = await db.exchange.upsert({
      where: { code: ex.code },
      update: {
        name: ex.name,
        country: ex.country,
        region: ex.region,
        timezone: ex.timezone,
        yahooSuffix: ex.yahooSuffix,
        lat: ex.lat,
        lng: ex.lng,
      },
      create: {
        code: ex.code,
        name: ex.name,
        country: ex.country,
        region: ex.region,
        timezone: ex.timezone,
        yahooSuffix: ex.yahooSuffix,
        lat: ex.lat,
        lng: ex.lng,
      },
    });

    const maxRadius = Math.min(2.5 + Math.sqrt(ex.companies.length) * 1.1, 9);

    for (let i = 0; i < ex.companies.length; i++) {
      const c = ex.companies[i];
      const yahooSymbol = c.yahooSymbol ?? `${c.ticker}${ex.yahooSuffix}`;
      const { dLat, dLng } = spiralOffset(i, ex.companies.length, ex.lat, maxRadius);

      await db.company.upsert({
        where: { exchangeId_ticker: { exchangeId: row.id, ticker: c.ticker } },
        update: { name: c.name, sector: c.sector, yahooSymbol },
        create: {
          ticker: c.ticker,
          name: c.name,
          sector: c.sector,
          yahooSymbol,
          exchangeId: row.id,
          lat: ex.lat + dLat,
          lng: ex.lng + dLng,
        },
      });
      international++;
    }
  }

  console.log(
    `Seed complete: ${NSE_COMPANIES.length} NSE + ${rows.length} S&P 500 + ${international} international companies across ${EXCHANGES.length + INTERNATIONAL_EXCHANGES.length} exchanges.`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
