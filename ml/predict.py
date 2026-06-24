from __future__ import annotations

import argparse
from pathlib import Path

import torch

from features import FEATURE_COLUMNS, LABEL_TO_NAME, add_technical_indicators, scaler_from_state, transform_features
from model import StockTransformerClassifier
from utils import download_stock_history, get_device


MODEL_DIR = Path(__file__).resolve().parent / "models"
GLOBAL_MODEL_PATH = MODEL_DIR / "transformer_stock_model_global.pth"
LEGACY_MODEL_PATH = MODEL_DIR / "transformer_stock_model.pth"


def default_model_path() -> Path:
    """Prefer the global model, then fall back to the original US-only model."""

    return GLOBAL_MODEL_PATH if GLOBAL_MODEL_PATH.exists() else LEGACY_MODEL_PATH


def load_model(checkpoint_path: Path, device: torch.device) -> tuple[StockTransformerClassifier, dict]:
    """Load the trained Transformer and its preprocessing metadata."""

    if not checkpoint_path.exists():
        raise FileNotFoundError(f"Model not found at {checkpoint_path}. Run python train.py first.")

    checkpoint = torch.load(checkpoint_path, map_location=device)
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
    return model, checkpoint


def predict_ticker(ticker: str, period: str = "2y") -> tuple[str, float]:
    """Predict BUY/HOLD/AVOID and confidence for a ticker symbol."""

    device = get_device()
    model, checkpoint = load_model(default_model_path(), device)
    sequence_length = int(checkpoint["sequence_length"])
    scaler = scaler_from_state(checkpoint["scaler"])
    feature_columns = checkpoint.get("feature_columns", FEATURE_COLUMNS)

    raw_df = download_stock_history(ticker.upper(), period=period)
    feature_df = add_technical_indicators(raw_df, ticker=ticker)

    if len(feature_df) < sequence_length:
        raise ValueError(
            f"{ticker.upper()} has only {len(feature_df)} clean rows; "
            f"{sequence_length} are required for prediction."
        )

    scaled_features = transform_features(feature_df, scaler, feature_columns=feature_columns)
    latest_sequence = scaled_features[-sequence_length:]

    # Add a batch dimension so the tensor shape becomes [1, 60, features].
    input_tensor = torch.tensor(latest_sequence, dtype=torch.float32).unsqueeze(0).to(device)

    with torch.no_grad():
        logits = model(input_tensor)
        probabilities = torch.softmax(logits, dim=1).squeeze(0)

    class_index = int(torch.argmax(probabilities).item())
    confidence = float(probabilities[class_index].item())
    return LABEL_TO_NAME[class_index], confidence


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Predict a MarketMind AI stock recommendation.")
    parser.add_argument("ticker", type=str, help="Ticker symbol, for example AAPL or NVDA.")
    parser.add_argument("--period", type=str, default="2y", help="Historical period to download for prediction.")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    recommendation, confidence = predict_ticker(args.ticker, period=args.period)
    print(f"Ticker: {args.ticker.upper()}")
    print(f"Recommendation: {recommendation}")
    print(f"Confidence: {confidence:.2%}")
