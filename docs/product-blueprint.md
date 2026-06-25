# MarketMind Product Blueprint

Version: 2.0  
Status: Living document  
Purpose: Product vision and design constitution

## Vision

MarketMind is an AI-powered financial advisor that helps everyday investors decide what to do with their money.

The product does not aim to predict the future. It helps users make better financial decisions using current market conditions, intelligent analysis, and explainable AI.

The goal is simple:

> Know what to do with your money today.

## Mission

MarketMind helps users answer:

- Should I invest today?
- How much should I invest?
- What should I invest in?
- Should I keep some cash?
- Is this stock worth buying?
- Why is MarketMind recommending this?

MarketMind should remove uncertainty rather than overwhelm users with data.

## What MarketMind Is

- An AI financial advisor
- A financial decision engine
- A market interpreter
- A long-term investing companion
- An explainable AI assistant

## What MarketMind Is Not

- A stock screener
- A trading terminal
- A news website
- A technical analysis dashboard
- A portfolio tracker only
- A collection of AI metrics
- A college dashboard project

New features must reinforce what MarketMind is, not what it is not.

## Core Product Principles

### Decision First

Every screen must answer:

> What should I do?

before explaining why.

### Explain Before Impressing

Do not expose AI internals simply because they exist. Users should see recommendations, not algorithms.

Prefer:

- Worth Considering
- Strong Recommendation

Avoid:

- AI Score: 7.4
- Bucket Score: 82

### Progressive Disclosure

Information should be revealed gradually:

1. Recommendation
2. Explanation
3. Supporting evidence
4. Technical details

Users should never be overwhelmed.

### Human Language

MarketMind should sound like an experienced financial advisor.

Prefer:

- I would wait today.
- Holding cash is sensible.
- Gold already provides enough protection.
- Index funds offer better value today.

Avoid:

- Confidence threshold
- Regression output
- Allocation optimizer
- Bucket normalization

### Simplicity Over Complexity

Every new feature must justify its existence. If it does not improve user decisions, it should not be added.

## The Decision Pyramid

Every page should follow the same hierarchy:

1. Recommendation
2. Explanation
3. Supporting evidence
4. Technical details

Never reverse this order.

## The 10-Second Rule

A user should understand what action to take within ten seconds of opening any page. If they cannot, the page needs redesigning.

## Page Responsibilities

### Home

Purpose: provide a daily financial briefing.

The home page should answer:

> What is happening today, and what does it mean for me?

Suggested sections:

- AI Daily Brief
- Market Regime
- Today's Highlights
- MarketMind's Take
- Things to Watch
- Trending Sectors
- Opportunity Radar

### Invest

Purpose: build today's investment plan.

The page should immediately answer:

- How much to invest
- How much cash to keep
- Where to invest
- What to avoid

Everything else is supporting information. This is the flagship feature of MarketMind.

### Market Overview

Purpose: provide deeper market context, not recommendations.

Suggested sections:

- Market Regime
- Sector Rotation
- Macro Events
- Market Sentiment
- Top Opportunities
- Key Risks
- Commodities
- Crypto
- Upcoming Events

### Analyze Stock

Purpose: answer one question:

> Should I buy this stock?

The page should begin with:

- Verdict
- What MarketMind Would Do
- Entry
- Target
- Exit
- Why

Everything else should be collapsible, including company profile, market snapshot, advanced metrics, and historical backtests.

### Portfolio

Future purpose: answer:

> Am I on track?

It should explain portfolio performance and recommended actions, not show every position first.

## AI Personality

MarketMind should feel:

- Calm
- Trustworthy
- Honest
- Practical
- Transparent

MarketMind should never feel:

- Overconfident
- Sensational
- Fear-inducing

It should explain uncertainty when it exists.

## Design Language

Prioritize:

- Clarity
- White space
- Hierarchy
- Actionable insights
- Small amounts of meaningful text

Avoid:

- Information overload
- Metric overload
- Unnecessary charts
- Repeated explanations
- Multiple cards saying the same thing

## Architecture Principles

Before implementing any feature, ask:

- Can this be achieved by extending existing code?
- Can existing logic be reused?
- Can code be deleted instead of added?
- Can this be explained more simply?

Prefer the smallest clean solution.

## The Advisor Test

Every feature must pass this question:

> Would a good human financial advisor naturally do this?

If yes, build it. If not, question whether it belongs.

## The Council

Every significant feature should pass four reviews:

- Product review: Does this solve a real user problem?
- UX review: Does this make decisions easier?
- Architecture review: Can it be implemented cleanly?
- AI review: Does it make MarketMind feel more like a financial advisor?

## Roadmap

Current focus: MarketMind V2

1. AI Daily Brief
2. Invest Page Redesign
3. Market Overview
4. Analyze Stock Simplification
5. Portfolio Intelligence
6. UI Polish and Micro-interactions

No feature should be implemented unless it aligns with this blueprint.

## Final Principle

The best version of MarketMind is not the one with the most features.

It is the one that helps users make the best financial decisions with the least amount of friction.

Every design decision, every line of code, and every AI response should move the product closer to that goal.
