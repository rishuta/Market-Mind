export const briefing = {
  wordmark: 'MARKETMIND',
  greeting: 'Good morning.',
  date: 'Tuesday, 8 July',
  masthead: "Today's Brief",
  mood: 'Selective',

  insight: {
    lead: 'If you remember only one thing today',
    headline: 'Patience is likely to outperform aggressive buying.',
    support:
      'Markets remain cautious ahead of tomorrow’s inflation report. Quality businesses continue to offer stronger opportunities than speculative momentum trades.',
  },

  primaryActions: [
    { title: 'Build my investment plan', variant: 'filled' as const },
    { title: 'Explain today’s market', variant: 'text' as const },
  ],

  secondaryActions: [
    {
      title: 'Analyze a stock',
      caption: 'A clear, plain-language read on any company.',
      href: '/analyze',
    },
    {
      title: 'Review my portfolio',
      caption: 'See where you stand and what to consider.',
    },
    {
      title: 'Compare investments',
      caption: 'Weigh two options side by side, without jargon.',
    },
    {
      title: 'Explain today’s market',
      caption: 'The forces behind this morning’s brief, in full.',
    },
  ],

  watchToday: [
    {
      title: 'Inflation report lands tomorrow',
      why: 'The single event most likely to move markets this week.',
      importance: 'High',
    },
    {
      title: 'Tech earnings begin this evening',
      why: 'Early signals on how resilient consumer spending really is.',
      importance: 'Medium',
    },
    {
      title: 'Central bank commentary at noon',
      why: 'Tone matters more than numbers for near-term sentiment.',
      importance: 'Low',
    },
  ],

  snapshot: [
    {
      label: 'Market trend',
      value: 'Steady',
      note: 'Broad indices are holding their ground without conviction.',
    },
    {
      label: 'Risk level',
      value: 'Moderate',
      note: 'Enough uncertainty to reward caution, not enough to retreat.',
    },
    {
      label: 'Volatility',
      value: 'Calm',
      note: 'Price swings remain narrow and orderly across sectors.',
    },
    {
      label: 'Opportunity',
      value: 'Selective',
      note: 'Value is concentrated in quality, not breadth.',
    },
  ],

  perspective:
    'Based on today’s market conditions and your investment profile, maintaining diversification is likely to outperform increasing exposure to high-volatility assets.',

  askPrompts: [
    'I have ₹50,000 to invest.',
    'Should I buy Apple today?',
    'Build my SIP.',
    'Explain today’s market.',
  ],
}

export type Briefing = typeof briefing
