"""
Train a self-trained hotel review sentiment model for ISAR/IARS.

Model:
- TF-IDF Vectorizer
- Logistic Regression classifier

Dataset:
- data/HRAST_cleaned_for_sentiment_training.csv
- Required columns: review, sentiment
- sentiment values: positive, negative, neutral

Run:
python train_model.py
"""

from __future__ import annotations

import json
from pathlib import Path

import joblib
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline

BASE_DIR = Path(__file__).resolve().parent
DATA_PATH = BASE_DIR / "data" / "HRAST_cleaned_for_sentiment_training.csv"
MODEL_DIR = BASE_DIR / "models"
MODEL_PATH = MODEL_DIR / "sentiment_pipeline.joblib"
METRICS_PATH = MODEL_DIR / "metrics.json"


def clean_text(value: object) -> str:
    """Basic text cleaning for review sentences."""
    if value is None:
        return ""
    return str(value).strip().lower()


def load_dataset() -> pd.DataFrame:
    if not DATA_PATH.exists():
        raise FileNotFoundError(
            f"Dataset not found at {DATA_PATH}. Place the cleaned CSV in data/ folder."
        )

    df = pd.read_csv(DATA_PATH)

    required_columns = {"review", "sentiment"}
    missing = required_columns - set(df.columns)
    if missing:
        raise ValueError(f"Dataset missing required columns: {missing}")

    df = df[["review", "sentiment"]].copy()
    df["review"] = df["review"].apply(clean_text)
    df["sentiment"] = df["sentiment"].astype(str).str.strip().str.lower()

    valid_labels = {"positive", "negative", "neutral"}
    df = df[df["sentiment"].isin(valid_labels)]
    df = df[df["review"].str.len() > 0]
    df = df.drop_duplicates(subset=["review"])

    if df.empty:
        raise ValueError("Dataset is empty after cleaning.")

    return df


def train() -> None:
    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    df = load_dataset()
    X = df["review"]
    y = df["sentiment"]

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=42,
        stratify=y,
    )

    pipeline = Pipeline(
        steps=[
            (
                "tfidf",
                TfidfVectorizer(
                    ngram_range=(1, 2),
                    min_df=2,
                    max_df=0.95,
                    sublinear_tf=True,
                    stop_words="english",
                ),
            ),
            (
                "classifier",
                LogisticRegression(
                    max_iter=2000,
                    class_weight="balanced",
                    solver="lbfgs",
                    multi_class="auto",
                    random_state=42,
                ),
            ),
        ]
    )

    print("Training sentiment model...")
    pipeline.fit(X_train, y_train)

    predictions = pipeline.predict(X_test)
    accuracy = accuracy_score(y_test, predictions)
    report_dict = classification_report(y_test, predictions, output_dict=True)
    report_text = classification_report(y_test, predictions)
    labels = ["positive", "negative", "neutral"]
    matrix = confusion_matrix(y_test, predictions, labels=labels)

    metrics = {
        "dataset_rows_after_cleaning": int(len(df)),
        "train_rows": int(len(X_train)),
        "test_rows": int(len(X_test)),
        "labels": labels,
        "accuracy": float(accuracy),
        "classification_report": report_dict,
        "confusion_matrix_labels": labels,
        "confusion_matrix": matrix.tolist(),
        "model_type": "TF-IDF + Logistic Regression",
    }

    joblib.dump(pipeline, MODEL_PATH)
    METRICS_PATH.write_text(json.dumps(metrics, indent=2), encoding="utf-8")

    print("\nTraining completed.")
    print(f"Accuracy: {accuracy:.4f}")
    print("\nClassification Report:\n")
    print(report_text)
    print("Confusion Matrix labels:", labels)
    print(matrix)
    print(f"\nSaved model: {MODEL_PATH}")
    print(f"Saved metrics: {METRICS_PATH}")


if __name__ == "__main__":
    train()
