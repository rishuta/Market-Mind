from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from ta.momentum import RSIIndicator
from ta.trend import MACD, SMAIndicator


# Keep the feature order in one place. The Transformer expects every training
# and prediction sequence to use this exact column order.
FEATURE_COLUMNS = [
    "Close",
    "Volume",
    "SMA_10",
    "SMA_20",
    "RSI",
    "MACD",
    "Daily_Return",
    "Volatility",
    "Market_Region",
]

LEGACY_FEATURE_COLUMNS = [column for column in FEATURE_COLUMNS if column != "Market_Region"]

MARKET_REGION_TO_ID = {
    "US": 0,
    "India": 1,
    "Europe": 2,
    "UAE": 3,
}

EUROPE_SUFFIXES = (".AS", ".DE", ".L", ".PA")
UAE_SUFFIXES = (".AE", ".AD")

# The model predicts one of these classes:
# 0 = AVOID, 1 = HOLD, 2 = BUY.
LABEL_TO_NAME = {0: "AVOID", 1: "HOLD", 2: "BUY"}
NAME_TO_LABEL = {name: label for label, name in LABEL_TO_NAME.items()}


@dataclass(frozen=True)
class ScalerState:
    """Small, torch-save-friendly representation of a fitted StandardScaler."""

    mean: list[float]
    scale: list[float]


def _flatten_yfinance_columns(df: pd.DataFrame) -> pd.DataFrame:
    """yfinance sometimes returns MultiIndex columns; flatten them if needed."""

    if isinstance(df.columns, pd.MultiIndex):
        # For a single ticker download, the price field is usually one level of
        # the MultiIndex. Pick the known OHLCV field from each tuple so this is
        # robust whether yfinance returns (field, ticker) or (ticker, field).
        price_fields = {"Open", "High", "Low", "Close", "Adj Close", "Volume"}
        df = df.copy()
        df.columns = [next((part for part in column if part in price_fields), column[0]) for column in df.columns]
    return df


def market_region_name(ticker: str) -> str:
    """Map a ticker symbol to the broad market region used by the model."""

    clean_ticker = ticker.strip().upper()

    if clean_ticker.endswith(".NS"):
        return "India"
    if clean_ticker.endswith(EUROPE_SUFFIXES):
        return "Europe"
    if clean_ticker.endswith(UAE_SUFFIXES):
        return "UAE"
    return "US"


def market_region_id(ticker: str) -> int:
    """Return the numeric market identity feature for a ticker."""

    return MARKET_REGION_TO_ID[market_region_name(ticker)]


def add_technical_indicators(raw_df: pd.DataFrame, ticker: str = "") -> pd.DataFrame:
    """Create all model features from raw OHLCV market data.

    The model only uses values that would be known at the close of each day:
    close price, volume, moving averages, momentum indicators, daily return,
    and rolling volatility.
    """

    df = _flatten_yfinance_columns(raw_df).copy()

    required_columns = {"Close", "Volume"}
    missing_columns = required_columns.difference(df.columns)
    if missing_columns:
        raise ValueError(f"Missing required market data columns: {sorted(missing_columns)}")

    close = df["Close"].astype(float)
    volume = df["Volume"].astype(float)

    df["Close"] = close
    df["Volume"] = volume
    df["SMA_10"] = SMAIndicator(close=close, window=10).sma_indicator()
    df["SMA_20"] = SMAIndicator(close=close, window=20).sma_indicator()
    df["RSI"] = RSIIndicator(close=close, window=14).rsi()
    df["MACD"] = MACD(close=close).macd()
    df["Daily_Return"] = close.pct_change()
    df["Market_Region"] = market_region_id(ticker)

    # Volatility is the rolling standard deviation of daily returns. A 20-day
    # window roughly maps to one trading month.
    df["Volatility"] = df["Daily_Return"].rolling(window=20).std()

    # Technical indicators create NaN values at the beginning of the series.
    # Dropping them gives the model clean numeric sequences.
    return df.dropna(subset=FEATURE_COLUMNS).copy()


def add_future_return_labels(
    feature_df: pd.DataFrame,
    prediction_horizon_days: int = 5,
    buy_threshold: float = 0.02,
    avoid_threshold: float = -0.02,
) -> pd.DataFrame:
    """Add BUY/HOLD/AVOID labels from future returns.

    BUY   -> future return greater than +2%
    HOLD  -> future return between -2% and +2%
    AVOID -> future return below -2%

    The default horizon is five trading days, so the label asks: "what happened
    about one market week after this sequence ended?"
    """

    df = feature_df.copy()
    future_close = df["Close"].shift(-prediction_horizon_days)
    df["Future_Return"] = (future_close / df["Close"]) - 1.0

    df["Label"] = NAME_TO_LABEL["HOLD"]
    df.loc[df["Future_Return"] > buy_threshold, "Label"] = NAME_TO_LABEL["BUY"]
    df.loc[df["Future_Return"] < avoid_threshold, "Label"] = NAME_TO_LABEL["AVOID"]

    # The last horizon rows do not have known future prices, so they cannot be
    # used for supervised training.
    return df.dropna(subset=["Future_Return", "Label"]).copy()


def fit_feature_scaler(df: pd.DataFrame, feature_columns: list[str] | None = None) -> StandardScaler:
    """Fit a StandardScaler on the training feature columns."""

    columns = feature_columns or FEATURE_COLUMNS
    scaler = StandardScaler()
    scaler.fit(df[columns].to_numpy(dtype=np.float32))
    return scaler


def transform_features(
    df: pd.DataFrame,
    scaler: StandardScaler,
    feature_columns: list[str] | None = None,
) -> np.ndarray:
    """Normalize model features with a fitted StandardScaler."""

    columns = feature_columns or FEATURE_COLUMNS
    return scaler.transform(df[columns].to_numpy(dtype=np.float32)).astype(np.float32)


def scaler_to_state(scaler: StandardScaler) -> ScalerState:
    """Convert a fitted scaler into plain lists for checkpoint storage."""

    return ScalerState(mean=scaler.mean_.astype(float).tolist(), scale=scaler.scale_.astype(float).tolist())


def scaler_from_state(state: dict | ScalerState) -> StandardScaler:
    """Rebuild a StandardScaler from checkpoint metadata."""

    if isinstance(state, ScalerState):
        mean = state.mean
        scale = state.scale
    else:
        mean = state["mean"]
        scale = state["scale"]

    scaler = StandardScaler()
    scaler.mean_ = np.asarray(mean, dtype=np.float64)
    scaler.scale_ = np.asarray(scale, dtype=np.float64)
    scaler.var_ = scaler.scale_**2
    scaler.n_features_in_ = len(scaler.mean_)
    return scaler


def build_sequences(
    scaled_features: np.ndarray,
    labels: np.ndarray,
    sequence_length: int = 60,
) -> tuple[np.ndarray, np.ndarray]:
    """Convert daily rows into rolling 60-day Transformer sequences."""

    sequences: list[np.ndarray] = []
    sequence_labels: list[int] = []

    # Each sample contains the previous 60 trading days. The label comes from
    # the final day in that sequence.
    for end_index in range(sequence_length, len(scaled_features) + 1):
        start_index = end_index - sequence_length
        sequences.append(scaled_features[start_index:end_index])
        sequence_labels.append(int(labels[end_index - 1]))

    return np.asarray(sequences, dtype=np.float32), np.asarray(sequence_labels, dtype=np.int64)
