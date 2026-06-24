import logging
import os
import re
import time
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError, as_completed
from pathlib import Path
from typing import Any

import pandas as pd
import yfinance as yf
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Load backend/.env before importing AI services. This ensures provider API
# keys are available to modules that read os.getenv during import or inference.
BASE_DIR = Path(__file__).resolve().parent
ENV_PATH = BASE_DIR / ".env"
load_dotenv(dotenv_path=ENV_PATH, override=True)

from analysis_service import AnalysisServiceError, analyze_stock
from backtest_service import BacktestServiceError, run_backtest
from prediction_service import (
    InsufficientHistoricalDataError,
    InvalidSymbolError,
    ModelFileMissingError,
    PredictionServiceError,
    predict_stock_symbol,
)
from sentiment_service import SentimentServiceError, get_stock_sentiment
from news_service import get_debug_env_info

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("marketmind-api")

TTL_PRICE_PREDICTION_SECONDS = 10 * 60
TTL_FAST_SCAN_SECONDS = 20 * 60
TTL_SENTIMENT_SECONDS = 45 * 60
TTL_BACKTEST_SECONDS = 24 * 60 * 60
FAST_SCAN_TIMEOUT_SECONDS = 14
DEEP_ANALYSIS_TIMEOUT_SECONDS = 22
FAST_SHORTLIST_SIZE = 45
DEEP_SHORTLIST_SIZE = 14

INDIA_INVEST_UNIVERSE = [
    ("RELIANCE.NS", "Reliance Industries"), ("TCS.NS", "Tata Consultancy Services"), ("INFY.NS", "Infosys"),
    ("HDFCBANK.NS", "HDFC Bank"), ("ICICIBANK.NS", "ICICI Bank"), ("SBIN.NS", "State Bank of India"),
    ("ITC.NS", "ITC"), ("BHARTIARTL.NS", "Bharti Airtel"), ("LT.NS", "Larsen & Toubro"),
    ("AXISBANK.NS", "Axis Bank"), ("KOTAKBANK.NS", "Kotak Mahindra Bank"), ("HCLTECH.NS", "HCL Technologies"),
    ("WIPRO.NS", "Wipro"), ("TECHM.NS", "Tech Mahindra"), ("SUNPHARMA.NS", "Sun Pharma"),
    ("CIPLA.NS", "Cipla"), ("DRREDDY.NS", "Dr. Reddy's Laboratories"), ("MARUTI.NS", "Maruti Suzuki"),
    ("TATAMOTORS.NS", "Tata Motors"), ("M&M.NS", "Mahindra & Mahindra"), ("BAJFINANCE.NS", "Bajaj Finance"),
    ("BAJAJFINSV.NS", "Bajaj Finserv"), ("HINDUNILVR.NS", "Hindustan Unilever"), ("NESTLEIND.NS", "Nestle India"),
    ("ASIANPAINT.NS", "Asian Paints"), ("ULTRACEMCO.NS", "UltraTech Cement"), ("TITAN.NS", "Titan"),
    ("ADANIENT.NS", "Adani Enterprises"), ("ADANIPORTS.NS", "Adani Ports"), ("POWERGRID.NS", "Power Grid"),
    ("NTPC.NS", "NTPC"), ("ONGC.NS", "ONGC"), ("COALINDIA.NS", "Coal India"),
    ("JSWSTEEL.NS", "JSW Steel"), ("TATASTEEL.NS", "Tata Steel"), ("HINDALCO.NS", "Hindalco"),
    ("GRASIM.NS", "Grasim"), ("DIVISLAB.NS", "Divi's Laboratories"), ("BRITANNIA.NS", "Britannia"),
    ("EICHERMOT.NS", "Eicher Motors"), ("HEROMOTOCO.NS", "Hero MotoCorp"), ("APOLLOHOSP.NS", "Apollo Hospitals"),
    ("TATACONSUM.NS", "Tata Consumer"), ("INDUSINDBK.NS", "IndusInd Bank"), ("SBILIFE.NS", "SBI Life"),
    ("HDFCLIFE.NS", "HDFC Life"), ("DMART.NS", "Avenue Supermarts"), ("PIDILITIND.NS", "Pidilite"),
    ("NAUKRI.NS", "Info Edge"), ("IRCTC.NS", "IRCTC"), ("ZOMATO.NS", "Zomato"),
]
US_INVEST_UNIVERSE = [
    ("AAPL", "Apple"), ("MSFT", "Microsoft"), ("NVDA", "Nvidia"), ("GOOGL", "Alphabet"),
    ("AMZN", "Amazon"), ("META", "Meta Platforms"), ("TSLA", "Tesla"), ("AVGO", "Broadcom"),
    ("JPM", "JPMorgan Chase"), ("V", "Visa"), ("MA", "Mastercard"), ("UNH", "UnitedHealth"),
    ("LLY", "Eli Lilly"), ("JNJ", "Johnson & Johnson"), ("PG", "Procter & Gamble"), ("HD", "Home Depot"),
    ("COST", "Costco"), ("WMT", "Walmart"), ("XOM", "Exxon Mobil"), ("CVX", "Chevron"),
    ("KO", "Coca-Cola"), ("PEP", "PepsiCo"), ("MCD", "McDonald's"), ("ADBE", "Adobe"),
    ("CRM", "Salesforce"), ("ORCL", "Oracle"), ("AMD", "AMD"), ("INTC", "Intel"),
    ("NFLX", "Netflix"), ("DIS", "Walt Disney"), ("BAC", "Bank of America"), ("WFC", "Wells Fargo"),
    ("GS", "Goldman Sachs"), ("MS", "Morgan Stanley"), ("CSCO", "Cisco"), ("QCOM", "Qualcomm"),
    ("TXN", "Texas Instruments"), ("AMAT", "Applied Materials"), ("CAT", "Caterpillar"), ("GE", "GE Aerospace"),
    ("BA", "Boeing"), ("HON", "Honeywell"), ("UPS", "UPS"), ("RTX", "RTX"),
    ("NKE", "Nike"), ("SBUX", "Starbucks"), ("TMO", "Thermo Fisher"), ("ABT", "Abbott Laboratories"),
    ("MRK", "Merck"), ("PFE", "Pfizer"), ("NOW", "ServiceNow"), ("SHOP", "Shopify"),
]
ETF_INVEST_UNIVERSE = [
    ("SPY", "SPDR S&P 500 ETF", "US"), ("VOO", "Vanguard S&P 500 ETF", "US"),
    ("QQQ", "Invesco QQQ ETF", "US"), ("VTI", "Vanguard Total Stock Market ETF", "US"),
    ("IWM", "iShares Russell 2000 ETF", "US"), ("DIA", "SPDR Dow Jones ETF", "US"),
    ("GLD", "SPDR Gold Shares", "US"), ("SLV", "iShares Silver Trust", "US"),
    ("NIFTYBEES.NS", "Nippon India Nifty 50 ETF", "India"), ("JUNIORBEES.NS", "Nippon India Nifty Next 50 ETF", "India"),
    ("GOLDBEES.NS", "Nippon India Gold ETF", "India"),
]
CRYPTO_INVEST_UNIVERSE = [
    ("BTC-USD", "Bitcoin"), ("ETH-USD", "Ethereum"), ("SOL-USD", "Solana"),
]
CRYPTO_PRICE_FALLBACKS = {
    "BTC-USD": [("BTC-USD", "Bitcoin"), ("BTCUSD", "Bitcoin"), ("BITO", "ProShares Bitcoin Strategy ETF")],
    "ETH-USD": [("ETH-USD", "Ethereum"), ("ETHUSD", "Ethereum")],
    "SOL-USD": [("SOL-USD", "Solana"), ("SOLUSD", "Solana")],
}
GOLD_PRICE_FALLBACKS = {
    "INR": [("GOLDBEES.NS", "Nippon India Gold ETF"), ("GLD", "SPDR Gold Shares"), ("IAU", "iShares Gold Trust"), ("GC=F", "Gold Futures")],
    "GLOBAL": [("GLD", "SPDR Gold Shares"), ("IAU", "iShares Gold Trust"), ("GC=F", "Gold Futures")],
}

SECTOR_BY_SYMBOL = {
    "RELIANCE.NS": "Energy", "ONGC.NS": "Energy", "COALINDIA.NS": "Energy", "XOM": "Energy", "CVX": "Energy",
    "TCS.NS": "Technology", "INFY.NS": "Technology", "HCLTECH.NS": "Technology", "WIPRO.NS": "Technology",
    "TECHM.NS": "Technology", "NAUKRI.NS": "Technology", "AAPL": "Technology", "MSFT": "Technology",
    "NVDA": "Technology", "GOOGL": "Communication Services", "META": "Communication Services", "ADBE": "Technology",
    "CRM": "Technology", "ORCL": "Technology", "AMD": "Technology", "INTC": "Technology", "CSCO": "Technology",
    "QCOM": "Technology", "TXN": "Technology", "AMAT": "Technology", "NOW": "Technology", "SHOP": "Technology",
    "HDFCBANK.NS": "Financials", "ICICIBANK.NS": "Financials", "SBIN.NS": "Financials", "AXISBANK.NS": "Financials",
    "KOTAKBANK.NS": "Financials", "BAJFINANCE.NS": "Financials", "BAJAJFINSV.NS": "Financials",
    "SBILIFE.NS": "Financials", "HDFCLIFE.NS": "Financials", "JPM": "Financials", "V": "Financials",
    "MA": "Financials", "BAC": "Financials", "WFC": "Financials", "GS": "Financials", "MS": "Financials",
    "SUNPHARMA.NS": "Healthcare", "CIPLA.NS": "Healthcare", "DRREDDY.NS": "Healthcare", "APOLLOHOSP.NS": "Healthcare",
    "UNH": "Healthcare", "LLY": "Healthcare", "JNJ": "Healthcare", "TMO": "Healthcare", "ABT": "Healthcare",
    "MRK": "Healthcare", "PFE": "Healthcare",
    "ITC.NS": "Consumer Staples", "HINDUNILVR.NS": "Consumer Staples", "NESTLEIND.NS": "Consumer Staples",
    "TATACONSUM.NS": "Consumer Staples", "BRITANNIA.NS": "Consumer Staples", "PG": "Consumer Staples",
    "COST": "Consumer Staples", "WMT": "Consumer Staples", "KO": "Consumer Staples", "PEP": "Consumer Staples",
    "MARUTI.NS": "Consumer Discretionary", "TATAMOTORS.NS": "Consumer Discretionary", "M&M.NS": "Consumer Discretionary",
    "EICHERMOT.NS": "Consumer Discretionary", "HEROMOTOCO.NS": "Consumer Discretionary", "TITAN.NS": "Consumer Discretionary",
    "DMART.NS": "Consumer Discretionary", "IRCTC.NS": "Consumer Discretionary", "ZOMATO.NS": "Consumer Discretionary",
    "AMZN": "Consumer Discretionary", "TSLA": "Consumer Discretionary", "HD": "Consumer Discretionary",
    "MCD": "Consumer Discretionary", "NKE": "Consumer Discretionary", "SBUX": "Consumer Discretionary",
    "LT.NS": "Industrials", "ADANIPORTS.NS": "Industrials", "POWERGRID.NS": "Utilities", "NTPC.NS": "Utilities",
    "CAT": "Industrials", "GE": "Industrials", "BA": "Industrials", "HON": "Industrials", "UPS": "Industrials",
    "RTX": "Industrials",
    "JSWSTEEL.NS": "Materials", "TATASTEEL.NS": "Materials", "HINDALCO.NS": "Materials", "GRASIM.NS": "Materials",
    "DIVISLAB.NS": "Healthcare", "ASIANPAINT.NS": "Materials", "ULTRACEMCO.NS": "Materials", "PIDILITIND.NS": "Materials",
    "ADANIENT.NS": "Diversified",
    "NFLX": "Communication Services", "DIS": "Communication Services", "AVGO": "Technology",
}


def _build_invest_plan_universe() -> list[dict[str, str]]:
    stocks = [
        *[
            {"assetType": "stock", "market": "India", "name": name, "symbol": symbol}
            for symbol, name in INDIA_INVEST_UNIVERSE
        ],
        *[
            {"assetType": "stock", "market": "US", "name": name, "symbol": symbol}
            for symbol, name in US_INVEST_UNIVERSE
        ],
    ]
    etfs = [
        {"assetType": "etf", "market": market, "name": name, "symbol": symbol}
        for symbol, name, market in ETF_INVEST_UNIVERSE
    ]
    crypto = [
        {"assetType": "crypto", "market": "Crypto", "name": name, "symbol": symbol}
        for symbol, name in CRYPTO_INVEST_UNIVERSE
    ]
    return [*stocks, *etfs, *crypto]


INVEST_PLAN_UNIVERSE = _build_invest_plan_universe()
_INVEST_PLAN_CACHE: dict[str, tuple[float, Any]] = {}
_PLAN_EXECUTOR = ThreadPoolExecutor(max_workers=8)


class InvestPlanRequest(BaseModel):
    amount: float = Field(gt=0)
    currency: str = Field(pattern="^(INR|USD|EUR|GBP|AED)$")
    riskProfile: str | None = None
    risk: str | None = None
    horizon: str
    allocationOverrides: dict[str, Any] | None = None

app = FastAPI(
    title="MarketMind AI Backend",
    description="Stock market data API for the MarketMind AI application.",
    version="1.0.0",
)

# Allow the local Next.js frontend to call this API during development.
frontend_origins = os.getenv("FRONTEND_ORIGINS", "http://localhost:3000")
allowed_origins = [origin.strip() for origin in frontend_origins.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _to_float(value: Any) -> float | None:
    """Convert pandas/numpy values into JSON-safe floats."""
    if pd.isna(value):
        return None
    return round(float(value), 2)


def _to_int(value: Any) -> int | None:
    """Convert pandas/numpy values into JSON-safe integers."""
    if pd.isna(value):
        return None
    return int(value)


def _cache_get(key: str, ttl_seconds: int) -> Any | None:
    cached = _INVEST_PLAN_CACHE.get(key)
    if not cached:
        return None
    created_at, value = cached
    if time.monotonic() - created_at > ttl_seconds:
        _INVEST_PLAN_CACHE.pop(key, None)
        return None
    return value


def _cache_set(key: str, value: Any) -> Any:
    _INVEST_PLAN_CACHE[key] = (time.monotonic(), value)
    return value


def _market_currency(currency: str) -> dict[str, str]:
    return {
        "currency": currency,
        "locale": "en-IN" if currency == "INR" else "en-US",
    }


def _format_plan_currency(value: float, currency: str) -> str:
    symbols = {"AED": "AED", "EUR": "€", "GBP": "£", "INR": "₹", "USD": "$"}
    rounded = round(value)
    if currency == "INR":
        return f"{symbols[currency]}{rounded:,.0f}"
    return f"{symbols.get(currency, currency)}{rounded:,.0f}"


def _round_plan_amount(amount: float, currency: str) -> float:
    if currency == "INR":
        increment = 100 if amount < 1000 else 500
    elif currency == "AED":
        increment = 50
    else:
        increment = 10
    return round(amount / increment) * increment


def _get_stock_data_cached(symbol: str) -> dict[str, Any]:
    key = f"stock:{symbol.upper()}"
    cached = _cache_get(key, TTL_PRICE_PREDICTION_SECONDS)
    if cached is not None:
        return cached
    return _cache_set(key, get_stock_data(symbol))


def _get_prediction_cached(symbol: str) -> dict[str, Any]:
    key = f"predict:{symbol.upper()}"
    cached = _cache_get(key, TTL_PRICE_PREDICTION_SECONDS)
    if cached is not None:
        return cached
    return _cache_set(key, predict_stock_symbol(symbol))


def _get_sentiment_cached(symbol: str) -> dict[str, Any] | None:
    key = f"sentiment:{symbol.upper()}"
    cached = _cache_get(key, TTL_SENTIMENT_SECONDS)
    if cached is not None:
        return cached
    analysis = _cache_get(f"analysis:{symbol.upper()}", TTL_SENTIMENT_SECONDS)
    if isinstance(analysis, dict):
        sentiment = analysis.get("sentiment_analysis")
        if sentiment is not None:
            return _cache_set(key, sentiment)
    return None


def _get_sentiment_deep_cached(symbol: str) -> dict[str, Any]:
    key = f"sentiment:{symbol.upper()}"
    cached = _cache_get(key, TTL_SENTIMENT_SECONDS)
    if cached is not None:
        return cached
    return _cache_set(key, get_stock_sentiment(symbol))


def _get_analysis_cached(symbol: str) -> dict[str, Any]:
    key = f"analysis:{symbol.upper()}"
    cached = _cache_get(key, TTL_SENTIMENT_SECONDS)
    if cached is not None:
        return cached
    analysis = analyze_stock(symbol)
    if analysis.get("sentiment_analysis") is not None:
        _cache_set(f"sentiment:{symbol.upper()}", analysis["sentiment_analysis"])
    return _cache_set(key, analysis)


def _get_backtest_cached(symbol: str) -> dict[str, Any]:
    key = f"backtest:{symbol.upper()}"
    cached = _cache_get(key, TTL_BACKTEST_SECONDS)
    if cached is not None:
        return cached
    return _cache_set(key, run_backtest(symbol))


def _recent_momentum(stock_data: dict[str, Any] | None) -> float:
    history = (stock_data or {}).get("history") or []
    if len(history) < 2:
        return 0
    first_close = float(history[0].get("close") or 0)
    latest = float((stock_data or {}).get("latest_close") or 0)
    if first_close <= 0 or latest <= 0:
        return 0
    return ((latest - first_close) / first_close) * 100


def _recent_volatility(stock_data: dict[str, Any] | None) -> float:
    history = (stock_data or {}).get("history") or []
    if len(history) < 6:
        return 4
    returns = []
    for previous, current in zip(history, history[1:]):
        previous_close = float(previous.get("close") or 0)
        current_close = float(current.get("close") or 0)
        if previous_close > 0:
            returns.append(abs((current_close - previous_close) / previous_close) * 100)
    if not returns:
        return 4
    return sum(returns) / len(returns)


def _risk_level_from_volatility(volatility: float) -> str:
    if volatility >= 3.2:
        return "High Risk"
    if volatility <= 1.6:
        return "Low Risk"
    return "Medium Risk"


def _sentiment_score(sentiment: dict[str, Any] | None) -> float:
    if not sentiment:
        return 50
    return max(
        0,
        min(
            100,
            50
            + float(sentiment.get("positive_score", 0)) * 48
            - float(sentiment.get("negative_score", 0)) * 45,
        ),
    )


def _recommendation_score(recommendation: str, confidence: float) -> float:
    normalized_confidence = confidence * 100 if confidence <= 1 else confidence
    if recommendation == "BUY":
        return min(100, 72 + normalized_confidence * 0.22)
    if recommendation == "HOLD":
        return min(100, 48 + normalized_confidence * 0.08)
    return 18


def _risk_reward_score(ratio: float | None) -> float:
    if not ratio:
        return 42
    if ratio < 1:
        return 35
    if ratio < 1.5:
        return 55 + (ratio - 1) * 30
    if ratio <= 2.5:
        return 70 + (ratio - 1.5) * 18
    return 92


def _build_exit_metrics(analysis: dict[str, Any], stock_data: dict[str, Any] | None) -> dict[str, Any]:
    price = float((stock_data or {}).get("latest_close") or 0)
    recommendation = analysis.get("final_recommendation", "HOLD")
    risk_level = str(analysis.get("risk_level") or "Medium Risk")
    target_multiplier = 1 if recommendation == "AVOID" else 1.15 if recommendation == "BUY" else 1.08
    stop_loss_multiplier = 0.85 if "high" in risk_level.lower() else 0.92 if "low" in risk_level.lower() else 0.88
    if price <= 0:
        return {"downsideRate": 0, "riskRewardRatio": None, "upsideRate": 0}
    target = price * target_multiplier
    stop_loss = price * stop_loss_multiplier
    reward = target - price
    risk = price - stop_loss
    ratio = reward / risk if risk > 0 else None
    return {
        "downsideRate": abs((stop_loss - price) / price),
        "riskRewardRatio": ratio,
        "upsideRate": max(0, (target - price) / price),
    }


def _series_last(series: pd.Series, default: float = 0) -> float:
    clean = series.dropna()
    if clean.empty:
        return default
    return float(clean.iloc[-1])


def _rsi(close: pd.Series, period: int = 14) -> float:
    delta = close.diff()
    gain = delta.clip(lower=0).rolling(period).mean()
    loss = (-delta.clip(upper=0)).rolling(period).mean()
    relative_strength = gain / loss.replace(0, pd.NA)
    rsi = 100 - (100 / (1 + relative_strength))
    return _series_last(rsi, 50)


def _download_fast_universe(symbols: list[str]) -> pd.DataFrame:
    return yf.download(
        tickers=symbols,
        period="6mo",
        interval="1d",
        auto_adjust=False,
        group_by="ticker",
        progress=False,
        threads=True,
        timeout=FAST_SCAN_TIMEOUT_SECONDS,
    )


def _download_price_history(symbol: str) -> pd.DataFrame:
    cache_key = f"price-history:{symbol.upper()}"
    cached = _cache_get(cache_key, TTL_FAST_SCAN_SECONDS)
    if cached is not None:
        return cached
    history = yf.download(
        tickers=symbol,
        period="6mo",
        interval="1d",
        auto_adjust=False,
        group_by="ticker",
        progress=False,
        threads=False,
        timeout=FAST_SCAN_TIMEOUT_SECONDS,
    )
    return _cache_set(cache_key, history)


def _frame_for_symbol(download: pd.DataFrame, symbol: str, symbol_count: int) -> pd.DataFrame:
    if download.empty:
        return pd.DataFrame()
    if isinstance(download.columns, pd.MultiIndex):
        if symbol in download.columns.get_level_values(0):
            return download[symbol]
        if symbol in download.columns.get_level_values(-1):
            return download.xs(symbol, axis=1, level=-1)
        if symbol_count == 1:
            first_level = download.columns.get_level_values(0)[0]
            return download[first_level]
    if symbol_count == 1:
        return download
    return pd.DataFrame()


def _price_metrics_from_history(history: pd.DataFrame) -> dict[str, Any] | None:
    if not history.empty and isinstance(history.columns, pd.MultiIndex):
        first_level = history.columns.get_level_values(0)[0]
        history = history[first_level]
    if history.empty or "Close" not in history:
        return None
    clean = history.dropna(subset=["Close"])
    if len(clean) < 30:
        return None
    close = clean["Close"].astype(float)
    latest = _series_last(close)
    if latest <= 0:
        return None
    recent_close = float(close.iloc[-22]) if len(close) >= 22 else float(close.iloc[0])
    first_close = float(close.iloc[0])
    peak = float(close.max())
    daily_returns = close.pct_change().dropna()
    volatility = float(daily_returns.tail(30).std() * 100) if not daily_returns.empty else 4
    momentum = ((latest - recent_close) / recent_close) * 100 if recent_close else 0
    trend = ((latest - first_close) / first_close) * 100 if first_close else 0
    drawdown = ((latest - peak) / peak) * 100 if peak else 0
    stock_data = {
        "history": [
            {
                "close": _to_float(row["Close"]),
                "date": index.strftime("%Y-%m-%d") if hasattr(index, "strftime") else str(index),
                "volume": _to_int(row["Volume"]) if "Volume" in row else 0,
            }
            for index, row in clean.tail(30).iterrows()
        ],
        "high": _to_float(clean["High"].iloc[-1]) if "High" in clean else _to_float(latest),
        "latest_close": _to_float(latest),
        "low": _to_float(clean["Low"].iloc[-1]) if "Low" in clean else _to_float(latest),
        "open": _to_float(clean["Open"].iloc[-1]) if "Open" in clean else _to_float(latest),
        "volume": _to_int(clean["Volume"].iloc[-1]) if "Volume" in clean else 0,
    }
    return {
        "current_price": round(latest, 2),
        "drawdown": round(drawdown, 2),
        "momentum": round(momentum, 2),
        "stock": stock_data,
        "trend": round(trend, 2),
        "volatility": round(volatility, 2),
    }


def _price_lookup(candidates: list[tuple[str, str]]) -> dict[str, Any]:
    for index, (symbol, name) in enumerate(candidates):
        try:
            metrics = _price_metrics_from_history(_download_price_history(symbol))
        except Exception:
            logger.exception("Price fallback failed for %s", symbol)
            metrics = None
        if metrics is None:
            continue
        metrics["available"] = True
        metrics["name"] = name
        metrics["proxy_used"] = symbol
        metrics["priceSource"] = {
            "fallbackUsed": index > 0,
            "provider": "Yahoo Finance",
            "symbol": symbol,
        }
        return metrics
    return {
        "available": False,
        "reason": "Live market data source did not return a valid price.",
        "priceSource": {"fallbackUsed": False, "provider": "Yahoo Finance", "symbol": None},
    }


def _gold_proxy_type(symbol: str) -> str:
    upper_symbol = symbol.upper()
    if upper_symbol == "GC=F":
        return "Gold Futures"
    if upper_symbol in {"GOLDBEES.NS", "GLD", "IAU"}:
        return "Gold ETF"
    return "Gold Proxy"


def get_crypto_price(symbol: str) -> dict[str, Any]:
    result = _price_lookup(CRYPTO_PRICE_FALLBACKS.get(symbol, [(symbol, symbol)]))
    if not result.get("available"):
        result["reason"] = "No valid live crypto price was returned by available symbols."
    return result


def get_gold_price(currency: str) -> dict[str, Any]:
    candidates = GOLD_PRICE_FALLBACKS["INR"] if currency == "INR" else GOLD_PRICE_FALLBACKS["GLOBAL"]
    result = _price_lookup(candidates)
    if result.get("available"):
        result["proxyType"] = _gold_proxy_type(str(result.get("proxy_used", "")))
    else:
        result["reason"] = "No valid live gold proxy price was returned by available symbols."
        result["proxyType"] = "Gold Proxy"
    return result


def _fast_scan_from_history(stock: dict[str, str], history: pd.DataFrame) -> dict[str, Any] | None:
    if history.empty or "Close" not in history:
        return None
    clean = history.dropna(subset=["Close"])
    if len(clean) < 30:
        return None
    close = clean["Close"].astype(float)
    volume = clean["Volume"].fillna(0).astype(float) if "Volume" in clean else pd.Series([0] * len(clean), index=clean.index)
    latest = _series_last(close)
    ma10 = _series_last(close.rolling(10).mean(), latest)
    ma30 = _series_last(close.rolling(30).mean(), latest)
    recent_return = ((latest - float(close.iloc[-22])) / float(close.iloc[-22])) * 100 if len(close) >= 22 and close.iloc[-22] else 0
    medium_return = ((latest - float(close.iloc[0])) / float(close.iloc[0])) * 100 if close.iloc[0] else 0
    price_vs_ma30 = ((latest - ma30) / ma30) * 100 if ma30 else 0
    ma_trend = ((ma10 - ma30) / ma30) * 100 if ma30 else 0
    rsi = _rsi(close)
    daily_returns = close.pct_change().dropna()
    volatility = float(daily_returns.tail(30).std() * 100) if not daily_returns.empty else 4
    volume_short = _series_last(volume.tail(10).rolling(10).mean(), 0)
    volume_long = _series_last(volume.tail(30).rolling(30).mean(), volume_short)
    volume_trend = ((volume_short - volume_long) / volume_long) * 100 if volume_long else 0
    rsi_score = 12 if 45 <= rsi <= 65 else 6 if 35 <= rsi < 45 or 65 < rsi <= 72 else -10
    score = 50
    score += max(-18, min(22, recent_return * 1.2))
    score += max(-12, min(16, price_vs_ma30 * 1.1))
    score += max(-10, min(12, ma_trend * 1.4))
    score += max(-7, min(8, volume_trend * 0.08))
    score += rsi_score
    score -= max(0, volatility - 2.2) * 5
    score += max(-8, min(10, medium_return * 0.25))
    score = max(0, min(100, score))
    recommendation = "BUY" if score >= 68 else "HOLD" if score >= 45 else "AVOID"
    confidence = max(50, min(92, 50 + abs(score - 50) * 1.15))
    risk_reward = 1.35 + max(0, score - 60) / 45
    downside_rate = min(0.18, 0.07 + volatility / 100)
    upside_rate = max(0, risk_reward * downside_rate)
    recent_history = clean.tail(30)
    stock_data = {
        "history": [
            {
                "close": _to_float(row["Close"]),
                "date": index.strftime("%Y-%m-%d") if hasattr(index, "strftime") else str(index),
                "volume": _to_int(row["Volume"]) if "Volume" in row else 0,
            }
            for index, row in recent_history.iterrows()
        ],
        "high": _to_float(clean["High"].iloc[-1]) if "High" in clean else _to_float(latest),
        "latest_close": _to_float(latest),
        "low": _to_float(clean["Low"].iloc[-1]) if "Low" in clean else _to_float(latest),
        "open": _to_float(clean["Open"].iloc[-1]) if "Open" in clean else _to_float(latest),
        "symbol": stock["symbol"],
        "volume": _to_int(volume.iloc[-1]) if len(volume) else 0,
    }
    return {
        "analysis": {
            "confidence": round(confidence, 2),
            "final_recommendation": recommendation,
            "risk_level": _risk_level_from_volatility(volatility),
            "sentiment_analysis": _get_sentiment_cached(stock["symbol"]),
            "suggested_allocation": "Fast scan",
            "symbol": stock["symbol"],
            "transformer_prediction": None,
            "explanation": "Fast technical scan result used for shortlisting.",
        },
        "assetType": stock.get("assetType", "stock"),
        "backtest": None,
        "components": [
            {"label": "Recent return", "note": f"{recent_return:.2f}% 1-month return", "value": round(max(0, min(100, 50 + recent_return * 2)))},
            {"label": "Moving averages", "note": f"{price_vs_ma30:.2f}% vs 30-day average", "value": round(max(0, min(100, 50 + price_vs_ma30 * 2)))},
            {"label": "RSI", "note": f"RSI {rsi:.0f}", "value": round(max(0, min(100, 100 - abs(rsi - 55) * 2)))},
            {"label": "Volume trend", "note": f"{volume_trend:.1f}% volume trend", "value": round(max(0, min(100, 50 + volume_trend * 0.2)))},
            {"label": "Volatility fit", "note": f"{volatility:.1f}% recent volatility", "value": round(max(0, min(100, 100 - volatility * 8)))},
            {"label": "Long-term trend", "note": f"{medium_return:.2f}% 6-month trend", "value": round(max(0, min(100, 50 + medium_return * 0.8)))},
        ],
        "confidence": round(confidence, 2),
        "expectedHold": "3-9 months",
        "market": stock["market"],
        "name": stock["name"],
        "potentialLossRate": downside_rate,
        "potentialProfitRate": upside_rate,
        "profile": None,
        "riskRewardLabel": f"1 : {risk_reward:.2f}",
        "riskRewardRatio": risk_reward,
        "score": round(score),
        "scoreBand": _opportunity_band(score),
        "stock": stock_data,
        "symbol": stock["symbol"],
        "why": ["Strong fast technical setup.", f"{recent_return:.2f}% recent return", f"RSI {rsi:.0f}"],
    }


def _fallback_price_scan_item(asset: dict[str, str], price_info: dict[str, Any]) -> dict[str, Any] | None:
    if not price_info.get("available"):
        return None
    trend = float(price_info.get("trend") or 0)
    momentum = float(price_info.get("momentum") or 0)
    volatility = float(price_info.get("volatility") or 4)
    drawdown = float(price_info.get("drawdown") or 0)
    volatility_fit = max(0, min(100, 100 - volatility * 8))
    trend_score = max(0, min(100, 50 + trend * 0.8))
    momentum_score = max(0, min(100, 50 + momentum * 2))
    drawdown_score = max(0, min(100, 100 + drawdown * 1.5))
    if asset.get("assetType") == "crypto":
        score = max(0, min(100, trend_score * 0.32 + momentum_score * 0.3 + volatility_fit * 0.22 + drawdown_score * 0.16))
        risk_level = "High"
        risk_reward = 1.0 + max(0, score - 50) / 40
        downside_rate = min(0.35, 0.12 + volatility / 70 + abs(min(0, drawdown)) / 250)
    else:
        score = max(0, min(100, trend_score * 0.34 + volatility_fit * 0.28 + drawdown_score * 0.18 + 60 * 0.2))
        risk_level = _risk_level_from_volatility(volatility)
        risk_reward = 1.15 + max(0, score - 50) / 55
        downside_rate = min(0.2, 0.06 + volatility / 100)
    recommendation = "BUY" if score >= 68 else "HOLD" if score >= 45 else "AVOID"
    stock_data = {**price_info["stock"], "symbol": asset["symbol"]}
    return {
        "analysis": {
            "confidence": round(max(50, min(90, 50 + abs(score - 50) * 1.1)), 2),
            "final_recommendation": recommendation,
            "risk_level": risk_level,
            "sentiment_analysis": None,
            "suggested_allocation": "Price fallback scan",
            "symbol": asset["symbol"],
            "transformer_prediction": None,
            "explanation": f"Fallback price scan used {price_info['proxy_used']}.",
        },
        "assetType": asset.get("assetType"),
        "backtest": None,
        "components": [
            {"label": "Recent return", "note": f"{momentum:.2f}% 1-month momentum", "value": round(momentum_score)},
            {"label": "Recent momentum", "note": f"{momentum:.2f}% recent momentum", "value": round(momentum_score)},
            {"label": "Volatility fit", "note": f"{volatility:.1f}% recent volatility", "value": round(volatility_fit)},
            {"label": "Long-term trend", "note": f"{trend:.2f}% 6-month trend", "value": round(trend_score)},
            {"label": "Drawdown", "note": f"{drawdown:.2f}% from 6-month high", "value": round(drawdown_score)},
            {"label": "News sentiment", "note": "Neutral fallback", "value": 50},
            {"label": "Risk/reward", "note": f"Risk/reward {risk_reward:.2f}", "value": round(max(0, min(100, 45 + risk_reward * 18)))},
        ],
        "confidence": round(max(50, min(90, 50 + abs(score - 50) * 1.1)), 2),
        "expectedHold": "3-9 months",
        "market": asset.get("market"),
        "name": asset.get("name") or price_info.get("name"),
        "potentialLossRate": downside_rate,
        "potentialProfitRate": max(0.02, risk_reward * downside_rate),
        "priceMetrics": {
            "drawdown": price_info.get("drawdown"),
            "momentum": price_info.get("momentum"),
            "proxy_used": price_info.get("proxy_used"),
            "trend": price_info.get("trend"),
            "volatility": price_info.get("volatility"),
        },
        "priceSource": price_info.get("priceSource"),
        "proxyType": price_info.get("proxyType"),
        "profile": None,
        "riskRewardLabel": f"1 : {risk_reward:.2f}",
        "riskRewardRatio": risk_reward,
        "score": round(score),
        "scoreBand": _opportunity_band(score),
        "stock": stock_data,
        "symbol": asset["symbol"],
        "why": [f"Fallback price source {price_info['proxy_used']}.", f"{momentum:.2f}% recent momentum", f"{drawdown:.2f}% drawdown"],
    }


def _fast_scan_universe(universe: list[dict[str, str]]) -> tuple[list[dict[str, Any]], int]:
    symbols = [stock["symbol"] for stock in universe]
    cache_key = "fast-scan:" + ",".join(symbols)
    cached = _cache_get(cache_key, TTL_FAST_SCAN_SECONDS)
    if cached is not None:
        return cached
    failed_count = 0
    results: list[dict[str, Any]] = []
    try:
        download = _download_fast_universe(symbols)
    except Exception:
        logger.exception("Batch fast scan download failed")
        download = pd.DataFrame()
    symbol_count = len(symbols)
    for stock in universe:
        try:
            history = _frame_for_symbol(download, stock["symbol"], symbol_count)
            result = _fast_scan_from_history(stock, history)
            if result is None:
                failed_count += 1
                continue
            results.append(result)
        except Exception:
            failed_count += 1
            logger.exception("Fast technical scan failed for %s", stock["symbol"])
    return _cache_set(cache_key, (results, failed_count))


def _fast_scan_stock(stock: dict[str, str]) -> dict[str, Any]:
    symbol = stock["symbol"]
    stock_data = _get_stock_data_cached(symbol)
    if stock_data.get("error"):
        raise ValueError(stock_data["error"])
    prediction = _get_prediction_cached(symbol)
    sentiment = _get_sentiment_cached(symbol)
    volatility = _recent_volatility(stock_data)
    momentum = _recent_momentum(stock_data)
    recommendation = str(prediction.get("recommendation", "HOLD"))
    confidence = float(prediction.get("confidence", 50))
    confidence = confidence * 100 if confidence <= 1 else confidence
    base_score = confidence
    base_score += 12 if recommendation == "BUY" else -18 if recommendation == "AVOID" else 0
    base_score += min(max(momentum * 1.2, -12), 12)
    base_score += (100 - min(volatility * 8, 100) - 50) * 0.25
    if sentiment is not None:
        base_score += (_sentiment_score(sentiment) - 50) * 0.25
    return {
        "analysis": {
            "confidence": confidence,
            "final_recommendation": recommendation,
            "risk_level": _risk_level_from_volatility(volatility),
            "sentiment_analysis": sentiment,
            "suggested_allocation": "Fast scan",
            "symbol": symbol,
            "transformer_prediction": prediction,
            "explanation": "Fast scan result used for shortlisting.",
        },
        "backtest": None,
        "components": [
            {"label": "AI outlook", "note": f"{recommendation} signal", "value": round(confidence)},
            {"label": "Recent momentum", "note": f"{momentum:.2f}% recent momentum", "value": round(max(0, min(100, 50 + momentum * 2)))},
            {"label": "Volatility fit", "note": f"{volatility:.1f}% recent volatility", "value": round(max(0, min(100, 100 - volatility * 8)))},
            {"label": "News sentiment", "note": "Cached sentiment" if sentiment else "Sentiment pending", "value": round(_sentiment_score(sentiment))},
        ],
        "confidence": confidence,
        "expectedHold": "3-9 months",
        "market": stock["market"],
        "name": stock["name"],
        "potentialLossRate": 0.1,
        "potentialProfitRate": 0.08 if recommendation == "HOLD" else 0.15 if recommendation == "BUY" else 0,
        "profile": None,
        "riskRewardLabel": "Fast scan",
        "riskRewardRatio": 1.2 if recommendation != "AVOID" else None,
        "score": round(max(0, min(100, base_score))),
        "scoreBand": _opportunity_band(base_score),
        "stock": stock_data,
        "symbol": symbol,
        "why": ["Fast scan shortlisted this setup."],
    }


def _deep_analyze_stock(fast_result: dict[str, Any], horizon: str, currency: str) -> dict[str, Any]:
    symbol = fast_result["symbol"]
    stock_data = fast_result.get("stock") or _get_stock_data_cached(symbol)
    analysis = _get_analysis_cached(symbol)
    backtest = _cache_get(f"backtest:{symbol.upper()}", TTL_BACKTEST_SECONDS)
    exit_metrics = _build_exit_metrics(analysis, stock_data)
    components = _score_opportunity_components(analysis, backtest, stock_data, exit_metrics, horizon)
    score = round(_weighted_opportunity_score(components, horizon))
    ratio = exit_metrics["riskRewardRatio"]
    reasons = [
        component["note"]
        for component in sorted(components, key=lambda item: item["value"], reverse=True)
        if component["value"] >= 65
    ][:3]
    if not reasons:
        reasons = [analysis.get("explanation", "Selected by MarketMind scan.")]
    return {
        "analysis": analysis,
        "assetType": fast_result.get("assetType", "stock"),
        "backtest": backtest,
        "components": components,
        "confidence": analysis.get("confidence", 0),
        "expectedHold": _expected_hold(horizon),
        "market": fast_result["market"],
        "name": fast_result["name"],
        "potentialLossRate": exit_metrics["downsideRate"],
        "potentialProfitRate": exit_metrics["upsideRate"],
        "profile": None,
        "riskRewardLabel": f"1 : {ratio:.2f}" if ratio else "Not available",
        "riskRewardRatio": ratio,
        "score": score,
        "scoreBand": _opportunity_band(score),
        "sector": _sector_for_symbol(symbol),
        "stock": stock_data,
        "symbol": symbol,
        "why": reasons,
    }


def _score_opportunity_components(
    analysis: dict[str, Any],
    backtest: dict[str, Any] | None,
    stock_data: dict[str, Any] | None,
    exit_metrics: dict[str, Any],
    horizon: str,
) -> list[dict[str, Any]]:
    prediction = analysis.get("transformer_prediction") or {}
    recommendation = prediction.get("recommendation") or analysis.get("final_recommendation", "HOLD")
    confidence = float(prediction.get("confidence") or analysis.get("confidence") or 0)
    confidence = confidence * 100 if confidence <= 1 else confidence
    signal_boost = 12 if recommendation == "BUY" else -18 if recommendation == "AVOID" else 0
    sentiment = analysis.get("sentiment_analysis")
    volatility = _recent_volatility(stock_data)
    momentum = _recent_momentum(stock_data)
    long_trend = _long_trend(stock_data)
    return [
        {"label": "AI outlook", "note": f"{recommendation} signal with {confidence:.0f}% confidence", "value": round(max(0, min(100, confidence + signal_boost)))},
        {"label": "News sentiment", "note": f"{str((sentiment or {}).get('sentiment', 'neutral')).capitalize()} news sentiment", "value": round(_sentiment_score(sentiment))},
        {"label": "Risk/reward", "note": f"Risk/reward {exit_metrics['riskRewardRatio']:.2f}" if exit_metrics["riskRewardRatio"] else "Risk/reward unavailable", "value": round(_risk_reward_score(exit_metrics["riskRewardRatio"]))},
        {"label": "Backtest strength", "note": _backtest_note(backtest), "value": round(_backtest_score(backtest))},
        {"label": "Recommendation quality", "note": f"MarketMind says {analysis.get('final_recommendation', 'HOLD')}", "value": round(_recommendation_score(str(analysis.get("final_recommendation", "HOLD")), float(analysis.get("confidence") or 0)))},
        {"label": "Recent momentum", "note": f"{momentum:.2f}% recent momentum", "value": round(max(0, min(100, 50 + momentum * 2)))},
        {"label": "Volatility fit", "note": f"{volatility:.1f}% recent volatility", "value": round(max(0, min(100, 100 - volatility * 8)))},
        {"label": "Long-term trend", "note": f"{long_trend:.2f}% long-term trend", "value": round(max(0, min(100, 50 + long_trend * 1.1)))},
    ]


def _weighted_opportunity_score(components: list[dict[str, Any]], horizon: str) -> float:
    weights = {
        "short": {
            "AI outlook": 0.16,
            "News sentiment": 0.28,
            "Risk/reward": 0.18,
            "Backtest strength": 0.08,
            "Recommendation quality": 0.08,
            "Recent momentum": 0.18,
            "Volatility fit": 0.12,
            "Long-term trend": 0,
        },
        "medium": {
            "AI outlook": 0.22,
            "News sentiment": 0.18,
            "Risk/reward": 0.2,
            "Backtest strength": 0.16,
            "Recommendation quality": 0.1,
            "Recent momentum": 0.06,
            "Volatility fit": 0.08,
            "Long-term trend": 0,
        },
        "long": {
            "AI outlook": 0.22,
            "News sentiment": 0.1,
            "Risk/reward": 0.16,
            "Backtest strength": 0.22,
            "Recommendation quality": 0.12,
            "Recent momentum": 0.04,
            "Volatility fit": 0.06,
            "Long-term trend": 0.18,
        },
    }[horizon]
    total_weight = sum(weights.values()) or 1
    return sum(component["value"] * weights.get(component["label"], 0) for component in components) / total_weight


def _backtest_score(backtest: dict[str, Any] | None) -> float:
    if not backtest:
        return 50
    excess_return = float(backtest.get("strategy_return_percent") or 0) - float(backtest.get("buy_hold_return_percent") or 0)
    return_score = max(0, min(100, 50 + float(backtest.get("strategy_return_percent") or 0) * 1.2))
    excess_score = max(0, min(100, 50 + excess_return * 1.4))
    win_score = max(0, min(100, float(backtest.get("win_rate") or 0)))
    drawdown_score = max(0, min(100, 100 - abs(float(backtest.get("max_drawdown") or 0)) * 2))
    return return_score * 0.35 + excess_score * 0.3 + win_score * 0.2 + drawdown_score * 0.15


def _backtest_note(backtest: dict[str, Any] | None) -> str:
    if not backtest:
        return "Backtest unavailable"
    return f"{float(backtest.get('strategy_return_percent') or 0):+.2f}% AI backtest return"


def _long_trend(stock_data: dict[str, Any] | None) -> float:
    history = (stock_data or {}).get("history") or []
    if len(history) < 2:
        return 0
    first_close = float(history[0].get("close") or 0)
    latest = float((stock_data or {}).get("latest_close") or 0)
    if first_close <= 0 or latest <= 0:
        return 0
    return ((latest - first_close) / first_close) * 100


def _opportunity_band(score: float) -> str:
    if score >= 82:
        return "Strong Opportunity"
    if score >= 74:
        return "Good Opportunity"
    if score >= 63:
        return "Moderate Opportunity"
    return "Weak Opportunity"


def _expected_hold(horizon: str) -> str:
    if horizon == "short":
        return "2-8 weeks"
    if horizon == "long":
        return "12-24 months"
    return "3-9 months"


def _plan_tuning(risk_profile: str, horizon: str) -> dict[str, Any]:
    if risk_profile == "safe":
        adjustment = 4 if horizon == "short" else -2 if horizon == "long" else 0
        return {
            "maxPositions": 1 if horizon == "short" else 2,
            "minimumDeployRate": 0.15 if horizon == "short" else 0.35 if horizon == "long" else 0.25,
            "minimumRiskReward": 1.6 if horizon == "short" else 1.4,
            "minimumScore": 84 + adjustment,
            "scorePower": 1.05,
        }
    if risk_profile == "aggressive":
        adjustment = 4 if horizon == "short" else -6 if horizon == "long" else 0
        return {
            "maxPositions": 4 if horizon == "short" else 7 if horizon == "long" else 6,
            "minimumDeployRate": 0.9 if horizon == "long" else 0.65 if horizon == "short" else 0.78,
            "minimumRiskReward": 1.25 if horizon == "short" else 1.15,
            "minimumScore": 55 + adjustment,
            "scorePower": 1.7 if horizon == "long" else 1.5,
        }
    adjustment = 3 if horizon == "short" else -3 if horizon == "long" else 0
    return {
        "maxPositions": 3 if horizon == "short" else 5 if horizon == "long" else 4,
        "minimumDeployRate": 0.7 if horizon == "long" else 0.45 if horizon == "short" else 0.58,
        "minimumRiskReward": 1.35 if horizon == "short" else 1.2,
        "minimumScore": 68 + adjustment,
        "scorePower": 1.25,
    }


def _component_value(opportunity: dict[str, Any], label: str) -> float:
    for component in opportunity.get("components", []):
        if component.get("label") == label:
            return float(component.get("value") or 50)
    if label == "Recent momentum":
        return _component_value(opportunity, "Recent return")
    return 50


def _clamp_score(value: float, low: float = 0, high: float = 100) -> float:
    return max(low, min(high, value))


def _asset_price(stock_data: dict[str, Any] | None) -> float | None:
    price = (stock_data or {}).get("latest_close")
    if price is None:
        return None
    try:
        numeric = float(price)
    except (TypeError, ValueError):
        return None
    return numeric if numeric > 0 else None


def _asset_trend(stock_data: dict[str, Any] | None) -> str:
    momentum = _recent_momentum(stock_data)
    long_trend = _long_trend(stock_data)
    if momentum > 3 and long_trend > 5:
        return "Uptrend"
    if momentum < -3 and long_trend < -5:
        return "Downtrend"
    return "Sideways"


def _sector_for_symbol(symbol: str) -> str:
    return SECTOR_BY_SYMBOL.get(symbol.upper(), "Diversified")


def _average(values: list[float], fallback: float = 50) -> float:
    clean = [value for value in values if value is not None]
    return sum(clean) / len(clean) if clean else fallback


def _top_by_symbols(opportunities: list[dict[str, Any]], symbols: set[str]) -> list[dict[str, Any]]:
    return [item for item in opportunities if str(item.get("symbol", "")).upper() in symbols]


def _ordered_gold_assets(opportunities: list[dict[str, Any]], currency: str) -> list[dict[str, Any]]:
    priority = ["GOLDBEES.NS", "GLD", "IAU", "GC=F"] if currency == "INR" else ["GLD", "IAU", "GC=F"]
    priority_rank = {symbol: index for index, symbol in enumerate(priority)}
    gold_assets = [
        item for item in opportunities
        if str(item.get("symbol", "")).upper() in priority_rank
    ]
    return sorted(
        gold_assets,
        key=lambda item: (
            priority_rank.get(str(item.get("symbol", "")).upper(), 99),
            -float(item.get("score") or 50),
        ),
    )


def _stock_asset_payload(position: dict[str, Any], amount: float, currency: str) -> dict[str, Any]:
    stock_data = position.get("stock") or {}
    current_price = _asset_price(stock_data)
    return {
        "amount": amount,
        "amountLabel": _format_plan_currency(amount, currency),
        "available": current_price is not None,
        "current_price": current_price,
        "currentPrice": current_price,
        "expected_return": round(float(position.get("potentialProfitRate") or 0) * 100, 2),
        "name": position.get("name"),
        "priceSource": position.get("priceSource"),
        "reason": (position.get("why") or ["Score-weighted opportunity."])[0],
        "risk": (position.get("analysis") or {}).get("risk_level", "Market risk"),
        "score": round(float(position.get("score") or 0)),
        "sector": position.get("sector") or _sector_for_symbol(str(position.get("symbol", ""))),
        "symbol": position.get("symbol"),
        "trend": _asset_trend(stock_data),
    }


def _generic_asset_payload(asset: dict[str, Any], amount: float, currency: str, reason: str) -> dict[str, Any]:
    stock_data = asset.get("stock") or {}
    current_price = _asset_price(stock_data)
    payload = {
        "amount": amount,
        "amountLabel": _format_plan_currency(amount, currency),
        "available": current_price is not None,
        "current_price": current_price,
        "currentPrice": current_price,
        "expected_return": round(float(asset.get("potentialProfitRate") or 0) * 100, 2),
        "name": asset.get("name"),
        "priceSource": asset.get("priceSource"),
        "reason": reason,
        "risk": (asset.get("analysis") or {}).get("risk_level", "Market risk"),
        "score": round(float(asset.get("score") or 50)),
        "symbol": asset.get("symbol"),
        "trend": _asset_trend(stock_data),
    }
    if asset.get("assetType") == "etf" and str(asset.get("symbol", "")).upper() in {"GOLDBEES.NS", "GLD", "IAU", "GC=F"}:
        payload["proxyType"] = asset.get("proxyType") or _gold_proxy_type(str(asset.get("symbol", "")))
    return payload


def _unavailable_asset_payload(symbol: str, name: str, amount: float, currency: str, score: float, reason: str) -> dict[str, Any]:
    unavailable_reason = "No valid live gold proxy price was returned by available symbols." if str(symbol).upper() in {"GOLDBEES.NS", "GLD", "IAU", "GC=F"} else "Live market data source did not return a valid price."
    payload = {
        "amount": amount,
        "amountLabel": _format_plan_currency(amount, currency),
        "available": False,
        "current_price": None,
        "currentPrice": None,
        "expected_return": None,
        "name": name,
        "priceSource": {
            "fallbackUsed": False,
            "provider": "Yahoo Finance",
            "symbol": None,
        },
        "reason": f"{reason} {unavailable_reason}",
        "risk": "Market risk",
        "score": round(score),
        "symbol": symbol,
        "trend": "Live market data source did not return a valid price.",
    }
    if str(symbol).upper() in {"GOLDBEES.NS", "GLD", "IAU", "GC=F"}:
        payload["proxyType"] = _gold_proxy_type(symbol)
    return payload


def _market_regime(opportunities: list[dict[str, Any]], currency: str) -> dict[str, Any]:
    if currency == "INR":
        primary = _top_by_symbols(opportunities, {"NIFTYBEES.NS", "JUNIORBEES.NS"})
        label = "India"
    elif currency == "USD":
        primary = _top_by_symbols(opportunities, {"SPY", "QQQ", "VOO"})
        label = "US"
    else:
        primary = _top_by_symbols(opportunities, {"SPY", "QQQ", "VOO", "NIFTYBEES.NS"})
        label = "Global"
    if not primary:
        primary = [item for item in opportunities if item.get("assetType") == "etf"][:4]
    momentum = _average([_component_value(item, "Recent return") for item in primary])
    trend = _average([_component_value(item, "Long-term trend") for item in primary])
    volatility_fit = _average([_component_value(item, "Volatility fit") for item in primary])
    score = trend * 0.45 + momentum * 0.35 + volatility_fit * 0.2
    if score >= 60:
        regime = "Bullish"
    elif score <= 43 or volatility_fit < 38:
        regime = "Bearish"
    else:
        regime = "Sideways"
    return {
        "label": regime,
        "market": label,
        "momentumScore": round(momentum),
        "score": round(score),
        "trendScore": round(trend),
        "volatilityScore": round(volatility_fit),
    }


def _market_sentiment_score(opportunities: list[dict[str, Any]]) -> float:
    return _average([
        _component_value(item, "News sentiment")
        for item in opportunities
        if item.get("assetType") in {"stock", "etf"}
    ])


def _market_sentiment_details(opportunities: list[dict[str, Any]], regime: dict[str, Any]) -> dict[str, Any]:
    sentiment_components = [
        component
        for item in opportunities
        if item.get("assetType") in {"stock", "etf"}
        for component in item.get("components", [])
        if component.get("label") == "News sentiment"
    ]
    if not sentiment_components:
        return {
            "label": "Neutral",
            "reason": "Neutral fallback used because market sentiment data was unavailable.",
            "score": 50,
            "source": "fallback_neutral",
        }
    score = round(_market_sentiment_score(opportunities))
    source = "derived"
    if score >= 62 or (score >= 55 and regime["label"] == "Bullish"):
        label = "Bullish"
        reason = "Derived from scanned stock and sector sentiment, with broad-market price action confirming positive conditions."
    elif score <= 42 or (score <= 48 and regime["label"] == "Bearish"):
        label = "Bearish"
        reason = "Derived from scanned stock and sector sentiment, with broad-market price action showing caution."
    else:
        label = "Neutral"
        reason = "Derived from scanned stock and sector sentiment because broad-market news sentiment is not separately available."
    return {"score": score, "label": label, "reason": reason, "source": source}


def _sector_sentiment_scores(opportunities: list[dict[str, Any]]) -> dict[str, float]:
    sectors: dict[str, list[float]] = {}
    for item in opportunities:
        if item.get("assetType") != "stock":
            continue
        sectors.setdefault(_sector_for_symbol(str(item.get("symbol", ""))), []).append(_component_value(item, "News sentiment"))
    return {sector: _average(values) for sector, values in sectors.items()}


def _risk_adjusted_score(items: list[dict[str, Any]]) -> float:
    if not items:
        return 45
    values = []
    for item in items:
        values.append(
            float(item.get("score") or 50) * 0.45
            + _component_value(item, "Risk/reward") * 0.25
            + _component_value(item, "Volatility fit") * 0.2
            + _backtest_score(item.get("backtest")) * 0.1
        )
    return _average(values)


def _user_fit_score(kind: str, risk_profile: str, horizon: str) -> float:
    fit = {
        "safe": {"stocks": 40, "index": 78, "gold": 72, "highRisk": 0, "cash": 82},
        "balanced": {"stocks": 66, "index": 76, "gold": 62, "highRisk": 36, "cash": 54},
        "aggressive": {"stocks": 86, "index": 62, "gold": 42, "highRisk": 72, "cash": 28},
    }[risk_profile][kind]
    if horizon == "short":
        fit += {"stocks": -12, "index": 5, "gold": 4, "highRisk": -22, "cash": 20}[kind]
    if horizon == "long":
        fit += {"stocks": 12, "index": 8, "gold": -4, "highRisk": 8, "cash": -18}[kind]
    return _clamp_score(fit)


def _bucket_caps(risk_profile: str, horizon: str) -> dict[str, dict[str, float]]:
    caps = {
        "safe": {"stocks": 0.2, "highRisk": 0, "cashMin": 0.2},
        "balanced": {"stocks": 0.4, "highRisk": 0.05, "cashMin": 0.1},
        "aggressive": {"stocks": 0.6, "highRisk": 0.15, "cashMin": 0.05},
    }[risk_profile].copy()
    if horizon == "short":
        caps["cashMin"] += 0.12
        caps["highRisk"] *= 0.5
        caps["stocks"] -= 0.08
    if horizon == "long":
        caps["cashMin"] = max(0.03, caps["cashMin"] - 0.04)
        caps["stocks"] += 0.05
    return {
        "max": {"stocks": caps["stocks"], "highRisk": caps["highRisk"], "gold": 0.25, "index": 0.75, "cash": 0.65},
        "min": {"cash": caps["cashMin"], "index": 0.08 if risk_profile != "aggressive" else 0.04},
    }


def _gold_cap(regime: dict[str, Any], bucket_scores: dict[str, float], stock_quality: float) -> float:
    strongest_growth = max(bucket_scores.get("stocks", 0), bucket_scores.get("index", 0))
    if regime["label"] == "Bearish" or regime.get("volatilityScore", 50) < 45:
        return 0.3
    if regime["label"] == "Bullish" and strongest_growth >= 68 and stock_quality >= 60:
        return 0.1
    if regime["label"] == "Bullish" and strongest_growth >= 62:
        return 0.14
    return 0.18


def _profile_stock_redirect(risk_profile: str, horizon: str) -> float:
    if risk_profile == "safe":
        return 0.2 if horizon == "short" else 0.3
    if risk_profile == "balanced":
        return 0.65 if horizon != "short" else 0.5
    return 0.85 if horizon == "long" else 0.75


def _rebalance_weight_caps(weights: dict[str, float], caps: dict[str, dict[str, float]]) -> dict[str, float]:
    weights = {key: max(0, value) for key, value in weights.items()}
    for key, minimum in caps["min"].items():
        weights[key] = max(weights.get(key, 0), minimum)
    for _ in range(8):
        overflow = 0.0
        for key, maximum in caps["max"].items():
            if weights.get(key, 0) > maximum:
                overflow += weights[key] - maximum
                weights[key] = maximum
        under_keys = [key for key in weights if weights[key] < caps["max"].get(key, 1)]
        room = sum(caps["max"].get(key, 1) - weights[key] for key in under_keys)
        if overflow <= 0 or room <= 0:
            break
        for key in under_keys:
            weights[key] += overflow * ((caps["max"].get(key, 1) - weights[key]) / room)
    total = sum(weights.values()) or 1
    return {key: value / total for key, value in weights.items() if value > 0.001}


BUCKET_OVERRIDE_LABELS = {
    "ai stocks": "stocks",
    "ai stock": "stocks",
    "stocks": "stocks",
    "stock": "stocks",
    "direct stocks": "stocks",
    "index": "index",
    "index/sip": "index",
    "index sip": "index",
    "sip": "index",
    "gold": "gold",
    "cash": "cash",
    "cash buffer": "cash",
    "crypto": "highRisk",
    "high risk": "highRisk",
    "high-risk": "highRisk",
    "high-risk / crypto": "highRisk",
    "highrisk": "highRisk",
}

BUCKET_KIND_LABELS = {
    "cash": "Cash",
    "gold": "Gold",
    "highRisk": "Crypto",
    "index": "Index/SIP",
    "stocks": "AI Stocks",
}


def _normalize_profile(value: str | None, field_name: str) -> str:
    normalized = str(value or "").strip().lower()
    allowed = {"safe", "balanced", "aggressive"} if field_name == "risk profile" else {"short", "medium", "long"}
    if normalized not in allowed:
        raise HTTPException(status_code=422, detail=f"Invalid {field_name}.")
    return normalized


def _override_kind(label: str) -> str | None:
    cleaned = re.sub(r"\s+", " ", str(label).replace("_", " ").replace("-", "-")).strip().lower()
    return BUCKET_OVERRIDE_LABELS.get(cleaned)


def _override_requested_amount(override: Any, amount: float, currency: str) -> tuple[float, str]:
    if not isinstance(override, dict):
        raise HTTPException(status_code=422, detail="Allocation override must include type and value.")
    override_type = str(override.get("type", "")).strip().lower()
    try:
        value = float(override.get("value"))
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=422, detail="Allocation override value must be numeric.") from exc
    if value < 0:
        raise HTTPException(status_code=422, detail="Allocation override value cannot be negative.")
    if override_type == "amount":
        return value, _format_plan_currency(value, currency)
    if override_type == "percentage":
        return amount * (value / 100), f"{value:g}%"
    raise HTTPException(status_code=422, detail="Allocation override type must be amount or percentage.")


def _override_limit_warning(kind: str, direction: str) -> str:
    if kind == "highRisk":
        return "Crypto was reduced to match your risk profile limit." if direction == "max" else "Crypto was adjusted to match your risk profile."
    if kind == "stocks":
        return "AI Stock allocation exceeded your profile limit and was adjusted." if direction == "max" else "AI Stock allocation was adjusted to match your profile."
    if kind == "cash":
        return "Cash was increased to meet the minimum required reserve." if direction == "min" else "Cash was reduced to match your profile limit."
    if kind == "gold":
        return "Gold allocation exceeded the current hedge limit and was adjusted."
    if kind == "index":
        return "Index/SIP allocation was adjusted to preserve diversification and risk limits."
    return "Edited allocation was adjusted to match your risk limits."


def _apply_allocation_overrides(
    weights: dict[str, float],
    amount: float,
    currency: str,
    risk_profile: str,
    horizon: str,
    caps: dict[str, dict[str, float]],
    overrides: dict[str, Any] | None,
) -> tuple[dict[str, float], list[dict[str, Any]], list[str], str | None]:
    if not overrides:
        return weights, [], [], None
    requested: dict[str, dict[str, Any]] = {}
    warnings: list[str] = []
    for label, override in overrides.items():
        kind = _override_kind(label)
        if kind is None:
            warnings.append(f"Ignored unknown allocation bucket '{label}'.")
            continue
        requested_amount, requested_label = _override_requested_amount(override, amount, currency)
        requested[kind] = {
            "bucket": BUCKET_KIND_LABELS[kind],
            "requestedAmount": requested_amount,
            "requested": requested_label,
        }
    raw_total = sum(item["requestedAmount"] for item in requested.values())
    if raw_total > amount + 0.01:
        raise HTTPException(status_code=422, detail="Your edited allocations exceed the total amount available.")
    if not requested:
        return weights, [], warnings, None

    locked_amounts: dict[str, float] = {}
    summaries: dict[str, dict[str, Any]] = {}
    for kind, item in requested.items():
        final_amount = item["requestedAmount"]
        status = "applied"
        reason = f"User locked {BUCKET_KIND_LABELS[kind]} allocation."
        maximum = None if kind == "gold" else caps["max"].get(kind)
        minimum = caps["min"].get(kind)
        if maximum is not None and final_amount > amount * maximum:
            final_amount = amount * maximum
            status = "adjusted"
            reason = _override_limit_warning(kind, "max")
            warnings.append(reason)
        if minimum is not None and final_amount < amount * minimum:
            final_amount = amount * minimum
            status = "adjusted"
            reason = _override_limit_warning(kind, "min")
            warnings.append(reason)
        final_amount = _round_plan_amount(final_amount, currency)
        locked_amounts[kind] = final_amount
        summaries[kind] = {
            "bucket": BUCKET_KIND_LABELS[kind],
            "requested": item["requested"],
            "final": _format_plan_currency(final_amount, currency),
            "status": status,
            "reason": reason,
        }

    unlocked = [kind for kind in ("index", "stocks", "gold", "cash", "highRisk") if kind not in locked_amounts]
    required_unlocked = sum(amount * caps["min"].get(kind, 0) for kind in unlocked)
    locked_total = sum(locked_amounts.values())
    max_locked_total = amount - required_unlocked
    if locked_total > max_locked_total + 0.01 and locked_total > 0:
        reduction = locked_total - max_locked_total
        reducible = [kind for kind, value in locked_amounts.items() if value > 0 and kind != "cash"]
        reducible_total = sum(locked_amounts[kind] for kind in reducible)
        if reducible_total <= 0:
            raise HTTPException(status_code=422, detail="Your edited allocations leave no room for required risk reserves.")
        for kind in reducible:
            cut = reduction * (locked_amounts[kind] / reducible_total)
            locked_amounts[kind] = max(0, _round_plan_amount(locked_amounts[kind] - cut, currency))
            summaries[kind]["final"] = _format_plan_currency(locked_amounts[kind], currency)
            summaries[kind]["status"] = "adjusted"
            summaries[kind]["reason"] = "Edited allocation was reduced to preserve required risk minimums."
        warnings.append("Edited allocations were reduced to preserve required risk minimums.")

    final_weights = {kind: locked_amount / amount for kind, locked_amount in locked_amounts.items() if locked_amount > 0}
    remaining_weight = max(0, 1 - sum(final_weights.values()))
    min_weights = {kind: caps["min"].get(kind, 0) for kind in unlocked}
    min_total = sum(min_weights.values())
    if min_total > remaining_weight and min_total > 0:
        scale = remaining_weight / min_total
        min_weights = {kind: value * scale for kind, value in min_weights.items()}
    for kind, value in min_weights.items():
        if value > 0:
            final_weights[kind] = value
    pool = max(0, remaining_weight - sum(min_weights.values()))
    active = [
        kind for kind in unlocked
        if caps["max"].get(kind, 1) > final_weights.get(kind, 0)
    ]
    for _ in range(8):
        if pool <= 0.0001 or not active:
            break
        base_total = sum(max(0.0001, weights.get(kind, 0)) for kind in active) or len(active)
        overflow = 0.0
        next_active = []
        for kind in active:
            room = max(0, caps["max"].get(kind, 1) - final_weights.get(kind, 0))
            addition = pool * (max(0.0001, weights.get(kind, 0)) / base_total)
            if addition > room:
                final_weights[kind] = final_weights.get(kind, 0) + room
                overflow += addition - room
            else:
                final_weights[kind] = final_weights.get(kind, 0) + addition
                next_active.append(kind)
        if overflow <= 0.0001:
            pool = 0
            break
        pool = overflow
        active = next_active
    if pool > 0.0001:
        cash_room = max(0, caps["max"].get("cash", 1) - final_weights.get("cash", 0))
        if cash_room > 0:
            final_weights["cash"] = final_weights.get("cash", 0) + min(pool, cash_room)
    total_weight = sum(final_weights.values()) or 1
    final_weights = {kind: value / total_weight for kind, value in final_weights.items() if value > 0.001}
    locked_names = ", ".join(summary["bucket"] for summary in summaries.values())
    explanation = (
        f"MarketMind kept your {locked_names} allocation fixed and redistributed the remaining "
        f"{_format_plan_currency(max(0, amount - sum(locked_amounts.values())), currency)} using today's adaptive scores."
    )
    return final_weights, list(summaries.values()), list(dict.fromkeys(warnings)), explanation


def _normalize_adaptive_weights(raw: dict[str, float], risk_profile: str, horizon: str) -> dict[str, float]:
    caps = _bucket_caps(risk_profile, horizon)
    weights = {key: max(0, value) for key, value in raw.items()}
    if risk_profile == "safe":
        weights["highRisk"] = 0
    total = sum(weights.values()) or 1
    weights = {key: value / total for key, value in weights.items()}
    return _rebalance_weight_caps(weights, caps)


def _score_bucket(
    kind: str,
    market_opportunity: float,
    risk_adjusted: float,
    diversification: float,
    risk_profile: str,
    horizon: str,
) -> float:
    return _clamp_score(
        market_opportunity * 0.35
        + _user_fit_score(kind, risk_profile, horizon) * 0.3
        + risk_adjusted * 0.2
        + diversification * 0.15
    )


def _bucket_reason(kind: str, score: float, regime: dict[str, Any], stock_quality: float) -> str:
    regime_label = regime["label"]
    if kind == "stocks":
        if score >= 70:
            return "High-scoring AI stock opportunities cleared the risk and quality filters."
        return "Direct stock opportunities are mixed, so MarketMind limited concentrated stock exposure."
    if kind == "index":
        if regime_label == "Sideways":
            return "Sideways market conditions favor diversified SIP-style index exposure."
        if regime_label == "Bullish":
            return "Broad-market trend is constructive, supporting index participation."
        return "Index exposure is kept diversified while bearish risk is respected."
    if kind == "gold":
        if regime_label == "Bearish":
            return "Gold scored well as a hedge because market conditions look weak or volatile."
        return "Gold adds diversification without dominating stronger growth opportunities."
    if kind == "highRisk":
        return "Crypto is included only because the setup and risk profile allow a small high-risk sleeve."
    if stock_quality < 58 or regime_label == "Bearish":
        return "MarketMind recommends holding cash because available opportunities do not sufficiently outperform cash today."
    return "Cash preserves flexibility while the plan deploys into higher-scoring buckets."


def _plan_explanation(bucket_scores: dict[str, float], weights: dict[str, float], regime: dict[str, Any]) -> str:
    stock_weight = weights.get("stocks", 0)
    cash_weight = weights.get("cash", 0)
    index_weight = weights.get("index", 0)
    if stock_weight >= 0.32 and bucket_scores.get("stocks", 0) >= 68:
        return "MarketMind increased AI Stock exposure because several high-scoring opportunities were found."
    if cash_weight >= 0.25 or regime["label"] == "Bearish":
        return "MarketMind increased Cash and Gold because market conditions or direct stock opportunities are mixed today."
    if index_weight >= stock_weight:
        return "MarketMind increased Index/SIP because broad diversified exposure scores better than concentrated picks today."
    return "MarketMind balanced stock picks, index exposure, hedges, and cash based on today's scores."


def _crypto_candidate_payload(asset: dict[str, Any], allocation: float, currency: str, risk_profile: str, bucket_score: float) -> dict[str, Any]:
    symbol = str(asset.get("symbol", ""))
    price = _asset_price(asset.get("stock"))
    score = round(
        float(asset.get("score") or 50) * 0.45
        + _component_value(asset, "Long-term trend") * 0.25
        + _component_value(asset, "Volatility fit") * 0.15
        + _component_value(asset, "Recent return") * 0.15
    )
    if price is None:
        reason = "No valid live crypto price was returned by available symbols."
    elif risk_profile == "safe":
        reason = "Safe profile does not allow crypto exposure."
    elif bucket_score < 58 or score < 58:
        reason = "Momentum and risk-adjusted return are weak relative to equities."
    elif allocation <= 0:
        reason = "Crypto setup was acceptable but did not outrank other buckets after caps and diversification."
    else:
        reason = "Crypto setup cleared the risk-adjusted score gate within profile caps."
    return {
        "allocation": allocation,
        "allocationLabel": _format_plan_currency(allocation, currency),
        "available": price is not None,
        "current_price": price,
        "name": asset.get("name"),
        "priceSource": asset.get("priceSource"),
        "reason": reason,
        "score": score,
        "symbol": symbol.replace("-USD", ""),
        "trend": _asset_trend(asset.get("stock")),
    }


def _selection_score(opportunity: dict[str, Any], risk_profile: str, horizon: str) -> float:
    volatility_score = _component_value(opportunity, "Volatility fit")
    momentum_score = _component_value(opportunity, "Recent momentum")
    sentiment_score = _component_value(opportunity, "News sentiment")
    long_trend_score = _component_value(opportunity, "Long-term trend")
    ratio = float(opportunity.get("riskRewardRatio") or 0)
    score = float(opportunity.get("score") or 0) + min(ratio * 4, 12)
    if risk_profile == "safe":
        score += volatility_score * 0.22
        if "high" in str(opportunity.get("analysis", {}).get("risk_level", "")).lower():
            score -= 18
    if risk_profile == "aggressive":
        score += float(opportunity.get("potentialProfitRate") or 0) * 80
        score += momentum_score * 0.1
    if horizon == "short":
        score += sentiment_score * 0.18 + momentum_score * 0.2 + volatility_score * 0.12
    if horizon == "long":
        score += long_trend_score * 0.28
    return score


def _eligible_opportunity(opportunity: dict[str, Any], tuning: dict[str, Any], risk_profile: str, horizon: str) -> bool:
    analysis = opportunity.get("analysis") or {}
    if analysis.get("final_recommendation") == "AVOID":
        return False
    volatility_score = _component_value(opportunity, "Volatility fit")
    momentum_score = _component_value(opportunity, "Recent momentum")
    sentiment_score = _component_value(opportunity, "News sentiment")
    long_trend_score = _component_value(opportunity, "Long-term trend")
    risk_reward = float(opportunity.get("riskRewardRatio") or 0)
    risk_level = str(analysis.get("risk_level") or "").lower()
    if risk_profile == "safe":
        return (
            opportunity["score"] >= tuning["minimumScore"]
            and "high" not in risk_level
            and volatility_score >= 58
            and risk_reward >= tuning["minimumRiskReward"]
        )
    if horizon == "short" and (volatility_score < 42 or sentiment_score < 55 or momentum_score < 50):
        return False
    if risk_profile == "aggressive":
        strong_upside = float(opportunity.get("potentialProfitRate") or 0) >= 0.12 and risk_reward >= tuning["minimumRiskReward"]
        long_quality = horizon == "long" and long_trend_score >= 65
        return opportunity["score"] >= tuning["minimumScore"] or (
            strong_upside and opportunity["score"] >= tuning["minimumScore"] - 6
        ) or long_quality
    return opportunity["score"] >= tuning["minimumScore"] and risk_reward >= tuning["minimumRiskReward"]


def _index_suggestion(currency: str) -> str:
    if currency == "INR":
        return "Nifty 50 Index Fund + Nifty Next 50 Index Fund"
    if currency == "USD":
        return "S&P 500 ETF + Nasdaq 100 ETF"
    return "Broad-market index fund or ETF"


def _select_adaptive_stocks(
    stock_amount: float,
    currency: str,
    opportunities: list[dict[str, Any]],
    risk_profile: str,
    horizon: str,
) -> dict[str, Any]:
    tuning = _plan_tuning(risk_profile, horizon)
    candidates = [
        {**opportunity, "sector": opportunity.get("sector") or _sector_for_symbol(str(opportunity.get("symbol", "")))}
        for opportunity in opportunities
        if opportunity.get("assetType", "stock") == "stock"
        and _asset_price(opportunity.get("stock")) is not None
        and _eligible_opportunity(opportunity, tuning, risk_profile, horizon)
    ]
    selected: list[dict[str, Any]] = []
    sector_counts: dict[str, int] = {}
    for candidate in sorted(candidates, key=lambda item: _selection_score(item, risk_profile, horizon), reverse=True):
        sector = str(candidate.get("sector", "Diversified"))
        same_sector_count = sector_counts.get(sector, 0)
        penalty = same_sector_count * (10 if risk_profile == "safe" else 7 if risk_profile == "balanced" else 5)
        adjusted = _selection_score(candidate, risk_profile, horizon) - penalty
        if same_sector_count >= 1 and adjusted < _selection_score(selected[-1], risk_profile, horizon) + 4 if selected else False:
            candidate = {**candidate, "score": max(0, float(candidate.get("score") or 0) - penalty), "concentrationPenalty": penalty}
        selected.append(candidate)
        sector_counts[sector] = same_sector_count + 1
        if len(selected) >= tuning["maxPositions"]:
            break
    if not selected or stock_amount <= 0:
        return {"investAmount": 0, "positions": [], "selectedCount": 0, "unusedAmount": stock_amount}
    weight_total = sum(max(1, float(item.get("score") or 0) - tuning["minimumScore"] + 1) ** tuning["scorePower"] for item in selected) or 1
    allocated = 0.0
    positions = []
    for index, opportunity in enumerate(selected):
        weight = max(1, float(opportunity.get("score") or 0) - tuning["minimumScore"] + 1) ** tuning["scorePower"] / weight_total
        raw_amount = stock_amount - allocated if index == len(selected) - 1 else stock_amount * weight
        rounded = max(0, _round_plan_amount(raw_amount, currency))
        allocated += rounded
        reason = list(opportunity.get("why") or ["Score-weighted opportunity."])
        if opportunity.get("concentrationPenalty"):
            reason = [f"Reduced for sector concentration in {opportunity.get('sector')}.", *reason]
        positions.append({**opportunity, "amount": rounded, "amountLabel": _format_plan_currency(rounded, currency), "why": reason})
    positions = [position for position in positions if position["amount"] > 0]
    invested = sum(position["amount"] for position in positions)
    return {
        "investAmount": invested,
        "positions": positions,
        "selectedCount": len(selected),
        "unusedAmount": max(0, stock_amount - invested),
    }


def _allocate_generic_assets(bucket_amount: float, currency: str, assets: list[dict[str, Any]], reason: str) -> list[dict[str, Any]]:
    priced = [asset for asset in assets if _asset_price(asset.get("stock")) is not None]
    if not priced or bucket_amount <= 0:
        return []
    ranked = sorted(priced, key=lambda item: float(item.get("score") or 50), reverse=True)[:3]
    score_total = sum(max(1, float(item.get("score") or 50)) for item in ranked) or 1
    allocated = 0.0
    output = []
    for index, asset in enumerate(ranked):
        amount = bucket_amount - allocated if index == len(ranked) - 1 else bucket_amount * (max(1, float(asset.get("score") or 50)) / score_total)
        rounded = max(0, _round_plan_amount(amount, currency))
        allocated += rounded
        if rounded > 0:
            output.append(_generic_asset_payload(asset, rounded, currency, reason))
    return output


def _adaptive_investment_plan(
    amount: float,
    currency: str,
    risk_profile: str,
    horizon: str,
    ranked: list[dict[str, Any]],
    final_stock_pool: list[dict[str, Any]],
    allocation_overrides: dict[str, Any] | None = None,
) -> dict[str, Any]:
    regime = _market_regime(ranked, currency)
    market_sentiment = _market_sentiment_score(ranked)
    market_sentiment_details = _market_sentiment_details(ranked, regime)
    sector_sentiment = _sector_sentiment_scores(ranked)
    ranked_symbols = {str(item.get("symbol")) for item in ranked}
    fallback_items: list[dict[str, Any]] = []
    crypto_price_info: dict[str, dict[str, Any]] = {}
    for symbol, name in CRYPTO_INVEST_UNIVERSE:
        if symbol not in ranked_symbols:
            crypto_price_info[symbol] = get_crypto_price(symbol)
            fallback_item = _fallback_price_scan_item(
                {"assetType": "crypto", "market": "Crypto", "name": name, "symbol": symbol},
                crypto_price_info[symbol],
            )
            if fallback_item is not None:
                fallback_items.append(fallback_item)
    gold_info = get_gold_price(currency)
    if gold_info.get("available"):
        if not any(item.get("assetType") == "etf" and str(item.get("symbol")) in {"GOLDBEES.NS", "GC=F", "GLD", "IAU"} and _asset_price(item.get("stock")) is not None for item in ranked):
            fallback_item = _fallback_price_scan_item(
                {
                    "assetType": "etf",
                    "market": "India" if currency == "INR" else "US",
                    "name": gold_info.get("name", "Gold Proxy"),
                    "symbol": gold_info.get("proxy_used", "GOLDBEES.NS" if currency == "INR" else "GLD"),
                },
                gold_info,
            )
            if fallback_item is not None:
                fallback_items.append(fallback_item)
    if fallback_items:
        ranked = [*ranked, *fallback_items]
        final_stock_pool = [*final_stock_pool, *fallback_items]
    stocks = [item for item in final_stock_pool if item.get("assetType", "stock") == "stock" and _asset_price(item.get("stock")) is not None]
    etfs = [item for item in ranked if item.get("assetType") == "etf" and _asset_price(item.get("stock")) is not None]
    crypto = [item for item in ranked if item.get("assetType") == "crypto" and _asset_price(item.get("stock")) is not None]
    crypto_by_symbol = {str(item.get("symbol")): item for item in ranked if item.get("assetType") == "crypto"}
    crypto_candidates_source = [
        crypto_by_symbol.get(symbol, {
            "assetType": "crypto",
            "market": "Crypto",
            "name": name,
            "priceSource": crypto_price_info.get(symbol, {}).get("priceSource"),
            "score": 0,
            "stock": None,
            "symbol": symbol,
        })
        for symbol, name in CRYPTO_INVEST_UNIVERSE
    ]
    index_symbols = {"NIFTYBEES.NS", "JUNIORBEES.NS"} if currency == "INR" else {"SPY", "VOO", "QQQ", "VTI"}
    index_assets = _top_by_symbols(etfs, index_symbols) or etfs[:2]
    gold_assets = _ordered_gold_assets(etfs, currency) or _ordered_gold_assets(ranked, currency)
    eligible_stocks = [
        stock for stock in stocks
        if _eligible_opportunity(stock, _plan_tuning(risk_profile, horizon), risk_profile, horizon)
    ]
    stock_quality = _average([float(item.get("score") or 50) for item in eligible_stocks[:6]], 42)
    index_quality = _average([float(item.get("score") or 50) for item in index_assets], 55)
    gold_trend = _average([_component_value(item, "Long-term trend") * 0.55 + _component_value(item, "Volatility fit") * 0.45 for item in gold_assets], 52)
    crypto_quality = _average([
        float(item.get("score") or 50) * 0.45
        + _component_value(item, "Long-term trend") * 0.25
        + _component_value(item, "Volatility fit") * 0.15
        + _component_value(item, "Recent return") * 0.15
        for item in crypto
    ], 35)
    stress_boost = 14 if regime["label"] == "Bearish" else 5 if regime["label"] == "Sideways" else -4
    broad_boost = 8 if regime["label"] == "Bullish" else 4 if regime["label"] == "Sideways" else -6
    stock_market_score = stock_quality * 0.65 + market_sentiment * 0.18 + regime["score"] * 0.17
    index_market_score = index_quality * 0.55 + regime["score"] * 0.35 + market_sentiment * 0.1 + broad_boost
    relative_growth_strength = max(stock_market_score, index_market_score)
    gold_market_score = gold_trend * 0.42 + (100 - regime["volatilityScore"]) * 0.24 + stress_boost + max(0, 68 - relative_growth_strength) * 0.22 + 34 * 0.12
    crypto_market_score = crypto_quality - (12 if regime["label"] == "Bearish" else 0)
    cash_market_score = 100 - max(stock_market_score, index_market_score, crypto_market_score)
    if regime["label"] == "Bearish":
        cash_market_score += 18
    if horizon == "short":
        cash_market_score += 12
    bucket_scores = {
        "stocks": _score_bucket("stocks", stock_market_score, _risk_adjusted_score(eligible_stocks[:8]), 58 if len({item.get("sector") or _sector_for_symbol(str(item.get("symbol", ""))) for item in eligible_stocks[:6]}) >= 4 else 46, risk_profile, horizon),
        "index": _score_bucket("index", index_market_score, _risk_adjusted_score(index_assets), 78, risk_profile, horizon),
        "gold": _score_bucket("gold", gold_market_score, gold_trend, 82 if regime["label"] != "Bullish" else 58, risk_profile, horizon),
        "highRisk": _score_bucket("highRisk", crypto_market_score, crypto_quality, 35, risk_profile, horizon),
        "cash": _score_bucket("cash", cash_market_score, 68 if regime["label"] == "Bearish" else 54, 72, risk_profile, horizon),
    }
    if risk_profile == "safe" or crypto_quality < 58:
        bucket_scores["highRisk"] = 0
    raw = {key: max(0, score) ** 1.35 for key, score in bucket_scores.items()}
    weights = _normalize_adaptive_weights(raw, risk_profile, horizon)
    caps = _bucket_caps(risk_profile, horizon)
    caps["max"]["gold"] = _gold_cap(regime, bucket_scores, stock_quality)
    weights = _rebalance_weight_caps(weights, caps)
    if risk_profile != "safe" and crypto_quality >= 60 and bucket_scores["highRisk"] >= 58:
        crypto_floor = 0.03 if risk_profile == "balanced" else 0.06
        if horizon == "short":
            crypto_floor *= 0.5
        crypto_cap = caps["max"]["highRisk"]
        target_crypto = min(crypto_cap, crypto_floor)
        if target_crypto > weights.get("highRisk", 0):
            extra = target_crypto - weights.get("highRisk", 0)
            weights["highRisk"] = target_crypto
            minimums = caps["min"]
            reducers = [
                key for key in ("stocks", "index", "gold", "cash")
                if weights.get(key, 0) > minimums.get(key, 0)
            ]
            reducer_total = sum(weights[key] - minimums.get(key, 0) for key in reducers) or 1
            for key in reducers:
                room = weights[key] - minimums.get(key, 0)
                weights[key] = max(minimums.get(key, 0), weights[key] - extra * (room / reducer_total))
            total_weight = sum(weights.values()) or 1
            weights = {key: value / total_weight for key, value in weights.items()}
    weights, override_summary, warnings, rebalance_explanation = _apply_allocation_overrides(
        weights,
        amount,
        currency,
        risk_profile,
        horizon,
        caps,
        allocation_overrides,
    )
    locked_override_kinds = {
        _override_kind(label)
        for label in (allocation_overrides or {}).keys()
        if _override_kind(label) is not None
    }
    buckets = []
    allocated = 0.0
    ordered = ["index", "stocks", "gold", "cash", "highRisk"]
    for index, kind in enumerate([kind for kind in ordered if weights.get(kind, 0) > 0]):
        amount_value = amount - allocated if index == len([k for k in ordered if weights.get(k, 0) > 0]) - 1 else _round_plan_amount(amount * weights[kind], currency)
        amount_value = max(0, amount_value)
        allocated += amount_value
        buckets.append({
            "amount": amount_value,
            "description": {
                "stocks": "Adaptive allocation to selected AI stock picks.",
                "index": "Adaptive broad-market Index / SIP exposure.",
                "gold": "Adaptive hedge and diversification sleeve.",
                "cash": "Active reserve for weak or risky opportunity sets.",
                "highRisk": "Adaptive high-risk crypto sleeve.",
            }[kind],
            "kind": kind,
            "lockedByUser": kind in locked_override_kinds,
            "reason": _bucket_reason(kind, bucket_scores[kind], regime, stock_quality),
            "score": round(bucket_scores[kind]),
            "suggestion": {
                "stocks": "Selected from today's AI-ranked scan.",
                "index": _index_suggestion(currency),
                "gold": "Gold ETF",
                "cash": "Hold as cash reserve.",
                "highRisk": "Bitcoin / Ethereum basket",
            }[kind],
            "title": {
                "stocks": "AI-Rated Stocks",
                "index": "Index / SIP",
                "gold": "Gold / ETF",
                "cash": "Cash Buffer",
                "highRisk": "High-Risk / Crypto",
            }[kind],
        })
    stock_bucket = next((bucket for bucket in buckets if bucket["kind"] == "stocks"), {"amount": 0})
    stock_allocation = _select_adaptive_stocks(stock_bucket["amount"], currency, final_stock_pool, risk_profile, horizon)
    if stock_bucket["amount"] and stock_allocation["investAmount"] < stock_bucket["amount"] and not stock_bucket.get("lockedByUser"):
        unused = stock_bucket["amount"] - stock_allocation["investAmount"]
        stock_bucket["amount"] = stock_allocation["investAmount"]
        index_share = _round_plan_amount(unused * _profile_stock_redirect(risk_profile, horizon), currency)
        cash_share = max(0, unused - index_share)
        index_bucket = next((bucket for bucket in buckets if bucket["kind"] == "index"), None)
        cash_bucket = next((bucket for bucket in buckets if bucket["kind"] == "cash"), None)
        if index_bucket and index_share > 0 and not index_bucket.get("lockedByUser"):
            index_bucket["amount"] += index_share
            index_bucket["reason"] = "Unused direct-stock capital moved into diversified Index/SIP because direct stock quality was not strong enough."
        elif index_share > 0 and cash_bucket and not cash_bucket.get("lockedByUser"):
            cash_bucket["amount"] += index_share
            cash_bucket["reason"] = "Unused direct-stock capital moved into cash because the edited Index/SIP allocation is locked."
        elif index_share > 0:
            cash_share += index_share
        if cash_bucket and not cash_bucket.get("lockedByUser"):
            cash_bucket["amount"] += cash_share
            cash_bucket["reason"] = f"MarketMind recommends holding {round((cash_bucket['amount'] / amount) * 100)}% cash because available opportunities do not sufficiently outperform cash today."
        elif cash_share > 0 and index_bucket and not index_bucket.get("lockedByUser"):
            index_bucket["amount"] += cash_share
            index_bucket["reason"] = "Unused direct-stock capital moved into diversified Index/SIP because your Cash allocation is locked."
        elif cash_share > 0:
            buckets.append({"amount": cash_share, "description": "Active reserve for weak or risky opportunity sets.", "kind": "cash", "reason": "MarketMind recommends holding cash because available opportunities do not sufficiently outperform cash today.", "score": round(bucket_scores["cash"]), "suggestion": "Hold as cash reserve.", "title": "Cash Buffer"})
    for bucket in buckets:
        if bucket["kind"] == "stocks":
            bucket["assets"] = [_stock_asset_payload(position, position["amount"], currency) for position in stock_allocation["positions"]]
            if bucket.get("lockedByUser") and bucket["amount"] > 0 and not bucket["assets"]:
                bucket["assets"] = [_unavailable_asset_payload("AI_STOCKS", "AI Stock Basket", bucket["amount"], currency, bucket["score"], "No qualifying direct stock setup cleared the current filters.")]
        elif bucket["kind"] == "index":
            bucket["assets"] = _allocate_generic_assets(bucket["amount"], currency, index_assets, bucket["reason"])
        elif bucket["kind"] == "gold":
            bucket["assets"] = _allocate_generic_assets(bucket["amount"], currency, gold_assets, bucket["reason"])
            if bucket["amount"] > 0 and not bucket["assets"]:
                symbol = "GOLDBEES.NS" if currency == "INR" else "GLD"
                name = "Nippon India Gold ETF" if currency == "INR" else "SPDR Gold Shares"
                bucket["assets"] = [_unavailable_asset_payload(symbol, name, bucket["amount"], currency, bucket["score"], bucket["reason"])]
        elif bucket["kind"] == "highRisk":
            crypto_assets = [asset for asset in crypto if float(asset.get("score") or 0) >= 58]
            bucket["assets"] = _allocate_generic_assets(bucket["amount"], currency, crypto_assets, bucket["reason"])
            if bucket["amount"] > 0 and not bucket["assets"]:
                bucket["amount"] = 0
        else:
            bucket["assets"] = [{
                "amount": bucket["amount"],
                "amountLabel": _format_plan_currency(bucket["amount"], currency),
                "current_price": None,
                "currentPrice": None,
                "expected_return": 0,
                "name": "Cash Reserve",
                "reason": bucket["reason"],
                "risk": "Low",
                "score": bucket["score"],
                "symbol": "CASH",
                "trend": "Stable",
            }]
    buckets = [bucket for bucket in buckets if bucket["amount"] > 0]
    total = sum(bucket["amount"] for bucket in buckets) or amount
    for bucket in buckets:
        bucket["amountLabel"] = _format_plan_currency(bucket["amount"], currency)
        bucket["percent"] = round((bucket["amount"] / total) * 100)
    cash_amount = next((bucket["amount"] for bucket in buckets if bucket["kind"] == "cash"), 0)
    crypto_bucket = next((bucket for bucket in buckets if bucket["kind"] == "highRisk"), None)
    crypto_allocations = {asset["symbol"]: asset["amount"] for asset in (crypto_bucket or {}).get("assets", [])}
    crypto_candidates = [
        _crypto_candidate_payload(asset, crypto_allocations.get(str(asset.get("symbol")), 0), currency, risk_profile, bucket_scores["highRisk"])
        for asset in crypto_candidates_source
    ]
    diversification_score = 58 if len({item.get("sector") or _sector_for_symbol(str(item.get("symbol", ""))) for item in eligible_stocks[:6]}) >= 4 else 46
    risk_adjustment = _risk_adjusted_score(eligible_stocks[:8])
    diagnostics = {
        "cashPressure": round(bucket_scores["cash"]),
        "diversificationScore": round(diversification_score),
        "marketRegime": regime["label"],
        "marketSentiment": market_sentiment_details["score"],
        "opportunityStrength": round(max(stock_quality, index_quality, crypto_quality)),
        "riskAdjustment": round(risk_adjustment),
    }
    return {
        "allocationDiagnostics": diagnostics,
        "bucketScores": bucket_scores,
        "buckets": buckets,
        "cashAmount": cash_amount,
        "cashReason": _bucket_reason("cash", bucket_scores["cash"], regime, stock_quality),
        "cryptoCandidates": crypto_candidates,
        "marketRegime": regime,
        "marketSentiment": market_sentiment_details,
        "planExplanation": _plan_explanation(bucket_scores, {bucket["kind"]: bucket["amount"] / total for bucket in buckets}, regime),
        "positions": stock_allocation["positions"],
        "rebalanceExplanation": rebalance_explanation,
        "sectorSentiment": {key: round(value) for key, value in sector_sentiment.items()},
        "overrideSummary": override_summary,
        "userOverridesApplied": bool(override_summary),
        "warnings": warnings,
    }


def _preference_note(risk_profile: str, horizon: str) -> str:
    risk_copy = {
        "aggressive": "Aggressive profile: lower cash, more positions, and more room for growth-oriented volatility.",
        "balanced": "Balanced profile: moderate cash, diversified buckets, and selective AI stock exposure.",
        "safe": "Safe profile: higher cash, fewer stock positions, and a stricter quality bar.",
    }
    horizon_copy = {
        "long": "Long term: favors trend quality and allows longer holding periods.",
        "medium": "Medium term: balances sentiment, trend, and risk/reward.",
        "short": "Short term: favors stronger sentiment, momentum, and lower volatility.",
    }
    return f"{risk_copy[risk_profile]} {horizon_copy[horizon]}"


def _policy_highlights(cash_amount: float, total_amount: float, tuning: dict[str, Any], horizon: str) -> list[str]:
    hold_focus = {"long": "Hold 12-24 months", "medium": "Hold 3-12 months", "short": "Hold 2-8 weeks"}
    return [
        f"Cash {round((cash_amount / total_amount) * 100)}%",
        f"Stock score {tuning['minimumScore']}+",
        f"Up to {tuning['maxPositions']} stocks",
        hold_focus[horizon],
    ]


KNOWN_STOCKS = [
    {
        "symbol": "AAPL",
        "name": "Apple Inc.",
        "aliases": ["apple", "apple inc", "iphone"],
    },
    {
        "symbol": "MSFT",
        "name": "Microsoft Corporation",
        "aliases": ["microsoft", "microsoft corp", "msft"],
    },
    {
        "symbol": "GOOGL",
        "name": "Alphabet Inc.",
        "aliases": ["google", "alphabet", "alphabet inc", "googl", "goog"],
    },
    {
        "symbol": "NVDA",
        "name": "NVIDIA Corporation",
        "aliases": ["nvidia", "nvda"],
    },
    {
        "symbol": "TSLA",
        "name": "Tesla, Inc.",
        "aliases": ["tesla", "tsla"],
    },
    {
        "symbol": "RELIANCE.NS",
        "name": "Reliance Industries Limited",
        "aliases": ["reliance", "reliance industries", "reliance industries limited"],
    },
    {
        "symbol": "TCS.NS",
        "name": "Tata Consultancy Services Limited",
        "aliases": ["tcs", "tata consultancy", "tata consultancy services"],
    },
    {
        "symbol": "INFY.NS",
        "name": "Infosys Limited",
        "aliases": ["infosys", "infy"],
    },
    {
        "symbol": "HDFCBANK.NS",
        "name": "HDFC Bank Limited",
        "aliases": ["hdfc bank", "hdfcbank"],
    },
    {
        "symbol": "ICICIBANK.NS",
        "name": "ICICI Bank Limited",
        "aliases": ["icici bank", "icicibank"],
    },
    {
        "symbol": "SBIN.NS",
        "name": "State Bank of India",
        "aliases": ["sbi", "sbin", "state bank", "state bank of india"],
    },
]


FALLBACK_STOCKS = [
    {
        "symbol": "ASIANPAINT.NS",
        "name": "Asian Paints Limited",
        "aliases": ["asian paints", "asianpaints"],
    },
    {
        "symbol": "ADANIENT.NS",
        "name": "Adani Enterprises Limited",
        "aliases": ["adani enterprises", "adani enterprise", "adanient"],
    },
    {
        "symbol": "ADANIPORTS.NS",
        "name": "Adani Ports and Special Economic Zone Limited",
        "aliases": ["adani ports", "adani port", "adaniports"],
    },
    {
        "symbol": "WIPRO.NS",
        "name": "Wipro Limited",
        "aliases": ["wipro"],
    },
    {
        "symbol": "ZOMATO.NS",
        "name": "Zomato Limited",
        "aliases": ["zomato"],
    },
    {
        "symbol": "SWIGGY.NS",
        "name": "Swiggy Limited",
        "aliases": ["swiggy"],
    },
    {
        "symbol": "BAJFINANCE.NS",
        "name": "Bajaj Finance Limited",
        "aliases": ["bajaj finance", "bajfinance"],
    },
    {
        "symbol": "AXISBANK.NS",
        "name": "Axis Bank Limited",
        "aliases": ["axis bank", "axisbank"],
    },
    {
        "symbol": "MARUTI.NS",
        "name": "Maruti Suzuki India Limited",
        "aliases": ["maruti", "maruti suzuki"],
    },
    {
        "symbol": "TATAMOTORS.NS",
        "name": "Tata Motors Limited",
        "aliases": ["tata motors", "tatamotors"],
    },
    {
        "symbol": "HCLTECH.NS",
        "name": "HCL Technologies Limited",
        "aliases": ["hcl tech", "hcl technologies", "hcltech"],
    },
    {
        "symbol": "ITC.NS",
        "name": "ITC Limited",
        "aliases": ["itc"],
    },
    {
        "symbol": "SUNPHARMA.NS",
        "name": "Sun Pharmaceutical Industries Limited",
        "aliases": ["sun pharma", "sun pharmaceutical", "sunpharma"],
    },
    {
        "symbol": "NESTLEIND.NS",
        "name": "Nestle India Limited",
        "aliases": ["nestle india", "nestleind"],
    },
    {
        "symbol": "BHARTIARTL.NS",
        "name": "Bharti Airtel Limited",
        "aliases": ["airtel", "bharti airtel", "bhartiartl"],
    },
    {
        "symbol": "HINDUNILVR.NS",
        "name": "Hindustan Unilever Limited",
        "aliases": ["hindustan unilever", "hul", "hindunilvr"],
    },
    {
        "symbol": "HDFCLIFE.NS",
        "name": "HDFC Life Insurance Company Limited",
        "aliases": ["hdfc life", "hdfclife"],
    },
    {
        "symbol": "AMZN",
        "name": "Amazon.com, Inc.",
        "aliases": ["amazon"],
    },
    {
        "symbol": "META",
        "name": "Meta Platforms, Inc.",
        "aliases": ["meta", "facebook"],
    },
    {
        "symbol": "NFLX",
        "name": "Netflix, Inc.",
        "aliases": ["netflix"],
    },
]


def _stock_universe() -> list[dict[str, Any]]:
    merged: dict[str, dict[str, Any]] = {}
    for stock in [*KNOWN_STOCKS, *FALLBACK_STOCKS]:
        symbol = stock["symbol"]
        if symbol in merged:
            merged[symbol]["aliases"] = sorted(
                set([*merged[symbol].get("aliases", []), *stock.get("aliases", [])])
            )
        else:
            merged[symbol] = {**stock}
    return list(merged.values())


def _normalize_search_text(value: str) -> str:
    """Make company-name searches tolerant of spacing and punctuation."""

    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", value.lower())).strip()


def _compact_search_text(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", value.lower())


def _normalize_ticker(value: str) -> str:
    return re.sub(r"\s+", "", value).upper()


def _market_for_symbol(symbol: str) -> str:
    return "NSE / India" if symbol.upper().endswith(".NS") else "US Market"


def _currency_for_symbol(symbol: str) -> str:
    return "INR" if symbol.upper().endswith(".NS") else "USD"


def _stock_payload(stock: dict[str, Any], query: str | None = None, source: str | None = None) -> dict[str, str]:
    payload = {
        "symbol": stock["symbol"],
        "name": stock["name"],
        "market": _market_for_symbol(stock["symbol"]),
    }
    if query is not None:
        payload["query"] = query
    if source is not None:
        payload["source"] = source
    return payload


def _ticker_payload(symbol: str, query: str, source: str = "exact_ticker") -> dict[str, str]:
    return {
        "query": query,
        "symbol": symbol,
        "name": symbol,
        "market": _market_for_symbol(symbol),
        "source": source,
    }


def _candidate_texts(stock: dict[str, Any]) -> list[str]:
    return [stock["symbol"], stock["symbol"].replace(".NS", ""), stock["name"], *stock.get("aliases", [])]


def _find_exact_ticker(query: str) -> dict[str, str] | None:
    ticker_query = _normalize_ticker(query)
    if not re.fullmatch(r"[A-Z]{1,12}(\.[A-Z]{1,4})?", ticker_query):
        return None

    for stock in _stock_universe():
        if ticker_query in {stock["symbol"], stock["symbol"].replace(".NS", "")}:
            return _stock_payload(stock, query=query, source="exact_ticker")

    if "." in ticker_query:
        return _ticker_payload(ticker_query, query)

    common_us_tickers = {"AAPL", "MSFT", "GOOGL", "GOOG", "NVDA", "TSLA", "AMZN", "META", "NFLX"}
    if ticker_query in common_us_tickers:
        return _ticker_payload(ticker_query, query)

    return None


def _resolve_alias_stock(query: str) -> dict[str, str] | None:
    normalized_query = _normalize_search_text(query)
    compact_query = _compact_search_text(query)

    if not normalized_query:
        return None

    for stock in KNOWN_STOCKS:
        candidates = _candidate_texts(stock)
        normalized_candidates = [_normalize_search_text(candidate) for candidate in candidates]
        compact_candidates = [_compact_search_text(candidate) for candidate in candidates]

        if normalized_query in normalized_candidates or compact_query in compact_candidates:
            return _stock_payload(stock, query=query, source="alias")

    return None


def _search_stock_universe(query: str) -> list[dict[str, str]]:
    normalized_query = _normalize_search_text(query)
    compact_query = _compact_search_text(query)
    matches: list[dict[str, str]] = []

    if len(compact_query) < 3:
        return matches

    for stock in _stock_universe():
        candidates = _candidate_texts(stock)
        normalized_candidates = [_normalize_search_text(candidate) for candidate in candidates]
        compact_candidates = [_compact_search_text(candidate) for candidate in candidates]

        strong_match = any(
            candidate.startswith(normalized_query) or compact_candidate.startswith(compact_query)
            for candidate, compact_candidate in zip(normalized_candidates, compact_candidates)
        )
        loose_match = any(
            normalized_query in candidate or compact_query in compact_candidate
            for candidate, compact_candidate in zip(normalized_candidates, compact_candidates)
        )

        if strong_match or loose_match:
            matches.append(_stock_payload(stock))

    return matches[:8]


def _search_yfinance(query: str) -> list[dict[str, str]]:
    """Best-effort Yahoo search. yfinance versions differ, so this is optional."""

    try:
        search_cls = getattr(yf, "Search", None)
        if search_cls is None:
            return []
        search = search_cls(query, max_results=8)
        quotes = getattr(search, "quotes", []) or []
    except Exception:
        logger.exception("Dynamic yfinance search failed for %s", query)
        return []

    matches: list[dict[str, str]] = []
    for quote in quotes:
        symbol = str(quote.get("symbol", "")).upper().strip()
        name = quote.get("longname") or quote.get("shortname") or symbol
        quote_type = str(quote.get("quoteType", "")).lower()
        if not symbol or quote_type not in {"equity", "etf", ""}:
            continue
        matches.append(
            {
                "symbol": symbol,
                "name": str(name),
                "market": _market_for_symbol(symbol),
            }
        )
    return matches[:6]


def _dedupe_matches(matches: list[dict[str, str]]) -> list[dict[str, str]]:
    deduped: dict[str, dict[str, str]] = {}
    for match in matches:
        deduped.setdefault(match["symbol"], match)
    return list(deduped.values())


def _resolve_stock_search(query: str) -> dict[str, Any] | None:
    exact_ticker = _find_exact_ticker(query)
    if exact_ticker:
        return exact_ticker

    alias_match = _resolve_alias_stock(query)
    if alias_match:
        return alias_match

    universe_matches = _search_stock_universe(query)
    if len(universe_matches) == 1:
        return {**universe_matches[0], "query": query, "source": "dynamic_lookup"}

    if len(universe_matches) > 1:
        return {
            "query": query,
            "matches": universe_matches,
            "message": "Multiple matches found. Please choose one.",
        }

    dynamic_matches = _search_yfinance(query)
    matches = _dedupe_matches(dynamic_matches)

    if len(matches) == 1:
        return {**matches[0], "query": query, "source": "dynamic_lookup"}

    if len(matches) > 1:
        return {
            "query": query,
            "matches": matches,
            "message": "Multiple matches found. Please choose one.",
        }

    return None


def _safe_info_value(info: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        value = info.get(key)
        if value not in (None, "", "None"):
            return value
    return None


@app.get("/")
def root() -> dict[str, str]:
    """Confirm that the API server is online."""
    return {"message": "MarketMind AI backend running"}


@app.get("/debug/env")
def debug_env() -> dict[str, str | bool]:
    """Return safe environment diagnostics without exposing full API keys."""

    return get_debug_env_info()


@app.get("/resolve/{query}")
def resolve_stock_symbol(query: str) -> dict[str, Any]:
    """
    Resolve beginner-friendly company names or ticker text into a stock symbol.

    This intentionally favors a small known list for safe partial matching, then
    passes ticker-shaped input through after normalizing case and spacing.
    """

    resolved = _resolve_stock_search(query)

    if not resolved:
        return {
            "error": "Could not find that company. Try a company name like Apple, Reliance, Asian Paints, or ticker like AAPL / RELIANCE.NS."
        }

    return resolved


@app.get("/profile/{symbol}")
def get_company_profile(symbol: str) -> dict[str, Any]:
    """Return beginner-friendly company context from yfinance when available."""

    clean_symbol = symbol.strip().upper()

    if not clean_symbol:
        raise HTTPException(status_code=422, detail="Stock symbol is required.")

    info: dict[str, Any] = {}
    try:
        stock = yf.Ticker(clean_symbol)
        fetched_info = stock.info
        if isinstance(fetched_info, dict):
            info = fetched_info
    except Exception:
        logger.exception("Failed to fetch company profile for %s", clean_symbol)

    known_match = next((stock for stock in KNOWN_STOCKS if stock["symbol"] == clean_symbol), None)
    name = _safe_info_value(info, "longName", "shortName", "displayName") or (
        known_match["name"] if known_match else clean_symbol
    )

    return {
        "symbol": clean_symbol,
        "name": name,
        "sector": _safe_info_value(info, "sector") or "Not available",
        "industry": _safe_info_value(info, "industry") or "Not available",
        "market": _market_for_symbol(clean_symbol),
        "currency": _safe_info_value(info, "currency") or _currency_for_symbol(clean_symbol),
        "website": _safe_info_value(info, "website"),
        "summary": _safe_info_value(info, "longBusinessSummary") or "Company summary is not available yet.",
        "market_cap": _safe_info_value(info, "marketCap"),
    }


@app.get("/stock/{symbol}")
def get_stock_data(symbol: str) -> dict[str, Any]:
    """
    Fetch 6 months of stock data from Yahoo Finance.

    Symbols can be US tickers such as AAPL or Indian NSE tickers such as
    RELIANCE.NS. Invalid or empty results return a friendly error payload.
    """
    clean_symbol = symbol.strip().upper()

    if not clean_symbol:
        return {"error": "No stock data found"}

    try:
        stock = yf.Ticker(clean_symbol)
        history = stock.history(period="6mo", interval="1d", auto_adjust=False)
    except Exception:
        logger.exception("Failed to fetch stock data for %s", clean_symbol)
        return {"error": "No stock data found"}

    if history.empty:
        return {"error": "No stock data found"}

    history = history.dropna(subset=["Close"])

    if history.empty:
        return {"error": "No stock data found"}

    latest_row = history.iloc[-1]
    recent_history = history.tail(30)

    return {
        "symbol": clean_symbol,
        "latest_close": _to_float(latest_row["Close"]),
        "open": _to_float(latest_row["Open"]),
        "high": _to_float(latest_row["High"]),
        "low": _to_float(latest_row["Low"]),
        "volume": _to_int(latest_row["Volume"]),
        "history": [
            {
                "date": index.strftime("%Y-%m-%d"),
                "close": _to_float(row["Close"]),
                "volume": _to_int(row["Volume"]),
            }
            for index, row in recent_history.iterrows()
        ],
    }


@app.get("/predict/{symbol}")
def predict_stock(symbol: str) -> dict[str, str | float]:
    """
    Return a Transformer AI recommendation for a stock symbol.

    The API only performs inference. It loads the global model checkpoint first,
    falls back to the original checkpoint if needed, and never retrains inside a request.
    """

    try:
        return predict_stock_symbol(symbol)
    except ModelFileMissingError as exc:
        logger.exception("Transformer model file is missing")
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except InvalidSymbolError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except InsufficientHistoricalDataError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except PredictionServiceError as exc:
        logger.exception("Prediction service failed for %s", symbol)
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Unexpected prediction failure for %s", symbol)
        raise HTTPException(status_code=500, detail="Prediction failed") from exc


@app.get("/sentiment/{symbol}")
def analyze_sentiment(symbol: str) -> dict[str, Any]:
    """
    Return FinBERT finance-news sentiment for a stock symbol.

    The ML module uses region-specific real news providers and skips sentiment
    scoring when no headlines are available.
    """

    try:
        return get_stock_sentiment(symbol)
    except SentimentServiceError as exc:
        raise HTTPException(status_code=500, detail=f"Sentiment analysis failed: {exc}") from exc


@app.get("/analysis/{symbol}")
def analyze_stock_decision(symbol: str) -> dict[str, Any]:
    """
    Return the final MarketMind AI stock decision.

    This endpoint combines Transformer price prediction, FinBERT sentiment,
    risk logic, and suggested allocation. It performs inference only and never
    retrains either model.
    """

    try:
        return analyze_stock(symbol)
    except AnalysisServiceError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Unexpected final analysis failure for %s", symbol)
        raise HTTPException(status_code=500, detail="Final analysis failed") from exc


@app.post("/invest-plan")
def create_invest_plan(payload: InvestPlanRequest) -> dict[str, Any]:
    """
    Build a staged personal investment plan.

    Stage 1 does a cached lightweight scan across the full candidate universe.
    Stage 2 runs full MarketMind analysis and cached backtests only for the
    strongest shortlist, so one slow ticker cannot block the whole plan.
    """

    amount = float(payload.amount)
    currency = payload.currency
    risk_profile = _normalize_profile(payload.riskProfile or payload.risk, "risk profile")
    horizon = _normalize_profile(payload.horizon, "horizon")
    progress = [
        f"Scanning market across {len(INVEST_PLAN_UNIVERSE)} assets...",
        "Shortlisting best setups...",
        "Building your plan...",
    ]
    fast_results, failed_count = _fast_scan_universe(INVEST_PLAN_UNIVERSE)

    if not fast_results:
        raise HTTPException(status_code=503, detail="Unable to scan opportunities right now.")

    fast_ranked = sorted(
        fast_results,
        key=lambda item: _selection_score(item, risk_profile, horizon),
        reverse=True,
    )
    fast_shortlist = fast_ranked[:FAST_SHORTLIST_SIZE]
    stock_shortlist = [item for item in fast_shortlist if item.get("assetType") == "stock"]
    deep_count = 10 if risk_profile == "safe" else DEEP_SHORTLIST_SIZE if risk_profile == "balanced" else min(20, DEEP_SHORTLIST_SIZE + 4)
    deep_candidates = stock_shortlist[:deep_count]
    deep_results: list[dict[str, Any]] = []
    deep_futures = {
        _PLAN_EXECUTOR.submit(_deep_analyze_stock, candidate, horizon, currency): candidate
        for candidate in deep_candidates
    }
    deadline = time.monotonic() + DEEP_ANALYSIS_TIMEOUT_SECONDS
    try:
        for future in as_completed(deep_futures, timeout=DEEP_ANALYSIS_TIMEOUT_SECONDS):
            try:
                deep_results.append(future.result(timeout=max(0.1, deadline - time.monotonic())))
            except Exception:
                failed_count += 1
                logger.exception("Deep analysis failed for %s", deep_futures[future]["symbol"])
    except FuturesTimeoutError:
        failed_count += sum(1 for future in deep_futures if not future.done())

    ranked = sorted(
        [*deep_results, *[item for item in fast_shortlist if item["symbol"] not in {deep["symbol"] for deep in deep_results}]],
        key=lambda item: _selection_score(item, risk_profile, horizon),
        reverse=True,
    )
    final_stock_pool = deep_results if len(deep_results) >= 3 else ranked
    adaptive_plan = _adaptive_investment_plan(
        amount,
        currency,
        risk_profile,
        horizon,
        ranked,
        final_stock_pool,
        payload.allocationOverrides,
    )
    final_buckets = adaptive_plan["buckets"]
    cash_amount = adaptive_plan["cashAmount"]
    invest_amount = amount - cash_amount
    tuning = _plan_tuning(risk_profile, horizon)

    return {
        "allocationDiagnostics": adaptive_plan["allocationDiagnostics"],
        "bucketScores": {key: round(value) for key, value in adaptive_plan["bucketScores"].items()},
        "buckets": final_buckets,
        "cachePolicy": {
            "backtestSeconds": TTL_BACKTEST_SECONDS,
            "fastScanSeconds": TTL_FAST_SCAN_SECONDS,
            "pricePredictionSeconds": TTL_PRICE_PREDICTION_SECONDS,
            "sentimentSeconds": TTL_SENTIMENT_SECONDS,
        },
        "cashAmount": cash_amount,
        "cashAmountLabel": _format_plan_currency(cash_amount, currency),
        "cashReason": adaptive_plan["cashReason"],
        "cryptoCandidates": adaptive_plan["cryptoCandidates"],
        "currency": currency,
        "failedCount": failed_count,
        "horizon": horizon,
        "investAmount": invest_amount,
        "investAmountLabel": _format_plan_currency(invest_amount, currency),
        "marketRegime": adaptive_plan["marketRegime"],
        "marketSentiment": adaptive_plan["marketSentiment"],
        "overrideSummary": adaptive_plan["overrideSummary"],
        "planExplanation": adaptive_plan["planExplanation"],
        "policyHighlights": _policy_highlights(cash_amount, amount, tuning, horizon),
        "positions": adaptive_plan["positions"],
        "preferenceNote": _preference_note(risk_profile, horizon),
        "progress": progress,
        "ranked": ranked,
        "riskProfile": risk_profile,
        "scannedCount": len(fast_results),
        "sectorSentiment": adaptive_plan["sectorSentiment"],
        "rebalanceExplanation": adaptive_plan["rebalanceExplanation"],
        "shortlistCount": len(fast_shortlist),
        "deepAnalyzedCount": len(deep_results),
        "userOverridesApplied": adaptive_plan["userOverridesApplied"],
        "universeCount": len(INVEST_PLAN_UNIVERSE),
        "warnings": adaptive_plan["warnings"],
    }


@app.get("/backtest/{symbol}")
def backtest_stock(symbol: str) -> dict[str, Any]:
    """
    Backtest the historical MarketMind AI recommendation strategy.

    This endpoint evaluates the saved Transformer model on past daily windows
    and simulates a simple long/cash strategy. It never retrains the model.
    """

    try:
        return run_backtest(symbol)
    except BacktestServiceError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Unexpected backtest failure for %s", symbol)
        raise HTTPException(status_code=500, detail="Backtest failed") from exc
