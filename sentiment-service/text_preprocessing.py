"""
Shared text preprocessing for sentiment training and inference.

Rules that matter for hotel reviews:
- Negation words (not, never, no, n't) are never removed.
- Modal verbs (would, should, could, will, can, may, might, must) are never
  removed. "Good Wi-Fi helped a lot" is praise, while "Good Wi-Fi would help a
  lot" asks for an improvement; the modal verb is the only difference.
- Contractions are expanded ("wasn't" -> "was not") so that the model sees the
  same negation feature however the guest typed it.
"""

from __future__ import annotations

import re
from typing import Iterable, List

# Keep negators out of stop-word filtering. They change sentiment completely.
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
    "hardly",
    "barely",
    "scarcely",
    "without",
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

# Words that carry opinion or intent in reviews and must stay in the features.
# "would/should/could" mark suggestions, "too" marks excess ("too small"),
# "only/also/again/more/few" change meaning ("would stay again", "few options").
SENTIMENT_CARRYING_WORDS = {
    "would",
    "should",
    "could",
    "will",
    "can",
    "may",
    "might",
    "must",
    "shall",
    "too",
    "only",
    "also",
    "again",
    "more",
    "most",
    "few",
    "against",
    "off",
    "out",
    "down",
}

# Light stop words for filler only.
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
    "in",
    "on",
    "over",
    "under",
    "further",
    "once",
    "here",
    "there",
    "all",
    "each",
    "other",
    "some",
    "such",
    "own",
    "same",
    "so",
    "than",
    "very",
    "just",
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
}

NEGATION_PATTERN = re.compile(
    r"\b(?:"
    r"not|no|never|none|nothing|nobody|nowhere|neither|nor|hardly|barely|scarcely|"
    r"cannot|can't|cant|won't|wouldn't|shouldn't|couldn't|"
    r"don't|doesn't|didn't|isn't|aren't|wasn't|weren't|"
    r"haven't|hasn't|hadn't"
    r")\b",
    re.IGNORECASE,
)

# Positive words that, when negated, make a reliable complaint.
# "bad" is deliberately absent: "not bad" is mild praise, not a complaint.
_NEGATABLE_PRAISE = (
    r"good|great|nice|clean|helpful|friendly|comfortable|worth|recommended|"
    r"satisfied|happy|pleasant|excellent|amazing|perfect|ok|okay|fine|well|"
    r"working|cooperative|polite|fast|reliable|fresh|tasty|delicious"
)

INFORMAL_NEGATIVE_PATTERNS = [
    re.compile(
        r"\bnot\s+(?:too\s+|so\s+|very\s+|that\s+|much\s+|really\s+|"
        r"at\s+all\s+|even\s+|too\s+much\s+)*(?:" + _NEGATABLE_PRAISE + r")\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\b(?:service|staff|room|wifi|food|breakfast|location|hotel|"
        r"accommodation|stay|experience)\s+(?:is|was|were|are)\s+not\s+"
        r"(?:(?:very|so|too|that|really|at\s+all)\s+)*(?:" + _NEGATABLE_PRAISE + r")\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\b(?:would|will|could|should|do|did|can)\s+not\s+recommend\b",
        re.IGNORECASE,
    ),
    re.compile(r"\bnot\s+(?:recommend|recommended|worth|enjoy)\b", re.IGNORECASE),
    re.compile(r"\b(?:poor|bad|terrible|awful|horrible|disappointing)\s+service\b", re.IGNORECASE),
    re.compile(r"\b(?:worst|waste\s+of\s+money|never\s+again|do\s+not\s+stay)\b", re.IGNORECASE),
]

_APOSTROPHES = str.maketrans(
    {
        "’": "'",
        "‘": "'",
        "ʼ": "'",
        "´": "'",
        "`": "'",
        # The HRAST export lost its curly apostrophes and stores U+FFFD instead
        # ("don�t"). Treat it as an apostrophe so the word is not split.
        "�": "'",
    }
)

_CONTRACTIONS = [
    (re.compile(r"\bwon't\b"), "will not"),
    (re.compile(r"\bcan't\b"), "can not"),
    (re.compile(r"\bcannot\b"), "can not"),
    (re.compile(r"\bshan't\b"), "shall not"),
    (re.compile(r"\bain't\b"), "is not"),
    (re.compile(r"n't\b"), " not"),
    # Apostrophe-free informal spellings: dont, didnt, wasnt, cant, wont ...
    (re.compile(r"\b(do|does|did|is|was|were|are|has|have|had|could|would|should)nt\b"), r"\1 not"),
    (re.compile(r"\bcant\b"), "can not"),
    (re.compile(r"\bwont\b"), "will not"),
    (re.compile(r"'re\b"), " are"),
    (re.compile(r"'ve\b"), " have"),
    (re.compile(r"'ll\b"), " will"),
    (re.compile(r"'d\b"), " would"),
    (re.compile(r"'m\b"), " am"),
    (re.compile(r"\b(it|that|there|here|what|who|he|she|everything|nothing)'s\b"), r"\1 is"),
]

# Spelling variants that should share one feature.
_VARIANTS = [
    (re.compile(r"\bwi[\s\-]?fi\b"), "wifi"),
    (re.compile(r"\ba\s*/\s*c\b"), "ac"),
    (re.compile(r"\bair[\s\-]?con\b"), "air conditioning"),
    (re.compile(r"\bair[\s\-]conditioning\b"), "air conditioning"),
    (re.compile(r"\bair[\s\-]?conditioner\b"), "air conditioner"),
    (re.compile(r"\bcheck[\s\-]in\b"), "checkin"),
    (re.compile(r"\bcheck[\s\-]out\b"), "checkout"),
]


def normalize_text(value: object) -> str:
    """Lower-case, unify apostrophes and spellings, expand contractions, drop punctuation."""
    if value is None:
        return ""

    text = str(value).strip().lower().translate(_APOSTROPHES)
    for pattern, replacement in _VARIANTS:
        text = pattern.sub(replacement, text)
    for pattern, replacement in _CONTRACTIONS:
        text = pattern.sub(replacement, text)
    text = re.sub(r"[^\w\s'\-]", " ", text)
    # Possessive or stray apostrophes ("hotel's", "conditioning's") carry no sentiment.
    text = re.sub(r"'s\b", "", text)
    text = text.replace("'", "")
    text = re.sub(r"(?<!\w)-|-(?!\w)", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def has_negation(text: str) -> bool:
    return bool(NEGATION_PATTERN.search(text))


def detect_rule_based_sentiment(text: str) -> str | None:
    """High-precision overrides for common negated-praise mistakes."""
    normalized = normalize_text(text)
    if not normalized:
        return None

    for pattern in INFORMAL_NEGATIVE_PATTERNS:
        if pattern.search(normalized):
            return "negative"

    return None


def get_custom_stop_words() -> List[str]:
    return sorted(CUSTOM_STOP_WORDS - NEGATORS - SENTIMENT_CARRYING_WORDS)


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
    ("The room had two chairs.", "neutral"),
    ("Good Wi-Fi helped a lot.", "positive"),
    ("Good Wi-Fi would help a lot.", "negative"),
    ("The breakfast was not bad at all.", "positive"),
)
