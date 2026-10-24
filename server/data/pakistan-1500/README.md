# Pakistani property collection

The active immutable snapshot is selected by index.json. Its SHA256 is the
uncompressed JSON digest and is verified before use. Keep existing snapshot files
when updating the catalog or restoring a database; dataset recipes pin the digest.

Current actual count: **1096 properties and 2195 photo references**. Target: 1500.
Remaining: 404. Collection date: 24 October 2026.

| Source website | Properties |
| --- | ---: |
| Sleepzon | 903 |
| Porter Pakistan | 165 |
| PC Hotels | 28 |

Each property has two or three photos in the current snapshot, within the required
two to five range. Each chosen URL appears in its property's source gallery. Photo
responses passed format, content type and content hash checks at collection time.
Properties, names and photo contents are deduplicated. The source listing is the
basis of the property association; businesses were not independently inspected.
Some addresses identify only a city. Data is preserved as published by the source.

Photo files and source page HTML are not distributed here. External photo references
remain subject to their sources and may later change, expire or reject embedding.
Credits link to the source and do not assert an open license or undisclosed author.
The records include no scraped guest reviews or personal contact details.

Use the Collected Pakistani properties dashboard preset for the current count.
Prices, owners, guests, bookings, reviews and availability are FYP demonstration
data, not facts about these businesses. The 1500 preset stays unavailable until
that many qualifying records have been packaged.

The collector can bootstrap a new local checkpoint from this snapshot and its
public recovery URL queue. Existing local checkpoints take precedence. From the
server folder on Windows, run npm.cmd ci and npm.cmd run seed:collect:pakistan.
Collection stopped here because this environment blocked further network access
to the main listing source. The remaining records must still qualify; the tool
never invents properties or substitutes unrelated photographs to reach the target.

See docs/FAKER_SEEDING.md for setup, preview, worker, dashboard and recovery details.
