"""
Generate negation-focused augmentation for hotel review sentiment training.

Covers informal English common in guest reviews (e.g. "not too much good service").
"""

from __future__ import annotations

import itertools
import random
from pathlib import Path

import pandas as pd

BASE_DIR = Path(__file__).resolve().parent
TRAINING_PATH = BASE_DIR / "data" / "sentiment_training.csv"
# Optional one-time source; merged into TRAINING_PATH then removed from the repo.
HRAST_PATH = BASE_DIR / "data" / "HRAST_cleaned_for_sentiment_training.csv"

NEGATION_PREFIXES = [
    "not",
    "not too",
    "not so",
    "not very",
    "not that",
    "not really",
    "not much",
    "never",
    "hardly",
    "barely",
]

POSITIVE_DESCRIPTORS = [
    "good",
    "great",
    "nice",
    "clean",
    "helpful",
    "friendly",
    "comfortable",
    "excellent",
    "amazing",
    "perfect",
    "worth it",
    "satisfactory",
    "pleasant",
    "fine",
    "okay",
]

HOTEL_SUBJECTS = [
    "service",
    "staff service",
    "room service",
    "hotel service",
    "customer service",
    "the service",
    "staff",
    "the staff",
    "room",
    "the room",
    "wifi",
    "the wifi",
    "breakfast",
    "the breakfast",
    "location",
    "the location",
    "facilities",
    "the facilities",
    "stay",
    "the stay",
    "experience",
    "the experience",
    "accommodation",
    "food",
    "the food",
    "cleanliness",
    "value for money",
]

POSITIVE_TEMPLATES = [
    "The {subject} was {desc}.",
    "{subject} was {desc}.",
    "Very {desc} {subject}.",
    "Really {desc} {subject}.",
    "I found the {subject} {desc}.",
    "Overall {desc} {subject}.",
    "It is a {desc} {subject}.",
    "It's a {desc} {subject}.",
    "We had a {desc} {subject}.",
    "The hotel has {desc} {subject}.",
]

NEGATIVE_TEMPLATES = [
    "The {subject} was {desc}.",
    "{subject} was {desc}.",
    "Very {desc} {subject}.",
    "Really {desc} {subject}.",
    "Poor {subject}.",
    "Bad {subject}.",
    "Terrible {subject}.",
    "Disappointing {subject}.",
    "The worst {subject} ever.",
    "Would not recommend because of {subject}.",
]

NEUTRAL_TEMPLATES = [
    "The {subject} is average.",
    "The hotel is near the {subject}.",
    "We stayed for two nights.",
    "The {subject} was acceptable.",
    "Standard {subject} for this price range.",
    "Nothing special about the {subject}.",
]

NEGATIVE_DESCRIPTORS = [
    "bad",
    "poor",
    "terrible",
    "awful",
    "horrible",
    "disappointing",
    "dirty",
    "rude",
    "slow",
    "uncomfortable",
    "overpriced",
    "noisy",
    "unreliable",
    "unacceptable",
]


def _build_negation_rows() -> list[dict]:
    rows: list[dict] = []

    for prefix, desc in itertools.product(NEGATION_PREFIXES, POSITIVE_DESCRIPTORS):
        for subject in HOTEL_SUBJECTS[:12]:
            if prefix == "not" and random.random() > 0.35:
                continue
            text = f"{subject} is {prefix} {desc}"
            rows.append({"review": text, "sentiment": "negative", "source": "negation_aug"})

    for template in POSITIVE_TEMPLATES:
        for subject, desc in itertools.product(HOTEL_SUBJECTS[:10], POSITIVE_DESCRIPTORS[:8]):
            positive = template.format(subject=subject, desc=desc).lower()
            rows.append({"review": positive, "sentiment": "positive", "source": "positive_aug"})

            for prefix in ["not", "not too", "not very", "not so", "never"]:
                neg = positive.replace(f" {desc}", f" {prefix} {desc}")
                neg = neg.replace(f"was {desc}", f"was {prefix} {desc}")
                neg = neg.replace(f"is {desc}", f"is {prefix} {desc}")
                rows.append({"review": neg, "sentiment": "negative", "source": "negation_flip"})

    for template in NEGATIVE_TEMPLATES:
        for subject, desc in itertools.product(HOTEL_SUBJECTS, NEGATIVE_DESCRIPTORS[:8]):
            rows.append(
                {
                    "review": template.format(subject=subject, desc=desc).lower(),
                    "sentiment": "negative",
                    "source": "negative_aug",
                }
            )

    for template in NEUTRAL_TEMPLATES:
        for subject in HOTEL_SUBJECTS[:8]:
            rows.append(
                {
                    "review": template.format(subject=subject).lower(),
                    "sentiment": "neutral",
                    "source": "neutral_aug",
                }
            )

    # User-reported patterns and informal Pakistani/Indian English variants
    manual = [
        ("it's not too much good service.", "negative"),
        ("its not too much good service", "negative"),
        ("not too much good service", "negative"),
        ("service is not too much good", "negative"),
        ("service not good", "negative"),
        ("not good service at all", "negative"),
        ("staff not friendly", "negative"),
        ("room not clean", "negative"),
        ("wifi not working properly", "negative"),
        ("not worth the price", "negative"),
        ("would not stay again", "negative"),
        ("do not recommend this hotel", "negative"),
        ("not happy with the service", "negative"),
        ("not satisfied with the stay", "negative"),
        ("not a good hotel", "negative"),
        ("not a pleasant experience", "negative"),
        ("service was ok but not great", "mixed"),
        ("room was clean but wifi was not good", "mixed"),
    ]

    for text, sentiment in manual:
        rows.append({"review": text, "sentiment": sentiment, "source": "manual_hard_cases"})

    return rows


def build_training_dataset(seed: int = 42) -> pd.DataFrame:
    """Merge HRAST reviews (if present) with negation augmentation into one CSV."""
    random.seed(seed)
    augmented = pd.DataFrame(_build_negation_rows())

    if HRAST_PATH.exists():
        hrast = pd.read_csv(HRAST_PATH)[["review", "sentiment"]].copy()
        hrast["source"] = "hrast"
        combined = pd.concat([hrast, augmented], ignore_index=True)
    elif TRAINING_PATH.exists():
        existing = pd.read_csv(TRAINING_PATH)
        combined = pd.concat([existing, augmented], ignore_index=True)
    else:
        combined = augmented

    combined["review"] = combined["review"].astype(str).str.strip().str.lower()
    combined["sentiment"] = combined["sentiment"].astype(str).str.strip().str.lower()
    combined = combined[combined["sentiment"].isin(["positive", "negative", "neutral", "mixed"])]
    combined = combined[combined["review"].str.len() > 2]
    combined = combined.drop_duplicates(subset=["review"])

    # For 3-class model, map mixed to negative for training stability on negation side
    combined.loc[combined["sentiment"] == "mixed", "sentiment"] = "negative"

    TRAINING_PATH.parent.mkdir(parents=True, exist_ok=True)
    combined.to_csv(TRAINING_PATH, index=False)

    return combined


# Backward-compatible alias used by train_model.py
build_combined_dataset = build_training_dataset


if __name__ == "__main__":
    dataset = build_training_dataset()
    print(f"Training rows: {len(dataset)}")
    print(dataset["sentiment"].value_counts())
    if "source" in dataset.columns:
        print(dataset["source"].value_counts())
    print(f"Saved: {TRAINING_PATH}")
