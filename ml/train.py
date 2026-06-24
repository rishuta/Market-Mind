from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import pandas as pd
import torch
from sklearn.model_selection import train_test_split
from torch import nn
from torch.utils.data import DataLoader, TensorDataset

from features import (
    FEATURE_COLUMNS,
    add_future_return_labels,
    add_technical_indicators,
    build_sequences,
    fit_feature_scaler,
    market_region_name,
    scaler_to_state,
    transform_features,
)
from model import StockTransformerClassifier
from utils import download_stock_history, ensure_directory, get_device, parse_tickers, print_gpu_report, set_random_seed


MODEL_DIR = Path(__file__).resolve().parent / "models"
MODEL_PATH = MODEL_DIR / "transformer_stock_model_global.pth"

US_TICKERS = [
    "AAPL",
    "MSFT",
    "NVDA",
    "AMZN",
    "GOOGL",
    "META",
    "TSLA",
    "JPM",
    "UNH",
    "XOM",
]

INDIA_TICKERS = [
    "RELIANCE.NS",
    "TCS.NS",
    "INFY.NS",
    "HDFCBANK.NS",
    "ICICIBANK.NS",
    "SBIN.NS",
    "LT.NS",
    "ITC.NS",
    "BHARTIARTL.NS",
    "MARUTI.NS",
]

EUROPE_TICKERS = [
    "ASML.AS",
    "SAP.DE",
    "SIE.DE",
    "SHEL.L",
    "AZN.L",
    "MC.PA",
    "OR.PA",
    "AIR.PA",
]

UAE_TICKERS = [
    "EMAAR.AE",
    "DEWA.AE",
    "FAB.AD",
    "ADCB.AD",
    "TAQA.AD",
]

MARKET_TICKERS = {
    "US": US_TICKERS,
    "India": INDIA_TICKERS,
    "Europe": EUROPE_TICKERS,
    "UAE": UAE_TICKERS,
}

DEFAULT_TICKERS = [ticker for tickers in MARKET_TICKERS.values() for ticker in tickers]


def build_dataset_for_ticker(
    ticker: str,
    scaler=None,
    sequence_length: int = 60,
    prediction_horizon_days: int = 5,
) -> tuple[np.ndarray, np.ndarray, object]:
    """Download one ticker and turn it into normalized 60-day samples."""

    raw_df = download_stock_history(ticker)
    feature_df = add_technical_indicators(raw_df, ticker=ticker)
    labeled_df = add_future_return_labels(feature_df, prediction_horizon_days=prediction_horizon_days)

    if len(labeled_df) < sequence_length:
        raise ValueError(f"{ticker} does not have enough clean rows for {sequence_length}-day sequences.")

    # Fit the scaler on this ticker only when no global scaler has been provided.
    if scaler is None:
        scaler = fit_feature_scaler(labeled_df)

    scaled_features = transform_features(labeled_df, scaler)
    labels = labeled_df["Label"].to_numpy(dtype=np.int64)
    sequences, sequence_labels = build_sequences(scaled_features, labels, sequence_length=sequence_length)
    return sequences, sequence_labels, scaler


def build_multi_stock_dataset(
    tickers: list[str],
    sequence_length: int,
    prediction_horizon_days: int,
) -> tuple[np.ndarray, np.ndarray, object, dict[str, object]]:
    """Build one training dataset from several stocks.

    We first download and label all stocks, then fit one shared scaler across
    every row. This makes the model see a consistent feature scale.
    """

    prepared_frames = []
    failed_tickers: list[dict[str, str]] = []
    for ticker in tickers:
        try:
            raw_df = download_stock_history(ticker)
            feature_df = add_technical_indicators(raw_df, ticker=ticker)
            labeled_df = add_future_return_labels(feature_df, prediction_horizon_days=prediction_horizon_days)
            if len(labeled_df) >= sequence_length:
                prepared_frames.append((ticker, labeled_df))
            else:
                reason = "not enough clean rows after feature engineering"
                failed_tickers.append({"ticker": ticker, "reason": reason})
                print(f"Skipping {ticker}: {reason}.")
        except Exception as exc:
            failed_tickers.append({"ticker": ticker, "reason": str(exc)})
            print(f"Skipping {ticker}: {exc}")

    if not prepared_frames:
        raise RuntimeError("No tickers produced enough training data.")

    all_rows = np.concatenate(
        [frame[FEATURE_COLUMNS].to_numpy(dtype=np.float32) for _, frame in prepared_frames],
        axis=0,
    )

    # StandardScaler expects a DataFrame-like object in our helper, so build a
    # minimal frame with the same columns.
    scaler = fit_feature_scaler(pd.DataFrame(all_rows, columns=FEATURE_COLUMNS))

    all_sequences = []
    all_labels = []
    sequence_counts: dict[str, int] = {}
    for ticker, labeled_df in prepared_frames:
        scaled_features = transform_features(labeled_df, scaler)
        labels = labeled_df["Label"].to_numpy(dtype=np.int64)
        sequences, sequence_labels = build_sequences(scaled_features, labels, sequence_length=sequence_length)
        all_sequences.append(sequences)
        all_labels.append(sequence_labels)
        sequence_counts[ticker] = len(sequences)
        print(f"{ticker}: {len(sequences)} training sequences")

    sequences = np.concatenate(all_sequences, axis=0)
    labels = np.concatenate(all_labels, axis=0)
    loaded_tickers = [ticker for ticker, _ in prepared_frames]
    audit = {
        "loaded_tickers": loaded_tickers,
        "failed_tickers": failed_tickers,
        "sequence_counts": sequence_counts,
    }
    return sequences, labels, scaler, audit


def print_dataset_audit(
    labels: np.ndarray,
    loaded_tickers: list[str],
    failed_tickers: list[dict[str, str]],
    sequence_counts: dict[str, int],
) -> None:
    """Print the training dataset composition before model fitting starts."""

    label_names = {0: "AVOID", 1: "HOLD", 2: "BUY"}
    unique_labels, label_counts = np.unique(labels, return_counts=True)
    label_summary = {label_names[int(label)]: int(count) for label, count in zip(unique_labels, label_counts)}

    loaded_by_market: dict[str, list[str]] = {market: [] for market in MARKET_TICKERS}
    market_sample_counts: dict[str, int] = {market: 0 for market in MARKET_TICKERS}

    for ticker in loaded_tickers:
        market = market_region_name(ticker)
        loaded_by_market.setdefault(market, []).append(ticker)
        market_sample_counts[market] += sequence_counts.get(ticker, 0)

    print("\nTraining audit")
    print("--------------")
    print("Loaded tickers by market:")
    for market, market_tickers in loaded_by_market.items():
        print(f"  {market}: {', '.join(market_tickers) if market_tickers else 'none'}")
    print("Failed tickers:")
    if failed_tickers:
        for failure in failed_tickers:
            print(f"  {failure['ticker']}: {failure['reason']}")
    else:
        print("  none")
    print(f"Total samples: {len(labels)}")
    print(f"Label distribution: {label_summary}")
    print(f"Market distribution: {market_sample_counts}")
    print()


def accuracy_from_logits(logits: torch.Tensor, labels: torch.Tensor) -> float:
    """Calculate classification accuracy for one batch."""

    predictions = torch.argmax(logits, dim=1)
    return (predictions == labels).float().mean().item()


def train(args: argparse.Namespace) -> None:
    set_random_seed(args.seed)
    print_gpu_report()

    device = get_device()
    print(f"Device used: {device}")
    tickers = parse_tickers(args.tickers)

    sequences, labels, scaler, audit = build_multi_stock_dataset(
        tickers=tickers,
        sequence_length=args.sequence_length,
        prediction_horizon_days=args.prediction_horizon_days,
    )

    unique_labels, label_counts = np.unique(labels, return_counts=True)
    class_summary = ", ".join(f"class {label}: {count}" for label, count in zip(unique_labels, label_counts))
    print(f"Dataset size: {len(labels)} sequences | {class_summary}")
    print_dataset_audit(
        labels=labels,
        loaded_tickers=audit["loaded_tickers"],
        failed_tickers=audit["failed_tickers"],
        sequence_counts=audit["sequence_counts"],
    )

    # Stratified splitting keeps BUY/HOLD/AVOID proportions similar in train
    # and validation. Very tiny classes cannot be stratified, so we fall back
    # to a regular random split in that rare case.
    stratify_labels = labels if np.all(label_counts >= 2) else None

    x_train, x_val, y_train, y_val = train_test_split(
        sequences,
        labels,
        test_size=args.validation_size,
        random_state=args.seed,
        stratify=stratify_labels,
    )

    # TensorDataset keeps the code beginner friendly: each item is one sequence
    # tensor and its class label.
    train_dataset = TensorDataset(torch.tensor(x_train, dtype=torch.float32), torch.tensor(y_train, dtype=torch.long))
    val_dataset = TensorDataset(torch.tensor(x_val, dtype=torch.float32), torch.tensor(y_val, dtype=torch.long))

    train_loader = DataLoader(
        train_dataset,
        batch_size=args.batch_size,
        shuffle=True,
        num_workers=0,
        pin_memory=torch.cuda.is_available(),
    )
    val_loader = DataLoader(
        val_dataset,
        batch_size=args.batch_size,
        shuffle=False,
        num_workers=0,
        pin_memory=torch.cuda.is_available(),
    )

    model = StockTransformerClassifier(
        num_features=len(FEATURE_COLUMNS),
        sequence_length=args.sequence_length,
        d_model=args.d_model,
        num_heads=args.num_heads,
        num_layers=args.num_layers,
        dropout=args.dropout,
    ).to(device)

    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.learning_rate, weight_decay=args.weight_decay)

    # Mixed precision speeds up training on RTX GPUs while keeping CPU training
    # simple. It automatically disables itself when CUDA is unavailable.
    scaler_amp = torch.cuda.amp.GradScaler(enabled=torch.cuda.is_available())

    best_val_accuracy = -1.0
    epochs_without_improvement = 0

    ensure_directory(MODEL_DIR)

    for epoch in range(1, args.epochs + 1):
        model.train()
        train_losses = []

        for batch_features, batch_labels in train_loader:
            batch_features = batch_features.to(device, non_blocking=True)
            batch_labels = batch_labels.to(device, non_blocking=True)

            optimizer.zero_grad(set_to_none=True)

            with torch.cuda.amp.autocast(enabled=torch.cuda.is_available()):
                logits = model(batch_features)
                loss = criterion(logits, batch_labels)

            scaler_amp.scale(loss).backward()
            scaler_amp.unscale_(optimizer)
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            scaler_amp.step(optimizer)
            scaler_amp.update()

            train_losses.append(loss.item())

        model.eval()
        val_accuracies = []
        with torch.no_grad():
            for batch_features, batch_labels in val_loader:
                batch_features = batch_features.to(device, non_blocking=True)
                batch_labels = batch_labels.to(device, non_blocking=True)
                logits = model(batch_features)
                val_accuracies.append(accuracy_from_logits(logits, batch_labels))

        epoch_loss = float(np.mean(train_losses))
        val_accuracy = float(np.mean(val_accuracies))
        print(f"Epoch {epoch:03d} | loss: {epoch_loss:.4f} | validation accuracy: {val_accuracy:.4f}")

        if val_accuracy > best_val_accuracy:
            best_val_accuracy = val_accuracy
            epochs_without_improvement = 0

            checkpoint = {
                "model_state_dict": model.state_dict(),
                "scaler": scaler_to_state(scaler).__dict__,
                "feature_columns": FEATURE_COLUMNS,
                "sequence_length": args.sequence_length,
                "prediction_horizon_days": args.prediction_horizon_days,
                "model_config": {
                    "num_features": len(FEATURE_COLUMNS),
                    "sequence_length": args.sequence_length,
                    "d_model": args.d_model,
                    "num_heads": args.num_heads,
                    "num_layers": args.num_layers,
                    "dropout": args.dropout,
                },
                "best_val_accuracy": best_val_accuracy,
                "tickers": tickers,
                "loaded_tickers": audit["loaded_tickers"],
                "failed_tickers": audit["failed_tickers"],
                "market_tickers": MARKET_TICKERS,
            }
            torch.save(checkpoint, MODEL_PATH)
            print(f"Saved new best model to {MODEL_PATH}")
        else:
            epochs_without_improvement += 1
            if epochs_without_improvement >= args.patience:
                print(f"Early stopping after {args.patience} epochs without validation improvement.")
                break

    print(f"Training complete. Best validation accuracy: {best_val_accuracy:.4f}")
    print("Validation commands:")
    print("  python predict.py AAPL")
    print("  python predict.py RELIANCE.NS")
    print("  python predict.py TCS.NS")
    print("  python predict.py ASML.AS")
    print("  python predict.py EMAAR.AE")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train the MarketMind AI Transformer stock classifier.")
    parser.add_argument("--tickers", type=str, default=",".join(DEFAULT_TICKERS), help="Comma-separated stock tickers.")
    parser.add_argument("--epochs", type=int, default=30, help="Maximum number of training epochs.")
    parser.add_argument("--batch-size", type=int, default=64, help="Training batch size. RTX 4060 should handle 64 well.")
    parser.add_argument("--learning-rate", type=float, default=1e-4, help="AdamW learning rate.")
    parser.add_argument("--weight-decay", type=float, default=1e-4, help="AdamW weight decay.")
    parser.add_argument("--validation-size", type=float, default=0.2, help="Validation split ratio.")
    parser.add_argument("--patience", type=int, default=5, help="Early stopping patience.")
    parser.add_argument("--sequence-length", type=int, default=60, help="Number of trading days per input sequence.")
    parser.add_argument("--prediction-horizon-days", type=int, default=5, help="Future return horizon for labels.")
    parser.add_argument("--d-model", type=int, default=128, help="Transformer hidden size.")
    parser.add_argument("--num-heads", type=int, default=8, help="Number of attention heads.")
    parser.add_argument("--num-layers", type=int, default=4, help="Number of Transformer encoder layers.")
    parser.add_argument("--dropout", type=float, default=0.2, help="Dropout probability.")
    parser.add_argument("--seed", type=int, default=42, help="Random seed.")
    return parser.parse_args()


if __name__ == "__main__":
    train(parse_args())
