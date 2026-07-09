'use client'

import Link from 'next/link'
import type { FormEvent } from 'react'
import { useMemo, useState } from 'react'

type RiskProfile = 'safe' | 'balanced' | 'aggressive'
type Horizon = 'short' | 'medium' | 'long'

type RecommendedInvestment = {
  symbol?: string
  name: string
  type?: string
  amount?: number
  amount_label?: string
  marketmind_score: number
  match_label: string
  reason?: string
  why: string
  action?: string
  analyze_href?: string
}

type InvestmentBucket = {
  id: string
  name: string
  amount: number
  amount_label?: string
  percentage: number
  role: string
  summary: string
  asset_classes: string[]
  recommended_investments: RecommendedInvestment[]
  why_this_bucket: string[]
}

type PlanItem = {
  asset_class: string
  label: string
  amount: number
  amount_label?: string
  percentage: number
  reason: string
  examples?: string[]
  risk_note?: string
  recommended_investments?: RecommendedInvestment[]
}

type PlanResponse = {
  summary?: string
  plan?: PlanItem[]
  investment_buckets?: InvestmentBucket[]
  advisor_buckets?: InvestmentBucket[]
  constraints_applied?: string[]
  tradeoffs?: string[]
  refinement_message?: string
  disclaimer?: string
  diagnostics?: Record<string, unknown>
}

type PlanFormState = {
  amount: string
  goal: string
  riskProfile: RiskProfile
  horizonText: string
  notes: string
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'

const goalOptions = [
  'Build Long-Term Wealth',
  'Retirement',
  'Passive Income',
  'Buy a House',
  'Emergency Fund',
  'Child Education',
  'General Investing',
  'Preserve Capital',
]

const initialForm: PlanFormState = {
  amount: '50000',
  goal: 'Build Long-Term Wealth',
  riskProfile: 'balanced',
  horizonText: '7 years',
  notes: '',
}

const strategyLabels: Record<RiskProfile, string> = {
  safe: 'Capital Preservation',
  balanced: 'Balanced Growth',
  aggressive: 'Growth Seeking',
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value)

const normalizeHorizon = (value: string): Horizon => {
  const text = value.toLowerCase()
  if (text.includes('retirement') || text.includes('long')) return 'long'

  const monthMatch = text.match(/(\d+(?:\.\d+)?)\s*(month|months|mo)/)
  if (monthMatch) return Number(monthMatch[1]) <= 18 ? 'short' : 'medium'

  const yearMatch = text.match(/(\d+(?:\.\d+)?)\s*(year|years|yr|yrs|y)/)
  if (yearMatch) {
    const years = Number(yearMatch[1])
    if (years <= 1) return 'short'
    if (years <= 5) return 'medium'
    return 'long'
  }

  if (text.includes('short')) return 'short'
  if (text.includes('medium')) return 'medium'
  return 'long'
}

const parseErrorMessage = async (response: Response) => {
  try {
    const data = await response.json()
    if (typeof data?.detail === 'string') return data.detail
    if (Array.isArray(data?.detail) && data.detail[0]?.msg) return data.detail[0].msg
  } catch {
    // Fall through to the generic response message.
  }
  return `Plan request failed with status ${response.status}.`
}

const purposeFor = (item: PlanItem) => {
  const kind = `${item.asset_class} ${item.label}`.toLowerCase()
  if (kind.includes('cash')) return 'Opportunity Reserve'
  if (kind.includes('gold')) return 'Portfolio Protection'
  if (kind.includes('crypto')) return 'High-Risk Sleeve'
  if (kind.includes('stock')) return 'Selective Growth'
  if (kind.includes('etf')) return 'Diversified Exposure'
  if (kind.match(/fund|sip|index/)) return 'Core Recommendation'
  return 'Portfolio Balance'
}

const bucketAccentFor = (bucket: InvestmentBucket) => {
  const key = `${bucket.id} ${bucket.name}`.toLowerCase()
  if (key.includes('reserve') || key.includes('cash')) return 'border-slate-300 bg-slate-50/40'
  if (key.includes('stability') || key.includes('anchor') || key.includes('hedge')) {
    return 'border-gold-soft bg-gold-soft/15'
  }
  if (key.includes('upside')) return 'border-purple-200 bg-purple-50/30'
  if (key.includes('growth')) return 'border-emerald-200 bg-emerald-50/30'
  return 'border-border bg-card'
}

const advisorSummaryFor = (form: PlanFormState, items: PlanItem[]) => {
  const primary = [...items].sort((a, b) => b.percentage - a.percentage)[0]
  const hasCash = items.some((item) => item.asset_class.toLowerCase().includes('cash'))
  const hasGold = items.some((item) => item.asset_class.toLowerCase().includes('gold'))
  if (!primary) return 'A calm, diversified strategy based on your inputs.'

  const support = hasCash
    ? 'while keeping flexibility for future opportunities'
    : hasGold
      ? 'with a defensive allocation for diversification'
      : 'with allocations matched to your risk profile'

  return `A ${strategyLabels[form.riskProfile].toLowerCase()} strategy led by ${primary.label.toLowerCase()}, ${support}.`
}

const recommendationFallbacksFor = (item: PlanItem): RecommendedInvestment[] =>
  (item.examples || []).slice(0, 3).map((example) => ({
    name: example,
    marketmind_score: Math.round(Math.max(60, Math.min(89, item.percentage + 55))),
    match_label: item.percentage >= 25 ? 'Strong Match' : 'Good Match',
    why: purposeFor(item),
  }))

const bucketsFromPlanItems = (items: PlanItem[]): InvestmentBucket[] =>
  items.map((item) => ({
    id: item.label.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
    name: purposeFor(item),
    amount: item.amount,
    amount_label: item.amount_label,
    percentage: item.percentage,
    role: purposeFor(item),
    summary: item.reason,
    asset_classes: [item.asset_class],
    recommended_investments: item.recommended_investments?.length
      ? item.recommended_investments
      : recommendationFallbacksFor(item),
    why_this_bucket: [item.reason, item.risk_note || 'Sized according to your risk profile.'].filter(Boolean),
  }))

export default function PlanPage() {
  const [form, setForm] = useState<PlanFormState>(initialForm)
  const [refinement, setRefinement] = useState('')
  const [plan, setPlan] = useState<PlanResponse | null>(null)
  const [activeBucketId, setActiveBucketId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const planItems = plan?.plan || []
  const investmentBuckets =
    plan?.investment_buckets?.length || plan?.advisor_buckets?.length
      ? plan?.investment_buckets || plan?.advisor_buckets || []
      : bucketsFromPlanItems(planItems)
  const selectedBucket =
    investmentBuckets.find((bucket) => bucket.id === activeBucketId) || investmentBuckets[0]

  const totalPlanned = useMemo(
    () => investmentBuckets.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    [investmentBuckets],
  )

  const whyThisPlan = useMemo(() => {
    const bullets: string[] = []
    const hasCash = planItems.some((item) => item.asset_class.toLowerCase().includes('cash'))
    const hasGold = planItems.some((item) => item.asset_class.toLowerCase().includes('gold'))
    const hasCrypto = planItems.some((item) => item.asset_class.toLowerCase().includes('crypto'))
    const hasFunds = planItems.some((item) =>
      `${item.asset_class} ${item.label}`.toLowerCase().match(/fund|index|sip|etf/),
    )

    if (hasFunds) bullets.push('Diversified funds form the core.')
    if (hasCash) bullets.push('Cash keeps flexibility available.')
    if (hasGold) bullets.push('Gold adds a defensive sleeve.')
    if (hasCrypto) bullets.push('Crypto is capped by risk rules.')
    if (bullets.length < 4) bullets.push('The plan follows your risk profile.')
    return bullets.slice(0, 4)
  }, [planItems])

  const updateField = <K extends keyof PlanFormState>(key: K, value: PlanFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const requestPlan = async (event?: FormEvent, nextRefinement = '') => {
    event?.preventDefault()
    const amount = Number(form.amount)

    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter a valid amount greater than zero.')
      setPlan(null)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${API_URL}/invest-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          currency: 'INR',
          goal: form.goal,
          riskProfile: form.riskProfile,
          horizon: normalizeHorizon(form.horizonText),
          notes: form.notes.trim() || undefined,
          refinement: nextRefinement.trim() || undefined,
        }),
      })

      if (!response.ok) throw new Error(await parseErrorMessage(response))

      const data = (await response.json()) as PlanResponse
      const buckets = data.investment_buckets?.length
        ? data.investment_buckets
        : data.advisor_buckets || []
      setPlan(data)
      setActiveBucketId(buckets[0]?.id || null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reach MarketMind right now.')
    } finally {
      setLoading(false)
    }
  }

  const refinePlan = (event: FormEvent) => {
    requestPlan(event, refinement)
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[520px]"
          style={{
            background:
              'radial-gradient(115% 85% at 50% -12%, color-mix(in oklch, var(--gold) 38%, transparent) 0%, color-mix(in oklch, var(--primary) 18%, transparent) 45%, transparent 72%)',
            opacity: 0.2,
          }}
        />

        <div className="relative mx-auto max-w-3xl px-6 pt-12 pb-16 md:pt-16 md:pb-24">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="text-xs font-medium tracking-[0.32em] text-muted-foreground transition-colors hover:text-primary"
            >
              MARKETMIND
            </Link>
            <span className="text-xs tracking-wide text-muted-foreground">Build My Plan</span>
          </div>

          <div className="mt-14">
            <p className="font-serif text-2xl italic text-muted-foreground md:text-3xl">
              Today&apos;s Plan
            </p>
            <h1 className="mt-4 text-pretty font-serif text-4xl leading-[1.12] text-foreground md:text-6xl md:leading-[1.08]">
              I have money to invest. What should I do today?
            </h1>
          </div>

          <form
            onSubmit={(event) => requestPlan(event)}
            className="mt-10 border-y border-border py-8"
          >
            <div className="grid gap-5 md:grid-cols-2">
              <label className="block">
                <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  Amount
                </span>
                <input
                  value={form.amount}
                  onChange={(event) => updateField('amount', event.target.value)}
                  inputMode="decimal"
                  className="mt-2 w-full border border-border bg-card px-4 py-3 text-base text-foreground outline-none transition-colors focus:border-primary"
                />
              </label>

              <label className="block">
                <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  Goal
                </span>
                <select
                  value={form.goal}
                  onChange={(event) => updateField('goal', event.target.value)}
                  className="mt-2 w-full border border-border bg-card px-4 py-3 text-base text-foreground outline-none transition-colors focus:border-primary"
                >
                  {goalOptions.map((goal) => (
                    <option key={goal} value={goal}>
                      {goal}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  Risk profile
                </span>
                <select
                  value={form.riskProfile}
                  onChange={(event) => updateField('riskProfile', event.target.value as RiskProfile)}
                  className="mt-2 w-full border border-border bg-card px-4 py-3 text-base text-foreground outline-none transition-colors focus:border-primary"
                >
                  <option value="safe">Conservative</option>
                  <option value="balanced">Balanced</option>
                  <option value="aggressive">Aggressive</option>
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  Time horizon
                </span>
                <input
                  value={form.horizonText}
                  onChange={(event) => updateField('horizonText', event.target.value)}
                  placeholder="18 months, 3 years, until retirement"
                  className="mt-2 w-full border border-border bg-card px-4 py-3 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary"
                />
              </label>
            </div>

            <label className="mt-5 block">
              <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                Anything important?
              </span>
              <textarea
                value={form.notes}
                onChange={(event) => updateField('notes', event.target.value)}
                rows={3}
                placeholder="I don't want crypto. Keep Rs 20,000 as emergency cash. Only invest in ETFs."
                className="mt-2 w-full resize-none border border-border bg-card px-4 py-3 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary"
              />
            </label>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-transform duration-200 hover:-translate-y-0.5 hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Thinking...' : 'Ask MarketMind'}
              </button>
              <p className="text-sm text-muted-foreground">
                Educational analysis, not financial advice.
              </p>
            </div>
          </form>

          {error ? (
            <div className="mt-8 border border-destructive/30 bg-destructive/5 px-5 py-4 text-sm text-foreground">
              <p className="font-medium">Plan unavailable</p>
              <p className="mt-1 text-muted-foreground">{error}</p>
            </div>
          ) : null}

          {!plan && !error ? (
            <div className="mt-10 border-l-2 border-gold pl-5 text-sm leading-relaxed text-muted-foreground">
              MarketMind will choose the market mix. You only need to share the money, goal, risk,
              and time horizon.
            </div>
          ) : null}

          {plan ? (
            <section className="mt-12">
              <div className="border border-border bg-card px-5 py-6 md:px-7 md:py-8">
                <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
                  Today&apos;s Plan
                </p>
                <p className="mt-4 font-serif text-5xl leading-none text-foreground md:text-6xl">
                  {formatCurrency(totalPlanned)}
                </p>
                <div className="mt-7 grid gap-5 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      Goal
                    </p>
                    <p className="mt-1 text-base text-foreground">{form.goal}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      Strategy
                    </p>
                    <p className="mt-1 text-base text-foreground">
                      {strategyLabels[form.riskProfile]}
                    </p>
                  </div>
                </div>
                <div className="mt-7 border-t border-border pt-5">
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                    MarketMind Summary
                  </p>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    {advisorSummaryFor(form, planItems)}
                  </p>
                </div>
              </div>

              <div className="mt-10">
                <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
                  Your Buckets
                </p>
                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  {investmentBuckets.map((bucket) => {
                    const selected = selectedBucket?.id === bucket.id

                    return (
                      <button
                        key={bucket.id}
                        type="button"
                        onClick={() => setActiveBucketId(bucket.id)}
                        className={`border px-5 py-5 text-left transition-colors hover:border-primary/50 ${bucketAccentFor(bucket)} ${
                          selected ? 'border-primary bg-primary/5 shadow-sm' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-medium text-foreground">{bucket.name}</p>
                          <span className="text-sm text-muted-foreground">
                            {selected ? 'Selected' : '>'}
                          </span>
                        </div>
                        <p className="mt-4 font-serif text-4xl leading-none text-foreground">
                          {Math.round(bucket.percentage)}%
                        </p>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {bucket.amount_label || formatCurrency(bucket.amount)}
                        </p>
                        <p className="mt-5 text-sm font-medium text-foreground">{bucket.role}</p>
                      </button>
                    )
                  })}
                </div>

                {selectedBucket ? (
                  <div className="mt-6 border border-border bg-card px-5 py-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h2 className="font-serif text-3xl text-foreground">{selectedBucket.name}</h2>
                        <p className="mt-2 text-sm text-muted-foreground">{selectedBucket.role}</p>
                      </div>
                      <div className="sm:text-right">
                        <p className="font-serif text-2xl text-foreground">
                          {selectedBucket.amount_label || formatCurrency(selectedBucket.amount)}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {Math.round(selectedBucket.percentage)}%
                        </p>
                      </div>
                    </div>

                    <div className="mt-6 space-y-6">
                      <section>
                        <h3 className="text-sm font-medium text-foreground">Contains</h3>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                          {selectedBucket.asset_classes.join(' / ')}
                        </p>
                      </section>

                      <section>
                        <h3 className="text-sm font-medium text-foreground">Recommended today</h3>
                        <div className="mt-3 space-y-3">
                          {selectedBucket.recommended_investments.slice(0, 4).map((investment) => {
                            const href = investment.action || investment.analyze_href

                            return (
                              <article
                                key={`${selectedBucket.id}-${investment.name}`}
                                className="border border-border px-4 py-4"
                              >
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                  <div>
                                    <h4 className="text-base font-medium text-foreground">
                                      {investment.name}
                                    </h4>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                      {investment.type || 'Investment'} / {investment.match_label} /{' '}
                                      {Math.round(investment.marketmind_score)}/100
                                    </p>
                                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                                      {investment.reason || investment.why}
                                    </p>
                                  </div>
                                  {href ? (
                                    <Link
                                      href={href}
                                      className="inline-flex shrink-0 rounded-full border border-border px-4 py-2 text-xs font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
                                    >
                                      Analyze
                                    </Link>
                                  ) : null}
                                </div>
                              </article>
                            )
                          })}
                        </div>
                      </section>

                      <section>
                        <h3 className="text-sm font-medium text-foreground">Why this bucket?</h3>
                        <ul className="mt-2 space-y-2 text-sm leading-relaxed text-muted-foreground">
                          {selectedBucket.why_this_bucket.slice(0, 3).map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </section>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="mt-10 border-y border-border py-8">
                <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
                  Why this plan?
                </p>
                <ul className="mt-4 grid gap-3 text-sm leading-relaxed text-muted-foreground sm:grid-cols-2">
                  {whyThisPlan.map((item) => (
                    <li key={item} className="border-l-2 border-gold pl-3">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {plan.constraints_applied?.length || plan.tradeoffs?.length ? (
                <div className="mt-8 grid gap-6 md:grid-cols-2">
                  {plan.constraints_applied?.length ? (
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
                        Changes Applied
                      </p>
                      <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                        {plan.constraints_applied.slice(0, 4).map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {plan.tradeoffs?.length ? (
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
                        Tradeoffs
                      </p>
                      <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                        {plan.tradeoffs.slice(0, 4).map((item) => (
                          <li key={item}>- {item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <form onSubmit={refinePlan} className="mt-10 border-t border-border pt-8">
                <label className="block">
                  <span className="font-serif text-2xl text-foreground">Ask your advisor</span>
                  <textarea
                    value={refinement}
                    onChange={(event) => setRefinement(event.target.value)}
                    rows={3}
                    placeholder="Remove crypto. Only invest through SIPs. Keep Rs 20,000 in cash."
                    className="mt-4 w-full resize-none border border-border bg-card px-4 py-3 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary"
                  />
                </label>
                <button
                  type="submit"
                  disabled={loading || !refinement.trim()}
                  className="mt-4 inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-transform duration-200 hover:-translate-y-0.5 hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? 'Updating...' : 'Update advice'}
                </button>
              </form>

              <p className="mt-8 text-xs leading-relaxed text-muted-foreground">
                {plan.disclaimer || 'This is educational analysis, not financial advice.'}
              </p>
            </section>
          ) : null}
        </div>
      </section>
    </main>
  )
}
