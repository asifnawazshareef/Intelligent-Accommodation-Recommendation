> Implementation status: implemented on `feature/faker_seed_data`. See [setup and behavior](FAKER_SEEDING.md) for the final contract. Both CLI and dashboard writes require a replica set; uploaded files are retained because ownership cannot be proven safely.

# Faker seed implementation plan

## Current status

Prepared on October 23, 2026 after inspecting the current repository.

Base commit: `306fb8a8057e84a7e7308279a42ff0e12361e4f0`.

Local branch: `feature/faker_seed_data`.

The connected GitHub accounts have read access and no push permission. The branch has been created locally and has not been published on GitHub. This document is the planning deliverable. The new seed implementation and database writes have not started.

The scope now also includes generation, full CRUD, and bulk management through the super admin dashboard. See [SUPER_ADMIN_SEED_PLAN.md](SUPER_ADMIN_SEED_PLAN.md) for the dashboard design, permission model, relationship rules, background jobs, and acceptance criteria. The dashboard and command line will use one shared seed service.

## 1. Findings that determine the design

1. The backend uses Express, MongoDB, Mongoose, JavaScript ES modules, and bcrypt.
2. User roles are guest, owner, and admin. The email must be unique. User save middleware hashes the password.
3. Properties require an owner, title, description, structured location, and price. Images are objects containing a URL and verification fields. Property status is pending, approved, or rejected.
4. Reviews require a guest, property, and booking. Booking is unique in the review collection, so each booking supports at most one review.
5. The review controller checks that the booking is confirmed and that its guest and property match the review.
6. Booking totals use the existing `calculateBookingTotal` helper. Availability checks and conflict checks must be reflected in generated data. The current conflict check treats touching date ranges as conflicts, so synthetic stays need a gap between them.
7. Property sentiment snapshots are derived using `syncPropertySentiment` and support positive, negative, neutral, and mixed reviews.
8. Existing property and review seed commands already exist. The current review seeder hashes passwords before calling `User.create`, whose save hook hashes again. The new implementation must use exactly one hashing path.
9. The root test command currently reports that no tests are configured. Seed correctness needs actual focused tests.

## 2. Scope and expected starting dataset

Add an independent command named `seed:faker`, a Seed Data section in the existing admin dashboard for super admins, and seed specific tests. Changes cover shared seed services, dedicated APIs and screens, an additive super admin permission, provenance records, dependencies, documentation, and targeted integration points described in the dashboard plan.

The initial full dataset will contain:

1. 500 users, consisting of 50 owners and 450 guests.
2. 1,000 properties distributed across the generated owners.
3. 5,000 historical confirmed bookings with confirmed demo payments.
4. 5,000 reviews, each connected to its own booking.

Counts will be configurable. A small preset will use 3 owners, 12 guests, 20 properties, and 60 linked booking and review pairs. Exact configuration validation will reject impossible combinations before writing.

Use Pakistan locations and PKR prices, matching the existing demo data and payment code. Generate coherent names, addresses, descriptions, prices, and review text. Use reserved example email addresses and stable identifiers for demo accounts.

Most properties will be approved so search and recommendations can be demonstrated. Include a smaller number of pending and rejected properties for moderation screens. Only approved properties receive bookings and reviews. No administrator accounts are needed for this dataset.

## 3. Entry point and configuration

Create `server/scripts/seedFaker.js` as a thin command line entry point. Put shared configuration, generation, persistence, verification, and management code under `server/services/seed/` so both the command and dashboard use the same rules.

Add root and server npm commands for preview, execution, and verification. The root command forwards to the server script so command behavior is consistent on Windows and other platforms.

Configuration will include user and property counts, review count, batch size, random seed, dataset namespace, fixed reference date, and an explicit seed database connection.

The default command previews the proposed dataset. Command line writing requires an explicit apply option and `SEED_MONGO_URI`. It must not silently fall back to the application's regular database credentials. Dashboard requests use the enabled demo application's existing connection and a server configured database name check. The browser never accepts or receives database credentials. Reject production mode. Redact credentials from connection errors and logs.

Pin a Faker release compatible with the backend's Node requirements and record it in the lockfile. Faker is loaded by the seed service in the command or background worker. Include it in the server dependencies needed to run that worker, with no Faker code in the client bundle. The current MongoDB dependency chain requires Node 20.19 or newer; verify the actual runtime before installation.

## 4. Generation and relationships

Generate and validate data in dependency order: owners and guests, then properties, then bookings, then reviews, then sentiment snapshots.

1. Save new users through the existing User model with the configured demo password supplied once. Let the existing save hook hash it. Use bounded concurrency and verify the saved password through `matchPassword`.
2. Assign each property to an owner generated by this dataset. Produce valid location objects, positive prices, availability ranges, and image metadata in the existing schema shape.
3. Create historical stays within property availability, with an end date after the start date. Avoid overlapping stays on a property, including touching boundaries under the current conflict rules.
4. Calculate booking amounts using the existing helper. Mark seed payments as demo payments, with no Stripe session or payment intent.
5. Keep user creation, property creation, booking creation, payment confirmation, stay, and review timestamps in a plausible order. These are historical fixtures written directly by the seed command; the public booking API rejects new bookings in the past.
6. Match each review's guest and property to its booking. Enforce ratings from 1 to 5, valid sentiment values, bounded confidence values, and review text within 1,000 characters.
7. Generate varied review sentences that agree with their ratings and sentiment, including mixed feedback. Do not use unrelated lorem ipsum for sentiment demonstrations.
8. Use deterministic synthetic sentiment fixtures for the default seed. Clearly identify these as demo fixtures in documentation and the run report. They do not represent predictions from the Python model or evidence of model accuracy.
9. Reuse the existing sentiment aggregation helper to calculate snapshots only for properties belonging to this dataset.

## 5. Repeat runs and partial failures

Use separate SeedDataset, SeedRecord, SeedJob, and SeedAudit collections. The dataset records namespace, generation version, random seed, reference date, and initial counts. Record provenance tracks document ownership, revisions, and intentional deletions. Jobs record operations and progress. Audit records capture who changed what. None stores passwords or database credentials.

Derive stable document IDs and unique demo emails from the namespace and record index. Validate all planned IDs and emails against existing records before writing. Any collision with an unrelated record stops the run.

On a repeated generation request with the same configuration, verify existing dataset records and insert only missing generated records. Respect recorded manual edits and deletion tombstones, so a retry cannot overwrite edits or recreate records deliberately deleted in the dashboard. Refuse silent changes to an initial generation recipe. An explicit append job reserves a new range of record keys; a distinct scenario uses a new dataset. Unexpected edits outside managed operations are reported as conflicts.

Insert properties, bookings, and reviews in bounded batches with Mongoose validation. Persist only after dependencies exist. After interruption, reconcile actual documents with the manifest rather than trusting progress counters. Recompute snapshots after recovery.

On standalone MongoDB, batching cannot provide an atomic transaction across all collections. Report partial completion accurately and make resuming safe. Do not claim that a failed run inserted nothing. Reject simultaneous writers for the same namespace with a manifest lock and documented stale lock recovery.

Dashboard deletion and bulk deletion operate only on proven seed records. Dependency previews, version checks, and explicit confirmation are required. The detailed dashboard plan defines transactional deletion of related seed records and blocking when unrelated records depend on them. There is no automatic database clearing or unrestricted collection deletion.

## 6. Verification and acceptance criteria

Use a disposable MongoDB database for integration tests and a fixed seed and reference date for reproducible generator tests.

1. Every generated payload passes the actual Mongoose schemas.
2. All references resolve, with correct owner and guest roles.
3. Every review has exactly one valid booking and matches its guest and property.
4. Booking dates, availability, overlap checks, payment state, and totals agree with the app's rules.
5. Seeded owner and guest accounts pass password verification and login smoke tests.
6. Initial generation reaches the exact requested counts, and a repeated run adds zero duplicates. Later manual additions and deletions are reflected in current counts and preserved on retries.
7. An interrupted run resumes to the same counts without orphaned references.
8. Unrelated preexisting records remain byte equivalent after seeding and repeat runs.
9. Sentiment counts, average ratings, and aspect totals match stored reviews.
10. Preview mode performs no database writes. Invalid options and production mode fail before inserts.
11. A collision, edited seed record, or concurrent run produces a clear failure instead of overwriting data.
12. Run the small integration preset, then the full 500 user, 1,000 property, 5,000 review dataset. Record duration and actual counts without promising a speed target before measuring it.
13. Check login, property search, property details, owner bookings, guest reviews, and recommendation responses against the seeded database.
14. Run the available client build and inspect the final diff for changes outside the approved seed scope.

## 7. Delivery

Implementation will provide the new command, super admin Seed Data screens, CRUD and bulk APIs, a durable worker, locked dependency changes, focused tests, and `docs/FAKER_SEEDING.md` with installation, permission setup, environment setup, preview, run, management, verification, and recovery instructions. The dashboard delivery phases and regression checks are specified in `docs/SUPER_ADMIN_SEED_PLAN.md`.

Publish the feature branch and open a draft pull request once a connected account has write permission. Include measured test results and any checks that could not be completed. Database population will be demonstrated against a disposable database; the user's own database requires a deliberate run with its seed configuration.

## Reference documentation

1. [Faker setup](https://fakerjs.dev/guide/)
2. [Faker reproducibility and fixed reference dates](https://fakerjs.dev/guide/usage.html)
3. [Mongoose model methods and middleware behavior](https://mongoosejs.com/docs/api/model.html)

Mongoose documents that `insertMany` validates documents but does not run save middleware. This is why user password handling and other collection batch inserts are treated separately.
