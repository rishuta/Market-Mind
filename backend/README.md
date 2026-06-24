# MarketMind AI Backend

FastAPI backend for fetching stock market data through Yahoo Finance.

## Setup

Open a terminal in the `backend` folder:

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

Optional: create a `.env` file to configure allowed frontend origins.

```env
FRONTEND_ORIGINS=http://localhost:3000
```

## Run

```bash
uvicorn main:app --reload
```

The API runs at `http://localhost:8000`.

## Endpoints

```text
GET /
```

Returns:

```json
{
  "message": "MarketMind AI backend running"
}
```

```text
GET /stock/{symbol}
```

Examples:

```text
http://localhost:8000/stock/AAPL
http://localhost:8000/stock/RELIANCE.NS
```

The stock endpoint returns the latest OHLCV values and the last 30 trading
days from 6 months of historical data. Invalid symbols return:

```json
{
  "error": "No stock data found"
}
```

Interactive docs are available at `http://localhost:8000/docs`.
