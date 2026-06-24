from __future__ import annotations

import random
from pathlib import Path

import numpy as np
import pandas as pd
import torch
import yfinance as yf


def get_device() -> torch.device:
    """Automatically choose CUDA when it is available."""

    return torch.device("cuda" if torch.cuda.is_available() else "cpu")


def print_gpu_report() -> None:
    """Print the CUDA information requested in the training logs."""

    print(f"torch.cuda.is_available(): {torch.cuda.is_available()}")
    if torch.cuda.is_available():
        device_index = torch.cuda.current_device()
        print(f"GPU name: {torch.cuda.get_device_name(device_index)}")
        print(f"CUDA version used by PyTorch: {torch.version.cuda}")
    else:
        print("GPU name: CUDA device not available; training will run on CPU.")


def set_random_seed(seed: int = 42) -> None:
    """Make training more repeatable across runs."""

    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


def ensure_directory(path: Path) -> None:
    """Create a directory if it does not already exist."""

    path.mkdir(parents=True, exist_ok=True)


def download_stock_history(ticker: str, period: str = "5y") -> pd.DataFrame:
    """Download daily OHLCV data from Yahoo Finance."""

    print(f"Downloading {ticker} history from yfinance...")
    df = yf.download(
        ticker,
        period=period,
        interval="1d",
        auto_adjust=False,
        progress=False,
        threads=False,
    )

    if df.empty:
        raise ValueError(f"No yfinance data returned for ticker '{ticker}'.")
    return df


def parse_tickers(raw_tickers: str) -> list[str]:
    """Parse comma-separated CLI ticker input."""

    return [ticker.strip().upper() for ticker in raw_tickers.split(",") if ticker.strip()]
