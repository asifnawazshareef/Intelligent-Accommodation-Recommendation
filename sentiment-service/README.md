# ISAR Sentiment Analysis Service

This is a self-trained sentiment analysis service for the Intelligent Accommodation Recommendation System.

It trains a hotel/accommodation review sentiment model using a single merged training CSV (HRAST hotel reviews + negation augmentation).

## Model

- TF-IDF Vectorizer
- Logistic Regression classifier
- Labels: positive, negative, neutral
- Extra logic: mixed sentiment for long reviews containing both positive and negative sentences
- Aspect detection: keyword-based hotel themes such as cleanliness, staff, room, Wi-Fi, location, value, facilities, food, and noise

## Folder Structure

```text
sentiment-service/
├── data/
│   └── sentiment_training.csv
├── models/
│   ├── sentiment_pipeline.joblib
│   └── metrics.json
├── train_model.py
├── app.py
├── test_api.py
├── requirements.txt
└── README.md
```

## Setup

Create and activate virtual environment:

```bash
python -m venv venv

# Windows
venv\Scripts\activate

# macOS/Linux
source venv/bin/activate
```

Install packages:

```bash
pip install -r requirements.txt
```

## Train the Model

```bash
python train_model.py
```

Training reads one file: `data/sentiment_training.csv` (HRAST hotel reviews + negation augmentation merged).

To rebuild that CSV from scratch (only if you add new source data):

```bash
python generate_augmented_data.py
python train_model.py
```

This will create:

```text
models/sentiment_pipeline.joblib
models/metrics.json
```

## Run the API

```bash
uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

Open:

```text
http://localhost:8000/health
```

API docs:

```text
http://localhost:8000/docs
```

## Predict Sentiment

Endpoint:

```http
POST /predict
```

Request:

```json
{
  "review": "The room was clean and staff was helpful, but the Wi-Fi was poor."
}
```

Response:

```json
{
  "sentiment": "mixed",
  "confidence": 0.82,
  "aspects": ["room", "cleanliness", "staff", "wifi"],
  "summary": "Guest shared mixed feedback about room, cleanliness, staff, wifi.",
  "sentenceResults": []
}
```

## MERN Integration

Your Express backend should call this API when a guest submits a review:

```text
POST http://localhost:8000/predict
```

In production on Render, set this in your Express backend `.env`:

```env
SENTIMENT_API_URL=https://your-sentiment-service.onrender.com
```

Locally:

```env
SENTIMENT_API_URL=http://localhost:8000
```

## Render Deployment

For a separate Python Render Web Service:

Build Command:

```bash
pip install -r requirements.txt && python train_model.py
```

Start Command:

```bash
uvicorn app:app --host 0.0.0.0 --port $PORT
```

