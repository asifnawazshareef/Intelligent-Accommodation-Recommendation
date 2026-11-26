# ISAR Sentiment Analysis Service

Self-trained, aspect-based sentiment analysis for guest reviews in the Intelligent Accommodation Recommendation System.

For each review the service returns:

- an overall label: `positive`, `negative`, `neutral` or `mixed`
- the label of each hotel feature the guest mentions (cleanliness, staff, location, room, Wi-Fi, value, facilities, food, noise)
- a one-sentence summary such as "Guest praised Wi-Fi but raised concerns about room."

## How a review is analysed

```text
review
  │
  ├─ 1. clause_segmentation.py   split into clauses that each hold one opinion
  │      "room was bad and WIFI internet was good" -> "room was bad" | "WIFI internet was good"
  │      "clean and comfortable" stays together; "not only X but also Y" is not split as a contrast
  │
  ├─ 2. per clause, two opinions are combined (review_analyzer.py)
  │      opinion_lexicon.py   hotel-domain opinion words with negation, idioms,
  │                           suggestions ("would help", "could be better"),
  │                           absence ("no hot water") and context ("small fridge" vs "small room")
  │      trained classifier   TF-IDF (1-3 grams) + Logistic Regression, about 33,000 sentences
  │      The lexicon decides when it finds a clear opinion word. The classifier decides
  │      implicit opinions ("ants everywhere") and supplies the confidence.
  │      A clause with no opinion that the classifier is not confident about is a neutral fact.
  │
  ├─ 3. aspect_extraction.py      link each feature to the opinion that describes it
  │
  └─ 4. review label              mixed when the review contains praise and a complaint
```

Each entry in `sentenceResults` shows the clause, its label and which rule or model decided it (`method`), so every answer can be explained.

## Files

```text
sentiment-service/
├── app.py                      FastAPI service (/health, /predict)
├── review_analyzer.py          combines the steps below into one analysis
├── clause_segmentation.py      sentence and clause splitting
├── opinion_lexicon.py          opinion words, negation, suggestions, idioms
├── aspect_extraction.py        the nine hotel aspects and their keywords
├── text_preprocessing.py       normalization shared by training and the API
├── generate_augmented_data.py  builds data/sentiment_training.csv
├── train_model.py              trains the classifier and writes models/metrics.json
├── evaluate_pipeline.py        scores the full analysis on hand-labelled reviews
├── test_api.py                 manual client for a running API
├── tests/test_review_analyzer.py
├── data/
│   ├── sentiment_training.csv  HRAST hotel review sentences + augmentation
│   └── evaluation_cases.json   180 hand-labelled reviews, never used for training
└── models/
    ├── sentiment_pipeline.joblib
    └── metrics.json
```

## Setup

From the project root:

```bash
npm.cmd run sentiment:setup
```

Or manually:

```bash
python -m venv .venv
.venv\Scripts\activate          # Windows
source .venv/bin/activate       # macOS/Linux
pip install -r requirements.txt
```

## Train, evaluate and test

```bash
python generate_augmented_data.py   # only after changing data or the lexicon
python train_model.py               # trains, then evaluates the classifier and the full analysis
python evaluate_pipeline.py --failures
python -m unittest discover -s tests -v
```

`generate_augmented_data.py` rebuilds the CSV from the original HRAST rows each time, so running it twice gives the same file.

## Results

Measured by `train_model.py` on the held-out test split and by `evaluate_pipeline.py`.

| Measure | Before | After |
| --- | --- | --- |
| Hand-labelled reviews, overall label (180) | 107 (59.4%) | **179 (99.4%)** |
| Hand-labelled reviews, aspect labels (182 checks) | 128 (70.3%) | **182 (100%)** |
| Reviews joined by "and" with opposite opinions (17) | 0 | **17** |
| Comma lists with opposite opinions (7) | 0 | **7** |
| Neutral facts (24) | 6 | **23** |
| Suggestions such as "would help", "could be better" (16) | 12 | **16** |
| Classifier accuracy, all test sentences (the test split changed with the dataset) | 90.8% | 93.6% |
| Neutral recall, real HRAST test sentences | 30 of 125 (24%) | 37 of 123 (30%) |
| Neutral recall, HRAST neutral sentences with no opinion words (66) | — | 37 (56%), classifier alone 20 (30%) |

On the 3,421 real HRAST test sentences, the full analysis scores 88.9% against the three-label gold. That figure counts every `mixed` answer as wrong, because HRAST has no mixed label. On the 3,308 sentences it does not call mixed, it scores 91.9% against 91.6% for the classifier alone.

### About the HRAST neutral label

Many sentences labelled neutral in HRAST are not neutral. Examples include "everything was good except the wifi", "bathrooms are small but new and clean" and "maybe improve breakfast". In a random sample of 40, about 15 were factual descriptions. This caps neutral recall on that test set whatever the model does. The row "with no opinion words" isolates the real facts.

### What changed

- Clauses are split on "and", commas, "with" and "plus" as well as on "but", and fragments are merged back so that shared subjects and shared opinions stay together.
- "not only … but also" is read as one compliment.
- Modal verbs (would, should, could) are no longer removed, so requests for improvement count as complaints about that feature.
- Contractions are expanded ("wasn't" -> "was not"), and the HRAST encoding damage (`don�t`) is repaired before training.
- Aspect keywords match whole words. The old substring match found "ac" in "place" and "bar" in "barely".
- 1,495 neutral fact sentences, 1,333 suggestions and 636 matching praise sentences were added to training. 41 HRAST sentences labelled neutral that contain both strong praise and a strong complaint were moved to a mixed label and left out of classifier training. Hand-labelled evaluation reviews are excluded from training.
- Hyper-parameters are chosen by macro F1, so the small neutral class counts as much as the others.
- The three thresholds in `review_analyzer.py` were chosen on a validation split of the training data, not on the test split.

### Known limitations

- Sentences with no opinion words depend on the classifier. "The hotel accepts cash and cards." is still labelled negative.
- About two thirds of the `mixed` answers on real HRAST sentences are genuinely mixed (26 of a random 40). The rest come from constructions such as "everything, but especially the staff", "would be a big plus if …" and "I have not seen a more complete breakfast".
- Sarcasm and comparisons with other hotels are not understood.
- Keywords are English only.

## Run the API

```bash
uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

- Health: `http://localhost:8000/health`
- Docs: `http://localhost:8000/docs`

## Predict sentiment

```http
POST /predict
```

```json
{ "review": "room was bad and WIFI internet was good." }
```

```json
{
  "model": "Aspect-based hybrid: clause segmentation + opinion lexicon + TF-IDF (1-3 gram) Logistic Regression",
  "modelVersion": "…",
  "sentiment": "mixed",
  "confidence": 0.95,
  "aspects": ["room", "wifi"],
  "aspectInsights": [
    { "aspect": "room", "sentiment": "negative", "confidence": 0.95, "mentions": 1 },
    { "aspect": "wifi", "sentiment": "positive", "confidence": 0.95, "mentions": 1 }
  ],
  "summary": "Guest praised Wi-Fi but raised concerns about room.",
  "sentenceResults": [
    { "text": "room was bad", "sentiment": "negative", "method": "lexicon", "...": "..." },
    { "text": "WIFI internet was good", "sentiment": "positive", "method": "lexicon", "...": "..." }
  ]
}
```

The response fields are unchanged from version 1, so the Express backend, MongoDB schema and React components work as before. An aspect can now also be `mixed` ("Friendly but slow staff"), which those already support.

`modelVersion` is a hash of the model and the analysis code. Reviews stored before this change keep their old results until they are analysed again:

```bash
npm.cmd run reanalyze:reviews
```

## MERN integration

The Express backend calls `POST {SENTIMENT_API_URL}/predict` when a guest submits a review.

```env
SENTIMENT_API_URL=http://localhost:8000
```

On Render, set it to the deployed service URL.

## Render deployment

Build command:

```bash
pip install -r requirements.txt && python train_model.py
```

Start command:

```bash
uvicorn app:app --host 0.0.0.0 --port $PORT
```
