# IARS Project Guidance (Index)

This folder documents the **Intelligent Accommodation Review System (IARS)**: roles, workflows, modules, pages, recommendations, sentiment, and image audit.

---

## Start here

| File | What it covers |
|------|----------------|
| [GUIDANCE.md](./GUIDANCE.md) | Master overview — architecture, stack, how pieces connect |
| [workflows.md](./workflows.md) | **Index of all workflows** |
| [roles.md](./roles.md) | **All roles overview** + permission matrix |
| [main-workflow.md](./main-workflow.md) | End-to-end FYP chain mapped to files |

---

## Roles (detailed)

| File | Role |
|------|------|
| [role-guest.md](./role-guest.md) | Guest pages, journeys, APIs, test checklist |
| [role-owner.md](./role-owner.md) | Owner listing / images / offline replies |
| [role-admin.md](./role-admin.md) | Image audit, listing approve, users |

---

## Workflows (detailed)

| File | Workflow |
|------|----------|
| [workflow-auth.md](./workflow-auth.md) | Register / login / JWT / guards |
| [workflow-listing.md](./workflow-listing.md) | Create listing → verify images → approve |
| [workflow-search-recommend.md](./workflow-search-recommend.md) | Search, views, recommendations |
| [workflow-booking-payment.md](./workflow-booking-payment.md) | Book, Stripe / demo pay, cancel |
| [workflow-review-sentiment.md](./workflow-review-sentiment.md) | Review → ML predict → display → ranking feature |
| [workflow-offline.md](./workflow-offline.md) | Form-based offline booking |
| [workflow-admin.md](./workflow-admin.md) | Admin moderation & users |

---

## Core AI / quality features

| File | Topic |
|------|-------|
| [recommendation-system-complete.md](./recommendation-system-complete.md) | **Full viva guide** — how it works, step-by-step, supervisor Q&A, summary |
| [recommendation-client-script.md](./recommendation-client-script.md) | **1–5 min client speech** + exact code file references |
| [recommendations.md](./recommendations.md) | Concise engine map, formulas, file list |
| [sentiment-model.md](./sentiment-model.md) | FastAPI model + Node bridge + UI |
| [image-audit.md](./image-audit.md) | Verification, AI score, admin audit gate |

---

## Modules & pages

| File | Topic |
|------|-------|
| [backend-modules.md](./backend-modules.md) | Controllers, routes, models, utils |
| [frontend-modules.md](./frontend-modules.md) | Services, components, context, i18n |
| [website-pages.md](./website-pages.md) | Every route / page |
| [api-cheatsheet.md](./api-cheatsheet.md) | All HTTP endpoints |
| [i18n-layout.md](./i18n-layout.md) | EN / UR / AR + RTL rules |
| [setup-scripts.md](./setup-scripts.md) | Install, run, seed, train, debug |

---

## Stack (quick)

- **Frontend:** React (JSX) + Vite + Tailwind + shadcn/ui + i18next  
- **Backend:** Node.js + Express + MongoDB + Mongoose  
- **Sentiment:** FastAPI + TF-IDF + Logistic Regression  
- **Payments:** Stripe (+ demo confirm)

---

## Scope rules

Do **not** add out-of-scope features (chat, wishlist, coupons, real SMS, blog, etc.) until the main workflow is complete and tested.

Allowed: improve existing features, validation, loading/empty/error states, responsiveness, clean structure.

---

## Academic docs (optional)

- `docs/recommendation_algorithm.md`
- `docs/bayesian_quality.md`
- `docs/FYP-Recommendation-System-Documentation.md`
