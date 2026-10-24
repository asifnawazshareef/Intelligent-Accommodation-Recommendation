# Faker seed data and super admin management

The feature is on `feature/faker_seed_data`. The existing seed scripts, roles, normal routes, and recommendation algorithm remain available. This module is opt in and is disabled when `NODE_ENV=production`.

## Apply the feature patch

The downloadable `faker_seed_feature.patch` contains the implementation and review fixes, including both plans, these instructions, and tests. It was prepared against commit `306fb8a8057e84a7e7308279a42ff0e12361e4f0`.

From a clean checkout of the repository at that base, create a separate branch and apply it:

```sh
git switch -c feature/faker_seed_data
git am /absolute/path/faker_seed_feature.patch
```

If your checkout has newer changes, review any conflicts before continuing. Do not run `git am` if these feature commits are already present. Applying the patch does not run the seeder or change a database.

## What is included

* A shared Faker generator for the CLI and the super admin dashboard.
* Users, properties, confirmed demo bookings, and reviews with valid relationships.
* Small preset: 3 owners, 12 guests, 20 properties, 60 bookings, 60 reviews.
* Standard preset: 50 owners, 450 guests, 1,000 properties, 5,000 bookings, 5,000 reviews, totaling 11,500 application records.
* Editable counts, cities, prices, reference date, random seed, approval percentage, and sentiment percentages.
* Single record create, read, update, and delete; password reset; relationship selectors with exact ID lookup.
* Bulk create, update, price percentage adjustment, regenerate selected descriptive fields, sentiment analysis, and related deletion.
* Filters, pagination, selection across matching pages, CSV/JSON exports, job progress, cancellation, retries, validation, summary recalculation, and audit history.

## Requirements

Use Node.js 22.13 or newer (Node.js 24 is recommended) and a **dedicated MongoDB replica set database**. MongoDB Atlas supports this; a single local replica set node is also sufficient. Standalone MongoDB is deliberately rejected for writes. Related mutations, provenance, and job checkpoints must commit together.

The implementation refines the original plan by requiring transactions for both CLI and dashboard writes. It does not offer a partially recoverable standalone mode.

For a new local demo instance with Docker:

```sh
docker run --name accommodation-demo-mongo -d -p 127.0.0.1:27017:27017 mongo:7.0 --replSet rs0 --bind_ip_all
docker exec accommodation-demo-mongo mongosh --eval 'rs.initiate({_id:"rs0",members:[{_id:0,host:"localhost:27017"}]})'
```

Use a different port if another database is already listening on 27017. Do not replace an existing database container.

Install from the repository root:

```sh
npm ci --prefix server
npm ci --prefix client
```

Configure the server and worker with the variables in [`server/.env.seed.example`](../server/.env.seed.example). Copy the values into your local environment configuration, keeping any existing configuration you need. Do not commit passwords or connection credentials. `MONGO_URI` and `SEED_MONGO_URI` should target the same dedicated demo database. `SEED_DATABASE_NAME` must match the actual connected database name exactly. The CLI uses `SEED_MONGO_URI`; the app, grant command, and worker use `MONGO_URI`.

The module rejects production mode, a disabled flag, a database name mismatch, or a database without transaction support. The normal app can still use a standalone database when this feature is disabled.

## Grant the super admin capability

Use an existing, nonseed admin account in the demo database. The normal registration form cannot grant this permission, and the seed generator cannot create admins. If this database has no admin, first use the repository's existing admin setup process (`server/scripts/seed.js`) with your own local environment settings.

Then, from the repository root:

```sh
npm run seed:grant -- EXISTING_ADMIN_OBJECT_ID
```

The grant script checks the dedicated database configuration before setting `isSuperAdmin: true`. Sign in again, or refresh the app so `/api/auth/me` reloads your account. **Seed Data** appears in the admin navigation and on the admin dashboard. Regular admins, guests, and owners cannot access the seed API. Every job rechecks the creating admin's current permission at each checkpoint.

There is intentionally no public role elevation endpoint. To revoke permission, a database operator can set `isSuperAdmin: false` on that same account. Jobs stop at their next checkpoint after revocation.

## Run the app and worker

Start these in separate terminals:

```sh
npm run server
npm run client
npm run seed:worker
```

The worker must use the same environment and database as the server. It is a separate process so leaving the dashboard does not interrupt a job. The database stores job state and checkpoints; after a worker crash, a replacement worker can reclaim an expired lease within approximately two minutes.

The existing Python sentiment service is optional for generation. Start it using the repository's normal setup when you want **Analyze sentiment** to run actual predictions. Synthetic fixtures have confidence zero and an explicit synthetic summary. Their sentiment and image verification labels are demonstration inputs, not model predictions.

## Generate from the dashboard

1. Open `/admin/seed`, create a dataset with a unique namespace such as `fyp_demo`, and choose the small or standard preset.
2. Adjust the generation settings. Each review includes a matching historical confirmed demo booking. The remaining sentiment percentage is mixed.
3. Preview the counts and sample records, then start generation.
4. Follow progress in Jobs. A queued job needs the worker running. A cancelled or failed job retains completed batches; Retry resumes from its checkpoint.
5. Use Validate after generation. Recalculate summaries repairs property sentiment snapshots and validates records in batches.

**Generate data** repeats the saved initial recipe. It skips existing tracked records and deletion tombstones. It preserves edits and passwords. **Add more data** reserves a new deterministic generation range and adds a separate connected set of records. It does not attach new generated bookings to existing properties, avoiding date conflicts.

Generated accounts use unique `example.test` addresses and the server's `SEED_DEMO_PASSWORD`. Passwords pass through the existing User password hook exactly once. The browser, exports, audit log, and job reports never receive password hashes or the configured shared password.

The default property image is a locally served illustration at `/seed/property.svg`. It requires no external image service. Prices are PKR; dates use ISO calendar days. Bookings are historical and nonoverlapping per property. Availability extends one year after the chosen reference date to support future demo bookings.

## Generate from the CLI

Preview is the default and does not connect to MongoDB:

```sh
npm run seed:faker
npm run seed:faker -- --standard --namespace fyp_demo
```

Apply requires an explicit database and a super admin ID:

```sh
npm run seed:faker -- --standard --namespace fyp_demo --actor EXISTING_ADMIN_OBJECT_ID --apply
```

The CLI queues and executes its own job using the same service as the dashboard. It exits nonzero on failure. If another worker claimed the job first, follow it in Jobs. On subsequent initial runs without `--config`, the stored recipe is reused, including its reference date.

Use a JSON configuration for reproducibility:

```json
{
  "owners": 50,
  "guests": 450,
  "properties": 1000,
  "reviews": 5000,
  "seed": 42,
  "referenceDate": "2026-10-01",
  "cities": ["Islamabad", "Lahore", "Karachi", "Murree"],
  "minPrice": 4000,
  "maxPrice": 45000,
  "approvedPercent": 90,
  "positivePercent": 55,
  "negativePercent": 15,
  "neutralPercent": 15
}
```

The reference date must not be in the future. Paths passed through `npm --prefix server` are relative to `server`; use an absolute path for your configuration file:

```sh
npm run seed:faker -- --config /absolute/path/demo.json --namespace fyp_demo --actor EXISTING_ADMIN_OBJECT_ID --apply
npm run seed:faker -- --config /absolute/path/demo.json --namespace fyp_demo --actor EXISTING_ADMIN_OBJECT_ID --append --apply
```

Each request supports up to 5,000 users, 5,000 properties, and 20,000 review/booking pairs. Use separate datasets or append operations for more. Large jobs are processed in batches of 25 by default. `SEED_BATCH_SIZE` accepts 1 through 100.

## CRUD and bulk behavior

Users can be guests or owners only. Changing an owner's role requires reassigning their properties first; a guest's bookings and reviews likewise protect their role. Property owners and booking guests must belong to the same dataset. Booking dates must fit availability, and active bookings cannot overlap. Changing a property's current price preserves the booked rate and total on existing bookings. Editing dates or the booked rate recalculates the booking total. Reviews derive their guest and property from their booking; booking reassignment updates the review references and both property summaries in the same transaction.

Bulk actions freeze the selected IDs, expected revisions, and exact proposed changes in a preview valid for 15 minutes. Changing a filter or dataset after preview requires a new preview. Execution rejects stale dataset revisions. Bulk create accepts up to 100 records, explicit selection accepts up to 500 IDs, and Select all matching supports larger filtered selections. Sentiment analysis accepts at most 50 reviews per job and performs external analysis before freezing the plan.

Deleting a single record or a selection uses the same preview workflow. Type the exact dataset display name to confirm. Include related seed records collects dependencies and deletes children before parents. **Any dependent activity outside the selected dataset blocks deletion**, including mixed real/demo activity. Whole dataset deletion removes application records while keeping dataset metadata, audit history, and tombstones. Create a new namespace if you want a completely fresh generation after deleting an initial dataset.

Exports contain application fields and seed revision metadata, excluding passwords and Stripe IDs. CSV values are quoted and protected against common spreadsheet formula prefixes. JSON exports are review/download files; importing arbitrary snapshots is not implemented.

## Existing application behavior

With this feature disabled, the seed request guard is a no-op. With it enabled on the permitted demo database, app mutations participate in the seed transaction gate so they cannot race related deletion. Seed jobs temporarily reject app writes with a retry message; read-only listing, review, and recommendation requests remain available. Do not run legacy seed scripts or direct database writes concurrently with seed jobs.

Normal activity whose linked records all belong to one dataset receives provenance automatically. Mixed activity is never adopted into a dataset and protects its dependencies from cleanup. Existing bounded search/view history pruning updates provenance tombstones. The ordinary booking, demo payment, review, and recommendation routes continue to operate on generated records. Seed bookings support demo payments only.

Database deletion intentionally retains uploaded files and the shared fixture. File ownership is not proven by a database record, and deleting an unknown/shared upload could break unrelated listings. Asset garbage collection is outside this feature.

## Validation and troubleshooting

```sh
npm run test:seed
npm run lint --prefix client
npm run build --prefix client
```

Tests start a disposable local MongoDB replica set, override their own configuration, and never use the application's database credentials. The first test run downloads MongoDB 7.0.14. Optional full preset test on POSIX shells:

```sh
RUN_SEED_LOAD_TEST=true npm run test:seed
```

PowerShell:

```powershell
$env:RUN_SEED_LOAD_TEST = "true"
npm run test:seed
```

A CI workflow runs integration tests, client lint, and the production build. The large preset test is opt in because it takes several minutes.

* **Queued forever:** run `seed:worker` against the same database and check its console.
* **Replica set required:** use Atlas or initialize the local replica set; do not remove the transaction check.
* **Record changed:** refresh the rows and create a new preview.
* **Untracked edit / missing document:** Validate identifies records changed by a direct database edit or legacy script. Restore the record from your database backup, or resolve the change with a database operator. The UI deliberately does not silently adopt arbitrary edits or delete unknown data.
* **Outside this dataset:** inspect the record's Dependencies in View and resolve the external relationship before trying deletion again.
* **Sentiment unavailable:** start the Python service and preview the analysis again. Synthetic generation still works without it.

Implementation references: [Faker usage](https://fakerjs.dev/guide/usage.html), [Mongoose transactions and AsyncLocalStorage](https://mongoosejs.com/docs/transactions.html).

See [verification results](SEED_VERIFICATION.md) for the checks performed and their limits.

## Ready made scenarios

New dataset offers 15 synthetic presets: Quick demo, Large FYP dataset, Guests only,
Owners only, Guests and owners, Properties with owners, Budget accommodation,
Premium accommodation, Islamabad city demo, Lahore city demo, Mountain destinations,
Positive review examples, Negative review examples, Neutral review examples and
Mixed review examples.

Open Seed Data, choose New dataset and select a scenario. The name and unique
namespace are filled automatically. Counts, prices, cities and sentiment settings
are supplied by the preset. Customize counts and settings is optional. Create the
dataset, preview the generated samples, then start generation. Keep the worker running.
The same presets are available under Add more data on an existing dataset.

Each card states exactly how many owners, guests, properties, bookings and reviews
it creates. Review presets include all required related records. They do not add
reviews to existing real bookings. Each review includes a historical confirmed demo
booking. Generated accounts never receive admin or super admin access. All existing
preview, transaction, provenance, CRUD and bulk protections remain in effect.

CLI example (preview only, no database writes):

```sh
node scripts/seedFaker.js --preset budget
```

Valid preset keys: small, standard, guests, owners, users, listings, budget, premium,
islamabad, lahore, mountains, positive, negative, neutral, mixed. Use only one of
`--preset`, `--standard`, or `--config`. Existing apply options still apply.


## Real Pakistani property preset

Choose **Real Pakistani properties** in New dataset. No property details need to
be typed. The preset creates six properties, three demo owners, twelve demo guests,
twenty four historical demo bookings and twenty four clearly labeled demo reviews.
It adds a sixteenth scenario alongside the fifteen synthetic scenarios.

| Property | City | Photos |
| --- | --- | --- |
| Pearl Continental Hotel Bhurban | Bhurban | 4 |
| Faletti's Hotel Lahore | Lahore | 3 |
| Islamabad Serena Hotel | Islamabad | 2 |
| Gilgit Serena Hotel | Gilgit | 2 |
| Serena Shigar Fort | Shigar | 3 |
| Serena Khaplu Palace | Khaplu | 3 |

Names, addresses and short factual descriptions come from the official property
sources recorded in `server/public/seed/pakistan/v1/catalog.json`. Photos come
from individually checked Wikimedia Commons file pages, with original titles,
authors, dates and Creative Commons licenses. Some photos are historical views,
corridors, gardens or exterior details. These are accurately captioned, rather
than presented as current room photos. Official hotel website photos were not copied.

The seventeen JPEGs are bundled with the server, so generation and gallery display
do not depend on external photo APIs, random image URLs or image hotlinking.
Full credits are in `server/public/seed/pakistan/v1/CREDITS.md` and displayed in
the property gallery. Preserve the credits and the individual image licenses when
redistributing the repository. Images retain their original licenses separately
from the application code.

Public information was checked on 24 October 2026. Prices and availability are
generated examples, not live quotes. Owners are synthetic demo accounts, not the
actual hotel owners. Bookings and reviews are synthetic, with a visible notice on
each property page and an explicit prefix on each generated review. The project
has no affiliation with these hotels.

Optional customization: choose `Real Pakistani property catalog` under Property
data source. Select catalog cities and at most the number of available real
properties in those cities. Requests exceeding the available catalog fail with a
clear error, instead of repeating real hotel names. Add more data can add catalog
properties from other cities, but cannot duplicate properties already in that
dataset. Rerunning initial generation remains idempotent. For thousands of unique
fictional listings, use the existing synthetic scenarios.

The versioned catalog is deliberately fixed. Expand it by adding verified property
facts, at least two relevant licensed photos, source credits and asset checks in a
new catalog version. Old dataset recipes must keep their original version.

CLI preview from the server folder:

```sh
npm.cmd run seed:pakistan
```

This only previews data. Dashboard generation still requires the existing seed
environment settings, a super admin, MongoDB transactions and the seed worker.

## Collecting 1500 genuine Pakistani property references

`npm.cmd run seed:collect:pakistan` starts a resumable collector from either the
repository root or the server folder. The default target is 1500 unique properties
with up to three gallery photos each. The `--photos 2` CLI option reduces the
collection to two photos per property, within the supported two to five range.

Sources are the published property pages on Sleepzon, Porter Pakistan and PC
Hotels. Extraction uses explicit property names, Pakistan location metadata and
property specific galleries. It does not copy long descriptions, reviews, guest
identities, accounts, live inventory or payment information. A source listing is
evidence of a property reference, not an independent inspection of the business.
Some sources publish only the city rather than a precise street address; these
records say so instead of inventing an address.

The collector respects robots paths, spaces requests, honors retry backoff,
limits response sizes and stops following access restrictions. It does not solve
CAPTCHAs, rotate identities, authenticate to source websites, follow arbitrary
redirects or fetch private network addresses. HTTP image responses are checked
and photo contents are hashed to reject duplicates. Galleries with fewer than two
usable distinct photos are skipped. A shortfall remains a shortfall.

Collection checkpoints, source page caches and reports are local files under
`server/data/pakistan-collection/` and excluded from git. Run the same command to
resume after interruption. `report.json` contains the actual count, remaining
count, source breakdown and skipped count. A collection lock prevents competing
collectors from overwriting that state. Cached source pages stay local.

After exactly 1500 qualifying properties from at least two websites are available,
the collector audits every selected record and photo URL against its cached source
page, then packages their factual metadata and external image references into
an immutable compressed snapshot under `server/data/pakistan-1500/`. Original
third party photographs are not bundled or redistributed. Photo ownership and
source terms remain with their respective holders; this collection does not
assert an open license or identify authors the sources do not disclose.

The **1500 Pakistani properties from multiple websites** dashboard preset becomes
available once a complete packaged snapshot is installed. Refresh the dashboard
after collection. Create a new dataset, select that preset, preview, and start
generation with the seed worker running. It includes 50 demo owners, 450 demo
guests, 1500 real property references, 6000 historical demo bookings and 6000
explicitly labeled demo reviews. Prices, owners, availability, bookings and
reviews remain synthetic. Photographs are external references and can later be
removed or changed by their source websites.

Existing datasets pin the snapshot by SHA256. A newer collection creates another
snapshot, so it cannot silently change an existing dataset or an in progress job.
Keep snapshot files when restoring a database. Appends reject properties already
present in the dataset, including names and cities shared with the six property
catalog. No source access or scraping takes place inside a database transaction.

Preview a ready packaged dataset from the server folder with:

```sh
npm.cmd run seed:pakistan1500
```

The preview fails clearly when the 1500 property snapshot is unavailable. The
original synthetic presets and six property licensed photo catalog remain usable.
