from __future__ import annotations

import logging
import sys
from functools import lru_cache
from pathlib import Path

import torch
import yfinance as yf


logger = logging.getLogger("marketmind-api")

PROJECT_ROOT = Path(__file__).resolve().parents[1]
ML_DIR = PROJECT_ROOT / "ml"
GLOBAL_MODEL_PATH = ML_DIR / "models" / "transformer_stock_model_global.pth"
LEGACY_MODEL_PATH = ML_DIR / "models" / "transformer_stock_model.pth"

# backend/main.py is run from the backend folder, while the Transformer code
# lives in ../ml. Adding the absolute ml path makes imports reliable after the
# project move to C:\Projects\SPWA.
if str(ML_DIR) not in sys.path:
    sys.path.insert(0, str(ML_DIR))

from features import LABEL_TO_NAME, add_technical_indicators, scaler_from_state, transform_features  # noqa: E402
from model import StockTransformerClassifier  # noqa: E402
from utils import get_device  # noqa: E402


class PredictionServiceError(Exception):
    """Base error for expected prediction failures."""


class ModelFileMissingError(PredictionServiceError):
    """Raised when the trained Transformer checkpoint is missing."""


class InvalidSymbolError(PredictionServiceError):
    """Raised when Yahoo Finance cannot return data for the requested symbol."""


class InsufficientHistoricalDataError(PredictionServiceError):
    """Raised when there are fewer clean rows than the model sequence length."""


def _risk_level(recommendation: str, confidence: float) -> str:
    """Convert model output into the product risk language."""

    if recommendation == "BUY" and confidence > 70:
        return "Medium"
    if recommendation == "BUY":
        return "High"
    if recommendation == "HOLD":
        return "Medium"
    return "High"


def _reason(recommendation: str) -> str:
    """Explain the recommendation in a stable, frontend-friendly sentence."""

    reasons = {
        "BUY": "Transformer model detects positive short-term price momentum.",
        "HOLD": "Transformer model predicts neutral or uncertain short-term movement.",
        "AVOID": "Transformer model detects possible downside risk.",
    }
    return reasons[recommendation]


def _default_model_path() -> Path:
    """Prefer the global model, then fall back to the original model."""

    return GLOBAL_MODEL_PATH if GLOBAL_MODEL_PATH.exists() else LEGACY_MODEL_PATH


@lru_cache(maxsize=1)
def _load_transformer_for_inference() -> tuple[StockTransformerClassifier, dict, torch.device]:
    """Load the saved Transformer checkpoint once and reuse it for inference."""

    model_path = _default_model_path()

    if not model_path.exists():
        raise ModelFileMissingError(f"Model file not found at {model_path}")

    device = get_device()
    checkpoint = torch.load(model_path, map_location=device)
    config = checkpoint["model_config"]

    model = StockTransformerClassifier(
        num_features=config["num_features"],
        sequence_length=config["sequence_length"],
        d_model=config["d_model"],
        num_heads=config["num_heads"],
        num_layers=config["num_layers"],
        dropout=config["dropout"],
    ).to(device)

    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()
    logger.info("Loaded Transformer stock model from %s on %s", model_path, device)
    return model, checkpoint, device


def _download_recent_history(symbol: str):
    """Fetch enough recent daily data for 60-day Transformer inference."""

    try:
        stock = yf.Ticker(symbol)
        history = stock.history(period="2y", interval="1d", auto_adjust=False)
    except Exception as exc:
        raise InvalidSymbolError(f"Unable to fetch stock data for {symbol}") from exc

    if history.empty:
        raise InvalidSymbolError(f"No stock data found for {symbol}")

    return history


def predict_stock_symbol(symbol: str) -> dict[str, str | float]:
    """Run saved Transformer inference for one stock symbol.

    This function does not train or update the model. It only loads the saved
    checkpoint, builds the same features used during training, and returns the
    latest BUY/HOLD/AVOID recommendation.
    """

    clean_symbol = symbol.strip().upper()
    if not clean_symbol:
        raise InvalidSymbolError("Stock symbol is required")

    model, checkpoint, device = _load_transformer_for_inference()
    sequence_length = int(checkpoint["sequence_length"])
    scaler = scaler_from_state(checkpoint["scaler"])
    feature_columns = checkpoint.get("feature_columns")

    history = _download_recent_history(clean_symbol)
    feature_df = add_technical_indicators(history, ticker=clean_symbol)

    if len(feature_df) < sequence_length:
        raise InsufficientHistoricalDataError(
            f"{clean_symbol} has {len(feature_df)} clean rows; {sequence_length} are required."
        )

    scaled_features = transform_features(feature_df, scaler, feature_columns=feature_columns)
    latest_sequence = scaled_features[-sequence_length:]
    input_tensor = torch.tensor(latest_sequence, dtype=torch.float32).unsqueeze(0).to(device)

    with torch.no_grad():
        logits = model(input_tensor)
        probabilities = torch.softmax(logits, dim=1).squeeze(0)

    class_index = int(torch.argmax(probabilities).item())
    recommendation = LABEL_TO_NAME[class_index]
    confidence = round(float(probabilities[class_index].item()) * 100, 2)

    return {
        "symbol": clean_symbol,
        "recommendation": recommendation,
        "confidence": confidence,
        "risk_level": _risk_level(recommendation, confidence),
        "reason": _reason(recommendation),
    }
