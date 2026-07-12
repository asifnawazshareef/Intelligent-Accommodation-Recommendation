# Workflow: Review & Sentiment Analysis

Actors: **Guest** (writes review), **sentiment-service** (analyzes), **recommendation engine** (later consumes feature)

---

## Goal

Convert review text into structured sentiment, store it, display it, and feed `ReviewAnalysisScore` into ranking.

---

## Steps

1. Guest completes eligible booking (paid/confirmed)  
2. UI checks `GET /api/reviews/eligible/:propertyId`  
3. Guest submits rating + text → `POST /api/reviews`  
4. `reviewController` calls `sentimentService.js`  
5. HTTP `POST {SENTIMENT_API_URL}/predict` with `{ review }`  
6. FastAPI (`app.py`) runs TF-IDF + Logistic Regression (+ aspect rules)  
7. Response polarity / confidence / aspects saved on `Review`  
8. `propertySentimentStore` / aggregation updates `Property.sentimentSnapshot`  
9. Property page shows badges/summary via review components + `GET /api/sentiment/property/:id`  
10. On next recommendations run, `reviewSentimentRecommendation.js` builds ReviewAnalysisScore  

---

## Separation of concerns

```text
Sentiment model  →  analyzes text
Aggregation      →  property snapshot
ReviewAnalysis   →  numerical FEATURE
Recommendation   →  ranks using feature + Bayesian + personalization
```

---

## Files

| Layer | Files |
|-------|-------|
| UI | `components/reviews/*`, property sentiment widgets, `ReviewSentimentTestPage` |
| Services | `reviewService.js` |
| Controllers | `reviewController.js`, `sentimentController.js` |
| Bridge | `services/sentimentService.js` |
| ML | `sentiment-service/app.py`, `text_preprocessing.py`, `models/sentiment_pipeline.joblib` |
| Store | `propertySentimentStore.js`, `sentimentAggregation.js`, `Review.js`, `Property.js` |
| Ranking feature | `reviewSentimentRecommendation.js` |

Full model guide: [sentiment-model.md](./sentiment-model.md)

---

## Ops scripts

- `npm run reanalyze:reviews` — re-run ML on existing reviews  
- Server `syncPropertySentiment` — rebuild snapshots  

---

## Failure handling

If sentiment-service is down, Node should fail soft (neutral/fallback) so review creation still behaves predictably — verify in `sentimentService.js` when debugging.

---

## Test

- [ ] Eligible booking can review; ineligible cannot  
- [ ] Positive text → positive (or mixed) label  
- [ ] Aspects appear when keywords present  
- [ ] Property sentiment summary updates  
- [ ] Recommendations still work if some properties lack reviews  
