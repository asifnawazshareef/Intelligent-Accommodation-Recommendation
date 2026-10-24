# Seed feature verification

Verified locally on 2026-10-23, on branch `feature/faker_seed_data`, against repository base `306fb8a8057e84a7e7308279a42ff0e12361e4f0`.

## Automated checks

| Check | Result |
| --- | --- |
| `npm run test:seed` | 21 passed, no failures; the optional large dataset test was skipped in this run. |
| Optional standard preset integration test | Passed separately: generated and validated all 11,500 application records in about 67 seconds. |
| `npm run lint --prefix client` | Passed with existing warnings elsewhere in the client. No warnings in the seed components. |
| `npm run build --prefix client` | Passed. The existing application bundle size warning remains. |
| Server and client lockfile installation dry runs | Both passed using `npm ci --ignore-scripts --dry-run`. |
| CLI preview and argument validation | Standard preview produced 11,500 records and four entity samples without a database connection. Missing flag values returned a nonzero exit code. |

Tests use disposable MongoDB 7.0.14 replica sets and their own environment settings. They do not connect to the application's configured database.

Coverage includes deterministic generation, repeat runs, preserved passwords and edits, schema and relationship validation, batch rollback, overlapping bookings, permissions, current privilege revocation, all entity CRUD, related deletion, external dependency protection, frozen bulk previews, stale revision rejection, tombstones, CSV safety, cancellation, retries, expired leases, and competing workers.

Review tests also cover cancelled bookings after a property is rejected, default pending booking overlaps, and bulk preview rejection of repeated or existing emails, overlapping bookings, and repeated reviews in one request.

Existing application routes were exercised with generated data: login, search, bounded history pruning, recommendations, owner listings, bookings, demo payment, and reviews. The module was also checked for production and database mismatch rejection.

## Browser checks

Headless Chromium exercised the actual server, worker, and Vite application against a separate disposable database:

1. Signed in with a test super admin and opened Seed Data.
2. Created a dataset, previewed it, generated 26 application records, and waited for completion.
3. Created, edited, and deleted a user through the dashboard, including deletion preview and typed confirmation.
4. Updated selected property prices in bulk and waited for the job to finish.
5. Checked desktop and 390 pixel mobile layouts. The page had no horizontal overflow; the data table scrolls within its container.
6. Confirmed there were no browser page errors during the workflow.

The browser exercise found and resolved form labeling and button contrast issues. Generation submissions reuse their request key when retrying the same preview.

## Limits

The sentiment integration tests use a local mock response to verify request handling and persisted results. They do not evaluate the real Python model's accuracy. The real service must be running for dashboard sentiment analysis; generation itself uses explicitly labeled synthetic sentiment.

Verification uses disposable databases and no real payments or deployment. Implementation is published on feature/faker_seed_data through the authorized GitHub account, with pull request 1 open for review. Main remains unchanged.

These checks cover the new feature and the listed existing flows. They are not a complete regression suite for every page and third party service in the repository.

## Pakistani property catalog verification

The real property preset adds six unique hotels with seventeen bundled photographs.
All images were visually reviewed for relevance. Each property has two to four
photos, within the supported two to five range. Local asset checks verify each
file against its catalog SHA256 and check for repeated photo contents.

The catalog tests cover city filtering, invalid counts, image credits,
demo review labels, persistence, manual edits, idempotent generation and duplicate
append rejection. Existing application integration tests continue to pass.

Client production build and lint pass with the existing unrelated warnings.
A browser check using a disposable MongoDB replica set, backend, worker and client
confirmed dashboard generation of all 69 records, successful responses for all
17 image assets, working gallery navigation and credits, the official source link,
visible demo notices and a mobile layout without horizontal overflow or page errors.
The CLI catalog preview also succeeds without database writes.

## Collected property workflow verification

The collector tests cover explicit Pakistan locations, gallery association,
image size variants, related hotel exclusion, URL guards, redirect rejection,
non-image responses, interrupted work, resumable checkpoints, the photo cap and
Retry-After handling. Full target packaging requires exactly 1500 unique properties from at least two
source websites. Partial snapshots report their actual counts and cannot enable
the 1500 preset. Both snapshot types verify integrity by SHA256. Tests cover
bootstrapping from a bundled snapshot without fetching saved records and rejecting
checkpoint edits when no cached source confirms them.

The current build and lint checks pass with existing unrelated warnings. A browser
check using a disposable database confirmed that a collected property displays
its actual source photographs, matching photo credits, the reference link and a
visible FYP demo notice. The desktop and mobile layouts passed without horizontal
overflow or page errors. Real image responses were fetched through the test
client's outbound proxy for this environment, then supplied unchanged to the
browser. External photos can become unavailable after collection.

The installed collection import check is available with SEED_COLLECTED_LOAD=1.
It uses the actual snapshot count and checks generated properties, historical demo
bookings, demo reviews and dataset validation in an isolated MongoDB replica set.
The current snapshot has 1096 properties. A missing or incomplete catalog cannot
enable the 1500 preset. The remaining 404 records require further source access;
the environment blocked collection before the target was reached.


## Audited collection checkpoint, 24 October 2026

The published snapshot contains 1096 properties and 2195 photo references from
three websites. Every record's name, city, address and selected gallery URLs were
audited against its saved source page before packaging. Source HTML and image
files are excluded from the snapshot. Recovery includes public URLs only.

With SEED_COLLECTED_LOAD=1, the current suite reports 37 tests: 36 pass, zero fail,
and the unrelated optional original 11500 record test is skipped. The actual
collected snapshot imports through the transactional worker into a disposable
replica set: 500 demo users, 1096 properties, 4384 bookings and 4384 reviews,
10364 generated records total. Dataset validation passes. Only the test operator
has admin privileges. Existing application route and CRUD/bulk tests pass.

A fresh browser check confirms that the dashboard shows 1096 of 1500 properties,
2195 photos and three source websites. The partial preset previews 10364 records;
the incomplete 1500 preset is absent. Desktop and 390 pixel mobile layouts have no
horizontal overflow or browser errors. Client build and lint pass with existing
unrelated warnings. The earlier real photo gallery browser check also passed.

Recovery tests verify that installed snapshot records need no network refetch,
checkpoint edits cannot grant trust, new collection work cannot mutate the cached
trusted snapshot, and new records still require source evidence. Snapshot saves
now use one consistent view for the checkpoint, report and catalog while requests
continue in flight.
