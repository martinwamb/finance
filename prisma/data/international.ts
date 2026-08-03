// European and Asian venues, plus a curated large-cap list per venue.
//
// Companies are placed on the globe by spiralling around their exchange's
// coordinates (same treatment as NSE Kenya in prisma/seed.ts) rather than by
// real HQ address — the S&P 500 set is the only one with per-company HQ regions.
//
// `yahooSymbol` is ticker + suffix for every venue here, but it is stored
// explicitly on Company because that rule doesn't hold everywhere (Hong Kong
// pads tickers to four digits, for one). Every symbol below is verified against
// Yahoo's fundamentals endpoint by scripts/verify-symbols.ts.

import type { Region } from "../../src/generated/prisma/enums";

export interface InternationalExchange {
  code: string;
  name: string;
  country: string;
  region: Region;
  timezone: string;
  yahooSuffix: string;
  lat: number;
  lng: number;
  companies: {
    ticker: string;
    name: string;
    sector: string;
    /** Overrides the default ticker+suffix where Yahoo indexes a different line. */
    yahooSymbol?: string;
  }[];
}

export const INTERNATIONAL_EXCHANGES: InternationalExchange[] = [
  {
    code: "LSE",
    name: "London Stock Exchange",
    country: "United Kingdom",
    region: "EMEA",
    timezone: "Europe/London",
    yahooSuffix: ".L",
    lat: 51.5155,
    lng: -0.0922,
    companies: [
      { ticker: "SHEL", name: "Shell plc", sector: "Energy" },
      { ticker: "AZN", name: "AstraZeneca", sector: "Healthcare" },
      { ticker: "HSBA", name: "HSBC Holdings", sector: "Banking" },
      { ticker: "ULVR", name: "Unilever", sector: "Consumer Goods" },
      { ticker: "BP", name: "BP plc", sector: "Energy" },
      { ticker: "GSK", name: "GSK plc", sector: "Healthcare" },
      { ticker: "RIO", name: "Rio Tinto", sector: "Materials" },
      { ticker: "BATS", name: "British American Tobacco", sector: "Consumer Goods" },
      { ticker: "DGE", name: "Diageo", sector: "Consumer Goods" },
      { ticker: "BARC", name: "Barclays", sector: "Banking" },
      { ticker: "NG", name: "National Grid", sector: "Utilities" },
      { ticker: "LSEG", name: "London Stock Exchange Group", sector: "Financials" },
    ],
  },
  {
    code: "XETR",
    name: "Xetra (Deutsche Börse)",
    country: "Germany",
    region: "EMEA",
    timezone: "Europe/Berlin",
    yahooSuffix: ".DE",
    lat: 50.1109,
    lng: 8.6821,
    companies: [
      { ticker: "SAP", name: "SAP SE", sector: "Technology" },
      { ticker: "SIE", name: "Siemens AG", sector: "Industrials" },
      { ticker: "ALV", name: "Allianz SE", sector: "Insurance" },
      { ticker: "DTE", name: "Deutsche Telekom", sector: "Telecommunications" },
      { ticker: "BAS", name: "BASF SE", sector: "Materials" },
      { ticker: "BMW", name: "Bayerische Motoren Werke", sector: "Automotive" },
      { ticker: "MBG", name: "Mercedes-Benz Group", sector: "Automotive" },
      { ticker: "VOW3", name: "Volkswagen AG", sector: "Automotive" },
      { ticker: "MUV2", name: "Münchener Rück (Munich Re)", sector: "Insurance" },
      { ticker: "IFX", name: "Infineon Technologies", sector: "Technology" },
      { ticker: "DBK", name: "Deutsche Bank", sector: "Banking" },
      { ticker: "ADS", name: "Adidas AG", sector: "Consumer Goods" },
    ],
  },
  {
    code: "EPA",
    name: "Euronext Paris",
    country: "France",
    region: "EMEA",
    timezone: "Europe/Paris",
    yahooSuffix: ".PA",
    lat: 48.8698,
    lng: 2.3412,
    companies: [
      { ticker: "MC", name: "LVMH Moët Hennessy Louis Vuitton", sector: "Consumer Goods" },
      { ticker: "OR", name: "L'Oréal", sector: "Consumer Goods" },
      { ticker: "TTE", name: "TotalEnergies", sector: "Energy" },
      { ticker: "SAN", name: "Sanofi", sector: "Healthcare" },
      { ticker: "AIR", name: "Airbus SE", sector: "Aerospace" },
      { ticker: "BNP", name: "BNP Paribas", sector: "Banking" },
      { ticker: "SU", name: "Schneider Electric", sector: "Industrials" },
      { ticker: "RMS", name: "Hermès International", sector: "Consumer Goods" },
      { ticker: "EL", name: "EssilorLuxottica", sector: "Healthcare" },
      { ticker: "CS", name: "AXA SA", sector: "Insurance" },
      { ticker: "DG", name: "Vinci SA", sector: "Industrials" },
      { ticker: "KER", name: "Kering", sector: "Consumer Goods" },
    ],
  },
  {
    code: "AMS",
    name: "Euronext Amsterdam",
    country: "Netherlands",
    region: "EMEA",
    timezone: "Europe/Amsterdam",
    yahooSuffix: ".AS",
    lat: 52.3676,
    lng: 4.9041,
    companies: [
      { ticker: "ASML", name: "ASML Holding", sector: "Technology" },
      { ticker: "INGA", name: "ING Groep", sector: "Banking" },
      { ticker: "AD", name: "Ahold Delhaize", sector: "Retail" },
      { ticker: "PHIA", name: "Koninklijke Philips", sector: "Healthcare" },
      { ticker: "HEIA", name: "Heineken NV", sector: "Consumer Goods" },
      { ticker: "WKL", name: "Wolters Kluwer", sector: "Technology" },
      { ticker: "AKZA", name: "Akzo Nobel", sector: "Materials" },
      { ticker: "DSFIR", name: "DSM-Firmenich", sector: "Materials" },
    ],
  },
  {
    code: "SIX",
    name: "SIX Swiss Exchange",
    country: "Switzerland",
    region: "EMEA",
    timezone: "Europe/Zurich",
    yahooSuffix: ".SW",
    lat: 47.3769,
    lng: 8.5417,
    companies: [
      { ticker: "NESN", name: "Nestlé SA", sector: "Consumer Goods" },
      // ROG is the SMI-constituent participation certificate, but Yahoo files
      // Roche's fundamentals under the bearer share, RO.SW. Same company, same
      // financials — only the quoted line differs.
      { ticker: "ROG", name: "Roche Holding", sector: "Healthcare", yahooSymbol: "RO.SW" },
      { ticker: "NOVN", name: "Novartis AG", sector: "Healthcare" },
      { ticker: "UBSG", name: "UBS Group", sector: "Banking" },
      { ticker: "ZURN", name: "Zurich Insurance Group", sector: "Insurance" },
      { ticker: "ABBN", name: "ABB Ltd", sector: "Industrials" },
      { ticker: "CFR", name: "Compagnie Financière Richemont", sector: "Consumer Goods" },
      { ticker: "LONN", name: "Lonza Group", sector: "Healthcare" },
      { ticker: "SIKA", name: "Sika AG", sector: "Materials" },
      { ticker: "GIVN", name: "Givaudan SA", sector: "Materials" },
    ],
  },
  {
    code: "TSE",
    name: "Tokyo Stock Exchange",
    country: "Japan",
    region: "APAC",
    timezone: "Asia/Tokyo",
    yahooSuffix: ".T",
    lat: 35.6845,
    lng: 139.7784,
    companies: [
      { ticker: "7203", name: "Toyota Motor Corporation", sector: "Automotive" },
      { ticker: "6758", name: "Sony Group Corporation", sector: "Technology" },
      { ticker: "6861", name: "Keyence Corporation", sector: "Industrials" },
      { ticker: "8306", name: "Mitsubishi UFJ Financial Group", sector: "Banking" },
      { ticker: "9984", name: "SoftBank Group", sector: "Technology" },
      { ticker: "6098", name: "Recruit Holdings", sector: "Services" },
      { ticker: "9432", name: "Nippon Telegraph and Telephone", sector: "Telecommunications" },
      { ticker: "4063", name: "Shin-Etsu Chemical", sector: "Materials" },
      { ticker: "8035", name: "Tokyo Electron", sector: "Technology" },
      { ticker: "7974", name: "Nintendo Co., Ltd.", sector: "Consumer Goods" },
      { ticker: "6501", name: "Hitachi, Ltd.", sector: "Industrials" },
      { ticker: "7267", name: "Honda Motor Co., Ltd.", sector: "Automotive" },
    ],
  },
  {
    code: "HKEX",
    name: "Hong Kong Stock Exchange",
    country: "Hong Kong",
    region: "APAC",
    timezone: "Asia/Hong_Kong",
    yahooSuffix: ".HK",
    lat: 22.2839,
    lng: 114.1588,
    companies: [
      { ticker: "0700", name: "Tencent Holdings", sector: "Technology" },
      { ticker: "9988", name: "Alibaba Group Holding", sector: "Technology" },
      { ticker: "0941", name: "China Mobile", sector: "Telecommunications" },
      { ticker: "1299", name: "AIA Group", sector: "Insurance" },
      { ticker: "0388", name: "Hong Kong Exchanges and Clearing", sector: "Financials" },
      { ticker: "3690", name: "Meituan", sector: "Technology" },
      { ticker: "1810", name: "Xiaomi Corporation", sector: "Technology" },
      { ticker: "2318", name: "Ping An Insurance", sector: "Insurance" },
      { ticker: "0883", name: "CNOOC Limited", sector: "Energy" },
      { ticker: "0005", name: "HSBC Holdings plc", sector: "Banking" },
    ],
  },
  {
    code: "SGX",
    name: "Singapore Exchange",
    country: "Singapore",
    region: "APAC",
    timezone: "Asia/Singapore",
    yahooSuffix: ".SI",
    lat: 1.2831,
    lng: 103.8515,
    companies: [
      { ticker: "D05", name: "DBS Group Holdings", sector: "Banking" },
      { ticker: "O39", name: "Oversea-Chinese Banking Corporation", sector: "Banking" },
      { ticker: "U11", name: "United Overseas Bank", sector: "Banking" },
      { ticker: "Z74", name: "Singapore Telecommunications", sector: "Telecommunications" },
      { ticker: "C6L", name: "Singapore Airlines", sector: "Transportation" },
      { ticker: "F34", name: "Wilmar International", sector: "Agriculture" },
      { ticker: "BN4", name: "Keppel Ltd", sector: "Industrials" },
    ],
  },
  {
    // India's dominant venue by volume. Code is NSE_IN, not NSE — that belongs
    // to the Nairobi Securities Exchange, which was seeded first.
    code: "NSE_IN",
    name: "National Stock Exchange of India",
    country: "India",
    region: "APAC",
    timezone: "Asia/Kolkata",
    yahooSuffix: ".NS",
    lat: 19.0607,
    lng: 72.8657,
    companies: [
      { ticker: "RELIANCE", name: "Reliance Industries", sector: "Energy" },
      { ticker: "TCS", name: "Tata Consultancy Services", sector: "Technology" },
      { ticker: "HDFCBANK", name: "HDFC Bank", sector: "Banking" },
      { ticker: "INFY", name: "Infosys", sector: "Technology" },
      { ticker: "ICICIBANK", name: "ICICI Bank", sector: "Banking" },
      { ticker: "BHARTIARTL", name: "Bharti Airtel", sector: "Telecommunications" },
      { ticker: "ITC", name: "ITC Limited", sector: "Consumer Goods" },
      { ticker: "LT", name: "Larsen & Toubro", sector: "Industrials" },
      { ticker: "SBIN", name: "State Bank of India", sector: "Banking" },
      { ticker: "HINDUNILVR", name: "Hindustan Unilever", sector: "Consumer Goods" },
    ],
  },
  {
    // Most large Indian companies dual-list on NSE and BSE. The two lists are
    // kept disjoint so the same company isn't ingested and analysed twice.
    code: "BSE",
    name: "BSE (Bombay Stock Exchange)",
    country: "India",
    region: "APAC",
    timezone: "Asia/Kolkata",
    yahooSuffix: ".BO",
    lat: 18.9298,
    lng: 72.8336,
    companies: [
      { ticker: "MARUTI", name: "Maruti Suzuki India", sector: "Automotive" },
      { ticker: "BAJFINANCE", name: "Bajaj Finance", sector: "Financials" },
      { ticker: "ASIANPAINT", name: "Asian Paints", sector: "Materials" },
      { ticker: "AXISBANK", name: "Axis Bank", sector: "Banking" },
      { ticker: "KOTAKBANK", name: "Kotak Mahindra Bank", sector: "Banking" },
      { ticker: "TITAN", name: "Titan Company", sector: "Consumer Goods" },
      { ticker: "SUNPHARMA", name: "Sun Pharmaceutical Industries", sector: "Healthcare" },
      { ticker: "NESTLEIND", name: "Nestlé India", sector: "Consumer Goods" },
    ],
  },
  {
    code: "SSE",
    name: "Shanghai Stock Exchange",
    country: "China",
    region: "APAC",
    timezone: "Asia/Shanghai",
    yahooSuffix: ".SS",
    lat: 31.2304,
    lng: 121.4737,
    companies: [
      { ticker: "600519", name: "Kweichow Moutai", sector: "Consumer Goods" },
      { ticker: "601398", name: "Industrial and Commercial Bank of China", sector: "Banking" },
      { ticker: "601857", name: "PetroChina", sector: "Energy" },
      { ticker: "600036", name: "China Merchants Bank", sector: "Banking" },
      { ticker: "601288", name: "Agricultural Bank of China", sector: "Banking" },
      { ticker: "600900", name: "China Yangtze Power", sector: "Utilities" },
      { ticker: "601988", name: "Bank of China", sector: "Banking" },
      { ticker: "600030", name: "CITIC Securities", sector: "Financials" },
    ],
  },
  {
    code: "SZSE",
    name: "Shenzhen Stock Exchange",
    country: "China",
    region: "APAC",
    timezone: "Asia/Shanghai",
    yahooSuffix: ".SZ",
    lat: 22.5431,
    lng: 114.0579,
    companies: [
      { ticker: "000001", name: "Ping An Bank", sector: "Banking" },
      { ticker: "300750", name: "Contemporary Amperex Technology (CATL)", sector: "Industrials" },
      { ticker: "000858", name: "Wuliangye Yibin", sector: "Consumer Goods" },
      { ticker: "002594", name: "BYD Company", sector: "Automotive" },
      { ticker: "000333", name: "Midea Group", sector: "Consumer Goods" },
      { ticker: "300059", name: "East Money Information", sector: "Financials" },
      { ticker: "002415", name: "Hikvision", sector: "Technology" },
    ],
  },
];
