# Sentiment MERN Integration Module

This package adds a testable review sentiment flow to a React + Tailwind + shadcn frontend and Node.js + Express + MongoDB backend.

## Flow

React review form -> Express `/api/reviews` -> Python FastAPI sentiment model `/predict` -> MongoDB Review collection -> React shows sentiment result.

## 1. Copy server files

Copy these folders/files into your existing `server` folder:

- `server/models/Review.js`
- `server/models/Property.js` only if you do not already have a Property model
- `server/services/sentimentService.js`
- `server/controllers/reviewController.js`
- `server/controllers/sentimentController.js`
- `server/controllers/propertyController.js` only for testing property creation
- `server/routes/reviewRoutes.js`
- `server/routes/sentimentRoutes.js`
- `server/routes/propertyRoutes.js` only for testing property creation

Install axios in server:

```bash
npm install axios
```

Add this to `server/.env`:

```env
SENTIMENT_API_URL=http://localhost:8000
```

When deployed on Render:

```env
SENTIMENT_API_URL=https://your-sentiment-service.onrender.com
```

## 2. Register routes in `server/server.js`

Add imports:

```js
import reviewRoutes from "./routes/reviewRoutes.js";
import sentimentRoutes from "./routes/sentimentRoutes.js";
import propertyRoutes from "./routes/propertyRoutes.js";
```

Add routes after middleware:

```js
app.use("/api/reviews", reviewRoutes);
app.use("/api/sentiment", sentimentRoutes);
app.use("/api/properties", propertyRoutes);
```

## 3. Copy client files

Copy these into your React app:

- `client/src/services/api.js`
- `client/src/pages/ReviewSentimentTestPage.jsx`
- `client/src/components/reviews/SentimentBadge.jsx`
- `client/src/components/reviews/ReviewForm.jsx`
- `client/src/components/reviews/SentimentResultCard.jsx`
- `client/src/components/reviews/SentimentSummary.jsx`
- `client/src/components/reviews/ReviewsList.jsx`

Add this to client `.env`:

```env
VITE_API_URL=http://localhost:5000/api
```

## 4. Add route in React

In your `App.jsx`:

```jsx
import { BrowserRouter, Routes, Route } from "react-router";
import ReviewSentimentTestPage from "@/pages/ReviewSentimentTestPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/review-sentiment-test" element={<ReviewSentimentTestPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
```

If you use `react-router-dom`, import from `react-router-dom` instead.

## 5. Required shadcn components

Install these if not already installed:

```bash
npx shadcn@latest add button input label textarea card badge
```

## 6. Run locally

Terminal 1: Python sentiment model

```bash
cd sentiment-service
venv\Scripts\activate
uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

Terminal 2: Express backend

```bash
cd server
npm run dev
```

Terminal 3: React frontend

```bash
npm run dev
```

Open:

```text
http://localhost:5173/review-sentiment-test
```

## 7. Testing order

1. Open `/review-sentiment-test`.
2. Create a test property.
3. Select that property.
4. Submit a review.
5. Check the sentiment badge, confidence, aspects, and summary.
6. Check MongoDB `reviews` collection.

## 8. Important

This module is test-friendly and simple. Later you can replace `guestName` with logged-in user id and use your real Property model.
