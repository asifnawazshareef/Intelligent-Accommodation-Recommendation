# ChaletsBooking (IARS)
## Hybrid Personalized Recommendation Engine
### Final Year Project — Complete Technical Documentation

---

**Project Title:** Intelligent Accommodation Recommendation System (IARS) / ChaletsBooking  
**Technology Stack:** MERN (MongoDB, Express.js, React.js, Node.js) + Python Sentiment Analysis  
**Document Version:** 1.0  
**Date:** June 2026  

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Problem Statement](#2-problem-statement)
3. [Project Objectives](#3-project-objectives)
4. [System Architecture](#4-system-architecture)
5. [Technology Stack](#5-technology-stack)
6. [Database Design](#6-database-design)
7. [User Activity Tracking (user_id-Based)](#7-user-activity-tracking-user_id-based)
8. [User Profile Building](#8-user-profile-building)
9. [Recommendation Engine Overview](#9-recommendation-engine-overview)
10. [Bayesian Ranking Algorithm](#10-bayesian-ranking-algorithm)
11. [Sentiment Analysis Integration](#11-sentiment-analysis-integration)
12. [Content-Based Filtering](#12-content-based-filtering)
13. [Collaborative Filtering](#13-collaborative-filtering)
14. [Hybrid Scoring Formula](#14-hybrid-scoring-formula)
15. [Personalized Recommendation Sections](#15-personalized-recommendation-sections)
16. [Cold Start Strategy](#16-cold-start-strategy)
17. [Recommendation Rules and Quality Constraints](#17-recommendation-rules-and-quality-constraints)
18. [Match Reasons (Explainability)](#18-match-reasons-explainability)
19. [API Specification](#19-api-specification)
20. [Frontend Implementation](#20-frontend-implementation)
21. [File Structure and Module Reference](#21-file-structure-and-module-reference)
22. [Setup and Installation](#22-setup-and-installation)
23. [Demo Data and Test Accounts](#23-demo-data-and-test-accounts)
24. [Testing and Verification](#24-testing-and-verification)
25. [Viva Demonstration Guide](#25-viva-demonstration-guide)
26. [Future Enhancements](#26-future-enhancements)
27. [Conclusion](#27-conclusion)
28. [References](#28-references)

---

## 1. Introduction

ChaletsBooking (IARS — Intelligent Accommodation Recommendation System) is a web-based chalet booking platform developed as a Final Year Project. The system allows property owners to list chalets, administrators to approve listings, and guests to search, book, pay (demo), and review properties.

A core AI component of this project is the **Hybrid Personalized Recommendation Engine**, which extends a baseline **Bayesian Ranking + Sentiment Analysis** recommendation system with **user_id-based personalization**. Unlike a generic “best properties for everyone” list, the engine produces **different ranked recommendations for each guest** based on their individual search history, property views, booking history, and review ratings—while ensuring that poor-quality properties (low Bayesian score or negative sentiment) cannot rank highly regardless of preference match.

This document describes the complete design, implementation, algorithms, database schema, API endpoints, and frontend integration of the recommendation system.

---

## 2. Problem Statement

### 2.1 Current State (Before Personalization)

Initially, ChaletsBooking ranked all chalets the same way for every guest using aggregate review quality and sentiment scores. Every guest saw the same “best” chalets in the same order, regardless of who they were or what they had looked at before.

### 2.2 The Gap

The system had no concept of an individual guest’s preferences or history. There was no **user_id** linking a guest to their past searches, bookings, or reviews. “Best chalet” was defined only as “objectively best by aggregate rating”—not “best for this guest.”

### 2.3 Solution

A new **Hybrid Personalized Recommendation Engine** was implemented that:

1. Tracks all authenticated guest interactions using **user_id**
2. Builds a **guest preference profile** from recent activity
3. Computes a **guest-specific relevance score** using content-based and collaborative filtering
4. Combines relevance with **Bayesian quality** and **sentiment analysis** as non-overridable trust signals
5. Falls back to **Bayesian + Sentiment cold-start ranking** for guests with no history
6. Displays recommendations in **explainable sections** with match reason badges

---

## 3. Project Objectives

| # | Objective | Status |
|---|-----------|--------|
| 1 | Implement user_id-based tracking of searches, views, bookings, and reviews | ✅ Complete |
| 2 | Build automatic guest preference profiles from recent activity | ✅ Complete |
| 3 | Extend (not replace) existing Bayesian + Sentiment ranking | ✅ Complete |
| 4 | Provide per-guest ranked recommendations | ✅ Complete |
| 5 | Use content-based similarity to past liked properties | ✅ Complete |
| 6 | Use collaborative filtering (“similar guests”) | ✅ Complete |
| 7 | Enforce quality floor so bad sentiment cannot rank highly | ✅ Complete |
| 8 | Cold-start fallback for new users | ✅ Complete |
| 9 | Explainable match reasons on each recommendation | ✅ Complete |
| 10 | Multilingual UI (English, Urdu, Arabic) | ✅ Complete |

---

## 4. System Architecture

### 4.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     React Frontend (Port 5173)                   │
│  HomePage │ SearchPage │ PropertyDetailPage │ RecommendedProps  │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP / REST (Axios + JWT)
┌────────────────────────────▼────────────────────────────────────┐
│                  Node.js + Express (Port 5000)                   │
│  searchController │ propertyController │ reviewController        │
│  personalizedRecommendationEngine │ buildUserProfile           │
│  bayesianRanking │ collaborativeFiltering │ propertySimilarity   │
└────────────┬───────────────────────────────┬────────────────────┘
             │ Mongoose                       │ Axios
┌────────────▼────────────┐    ┌─────────────▼────────────────────┐
│   MongoDB (iars_db)      │    │  Python FastAPI Sentiment Service │
│  Users, Properties,      │    │  TF-IDF + Logistic Regression     │
│  Bookings, Reviews,      │    │  Port 8000                        │
│  SearchHistory,          │    └───────────────────────────────────┘
│  PropertyView            │
└──────────────────────────┘
```

### 4.2 Recommendation Data Flow

```
Guest Activity (linked to user_id)
    │
    ├── SearchHistory    (saved on GET /api/search)
    ├── PropertyView     (saved on POST /api/properties/:id/view)
    ├── Booking          (existing booking module)
    └── Review           (existing review module + sentiment)
              │
              ▼
    buildUserRecommendationProfile(userId)
              │
              ▼
    scoreAllEligibleProperties()
      ├── computeBayesianQualityScore()
      ├── computeSentimentQualityScore()
      ├── computeGuestRelevanceScore()
      │     ├── Content similarity (42%)
      │     ├── Collaborative filtering (28%)
      │     └── Preference alignment (30%)
      └── finalScore = quality × (0.40 + relevance × 0.60)
              │
              ▼
    buildStructuredRecommendations()  OR  buildColdStartRecommendations()
              │
              ▼
    GET /api/recommendations → RecommendedProperties.jsx
```

---

## 5. Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | React.js (JSX) | User interface |
| Styling | Tailwind CSS + shadcn/ui | Responsive UI components |
| i18n | react-i18next | English, Urdu, Arabic |
| Backend | Node.js + Express.js | REST API |
| Database | MongoDB + Mongoose | Data persistence |
| Auth | JWT (JSON Web Tokens) | User authentication |
| ML — Sentiment | Python FastAPI + scikit-learn | Review sentiment classification |
| ML — Recommendation | Custom JavaScript engine | Hybrid personalization |

---

## 6. Database Design

### 6.1 SearchHistory Collection

Stores each authenticated guest’s search queries.

| Field | Type | Description |
|-------|------|-------------|
| user | ObjectId → User | Guest who performed the search |
| city | String | City filter |
| title | String | Title keyword filter |
| minPrice | Number | Minimum price filter |
| maxPrice | Number | Maximum price filter |
| availabilityDate | String | Date filter (YYYY-MM-DD) |
| createdAt | Date | Timestamp (auto) |

**Rules:** Maximum 20 records per user; oldest entries deleted when exceeded.

**File:** `server/models/SearchHistory.js`

### 6.2 PropertyView Collection

Stores property view/click events for authenticated guests.

| Field | Type | Description |
|-------|------|-------------|
| user | ObjectId → User | Guest who viewed |
| property | ObjectId → Property | Property viewed |
| viewedAt | Date | Last view timestamp |

**Rules:** Unique index on `{ user, property }`; maximum 50 views per user.

**File:** `server/models/PropertyView.js`

### 6.3 Booking Collection

| Field | Type | Description |
|-------|------|-------------|
| guest | ObjectId → User | Booking guest |
| property | ObjectId → Property | Booked property |
| startDate, endDate | String | Stay dates |
| totalAmount | Number | Booking amount |
| status | enum | pending, confirmed, cancelled |

**File:** `server/models/Booking.js`

### 6.4 Review Collection

| Field | Type | Description |
|-------|------|-------------|
| guest | ObjectId → User | Review author |
| property | ObjectId → Property | Reviewed property |
| booking | ObjectId → Booking | Linked booking |
| rating | Number | 1–5 stars |
| text | String | Review text |
| sentiment | enum | positive, negative, neutral, mixed |
| sentimentScore | Number | Model confidence |
| aspects | [String] | Detected aspects |
| aspectInsights | Array | Per-aspect sentiment |

**File:** `server/models/Review.js`

### 6.5 Property Collection (Sentiment Snapshot)

Key fields used by recommendation engine:

| Field | Type | Description |
|-------|------|-------------|
| title, description, price | — | Listing data |
| location.city | String | City for preference matching |
| availabilityCalendar | Array | Date ranges for availability |
| status | enum | approved properties only recommended |
| sentimentSnapshot | Object | Cached: positivePercent, averageRating, aspectBreakdown, etc. |

**File:** `server/models/Property.js`

---

## 7. User Activity Tracking (user_id-Based)

Personalization requires linking every interaction to a **user_id**. This was the prerequisite blocker identified in the FYP problem statement.

### 7.1 Search History Tracking

**When:** Guest performs a property search while logged in.  
**Where:** `server/controllers/searchController.js` → `saveSearchHistory()`  
**Endpoint:** `GET /api/search?city=...&minPrice=...&maxPrice=...`  
**Auth:** `optionalProtect` — saves history only if `req.user` exists.

### 7.2 Property View Tracking

**When:** Authenticated guest opens a property detail page.  
**Where:** `client/src/pages/PropertyDetailPage.jsx` calls `trackPropertyView(id)`  
**Endpoint:** `POST /api/properties/:id/view`  
**Auth:** `protect` + `authorize("guest")`  
**Backend:** `server/controllers/propertyController.js` → `trackPropertyView()`

### 7.3 Booking History

**Source:** Existing `Booking` model where `guest` field references `User._id`.  
**Used for:** Preferred cities, price range, content similarity, collaborative filtering.

### 7.4 Review / Rating History

**Source:** Existing `Review` model where `guest` field references `User._id`.  
**Used for:** High-rated properties (≥4 stars) treated as favourites; sentiment pipeline.

### 7.5 Recency Weighting

Only the **latest 5** searches, bookings, and views are used. Recency decay weights:

```
[1.0, 0.72, 0.52, 0.38, 0.28]
```

Recent activity has higher influence than older activity.

---

## 8. User Profile Building

**Module:** `server/utils/buildUserProfile.js`  
**Function:** `buildUserRecommendationProfile(userId, queryOverrides)`

### 8.1 Profile Fields Generated

| Category | Fields |
|----------|--------|
| Identity | userId, languagePref |
| Location | preferredCity, preferredCities, recentSearchCities, latestBookedCity, latestSearchCity, frequentlyViewedCities, frequentlyBookedCities |
| Budget | preferredPrice, priceMin, priceMax, latestBudgetMin, latestBudgetMax, bookedAvgPrice |
| Counts | bookedCount, reviewCount, viewedCount, avgRatingGiven |
| Property IDs | bookedPropertyIds, viewedPropertyIds, likedPropertyIds, favouritePropertyIds, excludePropertyIds |
| Interactions | interactions[] — deduplicated weighted entries from bookings, reviews, views |
| Inferred tastes | preferredPropertyTypes[], preferredAmenities[] |
| Raw history | recentSearches[], recentViews[] |

### 8.2 Interaction Weights

| Source | Weight |
|--------|--------|
| Booking | 1.0 |
| Review (rating ≥ 4) | 0.85 |
| Property view | 0.55 × recency boost |

### 8.3 Property Type Inference

Inferred from title/description keywords: chalet, villa, apartment, resort.

### 8.4 Amenity Extraction

Keywords extracted from descriptions: wifi, parking, pool, breakfast, kitchen, ac, heater, balcony, garden, etc.

---

## 9. Recommendation Engine Overview

**Main module:** `server/utils/personalizedRecommendationEngine.js`

The engine **extends** (does not replace) the existing Bayesian + Sentiment system.

### 9.1 Key Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| RECOMMENDATION_TOTAL | 24 | Maximum properties returned |
| SECTION_LIMIT | 4 | Maximum per section |
| MIN_QUALITY_SCORE | 0.28 | Trust floor threshold |
| RECENCY_DECAY | [1, 0.72, 0.52, 0.38, 0.28] | Recent activity weights |

### 9.2 Main Functions

| Function | Purpose |
|----------|---------|
| scoreAllEligibleProperties() | Score every eligible property |
| buildStructuredRecommendations() | Build 6 personalized sections |
| buildColdStartRecommendations() | Build 3 fallback sections |
| rankPersonalizedRecommendations() | Flat ranked list (legacy/fallback) |
| buildRecommendationMode() | Detect personalized vs cold start |
| finalizePersonalizedRecommendations() | Enrich match reasons |

### 9.3 Engine Modes

| Mode | Engine String | Layout |
|------|---------------|--------|
| Personalized | hybrid-personalized-sectioned | personalized |
| Cold Start | bayesian-sentiment-cold-start | cold_start |

---

## 10. Bayesian Ranking Algorithm

**Module:** `server/utils/bayesianRanking.js`

Bayesian averaging prevents properties with few reviews from appearing artificially high or low.

### 10.1 Bayesian Rating Formula

```
bayesianRating = (avgRating × reviewCount + PRIOR_MEAN × PRIOR_WEIGHT)
                 / (reviewCount + PRIOR_WEIGHT)

PRIOR_MEAN = 3.5
PRIOR_WEIGHT = 4
```

### 10.2 Quality Score (with reviews)

```
quality = (bayesianRating/5) × 0.30
        + (positivePercent/100) × 0.40
        + logNorm(reviewCount) × 0.15
        + availabilityScore × 0.08
        + amenityScore × 0.05
        − negativeShare × 0.20
```

### 10.3 Penalties

- High star rating (≥4) but positive sentiment < 50%: −0.12
- Bayesian rating < 3.0: −0.15

### 10.4 No Reviews

Base score: `0.12 + availability × 0.10 + amenity × 0.06`

### 10.5 Role in Recommendations

Bayesian quality acts as a **trust floor**. Properties below `MIN_QUALITY_SCORE (0.28)` receive `recommendationScore = 0` in personalized mode and are excluded from recommendations.

---

## 11. Sentiment Analysis Integration

### 11.1 Python Sentiment Service

**Location:** `sentiment-service/`  
**Model:** TF-IDF + Logistic Regression (scikit-learn)  
**Endpoint:** `POST http://localhost:8000/predict`  
**Training data:** `sentiment-service/data/sentiment_training.csv`

**Response includes:**
- sentiment (positive/negative/neutral/mixed)
- confidence score
- aspects (cleanliness, staff, location, room, wifi, value, etc.)
- aspectInsights
- summary

### 11.2 Node.js Integration

**Client:** `server/services/sentimentService.js`  
**Env variable:** `SENTIMENT_API_URL=http://localhost:8000`

**Flow on review submission:**
1. Guest submits review via React form
2. `POST /api/reviews` → Express calls Python `/predict`
3. Review saved with sentiment fields
4. `syncPropertySentiment(propertyId)` updates `Property.sentimentSnapshot`
5. Recommendation engine uses snapshot in scoring

### 11.3 Sentiment Quality Score

```
sentimentQuality = positivePercent/100 − (negativeCount/reviewCount) × 0.35
```

Combined with Bayesian:
```
combinedQuality = bayesianQuality × 0.58 + sentimentQuality × 0.42
```

---

## 12. Content-Based Filtering

**Module:** `server/utils/propertySimilarity.js`

Answers: *“Which chalets are most similar to what this guest has viewed, booked, or rated highly?”*

### 12.1 Content Similarity Formula

```
similarity = cityMatch × 0.32
           + priceSimilarity × 0.28
           + amenityJaccard × 0.22
           + sentimentSimilarity × 0.18
```

### 12.2 Price Similarity Tiers

| Price difference | Score |
|------------------|-------|
| ≤ 12% | 1.0 |
| ≤ 22% | 0.82 |
| ≤ 35% | 0.62 |
| ≤ 50% | 0.40 |

### 12.3 Weighted Content Score

Interactions are weighted by recency and source (booking > review > view):

```
contentRelevance = weighted average of similarity to each interaction
```

**Weight in guest relevance:** 42%

---

## 13. Collaborative Filtering

**Module:** `server/utils/collaborativeFiltering.js`

Answers: *“Which chalets are most liked by guests similar to this one?”*

### 13.1 Co-Occurrence Matrix

Built from:
- **Bookings:** pairwise co-occurrence weight = 1.0
- **Property views:** pairwise co-occurrence weight = 0.35

For each guest, all pairs of properties they interacted with increment matrix scores.

### 13.2 Collaborative Score

```
For each property user interacted with:
  score += min(matrix[sourceId][candidateId] / 4, 1)
collaborativeScore = average(score)
```

**Weight in guest relevance:** 28%

---

## 14. Hybrid Scoring Formula

### 14.1 Guest Relevance Score

```
guestRelevance = contentRelevance × 0.42
               + collaborativeRelevance × 0.28
               + preferenceRelevance × 0.30
```

**Preference relevance** includes: latest booking city, recent search cities, preferred city, budget match, view similarity, booking history, review favourites, search filter match, property type, amenities, availability.

### 14.2 Final Recommendation Score

**Personalized (with history):**
```
IF passesTrustFloor:
  recommendationScore = combinedQuality × (0.40 + guestRelevance × 0.60)
ELSE:
  recommendationScore = 0
```

**Trust floor:**
```
combinedQuality ≥ 0.28 AND bayesianQuality ≥ 0.28 × 0.88
```

**Cold start (no history):**
```
recommendationScore = combinedQuality
```

### 14.3 Why Multiplicative (Not Additive)

Personalization **never overrides** quality. A chalet matching the guest’s budget but with terrible sentiment receives score 0—not a high rank. This satisfies the FYP constraint that Bayesian and sentiment remain quality constraints.

### 14.4 Section Composite Score

Within each section, properties are ranked by:

```
sectionScore = recommendationScore × 0.48
             + sectionMatchScore × 0.28
             + combinedQuality × 0.14
             + ratingSentimentBoost × 0.10
```

---

## 15. Personalized Recommendation Sections

When a guest has interaction history, up to **6 sections** are shown (max 4 properties each, max 24 total, no duplicates).

| # | Section ID | Title | Selection Logic |
|---|------------|-------|-----------------|
| 1 | recent_searches | Based on Your Recent Searches | Matches recent searched city and filters |
| 2 | previous_bookings | Based on Your Previous Bookings | Similar city, type, amenities, price to past bookings |
| 3 | preferred_budget | Within Your Preferred Budget | Within user’s usual price range |
| 4 | viewed_similar | Because You Viewed Similar Properties | Content similarity to recent views |
| 5 | popular_in_city | Popular in Your Preferred City | Preferred city + high Bayesian + positive sentiment |
| 6 | recommended_for_you | Recommended For You | Full hybrid score catch-all |

Sections with no matching data are **skipped** (e.g., no views → Section 4 hidden).

---

## 16. Cold Start Strategy

**Trigger:** Guest not logged in OR authenticated user with **zero** interaction history.

### 16.1 Cold Start Sections

| # | Section ID | Title | Ranking |
|---|------------|-------|---------|
| 1 | top_bayesian | Top Bayesian Ranked Properties | Highest bayesianQuality |
| 2 | best_reviewed | Best Reviewed Properties | Highest rating + positive sentiment |
| 3 | trending | Trending Properties | Most global booking counts |

### 16.2 Why Cold Start Matters

New users must still receive useful recommendations. The existing Bayesian + Sentiment engine serves as a **legitimate fallback**—a strength compared to systems with no defined cold-start strategy.

---

## 17. Recommendation Rules and Quality Constraints

| Rule | Implementation |
|------|----------------|
| No duplicates across sections | `usedIds` Set tracks assigned property IDs |
| Only available properties | `isPropertyAvailable()` checks availability calendar |
| Recent activity weighted higher | RECENCY_DECAY on latest 5 records |
| Quality floor enforced | score = 0 if below MIN_QUALITY_SCORE |
| Exclude upcoming bookings | Properties with active bookings excluded from recommendations |
| Approved properties only | status = 'approved' filter |
| Extend, not replace Bayesian | Cold start uses combinedQuality; personalized multiplies by relevance |

---

## 18. Match Reasons (Explainability)

Each recommended property displays up to 3 reason badges for FYP explainability.

| Reason Key | Display (English) |
|------------|-------------------|
| similar_to_recent_searches | Similar to your recent searches |
| similar_to_past_stays | Similar to your previous bookings |
| matches_budget | Fits your budget range |
| similar_to_viewed | Similar to properties you viewed |
| popular_in_preferred_city | Popular in your preferred city |
| liked_by_similar_guests | Popular with guests like you |
| positive_reviews | Mostly positive guest reviews |
| highly_rated | Highly rated by guests |
| high_bayesian_quality | Top Bayesian quality score |
| recommended_for_you | Recommended for you |

**Backend:** `buildHybridMatchReasons()` in engine + `enrichMatchReasons()` in enrichment module.  
**Frontend:** `PropertyListingCard.jsx` translates keys via i18n.

---

## 19. API Specification

### 19.1 GET /api/recommendations

**Auth:** optionalProtect (works for guests and anonymous users)  
**Controller:** `searchController.getRecommendations`

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| city | string | City filter / preference boost |
| minPrice | number | Minimum price |
| maxPrice | number | Maximum price |
| price | number | Single price hint |
| availabilityDate | string | YYYY-MM-DD |
| limit | number | Max results (default 24) |

**Response:**

```json
{
  "success": true,
  "count": 20,
  "engine": "hybrid-personalized-sectioned",
  "layout": "personalized",
  "personalized": true,
  "profileSignals": {
    "userId": "6a3efa7587fec180a9b3e297",
    "trackingEnabled": true,
    "mode": "hybrid_personalized",
    "hasSearchHistory": true,
    "hasBookings": true,
    "hasViews": true,
    "preferredCity": "Lahore",
    "preferredPrice": 15000,
    "relevanceSignals": {
      "contentBased": true,
      "collaborativeFiltering": true,
      "qualityFloor": "bayesian_sentiment"
    }
  },
  "sections": [
    {
      "id": "recent_searches",
      "titleKey": "search.recommendationSection.recentSearches",
      "items": [ { "_id", "title", "recommendationScore", "matchReasons", ... } ]
    }
  ],
  "data": [ ... ]
}
```

### 19.2 GET /api/search

Saves SearchHistory for authenticated users.

### 19.3 POST /api/properties/:id/view

Records PropertyView for authenticated guests.

---

## 20. Frontend Implementation

### 20.1 RecommendedProperties.jsx

**Location:** `client/src/components/search/RecommendedProperties.jsx`

- Fetches `GET /api/recommendations` with search context params
- Re-fetches when user, city, price, or availability changes
- Renders section headings from i18n (`section.titleKey`)
- Shows personalized / cold start / guest hints
- Displays up to 24 properties across sections

### 20.2 HomePage.jsx

- Top: search form + 12 available properties preview
- Bottom: `<RecommendedProperties />` with `recommendationContext` from `usePropertySearch`

### 20.3 SearchPage.jsx

- Full search results + `<RecommendedProperties />` below

### 20.4 PropertyDetailPage.jsx

- Calls `trackPropertyView(id)` when authenticated guest views property
- Feeds view history into recommendation pipeline

### 20.5 usePropertySearch.js

Provides `recommendationContext`:
```javascript
{ city, minPrice, maxPrice, price, availabilityDate }
```

---

## 21. File Structure and Module Reference

```
server/
├── models/
│   ├── SearchHistory.js      # Guest search tracking
│   ├── PropertyView.js       # Guest view/click tracking
│   ├── Booking.js            # Booking history
│   ├── Review.js             # Ratings + sentiment
│   └── Property.js           # Listings + sentimentSnapshot
├── controllers/
│   ├── searchController.js   # /search, /recommendations
│   └── propertyController.js # trackPropertyView
├── utils/
│   ├── personalizedRecommendationEngine.js  # MAIN ENGINE
│   ├── buildUserProfile.js                    # Guest profile
│   ├── bayesianRanking.js                     # Bayesian quality
│   ├── collaborativeFiltering.js              # CF matrix
│   ├── propertySimilarity.js                  # Content similarity
│   ├── recommendationEnrichment.js            # Sentiment + reasons
│   ├── propertySignals.js                     # Availability, amenities
│   └── propertySentimentStore.js              # Snapshot sync
├── routes/
│   └── searchRoutes.js       # GET /recommendations
└── scripts/
    ├── seedProperties.js     # Demo properties
    └── seedDemoReviews.js    # Demo reviews + bookings

client/src/
├── components/search/
│   ├── RecommendedProperties.jsx
│   └── RecommendedPropertyCard.jsx
├── pages/
│   ├── HomePage.jsx
│   ├── SearchPage.jsx
│   └── PropertyDetailPage.jsx
├── hooks/
│   └── usePropertySearch.js
└── services/
    └── searchService.js      # getRecommendations()
```

---

## 22. Setup and Installation

### 22.1 Prerequisites

- Node.js 18+
- MongoDB (localhost:27017)
- Python 3.11+ (for sentiment service)

### 22.2 Environment Variables

**server/.env:**
```env
MONGO_URI=mongodb://localhost:27017/iars_db
JWT_SECRET=your_secret
SENTIMENT_API_URL=http://localhost:8000
```

**client/.env:**
```env
VITE_API_URL=http://localhost:5000/api
```

### 22.3 Install and Run

```bash
npm run install:all
npm run seed
npm run seed:demo:full
npm run dev
```

This starts:
- Client: http://localhost:5173
- Server: http://localhost:5000
- Sentiment: http://localhost:8000

---

## 23. Demo Data and Test Accounts

### 23.1 Seed Commands

| Command | Description |
|---------|-------------|
| npm run seed | Admin, guest, owner + sample property |
| npm run seed:demo | 1,000 demo properties |
| npm run seed:demo:reviews | Demo bookings + reviews with sentiment |
| npm run seed:demo:full | Properties + reviews (full demo) |

### 23.2 Test Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@gmail.com | admin123 |
| Guest | guest@iars.com | Guest@123456 |
| Owner | owner@iars.com | Owner@123456 |
| Demo guests | guest.demo2@iars.com … guest.demo11@iars.com | Guest@123456 |

---

## 24. Testing and Verification

Automated checks performed on the recommendation engine:

| Test | Expected Result |
|------|-----------------|
| Anonymous cold start | 3 sections, Bayesian ranking |
| Personalized user | 6 sections (where data exists) |
| user_id tracking | profileSignals.trackingEnabled = true |
| No duplicates | unique property IDs across sections |
| Section limit | ≤ 4 per section |
| Match reasons | Every item has ≥ 1 reason |
| Quality floor | Low quality properties score = 0 |
| User differentiation | Different users → different lists |
| Total cap | ≤ 24 properties |

---

## 25. Viva Demonstration Guide

### Step 1: Show Cold Start
1. Open home page without logging in
2. Show Top Bayesian, Best Reviewed, Trending sections
3. Explain: “No user_id → no personalization → Bayesian fallback”

### Step 2: Show User Tracking
1. Log in as guest@iars.com
2. Search “Lahore” with price range
3. Open 2–3 property detail pages (views tracked)
4. Explain SearchHistory and PropertyView in MongoDB

### Step 3: Show Personalized Recommendations
1. Refresh home page
2. Show personalized sections with match reason badges
3. Explain content-based + collaborative + preference scoring

### Step 4: Show Different Users Get Different Lists
1. Log in as guest.demo2@iars.com
2. Search “Karachi”
3. Compare recommendation lists — they differ

### Step 5: Explain Quality Floor
1. Point out that all recommended properties have positive sentiment
2. Explain multiplicative formula prevents bad properties ranking high

### Step 6: Show API Response
1. Open browser DevTools → Network → `/api/recommendations`
2. Show profileSignals, engine mode, guestRelevanceScore fields

---

## 26. Future Enhancements

| Enhancement | Description |
|-------------|-------------|
| A/B testing | Compare booking rate: personalized vs generic |
| Real-time updates | WebSocket refresh on new view/booking |
| Matrix factorization | Advanced collaborative filtering |
| Caching | Redis cache for co-occurrence matrix |
| Favourites module | Dedicated wishlist (currently reviews ≥4 as proxy) |

---

## 27. Conclusion

The Hybrid Personalized Recommendation Engine successfully extends ChaletsBooking’s existing Bayesian Ranking and Sentiment Analysis system with **user_id-based personalization**. The system:

1. **Tracks** guest searches, views, bookings, and reviews
2. **Builds** automatic preference profiles from recent activity
3. **Ranks** properties using content-based filtering, collaborative filtering, and preference alignment
4. **Preserves** Bayesian and sentiment as non-overridable quality constraints
5. **Falls back** to Bayesian cold-start ranking for new users
6. **Explains** recommendations via match reason badges
7. **Produces different lists for different guests** — not a generic ranking

This implementation directly addresses the FYP problem statement and provides a measurable, demonstrable AI-based recommendation component suitable for viva evaluation.

---

## 28. References

1. Ricci, F., Rokach, L., & Shapira, B. (2015). *Recommender Systems Handbook*. Springer.
2. Resnick, P., & Varian, H. R. (1997). Recommender systems. *Communications of the ACM*.
3. Breese, J. S., Heckerman, D., & Kadie, C. (1998). Empirical analysis of predictive algorithms for collaborative filtering.
4. MongoDB Documentation — https://www.mongodb.com/docs/
5. Express.js Documentation — https://expressjs.com/
6. React Documentation — https://react.dev/
7. scikit-learn Documentation — https://scikit-learn.org/

---

**End of Document**

*ChaletsBooking (IARS) — Hybrid Personalized Recommendation Engine*  
*FYP Technical Documentation v1.0*
