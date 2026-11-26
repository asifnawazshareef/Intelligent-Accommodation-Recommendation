"""
Regression tests for the review analyzer.

Run from sentiment-service/:
python -m unittest discover -s tests -v
"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

SERVICE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE_DIR))

from clause_segmentation import segment_review  # noqa: E402
from evaluate_pipeline import evaluate  # noqa: E402
from opinion_lexicon import score_opinion  # noqa: E402
from review_analyzer import ReviewAnalyzer, load_trained_model  # noqa: E402

# Must match client/src/i18n/*.json -> review.aspects and the Review model enum.
ASPECTS = {"cleanliness", "staff", "location", "room", "wifi", "value", "facilities", "food", "noise"}
LABELS = {"positive", "negative", "neutral", "mixed"}


class AnalyzerTestCase(unittest.TestCase):
    analyzer: ReviewAnalyzer

    @classmethod
    def setUpClass(cls):
        cls.analyzer = ReviewAnalyzer(load_trained_model())

    def assertAnalysis(self, review: str, sentiment: str, aspects: dict | None = None):
        result = self.analyzer.analyze(review)
        self.assertEqual(result["sentiment"], sentiment, f"{review!r}: {result['summary']}")
        found = {item["aspect"]: item["sentiment"] for item in result["aspectInsights"]}
        for aspect, expected in (aspects or {}).items():
            self.assertEqual(found.get(aspect), expected, f"{review!r} aspect {aspect}: {found}")
        return result


class UserReportedCases(AnalyzerTestCase):
    def test_mixed_opinion_joined_by_and(self):
        self.assertAnalysis(
            "The staff were kind and the bed was filthy.",
            "mixed",
            {"staff": "positive", "room": "negative", "cleanliness": "negative"},
        )

    def test_not_only_but_also_is_praise(self):
        self.assertAnalysis("The hotel was not only clean but also comfortable.", "positive", {"cleanliness": "positive"})

    def test_neutral_fact(self):
        self.assertAnalysis("The room had two chairs.", "neutral", {"room": "neutral"})

    def test_praise_versus_polite_request(self):
        self.assertAnalysis("Good Wi-Fi helped a lot.", "positive", {"wifi": "positive"})
        self.assertAnalysis("Good Wi-Fi would help a lot.", "negative", {"wifi": "negative"})

    def test_room_and_wifi_with_every_connector(self):
        for connector in (" and ", " but ", ", ", " however ", ", while "):
            review = f"room was bad{connector}WIFI internet was good."
            result = self.assertAnalysis(review, "mixed", {"room": "negative", "wifi": "positive"})
            self.assertIn("praised Wi-Fi", result["summary"])
            self.assertIn("concerns about room", result["summary"])
        for connector in (" and ", " but "):
            self.assertAnalysis(f"room was good{connector}WIFI internet was bad.", "mixed", {"room": "positive", "wifi": "negative"})


class MixedAndSameOpinionCompounds(AnalyzerTestCase):
    def test_lists_with_different_opinions(self):
        self.assertAnalysis("Great location, friendly staff, dirty room.", "mixed", {"location": "positive", "staff": "positive", "room": "negative"})
        self.assertAnalysis("Nice hotel with dirty rooms.", "mixed", {"cleanliness": "negative"})
        self.assertAnalysis("The friendly staff made up for the dirty room.", "mixed", {"staff": "positive", "cleanliness": "negative"})

    def test_same_opinion_compounds_are_not_mixed(self):
        self.assertAnalysis("The room was clean and comfortable.", "positive")
        self.assertAnalysis("The location, the staff and the breakfast were all excellent.", "positive", {"location": "positive", "staff": "positive", "food": "positive"})
        self.assertAnalysis("The room and the bathroom were filthy.", "negative", {"room": "negative"})
        self.assertAnalysis("Neither the room nor the bathroom was clean.", "negative")

    def test_exceptions_and_concessions(self):
        self.assertAnalysis("Everything was perfect except the wifi.", "mixed", {"wifi": "negative"})
        self.assertAnalysis("Except for the wifi, everything was great.", "mixed", {"wifi": "negative"})
        self.assertAnalysis("We slept well despite the noise.", "mixed", {"noise": "negative"})
        self.assertAnalysis("Friendly but slow staff.", "mixed", {"staff": "mixed"})

    def test_negation(self):
        self.assertAnalysis("It's not too much good service.", "negative")
        self.assertAnalysis("The breakfast was not bad at all.", "positive")
        self.assertAnalysis("The staff couldn't have been more helpful.", "positive")
        self.assertAnalysis("The room was far from clean.", "negative")
        self.assertAnalysis("No hot water in the shower.", "negative")


class ResponseContract(AnalyzerTestCase):
    """The Express server rejects responses that break these rules (sentimentService.js)."""

    REVIEWS = [
        "room was bad and WIFI internet was good.",
        "The room had two chairs.",
        "Excellent!",
        "x",
        "Demo review, not a real guest experience. The staff were friendly, but the room was noisy. We stayed for 2 nights.",
        "The staff were kind, the bed was filthy and the wifi was slow. Breakfast was average. Would not recommend.",
    ]

    def test_response_shape(self):
        for review in self.REVIEWS:
            with self.subTest(review=review):
                result = self.analyzer.analyze(review)
                self.assertIn(result["sentiment"], LABELS)
                self.assertGreaterEqual(result["confidence"], 0.0)
                self.assertLessEqual(result["confidence"], 1.0)
                self.assertTrue(result["summary"].strip())
                self.assertTrue(all(isinstance(a, str) and a in ASPECTS for a in result["aspects"]))
                for insight in result["aspectInsights"]:
                    self.assertIn(insight["aspect"], ASPECTS)
                    self.assertIn(insight["sentiment"], LABELS)
                    self.assertGreaterEqual(insight["confidence"], 0.0)
                    self.assertLessEqual(insight["confidence"], 1.0)
                    self.assertIsInstance(insight["mentions"], int)
                    self.assertGreaterEqual(insight["mentions"], 1)
                self.assertIsInstance(result["sentenceResults"], list)


class SeededDemoReviews(AnalyzerTestCase):
    """Texts from server/services/seed/generator.js and the server's real-model test."""

    COMMENTS = {
        "positive": [
            "The room was spotless and the staff were helpful.",
            "The bed was comfortable and the location was convenient.",
            "Breakfast was fresh and the service was excellent.",
        ],
        "negative": [
            "The room was dirty and the staff were unhelpful.",
            "The room was noisy and the bed was uncomfortable.",
            "The wifi failed and the service was disappointing.",
        ],
        "neutral": [
            "The room was acceptable and the service was ordinary.",
            "It was a standard stay with basic facilities.",
            "The location and price were about average.",
        ],
        "mixed": [
            "The staff were friendly, but the room was noisy.",
            "The location was excellent, but the bathroom was dirty.",
            "The bed was comfortable, but the wifi was unreliable.",
        ],
    }

    def test_seed_templates_keep_their_intended_label(self):
        for sentiment, comments in self.COMMENTS.items():
            for comment in comments:
                for text in (
                    comment,
                    f"{comment} We stayed for 3 nights.",
                    f"Demo review, not a real guest experience. {comment} We stayed for 2 nights.",
                ):
                    with self.subTest(text=text):
                        self.assertEqual(self.analyzer.analyze(text)["sentiment"], sentiment)

    def test_stay_duration_alone_is_neutral(self):
        self.assertAnalysis("We stayed for 5 nights.", "neutral")


class Segmentation(unittest.TestCase):
    def texts(self, review):
        return [clause.text for clause in segment_review(review)]

    def test_and_splits_independent_clauses_only(self):
        self.assertEqual(self.texts("The staff were kind and the bed was filthy."), ["The staff were kind", "the bed was filthy"])
        self.assertEqual(self.texts("The room was clean and comfortable."), ["The room was clean and comfortable"])
        self.assertEqual(self.texts("The room and the bathroom were filthy."), ["The room and the bathroom were filthy"])
        self.assertEqual(self.texts("We loved the pool and the spa."), ["We loved the pool and the spa"])

    def test_not_only_but_also_is_not_split_as_contrast(self):
        self.assertEqual(self.texts("The hotel was not only clean but also comfortable."), ["The hotel was clean and also comfortable"])


class Lexicon(unittest.TestCase):
    def polarity(self, text):
        score = score_opinion(text)
        return (score.positive > 0, score.negative > 0, score.suggestion)

    def test_modal_verbs_mark_requests(self):
        self.assertEqual(self.polarity("Good Wi-Fi would help a lot"), (False, True, True))
        self.assertEqual(self.polarity("Good Wi-Fi helped a lot"), (True, False, False))
        self.assertEqual(self.polarity("The staff would always help us"), (True, False, False))
        self.assertEqual(self.polarity("I would recommend this hotel"), (True, False, False))
        self.assertEqual(self.polarity("I would not recommend this hotel"), (False, True, False))

    def test_context_words(self):
        self.assertEqual(self.polarity("a small fridge"), (False, False, False))
        self.assertEqual(self.polarity("the room was small"), (False, True, False))
        self.assertEqual(self.polarity("there is a safe in the room"), (False, False, False))
        self.assertEqual(self.polarity("central station"), (False, False, False))
        self.assertEqual(self.polarity("a cheap mattress"), (False, True, False))

    def test_negation_stops_at_punctuation(self):
        self.assertEqual(self.polarity("little to no public transport, expensive parking"), (False, True, False))


class EvaluationSuite(AnalyzerTestCase):
    def test_hand_labelled_reviews(self):
        report = evaluate(self.analyzer.analyze)
        failures = [f"{f['review']} -> {f['predicted']}" for f in report["failures"]]
        self.assertGreaterEqual(report["review_sentiment_accuracy"], 0.98, failures)
        self.assertGreaterEqual(report["aspect_sentiment_accuracy"], 0.98, failures)


if __name__ == "__main__":
    unittest.main()
