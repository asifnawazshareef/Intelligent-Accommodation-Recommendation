# IARS Dissertation — Design / Table of Contents
### (Structure only — no chapter content written yet)

**Target length:** ≈130 pages
**Formatting conventions:** modeled on `ISAR Doc v1.pdf` (A4, Times New Roman body / Arial accents, running header "IARS · Chapter n", centered page footer, figure captions below figure, table captions above table, dot-leader ToC, roman numerals for front matter, arabic numerals from Chapter 1 onward).
**Source of truth for all technical content:** the actual implemented MERN + FastAPI codebase (not the proposal's SMS/chatbot/MySQL vision — see "Deviations" note at the end).

---

## Global Writing Rules (apply to every chapter, every session)

These govern all future drafting of this dissertation and must be re-applied consistently even across separate writing sessions/chapters:

1. Formatting follows `ISAR Doc v1.pdf` exactly (page layout, heading hierarchy, numbering, caption placement, ToC/LoF/LoT style, running headers).
2. Technical content follows the actual source code — no content is derived from the proposal or template where they diverge from the real implementation (see "Deviations" section below).
3. No invented features. If a described capability doesn't exist in the codebase, it is not written as if it exists.
4. No fabricated workflows. Every sequence/activity diagram and every workflow narrative traces to a real controller/route/component flow.
5. No generic filler content — every paragraph must reference concrete IARS entities, fields, endpoints, or components, not generic "a modern web application typically..." language.
6. Every claim is checked against the codebase reports already gathered (models, routes, controllers, pages, services).
7. Recommendation engine documentation must match `personalizedRecommendationEngine.js`, `bayesianRanking.js`, `collaborativeFiltering.js`, `propertySimilarity.js`, `buildUserProfile.js` exactly — same signal names, weights, and section logic.
8. Booking workflow documentation must match `bookingController.js` / `Booking.js` exactly — same statuses, validation rules, payment paths (Stripe test + demo).
9. Authentication documentation must match `authController.js` / `authMiddleware.js` / `User.js` exactly — same JWT flow, roles, password hashing.
10. Database documentation must match the 7 actual Mongoose collections (`User`, `Property`, `Booking`, `Review`, `OfflineRequest`, `PropertyView`, `SearchHistory`) — no relational-DB assumptions beyond what's explicitly flagged as a conceptual adaptation.
11. Every API endpoint discussed must exist in `server/routes/*.js` — no placeholder endpoints.
12. Every UML diagram must represent the actual implementation (verified against the exploration reports), not idealized/generic textbook diagrams.
13. Every screenshot referenced must correspond to an actual page/component in `client/src/pages/`.
14. Each chapter must open with a transition sentence connecting back to the previous chapter's conclusion (narrative continuity, not just section breaks).
15. Formal software engineering academic writing register throughout — no marketing tone, no first-person casual voice outside Acknowledgement/Declaration/Dedication.
16–18. Plagiarism-safe, non-repetitive, natural human academic phrasing — varied sentence structure, no boilerplate paragraph templates reused verbatim across sections.
19. Every chapter must be defensible in front of a supervisor/panel as an accurate description of a real, working system.
20. One consistent numbering/heading/table/figure style is maintained end-to-end (chapter.section.subsection numbering, `Figure n.n`, `Table n.n`).

---

## 0. Front Matter (roman numerals i–xii, ≈9 pages)

| # | Section | Notes | Pages |
|---|---|---|---|
| i | Cover / Title Page | Title "IARS – Intelligent Accommodation Review System", author(s), roll no., supervisor, department, university, year | 1 |
| ii | Final Approval / Committee Page | External Examiner, Internal Examiner, Supervisor blocks | 1 |
| iii | Abstract | ~300 words | 1 |
| iv | Project in Brief | Table: Title / Team / Supervisor / Dates / Tools & Technologies | 1 |
| v | Acknowledgement | 1 |
| vi | Declaration | 1 |
| vii | Dedication | 1 |
| viii–ix | Table of Contents | 2 |
| x | List of Figures | 1 |
| xi | List of Tables | 1 (may spill to xii) |

**Front matter subtotal: ≈9 pages**

---

## Chapter 1 — Introduction (≈7 pages)

1.1 Purpose
1.2 Background and Motivation
1.3 Problem Statement
1.4 Proposed Solution (IARS Overview)
1.5 Objectives of the System
1.6 Scope of the Project
1.7 Research Contribution
1.8 Organization of the Report

*No figures/tables.*

---

## Chapter 2 — Literature Review / Related Work (≈8 pages)

*(Added beyond the ISAR template because a submission-ready FYP dissertation requires it — see Deviations note.)*

2.1 Overview of Online Accommodation Booking Platforms
2.2 Comparative Analysis of Existing Systems
&nbsp;&nbsp;&nbsp;&nbsp;Table 2.1 — Feature comparison: Airbnb, Booking.com, Wego vs. IARS
2.3 Recommendation Systems: Content-Based, Collaborative, Hybrid Approaches
2.4 Sentiment Analysis Techniques for Review Mining
2.5 Automated Image Quality / Authenticity Verification Approaches
2.6 Multilingual & RTL Web Application Design Considerations
2.7 Research Gap and Positioning of IARS

**Chapter 2 subtotal: ≈8 pages — Tables: 1**

---

## Chapter 3 — System Analysis and Requirements (≈23 pages)

3.1 Development Methodology
3.2 Stakeholders and System Actors (Guest, Owner, Admin)
3.3 Functional Requirements
&nbsp;&nbsp;&nbsp;&nbsp;Table 3.1 — Functional requirements by module
3.4 Non-Functional Requirements
&nbsp;&nbsp;&nbsp;&nbsp;Table 3.2 — Performance, usability, security, localization, availability
3.5 Use Case Diagram
&nbsp;&nbsp;&nbsp;&nbsp;**Figure 3.1** — Use Case Diagram (Guest / Owner / Admin)
3.6 Use Case Descriptions in Detail (one table each, UC-01…UC-23)

| # | Use Case | Table |
|---|---|---|
| 3.6.1 | Register (Guest/Owner) | Table 3.3 |
| 3.6.2 | Login | Table 3.4 |
| 3.6.3 | Search Properties | Table 3.5 |
| 3.6.4 | Filter Search Results | Table 3.6 |
| 3.6.5 | View Property Details | Table 3.7 |
| 3.6.6 | Track Property View (system) | Table 3.8 |
| 3.6.7 | Book Property Online | Table 3.9 |
| 3.6.8 | Pay via Stripe (Test Mode) | Table 3.10 |
| 3.6.9 | Confirm Demo Payment | Table 3.11 |
| 3.6.10 | Cancel Booking | Table 3.12 |
| 3.6.11 | Submit Offline Booking Request | Table 3.13 |
| 3.6.12 | View Offline Request Status (Guest) | Table 3.14 |
| 3.6.13 | Respond to Offline Request (Owner) | Table 3.15 |
| 3.6.14 | Write Review | Table 3.16 |
| 3.6.15 | View Reviews & Sentiment Summary | Table 3.17 |
| 3.6.16 | View Recommendations (personalized/cold-start) | Table 3.18 |
| 3.6.17 | Create/Edit Property Listing (Owner) | Table 3.19 |
| 3.6.18 | Upload Property Images (Owner) | Table 3.20 |
| 3.6.19 | View Bookings (Owner) | Table 3.21 |
| 3.6.20 | Approve/Reject Listing (Admin) | Table 3.22 |
| 3.6.21 | Audit Property Images (Admin) | Table 3.23 |
| 3.6.22 | Manage Users (Verify / Role) (Admin) | Table 3.24 |
| 3.6.23 | Switch Language / Theme | Table 3.25 |

3.7 Activity Diagrams
&nbsp;&nbsp;&nbsp;&nbsp;**Figure 3.2** — Guest Activity Diagram
&nbsp;&nbsp;&nbsp;&nbsp;**Figure 3.3** — Owner Activity Diagram
&nbsp;&nbsp;&nbsp;&nbsp;**Figure 3.4** — Admin Activity Diagram

3.8 System Sequence Diagrams

| # | Workflow | Figure |
|---|---|---|
| 3.8.1 | Register User | Figure 3.5 |
| 3.8.2 | Login | Figure 3.6 |
| 3.8.3 | Search & Filter Properties | Figure 3.7 |
| 3.8.4 | View Property Details | Figure 3.8 |
| 3.8.5 | Book Property & Create Booking | Figure 3.9 |
| 3.8.6 | Stripe Checkout Payment | Figure 3.10 |
| 3.8.7 | Cancel Booking | Figure 3.11 |
| 3.8.8 | Submit Offline Booking Request | Figure 3.12 |
| 3.8.9 | Owner Responds to Offline Request | Figure 3.13 |
| 3.8.10 | Write Review & Sentiment Analysis | Figure 3.14 |
| 3.8.11 | View Personalized Recommendations | Figure 3.15 |
| 3.8.12 | Owner Create/Edit Listing + Upload Images | Figure 3.16 |
| 3.8.13 | Admin Approve/Reject Listing (Image-Verification Gate) | Figure 3.17 |
| 3.8.14 | Admin Image Audit & User Management | Figure 3.18 |

**Chapter 3 subtotal: ≈23 pages — Figures: 18, Tables: 25**

---

## Chapter 4 — System Design (≈20 pages)

4.1 System Architecture Overview
&nbsp;&nbsp;&nbsp;&nbsp;**Figure 4.1** — Three-tier architecture (Client / Server / Sentiment microservice / MongoDB)
4.2 Entity Relationship Diagram
&nbsp;&nbsp;&nbsp;&nbsp;**Figure 4.2** — ERD
4.3 Database Schema / Data Dictionary
&nbsp;&nbsp;&nbsp;&nbsp;4.3.1 User — Table 4.1
&nbsp;&nbsp;&nbsp;&nbsp;4.3.2 Property (incl. embedded ImageMeta) — Table 4.2
&nbsp;&nbsp;&nbsp;&nbsp;4.3.3 Booking — Table 4.3
&nbsp;&nbsp;&nbsp;&nbsp;4.3.4 Review — Table 4.4
&nbsp;&nbsp;&nbsp;&nbsp;4.3.5 OfflineRequest — Table 4.5
&nbsp;&nbsp;&nbsp;&nbsp;4.3.6 PropertyView — Table 4.6
&nbsp;&nbsp;&nbsp;&nbsp;4.3.7 SearchHistory — Table 4.7
4.4 Class Diagram
&nbsp;&nbsp;&nbsp;&nbsp;**Figure 4.3** — Class Diagram
4.5 API Design
&nbsp;&nbsp;&nbsp;&nbsp;Table 4.8 — Auth routes
&nbsp;&nbsp;&nbsp;&nbsp;Table 4.9 — Property routes
&nbsp;&nbsp;&nbsp;&nbsp;Table 4.10 — Search & Recommendation routes
&nbsp;&nbsp;&nbsp;&nbsp;Table 4.11 — Review & Sentiment routes
&nbsp;&nbsp;&nbsp;&nbsp;Table 4.12 — Booking routes
&nbsp;&nbsp;&nbsp;&nbsp;Table 4.13 — Payment (Stripe) routes
&nbsp;&nbsp;&nbsp;&nbsp;Table 4.14 — Offline Request routes
&nbsp;&nbsp;&nbsp;&nbsp;Table 4.15 — Admin routes
4.6 Recommendation Engine Design
&nbsp;&nbsp;&nbsp;&nbsp;**Figure 4.4** — Recommendation pipeline / data-flow diagram
&nbsp;&nbsp;&nbsp;&nbsp;Table 4.16 — Scoring signal weights (Bayesian, similarity, collaborative)
4.7 Sentiment Analysis Pipeline Design
&nbsp;&nbsp;&nbsp;&nbsp;**Figure 4.5** — Sentiment pipeline (TF-IDF + Logistic Regression + rule override + aspect detection)
4.8 Image Verification Workflow Design
&nbsp;&nbsp;&nbsp;&nbsp;**Figure 4.6** — Image upload → hash/duplicate check → AI score → admin audit flow
4.9 Booking / Offline Request / Image Status Lifecycles
&nbsp;&nbsp;&nbsp;&nbsp;**Figure 4.7** — Booking status state diagram
&nbsp;&nbsp;&nbsp;&nbsp;**Figure 4.8** — Offline request status state diagram
&nbsp;&nbsp;&nbsp;&nbsp;**Figure 4.9** — Image verification status state diagram
4.10 Deployment Diagram
&nbsp;&nbsp;&nbsp;&nbsp;**Figure 4.10** — Deployment Diagram
4.11 UI/UX Design Principles (theming, i18n/RTL, shadcn/ui component system)

**Chapter 4 subtotal: ≈20 pages — Figures: 10, Tables: 16**

---

## Chapter 5 — Implementation (≈21 pages)

5.1 Development Environment and Tools
&nbsp;&nbsp;&nbsp;&nbsp;Table 5.1 — Tools, versions, environment variables
5.2 Technology Stack Justification
5.3 Backend Implementation
&nbsp;&nbsp;&nbsp;&nbsp;5.3.1 Project Structure — **Figure 5.1** (folder tree)
&nbsp;&nbsp;&nbsp;&nbsp;5.3.2 Authentication & Authorization
&nbsp;&nbsp;&nbsp;&nbsp;5.3.3 Property Management & Image Verification Module
&nbsp;&nbsp;&nbsp;&nbsp;5.3.4 Booking & Payment Module (Stripe test mode + demo payment)
&nbsp;&nbsp;&nbsp;&nbsp;5.3.5 Review & Sentiment Integration
&nbsp;&nbsp;&nbsp;&nbsp;5.3.6 Offline Request Module
&nbsp;&nbsp;&nbsp;&nbsp;5.3.7 Recommendation Engine Implementation
&nbsp;&nbsp;&nbsp;&nbsp;5.3.8 Admin Module
5.4 Sentiment Microservice Implementation (FastAPI, model training, `/predict` endpoint)
5.5 Frontend Implementation
&nbsp;&nbsp;&nbsp;&nbsp;5.5.1 Project Structure & Routing — **Figure 5.2** (folder tree / route map)
&nbsp;&nbsp;&nbsp;&nbsp;5.5.2 Role-Based Dashboards (Guest / Owner / Admin)
&nbsp;&nbsp;&nbsp;&nbsp;5.5.3 Booking & Review Flow UI
&nbsp;&nbsp;&nbsp;&nbsp;5.5.4 Multilingual (i18n) & RTL Implementation
&nbsp;&nbsp;&nbsp;&nbsp;5.5.5 Theming (Dark / Light Mode)
5.6 Key Algorithms (pseudocode / code listings)
&nbsp;&nbsp;&nbsp;&nbsp;5.6.1 Bayesian Quality Ranking
&nbsp;&nbsp;&nbsp;&nbsp;5.6.2 Content-Based Similarity Scoring
&nbsp;&nbsp;&nbsp;&nbsp;5.6.3 Collaborative Filtering (Co-occurrence Matrix)
&nbsp;&nbsp;&nbsp;&nbsp;5.6.4 Sentiment Rule-Based Override Logic
5.7 Security Measures Implemented (JWT, bcrypt, role middleware, Stripe test-mode guard)

**Chapter 5 subtotal: ≈21 pages — Figures: 2 (+ code listings), Tables: 1**

---

## Chapter 6 — System Testing (≈10 pages)

6.1 Testing Objectives and Strategy
6.2 Black Box Testing
6.3 White Box Testing
6.4 Test Case Design

| # | Feature | Table |
|---|---|---|
| 6.4.1 | Registration | Table 6.1 |
| 6.4.2 | Login (valid) | Table 6.2 |
| 6.4.3 | Invalid Login Attempt | Table 6.3 |
| 6.4.4 | Property Search | Table 6.4 |
| 6.4.5 | Search Filters | Table 6.5 |
| 6.4.6 | Listing Creation | Table 6.6 |
| 6.4.7 | Image Upload & Duplicate Detection | Table 6.7 |
| 6.4.8 | Booking Creation (availability/overlap check) | Table 6.8 |
| 6.4.9 | Stripe Test Payment | Table 6.9 |
| 6.4.10 | Booking Cancellation | Table 6.10 |
| 6.4.11 | Offline Request Submission | Table 6.11 |
| 6.4.12 | Offline Request Response | Table 6.12 |
| 6.4.13 | Review Submission & Sentiment Result | Table 6.13 |
| 6.4.14 | Recommendation Display (cold-start) | Table 6.14 |
| 6.4.15 | Recommendation Display (personalized) | Table 6.15 |
| 6.4.16 | Admin Listing Approval (verified-image gate) | Table 6.16 |
| 6.4.17 | Admin Image Audit Actions | Table 6.17 |
| 6.4.18 | Admin User Verification | Table 6.18 |
| 6.4.19 | Language Switch (RTL/LTR layout) | Table 6.19 |

6.5 Test Results Summary
&nbsp;&nbsp;&nbsp;&nbsp;Table 6.20 — Pass/Fail summary of all test cases
6.6 Defects Identified and Resolved

**Chapter 6 subtotal: ≈10 pages — Tables: 20**

---

## Chapter 7 — Results and Evaluation (≈7 pages)

7.1 Sentiment Model Evaluation
&nbsp;&nbsp;&nbsp;&nbsp;**Figure 7.1** — Confusion matrix / accuracy chart
&nbsp;&nbsp;&nbsp;&nbsp;Table 7.1 — Precision / Recall / F1 per sentiment class
7.2 Recommendation Engine Evaluation
&nbsp;&nbsp;&nbsp;&nbsp;Table 7.2 — Cold-start vs. personalized section comparison (sample scenario)
7.3 Image Verification Heuristic Evaluation
&nbsp;&nbsp;&nbsp;&nbsp;Table 7.3 — Sample AI-score outcomes vs. manual admin decision
7.4 Usability Observations (multilingual/RTL walkthrough)
7.5 Discussion of Results vs. Objectives

**Chapter 7 subtotal: ≈7 pages — Figures: 1, Tables: 3**

---

## Chapter 8 — User Manual (≈11 pages)

8.1 Guest Manual
&nbsp;&nbsp;&nbsp;&nbsp;Figures 8.1–8.6 — Register/Login, Search & Filter, Property Detail, Booking & Payment, Write Review, Offline Request
8.2 Owner Manual
&nbsp;&nbsp;&nbsp;&nbsp;Figures 8.7–8.10 — Owner Dashboard, Create/Edit Listing, Image Upload Status, Offline Request Responses
8.3 Admin Manual
&nbsp;&nbsp;&nbsp;&nbsp;Figures 8.11–8.14 — Admin Dashboard, Listing Moderation, Image Audit, User Management

**Chapter 8 subtotal: ≈11 pages — Figures: 14**

---

## Chapter 9 — Conclusion and Future Work (≈5 pages)

9.1 Summary of Work
9.2 Limitations
9.3 Future Enhancements
9.4 Conclusion

---

## References (≈2 pages)

Numbered `[1]…[n]`, IEEE-style, format matching ISAR template (`Name/Org, "Title," Description: URL.`) — includes Airbnb, Booking.com, Wego, academic sources on TF-IDF/Logistic Regression sentiment analysis, Bayesian ranking, collaborative filtering, react-i18next/RTL design guidance, Stripe API docs, MongoDB/Mongoose docs.

---

## Appendices (≈9 pages)

| Appendix | Title | Content |
|---|---|---|
| A | Environment Setup & Installation Guide | `.env` variables, run instructions for client/server/sentiment-service |
| B | Full API Endpoint Reference | Consolidated table of all ~30 endpoints (method, path, auth, body) |
| C | Complete Database Schema Listing | All 7 Mongoose schemas, full field listing |
| D | Sentiment Model & Training Data Details | Pipeline params, dataset source, aspect keyword lists |
| E | Additional UI Screenshots | Any screens not covered in Chapter 8 |
| F | Full Test Case Execution Log | Expanded version of Table 6.20 with dates/tester notes |

---

## Page Budget Summary

| Section | Pages |
|---|---|
| Front Matter | 9 |
| Ch.1 Introduction | 7 |
| Ch.2 Literature Review | 8 |
| Ch.3 System Analysis & Requirements | 23 |
| Ch.4 System Design | 20 |
| Ch.5 Implementation | 21 |
| Ch.6 System Testing | 10 |
| Ch.7 Results & Evaluation | 7 |
| Ch.8 User Manual | 11 |
| Ch.9 Conclusion & Future Work | 5 |
| References | 2 |
| Appendices | 9 |
| **Total** | **≈132 pages** |

---

## Consolidated Diagram/Workflow Inventory (for planning)

**UML/architecture diagrams (10):** Use Case, 3× Activity (Guest/Owner/Admin), ERD, Class, Deployment, Architecture (3-tier), Recommendation pipeline, Sentiment pipeline.

**State diagrams (3):** Booking lifecycle, Offline Request lifecycle, Image verification lifecycle.

**Sequence diagrams / workflows (14):** Register, Login, Search & Filter, View Property Details, Book & Create Booking, Stripe Checkout, Cancel Booking, Submit Offline Request, Owner Responds to Offline Request, Write Review & Sentiment Analysis, View Recommendations, Owner Create/Edit Listing + Images, Admin Approve/Reject Listing, Admin Image Audit & User Management.

**Use cases (23):** listed in §3.6 above — every guest/owner/admin action actually implemented in the codebase, replacing the proposal's SMS/chatbot use cases with the real form-based offline-request and non-chatbot recommendation flow.

**Tables (≈70 across the whole document):** functional/non-functional requirements, 23 use-case tables, 7 schema tables, 8 API tables, 1 scoring-weights table, 1 tools table, 19 test-case tables + 1 summary, 3 evaluation tables, 1 feature-comparison table.

---

## Deviations From the Supplied Materials (flag for supervisor discussion)

1. **Chapter 2 (Literature Review)** is not present in `ISAR Doc v1.pdf`'s chapter list — added because a 130-page submission-ready dissertation normally requires it. Can be removed/merged into Ch.1 if your department's format forbids it (saves ≈8 pages).
2. **Database:** proposal/template imply MySQL/PostgreSQL and an ERD with relational tables — actual system uses **MongoDB/Mongoose**. Chapter 4 ERD will be presented as a conceptual/document-model ERD, explicitly noting the NoSQL adaptation.
3. **SMS booking & chatbot** (in proposal and template use cases UC-07, UC-10 "Chat With Bot") do **not exist** in the code — replaced throughout with the actually-implemented **form-based Offline Request** workflow and a **non-chatbot recommendation engine**, consistent with your project rule that chat/SMS are out of scope.
4. **"Handle Complaints"** (template UC-19) has no dedicated complaint entity in code — mapped to the Offline Request response workflow in this outline.
5. **Payment gateways** (EasyPaisa/JazzCash/Sadad Oman in proposal) — actual system uses **Stripe test mode** + an internal "demo payment" path; documentation will describe this as the current prototype's payment simulation, not a production gateway.
6. **"Monitor AI Performance"** (template UC-20) has no dedicated dashboard in code — replaced by Chapter 7's Results & Evaluation chapter as the place where AI/ML performance is discussed instead of a live admin screen.

---

*This file is a structural design only. No dissertation prose has been written. Next step (on your go-ahead): draft Chapter 1, or any chapter you want to start with, following this exact outline and the ISAR template's formatting conventions.*
