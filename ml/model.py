from __future__ import annotations

import math

import torch
from torch import nn


class PositionalEncoding(nn.Module):
    """Adds time-step information to the input features.

    A Transformer sees the whole 60-day sequence at once, so it needs positional
    encoding to understand which rows are earlier or later in time.
    """

    def __init__(self, d_model: int, max_sequence_length: int = 500, dropout: float = 0.1) -> None:
        super().__init__()
        self.dropout = nn.Dropout(dropout)

        positions = torch.arange(max_sequence_length, dtype=torch.float32).unsqueeze(1)
        div_terms = torch.exp(torch.arange(0, d_model, 2, dtype=torch.float32) * (-math.log(10000.0) / d_model))

        encoding = torch.zeros(max_sequence_length, d_model, dtype=torch.float32)
        encoding[:, 0::2] = torch.sin(positions * div_terms)
        encoding[:, 1::2] = torch.cos(positions * div_terms[: encoding[:, 1::2].shape[1]])

        # Registering as a buffer moves this tensor with model.to(device), but
        # it is not trained like a weight.
        self.register_buffer("encoding", encoding.unsqueeze(0))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        sequence_length = x.size(1)
        x = x + self.encoding[:, :sequence_length, :]
        return self.dropout(x)


class StockTransformerClassifier(nn.Module):
    """Transformer Encoder classifier for BUY/HOLD/AVOID stock signals."""

    def __init__(
        self,
        num_features: int,
        num_classes: int = 3,
        sequence_length: int = 60,
        d_model: int = 128,
        num_heads: int = 8,
        num_layers: int = 4,
        dim_feedforward: int = 256,
        dropout: float = 0.2,
    ) -> None:
        super().__init__()

        self.sequence_length = sequence_length

        # Project raw feature vectors into the hidden size used by attention.
        self.input_projection = nn.Linear(num_features, d_model)
        self.positional_encoding = PositionalEncoding(
            d_model=d_model,
            max_sequence_length=sequence_length,
            dropout=dropout,
        )

        encoder_layer = nn.TransformerEncoderLayer(
            d_model=d_model,
            nhead=num_heads,
            dim_feedforward=dim_feedforward,
            dropout=dropout,
            activation="gelu",
            batch_first=True,
            norm_first=True,
        )
        self.encoder = nn.TransformerEncoder(encoder_layer, num_layers=num_layers)

        # LayerNorm keeps the pooled representation numerically stable.
        self.layer_norm = nn.LayerNorm(d_model)
        self.classifier = nn.Sequential(
            nn.Dropout(dropout),
            nn.Linear(d_model, d_model // 2),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(d_model // 2, num_classes),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x shape: [batch_size, 60 days, number_of_features]
        x = self.input_projection(x)
        x = self.positional_encoding(x)
        x = self.encoder(x)

        # Use the final day representation because the label belongs to the
        # last day in each 60-day input sequence.
        last_day_embedding = self.layer_norm(x[:, -1, :])
        return self.classifier(last_day_embedding)
