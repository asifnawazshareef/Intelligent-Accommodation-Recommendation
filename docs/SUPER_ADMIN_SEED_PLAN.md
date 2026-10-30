> Implementation status: implemented on `feature/faker_seed_data`. See [setup and behavior](FAKER_SEEDING.md) for the final contract. Both CLI and dashboard writes require a replica set; uploaded files are retained because ownership cannot be proven safely.

# Super admin seed dashboard plan

## Status and scope

Planning extension prepared on October 23, 2026 for the repository inspected at commit `306fb8a8057e84a7e7308279a42ff0e12361e4f0`.

Local working branch: `feature/faker_seed_data`.

This extends [FAKER_SEED_PLAN.md](FAKER_SEED_PLAN.md). It plans dashboard generation, full CRUD for seed users, properties, bookings, and reviews, and bulk management. Implementation and database changes have not started. Publishing the branch still requires a connected GitHub account with write permission.

## 1. Existing application and integration approach

The application already has an admin dashboard, user verification, listing moderation, image audit, and role protected routes. User roles are guest, owner, and admin. There is no separate super admin permission in the inspected code.

Add an optional `isSuperAdmin` Boolean to User, defaulting to false. A super admin remains an admin and must satisfy both `role === "admin"` and `isSuperAdmin === true`. Existing role based navigation and admin permissions therefore continue to work.

Add a dedicated server permission guard for every Seed Data endpoint. Include the permission in the login and current user responses for navigation, while the server always reads the current database user before allowing an operation. A client flag or a modified request body cannot grant access.

A server command grants the first super admin permission to an explicitly selected existing admin account. It is never granted by registration, the dummy data generator, or a normal admin role update. Protect super admin accounts from modification through ordinary admin management endpoints. Any future grant or revoke command must preserve at least one super admin. Seed accounts can only be guests or owners and cannot be promoted to privileged accounts through another route.

The command line and dashboard call one shared service under `server/services/seed/`. The dashboard calls structured APIs; it does not execute shell commands.

## 2. Dashboard screens

Add a Seed Data navigation item and dashboard card visible to super admins. Use the existing layout, components, language files, and responsive behavior.

1. **Overview:** dataset names, current counts for each entity, latest jobs, data validation status, and actions to create or open a dataset.
2. **Generate Data:** small, standard, and custom presets; owner and guest counts; property and review counts; locations; PKR price range; status distribution; review sentiment distribution; random seed; and reference date. Show the required booking count automatically.
3. **Preview:** example records, relationship summary, exact planned counts, configuration errors, and the selected demo environment. A Generate button starts the confirmed job.
4. **Dataset Details:** tabs for Users, Properties, Bookings, and Reviews. Each has search, filters, sorting, pagination, selection counts, create, view, edit, and delete actions.
5. **Job Details:** progress by stage, committed counts, skipped records, failures with reasons, cancellation, and retry. Refreshing or closing the browser does not stop a job.
6. **History:** who generated or changed data, when it happened, the dataset, affected records, and result.

Filter by dataset, role, city, property status, rating, sentiment, creation date, and job where applicable. Use server pagination and a default page size of 25. Show a Seed data label on managed records. Display errors beside fields and announce job status changes accessibly. Confirm dialogs must support keyboard use and restore focus. Add English, Urdu, and Arabic labels to match the app's existing languages and text directions.

## 3. Full CRUD behavior

### Seed users

Create a guest or owner with Faker filled defaults or manual input. View the account and related properties, bookings, and reviews. Edit name, reserved example email, phone, language, and verification status. Provide a separate password reset action with exactly one hashing step; passwords and hashes never appear in lists, audit logs, or exports.

Generated and bulk created accounts use a demo password configured on the server. Jobs store no password value. Individual password reset requests are handled directly, with the value hashed before persistence and excluded from request logging. The dashboard does not offer to retrieve an existing password.

Allow guest or owner role changes only when their existing relationships remain valid. An owner with properties needs reassignment first. A guest with bookings or reviews cannot become an owner while those records require a guest. Deletion requires the dependency checks below. Admin and super admin accounts are outside seed CRUD.

### Seed properties

Create a property linked to a seed owner in the same dataset. Edit title, description, location, price, availability, images, and valid moderation state. View linked bookings, reviews, and sentiment totals.

Match existing validation and moderation requirements, including a verified image before approval and the current image limit. Demonstration image verification values must be identified as fixtures, not represented as actual model results. Use supported image handling rather than arbitrary remote fetches from user supplied URLs.

Reassign ownership only to a valid seed owner in the same dataset. Price changes affect new bookings; historical confirmed amounts retain their original rate. Availability or status changes that invalidate linked bookings are rejected with a dependency explanation.

### Seed bookings

Create and edit a booking using guest and property pickers limited to this dataset. Validate dates, availability, conflicts, guest counts, and legal status combinations. Calculate totals rather than accepting an arbitrary amount. Use demo payments only.

Record the booked nightly rate in seed provenance so later property price edits do not make historical totals incorrect. A deliberate booking date or rate edit recalculates its amount and is audited. If the booking already has a review, changing its guest or property must update the linked review in the same transaction. A status change that would invalidate the review is blocked until the review is explicitly resolved.

### Seed reviews

Create a review from an eligible seed booking. Derive guest and property from the selected booking. Enforce one review per booking, valid ratings, and the existing text length limit. Allow text and rating edits and movement to another eligible booking with matching derived references.

Generated review text and sentiment are coherent synthetic fixtures. Manual edits must save an explicitly identified synthetic sentiment result or complete real analysis through the existing service before saving. Do not leave an old analysis attached to new text. The existing service's unavailable fallback must not be reported as a successful model prediction.

After creating, updating, moving, or deleting a review, recompute the affected property snapshots. Moving a review updates both its former and new property. Derived counts and averages are read only in the form.

## 4. Bulk actions

1. **Generate:** create large datasets with Faker or append a chosen number of users, properties, or booking and review pairs to an existing dataset. Validate dependencies before accepting the job.
2. **Create records:** add multiple manually entered seed records through a validated batch request, in addition to Faker generation.
3. **Update users:** verification and language changes. Role changes remain subject to each record's dependency checks.
4. **Update properties:** valid moderation transitions, owner reassignment, location fields, or price changes by a fixed value or percentage. Show before and after values in the preview.
5. **Update bookings:** valid demo status changes or date changes, with conflict checks and recalculated amounts. Reject incompatible reviewed bookings instead of silently detaching reviews.
6. **Update reviews:** validated rating or explicit synthetic sentiment changes, plus regeneration or real analysis where requested. Recalculate affected snapshots once per consistent group.
7. **Delete:** selected records, all matching filtered seed records, or all records in one dataset, subject to dependency previews and confirmation.
8. **Regenerate selected records:** explicit preview of fields that will be replaced. Preserve IDs and relationships. Never reset passwords or relational fields as an incidental part of regeneration.
9. **Validate and recalculate:** check relationships, counts, bookings, and sentiment snapshots for the selected dataset.
10. **Export:** CSV for the selected entity and JSON for a dataset, with passwords, tokens, payment identifiers, and internal credentials excluded. Escape spreadsheet formula content in CSV exports.

Distinguish Select this page from Select all matching records. The server freezes the selected IDs and revisions at preview time. A later filter change or newly created record cannot silently expand the action. Store large selections in paged job items rather than one ever growing MongoDB document.

Preflight checks validate the whole planned action. Bulk requests contain only allowed fields and operators. A stale record produces a conflict requiring a new preview. Changes that span dependent records form a single transactional unit. A large job commits bounded units and reports succeeded, failed, skipped, and remaining counts accurately. Retrying a percentage increase must not apply the increase a second time.

## 5. Seed ownership, manual edits, and repeat runs

Use a separate registry as the authority for seed membership. Do not infer it from email prefixes, titles, or client supplied flags. Existing records are not automatically adopted.

1. **SeedDataset:** namespace, initial recipe, reference date, generator version, creator, reserved sequence ranges, and state.
2. **SeedRecord:** entity type, document ID, dataset ID, logical record key, origin, current revision, generation or modification fingerprints, and active or deleted state. Store booking rate metadata here as needed.
3. **SeedJob:** operation, actor, validated options, status, progress, request key, lease, and bounded checkpoints. Use separate job item documents for large selections and detailed outcomes.
4. **SeedAudit:** operation, actor, time, dataset, affected IDs, redacted field changes, and outcome. Audit records are not editable through seed CRUD.

Create unique indexes for dataset namespaces, entity and document membership, logical keys within a dataset, and request deduplication. Creation and registry registration must be consistent. A missing registry entry means the document is not manageable as seed data.

A successful dashboard edit updates the seed record revision. A delete leaves a small tombstone in the registry after removing the actual document. Generation retries respect both, so intentional edits persist and deleted rows do not reappear. Current counts are calculated from active records, separately from the original requested counts.

Append reserves new keys. Regenerate is a separate explicit operation. Repeating the initial seed command must not reset a dataset that has been edited through the dashboard.

## 6. Deletion and relationship protection

Preview the exact records and dependencies before a single or bulk delete. The plan includes IDs, revisions, counts, and a short expiry. Execution rechecks all of them. Large deletions require the dataset name to be entered in the confirmation dialog.

1. Deleting a review recalculates its property's snapshot and leaves its booking eligible for another review.
2. Deleting a booking is blocked if it has a review, unless that seed review is explicitly included in the confirmed deletion plan.
3. Deleting a property is blocked while bookings, reviews, views, or offline requests refer to it, unless every affected record is proven to belong to the same seed dataset and is included in the plan.
4. Deleting an owner requires reassignment of its properties or explicit inclusion of the complete seed dependency group. Deleting a guest similarly checks bookings, reviews, views, searches, and offline requests.
5. Any unrelated, unregistered, or other dataset dependency blocks the affected deletion group. The dashboard explains the blocker without offering an unrestricted force delete.
6. Remove children before parents, inside bounded transactions. Delete a parent only after every dependency has been resolved. A dataset is marked removed only after its active record count reaches zero.
7. Only remove uploaded files proven to belong to the deleted dataset and no longer referenced elsewhere. Shared assets and external image URLs are never deleted by the cleanup.

The inspected app also creates PropertyView, SearchHistory, and OfflineRequest records during normal use. Add targeted provenance handling for demo activity only when its relevant user and property links are proven to belong to the same dataset. Unknown or mixed activity remains unregistered and blocks cleanup when applicable. This allows demo sessions to be cleaned up without treating real activity as dummy data.

Deletion is permanent for application records. Audit history and tombstones remain. The first release does not label deletion as reversible or promise an undo feature.

## 7. Background jobs and concurrency

Use durable MongoDB job records with a separate Node worker, started by a documented npm command. This fits the existing stack and avoids adding another queue service for the initial FYP version.

The API validates the request and returns a job ID. The dashboard polls for progress. States include queued, running, cancel requested, cancelled, failed, and completed. Cancellation stops at a safe checkpoint and keeps committed work; it does not imply rollback of the entire job.

Use request deduplication keys to prevent double submissions. A worker claims a job atomically, renews its lease, and checkpoints progress. A dataset write lock and fencing token prevent an expired worker from continuing after another worker takes over. Retry starts from verified committed work. A job completes only after relationship checks and snapshot updates finish.

Store each committed unit's deduplication result in the same transaction as its application changes. If a worker loses its response after commit, the retry can prove the operation already happened. Precompute target values from the confirmed preview rather than repeating arithmetic or incrementing counters on retry.

Check the requesting user's current super admin permission when a job starts and between batches. Revocation stops further work at a safe checkpoint. Never store bearer tokens in job records.

Normal application mutations involving seed records also need the dataset guard, including review creation, booking changes, property edits, moderation, and demo activity tracking. All such writes must participate in the same guard and revision checks so a new booking cannot race a property deletion. A real user interaction with a seed property must also honor the guard. Operations on unrelated records retain their existing behavior.

Use a database with transaction support for dashboard mutations. A local replica set is sufficient. A standalone server can still use the command's documented recoverable generation mode, but dashboard CRUD and bulk writes remain disabled until the transaction prerequisite is met. Reads and previews remain available.

Use short transactions for each dependent unit, including registry updates, necessary audits, and derived snapshots. Do not wrap thousands of rows in one long transaction or use parallel promises within the same session. MongoDB transactions cover replica sets and sharded clusters; Mongoose documents the supported transaction helpers and the restriction on parallel operations in a transaction.

## 8. API and file boundaries

Mount dedicated routes under `/api/admin/seed`, guarded by authentication, super admin permission, and environment checks.

1. `GET /capabilities`: enabled state, limits, and environment label.
2. `GET /datasets` and `POST /datasets`: list or create dataset definitions.
3. `POST /datasets/:datasetId/preview`: validate generation or append configuration and return samples.
4. `POST /datasets/:datasetId/jobs`: start the exact validated generation, append, verification, or recalculation request.
5. `GET /datasets/:datasetId/:entity`: list records with allowed filters and pagination.
6. `POST /datasets/:datasetId/:entity`: create a seed record.
7. `GET /datasets/:datasetId/:entity/:recordId` and `PATCH /datasets/:datasetId/:entity/:recordId`: read or update one record with an expected revision.
8. `DELETE /datasets/:datasetId/:entity/:recordId`: execute a previously confirmed single record deletion plan.
9. `POST /datasets/:datasetId/bulk/preview` and `POST /datasets/:datasetId/bulk/execute`: validate, freeze, and execute a bulk plan.
10. `GET /jobs/:jobId`, `POST /jobs/:jobId/cancel`, and `POST /jobs/:jobId/retry`: monitor or control jobs.
11. `GET /datasets/:datasetId/history` and `POST /datasets/:datasetId/export`: history and selected exports.

Restrict entity names to users, properties, bookings, and reviews. Register specific routes before generic entity routes. Use field allowlists, bounded page and batch sizes, and expected revisions on mutations. No endpoint accepts a raw MongoDB filter, collection name, shell command, or connection string.

Planned new code includes seed models, shared services, controllers, routes, a worker, a bootstrap command, dedicated client pages, client API helpers, and tests. Targeted existing changes include User permission metadata, auth serialization, admin account protections, seed aware mutation guards, route mounting, navigation, translations, and dependency and command entries. Reuse the pure sentiment aggregation helper within a session instead of assuming the existing sync helper already joins transactions.

## 9. Environment and data limits

Dashboard seeding is explicitly enabled by server configuration in the development or demo environment. The server checks the configured permitted database name against the current connection. The browser only shows a friendly environment label and never chooses a database URI. Production mode stays blocked under this initial plan.

Start with the existing planned standard dataset: 50 owners, 450 guests, 1,000 properties, 5,000 bookings, and 5,000 reviews. Retain the small test preset. Custom requests are checked against configured limits, available owners and guests, approved property count, date capacity, and worker batch sizes. Reject impossible allocations before inserting anything.

Keep Faker in the backend worker. Keep dataset identifiers and counts in logs, with no password or token output. Operators receive readable errors and the exact retry state.

## 10. Implementation phases

1. **Shared seed foundation:** deterministic Faker generation, relationship checks, seed registry, repeat run behavior, and command line tests.
2. **Super admin permission:** bootstrap command, protected APIs, auth serialization, navigation, and negative permission tests.
3. **Generation dashboard:** configuration, preview, persistent jobs, worker progress, cancellation, and retry.
4. **Individual CRUD:** all four entity screens, form validation, revision handling, relationship updates, and snapshot recalculation.
5. **Bulk management:** selection across pages, previews, batch creation and updates, confirmed dependency deletion, regeneration, and exports.
6. **Verification and delivery:** disposable database integration tests, browser checks, existing flow regression tests, client build, documentation, and a reviewable feature branch.

## 11. Acceptance criteria

1. A super admin can generate the standard dataset entirely through the dashboard and see valid results in the existing app.
2. Ordinary admins, owners, guests, and anonymous callers cannot invoke seed APIs, including direct requests with modified IDs or flags.
3. Public registration and ordinary role management cannot grant super admin access or promote known seed users to admin.
4. Every entity supports create, read, update, and delete subject to its relationship rules; generated accounts pass login checks.
5. Single and bulk review changes leave correct counts, ratings, and sentiment snapshots on every affected property.
6. Booking edits preserve dates, availability, guest and property links, and totals based on the booked rate.
7. Selected page and all matching selections affect exactly the frozen records shown in the preview. Stale revisions and unrelated IDs are rejected.
8. Repeated clicks, job retries, lease expiry, worker restarts, and cancellation never create duplicate records or apply an update twice.
9. Generation retries preserve manual edits and do not recreate tombstoned records.
10. Delete previews account for all linked models. Mixed real and seed dependencies block deletion, and no unrelated document or asset changes.
11. A concurrent booking, review, or moderation change cannot bypass seed locks or leave orphaned references during deletion.
12. The dashboard remains usable after a page refresh, on mobile and desktop, and with keyboard navigation and the app's supported languages.
13. Exported data contains no credentials and CSV values cannot become executable spreadsheet formulas.
14. Existing guest registration, owner listing creation, admin moderation, booking, demo payment, review submission, and recommendation flows pass regression checks.
15. The client build passes. Test evidence includes exact committed counts, failures, and limits; a successful partial batch is never reported as full completion.

## 12. Documentation references

1. [MongoDB transactions](https://www.mongodb.com/docs/manual/core/transactions/)
2. [Mongoose transactions and session behavior](https://mongoosejs.com/docs/transactions.html)
3. [Faker generation and reproducibility](https://fakerjs.dev/guide/usage.html)
