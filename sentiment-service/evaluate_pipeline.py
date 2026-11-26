"""
Evaluate the full review analysis pipeline on hand-labelled guest reviews.

The classifier metrics in models/metrics.json measure single sentences. This
script measures what the app returns: the overall label for a whole review and
the label of each hotel aspect (room, staff, Wi-Fi and so on).

Run:
python evaluate_pipeline.py            # summary by category
python evaluate_pipeline.py --failures # also list every wrong prediction
"""

from __future__ import annotations

import argparse
import json
from collections import defaultdict
from pathlib import Path
from typing import Callable, Dict, List

BASE_DIR = Path(__file__).resolve().parent
CASES_PATH = BASE_DIR / "data" / "evaluation_cases.json"


def load_cases(path: Path = CASES_PATH) -> List[dict]:
    return json.loads(path.read_text(encoding="utf-8"))["cases"]


def evaluate(analyze: Callable[[str], dict], cases: List[dict] | None = None) -> dict:
    """Score `analyze(review) -> response` against the labelled cases."""
    cases = cases if cases is not None else load_cases()
    by_category: Dict[str, Dict[str, int]] = defaultdict(lambda: {"total": 0, "correct": 0})
    failures = []
    sentiment_correct = 0
    aspect_total = 0
    aspect_correct = 0
    fully_correct = 0

    for case in cases:
        result = analyze(case["review"])
        predicted_aspects = {item["aspect"]: item["sentiment"] for item in result.get("aspectInsights", [])}
        sentiment_ok = result["sentiment"] == case["sentiment"]
        wrong_aspects = {
            aspect: {"expected": expected, "predicted": predicted_aspects.get(aspect, "missing")}
            for aspect, expected in case.get("aspects", {}).items()
            if predicted_aspects.get(aspect) != expected
        }
        expected_aspect_count = len(case.get("aspects", {}))

        sentiment_correct += sentiment_ok
        aspect_total += expected_aspect_count
        aspect_correct += expected_aspect_count - len(wrong_aspects)
        case_ok = sentiment_ok and not wrong_aspects
        fully_correct += case_ok

        bucket = by_category[case["category"]]
        bucket["total"] += 1
        bucket["correct"] += case_ok

        if not case_ok:
            failures.append(
                {
                    "category": case["category"],
                    "review": case["review"],
                    "expected": case["sentiment"],
                    "predicted": result["sentiment"],
                    "wrongAspects": wrong_aspects,
                    "summary": result.get("summary", ""),
                }
            )

    total = len(cases)
    return {
        "cases": total,
        "review_sentiment_accuracy": round(sentiment_correct / total, 4) if total else 0.0,
        "aspect_sentiment_accuracy": round(aspect_correct / aspect_total, 4) if aspect_total else 0.0,
        "fully_correct_rate": round(fully_correct / total, 4) if total else 0.0,
        "review_sentiment_correct": sentiment_correct,
        "aspect_checks": aspect_total,
        "aspect_checks_correct": aspect_correct,
        "fully_correct": fully_correct,
        "by_category": {name: dict(values) for name, values in sorted(by_category.items())},
        "failures": failures,
    }


def print_report(report: dict, show_failures: bool = False) -> None:
    print(f"Cases: {report['cases']}")
    print(
        f"Review sentiment accuracy: {report['review_sentiment_correct']}/{report['cases']} "
        f"({report['review_sentiment_accuracy']:.1%})"
    )
    print(
        f"Aspect sentiment accuracy: {report['aspect_checks_correct']}/{report['aspect_checks']} "
        f"({report['aspect_sentiment_accuracy']:.1%})"
    )
    print(f"Fully correct reviews: {report['fully_correct']}/{report['cases']} ({report['fully_correct_rate']:.1%})")
    print("\nBy category (review label and every checked aspect correct):")
    for name, values in report["by_category"].items():
        print(f"  {name:22s} {values['correct']:3d}/{values['total']:<3d}")

    if show_failures and report["failures"]:
        print("\nFailures:")
        for item in report["failures"]:
            print(f"  [{item['category']}] {item['review']}")
            print(f"      expected {item['expected']}, got {item['predicted']}")
            for aspect, detail in item["wrongAspects"].items():
                print(f"      aspect {aspect}: expected {detail['expected']}, got {detail['predicted']}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--failures", action="store_true", help="list every wrong prediction")
    args = parser.parse_args()

    from review_analyzer import ReviewAnalyzer, load_trained_model

    analyzer = ReviewAnalyzer(load_trained_model())
    print_report(evaluate(analyzer.analyze), show_failures=args.failures)


if __name__ == "__main__":
    main()
