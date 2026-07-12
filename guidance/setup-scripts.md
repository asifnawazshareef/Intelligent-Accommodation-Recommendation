# Setup, Scripts & Local Ops Guidance

---

## 1. First-time setup

```bash
# From repo root
npm run install:all

# Sentiment Python env
cd sentiment-service
python -m venv venv
# Windows:
venv\Scripts\activate
pip install -r requirements.txt
# Ensure models/sentiment_pipeline.joblib exists (train if missing)
cd ..
```

Configure env files (do not commit secrets):

- `server/.env` — `MONGO_URI`, `JWT_SECRET`, `SENTIMENT_API_URL`, Stripe keys, client URL  
- `client/.env` — API base URL if used (`VITE_...`)

---

## 2. Run everything

```bash
npm run dev
```

Runs concurrently: CLIENT + SERVER + SENTIMENT.

| Process | Typical URL |
|---------|-------------|
| Client | http://localhost:5173 |
| Server | http://localhost:5000 (check env) |
| Sentiment | http://localhost:8000 |

Health checks:

- Server: `/api/health` (if mounted)  
- Sentiment: `GET http://localhost:8000/health`

---

## 3. npm scripts (root)

| Script | Purpose |
|--------|---------|
| `npm run dev` | Client + server + sentiment |
| `npm run client` | Frontend only |
| `npm run server` | API only |
| `npm run sentiment` | FastAPI only |
| `npm run train:sentiment` | Augment data + train model |
| `npm run reanalyze:reviews` | Re-run sentiment on DB reviews |
| `npm run seed` | Base seed |
| `npm run seed:demo` | Demo data |
| `npm run seed:demo:reviews` | Demo reviews |
| `npm run seed:demo:full` | Fuller demo set |

Server-side scripts also live under `server/scripts/` (`seedAdmin`, `clearListings`, `syncPropertySentiment`, …).

---

## 4. Suggested local demo order

1. Start `npm run dev`  
2. Seed admin + properties + reviews if DB empty  
3. Login admin → verify images → approve listings  
4. Login guest → search → book → demo pay → review  
5. Confirm sentiment on property page  
6. Confirm recommendations on home  

---

## 5. Common failures

| Symptom | Check |
|---------|-------|
| Reviews always neutral | Sentiment service down / wrong `SENTIMENT_API_URL` |
| No search results | No approved listings / Mongo empty |
| Cannot approve listing | No verified images |
| CORS errors | Client URL vs server CORS config |
| Stripe fails | Keys/webhook secret; use demo payment for local |
| RTL broken | Missing i18n keys or hardcoded left/right classes |

---

## 6. Scope reminder

Do not add chat, wishlist, coupons, SMS, blog, etc. Improve existing workflow quality only.
