"""
Aspect-based review analysis: clause segmentation + opinion lexicon + the
trained TF-IDF / Logistic Regression classifier.

For every review:
1. `clause_segmentation` splits it into clauses that each hold one opinion
   ("The staff were kind" | "the bed was filthy").
2. Each clause gets a label from two sources:
   - the opinion lexicon, which understands negation, suggestions ("would
     help"), idioms and absence ("no hot water"), and
   - the trained classifier, which has learned implicit sentiment from about
     30,000 labelled hotel review sentences.
   The lexicon decides when it finds a clear opinion word. The classifier
   decides when the lexicon finds only weak or no opinion words, and it
   supplies the confidence. A clause with no opinion at all, where the
   classifier is not confident either, is a neutral fact ("The room had two
   chairs").
3. Each aspect mention is linked to the opinion it belongs to. In a clause
   with opposite opinions, an aspect takes the nearest opinion.
4. The review is "mixed" when it contains both praise and a complaint.
"""

from __future__ import annotations

from collections import OrderedDict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional

import joblib

from aspect_extraction import ASPECT_ORDER, AspectMention, find_aspect_mentions, target_aspects
from clause_segmentation import GENERIC_TARGETS, SUBJECT_WORDS, VERBS, Clause, segment_review
from opinion_lexicon import OpinionScore, STRONG, score_opinion
from text_preprocessing import normalize_text

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "models" / "sentiment_pipeline.joblib"

# Both thresholds were chosen on a validation split of the training data
# (HRAST sentences the tuning model never saw), not on the test split.
#
# When the lexicon only found weak words ("ok", "small", "cheap"), the
# classifier may overrule it if it is at least this confident in the opposite.
CLASSIFIER_OVERRIDE = 0.80
# When the lexicon found no opinion words, the classifier must be at least
# this confident to call the clause positive or negative (implicit opinions
# such as "ants everywhere" or "it took an hour to get our key"); otherwise
# the clause is a neutral fact. 0.65 is the highest-accuracy setting at which
# the analyzer is never less accurate than the classifier alone on clauses it
# does not call mixed. Higher values keep more facts neutral but miss implicit
# complaints; lower values do the opposite.
IMPLICIT_THRESHOLD = 0.65
# A clause judged only by the classifier (no opinion words) may contradict an
# explicit opinion elsewhere in the same review only when the classifier is at
# least this confident. Short fragments such as "location" or "it was my
# second time staying" otherwise turn clear praise into a false "mixed".
IMPLICIT_CONTRADICTION_THRESHOLD = 0.95

# How sure the lexicon is in each kind of decision; blended with the classifier.
LEXICON_CONFIDENCE = {
    "factual": 0.95,
    "strong": 0.90,
    "weak": 0.70,
    "suggestion": 0.85,
    "mixed": 0.85,
    "lukewarm": 0.75,
    "no-opinion": 0.80,
}

ASPECT_LABELS = {
    "cleanliness": "cleanliness",
    "staff": "staff",
    "location": "location",
    "room": "room",
    "wifi": "Wi-Fi",
    "value": "value for money",
    "facilities": "facilities",
    "food": "food",
    "noise": "noise level",
}


def load_trained_model(path: Path = MODEL_PATH):
    if not path.exists():
        raise RuntimeError("Model file not found. Run `python train_model.py` before starting the API.")
    return joblib.load(path)


@dataclass
class ClauseResult:
    clause: Clause
    normalized: str
    score: OpinionScore
    mentions: List[AspectMention]
    probabilities: Dict[str, float]
    sentiment: str = "neutral"
    confidence: float = 0.0
    method: str = ""
    inherited_aspects: List[str] = field(default_factory=list)
    aspect_sentiments: "OrderedDict[str, str]" = field(default_factory=OrderedDict)

    @property
    def factual(self) -> bool:
        return self.clause.role == "factual"

    @property
    def has_target(self) -> bool:
        return any(m.is_target for m in self.mentions) or any(t in GENERIC_TARGETS for t in self.score.tokens)

    @property
    def has_verb(self) -> bool:
        return any(t in VERBS for t in self.score.tokens)

    @property
    def has_subject(self) -> bool:
        return any(t in SUBJECT_WORDS for t in self.score.tokens[:3])


def _blend(lexicon_confidence: float, classifier_probability: float) -> float:
    value = 0.5 * lexicon_confidence + 0.5 * classifier_probability
    return round(min(0.99, max(0.5, value)), 4)


def _opposite(label: str) -> Optional[str]:
    return {"positive": "negative", "negative": "positive"}.get(label)


def _join(items: List[str]) -> str:
    names = [ASPECT_LABELS.get(item, item) for item in items]
    if len(names) <= 1:
        return "".join(names)
    return ", ".join(names[:-1]) + " and " + names[-1]


class ReviewAnalyzer:
    def __init__(self, model):
        self.model = model
        self.classes = [str(label) for label in model.classes_]

    # ---- clause level -------------------------------------------------
    def _decide(self, result: ClauseResult) -> None:
        p = result.probabilities
        pos, neg, neu = p.get("positive", 0.0), p.get("negative", 0.0), p.get("neutral", 0.0)
        score = result.score

        def set_(label: str, confidence: float, method: str) -> None:
            result.sentiment, result.confidence, result.method = label, round(float(confidence), 4), method

        if result.factual:
            return set_("neutral", _blend(LEXICON_CONFIDENCE["factual"], neu), "factual context")

        if score.suggestion:
            # A request for an improvement is a complaint about that feature.
            # Praise elsewhere in the same clause still counts.
            if score.strong_positive:
                return set_("mixed", _blend(LEXICON_CONFIDENCE["mixed"], pos + neg), "suggestion + praise")
            return set_("negative", _blend(LEXICON_CONFIDENCE["suggestion"], neg), "suggestion")

        positive, negative = score.positive, score.negative
        if positive and negative:
            if score.strong_positive and score.strong_negative:
                return set_("mixed", _blend(LEXICON_CONFIDENCE["mixed"], pos + neg), "lexicon (opposite opinions)")
            if score.strong_positive:
                return set_("positive", _blend(LEXICON_CONFIDENCE["strong"], pos), "lexicon")
            if score.strong_negative:
                return set_("negative", _blend(LEXICON_CONFIDENCE["strong"], neg), "lexicon")
            if positive != negative:
                label = "positive" if positive > negative else "negative"
                return set_(label, _blend(LEXICON_CONFIDENCE["weak"], p.get(label, 0.0)), "lexicon (weak)")
            label = "positive" if pos >= neg else "negative"
            return set_(label, p.get(label, 0.0), "classifier")

        if positive:
            if not score.strong_positive and neg >= CLASSIFIER_OVERRIDE:
                return set_("negative", neg, "classifier (overrides weak lexicon)")
            strength = "strong" if score.strong_positive else "weak"
            return set_("positive", _blend(LEXICON_CONFIDENCE[strength], pos), "lexicon")

        if negative:
            if not score.strong_negative and pos >= CLASSIFIER_OVERRIDE:
                return set_("positive", pos, "classifier (overrides weak lexicon)")
            strength = "strong" if score.strong_negative else "weak"
            return set_("negative", _blend(LEXICON_CONFIDENCE[strength], neg), "lexicon")

        if score.lukewarm:
            return set_("neutral", _blend(LEXICON_CONFIDENCE["lukewarm"], neu), "lexicon (lukewarm)")

        best_label = "positive" if pos >= neg else "negative"
        best = max(pos, neg)
        if best >= IMPLICIT_THRESHOLD:
            return set_(best_label, best, "classifier (implicit opinion)")
        return set_("neutral", _blend(LEXICON_CONFIDENCE["no-opinion"], neu), "no opinion words")

    # ---- context across clauses ----------------------------------------
    def _resolve_context(self, results: List[ClauseResult]) -> None:
        for index, result in enumerate(results):
            same_sentence = [r for r in results if r.clause.sentence_index == result.clause.sentence_index]
            position = same_sentence.index(result)
            previous = same_sentence[position - 1] if position > 0 else None
            following = same_sentence[position + 1] if position + 1 < len(same_sentence) else None
            if previous is None and result.clause.after_contrast and index > 0:
                previous = results[index - 1]

            # "Everything was perfect except | the wifi", "We slept well despite | the noise",
            # "The room was nice but | the bathroom..." -> the bare feature is the exception.
            bare_feature = not result.score.polar and result.has_target and not result.has_verb
            if bare_feature and (result.clause.role == "exception" or result.clause.after_contrast):
                main = previous if previous is not None and not previous.factual else following
                if main is not None and _opposite(main.sentiment):
                    result.sentiment = _opposite(main.sentiment)
                    result.confidence = round(max(0.5, main.confidence * 0.9), 4)
                    result.method = f"contrast with \"{main.clause.text}\""

            # A bare predicate with no subject of its own borrows the feature of
            # the clause it contrasts with: "The room was clean but | small",
            # "Friendly | but slow staff". "Lovely hotel" and "we slept well"
            # have their own subject and borrow nothing.
            if result.score.polar and not result.has_target and not result.has_subject:
                source = None
                if (result.clause.after_contrast or result.clause.role == "exception") and previous is not None:
                    source = previous
                elif following is not None and following.clause.after_contrast:
                    source = following
                if source is not None:
                    result.inherited_aspects = target_aspects(source.mentions) or source.inherited_aspects

    @staticmethod
    def _reconcile_implicit(results: List[ClauseResult]) -> None:
        """Explicit opinions outweigh weak classifier guesses that contradict them."""
        explicit = set()
        for result in results:
            if result.method.startswith(("lexicon", "suggestion", "contrast")):
                explicit.update({"positive", "negative"} if result.sentiment == "mixed" else {result.sentiment})
        explicit &= {"positive", "negative"}
        if len(explicit) != 1:
            return
        stated = explicit.pop()
        for result in results:
            if (
                result.method.startswith("classifier (implicit")
                and result.sentiment == _opposite(stated)
                and result.confidence < IMPLICIT_CONTRADICTION_THRESHOLD
            ):
                result.sentiment = "neutral"
                result.method = "classifier guess outweighed by explicit opinion"

    # ---- aspect linking ------------------------------------------------
    @staticmethod
    def _link_aspects(result: ClauseResult) -> None:
        linked: "OrderedDict[str, set]" = OrderedDict()
        label = result.sentiment
        if label in {"positive", "negative", "neutral"}:
            for mention in result.mentions:
                linked.setdefault(mention.aspect, set()).add(label)
            for aspect in result.inherited_aspects:
                linked.setdefault(aspect, set()).add(label)
        else:
            # Opposite opinions in one clause: link each feature to its nearest opinion.
            opinions = [o for o in result.score.opinions if o.polarity != 0 and o.kind != "hypothetical"]
            for mention in result.mentions if opinions else []:
                nearest = min(opinions, key=lambda o: (abs(o.index - mention.index), o.index < mention.index))
                linked.setdefault(mention.aspect, set()).add("positive" if nearest.polarity > 0 else "negative")
            for aspect in result.inherited_aspects:
                linked.setdefault(aspect, set()).update({"positive", "negative"})

        result.aspect_sentiments = OrderedDict(
            (aspect, labels.pop() if len(labels) == 1 else "mixed") for aspect, labels in linked.items()
        )

    # ---- review level --------------------------------------------------
    @staticmethod
    def _overall(results: List[ClauseResult]) -> tuple[str, float]:
        contributing = [r for r in results if not r.factual] or results
        labels = {r.sentiment for r in contributing}
        if "mixed" in labels or {"positive", "negative"} <= labels:
            overall = "mixed"
            supporting = [r for r in contributing if r.sentiment != "neutral"]
        elif "positive" in labels:
            overall = "positive"
            supporting = [r for r in contributing if r.sentiment == "positive"]
        elif "negative" in labels:
            overall = "negative"
            supporting = [r for r in contributing if r.sentiment == "negative"]
        else:
            overall = "neutral"
            supporting = contributing
        confidence = sum(r.confidence for r in supporting) / len(supporting)
        return overall, round(float(confidence), 4)

    @staticmethod
    def _aspect_insights(results: List[ClauseResult]) -> List[dict]:
        collected: "OrderedDict[str, List[tuple[str, float]]]" = OrderedDict()
        for result in results:
            for aspect, label in result.aspect_sentiments.items():
                collected.setdefault(aspect, []).append((label, result.confidence))

        insights = []
        for aspect, entries in collected.items():
            labels = {label for label, _ in entries}
            opinions = labels - {"neutral"}
            if "mixed" in opinions or {"positive", "negative"} <= opinions:
                sentiment = "mixed"
            elif opinions:
                # An opinion outweighs a neutral mention of the same feature.
                sentiment = opinions.pop()
            else:
                sentiment = "neutral"
            supporting = [conf for label, conf in entries if label == sentiment or (sentiment == "mixed" and label != "neutral")]
            confidence = sum(supporting) / len(supporting) if supporting else 0.0
            insights.append(
                {
                    "aspect": aspect,
                    "sentiment": sentiment,
                    "confidence": round(float(confidence), 4),
                    "mentions": len(entries),
                }
            )
        order = {aspect: position for position, aspect in enumerate(collected)}
        return sorted(insights, key=lambda item: (-item["mentions"], order[item["aspect"]]))

    @staticmethod
    def _summary(overall: str, insights: List[dict]) -> str:
        praise = [i["aspect"] for i in insights if i["sentiment"] == "positive"]
        concerns = [i["aspect"] for i in insights if i["sentiment"] == "negative"]
        mixed = [i["aspect"] for i in insights if i["sentiment"] == "mixed"]
        neutral = [i["aspect"] for i in insights if i["sentiment"] == "neutral"]

        if praise and concerns:
            text = f"Guest praised {_join(praise[:3])} but raised concerns about {_join(concerns[:3])}."
        elif praise:
            text = f"Guest gave positive feedback about {_join(praise[:4])}."
            if overall == "mixed" and not mixed:
                text = f"Guest praised {_join(praise[:3])} but also raised other concerns."
        elif concerns:
            text = f"Guest raised concerns about {_join(concerns[:4])}."
            if overall == "mixed" and not mixed:
                text = f"Guest raised concerns about {_join(concerns[:3])} but also gave some praise."
        elif mixed:
            return f"Guest shared mixed feedback about {_join(mixed[:4])}."
        elif neutral:
            if overall == "mixed":
                return "Guest shared both praise and concerns."
            if overall in {"positive", "negative"}:
                return f"Review sentiment is {overall}; guest also mentioned {_join(neutral[:4])}."
            return f"Guest mentioned {_join(neutral[:4])} in a neutral way."
        else:
            if overall == "mixed":
                return "Guest shared both praise and concerns."
            return f"Review sentiment is {overall}."

        if mixed:
            text += f" Opinions on {_join(mixed[:3])} were mixed."
        return text

    # ---- public API ----------------------------------------------------
    def analyze(self, review: str) -> dict:
        clauses = segment_review(review)
        normalized = [normalize_text(clause.text) for clause in clauses]
        probability_rows = self.model.predict_proba(normalized)

        results: List[ClauseResult] = []
        for clause, norm, row in zip(clauses, normalized, probability_rows):
            # The lexicon keeps commas as boundaries; the classifier does not need them.
            score = score_opinion(clause.text)
            result = ClauseResult(
                clause=clause,
                normalized=norm,
                score=score,
                mentions=find_aspect_mentions(score.tokens),
                probabilities={label: float(value) for label, value in zip(self.classes, row)},
            )
            self._decide(result)
            results.append(result)

        self._resolve_context(results)
        self._reconcile_implicit(results)
        for result in results:
            self._link_aspects(result)

        overall, confidence = self._overall(results)
        insights = self._aspect_insights(results)

        mention_counts: Dict[str, int] = OrderedDict()
        for result in results:
            for aspect in result.aspect_sentiments:
                mention_counts[aspect] = mention_counts.get(aspect, 0) + 1
        aspects = sorted(mention_counts, key=lambda a: (-mention_counts[a], ASPECT_ORDER.index(a)))

        return {
            "sentiment": overall,
            "confidence": confidence,
            "aspects": aspects,
            "aspectInsights": insights,
            "summary": self._summary(overall, insights),
            "sentenceResults": [
                {
                    "text": r.clause.text,
                    "sentiment": r.sentiment,
                    "confidence": r.confidence,
                    "aspects": list(r.aspect_sentiments.keys()),
                    "aspectSentiments": dict(r.aspect_sentiments),
                    "factualContext": r.factual,
                    "method": r.method,
                    "opinions": [o.text for o in r.score.opinions if o.kind != "hypothetical"],
                }
                for r in results
            ],
        }


__all__ = ["ReviewAnalyzer", "load_trained_model", "MODEL_PATH", "CLASSIFIER_OVERRIDE", "IMPLICIT_THRESHOLD"]
