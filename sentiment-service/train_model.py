"""
Train the IARS hotel review sentiment model.

Model:
- TF-IDF Vectorizer (negation-safe stop words, 1-3 grams)
- Logistic Regression with cross-validated regularization

Dataset:
- data/sentiment_training.csv (HRAST hotel reviews + negation augmentation)

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
from sklearn.model_selection import GridSearchCV, cross_val_score, train_test_split
from sklearn.pipeline import Pipeline

from generate_augmented_data import TRAINING_PATH, build_training_dataset
from text_preprocessing import HARD_NEGATION_TEST_CASES, get_custom_stop_words, normalize_text

BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "models"
MODEL_PATH = MODEL_DIR / "sentiment_pipeline.joblib"
METRICS_PATH = MODEL_DIR / "metrics.json"


def load_dataset() -> pd.DataFrame:
    if not TRAINING_PATH.exists():
        print("Training dataset missing. Building merged HRAST + negation augmentation...")
        return build_training_dataset()

    df = pd.read_csv(TRAINING_PATH)

    required_columns = {"review", "sentiment"}
    missing = required_columns - set(df.columns)
    if missing:
        raise ValueError(f"Dataset missing required columns: {missing}")

    df = df[["review", "sentiment"]].copy()
    df["review"] = df["review"].apply(normalize_text)
    df["sentiment"] = df["sentiment"].astype(str).str.strip().str.lower()
    df = df[df["sentiment"].isin(["positive", "negative", "neutral"])]
    df = df[df["review"].str.len() > 0]
    df = df.drop_duplicates(subset=["review"])

    if df.empty:
        raise ValueError("Dataset is empty after cleaning.")

    return df


def evaluate_hard_cases(pipeline) -> list[dict]:
    results = []
    for text, expected in HARD_NEGATION_TEST_CASES:
        normalized = normalize_text(text)
        predicted = pipeline.predict([normalized])[0]
        probabilities = pipeline.predict_proba([normalized])[0]
        confidence = float(max(probabilities))
        results.append(
            {
                "text": text,
                "expected": expected,
                "predicted": predicted,
                "correct": predicted == expected,
                "confidence": round(confidence, 4),
            }
        )
    return results


def train() -> None:
    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    df = load_dataset()
    X = df["review"]
    y = df["sentiment"]

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.15,
        random_state=42,
        stratify=y,
    )

    pipeline = Pipeline(
        steps=[
            (
                "tfidf",
                TfidfVectorizer(
                    ngram_range=(1, 3),
                    min_df=2,
                    max_df=0.95,
                    max_features=80000,
                    sublinear_tf=True,
                    stop_words=get_custom_stop_words(),
                ),
            ),
            (
                "classifier",
                LogisticRegression(
                    max_iter=5000,
                    class_weight="balanced",
                    solver="lbfgs",
                    random_state=42,
                ),
            ),
        ]
    )

    param_grid = {
        "classifier__C": [0.5, 1.0, 2.0, 4.0],
    }

    print("Training sentiment model with cross-validation...")
    search = GridSearchCV(
        pipeline,
        param_grid=param_grid,
        cv=3,
        scoring="f1_weighted",
        n_jobs=-1,
        verbose=1,
    )
    search.fit(X_train, y_train)
    best_pipeline = search.best_estimator_

    predictions = best_pipeline.predict(X_test)
    accuracy = accuracy_score(y_test, predictions)
    report_dict = classification_report(y_test, predictions, output_dict=True)
    report_text = classification_report(y_test, predictions)
    labels = ["positive", "negative", "neutral"]
    matrix = confusion_matrix(y_test, predictions, labels=labels)

    cv_scores = cross_val_score(
        best_pipeline,
        X,
        y,
        cv=5,
        scoring="f1_weighted",
    )

    hard_cases = evaluate_hard_cases(best_pipeline)
    hard_case_accuracy = sum(item["correct"] for item in hard_cases) / len(hard_cases)

    negation_mask = df["review"].str.contains(r"\bnot\b|\bnever\b|n't\b", regex=True)
    negation_df = df[negation_mask]
    negation_accuracy = None
    if len(negation_df) >= 20:
        neg_preds = best_pipeline.predict(negation_df["review"])
        negation_accuracy = float((neg_preds == negation_df["sentiment"].values).mean())

    metrics = {
        "dataset_rows_after_cleaning": int(len(df)),
        "train_rows": int(len(X_train)),
        "test_rows": int(len(X_test)),
        "labels": labels,
        "accuracy": float(accuracy),
        "cv_f1_weighted_mean": float(cv_scores.mean()),
        "cv_f1_weighted_std": float(cv_scores.std()),
        "best_C": search.best_params_.get("classifier__C"),
        "negation_subset_accuracy": negation_accuracy,
        "hard_case_accuracy": float(hard_case_accuracy),
        "hard_cases": hard_cases,
        "classification_report": report_dict,
        "confusion_matrix_labels": labels,
        "confusion_matrix": matrix.tolist(),
        "model_type": "TF-IDF (1-3 gram, negation-safe) + Logistic Regression",
        "preprocessing": "negation-safe stop words, lowercase normalization",
    }

    joblib.dump(best_pipeline, MODEL_PATH)
    METRICS_PATH.write_text(json.dumps(metrics, indent=2), encoding="utf-8")

    print("\nTraining completed.")
    print(f"Best C: {search.best_params_}")
    print(f"Accuracy: {accuracy:.4f}")
    print(f"CV F1 (weighted): {cv_scores.mean():.4f} ± {cv_scores.std():.4f}")
    if negation_accuracy is not None:
        print(f"Negation subset accuracy: {negation_accuracy:.4f}")
    print(f"Hard-case accuracy: {hard_case_accuracy:.2%}")
    print("\nHard-case results:")
    for item in hard_cases:
        mark = "OK" if item["correct"] else "FAIL"
        print(f"  [{mark}] {item['text'][:60]} -> {item['predicted']} (expected {item['expected']})")
    print("\nClassification Report:\n")
    print(report_text)
    print(f"\nSaved model: {MODEL_PATH}")
    print(f"Saved metrics: {METRICS_PATH}")


if __name__ == "__main__":
    train()
