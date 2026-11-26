"""
Split a review into clauses that each carry one opinion about one thing.

The earlier version split only on contrast words (but, however, although), so
"The staff were kind and the bed was filthy" stayed one unit and got a single
label. It also split "not only clean but also comfortable" at "but" and left
"not only clean" looking like a negated compliment.

Steps for each sentence:
1. Rewrite constructions whose words mislead a splitter:
   "not only X but also Y" -> "X and also Y", "anything but clean" -> "not clean".
2. Split on contrast markers (but, however, although, except, despite ...).
3. Inside each part, split on "and", commas, "plus", "&" and "with".
4. Merge back pieces that cannot stand alone:
   - "clean and | comfortable": "comfortable" has no subject, so it joins the
     clause before it.
   - "the room and | the bathroom were dirty": "the room" has no opinion, so it
     joins the clause after it.
   - "I loved the pool and | the spa": "the spa" joins the clause before it.
   A piece stays separate when it has its own subject or feature and its own
   opinion ("the staff were kind" | "the bed was filthy") or its own verb
   ("the room had two chairs").
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import List, Optional, Tuple

from aspect_extraction import find_aspect_mentions
from opinion_lexicon import score_opinion
from text_preprocessing import normalize_text

# A stay duration is factual context, not a complaint about the accommodation.
# Kept narrow so that "the worst five nights" still reaches the classifier.
STAY_DURATION_FACT = re.compile(
    r"(?:we|i)\s+(?:stayed|spent|were\s+here|was\s+here)(?:\s+(?:here|there))?\s+(?:for\s+)?"
    r"(?:\d+|a|one|two|three|four|five|six|seven|eight|nine|ten|a\s+couple\s+of|a\s+few)\s+"
    r"(?:nights?|days?|weeks?)(?:\s+(?:here|there|in\s+total))?[.!]?",
    re.IGNORECASE,
)
DEMO_DISCLOSURE = re.compile(r"Demo review,?\s+not a real guest experience[.!]?", re.IGNORECASE)
FACTUAL_SENTENCES = (STAY_DURATION_FACT, DEMO_DISCLOSURE)

_SENTENCE_BREAK = re.compile(r"(?<=[.!?])\s+|\n+|\s*;\s*|(?<=[a-z][.!?])(?=[A-Z])|\s+[-–—]+\s+|\s*\|\s*")

_REWRITES: List[Tuple[re.Pattern, str]] = [
    # "...all basic comforts, but not only." -> praise that continues.
    (re.compile(r",?\s*\bbut\s+not\s+only\s*[.!]*\s*$", re.IGNORECASE), "."),
    (re.compile(r"\bnot\s+(?:only|just|merely|simply)\s+(.+?)\s*,?\s*\bbut\s+(?:also\s+|even\s+)?", re.IGNORECASE), r"\1 and also "),
    (re.compile(r"\banything\s+but\b", re.IGNORECASE), "not"),
    (re.compile(r"\bnothing\s+but\b", re.IGNORECASE), "only"),
    (re.compile(r"\bas\s+well\s+as\b", re.IGNORECASE), "and"),
    (re.compile(r"\bbut\s+also\b", re.IGNORECASE), "and also"),
]

EXCEPTION_MARKERS = {"except for", "except that", "apart from", "aside from", "other than", "in spite of", "except", "despite"}
_CONTRAST = re.compile(
    r"\s*[,;]?\s*\b(on the other hand|even though|even if|except for|except that|apart from|aside from|"
    r"other than|in spite of|but|however|although|though|whereas|whilst|while|nevertheless|"
    r"nonetheless|otherwise|except|despite|(?<!not )yet)\b\s*,?\s*",
    re.IGNORECASE,
)
_ADDITIVE = re.compile(r"(\s*,\s*(?:and\s+|plus\s+)?|\s+and\s+|\s+plus\s+|\s*&\s*|\s+with\s+)", re.IGNORECASE)

# Nouns that can be the subject of an opinion without being one of the nine aspects.
GENERIC_TARGETS = {
    "hotel", "hotels", "place", "property", "stay", "experience", "experiance", "view", "views",
    "building", "accommodation", "guesthouse", "guest", "hostel", "apartment", "resort", "trip",
    "holiday", "vacation", "visit", "everything", "atmosphere", "ambience", "ambiance", "vibe",
    "design", "architecture", "entrance", "corridor", "corridors", "hallway", "stairs", "city",
    "town", "overall", "inn", "motel", "lodge", "villa", "flat", "house", "home", "spot",
    "decoration", "property's", "neighbours", "neighbors", "booking", "reservation",
}
SUBJECT_WORDS = {
    "i", "we", "they", "it", "he", "she", "you", "everything", "everyone", "everybody", "nothing",
    "nobody", "someone", "there", "this", "that", "kids", "children", "family", "wife", "husband",
}
PREDICATE_STARTERS = {
    "is", "was", "were", "are", "am", "has", "had", "have", "did", "does", "do", "seemed", "seems",
    "looked", "looks", "felt", "feels", "tasted", "tastes", "smelled", "smells", "became", "kept",
    "would", "could", "should", "will", "can", "may", "might", "must", "got", "gets", "also",
}
VERBS = PREDICATE_STARTERS | {
    "be", "been", "being", "made", "make", "helped", "worked", "works", "stopped", "broke", "came",
    "went", "arrived", "stayed", "booked", "paid", "served", "costs", "cost", "includes", "included",
    "offers", "offered", "provided", "provides", "faces", "faced", "travelled", "traveled", "checked",
    "landed", "slept", "loved", "liked", "hated", "enjoyed", "found", "saw", "ate", "needed", "wanted",
    "tried", "asked", "told", "said", "gave", "took", "let", "accepts", "accept", "serves", "located",
    "situated", "opens", "closes", "opened", "closed", "visited", "spent", "walked", "drove", "took",
    "come", "comes", "go", "goes", "get", "need", "needs", "want", "love", "like", "hate", "enjoy",
    "recommend", "recommended", "complained", "waited", "received", "got", "upgraded", "charged",
    "allowed", "changed", "cleaned", "fixed", "ignored", "refused", "answered", "greeted", "welcomed",
}
RELATIVE_STARTERS = {"which", "who", "where", "whose", "whom"}


@dataclass
class Clause:
    text: str
    sentence_index: int
    role: str = "clause"  # clause | exception | relative | factual
    after_contrast: bool = False


@dataclass
class _Features:
    has_opinion: bool
    has_target: bool
    has_subject: bool
    has_verb: bool
    starts_with_predicate: bool
    is_relative: bool

    @property
    def self_contained(self) -> bool:
        return (self.has_target or self.has_subject) and (self.has_opinion or self.has_verb)


def _features(text: str) -> _Features:
    norm = normalize_text(text)
    tokens = norm.split()
    if not tokens:
        return _Features(False, False, False, False, False, False)
    mentions = find_aspect_mentions(tokens)
    has_target = any(m.is_target for m in mentions) or any(t in GENERIC_TARGETS for t in tokens)
    return _Features(
        has_opinion=score_opinion(text).has_opinion,
        has_target=has_target,
        has_subject=any(t in SUBJECT_WORDS for t in tokens[:3]),
        has_verb=any(t in VERBS for t in tokens) or any(len(t) > 4 and t.endswith("ed") for t in tokens),
        starts_with_predicate=tokens[0] in PREDICATE_STARTERS,
        is_relative=tokens[0] in RELATIVE_STARTERS,
    )


def split_sentences(text: str) -> List[str]:
    sentences = _SENTENCE_BREAK.split(text.strip())
    return [s.strip() for s in sentences if s and s.strip(" .,!?;:")]


def rewrite_constructions(sentence: str) -> str:
    for pattern, replacement in _REWRITES:
        sentence = pattern.sub(replacement, sentence)
    return sentence


def _clean(text: str) -> str:
    return text.strip(" ,;:.!?\t")


def _merge_pieces(text: str) -> List[Tuple[str, str]]:
    """Split one contrast part on additive boundaries and merge fragments back.

    Returns (clause text, role) pairs where role is "clause" or "relative".
    """
    raw = _ADDITIVE.split(text)
    pairs: List[Tuple[str, str]] = []  # (separator before piece, piece)
    sep = ""
    for k, chunk in enumerate(raw):
        if k % 2 == 1:
            sep = chunk
            continue
        if _clean(chunk):
            pairs.append((sep, _clean(chunk)))
        sep = ""

    units: List[List[str]] = []  # [text, role]
    carry: Optional[str] = None
    carry_sep = ""

    def last_clause() -> Optional[List[str]]:
        for unit in reversed(units):
            if unit[1] != "relative":
                return unit
        return None

    for k, (sep, piece) in enumerate(pairs):
        is_last = k == len(pairs) - 1
        piece_features = _features(piece)

        if piece_features.is_relative:
            target = last_clause()
            if piece_features.has_opinion and target is not None:
                # "the staff, who were lovely, ..." describes the noun before it.
                target[0] += sep + piece
            elif piece_features.has_opinion and carry is not None:
                carry += sep + piece
            else:
                units.append([piece, "relative"])
            continue

        if carry is not None:
            # The carried fragment keeps the separator that preceded it.
            text_now, lead_sep, carry = carry + sep + piece, carry_sep, None
        else:
            text_now, lead_sep = piece, sep
        f = _features(text_now) if text_now != piece else piece_features
        previous = last_clause()

        if f.starts_with_predicate and previous is not None:
            # "Great hotel, | would recommend", "The hotel, ..., | was dirty"
            previous[0] += lead_sep + text_now
            continue
        if f.self_contained:
            units.append([text_now, "clause"])
            continue
        if f.has_opinion and not f.has_target:
            # A predicate that shares the previous subject: "clean and | spacious".
            if previous is not None:
                previous[0] += lead_sep + text_now
            else:
                carry, carry_sep = text_now, lead_sep
            continue
        if f.has_target and not f.has_opinion:
            # A bare noun phrase: "the room and | the bathroom were dirty",
            # "I loved the pool and | the spa".
            if not is_last:
                carry, carry_sep = text_now, lead_sep
            elif previous is not None:
                previous[0] += lead_sep + text_now
            else:
                units.append([text_now, "clause"])
            continue
        # Neither a subject nor an opinion: "when we arrived", "overall".
        if previous is not None and not (f.has_subject and f.has_verb):
            previous[0] += lead_sep + text_now
        else:
            carry, carry_sep = text_now, lead_sep

    if carry is not None:
        previous = last_clause()
        if previous is not None:
            previous[0] += (carry_sep or " ") + carry
        else:
            units.append([carry, "clause"])

    return [(unit_text, role) for unit_text, role in units]


def _split_contrast(sentence: str) -> List[Tuple[Optional[str], str]]:
    """[(marker or None, text), ...] for each part between contrast markers."""
    pieces = _CONTRAST.split(sentence)
    parts: List[Tuple[Optional[str], str]] = [(None, pieces[0])]
    for k in range(1, len(pieces), 2):
        parts.append((pieces[k].lower(), pieces[k + 1] if k + 1 < len(pieces) else ""))
    return parts


def segment_review(text: str) -> List[Clause]:
    clauses: List[Clause] = []

    for sentence_index, sentence in enumerate(split_sentences(text)):
        bare = sentence.strip()
        if any(pattern.fullmatch(bare) for pattern in FACTUAL_SENTENCES):
            clauses.append(Clause(_clean(bare), sentence_index, role="factual"))
            continue

        parts = _split_contrast(rewrite_constructions(bare))
        nothing_before = True
        for marker, part in parts:
            if not _clean(part):
                continue
            is_exception = marker in EXCEPTION_MARKERS
            after_contrast = marker is not None

            if is_exception and nothing_before and "," in part:
                # "Except for the wifi, everything was great."
                exception_text, main_text = part.split(",", 1)
                if _clean(exception_text):
                    clauses.append(Clause(_clean(exception_text), sentence_index, role="exception", after_contrast=True))
                for unit_text, role in _merge_pieces(main_text):
                    clauses.append(Clause(unit_text, sentence_index, role=role))
                nothing_before = False
                continue

            for position, (unit_text, role) in enumerate(_merge_pieces(part)):
                if is_exception and position == 0 and role == "clause":
                    role = "exception"
                clauses.append(Clause(unit_text, sentence_index, role=role, after_contrast=after_contrast and position == 0))
            nothing_before = False

    if not clauses and text.strip():
        clauses.append(Clause(_clean(text) or text.strip(), 0))
    return clauses


__all__ = ["Clause", "segment_review", "split_sentences", "rewrite_constructions", "STAY_DURATION_FACT", "DEMO_DISCLOSURE"]
