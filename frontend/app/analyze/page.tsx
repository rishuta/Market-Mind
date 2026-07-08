'use client'

import Link from 'next/link'
import type { FormEvent } from 'react'
import { useState } from 'react'

type Prediction = {
  symbol?: string
  recommendation?: string
  confidence?: number | string
  risk_level?: string
  reason?: string
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://127.0.0.1:8000'

function formatConfidence(value: Prediction['confidence']) {
  if (typeof value === 'number') {
    return value <= 1 ? `${Math.round(value * 100)}%` : `${value}%`
  }

  return value || 'Unavailable'
}

export default function AnalyzePage() {
  const [ticker, setTicker] = useState('AAPL')
  const [prediction, setPrediction] = useState<Prediction | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const symbol = ticker.trim().toUpperCase()
    if (!symbol) {
      setError('Enter a ticker symbol to continue.')
      setPrediction(null)
      return
    }

    setTicker(symbol)
    setIsLoading(true)
    setError('')

    try {
      const response = await fetch(
        `${API_BASE_URL}/predict/${encodeURIComponent(symbol)}`,
        {
          headers: {
            Accept: 'application/json',
          },
        },
      )

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

      const data = (await response.json()) as Prediction
      setPrediction(data)
    } catch (err) {
      setPrediction(null)
      setError(
        err instanceof Error
          ? err.message
          : 'MarketMind could not complete the analysis.',
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen">
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[520px]"
          style={{
            background:
              'radial-gradient(115% 85% at 50% -12%, color-mix(in oklch, var(--gold) 38%, transparent) 0%, color-mix(in oklch, var(--primary) 18%, transparent) 45%, transparent 72%)',
            opacity: 0.22,
          }}
        />

        <div className="relative mx-auto max-w-3xl px-6 pt-16 pb-14 md:pt-24 md:pb-20">
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

          <div className="mt-14 md:mt-20">
            <p className="font-serif text-2xl italic text-muted-foreground md:text-3xl">
              A clear read.
            </p>
            <div className="mt-3 flex items-center gap-3">
              <h1 className="text-sm font-medium uppercase tracking-[0.2em] text-foreground">
                Analyze a stock
              </h1>
              <span className="inline-flex items-center gap-2 rounded-full border border-gold-soft bg-gold-soft/25 px-3 py-1 text-xs font-medium text-gold-ink">
                <span className="h-1.5 w-1.5 rounded-full bg-gold" />
                No charts yet
              </span>
            </div>
          </div>

          <div className="mt-10 md:mt-12">
            <p className="text-sm text-muted-foreground">
              If you want one measured opinion
            </p>
            <p className="mt-4 text-pretty font-serif text-4xl leading-[1.12] text-foreground md:text-6xl md:leading-[1.08]">
              Start with the ticker. Let the model do the first pass.
            </p>
            <p className="mt-6 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">
              MarketMind will return a recommendation, confidence, risk level,
              and the reasoning behind the signal.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="mt-10 flex flex-col gap-4 border-y border-border py-6 sm:flex-row sm:items-end"
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

          {error && (
            <div className="mt-8 border-l-2 border-gold pl-5">
              <p className="text-sm font-medium text-foreground">
                Analysis unavailable
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {error}
              </p>
            </div>
          )}

          {prediction && (
            <section className="mt-10">
              <div className="flex items-baseline justify-between gap-6 border-b border-border pb-5">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                    Symbol
                  </p>
                  <h2 className="mt-2 font-serif text-4xl text-foreground">
                    {prediction.symbol || ticker}
                  </h2>
                </div>
                <p className="text-right font-serif text-3xl text-primary">
                  {prediction.recommendation || 'Unavailable'}
                </p>
              </div>

              <dl className="grid grid-cols-1 gap-x-12 gap-y-8 border-b border-border py-8 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <dt className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    Confidence
                  </dt>
                  <dd className="font-serif text-3xl text-foreground">
                    {formatConfidence(prediction.confidence)}
                  </dd>
                </div>
                <div className="flex flex-col gap-1.5">
                  <dt className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    Risk level
                  </dt>
                  <dd className="font-serif text-3xl text-foreground">
                    {prediction.risk_level || 'Unavailable'}
                  </dd>
                </div>
              </dl>

              <article className="py-8">
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  Reason
                </p>
                <p className="mt-4 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">
                  {prediction.reason || 'No reason was returned.'}
                </p>
              </article>
            </section>
          )}
        </div>
      </section>
    </main>
  )
}
