"""
Train the IARS hotel review sentiment classifier and evaluate the full
analysis pipeline.

Classifier:
- TF-IDF Vectorizer (1-3 grams; negation words and modal verbs are kept)
- Logistic Regression with cross-validated regularization
- Labels: positive, negative, neutral (mixed reviews are handled by clause
  splitting in review_analyzer.py, not by the classifier)

Dataset:
- data/sentiment_training.csv (HRAST hotel reviews + targeted augmentation;
  rebuild it with `python generate_augmented_data.py`)

Reported metrics (models/metrics.json):
- classifier accuracy on the held-out test split, overall and on real HRAST
  sentences only (template sentences are easier, so both are shown)
- full-pipeline accuracy on data/evaluation_cases.json (hand-labelled reviews,
  never used for training)

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
LABELS = ["positive", "negative", "neutral"]


def load_dataset() -> pd.DataFrame:
    if not TRAINING_PATH.exists():
        print("Training dataset missing. Building HRAST + augmentation...")
        build_training_dataset()

    df = pd.read_csv(TRAINING_PATH)

    required_columns = {"review", "sentiment"}
    missing = required_columns - set(df.columns)
    if missing:
        raise ValueError(f"Dataset missing required columns: {missing}")

    if "source" not in df.columns:
        df["source"] = "hrast"
    df = df[["review", "sentiment", "source"]].copy()
    df["review"] = df["review"].apply(normalize_text)
    df["sentiment"] = df["sentiment"].astype(str).str.strip().str.lower()
    # The classifier labels single clauses; mixed sentences are left to clause splitting.
    df = df[df["sentiment"].isin(LABELS)]
    df = df[df["review"].str.len() > 0]
    df = df.drop_duplicates(subset=["review"])

    if df.empty:
        raise ValueError("Dataset is empty after cleaning.")

    return df


def evaluate_hard_cases(pipeline) -> list[dict]:
    """Short sentences known to be hard, through the classifier and the full analyzer."""
    from review_analyzer import ReviewAnalyzer

    analyzer = ReviewAnalyzer(pipeline)
    results = []
    for text, expected in HARD_NEGATION_TEST_CASES:
        normalized = normalize_text(text)
        classifier_label = pipeline.predict([normalized])[0]
        analysis = analyzer.analyze(text)
        results.append(
            {
                "text": text,
                "expected": expected,
                "predicted": analysis["sentiment"],
                "correct": analysis["sentiment"] == expected,
                "confidence": analysis["confidence"],
                "classifier_only": classifier_label,
                "classifier_only_correct": classifier_label == expected,
            }
        )
    return results


def classifier_report(y_true, y_pred) -> dict:
    return {
        "rows": int(len(y_true)),
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "classification_report": classification_report(y_true, y_pred, labels=LABELS, output_dict=True, zero_division=0),
        "confusion_matrix_labels": LABELS,
        "confusion_matrix": confusion_matrix(y_true, y_pred, labels=LABELS).tolist(),
    }


def pipeline_report_on_sentences(pipeline, reviews, labels) -> dict:
    """Full analyzer on real test sentences, compared with the classifier alone.

    A 'mixed' answer counts as an error in `accuracy`, because the HRAST gold
    labels only allow positive, negative or neutral. `same_rows_*` compares the
    two on the sentences the analyzer did not call mixed. `fact_like_neutral_*`
    looks at gold-neutral sentences in which no clause contains an opinion
    word: the guest-describes-a-fact case ("parking 10 euro the night").
    """
    from opinion_lexicon import score_opinion
    from review_analyzer import ReviewAnalyzer

    analyzer = ReviewAnalyzer(pipeline)
    results = [analyzer.analyze(text) for text in reviews]
    predictions = [r["sentiment"] for r in results]
    classifier = list(pipeline.predict([normalize_text(text) for text in reviews]))
    labels = list(labels)
    mixed = sum(p == "mixed" for p in predictions)

    same = [(l, c, p) for l, c, p in zip(labels, classifier, predictions) if p != "mixed"]
    fact_like = [
        (c, p) for text, l, c, p, r in zip(reviews, labels, classifier, predictions, results)
        if l == "neutral" and not any(score_opinion(s["text"]).polar for s in r["sentenceResults"])
    ]
    gold_neutral = [(c, p) for l, c, p in zip(labels, classifier, predictions) if l == "neutral"]

    def share(pairs, index):
        return float(sum(pair[index] == "neutral" for pair in pairs) / max(1, len(pairs)))

    return {
        "rows": len(labels),
        "accuracy": float(accuracy_score(labels, predictions)),
        "classifier_alone_accuracy": float(accuracy_score(labels, classifier)),
        "mixed_predictions": int(mixed),
        "same_rows_count": len(same),
        "same_rows_classifier_accuracy": float(sum(l == c for l, c, _ in same) / max(1, len(same))),
        "same_rows_analyzer_accuracy": float(sum(l == p for l, _, p in same) / max(1, len(same))),
        "neutral_rows": len(gold_neutral),
        "neutral_recall": share(gold_neutral, 1),
        "neutral_recall_classifier_alone": share(gold_neutral, 0),
        "gold_neutral_answered_mixed": int(sum(p == "mixed" for _, p in gold_neutral)),
        "fact_like_neutral_rows": len(fact_like),
        "fact_like_neutral_recall": share(fact_like, 1),
        "fact_like_neutral_recall_classifier_alone": share(fact_like, 0),
    }


def train() -> None:
    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    df = load_dataset()
    X = df["review"]
    y = df["sentiment"]

    X_train, X_test, y_train, y_test, source_train, source_test = train_test_split(
        X,
        y,
        df["source"],
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
                    max_features=100000,
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
        "classifier__C": [1.0, 2.0, 4.0, 8.0],
    }

    print("Training sentiment classifier with cross-validation...")
    search = GridSearchCV(
        pipeline,
        param_grid=param_grid,
        cv=3,
        scoring="f1_macro",
        n_jobs=-1,
        verbose=1,
    )
    search.fit(X_train, y_train)
    best_pipeline = search.best_estimator_

    predictions = best_pipeline.predict(X_test)
    overall = classifier_report(y_test, predictions)

    hrast_mask = (source_test == "hrast").values
    hrast_only = classifier_report(y_test[hrast_mask], predictions[hrast_mask])

    cv_scores = cross_val_score(best_pipeline, X, y, cv=5, scoring="f1_weighted")

    hard_cases = evaluate_hard_cases(best_pipeline)
    hard_case_accuracy = sum(item["correct"] for item in hard_cases) / len(hard_cases)

    negation_mask = df["review"].str.contains(r"\bnot\b|\bnever\b|\bno\b", regex=True)
    negation_df = df[negation_mask]
    negation_accuracy = None
    if len(negation_df) >= 20:
        neg_preds = best_pipeline.predict(negation_df["review"])
        negation_accuracy = float((neg_preds == negation_df["sentiment"].values).mean())

    print("Evaluating the full analyzer on real HRAST test sentences...")
    raw = pd.read_csv(TRAINING_PATH)
    raw["normalized"] = raw["review"].apply(normalize_text)
    original_text = dict(zip(raw["normalized"], raw["review"]))
    hrast_test_reviews = [original_text.get(text, text) for text in X_test[hrast_mask]]
    pipeline_on_hrast = pipeline_report_on_sentences(best_pipeline, hrast_test_reviews, y_test[hrast_mask])

    from evaluate_pipeline import evaluate
    from review_analyzer import ReviewAnalyzer

    pipeline_evaluation = evaluate(ReviewAnalyzer(best_pipeline).analyze)

    metrics = {
        "dataset_rows_after_cleaning": int(len(df)),
        "train_rows": int(len(X_train)),
        "test_rows": int(len(X_test)),
        "labels": LABELS,
        "accuracy": overall["accuracy"],
        "cv_f1_weighted_mean": float(cv_scores.mean()),
        "cv_f1_weighted_std": float(cv_scores.std()),
        "best_C": search.best_params_.get("classifier__C"),
        "negation_subset_accuracy": negation_accuracy,
        "hard_case_accuracy": float(hard_case_accuracy),
        "hard_cases": hard_cases,
        "classification_report": overall["classification_report"],
        "confusion_matrix_labels": LABELS,
        "confusion_matrix": overall["confusion_matrix"],
        "hrast_test_only": hrast_only,
        "pipeline_on_hrast_test_sentences": pipeline_on_hrast,
        "pipeline_evaluation": pipeline_evaluation,
        "model_type": "TF-IDF (1-3 gram, negation and modal verbs kept) + Logistic Regression",
        "analysis": "clause segmentation + opinion lexicon + classifier (review_analyzer.py)",
        "preprocessing": "lower-case, contractions expanded, negation-safe and modal-safe stop words",
    }

    joblib.dump(best_pipeline, MODEL_PATH)
    METRICS_PATH.write_text(json.dumps(metrics, indent=2), encoding="utf-8")

    neutral = overall["classification_report"]["neutral"]
    hrast_neutral = hrast_only["classification_report"]["neutral"]
    print("\nTraining completed.")
    print(f"Best C: {search.best_params_}")
    print(f"Classifier accuracy (all test rows): {overall['accuracy']:.4f}")
    print(f"Classifier accuracy (real HRAST test rows): {hrast_only['accuracy']:.4f}")
    print(
        f"Neutral recall: all {neutral['recall']:.2%} of {int(neutral['support'])}, "
        f"real HRAST {hrast_neutral['recall']:.2%} of {int(hrast_neutral['support'])}"
    )
    print(f"CV F1 (weighted): {cv_scores.mean():.4f} +/- {cv_scores.std():.4f}")
    if negation_accuracy is not None:
        print(f"Negation subset accuracy: {negation_accuracy:.4f}")
    print(f"Hard-case accuracy (full analyzer): {hard_case_accuracy:.2%}")
    for item in hard_cases:
        mark = "OK" if item["correct"] else "FAIL"
        print(f"  [{mark}] {item['text'][:60]} -> {item['predicted']} (expected {item['expected']}; classifier alone: {item['classifier_only']})")
    p = pipeline_on_hrast
    print(
        f"\nFull analyzer on {p['rows']} real HRAST test sentences: accuracy {p['accuracy']:.4f} "
        f"(classifier alone {p['classifier_alone_accuracy']:.4f}); {p['mixed_predictions']} answered mixed, "
        "which the 3-label gold counts as wrong."
    )
    print(
        f"  On the {p['same_rows_count']} sentences not answered mixed: analyzer {p['same_rows_analyzer_accuracy']:.4f} "
        f"vs classifier alone {p['same_rows_classifier_accuracy']:.4f}"
    )
    print(
        f"  Gold-neutral sentences: analyzer {p['neutral_recall']:.2%} vs classifier {p['neutral_recall_classifier_alone']:.2%} "
        f"of {p['neutral_rows']} ({p['gold_neutral_answered_mixed']} answered mixed)"
    )
    print(
        f"  Fact-like gold-neutral sentences (no opinion words): analyzer {p['fact_like_neutral_recall']:.2%} "
        f"vs classifier {p['fact_like_neutral_recall_classifier_alone']:.2%} of {p['fact_like_neutral_rows']}"
    )
    print(
        f"Full analyzer on evaluation cases: reviews {pipeline_evaluation['review_sentiment_accuracy']:.2%}, "
        f"aspects {pipeline_evaluation['aspect_sentiment_accuracy']:.2%} ({pipeline_evaluation['cases']} cases)"
    )
    print("\nClassification Report (all test rows):\n")
    print(classification_report(y_test, predictions, labels=LABELS, zero_division=0))
    print(f"\nSaved model: {MODEL_PATH}")
    print(f"Saved metrics: {METRICS_PATH}")


if __name__ == "__main__":
    train()
