## 2.1 Development Methodology

The Intelligent Accommodation Review System (IARS) was developed by a single student developer under FYP supervision, and the process actually followed over the course of the project is best characterised as phase-based iterative and incremental development rather than a strict Waterfall or a large-team Agile framework such as Scrum. A rigid sequential model was unsuitable given that the project combines three technically distinct layers — a React/Vite client, a Node.js/Express/MongoDB server, and a separate Python FastAPI sentiment microservice — whose interfaces could only be finalised once early integration attempts revealed the practical constraints of each layer. Equally, a full ceremony-driven Agile process (sprint planning, daily stand-ups, retrospectives) was not appropriate for a one-person team, so the project instead adopted the underlying principle of Agile/iterative development — building working increments, testing them, and refining requirements based on what was learned — without the organisational overhead meant for multi-person teams.

The starting point for requirements was the original project proposal, which envisaged a broader feature set including SMS-based booking notifications, a chatbot, and a relational database. As implementation progressed, several of these proposed capabilities were deliberately re-scoped: SMS notification was replaced by a form-based Offline Request workflow that does not depend on any telecom gateway, MySQL/PostgreSQL was replaced by MongoDB and Mongoose to better fit the variable, nested structure of property and sentiment data (embedded image-verification metadata, aspect-level sentiment breakdowns, availability ranges), and the payment gateway was narrowed to Stripe's test mode supplemented by an internal demo-payment code path retained for offline testing. This re-scoping was not a departure from requirement engineering but a direct output of it: requirements were revisited at the start of each development phase in light of what the previous phase had proven feasible, which is the defining characteristic of the iterative model.

Development proceeded module by module, with each module treated as its own short iteration consisting of requirement refinement, schema design, backend route/controller implementation, frontend page/component implementation, and manual verification before the next module began. The first iterations delivered the authentication subsystem (`authController.js`, `authMiddleware.js`, the `User` model) and the property catalogue (`Property` model, owner property routes), since every subsequent module — booking, review, recommendation — depends on a registered user and an approved property existing. Later iterations added the image-verification pipeline, the booking-and-payment module (including the Stripe Checkout integration), the review-and-sentiment integration with the external FastAPI service, the offline-request module, the recommendation engine, and finally the administrative moderation tools. Each iteration produced a runnable increment of the system rather than a design document alone, allowing the developer to test end-to-end flows (for example, creating a booking and immediately attempting to pay for it) as soon as a module was functionally complete rather than deferring integration to a single late "system testing" phase.

Testing was carried out continuously alongside implementation rather than as an isolated downstream activity. Each new route was exercised manually through the running client and, where convenient, directly against the Express API, and defects such as incorrect booking-overlap detection or a missing verified-image gate on listing approval were fixed within the same iteration in which they were discovered. This continuous-testing discipline is reflected later in Chapter 6, which documents the black-box and white-box test cases derived from the same set of modules described here. Because the sentiment-analysis model already existed as a trained artifact prior to this integration project, the sentiment microservice itself was treated as a fixed external dependency during MERN-side iterations — the FastAPI `/predict` contract was integrated against and tested, but the underlying TF-IDF and Logistic Regression pipeline was not retrained, consistent with the project's stated scope of integrating, not rebuilding, the existing sentiment model.

## 2.2 Stakeholders and System Actors

Three human roles interact directly with IARS, distinguished at the data level by the `role` field on the `User` model (`guest`, `owner`, `admin`) and enforced at the route level by the `authorize(...roles)` middleware layered on top of the JWT-based `protect` middleware. Each role has a distinct goal set and a distinct set of touchpoints across the platform, and two non-human subsystems additionally act on the system's behalf without a user interface of their own.

The **Guest** is the platform's consumer-facing actor: an individual seeking accommodation who registers or logs in, searches and filters approved properties, inspects a property's gallery, sentiment snapshot and reviews, and either books online through the Stripe-backed checkout flow or falls back to the form-based Offline Request when an online booking is not appropriate for their circumstance. After a stay is confirmed, the guest's remaining touchpoint is the review workflow, through which a single review per booking (enforced by the unique `booking` reference on the `Review` model) is submitted and automatically scored for sentiment. Guests also passively generate signal data — property views recorded through `POST /api/properties/:id/view` and search queries persisted to `SearchHistory` — that is never surfaced to them directly but feeds the recommendation engine on their next visit.

The **Property Owner** is the supply-side actor whose goal is to list accommodation, keep listings compliant with the platform's image-verification requirement, and manage the resulting bookings and guest interactions. An owner authenticates with the same JWT mechanism as a guest but is authorised for a distinct set of routes: creating and editing properties with multipart image uploads, viewing only their own properties (`GET /api/properties/owner/my-properties`) and bookings (`GET /api/bookings/owner-bookings`), and responding to offline requests addressed to their properties. Because a listing cannot be approved by the admin workflow without at least one image reaching `verificationStatus: "verified"`, the owner's upload behaviour is directly coupled to whether their property ever becomes visible to guests at all.

The **Admin** is the platform's governance actor, responsible for two forms of quality control that gate what guests are allowed to see: listing moderation (via the stricter `admin/listings` pending/approve/reject path, which enforces the verified-image rule) and image auditing (via `admin/image-audit`, where each individual image's `verificationStatus` and `aiScore` are reviewed and adjusted). The admin additionally manages the user base — listing users by role and toggling `isVerified` — which the frontend currently exposes only for verification status, even though the underlying route also supports role changes.

Beyond these three human actors, two backend subsystems function as system-level actors that participate in workflows without any direct user interface. The **sentiment microservice** is a separate Python FastAPI process, invoked internally by `sentimentService.js` whenever a review is submitted; it receives the raw review text, returns a structured sentiment result, and is entirely opaque to the guest who only ever sees the resulting label and aspect breakdown. The **recommendation engine**, implemented across `buildUserProfile.js`, `bayesianRanking.js`, `propertySimilarity.js`, and `collaborativeFiltering.js`, similarly acts autonomously each time `GET /api/recommendations` is called, synthesising a guest's implicit behavioural signals into ranked property sections without any explicit guest input beyond ordinary browsing.

## 2.3 Functional Requirements

The functional requirements of IARS were derived directly from the module boundaries established during iterative development and correspond one-to-one with the routes, controllers, and models described in the preceding sections. They span nine functional areas: account management, property listing management, image verification, search and discovery, booking, payment, review and sentiment analysis, offline requests, and administrative moderation. Authentication requirements establish the identity layer on which every other module depends — a user cannot create a property, make a booking, or submit a review without first holding a valid JWT issued at login and validated by `authMiddleware.js` on each subsequent request. Property-management requirements govern how an owner introduces a listing into the system and how that listing progresses from `pending` to `approved`, while the image-verification requirements describe the hashing, duplicate-detection and heuristic scoring behaviour that must occur before any admin decision on a listing can be made.

Booking and payment requirements reflect the two-stage nature of a confirmed stay in IARS: a `Booking` document is first created in a `pending` state once availability and overlap checks pass, and is only transitioned to `confirmed` once a payment — through Stripe test-mode checkout or, where triggered directly against the backend, the demo-payment endpoint — has been verified. Review and sentiment requirements capture the constraint that a review can only be attached to a completed, confirmed booking that has not already been reviewed, and that every accepted review is automatically forwarded to the external sentiment model before being persisted. The offline-request requirements describe the form-based contact-and-booking-negotiation path that exists as an alternative to the fully online booking flow, and the recommendation requirements describe the two ranking modes — cold-start and personalised — that the system falls back between depending on the guest's authentication state and history. Administrative requirements, finally, describe the two levels of control the admin exercises over supply-side quality: listing approval and image auditing, together with basic user-account governance.

TABLE_CAPTION: Table 2.1: Functional Requirements by Module

| ID | Requirement | Module |
|---|---|---|
| FR-01 | The system shall allow a new user to register with name, email, phone, password and role (guest or owner), storing the password only as a bcrypt hash. | Authentication |
| FR-02 | The system shall allow a registered user to log in with email and password and receive a signed JWT for subsequent authenticated requests. | Authentication |
| FR-03 | The system shall expose the authenticated user's own profile via `GET /api/auth/me`, protected by the `protect` middleware. | Authentication |
| FR-04 | The system shall restrict role-specific routes using the `authorize(...roles)` middleware so that only owners can manage properties and only admins can moderate listings, audit images, or manage users. | Authentication |
| FR-05 | The system shall allow an owner to create a property listing with title, description, location (address, city, country), price, and up to five images uploaded as multipart form data. | Property Management |
| FR-06 | The system shall allow an owner to edit an existing property they own, including its details and availability calendar, via `PUT /api/properties/:id`. | Property Management |
| FR-07 | The system shall allow an owner to view only the properties they own via `GET /api/properties/owner/my-properties`. | Property Management |
| FR-08 | The system shall expose only properties with `status: "approved"` to public/guest browsing via `GET /api/properties`. | Property Management |
| FR-09 | The system shall compute a SHA-256 hash for each uploaded image and discard exact duplicates found within the same upload batch. | Image Verification |
| FR-10 | The system shall mark an uploaded image as `verificationStatus: "suspicious"` with `aiScore: 0.45` when its hash matches an image already stored elsewhere in the database. | Image Verification |
| FR-11 | The system shall compute a heuristic `aiScore` between 0 and 1 for each newly uploaded, non-duplicate image using `imageAiScore.js`, based on dimensions, resolution, compression ratio, and aspect ratio. | Image Verification |
| FR-12 | The system shall allow an admin to review all property images across the platform via `GET /api/admin/image-audit` and set each image's `verificationStatus` via `PUT /api/admin/image-audit/:propertyId/:imageId`. | Image Verification |
| FR-13 | The system shall prevent guests from viewing any property image whose `verificationStatus` is not `"verified"` on an approved listing. | Image Verification |
| FR-14 | The system shall allow a guest (authenticated or anonymous) to search approved properties by city, title, price range, and availability date via `GET /api/search`, persisting the query to `SearchHistory` when the requester is authenticated. | Search & Discovery |
| FR-15 | The system shall record a `PropertyView` document each time a guest opens a property detail page, via `POST /api/properties/:id/view`. | Search & Discovery |
| FR-16 | The system shall allow a guest to view full property details, including the gallery of verified images and the denormalised `sentimentSnapshot`, via `GET /api/properties/:id`. | Search & Discovery |
| FR-17 | The system shall create a `Booking` in `pending` status only after validating that the property is approved, that any non-empty `availabilityCalendar` contains a range covering the requested dates, and that no overlapping pending or confirmed booking already exists for the same property. | Booking |
| FR-18 | The system shall compute `totalAmount` on a booking as price multiplied by the number of nights between `startDate` and `endDate`. | Booking |
| FR-19 | The system shall reject a booking attempt with a distinct error code (`BOOKING_ALREADY_EXISTS` or `DATES_UNAVAILABLE`) depending on whether the conflict is with an existing booking or with the property's declared availability. | Booking |
| FR-20 | The system shall allow a guest to cancel their own booking via `PUT /api/bookings/:id/cancel`, after which the booking cannot be paid or reconfirmed. | Booking |
| FR-21 | The system shall allow a guest to initiate a Stripe test-mode checkout session for a pending booking via `POST /api/payments/stripe/create-checkout-session`, converting the PKR total to USD cents at a fixed demo rate of 280 PKR/USD. | Payment |
| FR-22 | The system shall verify a completed Stripe session via `GET /api/payments/stripe/verify-session` and transition the booking to `status: "confirmed"`, `paymentStatus: "confirmed"`, `paymentMethod: "stripe_test"` only when Stripe reports `payment_status === "paid"`. | Payment |
| FR-23 | The system shall expose a signature-verified Stripe webhook endpoint (`POST /api/payments/stripe/webhook`) that accepts the raw request body for event verification. | Payment |
| FR-24 | The system shall provide a `PUT /api/bookings/:id/confirm-demo-payment` endpoint allowing a booking to be confirmed through an internal demo-payment path, independent of Stripe. | Payment |
| FR-25 | The system shall allow a guest to submit a review (`rating` 1–5, `text` up to 1000 characters) only for a booking they own that is confirmed and does not already have an associated review. | Review & Sentiment |
| FR-26 | The system shall forward every accepted review's text to the external sentiment microservice's `/predict` endpoint and persist the returned `sentiment`, `sentimentScore`, `aspects`, `aspectInsights`, and `summary` fields on the `Review` document. | Review & Sentiment |
| FR-27 | The system shall recompute and store the property's denormalised `sentimentSnapshot` (totals, per-category counts, percentages, aspect breakdown) after every new review, via `syncPropertySentiment()`. | Review & Sentiment |
| FR-28 | The system shall list a guest's bookings eligible for review (confirmed, unreviewed) via `GET /api/reviews/eligible/:propertyId`. | Review & Sentiment |
| FR-29 | The system shall allow any visitor, authenticated or anonymous, to submit an Offline Request with guest name, phone, location, stay dates, and room type via `POST /api/offline-requests`. | Offline Requests |
| FR-30 | The system shall automatically link previously anonymous Offline Requests to a guest's account when the phone number on the request matches the phone number on their profile at next login. | Offline Requests |
| FR-31 | The system shall allow an owner to view all pending Offline Requests addressed to their properties via `GET /api/offline-requests/owner` and respond with a `responseMessage`, setting status to `responded` or `closed`. | Offline Requests |
| FR-32 | The system shall build a guest's behavioural profile (preferred city, latest budget, preferred property types and amenities) from their last five `SearchHistory` entries, bookings, high-rated reviews, and property views. | Recommendations |
| FR-33 | The system shall serve cold-start recommendations, ranked by Bayesian-smoothed quality across Top Rated, Best Reviewed, and Trending sections, to anonymous or history-less guests. | Recommendations |
| FR-34 | The system shall serve personalised recommendations combining content similarity and collaborative filtering, organised into up to six sections, to authenticated guests with sufficient behavioural history. | Recommendations |
| FR-35 | The system shall allow an admin to list properties pending approval (`GET /api/admin/listings/pending`) and approve a listing only if it has at least one image with `verificationStatus: "verified"`. | Admin |
| FR-36 | The system shall allow an admin to reject a pending listing via `PUT /api/admin/listings/:id/reject`. | Admin |
| FR-37 | The system shall allow an admin to list all users, optionally filtered by role, and toggle a user's `isVerified` flag via `PUT /api/admin/users/:id/verify`. | Admin |

## 2.4 Non-Functional Requirements

Non-functional requirements for IARS were shaped by the fact that the system is a demonstrable academic prototype rather than a production platform, but several of its architectural choices were made specifically because they would hold up under realistic load and multilingual usage. Statelessness of authentication (JWT rather than server-side session storage) was chosen so that the Express API can, in principle, be horizontally scaled without a shared session store, and password security relies entirely on bcrypt hashing rather than reversible encryption. The requirement to support English, Urdu, and Arabic — with the latter two rendered right-to-left — was treated as a first-class design constraint rather than a cosmetic add-on, driving the use of `i18next`/`react-i18next` and direction-safe Tailwind utility classes (`text-start`, `text-end`, `ms-*`, `me-*`) throughout the client rather than hardcoded `left`/`right` positioning.

TABLE_CAPTION: Table 2.2: Non-Functional Requirements

| Category | Requirement Description |
|---|---|
| Performance | Search and recommendation queries shall rely on indexed MongoDB fields (`SearchHistory.user`, `PropertyView.user`/`property`) to keep behavioural-profile lookups efficient as the number of guest interactions grows. |
| Performance | The denormalised `Property.sentimentSnapshot` shall be maintained incrementally by `syncPropertySentiment()` rather than recomputed from all reviews on every property-detail or search request. |
| Performance | Image AI-scoring shall use a lightweight deterministic heuristic (`imageAiScore.js`) rather than a heavyweight machine-learning inference call, keeping property-creation requests responsive. |
| Usability | Booking, listing, and offline-request forms shall provide clear validation feedback (for example, distinct `BOOKING_ALREADY_EXISTS` and `DATES_UNAVAILABLE` error codes) so guests and owners understand why an action failed. |
| Usability | The interface shall present loading and empty states for asynchronous data (search results, recommendation sections, admin queues) rather than blank screens. |
| Usability | Property detail pages shall surface the sentiment snapshot (positive/negative/neutral/mixed counts, average rating, praised and concern aspects) alongside raw reviews to help guests make faster decisions. |
| Security | User passwords shall never be stored or transmitted in plaintext; all password fields are hashed with bcrypt before persistence. |
| Security | Every protected route shall validate a JWT via `protect` middleware, and role-restricted routes shall additionally validate the caller's role via `authorize(...roles)` before executing controller logic. |
| Security | The Stripe webhook endpoint shall verify the request signature against the raw request body before trusting any payment event, preventing forged payment confirmations. |
| Security | A property image shall never be exposed to guests unless its `verificationStatus` is `"verified"`, preventing unaudited or suspicious images from reaching the public catalogue. |
| Localization | The default application language shall be English, with Urdu and Arabic available as additional locales through `i18next`/`react-i18next`. |
| Localization | All static UI text shall be sourced from translation keys rather than hardcoded strings, while user-generated content (property titles/descriptions, reviews, names, contact details, image URLs) shall never be machine-translated. |
| Localization | Layout components (navbar, footer, forms, cards, tables, dashboards) shall use direction-safe classes (`text-start`, `text-end`, logical `start`/`end` spacing, `flex-wrap`, responsive grids) so that the interface renders correctly in both LTR and RTL locales without structural breakage. |
| Availability & Reliability | Booking creation shall perform availability and overlap validation synchronously before persisting a booking, preventing the creation of conflicting reservations even under near-simultaneous requests. |
| Availability & Reliability | Payment status shall only be escalated to `confirmed` after explicit verification against Stripe's reported `payment_status`, preventing a booking from being marked paid on the basis of an unverified client-side redirect alone. |
| Maintainability | Backend responsibilities shall be separated into distinct route/controller modules per domain (auth, properties, bookings, payments, reviews, sentiment, offline requests, admin, search/recommendations), keeping each module independently testable and extensible. |
| Maintainability | The recommendation engine's scoring logic shall remain isolated in dedicated utility modules (`buildUserProfile.js`, `bayesianRanking.js`, `propertySimilarity.js`, `collaborativeFiltering.js`) so that individual signals can be tuned without touching route-handling code. |
| Maintainability | The sentiment-analysis capability shall remain an independently deployable FastAPI microservice accessed only through the `SENTIMENT_API_URL` configuration, so the trained model can be updated or redeployed without changes to the MERN codebase. |

## 2.5 Use Case Diagram

The use case diagram for IARS identifies three human actors — Guest, Property Owner, and Admin — situated outside a single system boundary labelled "IARS," inside which the platform's use cases are grouped by functional area: account access, property discovery, booking and payment, review and sentiment, offline requests, recommendations, and administration. The Guest actor connects to the largest number of use cases, reflecting the platform's guest-facing focus, while the Property Owner and Admin actors connect to a smaller, more specialised set centred on listing management and platform governance respectively. Two use cases — Track Property View and View Personalized/Cold-Start Recommendations — are triggered by guest browsing behaviour but are fulfilled by system-level logic (the recommendation engine) rather than by an explicit guest action, and are shown as guest-initiated use cases that internally depend on the automated subsystem described in Section 2.2. Shared use cases such as Cancel Booking and Write Review are restricted to the Guest actor because only the guest who created a booking may act on it, whereas Respond to Offline Request and Approve/Reject Listing are restricted to Owner and Admin respectively, reflecting the role-based authorization enforced by `roleMiddleware.js`.

FIGURE_CAPTION: Figure 2.1: Use Case Diagram of the IARS Platform
FIGURE_PLACEHOLDER: usecase_diagram

## 2.6 Use Case Descriptions in Detail

The following subsections describe each of the twenty-three use cases identified for IARS in structured form, covering the primary actor, goal, pre- and post-conditions, and both the success and alternate execution paths as implemented in the codebase.

### 2.6.1 Register (Guest/Owner) — UC-01

A new visitor creates an account by choosing either the guest or owner role, after which the credentials are validated and the password is hashed before storage.

TABLE_CAPTION: Table 2.3: Use Case for Register (Guest/Owner)

| Field | Description |
|---|---|
| Use Case No. | UC-01 |
| Scope | Authentication |
| Name | Register (Guest/Owner) |
| Primary Actor(s) | Guest, Property Owner |
| Goal | Create a new account with a chosen role so that role-appropriate features become accessible. |
| Pre-Conditions | The visitor does not already hold an account with the supplied email. |
| Post-Conditions | A `User` document is created with a bcrypt-hashed password and the chosen role; the user may now log in. |
| Success Scenario | Visitor submits name, email, phone, password and role via the registration form → server validates uniqueness of email → password is hashed with bcrypt → `User` document is saved → success response returned. |
| Alternate Scenario | If the email is already registered, `POST /api/auth/register` returns a validation error and no document is created; the visitor is prompted to log in instead. |

### 2.6.2 Login — UC-02

Any registered actor authenticates with email and password to obtain a JWT that authorizes subsequent requests according to their role.

TABLE_CAPTION: Table 2.4: Use Case for Login

| Field | Description |
|---|---|
| Use Case No. | UC-02 |
| Scope | Authentication |
| Name | Login |
| Primary Actor(s) | Guest, Property Owner, Admin |
| Goal | Obtain a signed JWT to access role-appropriate protected routes. |
| Pre-Conditions | The actor already holds a registered account. |
| Post-Conditions | A JWT is issued and stored client-side; the actor is treated as authenticated on subsequent requests carrying the token. |
| Success Scenario | Actor submits email and password to `POST /api/auth/login` → server locates the matching `User`, compares the bcrypt hash → on match, a JWT encoding the user id and role is signed and returned → client stores the token and redirects to the role-appropriate dashboard. |
| Alternate Scenario | If the email is not found or the password hash does not match, the server returns an authentication error and no token is issued; if a previously anonymous Offline Request's phone number matches this user's phone, it is auto-linked to their account at this point. |

### 2.6.3 Search Properties — UC-03

A guest, whether logged in or anonymous, queries the catalogue of approved properties by city, title, price, or availability date.

TABLE_CAPTION: Table 2.5: Use Case for Search Properties

| Field | Description |
|---|---|
| Use Case No. | UC-03 |
| Scope | Search & Discovery |
| Name | Search Properties |
| Primary Actor(s) | Guest |
| Goal | Retrieve a list of approved properties matching search criteria. |
| Pre-Conditions | None; the guest may or may not be authenticated (`optionalProtect`). |
| Post-Conditions | A ranked list of matching approved properties is returned; if the guest is authenticated, a `SearchHistory` document recording the query is saved. |
| Success Scenario | Guest enters a city, title keyword, price range, or availability date → `GET /api/search` filters approved properties by the supplied parameters → if authenticated, the query is persisted to `SearchHistory` → matching properties are returned to the client. |
| Alternate Scenario | If no criteria are supplied, the endpoint returns the general approved-property catalogue; if no properties match, an empty result set is returned and the client displays an empty state. |

### 2.6.4 Filter Search Results — UC-04

A guest narrows an existing search result set further by combining multiple criteria such as city, price band, and availability simultaneously.

TABLE_CAPTION: Table 2.6: Use Case for Filter Search Results

| Field | Description |
|---|---|
| Use Case No. | UC-04 |
| Scope | Search & Discovery |
| Name | Filter Search Results |
| Primary Actor(s) | Guest |
| Goal | Combine multiple search parameters to reach a more precise subset of approved properties. |
| Pre-Conditions | The guest has an active search context on the properties page. |
| Post-Conditions | The result list reflects all currently selected filter values simultaneously. |
| Success Scenario | Guest adjusts one or more filter controls (city, minPrice, maxPrice, availabilityDate, title) → client re-issues `GET /api/search` with the combined parameters → server applies all supplied filters in the same query → the filtered list is returned and rendered. |
| Alternate Scenario | If the combined filters yield no matching approved property, the client renders an empty-state message rather than an error, since an empty result is a valid outcome of `GET /api/search`. |

### 2.6.5 View Property Details — UC-05

A guest opens a specific property to inspect its gallery, description, location, pricing, sentiment snapshot, and reviews before deciding whether to book.

TABLE_CAPTION: Table 2.7: Use Case for View Property Details

| Field | Description |
|---|---|
| Use Case No. | UC-05 |
| Scope | Search & Discovery |
| Name | View Property Details |
| Primary Actor(s) | Guest |
| Goal | Review complete information about a property to support a booking decision. |
| Pre-Conditions | The property exists; if it is not approved, only the owner or an admin may view it. |
| Post-Conditions | Property detail data, including the verified-image gallery and `sentimentSnapshot`, is displayed; a `PropertyView` record may be created as a side effect (see UC-06). |
| Success Scenario | Guest selects a property from search results or recommendations → client requests `GET /api/properties/:id` with `optionalProtect` → server returns title, description, location, price, verified images only, availability, and the denormalised sentiment snapshot → client renders the PropertyDetailPage, including reviews and the booking call-to-action. |
| Alternate Scenario | If the requesting user is neither the owner nor an admin and the property is not approved, the server withholds the property, and the client displays a not-found state. |

### 2.6.6 Track Property View — UC-06

Each time a guest opens a property detail page, the system silently records the interaction to feed the recommendation engine's behavioural profile, without any visible action from the guest.

TABLE_CAPTION: Table 2.8: Use Case for Track Property View

| Field | Description |
|---|---|
| Use Case No. | UC-06 |
| Scope | Recommendations (system-level) |
| Name | Track Property View |
| Primary Actor(s) | Guest (indirectly); Recommendation Engine (system actor) |
| Goal | Persist an implicit interest signal so that future recommendations can reflect the guest's browsing behaviour. |
| Pre-Conditions | The guest has opened a property detail page. |
| Post-Conditions | A `PropertyView` document referencing the user and property, timestamped by `viewedAt`, is created. |
| Success Scenario | Guest opens a property detail page → client calls `POST /api/properties/:id/view` → server creates a `PropertyView` record → the recommendation engine later reads this record as part of `buildUserProfile.js` when computing viewed-similar recommendations. |
| Alternate Scenario | If the guest is anonymous, no `PropertyView` is recorded since the route requires an identified guest, and the view contributes only to that session's browsing, not to any stored profile. |

### 2.6.7 Book Property Online — UC-07

An authenticated guest selects a property, chosen dates, and a guest count to initiate a reservation, which the server validates before creating a pending booking.

TABLE_CAPTION: Table 2.9: Use Case for Book Property Online

| Field | Description |
|---|---|
| Use Case No. | UC-07 |
| Scope | Booking |
| Name | Book Property Online |
| Primary Actor(s) | Guest |
| Goal | Reserve a property for a chosen date range pending payment confirmation. |
| Pre-Conditions | The guest is authenticated; the target property is approved. |
| Post-Conditions | A `Booking` document is created with `status: "pending"`, `paymentStatus: "pending"`, and `totalAmount` computed as price × nights. |
| Success Scenario | Guest selects property, start/end dates, and guest count on BookingNewPage → client submits `POST /api/bookings` → server confirms the property is approved, checks the requested dates fall within the property's `availabilityCalendar` (if non-empty), and checks for an overlapping pending/confirmed booking → server creates the pending booking → guest is routed to BookingPaymentPage. |
| Alternate Scenario | If an overlapping booking already exists, the server returns `BOOKING_ALREADY_EXISTS`; if the dates fall outside the declared availability, it returns `DATES_UNAVAILABLE`; in either case no booking is created and the client surfaces the specific error to the guest. |

### 2.6.8 Pay via Stripe (Test Mode) — UC-08

The guest completes payment for a pending booking through Stripe's hosted test-mode checkout, after which the server verifies the session before confirming the booking.

TABLE_CAPTION: Table 2.10: Use Case for Pay via Stripe (Test Mode)

| Field | Description |
|---|---|
| Use Case No. | UC-08 |
| Scope | Payment |
| Name | Pay via Stripe (Test Mode) |
| Primary Actor(s) | Guest |
| Goal | Confirm and pay for a pending booking through Stripe's test-mode checkout. |
| Pre-Conditions | A pending, unpaid booking exists and belongs to the guest. |
| Post-Conditions | On success, the booking transitions to `status: "confirmed"`, `paymentStatus: "confirmed"`, `paymentMethod: "stripe_test"`, with `stripeSessionId`, `stripePaymentIntentId`, and `paymentConfirmedAt` populated. |
| Success Scenario | Guest proceeds from BookingPaymentPage → client calls `POST /api/payments/stripe/create-checkout-session`, which converts the PKR total to USD cents at the fixed 280 PKR/USD demo rate → guest completes payment on Stripe's hosted checkout → Stripe redirects to BookingPaymentSuccessPage → client calls `GET /api/payments/stripe/verify-session` → server confirms `payment_status === "paid"` and updates the booking accordingly. |
| Alternate Scenario | If the guest abandons checkout or the verified session does not report `paid`, the booking remains `pending`/unpaid and no status change occurs; the Stripe webhook (`POST /api/payments/stripe/webhook`) independently verifies event signatures as a secondary confirmation path. |

### 2.6.9 Confirm Demo Payment — UC-09

A backend capability exists to mark a booking as paid through an internal demo path rather than Stripe, intended for testing; it currently has no corresponding button in the frontend.

TABLE_CAPTION: Table 2.11: Use Case for Confirm Demo Payment

| Field | Description |
|---|---|
| Use Case No. | UC-09 |
| Scope | Payment |
| Name | Confirm Demo Payment |
| Primary Actor(s) | Guest |
| Goal | Confirm payment for a pending booking without routing through Stripe, for testing purposes. |
| Pre-Conditions | A pending, unpaid booking exists and belongs to the guest; the endpoint is invoked directly, since no UI control currently triggers it. |
| Post-Conditions | The booking transitions to `status: "confirmed"`, `paymentStatus: "confirmed"`, `paymentMethod: "demo"`. |
| Success Scenario | A request is made to `PUT /api/bookings/:id/confirm-demo-payment` for the guest's own pending booking → server validates ownership and pending status → booking is marked confirmed with `paymentMethod: "demo"`. |
| Alternate Scenario | If the booking has already been cancelled or confirmed, the endpoint rejects the transition; because no frontend button currently exposes this action, it is presently only reachable through direct API invocation rather than through normal guest interaction with the client. |

### 2.6.10 Cancel Booking — UC-10

A guest withdraws from a booking they created, whether it is still pending or already confirmed, closing off any further payment or reconfirmation on it.

TABLE_CAPTION: Table 2.12: Use Case for Cancel Booking

| Field | Description |
|---|---|
| Use Case No. | UC-10 |
| Scope | Booking |
| Name | Cancel Booking |
| Primary Actor(s) | Guest |
| Goal | Withdraw from a booking the guest no longer wishes to keep. |
| Pre-Conditions | The booking belongs to the requesting guest and is not already cancelled. |
| Post-Conditions | The booking's `status` is set to `"cancelled"`; it can no longer be paid or reconfirmed. |
| Success Scenario | Guest selects a booking from GuestBookingsPage and requests cancellation → client calls `PUT /api/bookings/:id/cancel` → server verifies ownership → booking `status` is updated to `"cancelled"`. |
| Alternate Scenario | If the booking does not belong to the requesting guest or does not exist, the server rejects the request; if the booking was already cancelled, the cancellation is idempotent and no further state change occurs. |

### 2.6.11 Submit Offline Booking Request — UC-11

A visitor, logged in or anonymous, uses a form to request accommodation without going through the online booking-and-payment flow, for cases where an online reservation is not suitable.

TABLE_CAPTION: Table 2.13: Use Case for Submit Offline Booking Request

| Field | Description |
|---|---|
| Use Case No. | UC-11 |
| Scope | Offline Requests |
| Name | Submit Offline Booking Request |
| Primary Actor(s) | Guest (authenticated or anonymous) |
| Goal | Request accommodation through a form-based alternative to the online booking flow. |
| Pre-Conditions | None; the route uses `optionalProtect` and allows anonymous submission. |
| Post-Conditions | An `OfflineRequest` document is created with `status: "pending"`, linked to the guest's account if authenticated. |
| Success Scenario | Visitor completes the OfflineBookingPage form with guest name, phone, location, start/end dates, and room type, optionally referencing a specific property → client calls `POST /api/offline-requests` → server creates the request, linking it to the guest's account if logged in. |
| Alternate Scenario | If submitted anonymously, the request has no guest reference at creation time; it is automatically linked to a guest account later if that account's phone number matches on a subsequent login (UC-02). |

### 2.6.12 View Offline Request Status — UC-12

An authenticated guest checks the status of the offline requests associated with their account, including any that were originally submitted anonymously and later linked.

TABLE_CAPTION: Table 2.14: Use Case for View Offline Request Status

| Field | Description |
|---|---|
| Use Case No. | UC-12 |
| Scope | Offline Requests |
| Name | View Offline Request Status |
| Primary Actor(s) | Guest |
| Goal | Track whether a submitted offline request has received an owner response. |
| Pre-Conditions | The guest is authenticated and has at least one associated `OfflineRequest`. |
| Post-Conditions | The guest sees the current `status` (pending, responded, or closed) and any `responseMessage` for each of their requests. |
| Success Scenario | Guest opens GuestOfflineRequestsPage → client calls `GET /api/offline-requests/guest` → server returns all `OfflineRequest` documents linked to the guest's account, including auto-linked ones → client renders status and response text. |
| Alternate Scenario | If the guest has no offline requests, the page renders an empty state; if a request is still `pending`, no `responseMessage` is shown yet. |

### 2.6.13 Respond to Offline Request — UC-13

A property owner reviews pending offline requests addressed to their listings and replies with a message, marking the request as responded or closed.

TABLE_CAPTION: Table 2.15: Use Case for Respond to Offline Request

| Field | Description |
|---|---|
| Use Case No. | UC-13 |
| Scope | Offline Requests |
| Name | Respond to Offline Request |
| Primary Actor(s) | Property Owner |
| Goal | Reply to a guest's offline request and move it toward resolution. |
| Pre-Conditions | The offline request references one of the owner's properties (or is otherwise addressed to them) and is not already closed. |
| Post-Conditions | The request's `responseMessage` is set and its `status` becomes `"responded"` or `"closed"`. |
| Success Scenario | Owner opens OwnerOfflineRequestsPage → client calls `GET /api/offline-requests/owner` to list pending requests → owner composes a reply → client calls `PUT /api/offline-requests/:id/respond` with the message and desired status → request is updated; the guest may subsequently proceed to a normal online booking for that property (UC-07). |
| Alternate Scenario | If the owner attempts to respond to a request already `closed`, the update is rejected or has no further effect, since the request has already reached its terminal state. |

### 2.6.14 Write Review — UC-14

A guest with a confirmed, unreviewed booking submits a rating and text review, which the system automatically scores for sentiment before storing.

TABLE_CAPTION: Table 2.16: Use Case for Write Review

| Field | Description |
|---|---|
| Use Case No. | UC-14 |
| Scope | Review & Sentiment |
| Name | Write Review |
| Primary Actor(s) | Guest |
| Goal | Record a rating and written opinion about a completed stay. |
| Pre-Conditions | The guest holds a `confirmed` booking for the property with no existing `Review` referencing it (enforced by the unique `booking` field). |
| Post-Conditions | A `Review` document is created with `rating`, `text`, and sentiment fields populated by the sentiment microservice; the property's `sentimentSnapshot` is refreshed. |
| Success Scenario | Guest opens ReviewForm from an eligible booking (`GET /api/reviews/eligible/:propertyId`) → submits rating and text (≤1000 characters) via `POST /api/reviews` → server verifies the booking is confirmed and unreviewed → server calls `sentimentService.js`, which posts the review text to the FastAPI `/predict` endpoint → returned sentiment fields are stored on the review → `syncPropertySentiment()` updates the property's `sentimentSnapshot`. |
| Alternate Scenario | If the booking is not confirmed, does not belong to the guest, or already has a review, `POST /api/reviews` rejects the submission; if the sentiment microservice is unreachable, the review submission is expected to surface an error rather than silently store an unscored review. |

### 2.6.15 View Reviews and Sentiment Summary — UC-15

Any visitor viewing a property can read the individual guest reviews alongside an aggregated sentiment summary computed from all reviews for that property.

TABLE_CAPTION: Table 2.17: Use Case for View Reviews and Sentiment Summary

| Field | Description |
|---|---|
| Use Case No. | UC-15 |
| Scope | Review & Sentiment |
| Name | View Reviews and Sentiment Summary |
| Primary Actor(s) | Guest |
| Goal | Understand overall guest sentiment about a property before booking. |
| Pre-Conditions | The property has at least one review to display a non-empty summary (an empty summary is otherwise shown). |
| Post-Conditions | The reviews list and sentiment summary are rendered on the property detail page. |
| Success Scenario | Guest opens a property detail page → client calls `GET /api/reviews/property/:propertyId` for individual reviews and/or `GET /api/sentiment/property/:propertyId` for the aggregated snapshot → ReviewsList and SentimentSummary components render ratings, sentiment labels, praised/concern aspects, and the average rating. |
| Alternate Scenario | If no reviews exist yet for the property, the sentiment summary displays a neutral/empty state rather than fabricated statistics. |

### 2.6.16 View Personalized/Cold-Start Recommendations — UC-16

The system presents a set of recommended properties to the guest, choosing between a behaviour-driven personalised mode and a general-quality cold-start mode depending on how much history the guest has.

TABLE_CAPTION: Table 2.18: Use Case for View Personalized/Cold-Start Recommendations

| Field | Description |
|---|---|
| Use Case No. | UC-16 |
| Scope | Recommendations |
| Name | View Personalized/Cold-Start Recommendations |
| Primary Actor(s) | Guest; Recommendation Engine (system actor) |
| Goal | Discover properties relevant to the guest's demonstrated or inferred preferences. |
| Pre-Conditions | None; both authenticated and anonymous guests may request recommendations. |
| Post-Conditions | A set of ranked property sections is returned and rendered by the RecommendedProperties component. |
| Success Scenario (personalized) | Authenticated guest with prior views, bookings, reviews, or searches requests recommendations → `GET /api/recommendations` calls `buildUserProfile.js` to derive preferred city, budget, property types and amenities → `buildRecommendationMode()` selects `hybrid-personalized-sectioned` → `propertySimilarity.js` and `collaborativeFiltering.js` compute content and co-occurrence signals → up to six sections (recent_searches, previous_bookings, preferred_budget, viewed_similar, popular_in_city, recommended_for_you) are built, deduplicated, capped at four items each, and annotated with match reasons. |
| Alternate Scenario | If the guest is anonymous or has no recorded views, bookings, reviews, or searches, `buildRecommendationMode()` selects `bayesian-sentiment-cold-start`, and `bayesianRanking.js` ranks properties into Top Rated, Best Reviewed, and Trending sections using the Bayesian-smoothed quality score (prior mean 3.5, weight 4) instead of behavioural signals. |

### 2.6.17 Create or Edit Property Listing — UC-17

An owner introduces a new listing or modifies an existing one, supplying descriptive details, pricing, and availability that will later be reviewed for admin approval.

TABLE_CAPTION: Table 2.19: Use Case for Create or Edit Property Listing

| Field | Description |
|---|---|
| Use Case No. | UC-17 |
| Scope | Property Management |
| Name | Create or Edit Property Listing |
| Primary Actor(s) | Property Owner |
| Goal | Introduce or update a property so it can eventually be approved and discovered by guests. |
| Pre-Conditions | The owner is authenticated; for edits, the property belongs to the owner. |
| Post-Conditions | A new `Property` document exists with `status: "pending"`, or an existing one is updated, in either case reflecting the submitted title, description, location, price, and availability. |
| Success Scenario | Owner completes PropertyForm on OwnerPropertyNewPage (or OwnerPropertyEditPage) with title, description, location, price, and availability ranges → client submits `POST /api/properties` (or `PUT /api/properties/:id`) → server persists the listing, defaulting new listings to `status: "pending"`. |
| Alternate Scenario | If required fields are missing or invalid, the server rejects the submission and the form surfaces validation errors; editing a listing does not reset an already-approved status unless the change specifically warrants re-review. |

### 2.6.18 Upload Property Images — UC-18

While creating or editing a listing, the owner uploads up to five images, each of which is hashed for duplicate detection and heuristically scored before an admin ever inspects it.

TABLE_CAPTION: Table 2.20: Use Case for Upload Property Images

| Field | Description |
|---|---|
| Use Case No. | UC-18 |
| Scope | Image Verification |
| Name | Upload Property Images |
| Primary Actor(s) | Property Owner |
| Goal | Attach visual evidence of the property to the listing so it can pass admin image verification. |
| Pre-Conditions | The owner is submitting or editing a property; each file is jpg, png, or webp and at most 5MB. |
| Post-Conditions | Each accepted image is stored with a `url`, SHA-256 `hash`, `verificationStatus`, and heuristic `aiScore`; exact duplicates within the same batch are discarded. |
| Success Scenario | Owner selects up to five image files in PropertyForm → files are uploaded as multipart form data with the property submission → server computes a SHA-256 hash per file, discards in-batch duplicates, and for each remaining file either marks it `"suspicious"` (aiScore 0.45) if the hash matches an existing database image or `"pending"` with a computed heuristic `aiScore` (from `imageAiScore.js`) otherwise. |
| Alternate Scenario | If a file exceeds 5MB or is not one of the accepted formats, it is rejected before hashing; if all uploaded images are duplicates or rejected, the property is saved without any usable image, which will later block admin approval (UC-20). |

### 2.6.19 View Bookings — UC-19

An owner reviews the bookings made against their properties to track occupancy and guest activity.

TABLE_CAPTION: Table 2.21: Use Case for View Bookings

| Field | Description |
|---|---|
| Use Case No. | UC-19 |
| Scope | Booking |
| Name | View Bookings |
| Primary Actor(s) | Property Owner |
| Goal | Monitor reservations made against the owner's properties. |
| Pre-Conditions | The owner is authenticated and owns at least one property to have any bookings against. |
| Post-Conditions | The owner sees a list of bookings for their properties, including guest, dates, and status. |
| Success Scenario | Owner opens their bookings dashboard → client calls `GET /api/bookings/owner-bookings` → server returns bookings scoped to properties owned by the requesting owner, including `status` and `paymentStatus` for each. |
| Alternate Scenario | If the owner has no properties or no bookings yet, the dashboard renders an empty state rather than an error. |

### 2.6.20 Approve or Reject Listing — UC-20

An admin reviews properties awaiting approval and either approves them, subject to the verified-image requirement, or rejects them.

TABLE_CAPTION: Table 2.22: Use Case for Approve or Reject Listing

| Field | Description |
|---|---|
| Use Case No. | UC-20 |
| Scope | Admin |
| Name | Approve or Reject Listing |
| Primary Actor(s) | Admin |
| Goal | Control which listings become visible to guests, ensuring at least minimal image-verification quality. |
| Pre-Conditions | The property has `status: "pending"` and appears in the admin's pending-listings queue. |
| Post-Conditions | The property's `status` becomes `"approved"` (making it visible to guest search) or `"rejected"`. |
| Success Scenario | Admin opens AdminListingsPage → client calls `GET /api/admin/listings/pending` → admin selects a listing with at least one `verificationStatus: "verified"` image and approves it → client calls `PUT /api/admin/listings/:id/approve` → server confirms the `hasVerifiedImage` check passes and sets `status: "approved"`. |
| Alternate Scenario | If the listing has no verified image, the approve action is rejected by the server regardless of the admin's intent, forcing an image audit (UC-21) first; the admin may instead call `PUT /api/admin/listings/:id/reject` at any point, which has no verified-image precondition. A simpler, less strict `PUT /api/properties/:id/moderate` path also exists in the codebase without the verified-image check, but the frontend's AdminListingsPage exclusively uses the stricter `admin/listings` path. |

### 2.6.21 Audit Property Images — UC-21

An admin inspects every uploaded image across the platform's properties and manually confirms, flags, or rejects each one, directly gating whether the owning listing can later be approved.

TABLE_CAPTION: Table 2.23: Use Case for Audit Property Images

| Field | Description |
|---|---|
| Use Case No. | UC-21 |
| Scope | Image Verification |
| Name | Audit Property Images |
| Primary Actor(s) | Admin |
| Goal | Manually confirm the authenticity and quality of uploaded property images. |
| Pre-Conditions | At least one image exists across the platform's properties with a `verificationStatus` other than the admin's intended final decision. |
| Post-Conditions | The targeted image's `verificationStatus` (and, where applicable, `aiScore`) is updated to `verified`, `suspicious`, or `rejected`. |
| Success Scenario | Admin opens AdminImageAuditPage → client calls `GET /api/admin/image-audit` to list all images with their current `verificationStatus` and heuristic `aiScore` → admin reviews an image and sets its status → client calls `PUT /api/admin/image-audit/:propertyId/:imageId` → the image's status is updated, potentially unlocking listing approval (UC-20) if it becomes the property's first verified image. |
| Alternate Scenario | If an image is marked `rejected`, it remains hidden from guests and does not count toward the verified-image requirement even if other images on the same property are later approved. |

### 2.6.22 Manage Users — UC-22

An admin reviews the platform's user base and toggles account verification, with role management technically available on the backend though not currently wired into the admin interface.

TABLE_CAPTION: Table 2.24: Use Case for Manage Users

| Field | Description |
|---|---|
| Use Case No. | UC-22 |
| Scope | Admin |
| Name | Manage Users |
| Primary Actor(s) | Admin |
| Goal | Oversee the platform's registered accounts and their verification status. |
| Pre-Conditions | The admin is authenticated; at least one user other than themself exists to manage. |
| Post-Conditions | A user's `isVerified` flag (and, via the backend route, potentially their `role`) is updated. |
| Success Scenario | Admin opens AdminUsersPage → client calls `GET /api/admin/users`, optionally filtered by role → admin selects a user and toggles verification → client calls `PUT /api/admin/users/:id/verify` → the user's `isVerified` flag is updated. |
| Alternate Scenario | The backend also exposes `PUT /api/admin/users/:id/role` for changing a user's role, but the current AdminUsersPage frontend does not present a control for it, so role changes are presently only reachable through direct API calls rather than the admin interface. |

### 2.6.23 Switch Language or Theme — UC-23

Any user, authenticated or not, changes the active display language among English, Urdu, and Arabic, causing the interface to re-render with the appropriate direction and translated static text.

TABLE_CAPTION: Table 2.25: Use Case for Switch Language or Theme

| Field | Description |
|---|---|
| Use Case No. | UC-23 |
| Scope | Localization |
| Name | Switch Language or Theme |
| Primary Actor(s) | Guest, Property Owner, Admin (any authenticated or anonymous user) |
| Goal | View the interface in a preferred language with correct text direction. |
| Pre-Conditions | None; available from any page via the language switcher. |
| Post-Conditions | The active `i18next` locale changes to English, Urdu, or Arabic; layout direction switches to RTL for Urdu and Arabic and LTR for English; static UI text re-renders from translation keys while user-generated content remains untranslated. |
| Success Scenario | User selects a language from the switcher → `i18next` loads the corresponding translation resources → the document direction attribute updates to `rtl` for Urdu/Arabic or `ltr` for English → direction-safe layout classes (`text-start`, `text-end`, logical spacing) re-flow forms, cards, tables, navbar, and footer correctly without breaking. |
| Alternate Scenario | If the user's browser or account carries a stored `languagePref`, that preference is applied automatically on load rather than defaulting to English, though English always remains the fallback if no preference is recorded. |

## 2.7 Activity Diagrams

The following activity diagrams describe, in swimlane form, the end-to-end behaviour of each primary human actor across a representative session on the platform, tracing the same routes and status transitions documented in the use cases above rather than an idealised or generic workflow.

The **Guest Activity Diagram** traces a guest from arrival through to leaving feedback. The guest's lane begins with either registering or logging in, then moves into searching and filtering the approved-property catalogue and opening a property of interest, which simultaneously triggers the system's property-view tracking in a parallel system lane. From the property detail view, the flow branches: the guest either proceeds into the online booking path — creating a pending booking, completing Stripe test-mode checkout, and having the booking confirmed once the session is verified — or, where an online reservation is not appropriate, submits an offline request instead and waits for an owner response before optionally converting to an online booking afterward. After a stay is confirmed, the guest's lane rejoins at the review step, where a rating and text are submitted and handed off to the sentiment-microservice lane before the flow terminates.

FIGURE_CAPTION: Figure 2.2: Guest Activity Diagram
FIGURE_PLACEHOLDER: activity_guest

The **Property Owner Activity Diagram** begins after login with the owner deciding whether to create a new listing or edit an existing one; both paths converge on the image-upload step, where each submitted file is hashed and, in the owner's lane, appears with a provisional `pending` or `suspicious` status pending admin review. The diagram then forks into two recurring loops that run independently of listing status: one lane in which the owner periodically checks incoming bookings for their properties, and another in which the owner checks for pending offline requests and responds to each with a message that moves it to `responded` or `closed`. The listing itself does not advance past the owner's lane; its approval decision belongs to the admin lane depicted separately, and the diagram shows this handoff as an asynchronous boundary rather than a step the owner controls directly.

FIGURE_CAPTION: Figure 2.3: Property Owner Activity Diagram
FIGURE_PLACEHOLDER: activity_owner

The **Admin Activity Diagram** centres on the two moderation responsibilities described in Section 2.2. One lane shows the admin opening the image-audit queue, inspecting each pending image's heuristic `aiScore`, and setting its `verificationStatus` to verified, suspicious, or rejected. A second, dependent lane shows the admin opening the pending-listings queue; for each listing, a decision node checks whether at least one image has reached `verified` status — if not, control returns to the image-audit lane before an approval can proceed, and if so, the admin may approve or reject the listing directly. A third, independent lane shows the admin periodically reviewing the user list and toggling verification status as needed, a step that does not depend on the outcome of the other two lanes.

FIGURE_CAPTION: Figure 2.4: Admin Activity Diagram
FIGURE_PLACEHOLDER: activity_admin

## 2.8 System Sequence Diagrams

The system sequence diagrams that follow decompose the fourteen most significant end-to-end workflows in IARS into their constituent actor–client–server–(and, where relevant, external service) interactions, grounded in the exact routes, controllers, and status fields already described in this chapter. Each diagram involves at minimum the initiating actor, the React client, and the Express API, with the sentiment microservice and Stripe appearing as additional external participants in the workflows that depend on them.

### 2.8.1 Register User

The registration sequence begins when a visitor submits the registration form on the client, which issues a `POST /api/auth/register` request carrying name, email, phone, password, and the chosen role. The Express route hands off to `authController.js`, which checks for an existing user with the same email, hashes the submitted password with bcrypt, and persists a new `User` document with `isVerified` left at its default value. Control returns to the client with a success acknowledgement, after which the visitor is redirected to the login page rather than being auto-authenticated, since registration and login are handled as two distinct sequences in this implementation. No JWT is issued at this stage; that is deferred to the login sequence described next.

FIGURE_CAPTION: Figure 2.5: Sequence Diagram – Register User
FIGURE_PLACEHOLDER: seq_register

### 2.8.2 Login

The login sequence starts with the actor submitting email and password from the client, which sends `POST /api/auth/login` to the server. `authController.js` retrieves the matching `User` document, compares the submitted password against the stored bcrypt hash, and, on success, signs a JWT embedding the user's id and role before returning it to the client. The client stores the token and immediately issues `GET /api/auth/me` (through `protect` middleware) to hydrate the authenticated session state, after which it routes the actor to the dashboard appropriate to their role. As a side effect specific to this sequence, if the authenticating user's phone number matches an anonymous `OfflineRequest`, that request is linked to the account at this point.

FIGURE_CAPTION: Figure 2.6: Sequence Diagram – Login
FIGURE_PLACEHOLDER: seq_login

### 2.8.3 Search and Filter Properties

This sequence begins with the guest entering search parameters — city, title keyword, price range, and/or availability date — on the client, which issues `GET /api/search` carrying those parameters as query strings under `optionalProtect`. The server-side search handler builds a MongoDB query restricted to `status: "approved"` properties matching the supplied filters and, if the request carries a valid JWT, concurrently writes a `SearchHistory` document capturing the same parameters against the user's id. The matching properties are returned to the client, which renders the result grid; subsequent filter adjustments by the guest repeat this same request-response cycle with updated parameters rather than filtering client-side, since filtering is authoritative on the server.

FIGURE_CAPTION: Figure 2.7: Sequence Diagram – Search and Filter Properties
FIGURE_PLACEHOLDER: seq_search

### 2.8.4 View Property Details

When the guest selects a property, the client issues `GET /api/properties/:id` under `optionalProtect` and, in parallel, `POST /api/properties/:id/view` to record the interaction. The properties controller loads the `Property` document, filters its `images` array so that only entries with `verificationStatus: "verified"` are returned to a guest caller (owners and admins receive the fuller, non-rejected set), and includes the denormalised `sentimentSnapshot`. The client then issues two further reads — `GET /api/reviews/property/:propertyId` and `GET /api/sentiment/property/:propertyId` — to populate the reviews list and sentiment summary components on the PropertyDetailPage. The `POST /api/properties/:id/view` call, handled independently by the properties route, creates a `PropertyView` document that plays no role in this page's own rendering but is consumed later by the recommendation sequence (Section 2.8.11).

FIGURE_CAPTION: Figure 2.8: Sequence Diagram – View Property Details
FIGURE_PLACEHOLDER: seq_viewdetails

### 2.8.5 Book Property and Create Booking

The booking sequence begins on BookingNewPage, where the guest specifies dates and guest count and the client issues `POST /api/bookings`. The bookings controller first confirms the target property's `status` is `"approved"`, then checks the requested date range against the property's `availabilityCalendar` (only if it is non-empty) and against any existing pending or confirmed booking for overlapping dates. If both checks pass, the server computes `totalAmount` as price multiplied by the number of nights and persists a new `Booking` with `status: "pending"` and `paymentStatus: "pending"`. The created booking's id is returned to the client, which navigates the guest directly into BookingPaymentPage to begin the payment sequence described next; if either validation check fails, the server instead returns `BOOKING_ALREADY_EXISTS` or `DATES_UNAVAILABLE` and no document is persisted.

FIGURE_CAPTION: Figure 2.9: Sequence Diagram – Book Property and Create Booking
FIGURE_PLACEHOLDER: seq_booking

### 2.8.6 Stripe Checkout Payment

From BookingPaymentPage, the client issues `POST /api/payments/stripe/create-checkout-session` for the pending booking's id. The payments controller converts the booking's PKR `totalAmount` to USD cents using the fixed 280 PKR/USD demo rate and calls the Stripe API to create a hosted Checkout Session, returning its URL to the client, which redirects the guest's browser to Stripe. After the guest completes (or cancels) payment on Stripe's hosted page, Stripe redirects back to BookingPaymentSuccessPage with a session identifier, and the client calls `GET /api/payments/stripe/verify-session`. The server retrieves the session from Stripe, and only if `payment_status === "paid"` does it update the `Booking` document's `status` to `"confirmed"`, `paymentStatus` to `"confirmed"`, `paymentMethod` to `"stripe_test"`, and populate `stripeSessionId`, `stripePaymentIntentId`, and `paymentConfirmedAt`. Independently of this synchronous verification, Stripe may also deliver an asynchronous event to `POST /api/payments/stripe/webhook`, which the server verifies against the raw request body's signature before trusting it.

FIGURE_CAPTION: Figure 2.10: Sequence Diagram – Stripe Checkout Payment
FIGURE_PLACEHOLDER: seq_payment

### 2.8.7 Cancel Booking

The guest initiates this sequence from GuestBookingsPage by selecting a booking and requesting cancellation, which the client sends as `PUT /api/bookings/:id/cancel`. The bookings controller verifies that the requesting guest owns the booking referenced by the id, then sets its `status` to `"cancelled"` regardless of whether it was previously `pending` or `confirmed`. The updated booking is returned to the client, which reflects the cancelled state in the guest's booking list; any later attempt to invoke the payment sequence (Section 2.8.6) or the demo-payment endpoint against this booking is expected to be rejected by the server, since a cancelled booking is treated as terminal.

FIGURE_CAPTION: Figure 2.11: Sequence Diagram – Cancel Booking
FIGURE_PLACEHOLDER: seq_cancel

### 2.8.8 Submit Offline Booking Request

A visitor, who may or may not be authenticated, completes the OfflineBookingPage form with guest name, phone, location, stay dates, and room type, optionally selecting a specific property. The client issues `POST /api/offline-requests` under `optionalProtect`; the offline-requests controller creates a new `OfflineRequest` document with `status: "pending"`, attaching the authenticated user's id as the `guest` reference when a valid JWT is present, and leaving it null for anonymous submissions. The created request's confirmation is returned to the client. No further server-side action occurs at submission time; the request remains `pending` until an owner responds in the sequence described in Section 2.8.9, or until the phone-matching auto-link described in Section 2.8.2 associates it with a guest account at a later login.

FIGURE_CAPTION: Figure 2.12: Sequence Diagram – Submit Offline Booking Request
FIGURE_PLACEHOLDER: seq_offline_submit

### 2.8.9 Owner Responds to Offline Request

The owner opens OwnerOfflineRequestsPage, and the client issues `GET /api/offline-requests/owner`, which the offline-requests controller resolves by matching requests against properties owned by the requesting owner. After selecting a request and composing a reply, the client issues `PUT /api/offline-requests/:id/respond` carrying the `responseMessage` text and the intended terminal status (`responded` or `closed`). The server updates the corresponding `OfflineRequest` document with both fields and returns the updated document to the client. The guest later observes this update through the parallel `GET /api/offline-requests/guest` sequence (an instance of UC-12) and may, from that point, choose to proceed into the online booking sequence (Section 2.8.5) for the referenced property.

FIGURE_CAPTION: Figure 2.13: Sequence Diagram – Owner Responds to Offline Request
FIGURE_PLACEHOLDER: seq_offline_respond

### 2.8.10 Write Review and Sentiment Analysis

Before rendering ReviewForm, the client calls `GET /api/reviews/eligible/:propertyId` to list the guest's confirmed, unreviewed bookings for that property. Upon submission of a rating and text, the client issues `POST /api/reviews`; the reviews controller re-verifies eligibility (confirmed booking, no existing review for that `booking` reference) and then calls `sentimentService.js`, which makes an outbound HTTP request to the FastAPI microservice's `/predict` endpoint at `SENTIMENT_API_URL`, passing `{ review: text }`. The Python service splits the text into clauses, classifies each with its TF-IDF plus Logistic Regression pipeline, applies its negation-override rule, aggregates an overall sentiment (including `"mixed"` where applicable), detects aspects across its nine keyword categories, and returns `{ sentiment, confidence, aspects, aspectInsights, summary }`. The Express server persists these fields onto the new `Review` document alongside the rating and text, then invokes `syncPropertySentiment()` to recompute the owning property's `sentimentSnapshot` before returning the saved review to the client.

FIGURE_CAPTION: Figure 2.14: Sequence Diagram – Write Review and Sentiment Analysis
FIGURE_PLACEHOLDER: seq_review

### 2.8.11 View Personalized Recommendations

The client issues `GET /api/recommendations` under `optionalProtect`. The server first calls `buildUserProfile.js`, which reads the guest's last five `SearchHistory` entries, their bookings, reviews rated four or above, and `PropertyView` records to derive preferred city, latest budget, preferred property types, and preferred amenities. `buildRecommendationMode()` then inspects whether the guest is authenticated and has at least one non-empty signal among views, bookings, reviews, or searches; if so, it selects the `hybrid-personalized-sectioned` path, which additionally invokes `propertySimilarity.js` (weighting city match, price similarity, amenity overlap, and sentiment similarity) and `collaborativeFiltering.js` (drawing on a co-occurrence matrix built from booking and view pairs across guests) to compute a combined score gated by the `MIN_QUALITY_SCORE` trust floor. The server assembles up to six capped, deduplicated sections annotated with match reasons and returns them to the client's RecommendedProperties component; if the guest fails the personalization precondition, the sequence instead proceeds identically to the cold-start path described in Section 2.6.16, using `bayesianRanking.js` alone.

FIGURE_CAPTION: Figure 2.15: Sequence Diagram – View Personalized Recommendations
FIGURE_PLACEHOLDER: seq_recommend

### 2.8.12 Create or Edit Listing with Image Upload

The owner completes PropertyForm on OwnerPropertyNewPage or OwnerPropertyEditPage, attaching up to five image files alongside the property's textual and pricing fields, and the client submits this as a multipart request to `POST /api/properties` or `PUT /api/properties/:id`. The properties controller persists the non-image fields first, then processes each uploaded file: it computes a SHA-256 hash, discards any file whose hash duplicates another file in the same batch, marks a file `"suspicious"` with `aiScore: 0.45` if its hash matches an image already stored on any property in the database, and otherwise computes a heuristic `aiScore` via `imageAiScore.js` from the image's dimensions, resolution, compression ratio, and aspect ratio and stores it with `verificationStatus: "pending"`. The resulting `images` array, along with the rest of the saved `Property` document, is returned to the client, which reflects each image's provisional status back to the owner; no image reaches `"verified"` at this stage, since that decision belongs exclusively to the admin image-audit sequence.

FIGURE_CAPTION: Figure 2.16: Sequence Diagram – Create or Edit Listing with Image Upload
FIGURE_PLACEHOLDER: seq_listing

### 2.8.13 Admin Approve or Reject Listing

The admin opens AdminListingsPage, and the client issues `GET /api/admin/listings/pending` to retrieve properties with `status: "pending"`. When the admin chooses to approve a listing, the client issues `PUT /api/admin/listings/:id/approve`; the admin controller performs a `hasVerifiedImage` check against the property's `images` array before allowing the transition, and only sets `status: "approved"` if at least one image has `verificationStatus: "verified"` — otherwise the request is rejected regardless of the admin's intent, requiring an image-audit pass first (Section 2.8.14). Rejection, by contrast, is issued via `PUT /api/admin/listings/:id/reject` with no such precondition and sets `status: "rejected"` unconditionally. The updated property is returned to the client and removed from the pending queue in either case.

FIGURE_CAPTION: Figure 2.17: Sequence Diagram – Admin Approve or Reject Listing
FIGURE_PLACEHOLDER: seq_approve

### 2.8.14 Admin Image Audit and User Management

For image auditing, the admin opens AdminImageAuditPage, and the client issues `GET /api/admin/image-audit`, which the admin controller resolves by scanning across all properties' `images` arrays and returning them alongside their current `verificationStatus` and heuristic `aiScore`. Selecting an individual image and setting its decision triggers `PUT /api/admin/image-audit/:propertyId/:imageId`, updating that single embedded image's `verificationStatus` (to `verified`, `suspicious`, or `rejected`) within the parent `Property` document. Independently, for user management, the admin opens AdminUsersPage, and the client issues `GET /api/admin/users`, optionally filtered by role; toggling a user's verification status issues `PUT /api/admin/users/:id/verify`, which flips the `isVerified` field on that `User` document. These two administrative flows share no direct sequencing dependency on one another, though an image-audit approval performed in the first flow may subsequently unblock a listing-approval sequence (Section 2.8.13) that was previously rejected for lacking a verified image.

FIGURE_CAPTION: Figure 2.18: Sequence Diagram – Admin Image Audit and User Management
FIGURE_PLACEHOLDER: seq_admin
