'use client'

import Link from 'next/link'
import type { FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import {
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

type HistoryPoint = {
  date?: string
  close?: number | null
  volume?: number | null
}

type TextBlock = {
  headline: string
  explanation?: string | null
}

type SafeValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | TextBlock
  | SafeValue[]

type AnalyzeResponse = {
  symbol: string
  summary: {
    recommendation: string
    confidence: number | null
    confidence_label: string
    risk_level: string
    current_price: number | null
    currency: string
    explanation: string
  }
  prediction: {
    symbol: string
    recommendation: string
    confidence: number | string | null
    risk_level: string
    reason: string
  }
  price: {
    currency: string
    current: number | null
    open: number | null
    high: number | null
    low: number | null
    close: number | null
    volume: number | null
    recent_change_percent: number | null
    trend_percent: number | null
    trend_label: string
    recent_volatility_percent: number | null
    recent_low: number | null
    recent_high: number | null
    recent_support: number | null
    recent_resistance: number | null
  }
  history: HistoryPoint[]
  sentiment: {
    sentiment?: string
    headlines_analyzed?: number
    news_source?: string
    news_available?: boolean
    sentiment_used?: boolean
  } | null
  combined_analysis: Record<string, unknown> | null
  plain_english: {
    title: string
    paragraphs: string[]
  }
  user_guidance: {
    owner: TextBlock
    non_owner: TextBlock
  }
  change_factors: {
    more_bullish: SafeValue[]
    more_bearish: SafeValue[]
  }
  trend_summary: string
  strategy: {
    buying_strategy: {
      best_entry_zone: SafeValue
      breakout_entry: SafeValue
      avoid_buying: SafeValue
    }
    take_profit: {
      target_1: SafeValue
      target_2: SafeValue
      target_3: SafeValue
    }
    risk_control: {
      stop_loss: SafeValue
      invalidation: SafeValue
      reassessment: SafeValue
    }
    risk_reward: {
      potential_upside: SafeValue
      potential_downside: SafeValue
      ratio: SafeValue
    }
    time_horizon: SafeValue
    levels: {
      buy_zone_low: number | null
      buy_zone_high: number | null
      breakout_entry: number | null
      stop_loss: number | null
      invalidation: number | null
      target_1: number | null
      target_2: number | null
      target_3: number | null
      potential_upside_percent: number | null
      potential_downside_percent: number | null
      risk_reward_ratio: number | null
    }
    entry_view: TextBlock
    profit_taking_zone: TextBlock
    risk_control_level: TextBlock
    invalidation_condition: TextBlock
  }
  key_reasons: SafeValue[]
  perspective: string
  disclaimer: string
  advanced_analysis: {
    ai_models: {
      transformer: string
      transformer_confidence: number | null
      finbert_sentiment: string
      combined_recommendation: string
      combined_explanation: string | null
    }
    market_data: {
      current: number | null
      open: number | null
      high: number | null
      low: number | null
      close: number | null
      volume: number | null
      trend: string
      support: number | null
      resistance: number | null
    }
    risk_metrics: {
      volatility: number | null
      risk_level: string
      time_horizon: SafeValue
      risk_control_level: number | null
    }
    data_sources: {
      services_used: SafeValue[]
      missing_data_warnings: SafeValue[]
    }
    backend_metadata: {
      endpoint: string
      services_used: SafeValue[]
      llm_enabled: boolean
      xgboost_enabled: boolean
      timestamp: string
    }
  }
  meta: {
    llm_analysis_enabled: boolean
    llm_role: string
    xgboost_enabled: boolean
    endpoint: string
    generated_at: string
    data_sources: SafeValue[]
    missing_data_warnings: SafeValue[]
  }
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://127.0.0.1:8000'

function formatConfidence(value?: number | string | null) {
  if (typeof value === 'number') {
    return `${value <= 1 ? Math.round(value * 100) : value.toFixed(2)}%`
  }

  return value || 'Unavailable'
}

function formatCurrency(value?: number | null, currency = 'USD') {
  if (typeof value !== 'number') {
    return 'Unavailable'
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatNumber(value?: number | null) {
  if (typeof value !== 'number') {
    return 'Unavailable'
  }

  return new Intl.NumberFormat('en-US').format(value)
}

function formatPercent(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 'Unavailable'
  }

  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`
}

function isTextBlock(value: SafeValue): value is TextBlock {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    ('headline' in value || 'explanation' in value)
  )
}

function toSafeText(value: SafeValue, fallback = 'Unavailable'): TextBlock {
  if (value === null || value === undefined || value === '') {
    return { headline: fallback }
  }

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return { headline: String(value) }
  }

  if (Array.isArray(value)) {
    const parts = value
      .map((item) => toSafeText(item, ''))
      .filter((item) => item.headline || item.explanation)

    return {
      headline: parts.map((item) => item.headline).filter(Boolean).join(', ') || fallback,
      explanation: parts.map((item) => item.explanation).filter(Boolean).join(' '),
    }
  }

  if (isTextBlock(value)) {
    return {
      headline: value.headline || fallback,
      explanation: value.explanation,
    }
  }

  return { headline: fallback }
}

function firstSentence(value: SafeValue, fallback = 'Unavailable') {
  const text = toSafeText(value, fallback).headline
  return text.split(/(?<=[.!?])\s+/)[0] || fallback
}

function shortAction(item: TextBlock) {
  return firstSentence(item.explanation || item.headline)
}

function cleanLevelText(value: SafeValue) {
  return firstSentence(value)
    .replace(/^Consider waiting for a calmer entry near\s+/i, '')
    .replace(/^If you are considering buying, watch for a calmer area near\s+/i, '')
    .replace(/^A breakout may be more credible above\s+/i, 'Above ')
    .replace(/^For HOLD, a move above\s+/i, 'Above ')
    .replace(/, especially if volume improves\.$/i, '')
    .replace(/\sis only a review level, not a buying instruction\.$/i, '')
    .replace(/^Avoid buying if price closes below\s+/i, 'Below ')
    .replace(/\sor if confidence weakens further\.$/i, '')
    .replace(/^First model-assisted target:\s+/i, '')
    .replace(/^Second model-assisted target:\s+/i, '')
    .replace(/^Stretch target:\s+/i, '')
    .replace(/^Potential review level \d:\s+/i, '')
    .replace(/,\sonly if momentum strengthens\.$/i, '')
    .replace(/,\suseful only if momentum improves\.$/i, '')
    .replace(/^Consider reassessing near\s+/i, '')
    .replace(/^The setup weakens below\s+/i, 'Below ')
    .replace(/^Approximate risk\/reward ratio:\s+/i, '')
}

async function fetchJson<T>(url: string) {
  let response: Response

  try {
    response = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
    })
  } catch {
    throw new Error(
      'MarketMind cannot reach the backend. Check that FastAPI is running on http://127.0.0.1:8000.',
    )
  }

  if (!response.ok) {
    let message = `Request failed with status ${response.status}.`

    try {
      const payload = (await response.json()) as {
        detail?: string
        error?: string
      }
      message = payload.detail || payload.error || message
    } catch {
      // Keep the status message when the backend returns a non-JSON error.
    }

    throw new Error(message)
  }

  try {
    return (await response.json()) as T
  } catch {
    throw new Error('MarketMind received an empty or unreadable backend response.')
  }
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
        {eyebrow}
      </p>
      <h2 className="mt-2 font-serif text-2xl leading-tight text-foreground md:text-3xl">
        {title}
      </h2>
    </div>
  )
}

function ActionCard({ title, item }: { title: string; item: TextBlock }) {
  return (
    <div className="border-y border-border py-5">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {title}
      </p>
      <h3 className="mt-2 font-serif text-xl leading-tight text-foreground">
        {item.headline}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {shortAction(item)}
      </p>
    </div>
  )
}

function AdvisorTimeline({
  items,
}: {
  items: Array<{ icon: string; title: string; value: string; note: string }>
}) {
  return (
    <div className="mt-7 border-y border-border py-2">
      {items.map((item, index) => (
        <div key={`${item.title}-${index}`}>
          <div className="grid grid-cols-[3rem_minmax(0,1fr)] gap-4 py-5">
            <div className="font-serif text-3xl leading-none">{item.icon}</div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                {item.title}
              </p>
              <p className="mt-1 font-serif text-3xl leading-tight text-foreground">
                {item.value}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {item.note}
              </p>
            </div>
          </div>
          {index < items.length - 1 && (
            <div className="ml-6 h-7 border-l border-border" />
          )}
        </div>
      ))}
    </div>
  )
}

function ChartLegend() {
  const items = [
    ['bg-primary', 'Blue = Price'],
    ['bg-indigo-700', "Indigo = Today's Price"],
    ['bg-gold', 'Gold = Profit Zone'],
    ['bg-red-600', 'Red = Exit Level'],
    ['bg-emerald-500', 'Green band = Buy area'],
  ]

  return (
    <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2">
      {items.map(([color, label]) => (
        <span key={label} className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <span className={`h-2 w-2 rounded-full ${color}`} />
          {label}
        </span>
      ))}
    </div>
  )
}

function chartLineLabel(value: string, color: string, compact = false) {
  return {
    value,
    position: 'right' as const,
    fill: color,
    fontSize: compact ? 10 : 11,
    fontWeight: 500,
  }
}

function ScenarioCards({
  scenarios,
}: {
  scenarios: Array<{ icon: string; title: string; value: string; note: string }>
}) {
  return (
    <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
      {scenarios.map((scenario) => (
        <div key={scenario.title} className="border-y border-border py-5">
          <p className="font-serif text-3xl leading-none">{scenario.icon}</p>
          <p className="mt-3 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            {scenario.title}
          </p>
          <p className="mt-2 font-serif text-2xl leading-tight text-foreground">
            {scenario.value}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {scenario.note}
          </p>
        </div>
      ))}
    </div>
  )
}

function AdvancedGrid({
  title,
  items,
}: {
  title: string
  items: Array<{ label: string; value: SafeValue }>
}) {
  const visibleItems = items.filter((item) => {
    const value = toSafeText(item.value, '').headline
    return value !== ''
  })

  if (!visibleItems.length) {
    return null
  }

  return (
    <div className="border-t border-border pt-6">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {title}
      </p>
      <dl className="mt-4 grid grid-cols-1 gap-x-10 gap-y-4 sm:grid-cols-2">
        {visibleItems.map((item) => (
          <div key={item.label}>
            <dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
              {item.label}
            </dt>
            <dd className="mt-1 text-sm leading-relaxed text-foreground">
              {toSafeText(item.value).headline}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

export default function AnalyzePage() {
  const [ticker, setTicker] = useState('AAPL')
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [isCompactChart, setIsCompactChart] = useState(false)

  useEffect(() => {
    function updateChartLabels() {
      setIsCompactChart(window.innerWidth < 640)
    }

    updateChartLabels()
    window.addEventListener('resize', updateChartLabels)
    return () => window.removeEventListener('resize', updateChartLabels)
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const symbol = ticker.trim().toUpperCase()
    if (!symbol) {
      setError('Enter a ticker symbol to continue.')
      setAnalysis(null)
      return
    }

    setTicker(symbol)
    setIsLoading(true)
    setError('')

    try {
      const data = await fetchJson<AnalyzeResponse>(
        `${API_BASE_URL}/analyze/${encodeURIComponent(symbol)}`,
      )

      if (!data || !data.summary) {
        throw new Error('MarketMind returned an incomplete analysis response.')
      }

      setAnalysis(data)
    } catch (err) {
      setAnalysis(null)
      setError(
        err instanceof Error
          ? err.message
          : 'MarketMind could not complete the analysis.',
      )
    } finally {
      setIsLoading(false)
    }
  }

  const currency = analysis?.summary.currency || 'USD'
  const levels = analysis?.strategy.levels
  const isHold = analysis?.summary.recommendation === 'HOLD'
  const isAvoid = analysis?.summary.recommendation === 'AVOID'

  const chartData = useMemo(
    () =>
      analysis?.history
        .filter((point) => typeof point.close === 'number')
        .map((point) => ({
          ...point,
          label: point.date?.slice(5) || '',
        })) || [],
    [analysis?.history],
  )

  const chartDomain = useMemo<[number, number]>(() => {
    const chartValues = [
      ...chartData.map((point) => point.close),
      analysis?.price.current,
      levels?.buy_zone_low,
      levels?.buy_zone_high,
      levels?.stop_loss,
      levels?.target_1,
      levels?.target_2,
      levels?.target_3,
    ].filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
    const chartMin = chartValues.length ? Math.min(...chartValues) : 0
    const chartMax = chartValues.length ? Math.max(...chartValues) : 0
    const chartPadding = chartValues.length ? Math.max((chartMax - chartMin) * 0.12, chartMax * 0.01) : 1

    return [Math.max(0, chartMin - chartPadding), chartMax + chartPadding]
  }, [analysis?.price.current, chartData, levels])

  const quickRead = analysis
    ? [
        {
          label: 'Signal',
          value: `${analysis.summary.recommendation}, ${
            analysis.summary.recommendation === 'BUY'
              ? 'but not aggressive.'
              : analysis.summary.recommendation === 'AVOID'
              ? 'stay defensive.'
              : 'watch only.'
          }`,
        },
        {
          label: 'Trend',
          value: `${analysis.price.trend_label}.`,
        },
        {
          label: 'News',
          value: `${analysis.sentiment?.sentiment || 'Unavailable'}.`,
        },
      ]
    : []

  const entryRange =
    levels?.buy_zone_low && levels.buy_zone_high
      ? `${formatCurrency(levels.buy_zone_low, currency)} - ${formatCurrency(levels.buy_zone_high, currency)}`
      : analysis
      ? cleanLevelText(analysis.strategy.buying_strategy.best_entry_zone)
      : 'Unavailable'
  const breakoutLevel =
    levels?.breakout_entry != null
      ? `Above ${formatCurrency(levels.breakout_entry, currency)}`
      : analysis
      ? cleanLevelText(analysis.strategy.buying_strategy.breakout_entry)
      : 'Unavailable'
  const reviewRange =
    levels?.target_1 != null && levels.target_2 != null
      ? `${formatCurrency(levels.target_1, currency)} - ${formatCurrency(levels.target_2, currency)}`
      : analysis
      ? cleanLevelText(analysis.strategy.profit_taking_zone)
      : 'Unavailable'
  const exitLevel =
    levels?.stop_loss != null
      ? `Below ${formatCurrency(levels.stop_loss, currency)}`
      : analysis
      ? cleanLevelText(analysis.strategy.risk_control.stop_loss)
      : 'Unavailable'
  const recoveryLevel =
    levels?.breakout_entry != null
      ? `Above ${formatCurrency(levels.breakout_entry, currency)}`
      : 'When conditions improve'
  const timeHorizon = analysis ? toSafeText(analysis.strategy.time_horizon).headline : 'Unavailable'

  const timelineItems = analysis
    ? isAvoid
      ? [
          {
            icon: '⛔',
            title: 'Stay Out',
            value: 'Wait',
            note: 'Wait until conditions improve.',
          },
          {
            icon: '👀',
            title: 'Reconsider',
            value: recoveryLevel,
            note: 'Only after a clear recovery.',
          },
          {
            icon: '🛑',
            title: 'Exit',
            value: exitLevel,
            note: 'If already invested, review carefully.',
          },
          {
            icon: '⏱',
            title: 'Review Again',
            value: 'Later',
            note: 'When market conditions improve.',
          },
        ]
      : isHold
      ? [
          {
            icon: '👀',
            title: 'Watch',
            value: 'Wait',
            note: 'Wait for a better opportunity.',
          },
          {
            icon: '📈',
            title: 'Consider Buying',
            value: breakoutLevel,
            note: 'Only above confirmation level.',
          },
          {
            icon: '💰',
            title: 'Review Position',
            value: reviewRange,
            note: 'Useful price levels to monitor.',
          },
          {
            icon: '🛑',
            title: 'Exit',
            value: exitLevel,
            note: 'Only if the investment thesis weakens.',
          },
          {
            icon: '⏱',
            title: 'Review Again',
            value: timeHorizon,
            note: 'Check again after the signal develops.',
          },
        ]
      : [
          {
            icon: '🟢',
            title: 'Buy',
            value: entryRange,
            note: 'A better area to begin building a position.',
          },
          {
            icon: '📈',
            title: 'Add More',
            value: breakoutLevel,
            note: 'Only if momentum keeps improving.',
          },
          {
            icon: '💰',
            title: 'Review',
            value: reviewRange,
            note: 'Consider locking in some profits.',
          },
          {
            icon: '🛑',
            title: 'Exit',
            value: exitLevel,
            note: 'The current investment idea weakens.',
          },
          {
            icon: '⏱',
            title: 'Hold',
            value: timeHorizon,
            note: 'Give the setup time to confirm.',
          },
        ]
    : []

  const scenarioCards = analysis
    ? [
        {
          icon: '📈',
          title: 'Best Case',
          value: isAvoid ? recoveryLevel : reviewRange,
          note: 'AI confidence would likely increase.',
        },
        {
          icon: '➡',
          title: 'Most Likely',
          value: analysis.summary.recommendation,
          note: isAvoid
            ? 'Stay defensive until conditions improve.'
            : isHold
            ? 'Keep watching. No major action yet.'
            : 'Continue holding or build gradually.',
        },
        {
          icon: '📉',
          title: 'Worst Case',
          value: exitLevel,
          note: 'MarketMind may downgrade this recommendation.',
        },
      ]
    : []

  return (
    <main className="min-h-screen">
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[420px]"
          style={{
            background:
              'radial-gradient(115% 85% at 50% -12%, color-mix(in oklch, var(--gold) 38%, transparent) 0%, color-mix(in oklch, var(--primary) 18%, transparent) 45%, transparent 72%)',
            opacity: 0.2,
          }}
        />

        <div className="relative mx-auto max-w-3xl px-6 pt-16 pb-14 md:pt-20 md:pb-20">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="text-xs font-medium tracking-[0.32em] text-muted-foreground transition-colors hover:text-primary"
            >
              MARKETMIND
            </Link>
            <span className="text-xs tracking-wide text-muted-foreground">
              Analyze
            </span>
          </div>

          <div className="mt-12">
            <p className="font-serif text-2xl italic text-muted-foreground md:text-3xl">
              A clear read.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <h1 className="text-sm font-medium uppercase tracking-[0.2em] text-foreground">
                Analyze a stock
              </h1>
              <span className="inline-flex items-center gap-2 rounded-full border border-gold-soft bg-gold-soft/25 px-3 py-1 text-xs font-medium text-gold-ink">
                <span className="h-1.5 w-1.5 rounded-full bg-gold" />
                Advisor view
              </span>
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="mt-8 flex flex-col gap-4 border-y border-border py-5 sm:flex-row sm:items-end"
          >
            <label className="flex w-full flex-col gap-2">
              <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                Ticker
              </span>
              <input
                value={ticker}
                onChange={(event) => setTicker(event.target.value)}
                aria-label="Ticker symbol"
                className="w-full bg-transparent font-serif text-4xl uppercase leading-none text-foreground outline-none placeholder:text-muted-foreground md:text-5xl"
                placeholder="AAPL"
              />
            </label>
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex shrink-0 items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-transform duration-200 hover:-translate-y-0.5 hover:bg-primary/90 disabled:translate-y-0 disabled:opacity-55"
            >
              {isLoading ? 'Analyzing...' : 'Analyze'}
            </button>
          </form>

          {isLoading && (
            <div className="mt-6 border-l-2 border-gold pl-5">
              <p className="text-sm font-medium text-foreground">Building analysis</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Combining prediction, price, and sentiment.
              </p>
            </div>
          )}

          {error && (
            <div className="mt-6 border-l-2 border-gold pl-5">
              <p className="text-sm font-medium text-foreground">
                Analysis unavailable
              </p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {error}
              </p>
            </div>
          )}

          {analysis && (
            <div className="mt-10 flex flex-col gap-12">
              <section className="border-y border-border py-6">
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  Should I buy?
                </p>
                <h2 className="mt-3 font-serif text-5xl leading-none text-primary md:text-6xl">
                  {analysis.summary.recommendation}
                </h2>
                <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
                  <span>Confidence: {analysis.summary.confidence_label} · {formatConfidence(analysis.summary.confidence)}</span>
                  <span>Risk: {analysis.summary.risk_level}</span>
                  <span>Current price: {formatCurrency(analysis.summary.current_price, currency)}</span>
                </div>
                <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
                  {firstSentence(analysis.summary.explanation)}
                </p>
              </section>

              <section>
                <SectionHeading eyebrow="Quick Read" title="Why this is the view." />
                <ul className="mt-5 grid grid-cols-1 gap-3 border-y border-border py-5">
                  {quickRead.map((item) => (
                    <li key={item.label} className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-4 text-sm leading-relaxed">
                      <span className="font-medium text-foreground">{item.label}</span>
                      <span className="text-muted-foreground">{item.value}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <SectionHeading eyebrow="What should you do?" title="Two action checks." />
                <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
                  <ActionCard
                    title="If you already own it"
                    item={analysis.user_guidance.owner}
                  />
                  <ActionCard
                    title="If you don't own it"
                    item={analysis.user_guidance.non_owner}
                  />
                </div>
              </section>

              <section>
                <SectionHeading
                  eyebrow="If I were investing today..."
                  title="A calm plan, not a trading screen."
                />
                <AdvisorTimeline items={timelineItems} />
              </section>

              <section>
                <SectionHeading eyebrow="What happens next?" title="Three possible paths." />
                <ScenarioCards scenarios={scenarioCards} />
              </section>

              <section>
                <SectionHeading eyebrow="Chart" title="Price with decision levels." />
                <ChartLegend />
                <div className="mt-5 h-72 border-y border-border py-6">
                  {chartData.length > 1 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={chartData}
                        margin={{
                          left: 0,
                          right: isCompactChart ? 72 : 150,
                          top: 8,
                          bottom: 0,
                        }}
                      >
                        <XAxis
                          dataKey="label"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                          minTickGap={24}
                        />
                        <YAxis hide domain={chartDomain} dataKey="close" />
                        {typeof levels?.buy_zone_low === 'number' &&
                          typeof levels?.buy_zone_high === 'number' && (
                            <ReferenceArea
                              y1={levels.buy_zone_low}
                              y2={levels.buy_zone_high}
                              fill="oklch(0.72 0.11 150)"
                              fillOpacity={0.2}
                              strokeOpacity={0}
                            />
                          )}
                        {typeof analysis.price.current === 'number' && (
                          <ReferenceLine
                            y={analysis.price.current}
                            stroke="var(--primary)"
                            strokeDasharray="5 3"
                            strokeOpacity={0.95}
                            strokeWidth={2}
                            label={chartLineLabel(
                              isCompactChart ? 'Current' : "Today's Price",
                              'var(--primary)',
                              isCompactChart,
                            )}
                          />
                        )}
                        {typeof levels?.stop_loss === 'number' && (
                          <ReferenceLine
                            y={levels.stop_loss}
                            stroke="oklch(0.58 0.14 28)"
                            strokeDasharray="4 4"
                            strokeOpacity={0.72}
                            strokeWidth={1.5}
                            label={chartLineLabel(
                              isCompactChart ? 'Exit' : 'Exit Level',
                              'oklch(0.58 0.14 28)',
                              isCompactChart,
                            )}
                          />
                        )}
                        {typeof levels?.target_1 === 'number' && (
                          <ReferenceLine
                            y={levels.target_1}
                            stroke="var(--gold)"
                            strokeDasharray="3 5"
                            strokeOpacity={0.58}
                            label={chartLineLabel(
                              isCompactChart ? 'T1' : isHold ? 'Review 1' : 'Profit Target 1',
                              'var(--gold)',
                              isCompactChart,
                            )}
                          />
                        )}
                        {typeof levels?.target_2 === 'number' && (
                          <ReferenceLine
                            y={levels.target_2}
                            stroke="var(--gold)"
                            strokeDasharray="3 5"
                            strokeOpacity={0.5}
                            label={chartLineLabel(
                              isCompactChart ? 'T2' : isHold ? 'Review 2' : 'Profit Target 2',
                              'var(--gold)',
                              isCompactChart,
                            )}
                          />
                        )}
                        {typeof levels?.target_3 === 'number' && (
                          <ReferenceLine
                            y={levels.target_3}
                            stroke="var(--gold)"
                            strokeDasharray="3 5"
                            strokeOpacity={0.42}
                            label={chartLineLabel(
                              isCompactChart ? 'T3' : isHold ? 'Review 3' : 'Profit Target 3',
                              'var(--gold)',
                              isCompactChart,
                            )}
                          />
                        )}
                        <Tooltip
                          cursor={{ stroke: 'var(--border)', strokeWidth: 1 }}
                          contentStyle={{
                            background: 'var(--card)',
                            border: '1px solid var(--border)',
                            borderRadius: 8,
                            color: 'var(--foreground)',
                            fontSize: 12,
                          }}
                          formatter={(value) => [
                            formatCurrency(Number(value), currency),
                            'Close',
                          ]}
                          labelFormatter={(label) => `Date ${label}`}
                        />
                        <Line
                          type="monotone"
                          dataKey="close"
                          stroke="var(--primary)"
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4, fill: 'var(--primary)' }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center text-sm leading-relaxed text-muted-foreground">
                      Price history is not available for this ticker yet.
                    </div>
                  )}
                </div>
              </section>

              <section>
                <SectionHeading eyebrow="Key Reasons" title="The short case." />
                <ul className="mt-6 divide-y divide-border border-y border-border">
                  {analysis.key_reasons.slice(0, 4).map((reason, index) => {
                    const text = toSafeText(reason)

                    return (
                      <li key={`${text.headline}-${index}`} className="py-4">
                        <p className="text-sm font-medium leading-relaxed text-foreground">
                          {text.headline}
                        </p>
                        {text.explanation && (
                          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                            {firstSentence(text.explanation)}
                          </p>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </section>

              <section>
                <details className="border-y border-border py-5">
                  <summary className="cursor-pointer list-none text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-primary">
                    Behind the Recommendation
                  </summary>
                  <div className="mt-7 flex flex-col gap-7">
                    <AdvancedGrid
                      title="Model Signals"
                      items={[
                        { label: 'Transformer recommendation', value: analysis.advanced_analysis.ai_models.transformer },
                        { label: 'Transformer confidence', value: formatConfidence(analysis.advanced_analysis.ai_models.transformer_confidence) },
                        { label: 'Combined decision', value: analysis.advanced_analysis.ai_models.combined_recommendation },
                        { label: 'FinBERT/news sentiment', value: analysis.advanced_analysis.ai_models.finbert_sentiment },
                        { label: 'Headlines analyzed', value: formatNumber(analysis.sentiment?.headlines_analyzed) },
                        { label: 'Sentiment source', value: analysis.sentiment?.news_source || 'Unavailable' },
                      ]}
                    />
                    <AdvancedGrid
                      title="Price Parameters"
                      items={[
                        { label: 'Current price', value: formatCurrency(analysis.price.current, currency) },
                        { label: 'Open', value: formatCurrency(analysis.price.open, currency) },
                        { label: 'High', value: formatCurrency(analysis.price.high, currency) },
                        { label: 'Low', value: formatCurrency(analysis.price.low, currency) },
                        { label: 'Close', value: formatCurrency(analysis.price.close, currency) },
                        { label: 'Volume', value: formatNumber(analysis.price.volume) },
                        { label: 'Recent change', value: formatPercent(analysis.price.recent_change_percent) },
                        { label: 'Trend %', value: formatPercent(analysis.price.trend_percent) },
                        { label: 'Support', value: formatCurrency(analysis.price.recent_support, currency) },
                        { label: 'Resistance', value: formatCurrency(analysis.price.recent_resistance, currency) },
                      ]}
                    />
                    <AdvancedGrid
                      title="Strategy Parameters"
                      items={[
                        { label: 'Entry low', value: formatCurrency(levels?.buy_zone_low, currency) },
                        { label: 'Entry high', value: formatCurrency(levels?.buy_zone_high, currency) },
                        { label: 'Breakout level', value: formatCurrency(levels?.breakout_entry, currency) },
                        { label: 'Target 1', value: formatCurrency(levels?.target_1, currency) },
                        { label: 'Target 2', value: formatCurrency(levels?.target_2, currency) },
                        { label: 'Target 3', value: formatCurrency(levels?.target_3, currency) },
                        { label: 'Stop-loss / risk-control', value: formatCurrency(levels?.stop_loss, currency) },
                        { label: 'Invalidation level', value: formatCurrency(levels?.invalidation, currency) },
                        { label: 'Risk/reward ratio', value: levels?.risk_reward_ratio != null ? `${levels.risk_reward_ratio} : 1` : 'Unavailable' },
                        { label: 'Time horizon', value: analysis.strategy.time_horizon },
                      ]}
                    />
                    <AdvancedGrid
                      title="Risk Parameters"
                      items={[
                        { label: 'Risk level', value: analysis.summary.risk_level },
                        { label: 'Volatility proxy', value: analysis.price.recent_volatility_percent != null ? `${analysis.price.recent_volatility_percent.toFixed(2)}%` : 'Unavailable' },
                        { label: 'Confidence band', value: analysis.summary.confidence_label },
                        { label: 'Missing data warnings', value: analysis.meta.missing_data_warnings.length ? analysis.meta.missing_data_warnings : 'None' },
                        { label: 'Data sources used', value: analysis.meta.data_sources },
                      ]}
                    />
                    <AdvancedGrid
                      title="Backend Metadata"
                      items={[
                        { label: 'Endpoint used', value: analysis.meta.endpoint },
                        { label: 'Services used', value: analysis.advanced_analysis.backend_metadata.services_used },
                        { label: 'LLM enabled', value: String(analysis.meta.llm_analysis_enabled) },
                        { label: 'XGBoost enabled', value: String(analysis.meta.xgboost_enabled) },
                        { label: 'Timestamp', value: analysis.meta.generated_at },
                      ]}
                    />
                  </div>
                </details>
              </section>

              <section className="border-y border-border py-6">
                <SectionHeading eyebrow="MarketMind Perspective" title="Next check." />
                <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
                  {firstSentence(analysis.perspective)}
                </p>
                <p className="mt-5 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  {analysis.disclaimer}
                </p>
              </section>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
