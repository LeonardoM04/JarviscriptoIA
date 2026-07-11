export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type Series = (number | null)[];

export interface Indicators {
  ema21: Series;
  ema50: Series;
  ema200: Series;
  rsi14: Series;
  macd: { macd: Series; signal: Series; histogram: Series };
  bollinger: { upper: Series; middle: Series; lower: Series };
}

export interface PatternHit {
  time: number;
  name: string;
  direction: "bullish" | "bearish" | "neutral";
}

export interface Score {
  score: number;
  momentum: "acumulação" | "lateral" | "distribuição";
  label: string;
}

export interface Point { time: number; price: number; }
export interface Line { p1: Point; p2: Point; }

export interface Structures {
  trendUp: Line | null;
  trendDown: Line | null;
  channel: { upper: Line; lower: Line } | null;
  halvings: number[];
  cycle: { phase: string; note: string };
}

export interface KlinesResponse {
  symbol: string;
  interval: string;
  candles: Candle[];
  indicators: Indicators;
  patterns: PatternHit[];
  score: Score;
  structures: Structures;
}

export interface Ticker {
  lastPrice: number;
  price24hPcnt: number;
  highPrice24h: number;
  lowPrice24h: number;
  volume24h: number;
}

export interface FearGreed {
  value: number;
  label: string;
}

export interface Derivatives {
  available: boolean;
  fundingRate: number | null;
  openInterest: number | null;
  openInterestValueUsd: number | null;
  oiTrend: "subindo" | "caindo" | "estável" | null;
  buyRatio: number | null;
  sellRatio: number | null;
}

export interface Liquidation {
  time: number; // ms
  side: "long" | "short"; // qual lado foi liquidado
  price: number;
  sizeUsd: number;
}

export interface MarketCoin {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  total_volume: number;
  price_change_percentage_1h: number | null;
  price_change_percentage_24h: number | null;
  price_change_percentage_7d: number | null;
  sparkline: number[];
}

export interface GlobalData {
  totalMarketCapUsd: number;
  marketCapChange24h: number;
  btcDominance: number;
  ethDominance: number;
}

export interface CoinDetail {
  id: string;
  name: string;
  symbol: string;
  description: string;
  categories: string[];
  marketCapRank: number | null;
  athChangePct: number | null;
  atlChangePct: number | null;
  circulatingSupply: number | null;
  maxSupply: number | null;
  homepage: string | null;
}

export interface NewsItem {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  currencies: string[];
  sentiment: "positivo" | "negativo" | "neutro";
}

export interface Analysis {
  veredito: string;
  tendencia: "alta" | "baixa" | "lateral";
  forca_tendencia: "fraca" | "moderada" | "forte";
  confluencia: string;
  leitura_de_ciclo: string;
  tese: string;
  invalidacao: string;
  sinais_alta: string[];
  sinais_baixa: string[];
  derivativos_leitura: string;
  noticias_impacto: string;
  plano: {
    zona_entrada: string;
    alvos: number[];
    stop: number;
    tamanho_sugerido: string;
    horizonte: string;
  };
  riscos: string[];
  recomendacao: string;
  confianca: number;
}

export interface StockQuote {
  symbol: string;
  name: string;
  display: string;
  price: number;
  changePct: number;
  currency: string;
  sparkline: number[];
}

export interface StockGroupData {
  id: string;
  label: string;
  stocks: StockQuote[];
}

export interface StockNewsItem {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
}

export interface StockDetail extends KlinesResponse {
  name: string | null;
  quote: { price: number; changePct: number; currency: string };
  news: StockNewsItem[];
}

export interface PortfolioTx {
  id: string;
  symbol: string;
  assetType: "cripto" | "acao";
  side: "compra" | "venda";
  quantity: number;
  price: number;
  person: string;
  note?: string;
  createdAt: string;
}

export interface Position {
  symbol: string;
  assetType: "cripto" | "acao";
  quantity: number;
  avgPrice: number;
  invested: number;
  realizedPnl: number;
  currentPrice?: number;
  marketValue?: number;
  unrealizedPnl?: number;
}

export interface PortfolioData {
  transactions: PortfolioTx[];
  positions: Position[];
  people: { person: string; net: number }[];
  summary: {
    totalInvested: number;
    totalMarket: number;
    totalUnrealized: number;
    totalUnrealizedPct: number;
    totalRealized: number;
  };
  storageMode: string;
}

export interface AnalyzeResponse {
  symbol: string;
  ticker: Ticker;
  fearGreed: FearGreed | null;
  derivatives: Derivatives;
  global: GlobalData | null;
  coinDetail: CoinDetail | null;
  news: NewsItem[];
  score: Score;
  usedVision: boolean;
  analysis: Analysis;
  generatedAt: string;
}
