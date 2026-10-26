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

### Supervisor demonstration

Choose **Supervisor demo** on the Seed Data page. The packaged collected catalog supplies 200 unique hotel names from source pages across Pakistani cities, plus matching source photo references. The preset creates 25 owners, 100 guests, 200 properties, 800 historical demo bookings and 800 clearly labeled fictional reviews. Every hotel gets at least one review, with a varied distribution from one to eight reviews per hotel rather than exactly four each. New collected property datasets also vary their reviews. The availability window for every Supervisor property ends on February 28, 2027, so guests can select checkout dates through that day. Historical bookings attached to reviews still predate the reference date. It guarantees positive, negative, neutral and mixed example text. Select model analysis in the review step and run the Python sentiment service and worker to save actual model predictions, confidence and aspects; predictions may differ from the example labels. Prices, availability, accounts, bookings and reviews are invented and do not claim real customer experiences or hotel affiliation.

Alternatively, use `npm.cmd run seed:faker -- --preset supervisor --namespace supervisor_demo --actor EXISTING_SUPER_ADMIN_ID --apply --analyze` from the project root after starting the sentiment service. Choose a new namespace for each fresh demo. The command exits with an error if analysis cannot finish. The dashboard shows the resulting job and per dataset model analysis counts.

In the dedicated demonstration database, generated supervisor owners use `owner**11**` and generated guests use `guest11**` unless `SEED_OWNER_PASSWORD` and `SEED_GUEST_PASSWORD` are set. The initial demo admin setup script uses `admin11****` unless `ADMIN_PASSWORD` is set. Existing accounts retain their current passwords. These shared credentials are only for the demonstration environment; replace them for a shared or exposed instance.

Owners can choose local JPG, PNG or WebP photos from their property edit page. A super admin can choose photos for a seeded listing using **Seed Data → Properties → Upload photos**. Both flows limit each property to five images of at most 5 MB each. Newly uploaded photos enter the normal image review flow. The packaged hotel source images remain remote references until an owner or admin replaces them with uploaded files.

### Replacing a previous seed

Creating a new dataset adds records to the same demo application database; it does not overwrite an earlier dataset. Generate and check the new dataset first. Then open **Seed Data**, select the new dataset, and use **Old seed data → Remove old seed data** for each previous dataset. Preview the exact record counts, type that old dataset's name, and confirm. A dedicated worker job checks every record and related activity in batches before it starts deleting anything. The worker then deletes only records tracked by that dataset, including its related demo activity. The preview does not create thousands of plan items or wait for each dependency check. Keep the worker running until the job is complete. When the cleanup job completes, the old dataset disappears from the selector; its audit and job history remain for investigation. Untracked application records and the new dataset are preserved. If cleanup fails because a record has untracked edits or outside dependencies, the job shows the error and keeps the old dataset visible; resolve the dependency and retry the job. If cleanup is cancelled after deletion begins, some old records may already be gone; retry the same job to finish safely.


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
npm ci
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

Install Python 3.11 or 3.12 on the current PC. From the repository root, create a local Python environment once:

```sh
npm.cmd run sentiment:setup
npm.cmd run sentiment:check
```

If setup reports no matching SciPy distribution, run this repair instead:

```sh
npm.cmd run sentiment:repair
```

Repair uses the official PyPI HTTPS source for this installation, ignores saved package source overrides, reuses downloaded packages and retries intermittent resolution failures, and keeps existing pip configuration files unchanged. Custom certificate and proxy environment settings are preserved. It upgrades pip inside the project environment, installs binary packages with pinned NumPy and SciPy versions, checks dependency consistency, and executes the trained model before reporting success. The sentiment service uses base Uvicorn for HTTP and does not install the optional standard extras such as WebSockets, uvloop or watchfiles. Its development reload uses the built in file watcher when watchfiles is absent. Network access to `pypi.org` and `files.pythonhosted.org` is required. If repair fails, read its download error and do not start the app yet.

Then start the client, server, sentiment model and seed worker together:

```sh
npm.cmd run dev:seed
```

Stop older app terminals with Ctrl+C first so they do not occupy the same ports. The client now refuses to move from port 5173 to another port. If 5173 is occupied, stop the existing app process and retry. The combined command checks a model prediction before launching any service. Keep MongoDB running. On Linux or macOS use `npm` instead of `npm.cmd`. The setup command uses your configured package source and installs the pinned requirements in `sentiment-service/.venv`; it does not install Python itself. The launcher checks working Python 3.11/3.12 installations and skips broken copied environments. `SENTIMENT_PYTHON` can specify an executable explicitly. The trained file `sentiment-service/models/sentiment_pipeline.joblib` must be present.

The worker uses the same environment and database as the server. It is a separate process so leaving the dashboard does not interrupt a job. The database stores checkpoints; after a worker crash, a replacement can reclaim an expired lease within approximately two minutes. If running services separately, start `npm run server`, `npm run client`, `npm run sentiment` and `npm run seed:worker`. The regular `dev` command starts only the first three.

The dashboard selects **Analyze reviews with my sentiment model after generation** by default. Configure `SENTIMENT_API_URL` for both the server and worker if the model uses a different address.

Generation first saves demonstration accounts, properties, bookings and review text, then queues a separate **Analyze reviews** job. The worker calls the actual Python model and saves its sentiment, confidence, aspects, summary, model version, text hash and analysis time. Property summaries refresh with each committed analysis batch. The text remains synthetic; its predictions come from the model. Sentiment percentages control text generation, so final predicted percentages may differ.

The existing trained model is reused without retraining. The service treats a plain stay duration such as “We stayed for 5 nights.” and the exact disclosure “Demo review, not a real guest experience.” as factual context. These sentences remain visible in the review but cannot turn otherwise positive feedback into a mixed prediction. Actual positive and negative clauses still produce mixed sentiment. The model version identifies both the trained artifact and inference code.

The **Sentiment model** panel shows model health, worker heartbeat, analyzed counts and pending reviews. The worker automatically queues the first analysis for older tracked fixture reviews that have no analysis metadata and still show “Synthetic demo feedback. Not a model prediction.” with confidence zero. It waits for the model to become available, verifies the original creator still has super admin permission, and respects provenance checks. It does not retry a dataset that already had an analysis job, including a cancelled or failed job, or adopt unrelated reviews. New datasets explicitly generated without analysis stay pending until you choose **Analyze all pending reviews**. No reseeding or deletion is needed. An open property page refreshes pending reviews every five seconds while visible and on window focus, then stops polling when none remain. A failed or cancelled analysis resumes through **Jobs → Retry**. Completed predictions for unchanged text are skipped; editing a review marks it pending again. If the model is offline or returns invalid results, analysis fails visibly without saving a neutral fallback. Normal review submission returns HTTP 503 and saves no review until the model is available.

Uncheck model analysis only when deliberately generating fixture data without Python. Such records retain confidence zero and a synthetic summary until analyzed. Image verification labels remain demonstration inputs, not image model predictions.

## Generate from the dashboard

1. Open `/admin/seed` and choose **Quick demo**, **Pakistani properties** or **Demo accounts**. Each card shows the exact counts. **New dataset** opens all presets, including user only, city and sentiment scenarios.
2. Review the totals. The name and unique dataset identifier are already filled in. **Customize counts and settings** is optional; the identifier is under **Advanced dataset identifier**.
3. Press **Review seed data**. The dashboard saves the dataset settings and automatically loads readable sample cards. Application records are generated only after you press **Start generation**. Saved initial settings are read only during review.
4. Follow the progress panel. A queued job displays the worker command. Keep the worker running in another terminal. Cancelled or failed jobs retain completed batches; **Retry** in job details resumes from the checkpoint.
5. Press **View seeded records**, or a Users, Properties, Bookings or Reviews count, to open those records. Properties have thumbnails. **View** opens readable fields, photos and source credits; raw fields remain under **Technical record details**.
6. Use **Add more data** to choose another preset or settings. **More dataset actions** contains validation, recalculation and dataset deletion. **Filters, bulk actions and exports** contains date filters, bulk tools and downloads; it also opens when records are selected.
7. Use the dataset selector to switch between collections, or open a recent dataset card on the start screen. Search empty states offer **Clear filters**. Records from a previous dataset are hidden while the next dataset loads.

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

For CLI generation followed by actual model analysis, add `--analyze`:

```sh
npm run seed:faker -- --namespace fyp_demo --actor EXISTING_ADMIN_OBJECT_ID --apply --analyze
```

The CLI runs the analysis job itself after generation and exits nonzero if analysis fails. Retry that saved job in the dashboard with the worker running. CLI previews never contact the model. CLI calls without `--analyze` retain the existing fixture behavior.

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

Bulk actions freeze the selected IDs, expected revisions, and exact proposed changes in a preview valid for 15 minutes. Changing a filter or dataset after preview requires a new preview. Execution rejects stale dataset revisions. Bulk create accepts up to 100 records, explicit selection accepts up to 500 IDs, and Select all matching supports larger filtered selections. The selected review **Analyze sentiment** bulk preview accepts at most 50 reviews and performs external analysis before freezing the plan. **Analyze all pending reviews** uses a resumable job without that selection limit and makes model calls outside database transactions, with at most four calls per batch.

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

* **Queued forever:** run `dev:seed` against the same database and check the WORKER console. The dashboard reports whether a worker heartbeat is present.
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

Open Seed Data, choose a quick start card or New dataset, and select a scenario. The name and unique
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

The branch includes an audited partial snapshot of **1096 Pakistani property
references with 2195 matching photo references**, from Sleepzon (903), Porter
Pakistan (165) and PC Hotels (28). Every selected photo URL and each property name,
city and address was checked against its cached source page. The source listings
establish the association; this is not an independent inspection of the businesses.
Some listings publish only a city rather than a precise street address.

Use the **Collected Pakistani properties** dashboard preset to seed the available
1096 properties now. The card shows the actual property and photo counts. It also
creates 50 demo owners, 450 demo guests, 4384 historical demo bookings and 4384
explicitly labeled demo reviews. Preview before generating and keep the seed worker
running. Prices, owners, availability, bookings and reviews remain synthetic.

From the server folder, this command previews the available snapshot without
connecting to or writing the database:

```sh
npm.cmd run seed:pakistan:collected
```

The target is still **1500**, with **404 remaining**. Collection stopped because
the development environment blocked further network access to the main listing
source. No records or photos were invented to close that gap. On your own Windows
PC, install the current server dependencies and run:

```sh
npm.cmd ci
npm.cmd run seed:collect:pakistan
```

When there is no local checkpoint, the collector starts from the bundled snapshot
and its saved public URL queue, preserving all 1096 records. Existing local
checkpoints take precedence. Interrupted work resumes with the same command.
The collector still obeys robots paths, source access restrictions and request
pacing. If sources return too few qualifying records, it reports that shortfall.

After exactly 1500 qualifying properties from at least two websites are available,
the collector audits new records against cached source pages, then packages an
immutable compressed snapshot under `server/data/pakistan-1500/`. Saved records
without a local source cache must exactly match an installed snapshot verified by
SHA256. Editing a checkpoint cannot make an unverified record trusted. The snapshot
contains factual metadata, external image references and public recovery URLs.
Cached source HTML and third party photo files are not redistributed.

The **1500 Pakistani properties from multiple websites** dashboard preset becomes
available only after the complete snapshot is installed. Restart the backend and
refresh the dashboard after collection. Create a new dataset, select that preset,
preview, and start generation with the seed worker running. It includes 50 demo
owners, 450 demo guests, 1500 real property references, 6000 historical demo bookings
and 6000 explicitly labeled demo reviews. Existing partial datasets remain pinned
to their original snapshot; use a new dataset for the completed collection.

Photo ownership and source terms remain with their respective holders. This
collection does not assert an open license or identify authors the sources do not
disclose. Photographs are external references and can later be removed, changed
or blocked by their source websites. Property links and credits remain visible.

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


## Setup check and city selection

From the server folder on Windows, run:

```sh
npm.cmd run seed:check
```

This read only command checks the environment opt in, database connection, exact
permitted database name, transaction support, demo password length, worker batch
size and presence of a super admin. It prints a structured report and exits with
code 0 when configuration checks pass, or 1 when something needs attention.
Connection strings, credentials, passwords and account details are never printed.
It does not create indexes, insert data, grant permissions or start a worker.
Keep `npm.cmd run seed:worker` running separately. A ready report verifies setup,
not a live worker. The dashboard exposes the same checks under **Setup checks**.

For real property catalogs, expand **Customize counts and settings** when creating
a dataset. Search **Catalog cities**, select cities and see the exact property
count for each one. Searches ignore accents, so Islamabad also finds accented
spellings published by source listings. Selecting cities uses their original
catalog names. City counts are requested using the recipe's pinned snapshot,
so later collections cannot silently change availability for saved recipes.

Narrowing cities reduces the requested property count if needed. Use **Select all
cities**, **Clear cities** or **Use all available properties** for quick changes.
Select at least one city before continuing. The server validates the selected
cities and count again when creating and previewing a dataset.

Changing **Property data source** loads the full matching preset, including its
counts and cities. Returning to generated demo properties or the six property
catalog removes the old collected snapshot digest. The reference date is retained.
Review settings and preview samples before starting generation.

If a source denies access during collection, requests still waiting for that
source are stopped before they reach the network. This does not override source
restrictions or change the current collection count.


The preset chooser includes **Find a data preset**. After choosing a preset, the
list collapses so customization is easier to reach on mobile. **Change preset**
reopens it. Search and city filtering happen locally without repeated API calls.
