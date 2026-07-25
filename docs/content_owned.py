# -*- coding: utf-8 -*-
"""
Content authored directly (not via subagent): Chapter 1 (Introduction),
Chapter 5 (Conclusion and Future Work), Chapter 7 (References), and the
Appendices. Front matter text lives here too; front matter LAYOUT is
built separately in build_dissertation.py using docx_helpers primitives.
"""

CH1_INTRODUCTION = r"""
## 1.1 Purpose

This report documents the analysis, design, implementation, and testing of the Intelligent Accommodation Review System (IARS), a web-based accommodation booking platform developed as a final-year project using the MERN stack (MongoDB, Express.js, React.js, Node.js) together with a dedicated Python sentiment-analysis microservice. The purpose of this document is to provide a complete and verifiable account of the system as it has actually been implemented, so that the reader can trace every described capability back to a concrete controller, route, model, or interface component in the source code. The report follows the sequence in which the system was conceived, analysed, designed, built, and evaluated, and it is intended to serve both as an academic submission and as a technical reference for anyone extending the platform in the future.

## 1.2 Background and Motivation

Online accommodation booking has become one of the most visible applications of web technology, with global platforms such as Airbnb [1] and Booking.com [2], and regional travel-search aggregators such as Wego [3], demonstrating how search, booking, and guest feedback can be combined into a single digital experience. Smaller markets and student-built systems, however, rarely have access to the scale of data or infrastructure that such platforms rely on, and they must instead demonstrate the same core ideas — property discovery, secure booking, and trustworthy guest feedback — using lighter-weight, self-contained components. IARS was motivated by this gap: the aim was to build a single, coherent booking platform in which every stage of the guest journey, from searching for a property to leaving a review, is backed by a working, inspectable implementation rather than a simulated or partially mocked feature.

A second motivation was the observation that guest reviews on many booking platforms are presented as raw text and a star rating, leaving prospective guests to read through long lists of comments to judge whether a property is actually a good fit. IARS addresses this by pairing every review with an automated sentiment classification and an aspect-level breakdown (cleanliness, staff, location, and so on), so that the emotional tone and specific strengths or concerns raised by past guests are surfaced directly on the property page rather than left implicit in unstructured text.

A third motivation concerns trust in listing images. Property photographs are one of the main drivers of a guest's decision to book, yet they are also easy to reuse or misrepresent. IARS therefore incorporates an image-verification step in the property-listing workflow, combining automatic duplicate detection with a heuristic quality score and a mandatory administrator audit before a listing can be approved for public display.

## 1.3 Problem Statement

Guests searching for short-term accommodation must currently rely on unstructured, unverified information: property photographs are not checked for duplication or quality before being published, and written reviews are not summarised in a way that lets a guest quickly judge the overall sentiment of past stays without reading every comment individually. At the same time, property owners lack a lightweight, non-technical channel to receive booking interest from guests who are unable or unwilling to complete an online payment, and administrators lack a single workspace in which to moderate incoming listings against a consistent, evidence-based standard. IARS was defined to address these three linked problems within a single platform: verified image submission, sentiment-aware review presentation, and an administrator-mediated approval workflow, wrapped around a conventional search-and-book user journey.

## 1.4 Proposed Solution (IARS Overview)

IARS is implemented as three cooperating services. A React single-page application (built with Vite, styled with Tailwind CSS and shadcn/ui component primitives) provides the guest-, owner-, and administrator-facing interfaces and supports English, Urdu, and Arabic through i18next with automatic right-to-left layout switching for the latter two. A Node.js/Express REST API, backed by MongoDB through Mongoose, implements authentication, property and booking management, the recommendation engine, and the administrative moderation workflows. A separate Python FastAPI microservice hosts a trained TF‑IDF and Logistic Regression sentiment-classification pipeline, which the Express API calls whenever a guest submits a review.

Guests can register, search and filter approved properties, view a property's sentiment-annotated review history, make an online booking secured through Stripe's test-mode checkout, or submit a form-based "offline request" when they prefer not to complete an online payment immediately. Property owners can create and edit listings, upload up to five images per property (each of which is hashed and heuristically scored before being queued for administrator review), and respond to offline requests from prospective guests. Administrators review pending listings, audit uploaded images, and manage user accounts, with listing approval explicitly gated on at least one image having been marked "verified". Beyond the core booking loop, a hybrid recommendation engine — combining Bayesian-smoothed quality scoring, content-based similarity, and collaborative filtering signals derived from a guest's own booking, viewing, and search history — personalises the properties shown to returning guests, while new or anonymous visitors are shown a quality-ranked cold-start selection.

## 1.5 Objectives of the System

The system was designed to meet the following objectives, each of which corresponds to a module that has been implemented and is discussed in the chapters that follow:

- To provide role-based registration and authentication for guests, property owners, and administrators using JSON Web Tokens and bcrypt-hashed passwords.
- To allow property owners to create, edit, and illustrate listings with images that are automatically checked for duplication and heuristically scored before administrator approval.
- To enforce a listing-approval workflow in which administrators cannot approve a property until at least one of its images has been marked verified.
- To allow guests to search and filter approved properties by city, price range, and availability, and to book a property online with a date-overlap and availability check enforced on the server.
- To integrate Stripe's test-mode Checkout API as the platform's online payment path, while retaining a form-based "offline request" as a non-payment alternative for guests who are unable to complete checkout immediately.
- To classify every submitted review through a trained sentiment-analysis microservice and to present the resulting sentiment, confidence, and aspect-level insights alongside the review itself, aggregated into a per-property sentiment snapshot.
- To generate personalised property recommendations for returning guests and quality-ranked cold-start recommendations for new or anonymous visitors, using a combination of Bayesian ranking, content similarity, and collaborative filtering.
- To support English, Urdu, and Arabic throughout the interface, including automatic right-to-left layout adaptation, without translating user-generated content such as property titles, descriptions, or reviews.
- To give administrators a dedicated workspace for listing moderation, image auditing, and user account management.

## 1.6 Scope of the Project

The scope of IARS, as implemented, is limited to the booking, review, and moderation workflow described above. The system does not implement live chat, a wishlist feature, coupon or discount codes, a production payment gateway, email or SMS notification delivery, PDF receipt generation, a public blog, advanced analytics dashboards, or subscription-based access tiers; these were intentionally excluded so that the project could focus on delivering a complete and well-tested implementation of its core scope rather than a partially implemented broader one. Where the original project proposal referred to capabilities such as SMS-based offline booking or a conversational chat interface, the implemented system instead provides an equivalent form-based offline-request workflow, which is discussed alongside the reasoning for this substitution in Chapter 3. Similarly, payment is implemented against Stripe's test-mode API rather than a live production gateway, consistent with the project's status as an academic prototype rather than a commercially deployed service.

## 1.7 Research Contribution

While IARS is primarily an engineering project, it brings together three techniques — sentiment-aware review aggregation, hybrid (content-based, collaborative, and Bayesian) property recommendation, and heuristic image-verification gating — inside a single, cohesive booking workflow rather than treating them as independent demonstrations. The specific contribution of this project lies in the integration design: the sentiment snapshot computed for each property is not only displayed to the guest but is also consumed as a scoring signal inside the recommendation engine's Bayesian quality calculation, and the image-verification outcome is not merely advisory but is enforced as a hard precondition for listing approval. This tight coupling between the AI-assisted subsystems and the core transactional workflow — rather than the novelty of any single algorithm — is what the project set out to demonstrate and what is evaluated in Chapter 4.

## 1.8 Organization of the Report

The remainder of this report is organised as follows. Chapter 2 presents the system analysis, including the development methodology, functional and non-functional requirements, use-case descriptions, and the activity and sequence diagrams that describe how each actor interacts with the system. Chapter 3 covers system design and implementation together, presenting the architecture, entity-relationship and class diagrams, API design, and the recommendation and sentiment pipelines, followed by a detailed account of how each module was implemented in code. Chapter 4 describes the testing strategy applied to the system, the individual test cases exercised against each module, and a qualitative evaluation of the recommendation, sentiment, and image-verification subsystems. Chapter 5 concludes the report with a summary of the work completed, its limitations, and directions for future enhancement. Chapter 6 documents the user interface screen by screen for each of the three user roles. Chapter 7 lists the references consulted during the project, and the appendices that follow provide supporting technical material, including the environment setup instructions, the full API reference, the complete database schema listing, and sentiment-model training details.
"""


CH5_CONCLUSION = r"""
## 5.1 Summary of Work

This report has presented the analysis, design, implementation, and testing of IARS, a MERN-stack accommodation booking platform integrated with a Python sentiment-analysis microservice. Chapter 2 established the system's functional and non-functional requirements and traced twenty-three use cases across the guest, property-owner, and administrator roles, supported by a use-case diagram, three activity diagrams, and fourteen sequence diagrams describing the platform's core workflows. Chapter 3 translated those requirements into a concrete three-tier architecture, a seven-collection MongoDB schema, a class diagram of the core models and controllers, and a documented API surface of thirty-odd endpoints, before describing how each module — authentication, property and image management, booking and payment, review and sentiment integration, offline requests, recommendations, and administration — was implemented in the Node.js/Express backend, the Python/FastAPI sentiment service, and the React frontend. Chapter 4 exercised the resulting system against twenty representative test cases spanning every module, summarised the outcomes, and discussed how the sentiment classifier, recommendation engine, and image-verification heuristic were validated qualitatively during development. Chapter 6, which follows this conclusion, documents the interface presented to each of the three user roles, and the appendices provide supporting technical reference material.

Across these chapters, the recurring theme has been the tight coupling between the platform's transactional core (registration, listing, booking, and payment) and its two AI-assisted subsystems: sentiment analysis, whose output is persisted on every review and aggregated into a property-level sentiment snapshot that is itself consumed by the recommendation engine's quality scoring; and image verification, whose outcome is enforced as a hard precondition on listing approval rather than treated as an advisory flag. The completed system demonstrates that these subsystems can be integrated into a single, internally consistent booking workflow rather than bolted on as separate demonstrations.

## 5.2 Limitations

Several limitations of the current implementation should be acknowledged. The image-verification "AI score" is a deterministic heuristic derived from image dimensions, compression ratio, and aspect ratio rather than a trained fraud- or quality-detection model, and it is explicitly treated as a first-pass filter that an administrator must still confirm or override. The sentiment-classification pipeline is a TF-IDF and Logistic Regression model trained on a general hotel-review dataset; it performs a rule-based negation override to correct a known class of failures (for example, phrases such as "not clean" being otherwise misclassified as positive), but it has not been evaluated against a held-out, IARS-specific labelled test set, and its aspect detection relies on keyword matching rather than a learned aspect-extraction model. The payment flow is implemented against Stripe's test-mode API together with an internal demo-confirmation endpoint that has no corresponding frontend control; no production payment gateway has been integrated. The offline-request workflow is a form-based substitute for the SMS-based process outlined in the original project proposal, reflecting a deliberate scope decision rather than an unimplemented feature. Finally, the recommendation engine's collaborative-filtering signal depends on having enough guests with overlapping booking or viewing history to produce a meaningful co-occurrence matrix, and its behaviour on a very small or newly seeded dataset is necessarily closer to the cold-start path than the fully personalised one.

## 5.3 Future Enhancements

Building on the current implementation, several extensions would be natural next steps. The heuristic image-verification score could be replaced with a trained image-classification model once a sufficiently large, labelled set of genuine and problematic property photographs is available. The sentiment classifier could be retrained and evaluated against reviews collected directly from IARS usage rather than a general-purpose dataset, and its aspect detection could be upgraded from keyword matching to a learned aspect-based sentiment model. The recommendation engine's collaborative-filtering component would benefit from a larger volume of real guest interaction data, which would allow its co-occurrence signal to contribute more strongly relative to the Bayesian and content-similarity components. Beyond the modules evaluated in this report, a production payment integration, richer owner-side analytics, and an expanded administrator audit trail are all reasonable directions for a subsequent iteration, though each would need to be scoped and specified separately in line with the project's original boundaries.

## 5.4 Conclusion

IARS was set out to demonstrate that a student-built booking platform could integrate verified image submission, sentiment-aware review presentation, and personalised recommendation into a single, working system rather than presenting these as isolated features. The implementation described in this report — spanning a React frontend, an Express/MongoDB backend, and a dedicated FastAPI sentiment service — fulfils the objectives set out in Chapter 1: role-based authentication, a gated listing-approval workflow, an availability-checked booking and test-mode payment path, a sentiment-classified review system feeding a property-level sentiment snapshot, and a hybrid recommendation engine that adapts between cold-start and personalised modes depending on the available guest history. The testing performed in Chapter 4 confirms that these modules function correctly against their defined test cases, and the limitations acknowledged above delineate honestly where the current heuristics and models would benefit from further refinement rather than overstating their maturity. On this basis, the project is considered to have met its stated objectives within its declared scope.
"""


REFERENCES = [
    'Airbnb, Inc., "Airbnb — Vacation Rentals, Cabins, Beach Houses & More," Online: https://www.airbnb.com.',
    'Booking Holdings Inc., "Booking.com — Hotels, Homes & Much More," Online: https://www.booking.com.',
    'Wego Pte. Ltd., "Wego — Compare Flights and Hotels," Online: https://www.wego.com.',
    'F. Pedregosa et al., "Scikit-learn: Machine Learning in Python," Journal of Machine Learning Research, vol. 12, pp. 2825-2830, 2011.',
    'S. Wang and C. D. Manning, "Baselines and Bigrams: Simple, Good Sentiment and Topic Classification," in Proc. 50th Annual Meeting of the Association for Computational Linguistics, 2012.',
    'B. Pang and L. Lee, "Opinion Mining and Sentiment Analysis," Foundations and Trends in Information Retrieval, vol. 2, no. 1-2, pp. 1-135, 2008.',
    'B. Liu, "Sentiment Analysis and Opinion Mining," Synthesis Lectures on Human Language Technologies, Morgan & Claypool Publishers, 2012.',
    'D. Chakrabarti, R. Kumar, and K. Punera, "A Bayesian Approach to Ranking with Aggregate Feedback," Yahoo! Research Technical Report, 2008 (basis for Bayesian-average quality smoothing).',
    'G. Adomavicius and A. Tuzhilin, "Toward the Next Generation of Recommender Systems: A Survey of the State-of-the-Art and Possible Extensions," IEEE Transactions on Knowledge and Data Engineering, vol. 17, no. 6, pp. 734-749, 2005.',
    'F. Ricci, L. Rokach, and B. Shapira, "Recommender Systems Handbook," 2nd ed., Springer, 2015.',
    'X. Su and T. M. Khoshgoftaar, "A Survey of Collaborative Filtering Techniques," Advances in Artificial Intelligence, vol. 2009, Article ID 421425, 2009.',
    'Stripe, Inc., "Stripe API Reference — Checkout Sessions," Online: https://stripe.com/docs/api/checkout/sessions.',
    'MongoDB, Inc., "MongoDB Manual," Online: https://www.mongodb.com/docs/manual/.',
    'Mongoose OS Contributors, "Mongoose — Elegant MongoDB Object Modeling for Node.js," Online: https://mongoosejs.com/docs/.',
    'OpenJS Foundation, "Express.js — Fast, Unopinionated, Minimalist Web Framework for Node.js," Online: https://expressjs.com/.',
    'Meta Platforms, Inc., "React — The Library for Web and Native User Interfaces," Online: https://react.dev/.',
    'i18next Contributors, "i18next — Internationalization Framework for JavaScript," Online: https://www.i18next.com/.',
    'W3C, "Structural Markup and Right-to-Left Text in HTML," Online: https://www.w3.org/International/questions/qa-html-dir.',
    'Tiangolo (S. Ramirez), "FastAPI — Modern, Fast (High-Performance) Web Framework for Building APIs with Python," Online: https://fastapi.tiangolo.com/.',
    'JSON Web Token Working Group, "RFC 7519 — JSON Web Token (JWT)," IETF, 2015. Online: https://www.rfc-editor.org/rfc/rfc7519.',
    'N. Provos and D. Mazieres, "bcrypt: A Future-Adaptable Password Scheme," in Proc. USENIX Annual Technical Conference, 1999.',
]


APPENDIX_A = r"""
Appendix A describes how to configure and run the three IARS services locally: the React client, the Express/MongoDB API server, and the Python sentiment microservice.

### A.1 Prerequisites

Node.js (v18 or later), npm, Python 3.10 or later, and a running MongoDB instance (local or a connection string to a hosted instance) are required. A Stripe test-mode account (publishable and secret keys beginning with `pk_test_`/`sk_test_`) is required for the payment flow.

### A.2 Environment Variables (server/.env)

TABLE_CAPTION: Table A.1: Server Environment Variables
| Variable | Purpose |
|---|---|
| PORT | Port on which the Express API listens (default 5000) |
| MONGO_URI | MongoDB connection string |
| CLIENT_URL | Origin allowed by the CORS configuration |
| SENTIMENT_API_URL | Base URL of the Python sentiment microservice (default http://localhost:8000) |
| JWT_SECRET | Secret key used to sign JSON Web Tokens |
| JWT_EXPIRES_IN | Token expiry duration (e.g. 7d) |
| STRIPE_SECRET_KEY | Stripe secret key (must begin with sk_test_) |
| STRIPE_WEBHOOK_SECRET | Secret used to verify incoming Stripe webhook signatures |
| ADMIN_EMAIL / ADMIN_PASSWORD | Seed credentials consumed by server/scripts/seed.js to create the initial administrator account |

### A.3 Running the Services

Each service is started independently during development: `npm install && npm run dev` inside `server/` starts the Express API; `npm install && npm run dev` inside `client/` starts the Vite development server; and `pip install -r requirements.txt` followed by `uvicorn app.main:app --reload --port 8000` (or the project's equivalent entry point) inside `sentiment-service/` starts the FastAPI microservice. The database can be populated with sample data using the scripts in `server/scripts/` (`seed.js` for the administrator account, `seedProperties.js` for sample listings, and `seedDemoReviews.js` for sample reviews).
"""

APPENDIX_D = r"""
Appendix D summarises the configuration of the sentiment-classification pipeline hosted by the Python microservice.

### D.1 Pipeline Configuration

TABLE_CAPTION: Table D.1: Sentiment Pipeline Configuration
| Parameter | Value |
|---|---|
| Vectorizer | TF-IDF, n-gram range (1,3) |
| Classifier | Logistic Regression, class_weight="balanced" |
| Serialization | joblib |
| Serving framework | FastAPI (Uvicorn) |
| Endpoint | POST /predict |
| Clause splitting | Sentence and contrast-conjunction ("but", "however", "although") based |
| Negation override | Rule-based pattern match forcing negative classification on negated positive phrases |

### D.2 Aspect Categories

TABLE_CAPTION: Table D.2: Aspect Detection Categories
| Aspect | Example Keywords |
|---|---|
| Cleanliness | clean, dirty, spotless, hygiene, dusty |
| Staff | staff, service, receptionist, helpful, rude |
| Location | location, nearby, central, access, distance |
| Room | room, bed, spacious, comfortable, small |
| Wifi | wifi, internet, connection, network |
| Value | price, value, worth, expensive, cheap |
| Facilities | facilities, pool, gym, parking, amenities |
| Food | food, breakfast, restaurant, meal, taste |
| Noise | noise, quiet, loud, traffic, peaceful |
"""

APPENDIX_B = r"""
Appendix B consolidates every REST endpoint exposed by the Express API server, grouped by route file, exactly as documented in Chapter 3.

TABLE_CAPTION: Table B.1: Authentication Endpoints (/api/auth)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | /api/auth/register | Public | Register a new guest or owner account |
| POST | /api/auth/login | Public | Authenticate and receive a JWT |
| GET | /api/auth/me | Protected | Retrieve the authenticated user's profile |

TABLE_CAPTION: Table B.2: Property Endpoints (/api/properties)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | /api/properties | Public | List approved properties |
| GET | /api/properties/owner/my-properties | Owner | List the authenticated owner's properties |
| POST | /api/properties | Owner | Create a property listing with images |
| PUT | /api/properties/:id | Owner | Edit an existing property listing |
| PUT | /api/properties/:id/moderate | Admin | Simple approve/reject without the verified-image gate |
| POST | /api/properties/:id/view | Guest | Record a property view for recommendations |
| GET | /api/properties/:id | Optional auth | Retrieve full property detail |

TABLE_CAPTION: Table B.3: Admin Endpoints (/api/admin)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | /api/admin/users | Admin | List users, optionally filtered by role |
| PUT | /api/admin/users/:id/verify | Admin | Toggle a user's verification flag |
| PUT | /api/admin/users/:id/role | Admin | Change a user's role |
| GET | /api/admin/image-audit | Admin | List all property images for audit |
| PUT | /api/admin/image-audit/:propertyId/:imageId | Admin | Update an image's verification status/score |
| GET | /api/admin/listings/pending | Admin | List listings awaiting approval |
| PUT | /api/admin/listings/:id/approve | Admin | Approve a listing (requires >=1 verified image) |
| PUT | /api/admin/listings/:id/reject | Admin | Reject a listing |

TABLE_CAPTION: Table B.4: Search and Recommendation Endpoints
| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | /api/search | Optional auth | Search/filter approved properties, records SearchHistory |
| GET | /api/recommendations | Optional auth | Retrieve cold-start or personalized recommendations |

TABLE_CAPTION: Table B.5: Review and Sentiment Endpoints
| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | /api/reviews | Guest | Submit a review, triggers sentiment classification |
| GET | /api/reviews/property/:propertyId | Public | List reviews for a property |
| GET | /api/reviews/eligible/:propertyId | Guest | List bookings eligible for a review |
| GET | /api/sentiment/property/:propertyId | Public | Retrieve the property's aggregated sentiment snapshot |

TABLE_CAPTION: Table B.6: Booking Endpoints (/api/bookings)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | /api/bookings | Guest | Create a booking (availability/overlap checked) |
| GET | /api/bookings/my-bookings | Guest | List the guest's own bookings |
| GET | /api/bookings/owner-bookings | Owner | List bookings on the owner's properties |
| PUT | /api/bookings/:id/confirm-demo-payment | Guest | Backend demo-payment confirmation (no frontend control) |
| PUT | /api/bookings/:id/cancel | Guest | Cancel a booking |
| GET | /api/bookings/:id | Guest/Owner | Retrieve a single booking |

TABLE_CAPTION: Table B.7: Payment Endpoints (/api/payments/stripe)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | /api/payments/stripe/create-checkout-session | Guest | Create a Stripe test-mode Checkout Session |
| GET | /api/payments/stripe/verify-session | Guest | Verify a completed Checkout Session |
| POST | /api/payments/stripe/webhook | Stripe (signed) | Handle asynchronous payment-confirmation events |

TABLE_CAPTION: Table B.8: Offline Request Endpoints (/api/offline-requests)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | /api/offline-requests | Optional auth | Submit an offline booking request (anonymous allowed) |
| GET | /api/offline-requests/guest | Guest | List the guest's own offline requests |
| GET | /api/offline-requests/owner | Owner | List offline requests on the owner's properties |
| PUT | /api/offline-requests/:id/respond | Owner | Respond to and close/keep open an offline request |
"""

APPENDIX_C = r"""
Appendix C lists the complete field set of each of the seven Mongoose schemas that make up the IARS database, supplementing the data dictionary presented in Chapter 3.

TABLE_CAPTION: Table C.1: User Schema — Complete Field Listing
| Field | Type | Notes |
|---|---|---|
| name | String | Required |
| email | String | Required, unique, lowercase |
| phone | String | Optional |
| password | String | Required, min length 6, select:false, bcrypt-hashed |
| role | String (enum) | guest \| owner \| admin, default guest |
| languagePref | String | Default "en" |
| isVerified | Boolean | Default false |
| createdAt / updatedAt | Date | Mongoose timestamps |

TABLE_CAPTION: Table C.2: Property Schema — Complete Field Listing
| Field | Type | Notes |
|---|---|---|
| title | String | Required |
| description | String | Required |
| location.address / city / country | String | Required sub-schema |
| price | Number | Minimum 0 |
| owner | ObjectId (ref User) | Required |
| images[].url / verificationStatus / aiScore / hash / uploadedAt | Embedded array | verificationStatus enum pending\|verified\|suspicious\|rejected |
| availabilityCalendar[] | Mixed array | {startDate, endDate} pairs |
| status | String (enum) | pending \| approved \| rejected |
| sentimentSnapshot | Embedded object | totalReviews, positiveCount, negativeCount, neutralCount, mixedCount, positivePercent, averageRating, aspectBreakdown[], praisedAspects[], concernAspects[], insightType, topPraisedAspect, updatedAt |

TABLE_CAPTION: Table C.3: Booking Schema — Complete Field Listing
| Field | Type | Notes |
|---|---|---|
| guest | ObjectId (ref User) | Required |
| property | ObjectId (ref Property) | Required |
| startDate / endDate | String (ISO date) | Required |
| guests | Number | Minimum 1 |
| totalAmount | Number | Minimum 0 |
| status | String (enum) | pending \| confirmed \| cancelled |
| paymentStatus | String (enum) | pending \| confirmed \| failed |
| paymentMethod | String (enum) | demo \| stripe_test |
| stripeSessionId / stripePaymentIntentId | String | Populated during Stripe checkout |
| paymentConfirmedAt | Date | Set when payment is confirmed |

TABLE_CAPTION: Table C.4: Review Schema — Complete Field Listing
| Field | Type | Notes |
|---|---|---|
| guest | ObjectId (ref User) | Required |
| property | ObjectId (ref Property) | Required |
| booking | ObjectId (ref Booking) | Required, unique index (one review per booking) |
| rating | Number | 1 to 5 |
| text | String | Maximum 1000 characters |
| sentiment | String (enum) | positive \| negative \| neutral \| mixed |
| sentimentScore | Number | Classifier confidence |
| aspects[] | String array | Detected aspect categories |
| aspectInsights[] | Embedded array | {aspect, sentiment, confidence, mentions} |
| summary | String | Human-readable sentiment summary |

TABLE_CAPTION: Table C.5: OfflineRequest Schema — Complete Field Listing
| Field | Type | Notes |
|---|---|---|
| guestName / phone / location / roomType | String | Required |
| startDate / endDate | String | Required |
| property | ObjectId (ref Property) | Nullable |
| guest | ObjectId (ref User) | Nullable (anonymous submissions) |
| responseMessage | String | Default empty string |
| status | String (enum) | pending \| responded \| closed |

TABLE_CAPTION: Table C.6: PropertyView Schema — Complete Field Listing
| Field | Type | Notes |
|---|---|---|
| user | ObjectId (ref User) | Indexed |
| property | ObjectId (ref Property) | Indexed |
| viewedAt | Date | Unique compound index with user; capped at 50 per user |

TABLE_CAPTION: Table C.7: SearchHistory Schema — Complete Field Listing
| Field | Type | Notes |
|---|---|---|
| user | ObjectId (ref User) | Indexed |
| city / title | String | Optional filters |
| minPrice / maxPrice | Number | Optional filters |
| availabilityDate | String | Optional filter, capped at 20 entries per user |
"""

APPENDIX_E = r"""
Appendix E reserves space for additional interface screenshots beyond those included in Chapter 6, to be attached once the application is captured running against a live, seeded MongoDB instance and a running sentiment microservice. Recommended additional captures include the mobile-responsive layouts of the property detail page, the Urdu and Arabic right-to-left renderings of the guest dashboard, and the admin image-audit grid with a mixed set of verified, suspicious, and rejected images.
"""

APPENDIX_F = r"""
Appendix F expands Table 4.21 (Summary of Test Case Execution Results) with space for the date of execution and tester notes, for use during a live demonstration or formal test sign-off.

TABLE_CAPTION: Table F.1: Full Test Case Execution Log Template
| Test Case ID | Feature | Date Executed | Executed By | Result | Notes |
|---|---|---|---|---|---|
| TC-01 | User Registration (Guest) | | | | |
| TC-02 | User Registration (Owner) | | | | |
| TC-03 | Valid Login | | | | |
| TC-04 | Invalid Login Attempt | | | | |
| TC-05 | Property Search by City | | | | |
| TC-06 | Property Search with Price Filter | | | | |
| TC-07 | Property Listing Creation with Images | | | | |
| TC-08 | Duplicate Image Detection | | | | |
| TC-09 | Booking Creation — Available Dates | | | | |
| TC-10 | Booking Creation — Overlapping Dates Rejected | | | | |
| TC-11 | Stripe Test Payment Success | | | | |
| TC-12 | Booking Cancellation | | | | |
| TC-13 | Review Submission and Sentiment Classification | | | | |
| TC-14 | Duplicate Review Prevention | | | | |
| TC-15 | Offline Booking Request Submission | | | | |
| TC-16 | Owner Response to Offline Request | | | | |
| TC-17 | Cold-Start Recommendation Display | | | | |
| TC-18 | Personalized Recommendation Display | | | | |
| TC-19 | Admin Listing Approval Blocked Without Verified Image | | | | |
| TC-20 | Language Switch to Urdu (RTL Layout) | | | | |
"""
