"""
Shared text preprocessing for sentiment training and inference.

Critical: negation words (not, never, no, n't) must never be removed.
"""

from __future__ import annotations

import re
from typing import Iterable, List

# Keep negators out of stop-word filtering — they change sentiment completely.
NEGATORS = {
    "not",
    "no",
    "never",
    "none",
    "nothing",
    "nobody",
    "nowhere",
    "neither",
    "nor",
    "cannot",
    "cant",
    "won't",
    "wouldn't",
    "shouldn't",
    "couldn't",
    "don't",
    "doesn't",
    "didn't",
    "isn't",
    "aren't",
    "wasn't",
    "weren't",
    "haven't",
    "hasn't",
    "hadn't",
}

# Light stop words for filler only — negators excluded.
CUSTOM_STOP_WORDS = {
    "a",
    "an",
    "the",
    "and",
    "or",
    "but",
    "if",
    "then",
    "else",
    "when",
    "at",
    "by",
    "for",
    "with",
    "about",
    "against",
    "between",
    "into",
    "through",
    "during",
    "before",
    "after",
    "above",
    "below",
    "to",
    "from",
    "up",
    "down",
    "in",
    "out",
    "on",
    "off",
    "over",
    "under",
    "again",
    "further",
    "once",
    "here",
    "there",
    "all",
    "each",
    "few",
    "more",
    "most",
    "other",
    "some",
    "such",
    "only",
    "own",
    "same",
    "so",
    "than",
    "too",
    "very",
    "just",
    "also",
    "now",
    "it",
    "its",
    "this",
    "that",
    "these",
    "those",
    "i",
    "me",
    "my",
    "we",
    "our",
    "you",
    "your",
    "he",
    "him",
    "his",
    "she",
    "her",
    "they",
    "them",
    "their",
    "what",
    "which",
    "who",
    "whom",
    "as",
    "of",
    "is",
    "am",
    "are",
    "was",
    "were",
    "be",
    "been",
    "being",
    "have",
    "has",
    "had",
    "do",
    "does",
    "did",
    "will",
    "would",
    "shall",
    "should",
    "can",
    "could",
    "may",
    "might",
    "must",
}

NEGATION_PATTERN = re.compile(
    r"\b(?:"
    r"not|no|never|none|nothing|nobody|nowhere|neither|nor|"
    r"cannot|can't|cant|won't|wouldn't|shouldn't|couldn't|"
    r"don't|doesn't|didn't|isn't|aren't|wasn't|weren't|"
    r"haven't|hasn't|hadn't"
    r")\b",
    re.IGNORECASE,
)

INFORMAL_NEGATIVE_PATTERNS = [
    re.compile(
        r"\bnot\s+(?:too\s+|so\s+|very\s+|that\s+|much\s+|really\s+|"
        r"at\s+all\s+|even\s+)?(?:good|great|nice|clean|helpful|friendly|"
        r"comfortable|worth|recommended|satisfied|happy|pleasant|"
        r"excellent|amazing|perfect|ok|okay|fine|bad|well)\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\b(?:service|staff|room|wifi|food|breakfast|location|hotel|"
        r"accommodation|stay|experience)\s+(?:is|was|were|are)\s+not\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\b(?:would|will|could|should)\s+not\s+recommend\b",
        re.IGNORECASE,
    ),
    re.compile(r"\bnot\s+(?:recommend|recommended|worth|enjoy)\b", re.IGNORECASE),
    re.compile(r"\b(?:poor|bad|terrible|awful|horrible|disappointing)\s+service\b", re.IGNORECASE),
    re.compile(r"\b(?:worst|waste\s+of\s+money|never\s+again|do\s+not\s+stay)\b", re.IGNORECASE),
]


def normalize_text(value: object) -> str:
    if value is None:
        return ""

    text = str(value).strip().lower()
    text = text.replace("'", "'").replace("`", "'")
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"[^\w\s'\-]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def has_negation(text: str) -> bool:
    return bool(NEGATION_PATTERN.search(text))


def detect_rule_based_sentiment(text: str) -> str | None:
    """High-precision overrides for common negation mistakes."""
    normalized = normalize_text(text)
    if not normalized:
        return None

    for pattern in INFORMAL_NEGATIVE_PATTERNS:
        if pattern.search(normalized):
            return "negative"

    return None


def get_custom_stop_words() -> List[str]:
    return sorted(CUSTOM_STOP_WORDS - NEGATORS)


HARD_NEGATION_TEST_CASES: Iterable[tuple[str, str]] = (
    ("It's not too much good service.", "negative"),
    ("The service was not good at all.", "negative"),
    ("Staff was not helpful and room was dirty.", "negative"),
    ("Not a good experience, would not recommend.", "negative"),
    ("Room is not clean and wifi is not working.", "negative"),
    ("Hotel is not worth the money.", "negative"),
    ("Not so good wifi connection.", "negative"),
    ("Air conditioning's not good.", "negative"),
    ("The room was clean and staff was friendly.", "positive"),
    ("Excellent service and very clean rooms.", "positive"),
    ("The hotel is located near the city center.", "neutral"),
    ("We stayed here for three nights.", "neutral"),
)
