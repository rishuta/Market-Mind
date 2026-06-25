# MarketMind Documentation Index

## Welcome

MarketMind is an AI-powered financial advisor designed to help everyday investors make better financial decisions. It helps users understand what is happening in the market, decide what to do with their money, and evaluate whether a stock is worth buying.

MarketMind is not a trading terminal, stock screener, news site, or technical dashboard. It exists to turn market intelligence into calm, practical, decision-first advice.

## Documentation Reading Order

1. [Product Blueprint](product-blueprint.md)

   Start here. The blueprint defines what MarketMind is, what it is not, and the core product principles that guide every major decision. It is the product constitution.

2. [Design Language](02_DESIGN_LANGUAGE.md)

   Read this next to understand how MarketMind should feel. It defines the visual philosophy, emotional goals, language style, accessibility principles, and recommendation tone.

3. [UI Guidelines](03_UI_GUIDELINES.md)

   This document explains how MarketMind screens should be structured. It defines page responsibilities, decision-first layouts, recommendation card behavior, expandable details, preference UI, and mobile expectations.

4. [Feature Filter](04_FEATURE_FILTER.md)

   Use this before building anything new. It explains how to decide whether a feature should be built, simplified, postponed, or rejected.

5. Roadmap

   The current roadmap lives in the Product Blueprint. It keeps near-term work focused on AI Daily Brief, Invest Page redesign, Market Overview, Analyze Stock simplification, Portfolio Intelligence, and UI polish.

## How We Build MarketMind

MarketMind is built by deciding first and implementing second.

Every major feature should pass four reviews:

- Product Review: Does this solve a real user problem?
- UX Review: Does this make decisions easier?
- Architecture Review: Can it be implemented cleanly?
- AI Advisor Review: Does it make MarketMind feel more like a financial advisor?

Implementation should happen only after these reviews. The goal is not to ship more surface area. The goal is to help users make better financial decisions with the smallest clean product and architecture.

## Product Principles

MarketMind puts decisions before data. A user should quickly understand whether to invest, wait, hold cash, review a stock, or avoid an area.

Recommendation comes before evidence. Supporting details matter, but they should build trust after the user understands the main answer.

AI should behave like an advisor. MarketMind should translate complex analysis into clear next steps instead of exposing raw AI internals.

Progressive disclosure keeps the product calm. Start with the recommendation, then explanation, then evidence, then technical detail only when needed.

Simplicity matters more than feature count. A feature belongs only if it improves a decision and reduces uncertainty.

## Design Philosophy

MarketMind should feel calm, trustworthy, minimal, and decision-first.

The design should use whitespace, hierarchy, and concise language to lower cognitive load. The interface should make financial decisions feel organized, not noisy.

Accessibility is part of trust. Recommendations should be understandable through text and structure, not only color, position, or icons.

The visual system should support advice. It should not compete with the recommendation or make the product feel like a technical dashboard.

## UI Philosophy

Each major page has a clear job:

- Home = AI Daily Brief
- Invest = Today's Recommendation
- Market Overview = Market Context
- Analyze Stock = Decision First
- Portfolio = Future advisory direction

Home should orient the user and explain what is happening today. Invest should tell the user how much to invest, how much cash to hold, where to focus, what to avoid, and why today.

Market Overview should explain the environment without duplicating Invest. Analyze Stock should lead with the verdict, what MarketMind would do, entry, target, exit, why, and details. Portfolio should eventually answer whether the user is on track.

## Feature Philosophy

Every feature should improve decisions, reduce uncertainty, avoid feature creep, and reinforce the advisor identity.

A feature should not duplicate another page's job. It should not expose AI internals unless doing so improves trust. It should not add complexity simply because data exists.

If a good human financial advisor would not naturally provide the feature, question whether it belongs.

## Repository Structure

```text
backend/
frontend/
ml/
docs/
README.md
```

`backend/` contains the API services and financial decision logic.

`frontend/` contains the user-facing MarketMind application.

`ml/` contains machine learning scripts, features, and model-related utilities.

`docs/` contains the product, design, UI, and feature decision documentation.

`README.md` provides repository setup and validation guidance.

## Contributing

All contributors, including AI coding assistants, should read the documentation before making changes.

The expected order is:

> Blueprint -> Design -> UI -> Feature Filter -> Code

Product and design decisions should be made before implementation. Code should follow the smallest clean path that preserves MarketMind's advisor identity.

## Final Principle

The best version of MarketMind is not the one with the most features. It is the one that helps users make the best financial decisions with the least friction.
