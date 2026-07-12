# Sentiment Model Guidance

How the sentiment **model** works, how Node integrates it, and how the frontend displays results.

Remember: sentiment is **analysis**, not recommendation. Recommendations consume its output as `ReviewAnalysisScore`.

---

## 1. What the model does

Given review text, the service returns:

- Overall **polarity**: `positive` | `negative` | `neutral` (and **mixed** logic for long conflicting reviews)
- **Confidence**
- **Aspects** (keyword themes): cleanliness, staff, room, Wi-Fi, location, value, facilities, food, noise, …
- Sentence-level / aspect insight payloads used by the UI and aggregations

Model type: **TF-IDF + Logistic Regression** (sklearn pipeline saved as joblib).

---

## 2. Sentiment-service files

Root: `sentiment-service/`

| File | Role |
|------|------|
| `app.py` | FastAPI app; loads pipeline; exposes `/health` and `/predict` |
| `text_preprocessing.py` | Normalize text + rule-based overrides |
| `train_model.py` | Train pipeline from CSV → write joblib + metrics |
| `generate_augmented_data.py` | Rebuild / augment training CSV when needed |
| `test_api.py` | Smoke tests against the API |
| `requirements.txt` | Python dependencies |
| `README.md` | Setup / train / run instructions |
| `data/sentiment_training.csv` | Training data |
| `models/sentiment_pipeline.joblib` | Trained artifact |
| `models/metrics.json` | Training metrics |

### API

| Method | Path | Body | Notes |
|--------|------|------|-------|
| `GET` | `/health` | — | Service + model loaded? |
| `POST` | `/predict` | `{ "review": "..." }` | Main inference |

Default URL used by Node: `http://localhost:8000` (env: `SENTIMENT_API_URL`).

### Train / run

```bash
cd sentiment-service
python -m venv venv
# activate venv
pip install -r requirements.txt
python train_model.py
uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

Do **not** retrain unless explicitly asked — the trained model already exists for the FYP.

---

## 3. Node.js bridge (backend)

| File | Role |
|------|------|
| `server/services/sentimentService.js` | HTTP client to FastAPI `/predict`; safe fallback if service down |
| `server/controllers/reviewController.js` | On create review → call sentiment → save on `Review` |
| `server/controllers/sentimentController.js` | Property-level sentiment summary API |
| `server/routes/reviewRoutes.js` | Review endpoints |
| `server/routes/sentimentRoutes.js` | `GET /api/sentiment/property/:propertyId` |
| `server/models/Review.js` | Stores sentiment label, confidence, aspects, etc. |
| `server/models/Property.js` | `sentimentSnapshot` denormalized summary |
| `server/utils/propertySentimentStore.js` | Rebuild / sync property snapshot after reviews |
| `server/utils/sentimentAggregation.js` | Aggregate counts, percents, praised/concern aspects |
| `server/utils/reviewSentimentRecommendation.js` | Convert snapshot → **ReviewAnalysisScore** for ranking |
| `server/scripts/reanalyzeReviews.js` | Re-run sentiment on existing reviews |
| `server/scripts/syncPropertySentiment.js` | Rebuild snapshots |

### Create-review flow

```text
Guest submits review
  → reviewController
  → sentimentService.predict(text)
  → save Review with sentiment fields
  → update Property.sentimentSnapshot
  → UI reads summary + badges
  → recommendation engine later reads snapshot as ReviewAnalysisScore
```

If FastAPI is down, the service should fail soft (neutral / safe fallback) so booking/review UX does not hard-crash — check `sentimentService.js` behaviour when debugging.

---

## 4. ReviewAnalysisScore (link to recommendations)

File: `server/utils/reviewSentimentRecommendation.js`  
Weights: `REVIEW_ANALYSIS_FEATURE_WEIGHTS` in `recommendationWeights.js`

Typical mix:

- Polarity  
- Aspect satisfaction  
- Insight type (praised / mixed / concerns)  
- Credibility (review volume)  
- Negative-share penalty  

This score is **one input** to hybrid recommendation. See [recommendations.md](./recommendations.md).

---

## 5. Frontend (sentiment UI)

| File / area | Role |
|-------------|------|
| `client/src/pages/ReviewSentimentTestPage.jsx` | Dev/test page at `/review-sentiment-test` |
| `client/src/services/reviewService.js` | Create/list reviews |
| `client/src/components/reviews/*` | Form, list, sentiment badges, result cards, summary |
| `client/src/components/properties/*` | Property sentiment snapshot widgets |
| `client/src/lib/sentimentInsights.js` | Insight helpers for display |
| `client/src/lib/reviewAspects.js` | Aspect labels / mapping for UI |

Do not hardcode aspect/sentiment labels in components when translation keys exist — use i18n for UI chrome; keep raw review text untranslated.

---

## 6. What is in scope vs out of scope

| In scope | Out of scope |
|----------|--------------|
| Analyze guest reviews | Chatbot that “recommends” via sentiment alone |
| Show polarity / aspects on property | Retraining in production on every request |
| Feed ReviewAnalysis into ranking | Replacing Bayesian / personalization with ML ranking |

---

## 7. Debugging checklist

1. Is `sentiment-service` running on port 8000? (`GET /health`)  
2. Is `SENTIMENT_API_URL` correct in server `.env`?  
3. Does creating a review write `sentiment` fields on the Review document?  
4. Does `Property.sentimentSnapshot` update?  
5. Does `/api/sentiment/property/:id` return counts/percents?  
6. Do recommendations still work if sentiment is missing (neutral feature path)?  
