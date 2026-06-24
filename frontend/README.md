# MarketMind AI Frontend

Next.js dashboard for searching stock symbols and visualizing market history.

## Setup

```bash
npm install
```

The required API URL is already set in `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

## Run

Start the FastAPI backend first, then run:

```bash
npm run dev
```

Open `http://localhost:3000` in your browser.

## Validate

```bash
npm run lint
npm run build
```

## Dashboard Features

- Search stock symbols such as `AAPL`, `RELIANCE.NS`, `TCS.NS`, and `INFY.NS`
- Calls `http://127.0.0.1:8000/stock/{symbol}`
- Displays latest close, open, high, low, and volume
- Shows the last 30 trading days in a Recharts line chart
- Handles empty input, loading, and API error states
