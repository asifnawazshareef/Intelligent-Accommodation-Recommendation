import {
  useEffect,
  useRef,
  useState,
  useId,
  cloneElement,
  isValidElement,
} from "react";
import { useTranslation } from "react-i18next";
import api from "@/services/api";
export function Field({ label, children }) {
  const generatedId = useId();
  const id = children?.props?.id || generatedId;
  return (
    <div className="seed-field">
      <label htmlFor={id}>{label}</label>
      {isValidElement(children) ? cloneElement(children, { id }) : children}
    </div>
  );
}
export function Modal({ title, children, onClose }) {
  const { t } = useTranslation();
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    d.showModal();
    return () => d.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="seed-modal"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-label={title}
    >
      <div className="seed-modal-head">
        <h2>{title}</h2>
        <button type="button" onClick={onClose} aria-label={t("seed.close")}>
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function ReferenceSelect({
  id,
  dataset,
  entity,
  value,
  onChange,
  role,
  eligible = false,
}) {
  const { t } = useTranslation();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const timer = setTimeout(
      () =>
        api
          .get(`/admin/seed/datasets/${dataset}/${entity}`, {
            params: {
              q,
              pageSize: 100,
              ...(role && { role }),
              ...(eligible && { status: "confirmed" }),
            },
          })
          .then((r) => {
            if (active) {
              setRows(r.data.records);
              setError("");
            }
          })
          .catch(() => {
            if (active) setError("seed.choicesError");
          }),
      200,
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [dataset, entity, q, role, eligible]);
  return (
    <div className="seed-reference">
      <input
        aria-label={t("seed.searchChoices")}
        placeholder={t("seed.searchChoices")}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <select
        id={id}
        required
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{t("seed.selectRecord")}</option>
        {value && !rows.some((r) => r._id === value) && (
          <option value={value}>{value}</option>
        )}
        {rows.map((r) => (
          <option key={r._id} value={r._id}>
            {r.name || r.title || `${r.startDate} to ${r.endDate}`}{" "}
            {r.email || String(r._id).slice(-6)}
          </option>
        ))}
      </select>
      {error && <small role="alert">{t(error)}</small>}
    </div>
  );
}
export function RecordFields({ dataset, entity, value, onChange }) {
  const { t } = useTranslation();
  const tr = (key, fallback) => t(`seed.${key}`, fallback);
  const set = (key, v) => onChange({ ...value, [key]: v });
  const text = (key, label, type = "text") => (
    <Field key={key} label={tr(key === "title" ? "propertyTitle" : key, label)}>
      <input
        required={!["phone"].includes(key)}
        type={type}
        value={value[key] ?? ""}
        min={type === "number" ? 1 : undefined}
        max={key === "rating" ? 5 : key === "guests" ? 50 : undefined}
        onChange={(e) =>
          set(key, type === "number" ? Number(e.target.value) : e.target.value)
        }
      />
    </Field>
  );
  const select = (key, label, values) => (
    <Field key={key} label={tr(key === "title" ? "propertyTitle" : key, label)}>
      <select value={value[key]} onChange={(e) => set(key, e.target.value)}>
        {values.map((v) => (
          <option key={v} value={v}>
            {tr(v, v)}
          </option>
        ))}
      </select>
    </Field>
  );
  const ref = (key, label, target, role, eligible) => (
    <Field label={tr(key === "title" ? "propertyTitle" : key, label)}>
      <ReferenceSelect
        dataset={dataset}
        entity={target}
        value={value[key]}
        onChange={(v) => set(key, v)}
        role={role}
        eligible={eligible}
      />
    </Field>
  );
  return (
    <div className="seed-form-grid">
      {entity === "users" && (
        <>
          {text("name", "Name")}
          {text("email", "Example email", "email")}
          {text("phone", "Phone")}
          {select("role", "Role", ["guest", "owner"])}
          {select("languagePref", "Language", ["en", "ur", "ar"])}
          <Field label={tr("isVerified", "Verified")}>
            <input
              type="checkbox"
              checked={value.isVerified}
              onChange={(e) => set("isVerified", e.target.checked)}
            />
          </Field>
        </>
      )}
      {entity === "properties" && (
        <>
          {text("title", "Title")}
          {text("price", "Nightly price (PKR)", "number")}
          {ref("owner", "Owner", "users", "owner")}
          {select("status", "Status", ["pending", "approved", "rejected"])}
          <Field label={tr("description", "Description")}>
            <textarea
              required
              value={value.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </Field>
          {["address", "city", "country"].map((k) => (
            <Field key={k} label={tr(k, k)}>
              <input
                required
                value={value.location?.[k] || ""}
                onChange={(e) =>
                  set("location", { ...value.location, [k]: e.target.value })
                }
              />
            </Field>
          ))}
          <fieldset className="seed-span">
            <legend>{tr("images", "Images")}</legend>
            {value.images.map((image, i) => (
              <div className="seed-inline" key={i}>
                <Field label={tr("imageUrl", "Image URL")}>
                  <input
                    required
                    value={image.url}
                    onChange={(e) =>
                      set(
                        "images",
                        value.images.map((x, j) => {
                          if (j !== i) return x;
                          const next = { ...x, url: e.target.value };
                          if (next.url !== x.url) {
                            delete next.caption;
                            delete next.credit;
                          }
                          return next;
                        }),
                      )
                    }
                  />
                </Field>
                <Field label={tr("verification", "Fixture verification")}>
                  <select
                    value={image.verificationStatus}
                    onChange={(e) =>
                      set(
                        "images",
                        value.images.map((x, j) =>
                          j === i
                            ? {
                                ...x,
                                verificationStatus: e.target.value,
                                aiScore: 0,
                              }
                            : x,
                        ),
                      )
                    }
                  >
                    {["pending", "verified", "suspicious", "rejected"].map(
                      (x) => (
                        <option key={x} value={x}>
                          {tr(x, x)}
                        </option>
                      ),
                    )}
                  </select>
                </Field>
                <button
                  type="button"
                  onClick={() =>
                    set(
                      "images",
                      value.images.filter((_, j) => j !== i),
                    )
                  }
                >
                  {tr("remove", "Remove")}
                </button>
              </div>
            ))}
            <button
              type="button"
              disabled={value.images.length >= 5}
              onClick={() =>
                set("images", [
                  ...value.images,
                  {
                    url: "/seed/property.svg",
                    verificationStatus: "pending",
                    aiScore: 0,
                  },
                ])
              }
            >
              {tr("addImage", "Add image")}
            </button>
          </fieldset>
          <fieldset className="seed-span">
            <legend>{tr("availability", "Availability")}</legend>
            {value.availabilityCalendar.map((r, i) => (
              <div className="seed-inline" key={i}>
                {["startDate", "endDate"].map((k) => (
                  <Field key={k} label={tr(k, k)}>
                    <input
                      required
                      type="date"
                      value={r[k]}
                      onChange={(e) =>
                        set(
                          "availabilityCalendar",
                          value.availabilityCalendar.map((x, j) =>
                            j === i ? { ...x, [k]: e.target.value } : x,
                          ),
                        )
                      }
                    />
                  </Field>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    set(
                      "availabilityCalendar",
                      value.availabilityCalendar.filter((_, j) => j !== i),
                    )
                  }
                >
                  {tr("remove", "Remove")}
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                set("availabilityCalendar", [
                  ...value.availabilityCalendar,
                  { startDate: "", endDate: "" },
                ])
              }
            >
              {tr("addDates", "Add dates")}
            </button>
          </fieldset>
        </>
      )}
      {entity === "bookings" && (
        <>
          {ref("guest", "Guest", "users", "guest")}
          {ref("property", "Property", "properties")}
          {text("startDate", "Start date", "date")}
          {text("endDate", "End date", "date")}
          {text("guests", "Guests", "number")}
          {value.rate != null && text("rate", "Booked nightly rate", "number")}
          {select("status", "Status", ["pending", "confirmed", "cancelled"])}
          {select("paymentStatus", "Demo payment", [
            "pending",
            "confirmed",
            "failed",
          ])}
          <p className="seed-span seed-muted">
            {tr(
              "calculated",
              "The total is calculated from the booked nightly rate and number of nights.",
            )}
          </p>
        </>
      )}
      {entity === "reviews" && (
        <>
          {ref("booking", "Booking", "bookings", undefined, true)}
          {text("rating", "Rating", "number")}
          {select("sentiment", "Synthetic sentiment", [
            "positive",
            "negative",
            "neutral",
            "mixed",
          ])}
          <Field label={tr("text", "Review text")}>
            <textarea
              required
              maxLength={1000}
              value={value.text}
              onChange={(e) => set("text", e.target.value)}
            />
          </Field>
          <p className="seed-span seed-muted">
            {tr(
              "synthetic",
              "These are demo fixtures. Synthetic sentiment and image labels are not model predictions.",
            )}
          </p>
        </>
      )}
    </div>
  );
}
function CatalogCities({ value, onChange }) {
  const [result, setResult] = useState(null);
  const [search, setSearch] = useState("");
  const [retry, setRetry] = useState(0);
  const source = value.propertySource, digest = value.catalogDigest;
  const key = `${source}:${digest || ""}`;
  useEffect(() => {
    const controller = new AbortController();
    api.get("/admin/seed/catalog", { params: { source, ...(digest && { digest }) }, signal: controller.signal })
      .then(r => { if (!controller.signal.aborted) setResult({ key: `${source}:${digest || ""}`, data: r.data }); })
      .catch(e => { if (!controller.signal.aborted) setResult({ key: `${source}:${digest || ""}`, error: e.response?.data?.message || "Could not load catalog cities." }); });
    return () => controller.abort();
  }, [source, digest, retry]);
  const summary = result?.key === key ? result : null;
  const folded = text => text.normalize("NFKD").replace(/\p{M}/gu, "").toLocaleLowerCase();
  const all = summary?.data?.cities || [];
  const selected = new Set(value.cities);
  const available = all.filter(c => selected.has(c.city)).reduce((n, c) => n + c.properties, 0);
  const apply = next => {
    const count = all.filter(c => next.includes(c.city)).reduce((n, c) => n + c.properties, 0);
    onChange({ ...value, cities: next, properties: count ? Math.min(value.properties || count, count) : 0 });
  };
  return <fieldset className="seed-span seed-city-picker">
    <legend>Catalog cities</legend>
    {!summary && <p role="status">Checking city availability…</p>}
    {summary?.error && <><p role="alert">{summary.error}</p><button type="button" onClick={() => setRetry(n => n + 1)}>Retry city lookup</button></>}
    {summary?.data && <>
      <Field label="Search catalog cities"><input type="search" value={search} onChange={e => setSearch(e.target.value)} /></Field>
      <div className="seed-actions">
        <button type="button" onClick={() => apply(all.map(c => c.city))}>Select all cities</button>
        <button type="button" onClick={() => apply([])}>Clear cities</button>
        <button type="button" disabled={!available} onClick={() => onChange({ ...value, properties: available })}>Use all {available} properties</button>
      </div>
      <p role="status">{value.cities.length} {value.cities.length === 1 ? "city" : "cities"} selected · {available} properties available · {value.properties} requested</p>
      {!value.cities.length && <p role="alert">Select at least one city before continuing.</p>}
      {value.properties > available && <p role="alert">Reduce the property count to {available} or select more cities.</p>}
      <div className="seed-city-options">
        {all.filter(c => folded(c.city).includes(folded(search))).map(c => <label key={c.city}>
          <input type="checkbox" checked={selected.has(c.city)} onChange={e => apply(e.target.checked ? [...value.cities, c.city] : value.cities.filter(city => city !== c.city))} />
          <span>{c.city} ({c.properties} {c.properties === 1 ? "property" : "properties"})</span>
        </label>)}
      </div>
      {!all.some(c => folded(c.city).includes(folded(search))) && <p>No matching cities.</p>}
      <p className="seed-muted">City counts use the exact catalog saved in this recipe. Narrowing cities reduces the requested count when necessary.</p>
    </>}
  </fieldset>;
}

export function GenerationFields({ value, onChange, presets = {} }) {
  const { t } = useTranslation();
  const tr = (k, s) => t(`seed.${k}`, s);
  const set = (k, v) => onChange({ ...value, [k]: v });
  return (
    <div className="seed-form-grid">
      <Field label="Property data source">
        <select value={value.propertySource || "synthetic"}
          onChange={(e) => {
            const source = e.target.value;
            const recipe = source === "pakistan_v1" ? presets.pakistan : source === "pakistan_collected_v1" ? presets.pakistanCollected : presets.small;
            if (recipe) onChange({ ...recipe, propertySource: source, referenceDate: value.referenceDate });
          }}>
          <option value="synthetic">Generated demo properties</option>
          <option value="pakistan_v1">Real Pakistani property catalog</option>
          {(presets.pakistanCollected || value.propertySource === "pakistan_collected_v1") && <option value="pakistan_collected_v1">Collected Pakistani properties</option>}
        </select>
      </Field>
      <p className="seed-span seed-muted">Changing the property source loads its preset counts and cities. Review them before continuing.</p>
      {value.propertySource === "pakistan_collected_v1" && <p className="seed-span seed-muted">
        Real property names, locations and 2 to 5 matching photos from source galleries.
        Photos load from their external sources. Prices, owners, bookings and reviews are demo data.
      </p>}
      {value.propertySource === "pakistan_v1" && <p className="seed-span seed-muted">
        Six real properties with 2 to 5 credited photos each. Cities: Bhurban, Lahore,
        Islamabad, Gilgit, Shigar and Khaplu. Choose up to one property per selected city.
        Prices, availability, owners, bookings and reviews are generated demo data.
      </p>}
      {[
        ["owners", "Owners"],
        ["guests", "Guests"],
        ["properties", "Properties"],
        ["reviews", "Reviews"],
        ["minPrice", "Minimum price (PKR)"],
        ["maxPrice", "Maximum price (PKR)"],
        ["approvedPercent", "Approved properties (%)"],
        ["positivePercent", "Positive reviews (%)"],
        ["negativePercent", "Negative reviews (%)"],
        ["neutralPercent", "Neutral reviews (%)"],
        ["seed", "Random seed"],
      ].map(([k, label]) => (
        <Field key={k} label={tr(k, label)}>
          <input
            type="number"
            min="0"
            required
            value={value[k]}
            onChange={(e) => set(k, Number(e.target.value))}
          />
        </Field>
      ))}
      <Field label={tr("referenceDate", "Reference date")}>
        <input
          required
          type="date"
          value={value.referenceDate}
          onChange={(e) => set("referenceDate", e.target.value)}
        />
      </Field>
      {["pakistan_v1", "pakistan_collected_v1"].includes(value.propertySource) ? <CatalogCities value={value} onChange={onChange} /> : <Field label={tr("cities", "Cities, separated by commas")}>
        <input
          required
          value={value.cities.join(", ")}
          onChange={(e) =>
            set(
              "cities",
              e.target.value.split(",").map((x) => x.trim()),
            )
          }
        />
      </Field>}
      <p className="seed-muted">
        {tr(
          "bookingHint",
          "Each review includes a matching historical booking. Remaining sentiment percentage is mixed.",
        )}
      </p>
    </div>
  );
}

export function PresetPicker({ presets, descriptions, onSelect }) {
  const [expanded, setExpanded] = useState(true);
  const [search, setSearch] = useState("");
  const toggle = useRef(null);
  const id = useId();
  const options = Object.entries(presets || {}).filter(([key]) => `${key} ${descriptions?.[key] || ""}`.toLowerCase().includes(search.trim().toLowerCase()));
  return (
    <fieldset>
      <legend>Ready made data</legend>
      <button ref={toggle} type="button" aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded(!expanded)}>{expanded ? "Hide presets" : "Change preset"}</button>
      {!expanded && <p role="status">Preset settings loaded. Review the counts and property source below.</p>}
      <div id={id} hidden={!expanded}>
        <p>Choose a scenario. Names, emails, dates and relationships are filled automatically.
        Review sample records in the generation preview.</p>
      <Field label="Find a data preset"><input type="search" value={search} onChange={e => setSearch(e.target.value)} /></Field>
      <div className="seed-preset-grid">
        {options.map(([key, recipe]) => (
          <button type="button" key={key} onClick={() => { setExpanded(false); onSelect(recipe, key); toggle.current?.focus(); }}>
            <strong>{descriptions?.[key] || key}</strong>
            <span>{recipe.owners} owners · {recipe.guests} guests · {recipe.properties} properties</span>
            <span>{recipe.reviews} bookings · {recipe.reviews} reviews</span>
            {["pakistan_v1", "pakistan_collected_v1"].includes(recipe.propertySource) && <span>Real names, locations and 2 to 5 credited photos per property. Demo prices and reviews.</span>}
          </button>
        ))}
      </div>
      {!options.length && <p>No matching presets. Try a different search.</p>}
      <p>Review scenarios include the users, properties and historical bookings they need.
        Generated users are guests or owners.</p>
      </div>
    </fieldset>
  );
}
