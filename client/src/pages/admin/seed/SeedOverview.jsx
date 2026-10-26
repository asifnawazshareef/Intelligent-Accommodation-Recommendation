import { useState } from "react";
import { ArrowRight, Database, Hotel, Users, Zap } from "lucide-react";
import { resolveImageUrl } from "@/lib/imageUrl";

const names = { users: "Users", properties: "Properties", bookings: "Bookings", reviews: "Reviews" };
const number = value => Number(value || 0).toLocaleString();
const recipeCounts = recipe => ({ users: recipe.owners + recipe.guests, properties: recipe.properties, bookings: recipe.reviews, reviews: recipe.reviews });

export function SeedSteps({ step = 1 }) {
  return <ol className="seed-steps" aria-label="Seeding steps">
    {["Choose data", "Review examples", "Generate and view"].map((label, i) => <li key={label} aria-current={step === i + 1 ? "step" : undefined} className={step >= i + 1 ? "is-current" : ""}>
      <span>{i + 1}</span>{label}
    </li>)}
  </ol>;
}

export function RecipeSummary({ recipe, title = "What you will create" }) {
  const counts = recipeCounts(recipe);
  return <section className="seed-recipe-summary" aria-label={title}>
    <h3>{title}</h3>
    <dl className="seed-count-grid">{Object.entries(counts).map(([key, count]) => <div key={key}><dt>{names[key]}</dt><dd>{number(count)}</dd></div>)}</dl>
    <p className="seed-muted">{recipe.propertySource === "pakistan_collected_v1" ? "Collected Pakistani property names and matching source photos." : recipe.propertySource === "pakistan_v1" ? "Real Pakistani property references with credited photos." : "Automatically generated names, locations and demo records."} Prices, accounts, bookings and reviews are demo data.</p>
  </section>;
}

export function SeedQuickStart({ presets, catalog, onChoose, disabled }) {
  const propertyKey = presets?.pakistanCollected ? "pakistanCollected" : "pakistan";
  const cards = [
    { key: "small", title: "Quick demo", icon: Zap, hint: "Start small and see how seeding works.", badge: "Recommended first" },
    { key: propertyKey, title: "Pakistani properties", icon: Hotel, hint: "Real property references and matching photographs.", badge: catalog?.available ? `${number(catalog.images)} photo references` : "Credited property photos" },
    { key: "users", title: "Demo accounts", icon: Users, hint: "Create guest and owner accounts without property records.", badge: "Users only" },
  ];
  return <section className="seed-quick-start" aria-label="Choose data to seed">
    <div className="seed-section-heading"><div><h2>Choose data to seed</h2><p>Everything is filled in for you. Review examples before adding records.</p></div><Database aria-hidden="true" size={26} /></div>
    <div className="seed-starter-grid">{cards.map(({ key, title, icon: Icon, hint, badge }) => {
      const recipe = presets?.[key];
      return <button type="button" key={key} className="seed-starter" disabled={disabled || !recipe} onClick={() => onChoose(key)} aria-label={`Seed ${title}`}>
        <span className="seed-starter-top"><Icon size={24} aria-hidden="true" /><span className="seed-badge">{badge}</span></span>
        <strong>{title}</strong><span>{hint}</span>
        {recipe && <span className="seed-starter-counts">{number(recipe.owners + recipe.guests)} users · {number(recipe.properties)} properties<br />{number(recipe.reviews)} bookings · {number(recipe.reviews)} reviews</span>}
        <span className="seed-starter-action">Choose this data <ArrowRight size={16} aria-hidden="true" /></span>
      </button>;
    })}</div>
  </section>;
}

export function SeedJobSummary({ job, onJobs, onRecords }) {
  if (!job) return null;
  const percent = Math.min(100, Math.max(0, Math.round((job.cursor || 0) / (job.total || 1) * 100)));
  const analysis = job.kind === "analyze_reviews";
  const cleanup = job.kind === "cleanup";
  const title = cleanup
    ? { queued: "Old seed cleanup is queued", running: job.cursor < job.options.count ? "Checking old seed records" : "Removing old seed records", cancel_requested: "Stopping after the current batch", completed: "Old seed data removed", failed: "Old seed cleanup needs attention", cancelled: "Old seed cleanup was cancelled" }[job.state] || job.state
    : { queued: analysis ? "Review analysis is queued" : "Your data is queued", running: analysis ? "Analyzing reviews with your model" : "Generating your data", cancel_requested: "Stopping after the current batch", completed: analysis ? "Model analysis is complete" : "Your job is complete", failed: analysis ? "Sentiment analysis needs attention" : "This job needs attention", cancelled: "This job was cancelled" }[job.state] || job.state;
  return <section className={`seed-card seed-progress-card seed-job-${job.state}`} aria-label="Latest seed job">
    <SeedSteps step={3} />
    <div className="seed-section-heading"><div><span className="seed-eyebrow">Latest activity</span><h2>{title}</h2></div><strong>{percent}%</strong></div>
    <progress aria-label="Seed job progress" max={job.total || 1} value={job.cursor || 0} />
    <p role="status">{cleanup ? `${number(Math.min(job.cursor, job.options.count))} of ${number(job.options.count)} checked · ${number(job.succeeded)} removed` : `${number(job.cursor)} of ${number(job.total)} records processed · ${number(job.succeeded)} succeeded · ${number(job.skipped)} skipped`}</p>
    {job.state === "queued" && <p className="seed-muted">Waiting for a worker. Keep <code>npm.cmd run seed:worker</code> running in another terminal.</p>}
    {job.error && <p className="seed-error">{job.error}</p>}
    <div className="seed-actions"><button type="button" onClick={onJobs}>View job details</button>{job.state === "completed" && !cleanup && <button type="button" className="seed-primary" onClick={onRecords}>View seeded records</button>}</div>
  </section>;
}

export function PropertyThumbnail({ image, title }) {
  const [failed, setFailed] = useState(false);
  return <img className="seed-record-thumbnail" loading="lazy" src={resolveImageUrl(failed || !image?.url ? "/seed/property.svg" : image.url)} alt={failed || !image?.url ? "Property photo unavailable" : `${title} photo`} onError={() => setFailed(true)} />;
}

function PhotoReferences({ row }) {
  return row.images?.length > 0 && <div className="seed-photo-preview">{row.images.map((photo, i) => <figure key={`${photo.url}:${i}`}>
    <img src={resolveImageUrl(photo.url)} alt={photo.caption || `${row.title} photo ${i + 1}`} loading="lazy" />
    <figcaption>{photo.credit ? <>{photo.credit.author}{" · "}<a href={photo.credit.sourceUrl} target="_blank" rel="noopener noreferrer">Photo source</a>{" · "}{photo.credit.licenseUrl ? <a href={photo.credit.licenseUrl} target="_blank" rel="noopener noreferrer">{photo.credit.license}</a> : photo.credit.license}</> : "Demo property image"}</figcaption>
  </figure>)}</div>;
}

export function SeedExamples({ samples }) {
  return <section aria-label="Sample records"><h3>Examples you will see</h3><div className="seed-example-grid">{samples.map(({ entity, payload: row }) => <article className="seed-example" key={entity}>
    <span className="seed-badge">{names[entity]}</span>
    <strong>{row.name || row.title || (entity === "reviews" ? `${row.rating} out of 5 stars` : "Demo stay")}</strong>
    {entity === "users" && <><p>{row.email}</p><small>{row.role === "owner" ? "Property owner account" : "Guest account"}</small></>}
    {entity === "properties" && <><p>{row.location?.city} · PKR {number(row.price)} per night</p><PhotoReferences row={row} />{row.seedCatalog && <a href={row.seedCatalog.sourceUrl} target="_blank" rel="noopener noreferrer">Property reference source</a>}</>}
    {entity === "bookings" && <><p>{row.startDate} to {row.endDate}</p><small>{row.guests} guests · PKR {number(row.totalAmount)}</small></>}
    {entity === "reviews" && <p>{row.text}</p>}
  </article>)}</div></section>;
}

export function SeedRecordDetails({ entity, row }) {
  const analyzed = row.sentimentAnalysis?.source === "model" && row.sentimentAnalysis?.status === "completed";
  const entries = entity === "users" ? [["Email", row.email], ["Role", row.role], ["Phone", row.phone || "Not provided"], ["Verified", row.isVerified ? "Yes" : "No"]]
    : entity === "properties" ? [["City", row.location?.city], ["Address", row.location?.address], ["Nightly price", `PKR ${number(row.price)}`], ["Status", row.status]]
      : entity === "bookings" ? [["Check in", row.startDate], ["Check out", row.endDate], ["Guests", row.guests], ["Total", `PKR ${number(row.totalAmount)}`], ["Status", row.status], ["Payment", row.paymentStatus]]
        : [["Rating", `${row.rating} out of 5`], [analyzed ? "Model sentiment" : "Demo sentiment (pending analysis)", row.sentiment], ["Analysis", analyzed ? "Completed" : "Awaiting model analysis"], ...(analyzed ? [["Confidence", `${Math.round(row.sentimentScore * 100)}%`], ["Model", row.sentimentAnalysis.model]] : [])];
  return <>
    <h3>{row.name || row.title || (entity === "reviews" ? "Demo review" : "Demo booking")}</h3>
    <dl className="seed-detail-grid">{entries.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? "Not provided"}</dd></div>)}</dl>
    {(row.description || row.text) && <p className="seed-detail-text">{row.description || row.text}</p>}
    {entity === "reviews" && analyzed && row.summary && <p className="seed-detail-text">{row.summary}</p>}
    {entity === "properties" && <><PhotoReferences row={row} />{row.seedCatalog && <a href={row.seedCatalog.sourceUrl} target="_blank" rel="noopener noreferrer">Property reference source</a>}</>}
    <details className="seed-advanced"><summary>Technical record details</summary><pre>{JSON.stringify(row, null, 2)}</pre></details>
  </>;
}
