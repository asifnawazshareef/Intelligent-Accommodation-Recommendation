"""
Train the IARS hybrid accommodation recommendation model.

Model:
- Gradient Boosting Regressor (interaction strength 0-1)
- Features from search history, bookings, ratings, and property quality

Run:
python generate_training_data.py
python train_model.py
"""

from __future__ import annotations

import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import cross_val_score, train_test_split

from feature_engineering import FEATURE_NAMES
from generate_training_data import DATA_PATH, generate_dataset

BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "models"
MODEL_PATH = MODEL_DIR / "recommendation_model.joblib"
METRICS_PATH = MODEL_DIR / "metrics.json"


def load_dataset() -> pd.DataFrame:
    if not DATA_PATH.exists():
        print("Training dataset missing. Generating synthetic interactions...")
        return generate_dataset()

    df = pd.read_csv(DATA_PATH)
    if df.empty:
        raise ValueError("Training dataset is empty.")

    return df


def train() -> None:
    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    df = load_dataset()
    X = df[FEATURE_NAMES]
    y = df["interaction_strength"]

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=42,
    )

    model = GradientBoostingRegressor(
        n_estimators=300,
        learning_rate=0.05,
        max_depth=4,
        min_samples_leaf=8,
        subsample=0.9,
        random_state=42,
    )

    print("Training recommendation model...")
    model.fit(X_train, y_train)

    predictions = model.predict(X_test)
    mae = mean_absolute_error(y_test, predictions)
    rmse = float(np.sqrt(mean_squared_error(y_test, predictions)))
    r2 = r2_score(y_test, predictions)

    cv_scores = cross_val_score(
        model,
        X,
        y,
        cv=5,
        scoring="r2",
    )

    ranked = np.argsort(predictions)[::-1]
    top_k = min(10, len(ranked))
    precision_at_k = float(np.mean(y_test.iloc[ranked[:top_k]] >= 0.55))

    metrics = {
        "dataset_rows": int(len(df)),
        "train_rows": int(len(X_train)),
        "test_rows": int(len(X_test)),
        "features": FEATURE_NAMES,
        "model_type": "Gradient Boosting Regressor",
        "mae": float(mae),
        "rmse": rmse,
        "r2": float(r2),
        "cv_r2_mean": float(cv_scores.mean()),
        "cv_r2_std": float(cv_scores.std()),
        "precision_at_10": precision_at_k,
        "feature_importance": {
            name: float(value)
            for name, value in zip(FEATURE_NAMES, model.feature_importances_)
        },
    }

    artifact = {
        "model": model,
        "feature_names": FEATURE_NAMES,
        "model_type": metrics["model_type"],
    }

    joblib.dump(artifact, MODEL_PATH)
    METRICS_PATH.write_text(json.dumps(metrics, indent=2), encoding="utf-8")

    print("\nTraining completed.")
    print(f"R²: {r2:.4f}")
    print(f"MAE: {mae:.4f}")
    print(f"RMSE: {rmse:.4f}")
    print(f"CV R² (mean ± std): {cv_scores.mean():.4f} ± {cv_scores.std():.4f}")
    print(f"Precision@10 (strength >= 0.55): {precision_at_k:.2%}")
    print(f"\nSaved model: {MODEL_PATH}")
    print(f"Saved metrics: {METRICS_PATH}")


if __name__ == "__main__":
    train()
