"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  Brush,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

type StockHistoryPoint = {
  date: string;
  close: number;
  volume: number;
};

type StockData = {
  symbol: string;
  latest_close: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  history: StockHistoryPoint[];
};

type Recommendation = "BUY" | "HOLD" | "AVOID";
type InvestmentGoal = "short" | "medium" | "long";
type CurrencyCode = "USD" | "INR" | "EUR" | "GBP" | "AED";
type AppView = "home" | "invest" | "opportunities" | "analyze" | "portfolio";
type RiskProfile = "safe" | "balanced" | "aggressive";

type OpportunityUniverseItem = {
  market: "India" | "US";
  name: string;
  symbol: string;
};

type TransformerSummary = {
  recommendation: Recommendation;
  confidence: number;
};

type SentimentSummary = {
  sentiment: "positive" | "neutral" | "negative";
  positive_score: number;
  neutral_score: number;
  negative_score: number;
  headlines_analyzed: number;
  duplicate_headlines_removed?: number | null;
  unique_headlines_count?: number | null;
  news_source?: string | null;
  fallback_reason?: string | null;
  strict_filter_fallback?: boolean | null;
};

type AnalysisData = {
  symbol: string;
  final_recommendation: Recommendation;
  confidence: number;
  risk_level: string;
  suggested_allocation: string;
  transformer_prediction: TransformerSummary | null;
  sentiment_analysis: SentimentSummary | null;
  transformer_error?: string;
  sentiment_error?: string;
  explanation: string;
};

type TradeLogEntry = {
  date: string;
  action: "BUY" | "SELL" | string;
  execution_price: number;
  shares_traded: number;
  portfolio_value_after_trade: number;
  transaction_cost: number;
  reason: string;
};

type PortfolioHistoryPoint = {
  date: string;
  ai_value: number;
  ai_return_percent: number;
  buy_hold_value: number;
  buy_hold_return_percent: number;
};

type PortfolioChartPoint = PortfolioHistoryPoint & {
  trade_action?: string | null;
  execution_price?: number | null;
  trade_reason?: string | null;
};

type BacktestData = {
  symbol: string;
  test_period_start: string;
  test_period_end: string;
  starting_capital: number;
  final_value: number;
  strategy_return_percent: number;
  buy_hold_return_percent: number;
  number_of_trades?: number;
  total_trades?: number;
  win_rate: number;
  max_drawdown: number;
  transaction_costs_paid: number;
  portfolio_history?: PortfolioHistoryPoint[];
  trade_log: TradeLogEntry[];
  benchmark?: {
    name: string;
    final_value: number;
    return_percent: number;
    transaction_costs_paid: number;
  };
  summary: string;
  warning?: string;
};

type ResolvedStock = {
  query: string;
  symbol: string;
  name: string;
  market: string;
  source?: string;
};

type StockMatch = {
  symbol: string;
  name: string;
  market: string;
};

type ResolveResponse = ResolvedStock & {
  matches?: StockMatch[];
  message?: string;
};

type CompanyProfile = {
  symbol: string;
  name: string;
  sector: string;
  industry: string;
  market: string;
  currency: string;
  website?: string | null;
  summary: string;
  market_cap?: number | null;
};

type Verdict = {
  label: "Strong historical performance" | "Mixed historical performance" | "Weak historical performance";
  shortLabel: "Strong" | "Mixed" | "Weak";
  tone: "positive" | "neutral" | "negative";
  description: string;
  rating: string;
};

type OpportunityScoreComponent = {
  label: string;
  note: string;
  value: number;
};

type ScannedOpportunity = {
  analysis: AnalysisData;
  backtest: BacktestData | null;
  components: OpportunityScoreComponent[];
  confidence: number;
  expectedHold: string;
  market: string;
  name: string;
  potentialLossRate: number;
  potentialProfitRate: number;
  profile: CompanyProfile | null;
  riskRewardLabel: string;
  riskRewardRatio: number | null;
  score: number;
  scoreBand: string;
  stock: StockData | null;
  symbol: string;
  why: string[];
};

type AllocationPosition = ScannedOpportunity & {
  amount: number;
  amountLabel: string;
};

type AllocationBucketKind = "index" | "stocks" | "gold" | "cash" | "highRisk";

type AllocationBucketAsset = {
  amount: number;
  amountLabel: string;
  available?: boolean;
  current_price?: number | null;
  currentPrice?: number | null;
  expected_return?: number | null;
  name: string;
  priceSource?: {
    fallbackUsed: boolean;
    provider: string;
    symbol: string | null;
  } | null;
  proxyType?: "Gold ETF" | "Gold Futures" | "Gold Proxy";
  reason: string;
  risk: string;
  score: number;
  sector?: string;
  symbol: string;
  trend: string;
};

type AllocationBucket = {
  amount: number;
  amountLabel: string;
  assets?: AllocationBucketAsset[];
  description: string;
  kind: AllocationBucketKind;
  lockedByUser?: boolean;
  percent: number;
  reason?: string;
  score?: number;
  suggestion: string;
  title: string;
};

type InvestmentPlanResult = {
  allocationDiagnostics?: {
    cashPressure: number;
    diversificationScore: number;
    marketRegime: string;
    marketSentiment: number;
    opportunityStrength: number;
    riskAdjustment: number;
  };
  bucketScores?: Record<string, number>;
  buckets: AllocationBucket[];
  cashAmount: number;
  cashAmountLabel: string;
  cashReason: string;
  cachePolicy?: {
    backtestSeconds: number;
    fastScanSeconds?: number;
    pricePredictionSeconds: number;
    sentimentSeconds: number;
  };
  cryptoCandidates?: {
    allocation: number;
    allocationLabel: string;
    available?: boolean;
    current_price?: number | null;
    name: string;
    priceSource?: {
      fallbackUsed: boolean;
      provider: string;
      symbol: string | null;
    } | null;
    reason: string;
    score: number;
    symbol: string;
    trend: string;
  }[];
  currency: CurrencyCode;
  failedCount: number;
  horizon: InvestmentGoal;
  investAmount: number;
  investAmountLabel: string;
  marketRegime?: {
    label: string;
    market: string;
    momentumScore: number;
    score: number;
    trendScore: number;
    volatilityScore: number;
  };
  marketSentiment?: {
    label: string;
    reason: string;
    score: number;
    source?: "derived" | "news" | "market_data" | "fallback_neutral";
  };
  overrideSummary?: {
    bucket: string;
    final: string;
    reason: string;
    requested: string;
    status: "applied" | "adjusted";
  }[];
  planExplanation?: string;
  preferenceAdjustedPlanExplanation?: string | null;
  policyHighlights: string[];
  positions: AllocationPosition[];
  preferenceNote: string;
  preferenceSummary?: {
    preference: string;
    reason: string;
    status: "applied" | "adjusted" | string;
  }[];
  progress?: string[];
  ranked: ScannedOpportunity[];
  rebalanceExplanation?: string | null;
  riskProfile: RiskProfile;
  scannedCount: number;
  sectorSentiment?: Record<string, number>;
  shortlistCount?: number;
  deepAnalyzedCount?: number;
  userOverridesApplied?: boolean;
  userPreferencesApplied?: boolean;
  universeCount?: number;
  warnings?: string[];
};

type UserPreferences = {
  cashPreference?: "default" | "keep_more_cash" | "keep_less_cash";
  cryptoPreference?: "default" | "allow_crypto" | "avoid_crypto";
  goldPreference?: "default" | "increase_gold" | "reduce_gold" | "avoid_gold";
  sectorAvoid?: string[];
  stockPreference?: "default" | "increase_direct_stocks" | "reduce_direct_stocks" | "avoid_direct_stocks";
};

type PlannerFormState = {
  amount: string;
  currency: CurrencyCode;
  horizon: InvestmentGoal;
  riskProfile: RiskProfile;
  userPreferences?: UserPreferences;
};

type PlannerRequest = {
  id: number;
  input: PlannerFormState;
};

const quickSymbolGroups = [
  {
    label: "US",
    symbols: ["Apple", "Microsoft", "Google", "Nvidia"],
  },
  {
    label: "India",
    symbols: ["Reliance", "TCS", "Infosys", "HDFC Bank", "ICICI Bank", "SBI"],
  },
];

const navItems: { label: string; view: AppView }[] = [
  { label: "Home", view: "home" },
  { label: "Invest My Money", view: "invest" },
  { label: "Find Opportunities", view: "opportunities" },
  { label: "Analyze Stock", view: "analyze" },
  { label: "Portfolio", view: "portfolio" },
];

const toolCards: {
  title: string;
  description: string;
  buttonLabel: string;
  view: AppView;
  disabled?: boolean;
}[] = [
  {
    title: "Find Opportunities",
    description: "See the best AI-ranked opportunities across markets.",
    buttonLabel: "Scan Market",
    view: "opportunities",
  },
  {
    title: "Analyze Stock",
    description: "Search any stock and view AI verdict, profit outlook, and exit strategy.",
    buttonLabel: "Analyze a Stock",
    view: "analyze",
  },
  {
    title: "Portfolio Assistant",
    description: "Review your holdings and find diversification gaps.",
    buttonLabel: "Coming Soon",
    view: "portfolio",
    disabled: true,
  },
];

const allocationPlaceholders = [
  "Stocks",
  "Index / SIP",
  "Cash buffer",
  "Gold / ETF",
  "Crypto / high-risk",
];

const homePlanPlaceholders = ["Stocks", "SIPs", "Gold", "Cash Buffer"];

// Placeholder public brief content until a live AI Daily Brief endpoint is available.
const publicDailyBrief = {
  conclusion: "Patience is likely to matter more than speed today.",
  mood: "Calm",
  moodLabel: "Mood",
  reasons: [
    "Investors are waiting for central bank guidance.",
    "Inflation pressure continues to ease.",
    "Defensive sectors remain steady.",
  ],
};

const publicWatchItems = [
  {
    detail: "Rate language could set the tone for risk.",
    title: "Central bank guidance",
  },
  {
    detail: "Company guidance may show where strength is real.",
    title: "Earnings quality",
  },
  {
    detail: "Currency moves can affect global exposure.",
    title: "Currency moves",
  },
];

const publicMarketConditions = [
  {
    label: "Mood",
    note: "Steady, with investors waiting for direction.",
    value: "Calm",
  },
  {
    label: "Risk Environment",
    note: "Careful positioning still makes sense.",
    value: "Moderate",
  },
  {
    label: "Opportunity Level",
    note: "Quality matters more than speed.",
    value: "Selective",
  },
];

const opportunityPlaceholders = [
  { name: "Reliance Industries", score: "8.4 / 10", setup: "Strong", risk: "Medium" },
  { name: "Microsoft", score: "8.1 / 10", setup: "Quality compounder", risk: "Low" },
  { name: "Nvidia", score: "7.7 / 10", setup: "Momentum", risk: "High" },
  { name: "HDFC Bank", score: "7.5 / 10", setup: "Value recovery", risk: "Medium" },
];

const opportunityUniverse: OpportunityUniverseItem[] = [
  { market: "India", name: "Reliance Industries", symbol: "RELIANCE.NS" },
  { market: "India", name: "Tata Consultancy Services", symbol: "TCS.NS" },
  { market: "India", name: "Infosys", symbol: "INFY.NS" },
  { market: "India", name: "HDFC Bank", symbol: "HDFCBANK.NS" },
  { market: "India", name: "ICICI Bank", symbol: "ICICIBANK.NS" },
  { market: "India", name: "State Bank of India", symbol: "SBIN.NS" },
  { market: "India", name: "ITC", symbol: "ITC.NS" },
  { market: "India", name: "Bharti Airtel", symbol: "BHARTIARTL.NS" },
  { market: "US", name: "Apple", symbol: "AAPL" },
  { market: "US", name: "Microsoft", symbol: "MSFT" },
  { market: "US", name: "Nvidia", symbol: "NVDA" },
  { market: "US", name: "Alphabet", symbol: "GOOGL" },
  { market: "US", name: "Amazon", symbol: "AMZN" },
  { market: "US", name: "Meta Platforms", symbol: "META" },
  { market: "US", name: "Tesla", symbol: "TSLA" },
];

export default function Home() {
  const [showPublicExperience, setShowPublicExperience] = useState(true);
  const [activeView, setActiveView] = useState<AppView>("home");
  const [symbol, setSymbol] = useState("");
  const [amountInput, setAmountInput] = useState("10000");
  const [investmentGoal, setInvestmentGoal] = useState<InvestmentGoal>("medium");
  const [currencyOverride, setCurrencyOverride] = useState<CurrencyCode | null>(null);
  const [stockData, setStockData] = useState<StockData | null>(null);
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [backtestData, setBacktestData] = useState<BacktestData | null>(null);
  const [resolvedStock, setResolvedStock] = useState<ResolvedStock | null>(null);
  const [searchMatches, setSearchMatches] = useState<StockMatch[]>([]);
  const [searchMessage, setSearchMessage] = useState("");
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [stockError, setStockError] = useState("");
  const [analysisError, setAnalysisError] = useState("");
  const [backtestError, setBacktestError] = useState("");
  const [profileError, setProfileError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [plannerRequest, setPlannerRequest] = useState<PlannerRequest | null>(null);

  async function analyzeStock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanSymbol = symbol.trim().toUpperCase();

    if (!cleanSymbol) {
      setStockError("Please enter a stock symbol before analyzing.");
      setAnalysisError("");
      setBacktestError("");
      setProfileError("");
      setStockData(null);
      setAnalysisData(null);
      setBacktestData(null);
      setResolvedStock(null);
      setSearchMatches([]);
      setSearchMessage("");
      setCompanyProfile(null);
      return;
    }

    setIsLoading(true);
    setStockError("");
    setAnalysisError("");
    setBacktestError("");
    setProfileError("");
    setStockData(null);
    setAnalysisData(null);
    setBacktestData(null);
    setResolvedStock(null);
    setSearchMatches([]);
    setSearchMessage("");
    setCompanyProfile(null);

    try {
      const resolved = await fetchJson<ResolveResponse>(`${apiUrl}/resolve/${encodeURIComponent(cleanSymbol)}`);
      if (resolved.matches?.length) {
        setSearchMatches(resolved.matches);
        setSearchMessage(resolved.message ?? "Multiple matches found. Please choose one.");
        setIsLoading(false);
        return;
      }

      await loadResolvedStock(resolved);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not resolve stock search.";
      setStockError(message);
      setIsLoading(false);
      return;
    }
  }

  async function loadResolvedStock(resolved: ResolvedStock) {
    setIsLoading(true);
    setStockError("");
    setAnalysisError("");
    setBacktestError("");
    setProfileError("");
    setSearchMatches([]);
    setSearchMessage("");
    setStockData(null);
    setAnalysisData(null);
    setBacktestData(null);
    setCompanyProfile(null);
    setCurrencyOverride(null);
    setResolvedStock(resolved);

    const encodedSymbol = encodeURIComponent(resolved.symbol);
    const stockRequest = fetchJson<StockData>(`${apiUrl}/stock/${encodedSymbol}`);
    const analysisRequest = fetchJson<AnalysisData>(`${apiUrl}/analysis/${encodedSymbol}`);
    const backtestRequest = fetchJson<BacktestData>(`${apiUrl}/backtest/${encodedSymbol}`);
    const profileRequest = fetchJson<CompanyProfile>(`${apiUrl}/profile/${encodedSymbol}`);

    const [stockResult, analysisResult, backtestResult, profileResult] = await Promise.allSettled([
      stockRequest,
      analysisRequest,
      backtestRequest,
      profileRequest,
    ]);

    if (stockResult.status === "fulfilled") {
      setStockData(stockResult.value);
    } else {
      setStockError(stockResult.reason.message);
    }

    if (analysisResult.status === "fulfilled") {
      setAnalysisData(analysisResult.value);
    } else {
      setAnalysisError(analysisResult.reason.message);
    }

    if (backtestResult.status === "fulfilled") {
      setBacktestData(backtestResult.value);
    } else {
      setBacktestError(backtestResult.reason.message);
    }

    if (profileResult.status === "fulfilled") {
      setCompanyProfile(profileResult.value);
    } else {
      setProfileError(profileResult.reason.message);
    }

    setIsLoading(false);
  }

  const activeSymbol = resolvedStock?.symbol ?? stockData?.symbol ?? analysisData?.symbol ?? backtestData?.symbol ?? symbol.trim().toUpperCase();
  const market = getMarketInfo(activeSymbol);
  const selectedCurrency = currencyOverride ?? detectDefaultCurrency(activeSymbol, companyProfile?.currency);

  function enterApp(view: AppView) {
    setActiveView(view);
    setShowPublicExperience(false);
  }

  if (showPublicExperience) {
    return (
      <PublicHomePage
        onBuildPlan={() => enterApp("invest")}
        onSignIn={() => enterApp("home")}
      />
    );
  }

  return (
    <main className="dashboard">
      <AppHeader activeView={activeView} onNavigate={setActiveView} />

      {activeView === "home" ? (
        <HomePage
          onNavigate={setActiveView}
          onStartPlan={(input) => {
            setPlannerRequest({ id: Date.now(), input });
            setActiveView("invest");
          }}
        />
      ) : null}

      {activeView === "invest" ? (
        <InvestMyMoneyPage
          initialRequest={plannerRequest}
          onAnalyze={(opportunity) => {
            setActiveView("analyze");
            setSymbol(opportunity.symbol);
            loadResolvedStock({
              query: opportunity.symbol,
              symbol: opportunity.symbol,
              name: opportunity.name,
              market: opportunity.market,
              source: "investment_plan",
            });
          }}
        />
      ) : null}

      {activeView === "opportunities" ? (
        <FindOpportunitiesPage onAnalyze={() => setActiveView("analyze")} />
      ) : null}

      {activeView === "portfolio" ? <PortfolioAssistantPage /> : null}

      {activeView === "analyze" ? (
        <>
          <section className="analyzer-hero" aria-labelledby="analyze-title">
            <div>
              <p className="eyebrow">Analyze Stock</p>
              <h1 id="analyze-title">Research a stock before you act</h1>
              <p className="subtitle">
                Search any stock and review the MarketMind verdict, AI score,
                investment plan, profit outcome, exit strategy, profile, and backtest.
              </p>
            </div>

            <form className="search-panel" onSubmit={analyzeStock}>
              <label htmlFor="stock-symbol">Stock symbol</label>
              <div className="search-row">
                <input
                  id="stock-symbol"
                  name="stock-symbol"
                  placeholder="AAPL, MSFT, RELIANCE.NS"
                  value={symbol}
                  onChange={(event) => setSymbol(event.target.value)}
                />
                <button type="submit" disabled={isLoading}>
                  {isLoading ? "Analyzing..." : "Analyze Stock"}
                </button>
              </div>
              <p className="search-help">
                For Indian NSE stocks, you can type names like reliance, tcs, infosys,
                or use ticker format like RELIANCE.NS.
              </p>

              <div className="quick-symbols" aria-label="Quick stock symbols">
                {quickSymbolGroups.map((group) => (
                  <div key={group.label} className="quick-group">
                    <span>{group.label}</span>
                    <div className="examples">
                      {group.symbols.map((example) => (
                        <button
                          key={example}
                          type="button"
                          onClick={() => setSymbol(example)}
                        >
                          {example}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </form>
          </section>

      {stockError ? <p className="status error">{stockError}</p> : null}

      {analysisError ? (
        <p className="status warning">AI analysis unavailable: {analysisError}</p>
      ) : null}

      {backtestError ? (
        <p className="status warning">Backtest unavailable: {backtestError}</p>
      ) : null}

      {profileError ? (
        <p className="status warning">Company profile unavailable: {profileError}</p>
      ) : null}

      {isLoading ? (
        <section className="status loading" aria-label="Analyzer loading">
          <div className="opportunity-loading inline-loading">
            <span className="loading-dot" />
            <strong>Analyzing opportunities...</strong>
            <div className="shimmer-line" />
          </div>
          <div className="loading-skeleton-grid" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </section>
      ) : null}

      {searchMatches.length ? (
        <SearchSuggestions
          matches={searchMatches}
          message={searchMessage}
          onChoose={(match) =>
            loadResolvedStock({
              query: symbol,
              symbol: match.symbol,
              name: match.name,
              market: match.market,
              source: "dynamic_lookup",
            })
          }
        />
      ) : null}

      {!stockData && !analysisData && !backtestData && !companyProfile && !stockError && !analysisError && !backtestError && !profileError && !searchMatches.length && !isLoading ? (
        <section className="empty-state">
          <h2>Start with a stock symbol</h2>
          <p>
            Try a company name like Apple or an Indian stock name like Reliance to see the AI view,
            recent price chart, and a simulated history of the AI strategy.
          </p>
        </section>
      ) : null}

      {stockData || analysisData || backtestData || companyProfile ? (
        <>
          {resolvedStock ? <ResolvedResult resolved={resolvedStock} /> : null}

          {analysisData ? (
            <ActionDashboard
              analysis={analysisData}
              amountInput={amountInput}
              backtest={backtestData}
              currentPrice={stockData?.latest_close ?? null}
              investmentGoal={investmentGoal}
              profileCurrency={companyProfile?.currency}
              selectedCurrency={selectedCurrency}
              setAmountInput={setAmountInput}
              setInvestmentGoal={setInvestmentGoal}
              setSelectedCurrency={(currency) => setCurrencyOverride(currency)}
              symbol={activeSymbol}
            />
          ) : null}

          {companyProfile ? (
            <CompanyProfileCard profile={companyProfile} />
          ) : null}

          {stockData ? (
            <MarketSummaryCard stock={stockData} />
          ) : null}

          {backtestData ? (
            <CollapsedPanel title="Backtest / Historical Performance">
              <HistoricalPerformance backtest={backtestData} />
            </CollapsedPanel>
          ) : null}

          {market.isIndia ? (
            <p className="status india-note">
              Predictions combine historical price patterns and recent financial news where available. Results are educational estimates, not financial advice.
            </p>
          ) : null}

          {analysisData ? <AdvancedAnalysis analysis={analysisData} backtest={backtestData} /> : null}
        </>
      ) : null}
        </>
      ) : null}
    </main>
  );
}

function PublicHomePage({
  onBuildPlan,
  onSignIn,
}: {
  onBuildPlan: () => void;
  onSignIn: () => void;
}) {
  return (
    <main className="public-page">
      <header className="public-header">
        <strong>MarketMind AI</strong>
        <button className="secondary-cta" type="button" onClick={onSignIn}>
          Sign In
        </button>
      </header>

      <section className="public-hero calm-reveal" aria-labelledby="public-hero-title">
        <div className="public-hero-copy">
          <h1 id="public-hero-title">Good morning.</h1>
          <p className="subtitle">
            Here&apos;s today&apos;s market story before you make a money decision.
          </p>
        </div>
      </section>

      <section className="daily-brief-section calm-reveal" aria-labelledby="brief-title">
        <h2 id="brief-title">Today&apos;s Brief</h2>
        <div className="brief-scan">
          <div className="brief-mood">
            <span className="mood-label">{publicDailyBrief.moodLabel}</span>
            <strong>
              <span className="mood-signal" aria-hidden="true" />
              {publicDailyBrief.mood}
            </strong>
          </div>
          <div className="brief-message">
            <p className="brief-conclusion">{publicDailyBrief.conclusion}</p>
            <span className="brief-reasons-label">Why</span>
            <ul className="brief-reasons" aria-label="Why MarketMind sees it this way">
              {publicDailyBrief.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="watch-section calm-reveal" aria-labelledby="watch-title">
        <div className="section-intro">
          <h2 id="watch-title">Things Worth Watching Today</h2>
        </div>
        <div className="watch-list-simple">
          {publicWatchItems.map((item) => (
            <article key={item.title} className="watch-item">
              <strong>{item.title}</strong>
              <p>{item.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="conditions-section calm-reveal" aria-labelledby="conditions-title">
        <div className="section-intro">
          <h2 id="conditions-title">Today&apos;s Market Conditions</h2>
        </div>
        <div className="condition-strip">
          {publicMarketConditions.map((item) => (
            <article key={item.label} className="condition-item">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <p>{item.note}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="next-step-section calm-reveal" aria-label="Next step">
        <p>Ready for personal advice?</p>
        <button className="text-cta" type="button" onClick={onBuildPlan}>
          Build your plan in Invest
        </button>
      </section>
    </main>
  );
}

function AppHeader({
  activeView,
  onNavigate,
}: {
  activeView: AppView;
  onNavigate: (view: AppView) => void;
}) {
  return (
    <header className="app-header">
      <button className="brand-button" type="button" onClick={() => onNavigate("home")}>
        MarketMind AI
      </button>
      <nav className="app-nav" aria-label="Main navigation">
        {navItems.map((item) => (
          <button
            key={item.view}
            className={activeView === item.view ? "active" : ""}
            type="button"
            onClick={() => onNavigate(item.view)}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </header>
  );
}

function HomePage({
  onNavigate,
  onStartPlan,
}: {
  onNavigate: (view: AppView) => void;
  onStartPlan: (input: PlannerFormState) => void;
}) {
  const [amount, setAmount] = useState("10000");
  const [currency, setCurrency] = useState<CurrencyCode>("INR");
  const [riskProfile, setRiskProfile] = useState<RiskProfile>("balanced");
  const [horizon, setHorizon] = useState<InvestmentGoal>("medium");

  return (
    <section className="home-page" aria-labelledby="home-title">
      <div className="home-hero">
        <div className="home-hero-copy">
          <p className="eyebrow">I Have Money To Invest</p>
          <h1 id="home-title">MarketMind AI</h1>
          <h2>Your Personal Finance Assistant</h2>
          <p className="subtitle">
            Tell us how much money you have, your risk level, and your investment horizon. We&apos;ll help you build an investment plan.
          </p>
          <div className="trust-indicators" aria-label="MarketMind planning features">
            <span>✓ Personalized Allocation</span>
            <span>✓ AI-Ranked Opportunities</span>
            <span>✓ Exit Strategy Included</span>
          </div>
        </div>

        <div className="home-action-stack">
          <form
            className="hero-planning-panel"
            onSubmit={(event) => {
              event.preventDefault();
              onStartPlan({ amount, currency, horizon, riskProfile });
            }}
          >
          <label>
            <span>How much money do you want to invest?</span>
            <input
              inputMode="numeric"
              placeholder="10000"
              type="text"
              value={amount}
              onChange={(event) => setAmount(cleanAmountInput(event.target.value))}
            />
          </label>

          <label>
            <span>What currency are you investing in?</span>
            <select value={currency} onChange={(event) => setCurrency(event.target.value as CurrencyCode)}>
              {currencyOptions.map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {currency.code} ({currency.symbol})
                </option>
              ))}
            </select>
          </label>

          <fieldset>
            <legend>How comfortable are you with risk?</legend>
            <div className="segmented-options">
              {riskProfileOptions.map((option) => (
                <label key={option.value}>
                  <input
                    checked={riskProfile === option.value}
                    name="home-risk-profile"
                    type="radio"
                    onChange={() => setRiskProfile(option.value)}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>When might you need this money?</legend>
            <div className="segmented-options">
              {investmentGoalOptions.map((option) => (
                <label key={option.value}>
                  <input
                    checked={horizon === option.value}
                    name="home-investment-horizon"
                    type="radio"
                    onChange={() => setHorizon(option.value)}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <button type="submit">Generate My Plan</button>

          </form>

          <section className="home-plan-preview" aria-labelledby="home-plan-title">
            <div>
              <h2 id="home-plan-title">Your Investment Plan</h2>
              <p>Waiting for your inputs...</p>
            </div>
            <div className="home-plan-grid">
              {homePlanPlaceholders.map((item) => (
                <article key={item}>
                  <span>{item}</span>
                  <strong>--%</strong>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>

      <section className="tools-section" aria-labelledby="tools-title">
        <div className="tools-heading">
          <p className="eyebrow">Tools & Insights</p>
          <h2 id="tools-title">Explore supporting tools when you need them.</h2>
        </div>

        <div className="tool-card-grid">
        {toolCards.map((card) => (
          <article key={card.title} className="home-card">
            <h3>{card.title}</h3>
            <p>{card.description}</p>
            <button
              type="button"
              disabled={card.disabled}
              onClick={() => onNavigate(card.view)}
            >
              {card.buttonLabel}
            </button>
          </article>
        ))}
        </div>
      </section>
    </section>
  );
}

function InvestMyMoneyPage({
  initialRequest,
  onAnalyze,
}: {
  initialRequest: PlannerRequest | null;
  onAnalyze: (opportunity: ScannedOpportunity) => void;
}) {
  const [amount, setAmount] = useState(initialRequest?.input.amount ?? "10000");
  const [currency, setCurrency] = useState<CurrencyCode>(initialRequest?.input.currency ?? "INR");
  const [riskProfile, setRiskProfile] = useState<RiskProfile>(initialRequest?.input.riskProfile ?? "balanced");
  const [horizon, setHorizon] = useState<InvestmentGoal>(initialRequest?.input.horizon ?? "medium");
  const [keepMoreCash, setKeepMoreCash] = useState(false);
  const [preferGold, setPreferGold] = useState(false);
  const [avoidCrypto, setAvoidCrypto] = useState(false);
  const [reduceDirectStocks, setReduceDirectStocks] = useState(false);
  const [avoidTechnology, setAvoidTechnology] = useState(false);
  const [plan, setPlan] = useState<InvestmentPlanResult | null>(null);
  const [scanError, setScanError] = useState("");
  const [scanMessage, setScanMessage] = useState("Scanning market...");
  const [isScanning, setIsScanning] = useState(false);
  const resultRef = useRef<HTMLDivElement | null>(null);

  async function runPlanScan(input: PlannerFormState) {
    const numericAmount = Number(input.amount);

    if (!numericAmount || numericAmount <= 0) {
      setScanError("Enter an amount greater than zero to generate a plan.");
      setPlan(null);
      return;
    }

    setIsScanning(true);
    setScanError("");
    setScanMessage("Scanning market...");
    const shortlistTimer = window.setTimeout(() => setScanMessage("Shortlisting best setups..."), 900);
    const marketTimer = window.setTimeout(() => setScanMessage("Analyzing market conditions..."), 1600);
    const buildTimer = window.setTimeout(() => setScanMessage("Building your portfolio..."), 2400);
    const minimumLoading = new Promise((resolve) => window.setTimeout(resolve, 1400));

    try {
      const nextPlan = await Promise.all([
        buildPersonalInvestmentPlan({
          amount: numericAmount,
          currency: input.currency,
          horizon: input.horizon,
          riskProfile: input.riskProfile,
          userPreferences: input.userPreferences,
        }),
        minimumLoading,
      ]).then(([result]) => result);
      setPlan(nextPlan);
      window.setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 120);
    } catch (error) {
      setPlan(null);
      setScanError(error instanceof Error ? error.message : "Could not generate an investment plan.");
    } finally {
      window.clearTimeout(shortlistTimer);
      window.clearTimeout(marketTimer);
      window.clearTimeout(buildTimer);
      setIsScanning(false);
    }
  }

  useEffect(() => {
    if (!initialRequest) {
      return;
    }

    const timer = window.setTimeout(() => {
      setAmount(initialRequest.input.amount);
      setCurrency(initialRequest.input.currency);
      setRiskProfile(initialRequest.input.riskProfile);
      setHorizon(initialRequest.input.horizon);
      void runPlanScan(initialRequest.input);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [initialRequest]);

  async function generatePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runPlanScan({
      amount,
      currency,
      horizon,
      riskProfile,
      userPreferences: {
        cashPreference: keepMoreCash ? "keep_more_cash" : "default",
        cryptoPreference: avoidCrypto ? "avoid_crypto" : "default",
        goldPreference: preferGold ? "increase_gold" : "default",
        sectorAvoid: avoidTechnology ? ["Technology"] : [],
        stockPreference: reduceDirectStocks ? "reduce_direct_stocks" : "default",
      },
    });
  }

  return (
    <section className="assistant-page" aria-labelledby="invest-title">
      <div className="page-heading">
        <p className="eyebrow">Invest My Money</p>
        <h1 id="invest-title">Let MarketMind scan first</h1>
        <p className="subtitle">Share your budget, risk profile, and timeline. MarketMind will rank opportunities and build a score-weighted plan.</p>
      </div>

      <div className="invest-flow">
        <section className="invest-input-section" aria-label="Investment preferences">
          <form className="planning-panel" onSubmit={generatePlan}>
            <label>
              <span>How much money do you want to invest?</span>
              <input
                inputMode="numeric"
                placeholder="10000"
                type="text"
                value={amount}
                onChange={(event) => setAmount(cleanAmountInput(event.target.value))}
              />
            </label>

            <label>
              <span>What currency are you investing in?</span>
              <select value={currency} onChange={(event) => setCurrency(event.target.value as CurrencyCode)}>
                {currencyOptions.map((currency) => (
                  <option key={currency.code} value={currency.code}>
                    {currency.code} ({currency.symbol})
                  </option>
                ))}
              </select>
            </label>

            <fieldset>
              <legend>How comfortable are you with risk?</legend>
              <div className="segmented-options">
                {riskProfileOptions.map((option) => (
                  <label key={option.value}>
                    <input
                      checked={riskProfile === option.value}
                      name="risk-profile"
                      type="radio"
                      onChange={() => setRiskProfile(option.value)}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend>When might you need this money?</legend>
              <div className="segmented-options">
                {investmentGoalOptions.map((option) => (
                  <label key={option.value}>
                    <input
                      checked={horizon === option.value}
                      name="time-horizon"
                      type="radio"
                      onChange={() => setHorizon(option.value)}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="preference-checks">
              <legend>Any preferences for this plan?</legend>
              <label>
                <input checked={keepMoreCash} type="checkbox" onChange={(event) => setKeepMoreCash(event.target.checked)} />
                <span>I want to keep more cash</span>
              </label>
              <label>
                <input checked={preferGold} type="checkbox" onChange={(event) => setPreferGold(event.target.checked)} />
                <span>I prefer more gold</span>
              </label>
              <label>
                <input checked={avoidCrypto} type="checkbox" onChange={(event) => setAvoidCrypto(event.target.checked)} />
                <span>Avoid crypto</span>
              </label>
              <label>
                <input checked={reduceDirectStocks} type="checkbox" onChange={(event) => setReduceDirectStocks(event.target.checked)} />
                <span>Reduce direct stocks</span>
              </label>
              <label>
                <input checked={avoidTechnology} type="checkbox" onChange={(event) => setAvoidTechnology(event.target.checked)} />
                <span>Avoid technology stocks</span>
              </label>
            </fieldset>

            <button type="submit" disabled={isScanning}>
              {isScanning ? (
                <span className="button-loading"><i aria-hidden="true" />Analyzing...</span>
              ) : (
                "Generate My Plan"
              )}
            </button>

            {scanError ? <p className="form-error">{scanError}</p> : null}
          </form>
        </section>

        {isScanning ? <PlanLoadingState message={scanMessage} /> : null}

        {plan ? (
          <section ref={resultRef} className="plan-result-section reveal-plan" aria-label="Recommended allocation">
            <InvestmentPlanResults
              onAnalyze={onAnalyze}
              plan={plan}
            />
          </section>
        ) : null}
      </div>
    </section>
  );
}

function PlanLoadingState({ message }: { message: string }) {
  return (
    <div className="plan-loading-state">
      <div className="opportunity-loading" aria-label="Investment plan loading">
        <span className="loading-dot" />
        <strong>{message}</strong>
        <div className="shimmer-line" />
      </div>
      <div className="loading-skeleton-grid" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

function PlanEmptyState() {
  return (
    <>
      <h2>Your suggested allocation will appear here.</h2>
      <p className="plan-muted">MarketMind will scan India and US opportunities, score each setup, and keep cash when quality is not strong enough.</p>
      <div className="allocation-grid">
        {allocationPlaceholders.map((item) => (
          <article key={item} className="allocation-card">
            <span>{item}</span>
            <strong>--%</strong>
          </article>
        ))}
      </div>
    </>
  );
}

function InvestmentPlanResults({
  onAnalyze,
  plan,
}: {
  onAnalyze: (opportunity: ScannedOpportunity) => void;
  plan: InvestmentPlanResult;
}) {
  const [selectedBucket, setSelectedBucket] = useState<AllocationBucketKind>(plan.buckets[0]?.kind ?? "index");
  const activeBucket = plan.buckets.find((bucket) => bucket.kind === selectedBucket) ?? plan.buckets[0];
  const topPicks = plan.positions.slice(0, 3);
  const totalAmount = plan.cashAmount + plan.investAmount;
  const expectedReturn = getExpectedReturnRange(plan.riskProfile, plan.horizon);

  return (
    <div className="plan-results">
      <div className="plan-results-heading">
        <div>
          <p className="eyebrow">Recommended Allocation</p>
          <h2>Your Investment Plan</h2>
          {plan.planExplanation ? <p className="plan-muted">{plan.planExplanation}</p> : null}
          {plan.marketRegime ? (
            <p className="plan-muted">
              Market regime: {plan.marketRegime.market} {plan.marketRegime.label} · Score {plan.marketRegime.score}
            </p>
          ) : null}
        </div>
        <div className="plan-kpi-grid" aria-label="Plan summary">
          <PlanKpi label="Invested" value={plan.investAmountLabel} />
          <PlanKpi label="Cash Buffer" value={plan.cashAmountLabel} />
          <PlanKpi label="AI Stock Picks" value={plan.positions.length.toString()} />
          <PlanKpi label="Expected Return" value={expectedReturn} />
          <PlanKpi label="Plan Type" value={`${getRiskProfileLabel(plan.riskProfile)} • ${getHorizonLabel(plan.horizon)}`} />
        </div>
      </div>

      <div className={`bucket-grid active-${activeBucket?.kind ?? "index"}`} aria-label="Recommended allocation buckets">
        {plan.buckets.map((bucket) => (
          <button
            key={bucket.kind}
            className={`bucket-card bucket-${bucket.kind} ${activeBucket?.kind === bucket.kind ? "active" : ""}`}
            type="button"
            onClick={() => setSelectedBucket(bucket.kind)}
          >
            <span className="bucket-icon" aria-hidden="true">{getBucketIcon(bucket.kind)}</span>
            <div className="bucket-card-top">
              <div>
                <h3>{getBucketDisplayTitle(bucket)}</h3>
              </div>
              <strong>{bucket.amountLabel}<span className="bucket-edit-hint" aria-hidden="true">✎</span></strong>
            </div>
            <p>{bucket.description}</p>
            {typeof bucket.score === "number" ? <small>Bucket score {bucket.score}/100</small> : null}
            <div className="bucket-progress-row">
              <span className="bucket-progress"><i style={{ width: `${bucket.percent}%` }} /></span>
              <b>{bucket.percent}%</b>
            </div>
            <small className="view-details">View details <span aria-hidden="true">→</span></small>
          </button>
        ))}
      </div>

      <PlanPreferenceMessages plan={plan} />

      <p className="hover-helper">Hover over a card to see full details</p>

      {activeBucket ? (
        <div className="bucket-accordion-list">
          <BucketDetailsPanel
            bucket={activeBucket}
            currency={plan.currency}
            onAnalyze={onAnalyze}
            positions={plan.positions}
          />
          {plan.buckets.filter((bucket) => bucket.kind !== activeBucket.kind).map((bucket) => (
            <button
              key={bucket.kind}
              className={`bucket-collapsed-row bucket-${bucket.kind}`}
              type="button"
              onClick={() => setSelectedBucket(bucket.kind)}
            >
              <span className="bucket-icon" aria-hidden="true">{getBucketIcon(bucket.kind)}</span>
              <strong>{getBucketDisplayTitle(bucket)}</strong>
              <b>{bucket.amountLabel}</b>
              <small>{bucket.percent}%</small>
              <span aria-hidden="true">⌄</span>
            </button>
          ))}
          <p className="allocation-footnote">Allocation adjusts with your risk profile and time horizon.</p>
        </div>
      ) : null}
    </div>
  );
}

function PlanKpi({ label, value }: { label: string; value: string }) {
  return (
    <article className="plan-kpi-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function PlanPreferenceMessages({ plan }: { plan: InvestmentPlanResult }) {
  const messages = plan.preferenceSummary ?? [];

  if (!plan.userPreferencesApplied && !messages.length && !plan.preferenceAdjustedPlanExplanation) {
    return null;
  }

  return (
    <section className="preference-message-panel" aria-label="Preference notes">
      {plan.preferenceAdjustedPlanExplanation ? <p>{plan.preferenceAdjustedPlanExplanation}</p> : null}
      {messages.length ? (
        <ul>
          {messages.map((message, index) => (
            <li key={`${message.preference}-${index}`}>{message.reason}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function getRiskProfileLabel(riskProfile: RiskProfile) {
  const option = riskProfileOptions.find((item) => item.value === riskProfile);
  return option?.label ?? "Balanced";
}

function getBucketDisplayTitle(bucket: AllocationBucket) {
  if (bucket.kind === "highRisk") {
    return "High-Risk";
  }

  return bucket.title;
}

function getBucketIcon(kind: AllocationBucketKind) {
  if (kind === "stocks") {
    return "↗";
  }

  if (kind === "gold") {
    return "▦";
  }

  if (kind === "cash") {
    return "▣";
  }

  if (kind === "highRisk") {
    return "↟";
  }

  return "▥";
}

function getHorizonLabel(horizon: InvestmentGoal) {
  const option = investmentGoalOptions.find((item) => item.value === horizon);
  return option?.label ?? "Medium Term";
}

function getExpectedReturnRange(riskProfile: RiskProfile, horizon: InvestmentGoal) {
  if (riskProfile === "safe") {
    return horizon === "short" ? "4-7%" : horizon === "long" ? "8-11%" : "6-9%";
  }

  if (riskProfile === "aggressive") {
    return horizon === "short" ? "8-14%" : horizon === "long" ? "15-25%" : "12-20%";
  }

  return horizon === "short" ? "6-10%" : horizon === "long" ? "10-15%" : "8-12%";
}

function getExpectedPortfolioValueRange(amount: number, range: string, market: MarketInfo) {
  const [low, high] = range
    .replace("%", "")
    .split("-")
    .map((value) => Number(value.trim()));
  const lowValue = amount * (1 + (Number.isFinite(low) ? low : 0) / 100);
  const highValue = amount * (1 + (Number.isFinite(high) ? high : low) / 100);

  return `${formatPlanCurrency(lowValue, market)} - ${formatPlanCurrency(highValue, market)}`;
}

function getBucketWhy(kind: AllocationBucketKind) {
  if (kind === "stocks") {
    return "Highest-scoring opportunities from today's scan.";
  }

  if (kind === "gold") {
    return "Reduces portfolio volatility.";
  }

  if (kind === "cash") {
    return "Held back because opportunities did not justify full deployment.";
  }

  if (kind === "highRisk") {
    return "Small upside sleeve for higher-growth opportunities.";
  }

  return "Broad market exposure with lower volatility.";
}

function getBucketReasons(kind: AllocationBucketKind) {
  if (kind === "stocks") {
    return ["Highest-scoring opportunities", "Position sizes matched to risk", "Clear exit analysis available"];
  }

  if (kind === "gold") {
    return ["Reduces portfolio volatility", "Diversifies beyond stocks", "Useful during market stress"];
  }

  if (kind === "cash") {
    return ["Reserved for flexibility", "Protects against forced selling", "Available for better setups"];
  }

  if (kind === "highRisk") {
    return ["Small controlled exposure", "Higher upside potential", "Limited by your risk profile"];
  }

  return ["Core allocation for stable growth", "Diversified across large and mid-cap", "Suitable for medium-term goals"];
}

function getHorizonLabelFromText(value?: string) {
  if (value?.includes("10-")) {
    return "Growth exposure";
  }

  return "Long-term compounding";
}

function BucketDetailsPanel({
  bucket,
  currency,
  onAnalyze,
  positions,
}: {
  bucket: AllocationBucket;
  currency: CurrencyCode;
  onAnalyze: (opportunity: ScannedOpportunity) => void;
  positions: AllocationPosition[];
}) {
  const market = getMarketInfo("", null, currency);

  if (bucket.kind === "stocks") {
    return (
      <section className="bucket-details-panel expanded" aria-label="AI-rated stock details">
        <div className="bucket-expanded-head">
          <span className="bucket-icon large" aria-hidden="true">{getBucketIcon(bucket.kind)}</span>
          <div>
            <h3>AI-Rated Stocks</h3>
            <strong>{bucket.amountLabel}</strong>
          </div>
          <small>{bucket.percent}%</small>
        </div>
        {bucket.reason ? <p className="plan-muted">{bucket.reason}</p> : null}

        {positions.length ? (
          <div className="expanded-two-column">
            <div className="ai-stock-table-wrap">
              <div className="ai-stock-table" role="table" aria-label="AI stock allocations">
                <div className="ai-stock-head" role="row">
                  <span>Stock</span>
                  <span>Amount</span>
                  <span>Score</span>
                  <span>Price</span>
                  <span>Hold</span>
                  <span>Reason</span>
                  <span>Action</span>
                </div>
                {positions.map((position) => (
                  <article key={position.symbol} className="ai-stock-row" role="row">
                    <div className="ai-stock-name" data-label="Stock">
                      <strong title={position.symbol}>{position.symbol}</strong>
                      <small title={position.name}>{position.name}</small>
                    </div>
                    <b data-label="Amount">{position.amountLabel}</b>
                    <span className="score-badge" data-label="Score">{position.score}</span>
                    <small data-label="Price">{formatAssetPrice(position.stock?.latest_close ?? null, market)}</small>
                    <small data-label="Hold">{position.expectedHold}</small>
                    <p data-label="Reason" title={position.why[0] ?? "Highest-scoring opportunity from today's scan."}>
                      {position.why[0] ?? "Highest-scoring opportunity from today's scan."}
                    </p>
                    <button type="button" onClick={() => onAnalyze(position)}>Analyze</button>
                  </article>
                ))}
              </div>
            </div>
            <WhyAllocationCard reasons={getBucketReasons(bucket.kind)} />
          </div>
        ) : (
          <div className="bucket-simple-detail">
            <strong>No AI stock picks right now</strong>
            <p>Weak stock opportunities were moved into Index / SIP and Cash Buffer.</p>
          </div>
        )}
      </section>
    );
  }

  if (bucket.kind === "index") {
    const options = getIndexDetailOptions(currency, bucket.amount, market);
    const assets = bucket.assets?.length ? bucket.assets : options.map((option) => ({
      amount: 0,
      amountLabel: option.amountLabel,
      current_price: null,
      currentPrice: null,
      expected_return: null,
      name: option.name,
      reason: "Broad market exposure.",
      risk: "Market risk",
      score: option.score,
      symbol: option.name,
      trend: getHorizonLabelFromText(option.expectedReturn),
    }));

    return (
      <section className="bucket-details-panel expanded" aria-label="Index and SIP details">
        <div className="bucket-expanded-head">
          <span className="bucket-icon large" aria-hidden="true">{getBucketIcon(bucket.kind)}</span>
          <div>
            <h3>Index / SIP</h3>
            <strong>{bucket.amountLabel}</strong>
          </div>
          <small>{bucket.percent}% of plan</small>
        </div>
        <div className="expanded-two-column">
          <div className="allocation-table">
            <div className="allocation-table-head">
              <span>RECOMMENDED SIPs</span>
              <span>AMOUNT</span>
              <span>SCORE</span>
              <span>PRICE</span>
            </div>
            {assets.map((asset) => (
              <article key={asset.symbol} className="allocation-table-row">
                <strong>{asset.name}</strong>
                <b>{asset.amountLabel}</b>
                <span className="score-badge">{asset.score}</span>
                <small>{formatAssetPrice(asset.current_price ?? asset.currentPrice ?? null, market)}</small>
              </article>
            ))}
            <div className="allocation-feature-row">
              <span>Broad market exposure</span>
              <span>Lower volatility</span>
              <span>{getHorizonLabelFromText(options[0]?.expectedReturn)}</span>
            </div>
          </div>
          <WhyAllocationCard reasons={getBucketReasons(bucket.kind)} />
        </div>
      </section>
    );
  }

  return (
    <section className="bucket-details-panel expanded" aria-label={`${getBucketDisplayTitle(bucket)} details`}>
      <div className="bucket-expanded-head">
        <span className="bucket-icon large" aria-hidden="true">{getBucketIcon(bucket.kind)}</span>
        <div>
          <h3>{getBucketDisplayTitle(bucket)}</h3>
          <strong>{bucket.amountLabel}</strong>
        </div>
        <small>{bucket.percent}%</small>
      </div>
      <div className="expanded-two-column">
        {bucket.assets?.length ? (
          <div className="allocation-table">
            <div className="allocation-table-head">
              <span>ASSET</span>
              <span>AMOUNT</span>
              <span>SCORE</span>
              <span>PRICE</span>
            </div>
            {bucket.assets.map((asset) => (
              <article key={asset.symbol} className="allocation-table-row">
                <strong>{asset.name}</strong>
                <b>{asset.amountLabel}</b>
                <span className="score-badge">{asset.score}</span>
                <small>{formatAssetPrice(asset.current_price ?? asset.currentPrice ?? null, market)}</small>
              </article>
            ))}
          </div>
        ) : (
          <div className="bucket-simple-detail">
            <strong>{bucket.suggestion}</strong>
            <p>{bucket.reason ?? getBucketWhy(bucket.kind)}</p>
          </div>
        )}
        <WhyAllocationCard reasons={getBucketReasons(bucket.kind)} />
      </div>
    </section>
  );
}

function WhyAllocationCard({ reasons }: { reasons: string[] }) {
  return (
    <aside className="why-allocation-card">
      <h4>Why this allocation?</h4>
      {reasons.map((reason) => (
        <p key={reason}><span aria-hidden="true">✓</span>{reason}</p>
      ))}
    </aside>
  );
}

function FindOpportunitiesPage({ onAnalyze }: { onAnalyze: () => void }) {
  return (
    <section className="assistant-page" aria-labelledby="opportunities-title">
      <div className="page-heading">
        <p className="eyebrow">Find Opportunities</p>
        <h1 id="opportunities-title">Top Opportunities Today</h1>
        <p className="subtitle">Placeholder rankings for the future market scan experience.</p>
      </div>

      <div className="opportunity-loading" aria-label="Market scan loading preview">
        <span className="loading-dot" />
        <strong>Analyzing opportunities...</strong>
        <div className="shimmer-line" />
      </div>

      <div className="opportunity-grid">
        {opportunityPlaceholders.map((stock) => (
          <article key={stock.name} className="opportunity-card">
            <div>
              <h2>{stock.name}</h2>
              <p>Setup quality: {stock.setup}</p>
            </div>
            <div className="opportunity-meta">
              <span>AI Score <b>{stock.score}</b></span>
              <span>Risk <b>{stock.risk}</b></span>
            </div>
            <button type="button" onClick={onAnalyze}>Analyze</button>
          </article>
        ))}
      </div>
    </section>
  );
}

function PortfolioAssistantPage() {
  return (
    <section className="coming-soon-page" aria-labelledby="portfolio-title">
      <p className="eyebrow">Portfolio Assistant</p>
      <h1 id="portfolio-title">Portfolio Assistant is coming soon.</h1>
    </section>
  );
}

function ActionDashboard({
  analysis,
  amountInput,
  backtest,
  currentPrice,
  investmentGoal,
  profileCurrency,
  selectedCurrency,
  setAmountInput,
  setInvestmentGoal,
  setSelectedCurrency,
  symbol,
}: {
  analysis: AnalysisData;
  amountInput: string;
  backtest: BacktestData | null;
  currentPrice: number | null;
  investmentGoal: InvestmentGoal;
  profileCurrency?: string | null;
  selectedCurrency: CurrencyCode;
  setAmountInput: (value: string) => void;
  setInvestmentGoal: (goal: InvestmentGoal) => void;
  setSelectedCurrency: (currency: CurrencyCode) => void;
  symbol: string;
}) {
  const portfolioValue = Number(amountInput || "0");
  const finalRecommendation = analysis.final_recommendation;
  const aiScore = buildAIScore(analysis, backtest);
  const risk = getRiskDisplay(analysis.risk_level);
  const verdictTone = getVerdictTone(finalRecommendation, analysis.confidence);
  const confidenceLabel = getConfidenceLabel(analysis.confidence);

  const { displayMarket, exitStrategy, investmentPlan, profitPlanner } = useMemo(() => {
    const market = getMarketInfo(symbol, profileCurrency, selectedCurrency);
    const plan = buildInvestmentPlan({
      confidence: analysis.confidence,
      currentPrice,
      goal: investmentGoal,
      market,
      newsScore: getNewsScore(analysis),
      portfolioValue,
      recommendation: finalRecommendation,
      riskLevel: analysis.risk_level,
      symbol,
      technicalScore: getTechnicalScore(analysis),
    });
    const exit = buildExitStrategy({ analysis, currentPrice, profileCurrency, selectedCurrency, symbol });

    return {
      displayMarket: plan.effectiveMarket,
      exitStrategy: exit,
      investmentPlan: plan,
      profitPlanner: buildProfitOutcomePlanner(plan, exit, finalRecommendation),
    };
  }, [analysis, currentPrice, finalRecommendation, investmentGoal, portfolioValue, profileCurrency, selectedCurrency, symbol]);

  return (
    <section className="action-dashboard" aria-label="Action summary">
      <div className={`action-summary ${verdictTone}`}>
        <div className="verdict-copy">
          <p className="eyebrow">MarketMind Verdict</p>
          <h2>{getMainVerdict(finalRecommendation, analysis.confidence)}</h2>
          <strong>{getSuggestedActionLabel(finalRecommendation, analysis.confidence)}</strong>
          <p>{getVerdictReason(analysis, confidenceLabel)}</p>
        </div>
        <div className="action-summary-grid">
          <span>Recommendation <b>{friendlyRecommendation(finalRecommendation)}</b></span>
          <span>AI Score <b>{aiScore.scoreLabel}</b></span>
          <span>Confidence <b>{confidenceLabel}</b></span>
          <span>Risk <b>{risk.label}</b></span>
          <span>Potential Profit <b>{profitPlanner.potentialProfitLabel}</b></span>
        </div>
      </div>

      <div className="action-card-grid">
        <article className="action-card">
          <div className="action-card-head">
            <div>
              <p className="eyebrow">What should I do?</p>
              <h3>Suggested Action</h3>
            </div>
            <strong>{getSuggestedActionLabel(finalRecommendation, analysis.confidence)}</strong>
          </div>

          <div className="compact-fields">
            <label>
              <span>Money to invest</span>
              <div className="money-input">
                <b>{displayMarket.symbol}</b>
                <input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  type="text"
                  value={amountInput}
                  onFocus={() => {
                    if (amountInput === "0") {
                      setAmountInput("");
                    }
                  }}
                  onChange={(event) => setAmountInput(cleanAmountInput(event.target.value))}
                />
                <select
                  aria-label="Currency"
                  value={selectedCurrency}
                  onChange={(event) => {
                    const nextCurrency = event.target.value as CurrencyCode;
                    const convertedBudget = convertCurrency(portfolioValue, selectedCurrency, nextCurrency);
                    if (convertedBudget !== null) {
                      setAmountInput(cleanAmountInput(String(Math.max(0, Math.round(convertedBudget)))));
                    }
                    setSelectedCurrency(nextCurrency);
                  }}
                >
                  {currencyOptions.map((currency) => (
                    <option key={currency.code} value={currency.code}>
                      {currency.code} ({currency.symbol})
                    </option>
                  ))}
                </select>
              </div>
            </label>

            <fieldset>
              <legend>Goal</legend>
              <div className="goal-options compact">
                {investmentGoalOptions.map((option) => (
                  <label key={option.value} className={investmentGoal === option.value ? "selected" : ""}>
                    <input
                      checked={investmentGoal === option.value}
                      name="investment-goal"
                      type="radio"
                      value={option.value}
                      onChange={() => setInvestmentGoal(option.value)}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>

          <div className="summary-row">
            <span>Shares <b>{investmentPlan.sharesLabel}</b></span>
            <span>Entry style <b>{goalLabel(investmentGoal)}</b></span>
          </div>

          {investmentPlan.conversionWarning ? <p className="plan-warning">{investmentPlan.conversionWarning}</p> : null}

          <details className="card-details">
            <summary>View Details</summary>
            <div className="detail-stack">
              <span>Allocation <b>{investmentPlan.allocationLabel}</b></span>
              <div>
                <strong>Buy schedule</strong>
                {investmentPlan.entries.length ? (
                  <ul>
                    {investmentPlan.entries.map((entry) => (
                      <li key={entry.label}>Buy {formatPlanCurrency(entry.amount, displayMarket)} {entry.label}</li>
                    ))}
                  </ul>
                ) : (
                  <p>{investmentPlan.noBuyMessage}</p>
                )}
              </div>
              {investmentPlan.indianFullShareWarning ? (
                <p className="share-warning">
                  <b>Suggested position size is below one full share.</b>
                  <span>One full share currently costs about {investmentPlan.fullShareCostLabel}.</span>
                </p>
              ) : null}
              {investmentPlan.indianShareNote ? <p>{investmentPlan.indianShareNote}</p> : null}
            </div>
          </details>
        </article>

        <article className="action-card profit-outcome-card">
          <div className="action-card-head">
            <div>
              <p className="eyebrow">How attractive is this?</p>
              <h3>Profit Outcome</h3>
            </div>
            <strong className={`reward-badge ${getRiskRewardTone(exitStrategy.riskRewardRatio)}`}>
              {exitStrategy.riskRewardQuality}
            </strong>
          </div>
          <div className="profit-outcome-grid">
            <span className="profit-positive">Potential Profit <b>+{profitPlanner.potentialProfitLabel}</b></span>
            <span className="profit-negative">Potential Loss <b>-{profitPlanner.potentialLossLabel}</b></span>
            <span className={`risk-reward ${getRiskRewardTone(exitStrategy.riskRewardRatio)}`}>
              Risk / Reward
              <b>{exitStrategy.riskRewardPreciseLabel}</b>
              <small>{exitStrategy.riskRewardQuality} Setup</small>
            </span>
          </div>
          <p className="planner-note">{getRiskRewardExplanation(exitStrategy.riskRewardRatio)}</p>
        </article>

        <article className="action-card">
          <div className="action-card-head">
            <div>
              <p className="eyebrow">When do I exit?</p>
              <h3>Exit Strategy</h3>
            </div>
            <strong>{exitStrategy.riskRewardLabel}</strong>
          </div>
          {finalRecommendation === "AVOID" ? (
            <p>The AI currently does not see a favorable risk/reward setup.</p>
          ) : (
            <div className="exit-flow" aria-label="Exit strategy flow">
              <span>Entry <b>{exitStrategy.entryRangeLabel}</b></span>
              <span>Target <b>{exitStrategy.targetLabel}</b></span>
              <span>Expected Hold <b>{exitStrategy.holdingPeriod}</b></span>
              <span>Stop Loss <b>{exitStrategy.stopLossLabel}</b></span>
            </div>
          )}
          <details className="card-details">
            <summary>View Details</summary>
            <div className="detail-stack">
              <span>Entry range <b>{exitStrategy.entryRangeLabel}</b></span>
              <span>Target <b>{exitStrategy.targetLabel}</b></span>
              <span>Stop loss <b>{exitStrategy.stopLossLabel}</b></span>
              <span>Holding period <b>{exitStrategy.holdingPeriod}</b></span>
              <p>Risk/reward is {exitStrategy.riskRewardQuality}. A higher ratio means the possible reward is larger compared to the possible loss.</p>
            </div>
          </details>
        </article>
      </div>
    </section>
  );
}

function CollapsedPanel({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="collapsed-panel">
      <details>
        <summary>{title}</summary>
        {children}
      </details>
    </section>
  );
}

function AIScoreCard({ analysis, backtest }: { analysis: AnalysisData; backtest: BacktestData | null }) {
  const aiScore = buildAIScore(analysis, backtest);

  return (
    <section className="ai-score-card" aria-label="AI score">
      <div>
        <p className="eyebrow">AI Score</p>
        <h2>{aiScore.scoreLabel}</h2>
        <strong>{aiScore.setupLabel}</strong>
        <p>This score combines trend, news, backtest, risk, and confidence into one simple setup rating.</p>
      </div>
      <div className="ai-score-breakdown" aria-label="AI score breakdown">
        {aiScore.components.map((component) => (
          <span key={component.label}>
            {component.label}
            <b>{component.value}</b>
          </span>
        ))}
      </div>
    </section>
  );
}

function MarketMindVerdict({ analysis, backtest }: { analysis: AnalysisData; backtest: BacktestData | null }) {
  const verdict = getMainVerdict(analysis.final_recommendation, analysis.confidence);
  const risk = getRiskDisplay(analysis.risk_level);
  const confidenceLabel = getConfidenceLabel(analysis.confidence);
  const scoreCards = [
    { label: "Technical Trend", score: getTechnicalScore(analysis) },
    { label: "News Outlook", score: getNewsScore(analysis) },
    { label: "Risk Level", score: getRiskScore(analysis.risk_level) },
    { label: "Backtest Strength", score: getBacktestScore(backtest) },
  ];

  return (
    <section className="marketmind-verdict" aria-label="MarketMind verdict">
      <div className={`verdict-main ${analysis.final_recommendation.toLowerCase()}`}>
        <div>
          <p className="eyebrow">MarketMind Verdict</p>
          <h2>{verdict}</h2>
          <p>{getVerdictReason(analysis, confidenceLabel)}</p>
        </div>
        <div className="verdict-meta" aria-label="Verdict details">
          <span>Risk level <b>{risk.label}</b></span>
          <span>AI confidence <b>{confidenceLabel}</b></span>
        </div>
      </div>

      <div className="score-breakdown" aria-label="Simple score breakdown">
        {scoreCards.map((card) => (
          <article key={card.label} className={`score-card ${card.score.toLowerCase()}`}>
            <span>{card.label}</span>
            <strong>{card.score}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}

function InvestmentPlan({
  analysis,
  amountInput,
  currentPrice,
  investmentGoal,
  profileCurrency,
  selectedCurrency,
  setAmountInput,
  setInvestmentGoal,
  setSelectedCurrency,
  symbol,
}: {
  analysis: AnalysisData;
  amountInput: string;
  currentPrice: number | null;
  investmentGoal: InvestmentGoal;
  profileCurrency?: string | null;
  selectedCurrency: CurrencyCode;
  setAmountInput: (value: string) => void;
  setInvestmentGoal: (goal: InvestmentGoal) => void;
  setSelectedCurrency: (currency: CurrencyCode) => void;
  symbol: string;
}) {
  const selectedGoal = investmentGoal;
  const finalRecommendation = analysis.final_recommendation;
  const confidence = analysis.confidence;
  const riskLevel = analysis.risk_level;
  const portfolioValue = Number(amountInput || "0");

  const { market, plan } = useMemo(() => {
    const detectedMarket = getMarketInfo(symbol, profileCurrency, selectedCurrency);
    return {
      plan: buildInvestmentPlan({
        confidence,
        currentPrice,
        goal: selectedGoal,
        market: detectedMarket,
        newsScore: getNewsScore(analysis),
        portfolioValue,
        recommendation: finalRecommendation,
        riskLevel,
        symbol,
        technicalScore: getTechnicalScore(analysis),
      }),
      market: detectedMarket,
    };
  }, [analysis, confidence, currentPrice, finalRecommendation, portfolioValue, profileCurrency, riskLevel, selectedCurrency, selectedGoal, symbol]);
  const displayMarket = plan.effectiveMarket;

  return (
    <section className="investment-plan" aria-label="Investment plan">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Beginner action plan</p>
          <h2>Investment Plan</h2>
        </div>
      </div>

      <div className="plan-controls" aria-label="Investment plan inputs">
        <label>
          <span>How much money do you want to invest?</span>
          <div className="money-input">
            <b>{displayMarket.symbol}</b>
            <input
              inputMode="numeric"
              pattern="[0-9]*"
              type="text"
              value={amountInput}
              onFocus={() => {
                if (amountInput === "0") {
                  setAmountInput("");
                }
              }}
              onChange={(event) => setAmountInput(cleanAmountInput(event.target.value))}
            />
            <select
              aria-label="Currency"
              value={selectedCurrency}
              onChange={(event) => {
                const nextCurrency = event.target.value as CurrencyCode;
                const convertedBudget = convertCurrency(portfolioValue, selectedCurrency, nextCurrency);
                if (convertedBudget !== null) {
                  setAmountInput(cleanAmountInput(String(Math.max(0, Math.round(convertedBudget)))));
                }
                setSelectedCurrency(nextCurrency);
              }}
            >
              {currencyOptions.map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {currency.code} ({currency.symbol})
                </option>
              ))}
            </select>
          </div>
        </label>

        <fieldset>
          <legend>Investment Goal</legend>
          <div className="goal-options">
            {investmentGoalOptions.map((option) => (
              <label key={option.value} className={selectedGoal === option.value ? "selected" : ""}>
                <input
                  checked={selectedGoal === option.value}
                  name="investment-goal"
                  type="radio"
                  value={option.value}
                  onChange={() => setInvestmentGoal(option.value)}
                />
                <span>{option.label}</span>
                <small>{option.range}</small>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      {plan.conversionWarning ? <p className="plan-warning">{plan.conversionWarning}</p> : null}

      <div className="suggested-amount">
        <strong>Suggested Amount</strong>
        <div>
          <span>Suggested Position Size</span>
          <b>{plan.positionLabel}</b>
          <small className="position-badge">{plan.positionBadge}</small>
        </div>
        <div>
          <span>Of your money</span>
          <b>{plan.allocationLabel}</b>
        </div>
        <div>
          <span>Approximate shares</span>
          <b>{plan.sharesLabel}</b>
        </div>
        {plan.indianFullShareWarning ? (
          <p className="share-warning">
            <b>âš  Suggested position size is below one full share.</b>
            <span>One full share currently costs about {plan.fullShareCostLabel}.</span>
          </p>
        ) : null}
        {plan.indianShareNote ? (
          <details className="share-note">
            <summary>Fractional share note</summary>
            <p>{plan.indianShareNote}</p>
          </details>
        ) : null}
      </div>

      <div className="entry-plan">
        <strong>Suggested Entry Plan</strong>
        <p>Instead of investing all at once, this plan spreads purchases over time to reduce timing risk.</p>
        {plan.entries.length ? (
          <ul>
            {plan.entries.map((entry) => (
              <li key={entry.label}>
                Buy <b>{formatPlanCurrency(entry.amount, displayMarket)}</b> {entry.label}
              </li>
            ))}
          </ul>
        ) : (
          <p>{plan.noBuyMessage}</p>
        )}
      </div>

      <p className="plan-disclaimer">This is an educational estimate, not financial advice.</p>
    </section>
  );
}

function ProfitOutcomePlanner({
  analysis,
  amountInput,
  currentPrice,
  investmentGoal,
  profileCurrency,
  selectedCurrency,
  symbol,
}: {
  analysis: AnalysisData;
  amountInput: string;
  currentPrice: number | null;
  investmentGoal: InvestmentGoal;
  profileCurrency?: string | null;
  selectedCurrency: CurrencyCode;
  symbol: string;
}) {
  const portfolioValue = Number(amountInput || "0");
  const planner = useMemo(() => {
    const market = getMarketInfo(symbol, profileCurrency, selectedCurrency);
    const investmentPlan = buildInvestmentPlan({
      confidence: analysis.confidence,
      currentPrice,
      goal: investmentGoal,
      market,
      newsScore: getNewsScore(analysis),
      portfolioValue,
      recommendation: analysis.final_recommendation,
      riskLevel: analysis.risk_level,
      symbol,
      technicalScore: getTechnicalScore(analysis),
    });
    const exitStrategy = buildExitStrategy({ analysis, currentPrice, profileCurrency, selectedCurrency, symbol });
    return buildProfitOutcomePlanner(investmentPlan, exitStrategy, analysis.final_recommendation);
  }, [analysis, currentPrice, investmentGoal, portfolioValue, profileCurrency, selectedCurrency, symbol]);

  return (
    <section className="profit-planner" aria-label="Profit outcome planner">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Profit outcome planner</p>
          <h2>Profit Outcome Planner</h2>
          <p>See what the opportunity could realistically be worth.</p>
        </div>
      </div>

      {planner.conversionWarning ? <p className="plan-warning">{planner.conversionWarning}</p> : null}

      <div className="planner-grid potential-row">
        <article>
          <span>Suggested Position Size</span>
          <strong>{planner.suggestedPositionLabel}</strong>
          <p>This uses the same position size from your Investment Plan.</p>
        </article>
        <article className="positive">
          <span>Potential Profit</span>
          <strong>{planner.potentialProfitLabel}</strong>
          <p>If the stock reaches its target, this is the estimated gain.</p>
        </article>
        <article className="negative">
          <span>Potential Loss</span>
          <strong>{planner.potentialLossLabel}</strong>
          <p>If the stop loss is reached, this is the estimated loss.</p>
        </article>
      </div>

      {planner.worthMessage ? <p className="planner-note">{planner.worthMessage}</p> : null}

      <div className="planner-grid full-amount-row">
        <article>
          <span>If You Invest Your Full Amount</span>
          <strong>{planner.fullCapitalLabel}</strong>
          <p>Available capital used for this estimate.</p>
        </article>
        <article className="positive">
          <span>Best Case</span>
          <strong>{planner.fullProfitLabel}</strong>
          <p>Expected gain if the target is reached.</p>
        </article>
        <article className="negative">
          <span>Risk Case</span>
          <strong>{planner.fullLossLabel}</strong>
          <p>Possible loss if the stop loss is reached.</p>
        </article>
      </div>

      <div className="required-capital-row">
        <div>
          <span>Required Capital For Target Profit</span>
          <p>This estimates how much you may need to invest to reach each profit goal.</p>
        </div>
        <div className="required-capital-cards">
          {planner.requiredCapital.map((item) => (
            <article key={item.targetLabel}>
              <span>To Potentially Earn {item.targetLabel}</span>
              <strong>{item.requiredLabel}</strong>
              <p>{item.explanation}</p>
            </article>
          ))}
        </div>
      </div>

      <p className="plan-disclaimer">This is only an estimate and not a guarantee.</p>
    </section>
  );
}

function ExitStrategy({
  analysis,
  currentPrice,
  profileCurrency,
  selectedCurrency,
  symbol,
}: {
  analysis: AnalysisData;
  currentPrice: number | null;
  profileCurrency?: string | null;
  selectedCurrency: CurrencyCode;
  symbol: string;
}) {
  const strategy = useMemo(
    () => buildExitStrategy({ analysis, currentPrice, profileCurrency, selectedCurrency, symbol }),
    [analysis, currentPrice, profileCurrency, selectedCurrency, symbol],
  );

  if (analysis.final_recommendation === "AVOID") {
    return (
      <section className="exit-strategy" aria-label="Exit strategy">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Exit strategy</p>
            <h2>Avoid for Now</h2>
          </div>
        </div>
        <div className="exit-avoid">
          <strong>No suggested entry, profit target, or stop loss.</strong>
          <small>Expected holding period: Not recommended.</small>
          <p>The AI currently does not see a favorable risk/reward setup.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="exit-strategy" aria-label="Exit strategy">
      <div className="section-heading">
          <div>
            <p className="eyebrow">Exit strategy</p>
          <h2>Suggested Exit Strategy</h2>
          <p>This is a possible plan for taking profits and managing risk.</p>
          </div>
        </div>

      {strategy.conversionWarning ? <p className="plan-warning">{strategy.conversionWarning}</p> : null}

      <div className="exit-summary-strip" aria-label="Exit strategy summary">
        <span>Entry <b>{strategy.entryRangeLabel}</b></span>
        <span>Target <b>{strategy.targetLabel}</b></span>
        <span>Stop <b>{strategy.stopLossLabel}</b></span>
        <span>Hold <b>{strategy.holdingPeriod}</b></span>
      </div>

      <div className="exit-grid">
        <article className={`exit-card reward-${strategy.riskRewardQuality.toLowerCase()}`}>
          <span>Risk / Reward Ratio</span>
          <strong>{strategy.riskRewardLabel}</strong>
          <small>{strategy.riskRewardQuality}</small>
          <p>A higher ratio means the possible reward is larger compared to the possible loss.</p>
        </article>
      </div>
    </section>
  );
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const data = await response.json();

  if (!response.ok || data.error) {
    throw new Error(data.detail ?? data.error ?? "Request failed.");
  }

  return data;
}

async function postJson<T>(url: string, body: unknown, timeoutMs = 45000): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
      method: "POST",
      signal: controller.signal,
    });
    const data = await response.json();

    if (!response.ok || data.error) {
      throw new Error(data.detail ?? data.error ?? "Request failed.");
    }

    return data;
  } finally {
    window.clearTimeout(timer);
  }
}

type PersonalPlanInput = {
  amount: number;
  currency: CurrencyCode;
  horizon: InvestmentGoal;
  riskProfile: RiskProfile;
  userPreferences?: UserPreferences;
};

type OpportunityScoreInput = {
  analysis: AnalysisData;
  backtest: BacktestData | null;
  exitStrategy: ReturnType<typeof buildExitStrategy>;
  horizon: InvestmentGoal;
  stock: StockData | null;
};

type OpportunityScoreModule = {
  id: string;
  label: string;
  score: (input: OpportunityScoreInput) => { note: string; value: number };
  weights: Record<InvestmentGoal, number>;
};

async function buildPersonalInvestmentPlan(input: PersonalPlanInput): Promise<InvestmentPlanResult> {
  try {
    return await postJson<InvestmentPlanResult>(`${apiUrl}/invest-plan`, {
      amount: input.amount,
      currency: input.currency,
      horizon: input.horizon,
      riskProfile: input.riskProfile,
      userPreferences: input.userPreferences,
    });
  } catch (error) {
    if (hasActiveUserPreferences(input.userPreferences)) {
      throw error;
    }
    console.warn("Backend invest-plan unavailable, using frontend fallback.", error);
    return buildClientPersonalInvestmentPlan(input);
  }
}

function hasActiveUserPreferences(preferences?: UserPreferences) {
  if (!preferences) {
    return false;
  }
  return Boolean(
    (preferences.cashPreference && preferences.cashPreference !== "default")
    || (preferences.cryptoPreference && preferences.cryptoPreference !== "default")
    || (preferences.goldPreference && preferences.goldPreference !== "default")
    || (preferences.stockPreference && preferences.stockPreference !== "default")
    || preferences.sectorAvoid?.length,
  );
}

async function buildClientPersonalInvestmentPlan(input: PersonalPlanInput): Promise<InvestmentPlanResult> {
  const market = getMarketInfo("", null, input.currency);
  const scanResults = await Promise.allSettled(
    opportunityUniverse.map((opportunity) => scanOpportunity(opportunity, input.currency, input.horizon)),
  );
  const ranked = scanResults
    .filter((result): result is PromiseFulfilledResult<ScannedOpportunity> => result.status === "fulfilled")
    .map((result) => result.value)
    .sort((a, b) =>
      getOpportunitySelectionScore(b, input.riskProfile, input.horizon) -
      getOpportunitySelectionScore(a, input.riskProfile, input.horizon),
    );
  const failedCount = scanResults.filter((result) => result.status === "rejected").length;
  const bucketPlan = buildAdaptiveClientBucketPlan(input, ranked);

  const stockBucketAmount = bucketPlan.find((bucket) => bucket.kind === "stocks")?.amount ?? 0;
  const stockAllocation = allocateStockBucketByOpportunityQuality({
    amount: stockBucketAmount,
    currency: input.currency,
    horizon: input.horizon,
    opportunities: ranked,
    riskProfile: input.riskProfile,
  });
  const unusedStockAmount = stockAllocation.unusedAmount;
  const buckets = distributeUnusedStockAllocation({
    buckets: bucketPlan,
    currency: input.currency,
    horizon: input.horizon,
    riskProfile: input.riskProfile,
    stockInvestAmount: stockAllocation.investAmount,
    unusedStockAmount,
  });
  const cashAmount = buckets.find((bucket) => bucket.kind === "cash")?.amount ?? 0;
  const investAmount = input.amount - cashAmount;
  const cashReason = buildCashReason(unusedStockAmount, stockAllocation.selectedCount);
  const planTuning = getPlanTuning(input.riskProfile, input.horizon);

  return {
    buckets: buckets.map((bucket) => ({
      ...bucket,
      amountLabel: formatPlanCurrency(bucket.amount, market),
      percent: Math.round((bucket.amount / input.amount) * 100),
    })),
    cashAmount,
    cashAmountLabel: formatPlanCurrency(cashAmount, market),
    cashReason,
    currency: input.currency,
    failedCount,
    horizon: input.horizon,
    investAmount,
    investAmountLabel: formatPlanCurrency(investAmount, market),
    policyHighlights: buildPolicyHighlights({
      cashAmount,
      horizon: input.horizon,
      maxPositions: planTuning.maxPositions,
      minimumScore: planTuning.minimumScore,
      totalAmount: input.amount,
    }),
    positions: stockAllocation.positions.map((position) => ({
      ...position,
      amountLabel: formatPlanCurrency(position.amount, market),
    })),
    preferenceNote: getPreferenceNote(input.riskProfile, input.horizon),
    ranked,
    riskProfile: input.riskProfile,
    scannedCount: ranked.length,
  };
}

async function scanOpportunity(
  opportunity: OpportunityUniverseItem,
  selectedCurrency: CurrencyCode,
  horizon: InvestmentGoal,
): Promise<ScannedOpportunity> {
  const encodedSymbol = encodeURIComponent(opportunity.symbol);
  const [stockResult, analysisResult, backtestResult, profileResult] = await Promise.allSettled([
    fetchJson<StockData>(`${apiUrl}/stock/${encodedSymbol}`),
    fetchJson<AnalysisData>(`${apiUrl}/analysis/${encodedSymbol}`),
    fetchJson<BacktestData>(`${apiUrl}/backtest/${encodedSymbol}`),
    fetchJson<CompanyProfile>(`${apiUrl}/profile/${encodedSymbol}`),
  ]);

  if (analysisResult.status !== "fulfilled") {
    throw analysisResult.reason;
  }

  const analysis = analysisResult.value;
  const stock = stockResult.status === "fulfilled" ? stockResult.value : null;
  const backtest = backtestResult.status === "fulfilled" ? backtestResult.value : null;
  const profile = profileResult.status === "fulfilled" ? profileResult.value : null;
  const exitStrategy = buildExitStrategy({
    analysis,
    currentPrice: stock?.latest_close ?? null,
    profileCurrency: profile?.currency,
    selectedCurrency,
    symbol: opportunity.symbol,
  });
  const score = buildOpportunityScore({
    analysis,
    backtest,
    exitStrategy,
    horizon,
    stock,
  });

  return {
    analysis,
    backtest,
    components: score.components,
    confidence: analysis.transformer_prediction?.confidence ?? analysis.confidence,
    expectedHold: adjustHoldingPeriodForHorizon(exitStrategy.holdingPeriod, horizon),
    market: opportunity.market,
    name: profile?.name || opportunity.name,
    potentialLossRate: exitStrategy.downsideRate,
    potentialProfitRate: exitStrategy.upsideRate,
    profile,
    riskRewardLabel: exitStrategy.riskRewardPreciseLabel,
    riskRewardRatio: exitStrategy.riskRewardRatio,
    score: score.score,
    scoreBand: getOpportunityScoreBand(score.score),
    stock,
    symbol: opportunity.symbol,
    why: buildOpportunityReasons(score.components, analysis, exitStrategy, horizon),
  };
}

const opportunityScoreModules: OpportunityScoreModule[] = [
  {
    id: "transformer",
    label: "AI outlook",
    score: ({ analysis }) => {
      const confidence = normalizeConfidence(analysis.transformer_prediction?.confidence ?? analysis.confidence);
      const signal = analysis.transformer_prediction?.recommendation ?? analysis.final_recommendation;
      const signalBoost = signal === "BUY" ? 12 : signal === "HOLD" ? 0 : -18;
      return {
        note: `${signal} signal with ${Math.round(confidence)}% confidence`,
        value: clamp(confidence + signalBoost, 0, 100),
      };
    },
    weights: { long: 0.22, medium: 0.22, short: 0.16 },
  },
  {
    id: "sentiment",
    label: "News sentiment",
    score: ({ analysis }) => scoreSentimentQuality(analysis.sentiment_analysis),
    weights: { long: 0.1, medium: 0.18, short: 0.28 },
  },
  {
    id: "riskReward",
    label: "Risk/reward",
    score: ({ exitStrategy }) => scoreRiskRewardQuality(exitStrategy.riskRewardRatio),
    weights: { long: 0.16, medium: 0.2, short: 0.18 },
  },
  {
    id: "backtest",
    label: "Backtest strength",
    score: ({ backtest }) => scoreBacktestStrength(backtest),
    weights: { long: 0.22, medium: 0.16, short: 0.08 },
  },
  {
    id: "recommendation",
    label: "Recommendation quality",
    score: ({ analysis }) => scoreRecommendationQuality(analysis),
    weights: { long: 0.12, medium: 0.1, short: 0.08 },
  },
  {
    id: "momentum",
    label: "Recent momentum",
    score: ({ stock }) => scoreRecentMomentum(stock),
    weights: { long: 0.04, medium: 0.06, short: 0.18 },
  },
  {
    id: "volatility",
    label: "Volatility fit",
    score: ({ stock }) => scoreVolatilityFit(stock),
    weights: { long: 0.06, medium: 0.08, short: 0.12 },
  },
  {
    id: "longTrend",
    label: "Long-term trend",
    score: ({ stock }) => scoreLongTermTrend(stock),
    weights: { long: 0.18, medium: 0.0, short: 0.0 },
  },
];

function buildOpportunityScore(input: OpportunityScoreInput) {
  const weighted = opportunityScoreModules.map((module) => {
    const result = module.score(input);
    const weight = module.weights[input.horizon];
    return {
      label: module.label,
      note: result.note,
      value: clamp(result.value, 0, 100),
      weight,
    };
  });
  const totalWeight = weighted.reduce((total, component) => total + component.weight, 0) || 1;
  const score = weighted.reduce((total, component) => total + component.value * component.weight, 0) / totalWeight;

  return {
    components: weighted.map(({ label, note, value }) => ({
      label,
      note,
      value: Math.round(value),
    })),
    score: Math.round(score),
  };
}

function buildAdaptiveClientBucketPlan(input: PersonalPlanInput, ranked: ScannedOpportunity[]): AllocationBucket[] {
  const eligibleStocks = ranked.filter((opportunity) =>
    isOpportunityEligible(opportunity, getPlanTuning(input.riskProfile, input.horizon), input.riskProfile, input.horizon),
  );
  const topStockScore = averageScore(eligibleStocks.slice(0, 5).map((opportunity) => opportunity.score), 45);
  const riskAdjustedStock = averageScore(
    eligibleStocks.slice(0, 5).map((opportunity) =>
      opportunity.score * 0.55
      + scoreRiskRewardQuality(opportunity.riskRewardRatio).value * 0.25
      + scoreVolatilityFit(opportunity.stock).value * 0.2,
    ),
    45,
  );
  const marketRegimeBoost = topStockScore >= 72 ? 8 : topStockScore <= 55 ? -10 : 0;
  const bucketScores: Record<AllocationBucketKind, number> = {
    cash: clamp(65 + (input.riskProfile === "safe" ? 14 : 0) + (input.horizon === "short" ? 14 : 0) - Math.max(0, topStockScore - 58) * 0.35, 0, 100),
    gold: clamp(58 + (topStockScore < 60 ? 14 : 0) + (input.horizon === "short" ? 4 : 0), 0, 100),
    highRisk: input.riskProfile === "safe" ? 0 : 0,
    index: clamp(68 + marketRegimeBoost + (input.horizon === "long" ? 8 : 0), 0, 100),
    stocks: clamp(topStockScore * 0.55 + getClientUserFitScore("stocks", input.riskProfile, input.horizon) * 0.25 + riskAdjustedStock * 0.2, 0, 100),
  };
  const weights = normalizeClientAdaptiveWeights(bucketScores, input.riskProfile, input.horizon);
  const indexSuggestion = getIndexSipSuggestion(input.currency);
  const buckets: Array<Omit<AllocationBucket, "amountLabel" | "percent">> = [
    {
      amount: input.amount * weights.index,
      description: "Adaptive broad-market Index / SIP exposure.",
      kind: "index",
      reason: "Fallback engine favored diversified broad-market exposure from ranked opportunity scores.",
      score: Math.round(bucketScores.index),
      suggestion: indexSuggestion,
      title: "Index / SIP",
    },
    {
      amount: input.amount * weights.stocks,
      description: "Adaptive allocation to selected AI stock picks.",
      kind: "stocks",
      reason: "Fallback engine sized stocks from ranked opportunity quality.",
      score: Math.round(bucketScores.stocks),
      suggestion: "Selected from today's AI-ranked scan.",
      title: "AI-Rated Stocks",
    },
    {
      amount: input.amount * weights.gold,
      description: "Adaptive hedge and diversification sleeve.",
      kind: "gold",
      reason: "Fallback engine used gold as a diversifier when direct stock quality was not dominant.",
      score: Math.round(bucketScores.gold),
      suggestion: "Gold ETF",
      title: "Gold / ETF",
    },
    {
      amount: input.amount * weights.cash,
      description: "Active reserve for weak or risky opportunity sets.",
      kind: "cash",
      reason: "Cash is held actively when opportunity quality does not justify full deployment.",
      score: Math.round(bucketScores.cash),
      suggestion: "Hold as cash reserve.",
      title: "Cash Buffer",
    },
  ];

  return normalizeBucketAmounts(buckets, input.amount, input.currency);
}

function averageScore(values: number[], fallback: number) {
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : fallback;
}

function getClientUserFitScore(kind: AllocationBucketKind, riskProfile: RiskProfile, horizon: InvestmentGoal) {
  const base: Record<RiskProfile, Record<AllocationBucketKind, number>> = {
    aggressive: { cash: 28, gold: 42, highRisk: 72, index: 62, stocks: 86 },
    balanced: { cash: 54, gold: 62, highRisk: 36, index: 76, stocks: 66 },
    safe: { cash: 82, gold: 72, highRisk: 0, index: 78, stocks: 40 },
  };
  const horizonAdjustment: Record<InvestmentGoal, Record<AllocationBucketKind, number>> = {
    long: { cash: -18, gold: -4, highRisk: 8, index: 8, stocks: 12 },
    medium: { cash: 0, gold: 0, highRisk: 0, index: 0, stocks: 0 },
    short: { cash: 20, gold: 4, highRisk: -22, index: 5, stocks: -12 },
  };

  return clamp(base[riskProfile][kind] + horizonAdjustment[horizon][kind], 0, 100);
}

function normalizeClientAdaptiveWeights(scores: Record<AllocationBucketKind, number>, riskProfile: RiskProfile, horizon: InvestmentGoal) {
  const caps = getClientBucketCaps(riskProfile, horizon);
  const raw = {
    cash: Math.pow(Math.max(0, scores.cash), 1.35),
    gold: Math.pow(Math.max(0, scores.gold), 1.35),
    highRisk: 0,
    index: Math.pow(Math.max(0, scores.index), 1.35),
    stocks: Math.pow(Math.max(0, scores.stocks), 1.35),
  };
  const total = Object.values(raw).reduce((sum, value) => sum + value, 0) || 1;
  const weights = {
    cash: raw.cash / total,
    gold: raw.gold / total,
    highRisk: 0,
    index: raw.index / total,
    stocks: raw.stocks / total,
  };

  weights.cash = Math.max(weights.cash, caps.cashMin);
  weights.stocks = Math.min(weights.stocks, caps.stocksMax);
  const normalizedTotal = weights.cash + weights.gold + weights.index + weights.stocks;
  return {
    cash: weights.cash / normalizedTotal,
    gold: weights.gold / normalizedTotal,
    highRisk: 0,
    index: weights.index / normalizedTotal,
    stocks: weights.stocks / normalizedTotal,
  };
}

function getClientBucketCaps(riskProfile: RiskProfile, horizon: InvestmentGoal) {
  const base = {
    aggressive: { cashMin: 0.05, stocksMax: 0.6 },
    balanced: { cashMin: 0.1, stocksMax: 0.4 },
    safe: { cashMin: 0.2, stocksMax: 0.2 },
  }[riskProfile];

  return {
    cashMin: base.cashMin + (horizon === "short" ? 0.12 : horizon === "long" ? -0.04 : 0),
    stocksMax: base.stocksMax + (horizon === "long" ? 0.05 : horizon === "short" ? -0.08 : 0),
  };
}

function normalizeBucketAmounts(
  buckets: Array<Omit<AllocationBucket, "amountLabel" | "percent">>,
  totalAmount: number,
  currency: CurrencyCode,
) {
  let allocated = 0;

  return buckets.map((bucket, index) => {
    const amount = index === buckets.length - 1
      ? Math.max(0, totalAmount - allocated)
      : Math.max(0, roundInvestmentAmount(bucket.amount, currency));
    allocated += amount;

    return {
      ...bucket,
      amount,
      amountLabel: "",
      percent: 0,
    };
  });
}

function distributeUnusedStockAllocation({
  buckets,
  currency,
  horizon,
  riskProfile,
  stockInvestAmount,
  unusedStockAmount,
}: {
  buckets: AllocationBucket[];
  currency: CurrencyCode;
  horizon: InvestmentGoal;
  riskProfile: RiskProfile;
  stockInvestAmount: number;
  unusedStockAmount: number;
}) {
  const adjusted = buckets.map((bucket) => ({ ...bucket }));
  const stockBucket = adjusted.find((bucket) => bucket.kind === "stocks");
  const indexBucket = adjusted.find((bucket) => bucket.kind === "index");
  const cashBucket = adjusted.find((bucket) => bucket.kind === "cash");

  if (stockBucket) {
    stockBucket.amount = stockInvestAmount;
  }

  if (unusedStockAmount > 0) {
    const indexRate = getUnusedStockIndexRedirectRate(riskProfile, horizon);
    const indexShare = roundInvestmentAmount(unusedStockAmount * indexRate, currency);
    const cashShare = Math.max(0, unusedStockAmount - indexShare);

    if (indexBucket) {
      indexBucket.amount += indexShare;
      indexBucket.suggestion = "Broad index exposure plus unused stock allocation.";
    }

    if (cashBucket) {
      cashBucket.amount += cashShare;
      cashBucket.suggestion = "Cash buffer plus unused stock allocation.";
    }
  }

  return adjusted.filter((bucket) => bucket.amount > 0);
}

function getUnusedStockIndexRedirectRate(riskProfile: RiskProfile, horizon: InvestmentGoal) {
  if (riskProfile === "safe") {
    return horizon === "short" ? 0.2 : 0.3;
  }

  if (riskProfile === "aggressive") {
    return horizon === "long" ? 0.85 : 0.75;
  }

  return horizon === "short" ? 0.5 : 0.65;
}

function getIndexSipSuggestion(currency: CurrencyCode) {
  if (currency === "INR") {
    return "Nifty 50 Index Fund + Nifty Next 50 Index Fund";
  }

  if (currency === "USD") {
    return "S&P 500 ETF + Nasdaq 100 ETF";
  }

  return "Broad-market index fund or ETF";
}

function getIndexDetailOptions(currency: CurrencyCode, amount: number, market: MarketInfo) {
  if (currency === "INR") {
    const nifty50Amount = roundInvestmentAmount(amount * 0.65, currency);
    const next50Amount = Math.max(0, amount - nifty50Amount);

    return [
      {
        amountLabel: formatPlanCurrency(nifty50Amount, market),
        expectedReturn: "8-11% expected return",
        name: "Nifty 50 Index Fund",
        riskLevel: "Moderate risk",
        reason: "Broad Indian market exposure.",
        score: 84,
        shortName: "Nifty 50",
      },
      {
        amountLabel: formatPlanCurrency(next50Amount, market),
        expectedReturn: "10-14% expected return",
        name: "Nifty Next 50 Index Fund",
        riskLevel: "Moderate-high risk",
        reason: "Growth exposure.",
        score: 78,
        shortName: "Nifty Next 50",
      },
    ];
  }

  if (currency === "USD") {
    const sp500Amount = roundInvestmentAmount(amount * 0.65, currency);
    const nasdaqAmount = Math.max(0, amount - sp500Amount);

    return [
      {
        amountLabel: formatPlanCurrency(sp500Amount, market),
        expectedReturn: "8-11% expected return",
        name: "S&P 500 ETF",
        riskLevel: "Moderate risk",
        reason: "Broad US market exposure.",
        score: 85,
        shortName: "S&P 500",
      },
      {
        amountLabel: formatPlanCurrency(nasdaqAmount, market),
        expectedReturn: "10-15% expected return",
        name: "Nasdaq 100 ETF",
        riskLevel: "Growth risk",
        reason: "Growth and technology exposure.",
        score: 80,
        shortName: "Nasdaq 100",
      },
    ];
  }

  return [
    {
      amountLabel: formatPlanCurrency(amount, market),
      expectedReturn: "7-11% expected return",
      name: "Broad-market index fund or ETF",
      riskLevel: "Moderate risk",
      reason: "Diversified market exposure.",
      score: 82,
      shortName: "Broad Index",
    },
  ];
}

function buildCashReason(unusedStockAmount: number, selectedCount: number) {
  if (selectedCount === 0) {
    return "MarketMind recommends holding cash because available opportunities do not sufficiently outperform cash today.";
  }

  if (unusedStockAmount > 0) {
    return "MarketMind kept part of the plan in cash because only some direct-stock opportunities cleared the quality filters.";
  }

  return "Cash preserves flexibility while the plan deploys into higher-scoring buckets.";
}

function getPreferenceNote(riskProfile: RiskProfile, horizon: InvestmentGoal) {
  const riskCopy: Record<RiskProfile, string> = {
    aggressive: "Aggressive profile: lower cash, more positions, and more room for growth-oriented volatility.",
    balanced: "Balanced profile: moderate cash, diversified buckets, and selective AI stock exposure.",
    safe: "Safe profile: higher cash, fewer stock positions, and a stricter quality bar.",
  };
  const horizonCopy: Record<InvestmentGoal, string> = {
    long: "Long term: favors trend quality and allows longer holding periods.",
    medium: "Medium term: balances sentiment, trend, and risk/reward.",
    short: "Short term: favors stronger sentiment, momentum, and lower volatility.",
  };

  return `${riskCopy[riskProfile]} ${horizonCopy[horizon]}`;
}

function buildPolicyHighlights({
  cashAmount,
  horizon,
  maxPositions,
  minimumScore,
  totalAmount,
}: {
  cashAmount: number;
  horizon: InvestmentGoal;
  maxPositions: number;
  minimumScore: number;
  totalAmount: number;
}) {
  const holdFocus: Record<InvestmentGoal, string> = {
    long: "Hold 12-24 months",
    medium: "Hold 3-12 months",
    short: "Hold 2-8 weeks",
  };

  return [
    `Cash ${Math.round((cashAmount / totalAmount) * 100)}%`,
    `Stock score ${minimumScore}+`,
    `Up to ${maxPositions} stocks`,
    holdFocus[horizon],
  ];
}

function allocateStockBucketByOpportunityQuality({
  amount,
  currency,
  horizon,
  opportunities,
  riskProfile,
}: {
  amount: number;
  currency: CurrencyCode;
  horizon: InvestmentGoal;
  opportunities: ScannedOpportunity[];
  riskProfile: RiskProfile;
}) {
  const tuning = getPlanTuning(riskProfile, horizon);
  const selected = opportunities
    .filter((opportunity) => isOpportunityEligible(opportunity, tuning, riskProfile, horizon))
    .sort((a, b) => getOpportunitySelectionScore(b, riskProfile, horizon) - getOpportunitySelectionScore(a, riskProfile, horizon))
    .slice(0, tuning.maxPositions);

  if (!selected.length) {
    return {
      investAmount: 0,
      positions: [] as AllocationPosition[],
      selectedCount: 0,
      unusedAmount: amount,
    };
  }

  const averageScore = selected.reduce((total, opportunity) => total + opportunity.score, 0) / selected.length;
  const qualityMultiplier = clamp((averageScore - tuning.minimumScore) / (96 - tuning.minimumScore), tuning.minimumDeployRate, 1);
  const rawInvestAmount = amount * qualityMultiplier;
  const investAmount = Math.min(amount, roundInvestmentAmount(rawInvestAmount, currency));
  const weightTotal = selected.reduce(
    (total, opportunity) => total + Math.pow(opportunity.score - tuning.minimumScore + 1, tuning.scorePower),
    0,
  );
  let allocated = 0;
  const positions = selected.map((opportunity, index) => {
    const weight = Math.pow(opportunity.score - tuning.minimumScore + 1, tuning.scorePower) / weightTotal;
    const rawAmount = index === selected.length - 1 ? investAmount - allocated : investAmount * weight;
    const roundedAmount = Math.max(0, roundInvestmentAmount(rawAmount, currency));
    allocated += roundedAmount;

    return {
      ...opportunity,
      amount: roundedAmount,
      amountLabel: "",
    };
  }).filter((position) => position.amount > 0);

  const adjustedAllocated = positions.reduce((total, position) => total + position.amount, 0);

  return {
    investAmount: adjustedAllocated,
    positions,
    selectedCount: selected.length,
    unusedAmount: Math.max(0, amount - adjustedAllocated),
  };
}

type PlanTuning = {
  maxPositions: number;
  minimumDeployRate: number;
  minimumRiskReward: number;
  minimumScore: number;
  scorePower: number;
};

function getPlanTuning(riskProfile: RiskProfile, horizon: InvestmentGoal): PlanTuning {
  if (riskProfile === "safe") {
    const horizonAdjustment = horizon === "short" ? 4 : horizon === "long" ? -2 : 0;
    return {
      maxPositions: horizon === "short" ? 1 : 2,
      minimumDeployRate: horizon === "short" ? 0.15 : horizon === "long" ? 0.35 : 0.25,
      minimumRiskReward: horizon === "short" ? 1.6 : 1.4,
      minimumScore: 84 + horizonAdjustment,
      scorePower: 1.05,
    };
  }

  if (riskProfile === "aggressive") {
    const horizonAdjustment = horizon === "short" ? 4 : horizon === "long" ? -6 : 0;
    return {
      maxPositions: horizon === "short" ? 4 : horizon === "long" ? 7 : 6,
      minimumDeployRate: horizon === "long" ? 0.9 : horizon === "short" ? 0.65 : 0.78,
      minimumRiskReward: horizon === "short" ? 1.25 : 1.15,
      minimumScore: 55 + horizonAdjustment,
      scorePower: horizon === "long" ? 1.7 : 1.5,
    };
  }

  const horizonAdjustment = horizon === "short" ? 3 : horizon === "long" ? -3 : 0;
  return {
    maxPositions: horizon === "short" ? 3 : horizon === "long" ? 5 : 4,
    minimumDeployRate: horizon === "long" ? 0.7 : horizon === "short" ? 0.45 : 0.58,
    minimumRiskReward: horizon === "short" ? 1.35 : 1.2,
    minimumScore: 68 + horizonAdjustment,
    scorePower: 1.25,
  };
}

function isOpportunityEligible(
  opportunity: ScannedOpportunity,
  tuning: PlanTuning,
  riskProfile: RiskProfile,
  horizon: InvestmentGoal,
) {
  if (opportunity.analysis.final_recommendation === "AVOID") {
    return false;
  }

  const volatilityScore = getComponentValue(opportunity, "Volatility fit");
  const momentumScore = getComponentValue(opportunity, "Recent momentum");
  const sentimentScore = getComponentValue(opportunity, "News sentiment");
  const longTrendScore = getComponentValue(opportunity, "Long-term trend");
  const riskTone = getRiskDisplay(opportunity.analysis.risk_level).tone;
  const riskReward = opportunity.riskRewardRatio ?? 0;

  if (riskProfile === "safe") {
    return (
      opportunity.score >= tuning.minimumScore &&
      riskTone !== "high" &&
      volatilityScore >= 58 &&
      riskReward >= tuning.minimumRiskReward
    );
  }

  if (horizon === "short" && (volatilityScore < 42 || sentimentScore < 55 || momentumScore < 50)) {
    return false;
  }

  if (riskProfile === "aggressive") {
    const strongUpside = opportunity.potentialProfitRate >= 0.12 && riskReward >= tuning.minimumRiskReward;
    const longTermQuality = horizon === "long" && longTrendScore >= 65;
    return opportunity.score >= tuning.minimumScore || (strongUpside && opportunity.score >= tuning.minimumScore - 6) || longTermQuality;
  }

  return opportunity.score >= tuning.minimumScore && riskReward >= tuning.minimumRiskReward;
}

function getOpportunitySelectionScore(opportunity: ScannedOpportunity, riskProfile: RiskProfile, horizon: InvestmentGoal) {
  const volatilityScore = getComponentValue(opportunity, "Volatility fit");
  const momentumScore = getComponentValue(opportunity, "Recent momentum");
  const sentimentScore = getComponentValue(opportunity, "News sentiment");
  const longTrendScore = getComponentValue(opportunity, "Long-term trend");
  const riskRewardBonus = Math.min((opportunity.riskRewardRatio ?? 0) * 4, 12);
  let score = opportunity.score + riskRewardBonus;

  if (riskProfile === "safe") {
    score += volatilityScore * 0.22;
    score -= getRiskDisplay(opportunity.analysis.risk_level).tone === "high" ? 18 : 0;
  }

  if (riskProfile === "aggressive") {
    score += opportunity.potentialProfitRate * 80;
    score += momentumScore * 0.1;
  }

  if (horizon === "short") {
    score += sentimentScore * 0.18 + momentumScore * 0.2 + volatilityScore * 0.12;
  }

  if (horizon === "long") {
    score += longTrendScore * 0.28;
  }

  return score;
}

function getComponentValue(opportunity: ScannedOpportunity, label: string) {
  return opportunity.components.find((component) => component.label === label)?.value ?? 50;
}

function scoreSentimentQuality(sentiment: SentimentSummary | null) {
  if (!sentiment) {
    return { note: "News sentiment unavailable", value: 48 };
  }

  const value = clamp(50 + sentiment.positive_score * 48 - sentiment.negative_score * 45, 0, 100);
  return {
    note: `${capitalize(sentiment.sentiment)} news sentiment`,
    value,
  };
}

function scoreRiskRewardQuality(ratio: number | null) {
  if (!ratio) {
    return { note: "Risk/reward unavailable", value: 42 };
  }

  const quality = getRiskRewardQuality(ratio);
  const value = ratio < 1
    ? 35
    : ratio < 1.5
      ? 55 + (ratio - 1) * 30
      : ratio <= 2.5
        ? 70 + (ratio - 1.5) * 18
        : 92;

  return {
    note: `${quality} setup at 1 : ${ratio.toFixed(2)}`,
    value: clamp(value, 0, 100),
  };
}

function scoreBacktestStrength(backtest: BacktestData | null) {
  if (!backtest) {
    return { note: "Backtest unavailable", value: 50 };
  }

  const excessReturn = backtest.strategy_return_percent - backtest.buy_hold_return_percent;
  const returnScore = clamp(50 + backtest.strategy_return_percent * 1.2, 0, 100);
  const excessScore = clamp(50 + excessReturn * 1.4, 0, 100);
  const winScore = clamp(backtest.win_rate, 0, 100);
  const drawdownScore = clamp(100 - Math.abs(backtest.max_drawdown) * 2, 0, 100);

  return {
    note: `${formatSignedPercent(backtest.strategy_return_percent)} AI backtest return`,
    value: returnScore * 0.35 + excessScore * 0.3 + winScore * 0.2 + drawdownScore * 0.15,
  };
}

function scoreRecommendationQuality(analysis: AnalysisData) {
  const confidence = normalizeConfidence(analysis.confidence);

  if (analysis.final_recommendation === "BUY") {
    return { note: "MarketMind recommends buying", value: clamp(72 + confidence * 0.22, 0, 100) };
  }

  if (analysis.final_recommendation === "HOLD") {
    return { note: "MarketMind suggests waiting", value: clamp(48 + confidence * 0.08, 0, 100) };
  }

  return { note: "MarketMind recommends avoiding", value: 18 };
}

function scoreRecentMomentum(stock: StockData | null) {
  if (!stock?.history.length) {
    return { note: "Recent momentum unavailable", value: 50 };
  }

  const lookback = stock.history.slice(-22);
  const firstClose = lookback[0]?.close ?? stock.latest_close;
  const momentum = firstClose ? ((stock.latest_close - firstClose) / firstClose) * 100 : 0;

  return {
    note: `${formatSignedPercent(momentum)} recent price momentum`,
    value: clamp(50 + momentum * 2, 0, 100),
  };
}

function scoreVolatilityFit(stock: StockData | null) {
  const volatility = getRecentVolatilityPercent(stock);

  if (volatility === null) {
    return { note: "Volatility unavailable", value: 50 };
  }

  const value = clamp(100 - volatility * 8, 0, 100);
  return {
    note: `${volatility.toFixed(1)}% recent volatility`,
    value,
  };
}

function scoreLongTermTrend(stock: StockData | null) {
  if (!stock?.history.length) {
    return { note: "Long-term trend unavailable", value: 50 };
  }

  const lookback = stock.history.slice(-180);
  const firstClose = lookback[0]?.close ?? stock.latest_close;
  const trend = firstClose ? ((stock.latest_close - firstClose) / firstClose) * 100 : 0;
  const closes = lookback.map((point) => point.close);
  const aboveAverage = closes.length
    ? stock.latest_close >= closes.reduce((sum, close) => sum + close, 0) / closes.length
    : false;

  return {
    note: `${formatSignedPercent(trend)} long-term trend`,
    value: clamp(50 + trend * 1.1 + (aboveAverage ? 12 : -8), 0, 100),
  };
}

function getRecentVolatilityPercent(stock: StockData | null) {
  const history = stock?.history.slice(-45) ?? [];

  if (history.length < 6) {
    return null;
  }

  const returns = history.slice(1).map((point, index) => {
    const previousClose = history[index]?.close ?? point.close;
    return previousClose ? Math.abs((point.close - previousClose) / previousClose) * 100 : 0;
  });

  return returns.reduce((sum, value) => sum + value, 0) / returns.length;
}

function buildOpportunityReasons(
  components: OpportunityScoreComponent[],
  analysis: AnalysisData,
  exitStrategy: ReturnType<typeof buildExitStrategy>,
  horizon: InvestmentGoal,
) {
  const reasons = components
    .filter((component) => component.value >= 68)
    .sort((a, b) => b.value - a.value)
    .slice(0, 3)
    .map((component) => component.note);

  if (!reasons.length) {
    reasons.push(beginnerDecisionReason(analysis));
  }

  if (horizon === "short" && analysis.sentiment_analysis?.sentiment === "positive") {
    reasons.push("Short-term plan favors stronger news sentiment.");
  }

  if (horizon === "long" && exitStrategy.holdingPeriod) {
    reasons.push("Longer horizon allows the setup more time to play out.");
  }

  return Array.from(new Set(reasons)).slice(0, 4);
}

function getOpportunityScoreBand(score: number) {
  if (score >= 82) {
    return "Strong Opportunity";
  }

  if (score >= 74) {
    return "Good Opportunity";
  }

  if (score >= 63) {
    return "Moderate Opportunity";
  }

  return "Weak Opportunity";
}

function adjustHoldingPeriodForHorizon(base: string, horizon: InvestmentGoal) {
  if (horizon === "short") {
    return "2-8 weeks";
  }

  if (horizon === "long") {
    return "12-24 months";
  }

  return base.includes("6-12") ? "6-12 months" : "3-9 months";
}

function normalizeConfidence(confidence: number) {
  return confidence <= 1 ? confidence * 100 : confidence;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function DecisionSection({
  analysis,
  backtest,
  backtestError,
  symbol,
}: {
  analysis: AnalysisData | null;
  backtest: BacktestData | null;
  backtestError: string;
  symbol: string;
}) {
  const market = getMarketInfo(symbol);
  const risk = getRiskDisplay(analysis?.risk_level);
  const verdict = backtest ? getBacktestVerdict(backtest) : null;

  return (
    <section className="decision-section" aria-label="AI signal summary">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{market.label}</p>
          <h2>AI signals</h2>
        </div>
      </div>

      <div className="decision-grid">
        <article className={`decision-card risk-${risk.tone}`}>
          <div className="card-label">
            <span className="card-icon" aria-hidden="true">â—</span>
            <span>How risky is it?</span>
          </div>
          <div>
            <strong>{risk.label}</strong>
            <small>Uncertainty or volatility.</small>
          </div>
        </article>

        <article className="decision-card">
          <div className="card-label">
            <span className="card-icon" aria-hidden="true">â—·</span>
            <span>Portfolio exposure</span>
          </div>
          <strong>{analysis?.suggested_allocation ?? "Waiting for analysis"}</strong>
          <small>Suggested portfolio exposure.</small>
        </article>

        <article className={`decision-card compact-verdict verdict-${verdict?.tone ?? "neutral"}`}>
          <div className="card-label">
            <span className="card-icon" aria-hidden="true">â†—</span>
            <span>Backtest strength</span>
          </div>
          <strong>{verdict?.shortLabel ?? "Waiting"}</strong>
          <small>
            {verdict ? `Historically ${verdict.shortLabel}` : backtestError ? "Backtest not ready" : "Pending"}
          </small>
        </article>
      </div>
    </section>
  );
}

function WhySection({ analysis }: { analysis: AnalysisData }) {
  return (
    <section className="why-section" aria-label="Why did the AI decide this">
      <div className="compact-heading">
        <p className="eyebrow">Plain-English reason</p>
        <h2>Why did the AI decide this?</h2>
      </div>
      <p>{beginnerRecommendationExplanation(analysis.final_recommendation)}</p>
      <p>{beginnerDecisionReason(analysis)}</p>
    </section>
  );
}

function ResolvedResult({ resolved }: { resolved: ResolvedStock }) {
  return (
    <section className="resolved-result" aria-label="Resolved stock search">
      Showing results for <strong>{resolved.name} ({resolved.symbol})</strong>
      <span>{resolved.market}</span>
    </section>
  );
}

function SearchSuggestions({
  matches,
  message,
  onChoose,
}: {
  matches: StockMatch[];
  message: string;
  onChoose: (match: StockMatch) => void;
}) {
  return (
    <section className="search-suggestions" aria-label="Stock search suggestions">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Choose a match</p>
          <h2>{message}</h2>
        </div>
      </div>

      <div className="suggestion-grid">
        {matches.map((match) => (
          <button key={match.symbol} type="button" onClick={() => onChoose(match)}>
            <strong>{match.name}</strong>
            <span>{match.symbol}</span>
            <small>{match.market}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

function CompanyProfileCard({ profile }: { profile: CompanyProfile }) {
  const description = shortenSummary(profile.summary, 620);

  return (
    <section className="profile-card info-section-card" aria-label="About this company">
      <div className="compact-heading">
        <p className="eyebrow">{profile.market}</p>
        <h2>About This Company</h2>
      </div>

      <div className="company-info-layout">
        <div className="company-summary-card">
          <h3>{profile.name}</h3>
          <p className="business-summary">{description}</p>
          {profile.website ? <a href={profile.website} target="_blank" rel="noreferrer">Visit company website</a> : null}
        </div>

        <div className="company-fact-grid" aria-label="Company facts">
          <article>
            <span>Sector</span>
            <strong>{profile.sector || "Not available"}</strong>
          </article>
          <article>
            <span>Industry</span>
            <strong>{profile.industry || "Not available"}</strong>
          </article>
          <article>
            <span>Market Cap</span>
            <strong>{formatMarketCap(profile.market_cap, profile.symbol)}</strong>
          </article>
          <article>
            <span>Symbol</span>
            <strong>{profile.symbol}</strong>
          </article>
        </div>
      </div>
    </section>
  );
}

function MarketSummaryCard({ stock }: { stock: StockData }) {
  const firstClose = stock.history[0]?.close ?? stock.latest_close;
  const changePercent = firstClose ? ((stock.latest_close - firstClose) / firstClose) * 100 : 0;
  const closes = stock.history.map((point) => point.close);
  const high = Math.max(...closes, stock.high);
  const low = Math.min(...closes, stock.low);
  const trend = getTrendDirection(changePercent);

  return (
    <section className="market-summary info-section-card" aria-label="Quick market snapshot">
      <div className="compact-heading">
        <p className="eyebrow">{stock.symbol}</p>
        <h2>Quick Market Snapshot</h2>
      </div>
      <div className="market-summary-grid">
        <MetricCard label="Current Price" value={formatMarketCurrency(stock.latest_close, stock.symbol)} />
        <MetricCard label="52 Week High" value={formatMarketCurrency(high, stock.symbol)} />
        <MetricCard label="52 Week Low" value={formatMarketCurrency(low, stock.symbol)} />
        <MetricCard label="Trend" value={trend.label} tone={trend.tone} />
        <MetricCard label="Volume" value={formatNumber(stock.volume)} />
      </div>
    </section>
  );
}

function AdvancedAnalysis({ analysis, backtest }: { analysis: AnalysisData; backtest: BacktestData | null }) {
  const duplicateHeadlines = analysis.sentiment_analysis?.duplicate_headlines_removed ?? 0;
  const tradeCount = backtest ? backtest.total_trades ?? backtest.number_of_trades ?? backtest.trade_log.length : null;

  return (
    <section className="details-section" aria-label="Advanced analysis">
      <details>
        <summary>Advanced Analysis</summary>
        <div className="detail-rows">
            {analysis.transformer_prediction ? (
              <>
                <DetailRow label="Transformer signal" value={analysis.transformer_prediction.recommendation} />
                <DetailRow label="Transformer confidence" value={getConfidenceLabel(analysis.transformer_prediction.confidence)} />
              </>
            ) : (
              <DetailRow label="Transformer signal" value={analysis.transformer_error ?? "Not ready yet"} />
            )}

            {analysis.sentiment_analysis ? (
              <>
                <DetailRow label="News sentiment" value={capitalize(analysis.sentiment_analysis.sentiment)} />
                <SentimentBars sentiment={analysis.sentiment_analysis} />
                <DetailRow label="Headlines analyzed" value={analysis.sentiment_analysis.headlines_analyzed.toString()} />
                <DetailRow label="News source" value={formatSourceName(analysis.sentiment_analysis.news_source)} />
                <DetailRow label="Duplicate headlines removed" value={duplicateHeadlines.toString()} />
                <DetailRow label="Fallback reason" value={analysis.sentiment_analysis.fallback_reason ?? "None"} />
                <DetailRow label="AI confidence" value={getConfidenceLabel(analysis.confidence)} />
              </>
            ) : (
              <DetailRow label="News sentiment" value={analysis.sentiment_error ?? "Not ready yet"} />
            )}
            {backtest ? (
              <>
                <DetailRow label="AI strategy return" value={formatSignedPercent(backtest.strategy_return_percent)} />
                <DetailRow label="Buy & hold return" value={formatSignedPercent(backtest.buy_hold_return_percent)} />
                <DetailRow label="Backtest difference" value={formatSignedPercent(backtest.strategy_return_percent - backtest.buy_hold_return_percent)} />
                <DetailRow label="Trades" value={formatNumber(tradeCount ?? 0)} />
              </>
            ) : null}
        </div>
      </details>
    </section>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SentimentBars({ sentiment }: { sentiment: SentimentSummary }) {
  const positive = Math.round(sentiment.positive_score * 100);
  const neutral = Math.round(sentiment.neutral_score * 100);
  const negative = Math.max(0, 100 - positive - neutral);

  return (
    <div className="detail-row sentiment-row">
      <span>Sentiment split</span>
      <div className="sentiment-bars">
        <div className="sentiment-stack" aria-label={`${positive}% positive, ${neutral}% neutral, ${negative}% negative`}>
          <i className="positive" style={{ width: `${positive}%` }} />
          <i className="neutral" style={{ width: `${neutral}%` }} />
          <i className="negative" style={{ width: `${negative}%` }} />
        </div>
        <div className="sentiment-legend">
          <span>Positive {positive}%</span>
          <span>Neutral {neutral}%</span>
          <span>Negative {negative}%</span>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  helper,
  tone,
}: {
  label: string;
  value: string;
  helper?: string;
  tone?: "positive" | "negative" | "neutral";
}) {
  return (
    <article className={`metric-card ${tone ?? ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {helper ? <small>{helper}</small> : null}
    </article>
  );
}

function HistoricalPerformance({ backtest }: { backtest: BacktestData }) {
  const tradeCount = backtest.total_trades ?? backtest.number_of_trades ?? backtest.trade_log.length;
  const visibleTrades = backtest.trade_log.slice(-20);
  const buyHoldFinalValue = backtest.benchmark?.final_value ?? backtest.starting_capital * (1 + backtest.buy_hold_return_percent / 100);
  const finalDifference = backtest.final_value - buyHoldFinalValue;

  return (
    <section className="performance-section" aria-label="Historical performance">
      <div className="compact-heading">
        <p className="eyebrow">Main performance chart</p>
        <h2>How would {formatMarketCurrency(backtest.starting_capital, backtest.symbol)} have performed?</h2>
      </div>

      <div className="what-if-grid" aria-label="Starting capital outcome">
        <MetricCard label="Started With" value={formatMarketCurrency(backtest.starting_capital, backtest.symbol)} />
        <MetricCard label="AI Strategy Result" value={formatMarketCurrency(backtest.final_value, backtest.symbol)} helper={formatSignedPercent(backtest.strategy_return_percent)} tone={returnTone(backtest.strategy_return_percent)} />
        <MetricCard label="Buy & Hold Result" value={formatMarketCurrency(buyHoldFinalValue, backtest.symbol)} helper={formatSignedPercent(backtest.buy_hold_return_percent)} tone={returnTone(backtest.buy_hold_return_percent)} />
        <MetricCard label="Difference" value={formatSignedMoney(finalDifference, backtest.symbol)} helper="AI minus buy & hold." tone={returnTone(finalDifference)} />
      </div>

      {backtest.portfolio_history?.length ? (
        <>
          <PortfolioComparisonChart backtest={backtest} trades={visibleTrades} />
          <p className="chart-verdict">{getOutperformanceSentence(backtest)}</p>
        </>
      ) : null}

      {tradeCount === 0 ? (
        <CashTimeline symbol={backtest.symbol} />
      ) : null}

      <details className="nested-details">
        <summary>Detailed Backtest Metrics</summary>
        <div className="backtest-summary-grid">
          <MetricCard label="Starting capital" value={formatMarketCurrency(backtest.starting_capital, backtest.symbol)} />
          <MetricCard label="Final value" value={formatMarketCurrency(backtest.final_value, backtest.symbol)} />
          <MetricCard label="Winning AI Decisions" value={formatPercent(backtest.win_rate)} />
          <MetricCard label="Worst Temporary Loss" value={formatPercent(backtest.max_drawdown)} />
          <MetricCard label="Trades" value={formatNumber(tradeCount)} />
          <MetricCard label="Estimated Fees" value={formatMarketCurrency(backtest.transaction_costs_paid, backtest.symbol)} />
        </div>
      </details>

      <details className="nested-details">
        <summary>Trade History</summary>
        {visibleTrades.length ? (
          <div className="trade-table-wrap">
            <table className="trade-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Action</th>
                  <th>Execution price</th>
                  <th>Shares traded</th>
                  <th>Portfolio value</th>
                  <th>Estimated fee</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {visibleTrades.map((trade, index) => (
                  <tr key={`${trade.date}-${trade.action}-${index}`}>
                    <td>{trade.date}</td>
                    <td>
                      <span className={`action-pill ${trade.action.toLowerCase()}`}>{trade.action}</span>
                    </td>
                    <td>{formatMarketCurrency(trade.execution_price, backtest.symbol)}</td>
                    <td>{formatShares(trade.shares_traded)}</td>
                    <td>{formatMarketCurrency(trade.portfolio_value_after_trade, backtest.symbol)}</td>
                    <td>{formatMarketCurrency(trade.transaction_cost, backtest.symbol)}</td>
                    <td>{trade.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="trade-empty">No executed trades were returned for this backtest.</p>
        )}
      </details>
    </section>
  );
}

function PortfolioComparisonChart({
  backtest,
  trades,
}: {
  backtest: BacktestData;
  trades: TradeLogEntry[];
}) {
  const history: PortfolioChartPoint[] = (backtest.portfolio_history ?? []).map((point) => ({
    ...point,
    date: normalizeChartDate(point.date),
    trade_action: null,
    execution_price: null,
    trade_reason: null,
  }));
  trades.forEach((trade) => {
    const matchedPoint = findPortfolioPointForTrade(trade.date, history);
    if (!matchedPoint) {
      return;
    }

    const point = history[matchedPoint.index];
    point.trade_action = trade.action;
    point.execution_price = trade.execution_price;
    point.trade_reason = trade.reason;
  });

  const values = history.flatMap((point) => [point.ai_value, point.buy_hold_value, backtest.starting_capital]);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const padding = Math.max((maxValue - minValue) * 0.08, backtest.starting_capital * 0.02);

  return (
    <div className="portfolio-chart">
      <div className="chart-title-row">
        <div>
          <h3>Portfolio Growth Comparison</h3>
          <p>This is the main chart showing how the AI strategy performed against simple holding.</p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={360}>
        <LineChart data={history} margin={{ top: 46, right: 18, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#dce5eb" strokeDasharray="4 4" />
          <ReferenceLine y={backtest.starting_capital} stroke="#c1cbd2" strokeDasharray="3 3" />
          <XAxis dataKey="date" tickMargin={10} minTickGap={28} />
          <YAxis
            domain={[minValue - padding, maxValue + padding]}
            tickFormatter={(value) => compactCurrency(Number(value), backtest.symbol)}
            tickMargin={10}
            width={72}
          />
          <Tooltip content={<PortfolioTooltip symbol={backtest.symbol} />} />
          <LegendOverlay />
          <Line
            type="monotone"
            dataKey="ai_value"
            name="AI Strategy"
            stroke="#0f8b8d"
            strokeWidth={3}
            dot={<TradeDot />}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="buy_hold_value"
            name="Buy & Hold"
            stroke="#6d7680"
            strokeDasharray="7 6"
            strokeWidth={2.5}
            dot={false}
            isAnimationActive={false}
          />
          <Brush
            dataKey="date"
            height={18}
            stroke="#9bbdc0"
            travellerWidth={8}
            tickFormatter={() => ""}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function LegendOverlay() {
  return (
    <g className="chart-legend-overlay" transform="translate(18 14)">
      <line x1="0" y1="0" x2="34" y2="0" stroke="#0f8b8d" strokeWidth="3" />
      <text x="42" y="4">AI Strategy</text>
      <line x1="142" y1="0" x2="176" y2="0" stroke="#6d7680" strokeWidth="2.5" strokeDasharray="7 6" />
      <text x="184" y="4">Buy & Hold</text>
      <polygon points="292,-8 284,7 300,7" fill="#0f7a45" />
      <text x="308" y="4">Buy</text>
      <polygon points="354,8 346,-7 362,-7" fill="#b42318" />
      <text x="370" y="4">Sell</text>
    </g>
  );
}

function PortfolioTooltip({
  active,
  payload,
  label,
  symbol,
}: {
  active?: boolean;
  payload?: Array<{
    name?: string;
    dataKey?: string;
    value?: number;
    payload: PortfolioChartPoint;
  }>;
  label?: string;
  symbol: string;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const point = payload.find((item) => "ai_value" in item.payload)?.payload;

  if (!point) {
    return null;
  }

  return (
    <div className="chart-tooltip">
      <strong>Date: {label}</strong>
      <span>AI value: {formatMarketCurrency(point.ai_value, symbol)}</span>
      <span>Buy & hold: {formatMarketCurrency(point.buy_hold_value, symbol)}</span>
      <span>Return: {formatSignedPercent(point.ai_return_percent)} AI / {formatSignedPercent(point.buy_hold_return_percent)} holding</span>
      {point.trade_action ? (
        <div className="tooltip-trade">
          <strong>{point.trade_action}</strong>
          {typeof point.execution_price === "number" ? (
            <span>Execution price: {formatMarketCurrency(point.execution_price, symbol)}</span>
          ) : null}
          {point.trade_reason ? <span>{point.trade_reason}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

function TradeDot({
  cx,
  cy,
  payload,
}: {
  cx?: number;
  cy?: number;
  payload?: PortfolioChartPoint;
}) {
  if (typeof cx !== "number" || typeof cy !== "number" || !payload?.trade_action) {
    return null;
  }

  const isBuy = payload.trade_action === "BUY";
  const points = isBuy
    ? `${cx},${cy - 9} ${cx - 8},${cy + 7} ${cx + 8},${cy + 7}`
    : `${cx},${cy + 9} ${cx - 8},${cy - 7} ${cx + 8},${cy - 7}`;

  return <polygon points={points} fill={isBuy ? "#0f7a45" : "#b42318"} stroke="white" strokeWidth={1.5} />;
}

function normalizeChartDate(value: string) {
  const match = value.match(/\d{4}-\d{2}-\d{2}/);
  if (match) {
    return match[0];
  }

  const parsedDate = new Date(value);
  if (!Number.isNaN(parsedDate.getTime())) {
    return parsedDate.toISOString().slice(0, 10);
  }

  return value;
}

function findPortfolioPointForTrade(tradeDate: string, history: PortfolioHistoryPoint[]) {
  const normalizedTradeDate = normalizeChartDate(tradeDate);
  const exactIndex = history.findIndex((point) => point.date === normalizedTradeDate);

  if (exactIndex >= 0) {
    return { index: exactIndex, point: history[exactIndex] };
  }

  const tradeTime = new Date(`${normalizedTradeDate}T00:00:00`).getTime();
  if (Number.isNaN(tradeTime)) {
    return null;
  }

  const insertionIndex = history.findIndex((point) => point.date > normalizedTradeDate);
  const anchorIndex = insertionIndex >= 0 ? insertionIndex : history.length - 1;
  const candidateStart = Math.max(0, anchorIndex - 3);
  const candidateEnd = Math.min(history.length - 1, anchorIndex + 3);
  const candidates = history.slice(candidateStart, candidateEnd + 1);
  const nearest = candidates
    .map((point, offset) => {
      const index = candidateStart + offset;
      return {
        index,
        point,
        distance: Math.abs(new Date(`${point.date}T00:00:00`).getTime() - tradeTime),
      };
    })
    .filter((item) => !Number.isNaN(item.distance))
    .sort((a, b) => a.distance - b.distance)[0];

  if (!nearest) {
    return null;
  }

  return { index: nearest.index, point: nearest.point };
}

function CashTimeline({ symbol }: { symbol: string }) {
  return (
    <div className="cash-timeline">
      <div>
        <strong>AI stayed in cash</strong>
        <p>The model did not find enough confidence to enter trades during this period.</p>
      </div>
      <div className="timeline-line" aria-hidden="true">
        <span>{formatMarketCurrency(100000, symbol)}</span>
        <i />
        <span>Cash</span>
      </div>
    </div>
  );
}

function ComparisonCard({
  label,
  value,
  tone,
  helper,
}: {
  label: string;
  value: string;
  tone: "positive" | "negative" | "neutral";
  helper: string;
}) {
  return (
    <article className={`comparison-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{helper}</small>
    </article>
  );
}

const investmentGoalOptions: Array<{ value: InvestmentGoal; label: string; range: string }> = [
  { value: "short", label: "Short Term", range: "0-1 years" },
  { value: "medium", label: "Medium Term", range: "1-5 years" },
  { value: "long", label: "Long Term", range: "5+ years" },
];

const riskProfileOptions: Array<{ value: RiskProfile; label: string }> = [
  { value: "safe", label: "Safe" },
  { value: "balanced", label: "Balanced" },
  { value: "aggressive", label: "Aggressive" },
];

const currencyOptions: Array<{ code: CurrencyCode; symbol: string }> = [
  { code: "USD", symbol: "$" },
  { code: "INR", symbol: "â‚¹" },
  { code: "EUR", symbol: "â‚¬" },
  { code: "GBP", symbol: "Â£" },
  { code: "AED", symbol: "Ø¯.Ø¥" },
];

type MarketInfo = ReturnType<typeof getMarketInfo>;

const USD_TO_INR = 83;
const USD_TO_EUR = 0.92;
const USD_TO_GBP = 0.79;
const USD_TO_AED = 3.67;

const currencyUsdRates: Record<CurrencyCode, number> = {
  AED: USD_TO_AED,
  EUR: USD_TO_EUR,
  GBP: USD_TO_GBP,
  INR: USD_TO_INR,
  USD: 1,
};

type InvestmentPlanInput = {
  confidence: number;
  currentPrice: number | null;
  goal: InvestmentGoal;
  market: MarketInfo;
  newsScore: SimpleScore;
  portfolioValue: number;
  recommendation: Recommendation;
  riskLevel: string;
  symbol: string;
  technicalScore: SimpleScore;
};

type ExitStrategyInput = {
  analysis: AnalysisData;
  currentPrice: number | null;
  profileCurrency?: string | null;
  selectedCurrency: CurrencyCode;
  symbol: string;
};

function buildInvestmentPlan({ confidence, currentPrice, goal, market, newsScore, portfolioValue, recommendation, riskLevel, symbol, technicalScore }: InvestmentPlanInput) {
  const allocation = chooseAllocationPercent(recommendation, confidence, riskLevel, goal);
  const nativeCurrency = detectNativeStockCurrency(symbol, market.profileCurrency);
  const convertedPrice = currentPrice && currentPrice > 0
    ? convertCurrency(currentPrice, nativeCurrency, market.currency)
    : null;
  const conversionUnavailable = currentPrice !== null && currentPrice > 0 && convertedPrice === null;
  const effectiveMarket = conversionUnavailable ? getMarketInfo(symbol, market.profileCurrency, nativeCurrency) : market;
  const effectivePortfolioValue = conversionUnavailable
    ? convertCurrency(portfolioValue, market.currency, nativeCurrency) ?? portfolioValue
    : portfolioValue;
  const priceForShares = conversionUnavailable ? currentPrice : convertedPrice;
  const rawAmount = effectivePortfolioValue * (allocation / 100);
  const roundedAmount = allocation > 0 && rawAmount > 0
    ? Math.max(roundInvestmentAmount(rawAmount, effectiveMarket.currency), getInvestmentRoundingIncrement(rawAmount, effectiveMarket.currency))
    : 0;
  const entries = buildEntryPlan(roundedAmount, goal);
  const shares = priceForShares && priceForShares > 0 ? roundedAmount / priceForShares : null;
  const isIndia = symbol.trim().toUpperCase().endsWith(".NS");
  const fullShareCostLabel = priceForShares && priceForShares > 0 ? formatPlanCurrency(priceForShares, effectiveMarket) : null;
  const indianFullShareWarning = Boolean(isIndia && priceForShares && priceForShares > 0 && roundedAmount > 0 && roundedAmount < priceForShares);
  const noBuyMessage = recommendation === "HOLD"
    ? "No purchase recommended right now."
    : "Avoid investing for now.";

  return {
    allocationLabel: allocation > 0 ? formatAllocation(allocation) : "0%",
    conversionWarning: conversionUnavailable ? "Currency conversion unavailable. Showing native stock currency." : null,
    effectiveMarket,
    fullCapitalValue: effectivePortfolioValue,
    entries,
    fullShareCostLabel,
    indianFullShareWarning,
    indianShareNote: isIndia
      ? "Fractional shares may not be available on every platform. If whole shares are required, consider waiting until you have enough to buy one full share."
      : null,
    noBuyMessage,
    positionBadge: getPositionSizeBadge(recommendation, confidence, technicalScore, newsScore),
    positionLabel: allocation > 0 ? formatPlanCurrency(roundedAmount, effectiveMarket) : formatPlanCurrency(0, effectiveMarket),
    sharesLabel: shares ? `${formatShares(shares)} shares` : "0.00 shares",
    suggestedAmountValue: roundedAmount,
  };
}

function buildExitStrategy({ analysis, currentPrice, profileCurrency, selectedCurrency, symbol }: ExitStrategyInput) {
  const selectedMarket = getMarketInfo(symbol, profileCurrency, selectedCurrency);
  const nativeCurrency = detectNativeStockCurrency(symbol, profileCurrency);
  const convertedPrice = currentPrice && currentPrice > 0
    ? convertCurrency(currentPrice, nativeCurrency, selectedCurrency)
    : null;
  const conversionUnavailable = currentPrice !== null && currentPrice > 0 && convertedPrice === null;
  const effectiveMarket = conversionUnavailable ? getMarketInfo(symbol, profileCurrency, nativeCurrency) : selectedMarket;
  const price = conversionUnavailable ? currentPrice : convertedPrice;
  const targetMultiplier = analysis.final_recommendation === "AVOID" ? 1 : analysis.final_recommendation === "BUY" ? 1.15 : 1.08;
  const stopLossMultiplier = getStopLossMultiplier(analysis.risk_level);
  const holdingPeriod = analysis.final_recommendation === "BUY" ? "6-12 months" : "3-6 months";

  if (!price || price <= 0) {
    return {
      conversionWarning: conversionUnavailable ? "Currency conversion unavailable. Showing native stock currency." : null,
      currentPriceLabel: "Price unavailable",
      downsideRate: 0,
      downsideLabel: "Not available",
      entryRangeLabel: "Price unavailable",
      effectiveMarket,
      holdingPeriod,
      riskRewardRatio: null,
      riskRewardLabel: "Not available",
      riskRewardPreciseLabel: "Not available",
      riskRewardQuality: "Weak",
      stopLossLabel: "Price unavailable",
      targetLabel: "Price unavailable",
      upsideRate: 0,
      upsideLabel: "Not available",
    };
  }

  const entryLow = price * 0.98;
  const entryHigh = price * 1.02;
  const target = price * targetMultiplier;
  const stopLoss = price * stopLossMultiplier;
  const reward = target - price;
  const risk = price - stopLoss;
  const riskReward = risk > 0 ? reward / risk : null;

  return {
    conversionWarning: conversionUnavailable ? "Currency conversion unavailable. Showing native stock currency." : null,
    currentPriceLabel: formatPlanCurrency(price, effectiveMarket),
    downsideRate: Math.abs((stopLoss - price) / price),
    downsideLabel: formatWholeSignedPercent(((stopLoss - price) / price) * 100),
    effectiveMarket,
    entryRangeLabel: `${formatPlanCurrency(entryLow, effectiveMarket)} - ${formatPlanCurrency(entryHigh, effectiveMarket)}`,
    holdingPeriod,
    riskRewardRatio: riskReward,
    riskRewardLabel: riskReward ? `1 : ${riskReward.toFixed(1)}` : "Not available",
    riskRewardPreciseLabel: riskReward ? `1 : ${riskReward.toFixed(2)}` : "Not available",
    riskRewardQuality: getRiskRewardQuality(riskReward),
    stopLossLabel: formatPlanCurrency(stopLoss, effectiveMarket),
    targetLabel: formatPlanCurrency(target, effectiveMarket),
    upsideRate: Math.max(0, (target - price) / price),
    upsideLabel: formatWholeSignedPercent(((target - price) / price) * 100),
  };
}

function chooseAllocationPercent(
  recommendation: Recommendation,
  confidence: number,
  riskLevel: string,
  goal: InvestmentGoal,
) {
  if (recommendation === "AVOID") {
    return 0;
  }

  if (recommendation === "HOLD") {
    if (goal === "short") {
      return 0;
    }
    return goal === "medium" ? 2 : 5;
  }

  const range = getBuyAllocationRange(confidence);
  const riskAdjustedRange = adjustRangeForRisk(range, riskLevel);

  if (goal === "short") {
    return riskAdjustedRange[0];
  }

  if (goal === "long") {
    return riskAdjustedRange[1];
  }

  return (riskAdjustedRange[0] + riskAdjustedRange[1]) / 2;
}

function getBuyAllocationRange(confidence: number): [number, number] {
  if (confidence >= 75) {
    return [12, 15];
  }

  if (confidence >= 65) {
    return [8, 12];
  }

  if (confidence >= 55) {
    return [5, 8];
  }

  return [3, 5];
}

function adjustRangeForRisk(range: [number, number], riskLevel: string): [number, number] {
  if (riskLevel.toLowerCase().includes("high")) {
    return [range[0] * 0.7, range[1] * 0.7];
  }

  return range;
}

function getStopLossMultiplier(riskLevel: string) {
  const risk = getRiskDisplay(riskLevel);

  if (risk.tone === "low") {
    return 0.92;
  }

  if (risk.tone === "high") {
    return 0.85;
  }

  return 0.88;
}

function getRiskRewardQuality(ratio: number | null) {
  if (!ratio || ratio < 1) {
    return "Poor";
  }

  if (ratio < 1.5) {
    return "Weak";
  }

  if (ratio <= 2.5) {
    return "Good";
  }

  return "Excellent";
}

function getRiskRewardTone(ratio: number | null) {
  if (!ratio || ratio < 1) {
    return "poor";
  }

  if (ratio < 1.5) {
    return "weak";
  }

  if (ratio <= 2.5) {
    return "good";
  }

  return "excellent";
}

function getRiskRewardExplanation(ratio: number | null) {
  const quality = getRiskRewardQuality(ratio);

  if (quality === "Poor") {
    return "The possible reward is smaller than the possible loss. This is not an attractive setup.";
  }

  if (quality === "Weak") {
    return "The possible reward is only slightly better than the possible loss. Be selective.";
  }

  if (quality === "Good") {
    return "The possible reward is meaningfully larger than the possible loss.";
  }

  return "The possible reward is much larger than the possible loss.";
}

function getPositionSizeBadge(
  recommendation: Recommendation,
  confidence: number,
  technicalScore: SimpleScore,
  newsScore: SimpleScore,
) {
  if (recommendation === "AVOID") {
    return "No Position Suggested";
  }

  if (confidence < 55) {
    return "Low Confidence Setup";
  }

  if (technicalScore === "Good" && newsScore === "Good" && recommendation === "BUY") {
    return "Strong Setup";
  }

  return "Mixed Setup";
}

function getConfidenceLabel(confidence: number) {
  if (confidence < 55) {
    return "Low Confidence";
  }

  if (confidence < 65) {
    return "Moderate Confidence";
  }

  return "High Confidence";
}

type SimpleScore = "Good" | "Okay" | "Weak";

function getMainVerdict(recommendation: Recommendation, confidence: number) {
  if (recommendation === "BUY") {
    return confidence < 55 ? "Worth Considering" : "Buy";
  }

  if (recommendation === "HOLD") {
    return "Wait and Watch";
  }

  return "Avoid for Now";
}

function getVerdictTone(recommendation: Recommendation, confidence: number) {
  if (recommendation === "BUY" && confidence < 55) {
    return "consider";
  }

  return recommendation.toLowerCase();
}

function getSuggestedActionLabel(recommendation: Recommendation, confidence: number) {
  if (recommendation === "BUY" && confidence < 55) {
    return "Start Small";
  }

  if (recommendation === "BUY") {
    return "Build Position";
  }

  if (recommendation === "HOLD") {
    return "Wait";
  }

  return "Avoid";
}

function getVerdictReason(analysis: AnalysisData, confidenceLabel: string) {
  if (analysis.final_recommendation === "BUY" && confidenceLabel === "Low Confidence") {
    return "The AI sees some positive signals, but confidence is still low. Start small if you choose to invest.";
  }

  if (analysis.final_recommendation === "BUY") {
    return "Business/news outlook looks positive and AI confidence is supportive.";
  }

  if (analysis.final_recommendation === "HOLD") {
    return "The AI does not currently see a strong buying opportunity.";
  }

  return "The AI currently sees more downside risk than upside opportunity.";
}

function getTechnicalScore(analysis: AnalysisData): SimpleScore {
  const signal = analysis.transformer_prediction?.recommendation;

  if (signal === "BUY") {
    return "Good";
  }

  if (signal === "AVOID") {
    return "Weak";
  }

  return "Okay";
}

function getNewsScore(analysis: AnalysisData): SimpleScore {
  const sentiment = analysis.sentiment_analysis?.sentiment;

  if (sentiment === "positive") {
    return "Good";
  }

  if (sentiment === "negative") {
    return "Weak";
  }

  return "Okay";
}

function getRiskScore(riskLevel: string): SimpleScore {
  const risk = getRiskDisplay(riskLevel);

  if (risk.tone === "low") {
    return "Good";
  }

  if (risk.tone === "high") {
    return "Weak";
  }

  return "Okay";
}

function getBacktestScore(backtest: BacktestData | null): SimpleScore {
  if (!backtest) {
    return "Okay";
  }

  const difference = backtest.strategy_return_percent - backtest.buy_hold_return_percent;

  if (difference > 0 && backtest.strategy_return_percent >= 0) {
    return "Good";
  }

  if (difference < 0) {
    return "Weak";
  }

  return "Okay";
}

function buildAIScore(analysis: AnalysisData, backtest: BacktestData | null) {
  const components = [
    { label: "Technical", value: simpleScoreToNumber(getTechnicalScore(analysis)) },
    { label: "News", value: simpleScoreToNumber(getNewsScore(analysis)) },
    { label: "Backtest", value: simpleScoreToNumber(getBacktestScore(backtest)) },
    { label: "Risk", value: simpleScoreToNumber(getRiskScore(analysis.risk_level)) },
    { label: "Confidence", value: confidenceScoreToNumber(analysis.confidence) },
  ];
  const score = components.reduce((total, component) => total + component.value, 0) / components.length;

  return {
    components,
    score,
    scoreLabel: `${score.toFixed(1)} / 10`,
    setupLabel: getAIScoreLabel(score),
  };
}

function simpleScoreToNumber(score: SimpleScore) {
  if (score === "Good") {
    return 8;
  }

  if (score === "Weak") {
    return 2;
  }

  return 5;
}

function confidenceScoreToNumber(confidence: number) {
  if (confidence < 55) {
    return 4;
  }

  if (confidence < 65) {
    return 6;
  }

  return 8;
}

function getAIScoreLabel(score: number) {
  if (score < 5) {
    return "Weak Setup";
  }

  if (score < 7) {
    return "Mixed Setup";
  }

  if (score <= 8.4) {
    return "Good Setup";
  }

  return "Strong Setup";
}

function buildProfitOutcomePlanner(
  investmentPlan: ReturnType<typeof buildInvestmentPlan>,
  exitStrategy: ReturnType<typeof buildExitStrategy>,
  recommendation: Recommendation,
) {
  const market = investmentPlan.effectiveMarket;
  const upsideRate = recommendation === "AVOID" ? 0 : exitStrategy.upsideRate;
  const downsideRate = exitStrategy.downsideRate;
  const suggestedAmount = investmentPlan.suggestedAmountValue;
  const fullCapital = investmentPlan.fullCapitalValue;
  const potentialProfit = suggestedAmount * upsideRate;
  const potentialLoss = suggestedAmount * downsideRate;
  const fullProfit = fullCapital * upsideRate;
  const fullLoss = fullCapital * downsideRate;
  const minimumMeaningfulProfit = getMeaningfulProfitThreshold(market.currency);
  const worthMessage = potentialProfit > 0 && potentialProfit < minimumMeaningfulProfit
    ? "This opportunity may not generate meaningful returns at the current position size."
    : null;

  return {
    conversionWarning: investmentPlan.conversionWarning ?? exitStrategy.conversionWarning,
    fullCapitalLabel: formatPlanCurrency(fullCapital, market),
    fullLossLabel: formatPlanCurrency(fullLoss, market),
    fullProfitLabel: formatPlanCurrency(fullProfit, market),
    potentialLossLabel: formatPlanCurrency(potentialLoss, market),
    potentialProfitLabel: formatPlanCurrency(potentialProfit, market),
    requiredCapital: getDesiredProfitTargets(market.currency).map((target) => {
      const requiredInvestment = upsideRate > 0 ? target / upsideRate : 0;
      const targetLabel = formatPlanCurrency(target, market);
      const requiredLabel = upsideRate > 0 ? formatPlanCurrency(requiredInvestment, market) : "No target";

      return {
        explanation: upsideRate > 0
          ? `To potentially make ${targetLabel}, you may need to invest about ${requiredLabel} if the stock reaches its target.`
          : "No profit target is shown while the recommendation is Avoid.",
        requiredLabel,
        targetLabel,
      };
    }),
    suggestedPositionLabel: investmentPlan.positionLabel,
    worthMessage,
  };
}

function getMeaningfulProfitThreshold(currency: CurrencyCode) {
  if (currency === "INR") {
    return 500;
  }

  if (currency === "AED") {
    return 50;
  }

  return 10;
}

function getDesiredProfitTargets(currency: CurrencyCode) {
  if (currency === "INR") {
    return [500, 1000, 5000];
  }

  if (currency === "AED") {
    return [50, 100, 500];
  }

  return [10, 50, 100];
}

function roundInvestmentAmount(amount: number, currency: string) {
  const roundTo = getInvestmentRoundingIncrement(amount, currency);
  return Math.round(amount / roundTo) * roundTo;
}

function getInvestmentRoundingIncrement(amount: number, currency: string) {
  if (currency === "INR") {
    return amount < 1000 ? 100 : 500;
  }

  if (currency === "AED") {
    return 50;
  }

  return 10;
}

function buildEntryPlan(amount: number, goal: InvestmentGoal) {
  if (amount <= 0) {
    return [];
  }

  const labelsByGoal: Record<InvestmentGoal, string[]> = {
    short: ["now", "in 1 week"],
    medium: ["now", "in 1 week", "in 2 weeks"],
    long: ["now", "in 2 weeks", "in 1 month", "in 6 weeks"],
  };
  const labels = labelsByGoal[goal];
  const baseAmount = amount / labels.length;

  return labels.map((label) => ({
    amount: baseAmount,
    label,
  }));
}

function goalLabel(goal: InvestmentGoal) {
  if (goal === "short") {
    return "Short-term entry.";
  }

  if (goal === "long") {
    return "Long-term staggered entry.";
  }

  return "Medium-term staggered entry.";
}

function formatAllocation(value: number) {
  return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)}%`;
}

function cleanAmountInput(value: string) {
  const digitsOnly = value.replace(/\D/g, "");
  const withoutLeadingZeros = digitsOnly.replace(/^0+(?=\d)/, "");
  return withoutLeadingZeros;
}

function formatPlanCurrency(value: number, market: MarketInfo) {
  return value.toLocaleString(market.locale, {
    currency: market.currency,
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
    style: "currency",
  });
}

function formatAssetPrice(value: number | string | null | undefined, market: MarketInfo) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return "Price unavailable";
  }

  return numeric.toLocaleString(market.locale, {
    currency: market.currency,
    maximumFractionDigits: numeric >= 100 ? 0 : 2,
    style: "currency",
  });
}

function friendlyRecommendation(recommendation: Recommendation) {
  if (recommendation === "BUY") {
    return "Consider Buying";
  }

  if (recommendation === "HOLD") {
    return "Wait and Watch";
  }

  return "Avoid for Now";
}

function recommendationExplanation(recommendation: Recommendation) {
  if (recommendation === "BUY") {
    return "The AI sees a favorable opportunity based on price trends and recent news.";
  }

  if (recommendation === "HOLD") {
    return "The AI does not currently see a strong buying opportunity.";
  }

  return "The AI currently sees more downside risk than upside opportunity.";
}

function beginnerRecommendationExplanation(recommendation?: Recommendation) {
  if (recommendation === "BUY") {
    return recommendationExplanation(recommendation);
  }

  if (recommendation === "HOLD") {
    return recommendationExplanation(recommendation);
  }

  if (recommendation === "AVOID") {
    return recommendationExplanation(recommendation);
  }

  return "The AI recommendation is unavailable right now.";
}

function beginnerDecisionReason(analysis: AnalysisData) {
  const marketTone = analysis.transformer_prediction?.recommendation;
  const sentimentTone = analysis.sentiment_analysis?.sentiment;

  if (marketTone === "BUY" && sentimentTone === "positive") {
    return "Recent price behavior and financial news are both supportive, which makes the stock look more attractive.";
  }

  if (marketTone === "HOLD") {
    return "The stock's recent price behavior is neutral, and news sentiment is not strong enough to justify buying aggressively.";
  }

  if (marketTone === "AVOID" || sentimentTone === "negative") {
    return "Recent signals look cautious, so the AI prefers waiting instead of taking unnecessary risk.";
  }

  if (sentimentTone === "positive") {
    return "Recent financial news is mildly positive, but the price signal is not strong enough for a more aggressive view.";
  }

  return shortDecisionReason(analysis.explanation);
}

function getTrendDirection(changePercent: number): { label: string; tone: "positive" | "negative" | "neutral" } {
  if (changePercent > 2) {
    return { label: "Uptrend â†—", tone: "positive" };
  }

  if (changePercent < -2) {
    return { label: "Downtrend â†˜", tone: "negative" };
  }

  return { label: "Sideways â†’", tone: "neutral" };
}

function shortDecisionReason(explanation?: string) {
  if (!explanation) {
    return "AI explanation unavailable.";
  }

  const firstSentence = explanation.split(".")[0]?.trim();
  if (!firstSentence) {
    return "Signals are mixed.";
  }

  return firstSentence;
}

function getMarketInfo(symbol: string, profileCurrency?: string | null, overrideCurrency?: CurrencyCode) {
  const cleanSymbol = symbol.trim().toUpperCase();
  const isIndia = cleanSymbol.endsWith(".NS");
  const isUae = cleanSymbol.endsWith(".AE") || cleanSymbol.endsWith(".AD");
  const currency = overrideCurrency ?? detectDefaultCurrency(cleanSymbol, profileCurrency);
  const symbolsByCurrency: Record<CurrencyCode, string> = {
    AED: "Ø¯.Ø¥",
    EUR: "â‚¬",
    GBP: "Â£",
    INR: "â‚¹",
    USD: "$",
  };

  return {
    currency,
    isIndia,
    isUae,
    label: isIndia ? "NSE / India" : isUae ? "UAE Market" : "Global Market",
    locale: isIndia ? "en-IN" : "en-US",
    profileCurrency,
    symbol: symbolsByCurrency[currency] ?? currency,
  };
}

function detectNativeStockCurrency(symbol: string, profileCurrency?: string | null): CurrencyCode {
  const cleanSymbol = symbol.trim().toUpperCase();
  const knownCurrency = normalizeCurrency(profileCurrency);

  if (cleanSymbol.endsWith(".NS")) {
    return "INR";
  }

  if (cleanSymbol.endsWith(".AE") || cleanSymbol.endsWith(".AD")) {
    return "AED";
  }

  if (cleanSymbol.endsWith(".L")) {
    return knownCurrency ?? "GBP";
  }

  if (usesEuropeCurrency(cleanSymbol)) {
    return knownCurrency === "GBP" ? "GBP" : "EUR";
  }

  return "USD";
}

function convertCurrency(value: number, fromCurrency: CurrencyCode, toCurrency: CurrencyCode) {
  if (fromCurrency === toCurrency) {
    return value;
  }

  const fromRate = currencyUsdRates[fromCurrency];
  const toRate = currencyUsdRates[toCurrency];

  if (!fromRate || !toRate) {
    return null;
  }

  const valueInUsd = value / fromRate;
  return valueInUsd * toRate;
}

function detectDefaultCurrency(symbol: string, profileCurrency?: string | null): CurrencyCode {
  const cleanSymbol = symbol.trim().toUpperCase();
  const knownCurrency = normalizeCurrency(profileCurrency);

  if (cleanSymbol.endsWith(".NS")) {
    return "INR";
  }

  if (cleanSymbol.endsWith(".AE") || cleanSymbol.endsWith(".AD")) {
    return "AED";
  }

  if (knownCurrency) {
    return knownCurrency;
  }

  if (cleanSymbol.endsWith(".L")) {
    return "GBP";
  }

  if (usesEuropeCurrency(cleanSymbol)) {
    return "EUR";
  }

  return "USD";
}

function usesEuropeCurrency(symbol: string) {
  return [
    ".PA",
    ".AS",
    ".BR",
    ".DE",
    ".F",
    ".MI",
    ".MC",
    ".SW",
    ".ST",
    ".CO",
    ".HE",
    ".OL",
    ".IR",
    ".LS",
    ".VI",
    ".WA",
  ].some((suffix) => symbol.endsWith(suffix));
}

function normalizeCurrency(value?: string | null): CurrencyCode | null {
  const currency = (value ?? "").trim().toUpperCase();
  if (currency === "AED" || currency === "EUR" || currency === "GBP" || currency === "INR" || currency === "USD") {
    return currency;
  }

  return null;
}

function getRiskDisplay(riskLevel?: string) {
  const normalizedRisk = (riskLevel ?? "").toLowerCase();

  if (normalizedRisk.includes("low")) {
    return { label: "Low Risk", tone: "low" };
  }

  if (normalizedRisk.includes("high")) {
    return { label: "High Risk", tone: "high" };
  }

  return { label: "Medium Risk", tone: "medium" };
}

function getBacktestVerdict(backtest: BacktestData): Verdict {
  const difference = backtest.strategy_return_percent - backtest.buy_hold_return_percent;

  if (difference > 10) {
    return {
      label: "Strong historical performance",
      shortLabel: "Strong",
      tone: "positive",
      description: "The AI strategy beat simple buy-and-hold by more than 10 percentage points.",
      rating: "4/5",
    };
  }

  if (difference < -10) {
    return {
      label: "Weak historical performance",
      shortLabel: "Weak",
      tone: "negative",
      description: "The AI strategy trailed simple buy-and-hold by more than 10 percentage points.",
      rating: "2/5",
    };
  }

  return {
    label: "Mixed historical performance",
    shortLabel: "Mixed",
    tone: "neutral",
    description: "The AI strategy stayed within 10 percentage points of simple buy-and-hold.",
    rating: "3/5",
  };
}

function formatMarketCurrency(value: number, symbol: string) {
  const market = getMarketInfo(symbol);

  return value.toLocaleString(market.locale, {
    currency: market.currency,
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency",
  });
}

function getOutperformanceSentence(backtest: BacktestData) {
  const difference = backtest.strategy_return_percent - backtest.buy_hold_return_percent;

  if (difference > 0) {
    if (backtest.strategy_return_percent < 0) {
      return "The AI still lost money, but reduced losses compared with simply holding.";
    }
    return "The AI strategy historically performed better than simply holding.";
  }

  if (difference < 0) {
    return "The AI strategy underperformed simple holding.";
  }

  return "The AI strategy historically matched simple holding.";
}

function formatSignedMoney(value: number, symbol: string) {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${formatMarketCurrency(Math.abs(value), symbol)}`;
}

function compactCurrency(value: number, symbol: string) {
  const market = getMarketInfo(symbol);
  const compact = value.toLocaleString(market.locale, {
    maximumFractionDigits: 1,
    notation: "compact",
  });
  return `${market.currency === "INR" ? "â‚¹" : "$"}${compact}`;
}

function formatMarketCap(value: number | null | undefined, symbol: string) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "Not available";
  }

  const market = getMarketInfo(symbol);
  const absoluteValue = Math.abs(value);
  const units = [
    { suffix: "T", threshold: 1_000_000_000_000 },
    { suffix: "B", threshold: 1_000_000_000 },
    { suffix: "M", threshold: 1_000_000 },
  ];
  const unit = units.find((item) => absoluteValue >= item.threshold);

  if (!unit) {
    return formatMarketCurrency(value, symbol);
  }

  const compactValue = value / unit.threshold;
  const symbolPrefix = market.currency === "INR" ? "â‚¹" : "$";

  return `${symbolPrefix}${compactValue.toFixed(2)}${unit.suffix}`;
}

function shortenSummary(summary: string, maxLength = 520) {
  if (summary.length <= maxLength) {
    return summary;
  }

  return `${summary.slice(0, maxLength - 3).trim()}...`;
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatSourceName(value?: string | null) {
  if (!value) {
    return "Not available";
  }

  return value
    .split("_")
    .map((part) => capitalize(part))
    .join(" ");
}

function formatNumber(value: number) {
  return value.toLocaleString("en-US");
}

function formatPercentScore(value: number) {
  return `${(value * 100).toFixed(0)}%`;
}

function formatPercent(value: number) {
  return `${value.toFixed(2)}%`;
}

function formatSignedPercent(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function formatWholeSignedPercent(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${Math.round(value)}%`;
}

function formatShares(value: number) {
  return value.toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}

function returnTone(value: number) {
  if (value > 0) {
    return "positive";
  }

  if (value < 0) {
    return "negative";
  }

  return "neutral";
}

