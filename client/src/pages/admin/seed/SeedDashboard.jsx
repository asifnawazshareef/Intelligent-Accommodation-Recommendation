import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/context/AuthContext";
import DashboardLayout from "@/components/layout/DashboardLayout";
import api from "@/services/api";
import { SeedSteps, RecipeSummary, SeedQuickStart, SeedJobSummary, PropertyThumbnail, SeedExamples, SeedRecordDetails } from "./SeedOverview";
import {
  Field,
  Modal,
  RecordFields,
  GenerationFields,
  PresetPicker,
  ReferenceSelect,
} from "./SeedForms";
import { defaults, editable } from "./seedFormData";
import "./seed.css";
const base = "/admin/seed";
const entities = ["users", "properties", "bookings", "reviews"];
const initialRecipe = {
  owners: 3,
  guests: 12,
  properties: 20,
  reviews: 60,
  seed: 42,
  referenceDate: new Date().toISOString().slice(0, 10),
  cities: ["Islamabad", "Lahore", "Karachi", "Murree"],
  minPrice: 4000,
  maxPrice: 45000,
  approvedPercent: 90,
  positivePercent: 55,
  negativePercent: 15,
  neutralPercent: 15,
};
const bulkFields = {
  users: ["isVerified", "languagePref", "role"],
  properties: ["price", "owner", "status", "location"],
  bookings: ["status", "paymentStatus", "startDate", "endDate", "guests"],
  reviews: ["rating", "sentiment"],
};
const regenerateFields = {
  users: ["name", "phone"],
  properties: ["title", "description", "price"],
  bookings: ["guests"],
  reviews: ["text", "rating", "sentiment"],
};
const labels = {
  users: "Users",
  properties: "Properties",
  bookings: "Bookings",
  reviews: "Reviews",
};
export default function SeedDashboard() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const tr = (k, fallback) => t(`seed.${k}`, fallback);
  const [cap, setCap] = useState(null),
    [datasets, setDatasets] = useState([]),
    [ds, setDs] = useState(""),
    [entity, setEntity] = useState("users"),
    [loadedRows, setRows] = useState([]),
    [rowsKey, setRowsKey] = useState(""),
    [total, setTotal] = useState(0),
    [page, setPage] = useState(1),
    [filters, setFilters] = useState({}),
    [selected, setSelected] = useState([]),
    [all, setAll] = useState(false),
    [jobs, setJobs] = useState([]),
    [history, setHistory] = useState([]),
    [view, setView] = useState("records"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [modal, setModal] = useState(null),
    [draft, setDraft] = useState({}),
    [preview, setPreview] = useState(null),
    [rowVersion, setRowVersion] = useState(0),
    [sentimentStatus, setSentimentStatus] = useState(null),
    [confirmName, setConfirmName] = useState("");
  const active = datasets.find((x) => x._id === ds);
  const activeTotal = Object.values(active?.counts || {}).reduce((n, count) => n + count, 0);
  const rows = rowsKey === `${ds}:${entity}` ? loadedRows : [];
  const datasetJobs = jobs.filter(j => String(j.dataset) === ds);
  const running = datasetJobs.some((j) =>
    ["queued", "running", "cancel_requested"].includes(j.state),
  );
  const initialDatasetSelected = useRef(false);
  const refreshSequence = useRef(0);
  const refresh = useCallback(async () => {
    const sequence = ++refreshSequence.current;
    const [d, j] = await Promise.all([
      api.get(`${base}/datasets`),
      api.get(`${base}/jobs`, { params: ds ? { dataset: ds } : {} }),
    ]);
    if (sequence !== refreshSequence.current) return;
    setDatasets(d.data);
    setJobs(j.data);
    if (!initialDatasetSelected.current) {
      initialDatasetSelected.current = true;
      if (d.data.length) setDs(current => current || (d.data.find(dataset =>
        Object.values(dataset.counts || {}).some(count => count > 0)) || d.data[0])._id);
    }
  }, [ds]);
  const loadSequence = useRef(0);
  const loadRows = useCallback(async () => {
    const sequence = ++loadSequence.current;
    if (!ds) { setRows([]); setTotal(0); setLoading(false); return; }
    setLoading(true);
    try {
      const r = await api.get(`${base}/datasets/${ds}/${entity}`, {
        params: { ...filters, page, pageSize: 25 },
      });
      if (sequence !== loadSequence.current) return;
      setRows(r.data.records);
      setRowsKey(`${ds}:${entity}`);
      setTotal(r.data.total);
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  }, [ds, entity, filters, page]);
  useEffect(() => {
    if (!user?.isSuperAdmin) return;
    api
      .get(`${base}/capabilities`)
      .then((r) => setCap(r.data))
      .catch((e) => setError(e.response?.data?.message || e.message));
  }, [user]);
  useEffect(() => {
    if (!user?.isSuperAdmin) return;
    let alive = true;
    const poll = () =>
      refresh().catch((e) => {
        if (alive) setError(e.response?.data?.message || e.message);
      });
    poll();
    const timer = setInterval(poll, 3000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [refresh, user]);
  const completedJobs = datasetJobs.filter((j) => j.state === "completed").length;
  const analysisCheckpoint = datasetJobs.filter(j => j.kind === "analyze_reviews").map(j => `${j._id}:${j.cursor}:${j.state}`).join(",");
  const sentimentSequence = useRef(0);
  const loadSentiment = useCallback(async () => {
    const sequence = ++sentimentSequence.current;
    try {
      const result = await api.get(ds ? `${base}/datasets/${ds}/sentiment` : `${base}/sentiment`);
      if (sequence === sentimentSequence.current) setSentimentStatus({ dataset: ds, ...result.data });
    } catch (error) {
      if (sequence === sentimentSequence.current) setSentimentStatus({ dataset: ds, service: { available: false } });
      throw error;
    }
  }, [ds]);
  const sentiment = sentimentStatus?.dataset === ds ? sentimentStatus : null;
  useEffect(() => {
    if (user?.isSuperAdmin) loadSentiment().catch(() => {});
  }, [loadSentiment, completedJobs, analysisCheckpoint, rowVersion, user, ds]);
  useEffect(() => {
    loadRows().catch((e) => setError(e.response?.data?.message || e.message));
  }, [loadRows, completedJobs, rowVersion]);
  useEffect(() => {
    setSelected([]);
    setAll(false);
  }, [ds, entity, filters]);
  useEffect(() => {
    if (view === "history" && ds)
      api
        .get(`${base}/datasets/${ds}/history`)
        .then((r) => setHistory(r.data))
        .catch((e) => setError(e.message));
  }, [view, ds, jobs]);
  const run = async (fn) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      await refresh();
      setRowVersion(v => v + 1);
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    } finally {
      setBusy(false);
    }
  };
  const close = () => {
    if (busy) return;
    setModal(null);
    setPreview(null);
    setConfirmName("");
  };
  const open = (type, data = {}) => {
    setError("");
    setPreview(null);
    setConfirmName("");
    setModal({ type, requestKey: crypto.randomUUID(), ...data });
  };
  const startDataset = (presetKey) => {
    const key = presetKey || "small";
    setDraft({ name: cap?.presetDescriptions?.[key] || "FYP demo",
      namespace: `demo_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`,
      recipe: { ...(cap?.presets?.[key] || initialRecipe), referenceDate: new Date().toISOString().slice(0, 10) } });
    open("dataset", { presetKey });
  };
  const showRecords = (nextEntity = entity) => {
    setEntity(nextEntity); setView("records"); setPage(1); setFilters({});
  };
  const reviewSaved = () => {
    setDraft({ ...active.recipe });
    open("generate", { kind: "generate" });
    run(async () => setPreview((await api.post(`${base}/datasets/${active._id}/preview`, { kind: "generate", recipe: active.recipe })).data));
  };
  const selection = () => (all ? { all: true, filters } : { ids: selected });
  const setFilter = (key, value) => {
    setPage(1);
    setFilters((old) => {
      const next = { ...old };
      if (value) next[key] = value;
      else delete next[key];
      return next;
    });
  };
  const openRecord = (type, row) => {
    setDraft(row ? editable(entity, row) : defaults[entity]());
    open(type, { row });
  };
  const submitRecord = () =>
    run(async () => {
      if (modal.type === "edit")
        await api.patch(`${base}/datasets/${ds}/${entity}/${modal.row._id}`, {
          patch: draft,
          revision: modal.row.seedRevision,
        });
      else await api.post(`${base}/datasets/${ds}/${entity}`, draft);
      setModal(null);
    });
  const bulkPreview = () =>
    run(async () => {
      let body = {
        entity,
        action: draft.action,
        selection: modal.selection || selection(),
        cascade: draft.cascade,
      };
      if (modal.datasetDelete)
        body = {
          entity: "all",
          action: "delete",
          selection: { all: true },
          cascade: true,
        };
      if (draft.action === "update") {
        let value = draft.value;
        if (["price", "rating", "guests"].includes(draft.field))
          value = Number(value);
        if (draft.field === "isVerified") value = value === "true";
        body.patch =
          draft.field === "location"
            ? { location: draft.location }
            : { [draft.field]: value };
        if (draft.field === "pricePercent") {
          body.patch = {};
          body.pricePercent = Number(value);
        }
      }
      if (draft.action === "create") body.records = draft.records;
      if (draft.action === "regenerate")
        body.fields = draft.fields || regenerateFields[entity];
      setPreview(
        (await api.post(`${base}/datasets/${ds}/bulk/preview`, body)).data,
      );
    });
  const execute = () =>
    run(async () => {
      await api.post(`${base}/datasets/${ds}/bulk/execute`, {
        planId: preview._id,
        confirmName,
      });
      setModal(null);
      setPreview(null);
      setSelected([]);
      setAll(false);
    });
  const download = (format) =>
    run(async () => {
      const body = {
        entity: format === "dataset" ? "all" : entity,
        format: format === "dataset" ? "json" : format,
        filters,
        ...(!all && selected.length ? { ids: selected } : {}),
      };
      const r = await api.post(`${base}/datasets/${ds}/export`, body, {
        responseType: "blob",
      });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `seed_${body.entity}.${body.format}`;
      a.click();
      URL.revokeObjectURL(url);
    });
  if (!user?.isSuperAdmin || user.role !== "admin")
    return <Navigate to="/admin/dashboard" replace />;
  return (
    <DashboardLayout>
      <div className="seed">
        <div className="seed-toolbar">
          <div>
            <span className="seed-badge">
              {tr("superAdmin", "Super admin")}
            </span>
            <h1>{tr("title", "Seed Data")}</h1>
            <p className="seed-muted">
              {tr(
                "subtitle",
                "Create realistic demo data and manage each dataset in one place.",
              )}
            </p>
          </div>
          <button
            className="seed-primary"
            disabled={busy || !cap?.transactions}
            onClick={() => startDataset()}
          >
            {tr("newDataset", "New dataset")}
          </button>
        </div>
        {error && (
          <div className="seed-error" role="alert">
            {error}
          </div>
        )}
        {!cap && !error && <p role="status">Loading seed options…</p>}
        <section className="seed-card" aria-label="Sentiment model">
          <div className="seed-section-heading"><div><h2>Sentiment model</h2>
            <p>{!sentiment ? "Checking model connection…" : sentiment.service.available ? "Connected to your Python model" : "Model is offline or unreachable"}</p>
          </div><button type="button" disabled={busy} onClick={() => loadSentiment().catch(e => setError(e.response?.data?.message || e.message))}>Refresh model status</button></div>
          {sentiment?.service.available ? <p className="seed-muted">{sentiment.service.model}</p> : <p className="seed-muted">Start <code>npm.cmd run dev:seed</code> from the project root. Then refresh this status.</p>}
          {sentiment?.worker && <p className="seed-muted">{sentiment.worker.available ? "Seed worker connected" : <>Seed worker is not running. Start <code>npm.cmd run dev:seed</code> to process reviews.</>}</p>}
          {active && sentiment && <>
            <p>{sentiment.analyzed || 0} of {sentiment.total || 0} reviews analyzed · {sentiment.pending || 0} awaiting model predictions</p>
            <button type="button" className="seed-primary" disabled={busy || running || !sentiment.service.available || !sentiment.pending} onClick={() => run(async () => {
              await api.post(`${base}/datasets/${ds}/jobs`, { kind: "analyze_reviews", requestKey: crypto.randomUUID() }); setView("jobs");
            })}>Analyze all pending reviews</button>
          </>}
        </section>
        {cap && !cap.transactions && (
          <div className="seed-notice">
            {tr(
              "replicaNeeded",
              "Enable a MongoDB replica set to generate or change seed data. See the setup guide.",
            )}
          </div>
        )}
        {cap?.setup && <details className="seed-card">
          <summary>Setup checks: {cap.setup.ready ? "ready" : "needs attention"}</summary>
          <ul>{cap.setup.checks.map(check => <li key={check.code}>
            <strong>{check.ok ? "Passed" : "Needs attention"}: {{
              environment: "Demonstration environment", enabled: "Seed dashboard enabled",
              connection: "Database connection", database: "Permitted database", transactions: "MongoDB transactions",
              demoPassword: "Demo account password", batchSize: "Worker batch size", superAdmin: "Super admin account",
            }[check.code] || check.code}</strong>
            {!check.ok && <p>{check.message}</p>}
          </li>)}</ul>
          <p>{cap.setup.worker}</p>
          <p>For setup problems, run <code>npm.cmd run seed:check</code> in the server folder.</p>
        </details>}
        <div className="seed-toolbar">
          <Field label={tr("dataset", "Dataset")}>
            <select
              value={ds}
              onChange={(e) => {
                setDs(e.target.value);
                setPage(1);
                setFilters({});
              }}
            >
              <option value="">
                {tr("chooseDataset", "Choose a dataset")}
              </option>
              {datasets.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name} · {Object.values(d.counts || {}).reduce((n, count) => n + count, 0).toLocaleString()} records · {d.namespace}
                </option>
              ))}
            </select>
          </Field>
          <span className="seed-muted">{cap?.environment}</span>
        </div>
        {!active && <>
          <SeedSteps />
          <SeedQuickStart presets={cap?.presets} catalog={cap?.collectedCatalog} onChoose={startDataset} disabled={busy || !cap?.transactions} />
          {datasets.length > 0 && <section className="seed-card" aria-label="Your datasets">
            <h2>Your datasets</h2><p className="seed-muted">Open a dataset to view and manage its records.</p>
            <div className="seed-dataset-grid">{datasets.slice(0, 6).map(d => <button type="button" key={d._id} onClick={() => { setDs(d._id); showRecords(); }}>
              <strong>{d.name}</strong><span>{Object.values(d.counts || {}).reduce((n, count) => n + count, 0).toLocaleString()} records · {d.namespace}</span>
              <small>{d.counts?.properties || 0} properties · {d.counts?.users || 0} users</small>
            </button>)}</div>
          </section>}
        </>}
        {active && (
          <>
            <div className="seed-section-heading seed-dataset-heading"><div><span className="seed-eyebrow">Selected dataset</span><h2>{active.name}</h2></div><span className="seed-badge">{Object.values(active.counts || {}).reduce((n, count) => n + count, 0).toLocaleString()} records</span></div>
            <div className="seed-stats" aria-label="View records by type">
              {entities.map(e => <button type="button" className={`seed-stat ${view === "records" && entity === e ? "is-selected" : ""}`} key={e} onClick={() => showRecords(e)} aria-pressed={view === "records" && entity === e}>
                <strong>{(active.counts?.[e] || 0).toLocaleString()}</strong><span>{tr(e, labels[e])}</span><small>View {labels[e].toLowerCase()} →</small>
              </button>)}
            </div>
            <SeedJobSummary job={datasetJobs[0]} onJobs={() => setView("jobs")} onRecords={() => showRecords(active.counts?.properties ? "properties" : "users")} />
            <div className="seed-toolbar">
              <div className="seed-inline">
                <button className={activeTotal ? "" : "seed-primary"} disabled={running || busy || !cap?.transactions} onClick={reviewSaved}>{tr("generate", "Generate data")}</button>
                <button className={activeTotal ? "seed-primary" : ""} disabled={running || busy || !cap?.transactions} onClick={() => { setDraft({ ...(cap?.presets?.small || initialRecipe), referenceDate: new Date().toISOString().slice(0, 10) }); open("generate", { kind: "append" }); }}>{tr("append", "Add more data")}</button>
              </div>
              <details className="seed-more-actions"><summary>More dataset actions</summary><div className="seed-inline">
                <button disabled={running || busy} onClick={() => run(() => api.post(`${base}/datasets/${ds}/jobs`, { kind: "validate", requestKey: crypto.randomUUID() }))}>{tr("validate", "Validate")}</button>
                <button disabled={running || busy} onClick={() => run(() => api.post(`${base}/datasets/${ds}/jobs`, { kind: "recalculate", requestKey: crypto.randomUUID() }))}>{tr("recalculate", "Recalculate summaries")}</button>
                <button className="seed-danger" disabled={running || busy} onClick={() => { setDraft({ action: "delete", cascade: true }); open("bulk", { datasetDelete: true }); }}>{tr("deleteDataset", "Delete dataset records")}</button>
              </div></details>
            </div>
            <div className="seed-tabs">
              {["records", "jobs", "history"].map((v) => (
                <button
                  aria-pressed={view === v}
                  className={view === v ? "seed-primary" : ""}
                  key={v}
                  onClick={() => setView(v)}
                >
                  {tr(v, v)}
                </button>
              ))}
            </div>
            {view === "records" && (
              <>
                <div className="seed-tabs">
                  {entities.map((e) => (
                    <button
                      aria-pressed={entity === e}
                      className={entity === e ? "seed-primary" : ""}
                      key={e}
                      onClick={() => {
                        setEntity(e);
                        setPage(1);
                        setFilters({});
                      }}
                    >
                      {tr(e, labels[e])}
                    </button>
                  ))}
                </div>
                <div className="seed-toolbar">
                  <div className="seed-inline">
                    <input
                      aria-label={tr("search", "Search")}
                      placeholder={tr("search", "Search")}
                      value={filters.q || ""}
                      onChange={(e) => setFilter("q", e.target.value)}
                    />
                    {entity === "users" && (
                      <select
                        aria-label="Role"
                        value={filters.role || ""}
                        onChange={(e) => setFilter("role", e.target.value)}
                      >
                        <option value="">{tr("allRoles", "All roles")}</option>
                        <option value="guest">{tr("guest", "Guest")}</option>
                        <option value="owner">{tr("owner", "Owner")}</option>
                      </select>
                    )}
                    {["properties", "bookings"].includes(entity) && (
                      <select
                        aria-label="Status"
                        value={filters.status || ""}
                        onChange={(e) => setFilter("status", e.target.value)}
                      >
                        <option value="">
                          {tr("allStatuses", "All statuses")}
                        </option>
                        {(entity === "properties"
                          ? ["pending", "approved", "rejected"]
                          : ["pending", "confirmed", "cancelled"]
                        ).map((s) => (
                          <option key={s} value={s}>
                            {tr(s, s)}
                          </option>
                        ))}
                      </select>
                    )}
                    {entity === "properties" && (
                      <input
                        aria-label="City"
                        placeholder={tr("city", "City")}
                        value={filters.city || ""}
                        onChange={(e) => setFilter("city", e.target.value)}
                      />
                    )}{" "}
                    {entity === "reviews" && (
                      <>
                        <select
                          aria-label="Sentiment"
                          value={filters.sentiment || ""}
                          onChange={(e) =>
                            setFilter("sentiment", e.target.value)
                          }
                        >
                          <option value="">
                            {tr("allSentiments", "All sentiments")}
                          </option>
                          {["positive", "negative", "neutral", "mixed"].map(
                            (s) => (
                              <option key={s} value={s}>
                                {tr(s, s)}
                              </option>
                            ),
                          )}
                        </select>
                        <select
                          aria-label="Rating"
                          value={filters.rating || ""}
                          onChange={(e) => setFilter("rating", e.target.value)}
                        >
                          <option value="">
                            {tr("allRatings", "All ratings")}
                          </option>
                          {[1, 2, 3, 4, 5].map((n) => (
                            <option key={n}>{n}</option>
                          ))}
                        </select>
                      </>
                    )}
                    <select
                      aria-label="Sort"
                      value={filters.sort || "newest"}
                      onChange={(e) => setFilter("sort", e.target.value)}
                    >
                      {[
                        "newest",
                        "oldest",
                        "name",
                        ...(entity === "properties" ? ["price"] : []),
                      ].map((s) => (
                        <option key={s} value={s}>
                          {tr(s, s)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    disabled={running || busy}
                    onClick={() => openRecord("create")}
                  >
                    {tr("create", "Create record")}
                  </button>
                </div>
                <details className="seed-tools" open={all || selected.length > 0}>
                  <summary>Filters, bulk actions and exports{(all || selected.length > 0) ? ` · ${all ? total : selected.length} selected` : ""}</summary>
                <div className="seed-inline">
                  <Field label={tr("from", "Created from")}>
                    <input
                      type="date"
                      value={filters.from || ""}
                      onChange={(e) => setFilter("from", e.target.value)}
                    />
                  </Field>
                  <Field label={tr("to", "Created until")}>
                    <input
                      type="date"
                      value={filters.to || ""}
                      onChange={(e) => setFilter("to", e.target.value)}
                    />
                  </Field>
                </div>
                <div className="seed-toolbar">
                  <div className="seed-inline">
                    <span>
                      {all ? total : selected.length}{" "}
                      {tr("selected", "selected")}
                    </span>
                    <button
                      onClick={() => {
                        setAll(true);
                        setSelected([]);
                      }}
                      disabled={!total}
                    >
                      {tr("selectAll", "Select all matching")}
                    </button>
                    <button
                      onClick={() => {
                        setAll(false);
                        setSelected([]);
                      }}
                    >
                      {tr("clear", "Clear")}
                    </button>
                    <button
                      disabled={running || busy || (!all && !selected.length)}
                      onClick={() => {
                        setDraft({
                          action: "update",
                          field: bulkFields[entity][0],
                          value: "",
                          cascade: false,
                        });
                        open("bulk");
                      }}
                    >
                      {tr("bulkActions", "Bulk actions")}
                    </button>
                    <button
                      disabled={running || busy}
                      onClick={() => {
                        setDraft({
                          action: "create",
                          records: [defaults[entity]()],
                        });
                        open("bulk");
                      }}
                    >
                      {tr("bulkCreate", "Create multiple")}
                    </button>
                  </div>
                  <div className="seed-inline">
                    <button disabled={busy} onClick={() => download("csv")}>
                      CSV
                    </button>
                    <button disabled={busy} onClick={() => download("json")}>
                      JSON
                    </button>
                    <button disabled={busy} onClick={() => download("dataset")}>
                      {tr("exportDataset", "Export dataset")}
                    </button>
                  </div>
                </div>
                </details>
                <p className="seed-muted seed-scroll-hint">
                  {tr(
                    "scrollTable",
                    "Swipe the table to see all columns and actions.",
                  )}
                </p>
                {rows.length > 0 ? (
                <div className="seed-table-wrap" aria-busy={loading}>
                  <table>
                    <thead>
                      <tr>
                        <th>
                          <input
                            type="checkbox"
                            aria-label="Select this page"
                            checked={
                              all ||
                              (rows.length > 0 &&
                                rows.every((r) => selected.includes(r._id)))
                            }
                            onChange={(e) => {
                              setAll(false);
                              setSelected(
                                e.target.checked
                                  ? [
                                      ...new Set([
                                        ...selected,
                                        ...rows.map((r) => r._id),
                                      ]),
                                    ]
                                  : selected.filter(
                                      (id) => !rows.some((r) => r._id === id),
                                    ),
                              );
                            }}
                          />
                        </th>
                        <th>{tr("record", "Record")}</th>
                        <th>{tr("details", "Details")}</th>
                        <th>{tr("status", "Status")}</th>
                        <th>{tr("actions", "Actions")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r._id}>
                          <td>
                            <input
                              type="checkbox"
                              aria-label={`Select ${r.name || r.title || r._id}`}
                              checked={all || selected.includes(r._id)}
                              onChange={(e) => {
                                setAll(false);
                                setSelected(
                                  e.target.checked
                                    ? [...selected, r._id]
                                    : selected.filter((id) => id !== r._id),
                                );
                              }}
                            />
                          </td>
                          <td>
                            <div className="seed-record-title">
                              {entity === "properties" && <PropertyThumbnail key={r.images?.[0]?.url || r._id} image={r.images?.[0]} title={r.title} />}
                              <span>{r.name || r.title || r.text?.slice(0, 100) || `${r.startDate} to ${r.endDate}`}</span>
                            </div>
                          </td>
                          <td>
                            {r.email ||
                              r.location?.city ||
                              `${r.rating || r.guests || ""} ${r.rating ? "★" : ""}`}
                            <small>
                              {r.price
                                ? `PKR ${r.price.toLocaleString()}`
                                : r.totalAmount
                                  ? `PKR ${r.totalAmount.toLocaleString()}`
                                  : r.seedOrigin}
                            </small>
                          </td>
                          <td>
                            <span className="seed-badge">
                              {tr(
                                r.role || r.status || r.sentiment,
                                r.role || r.status || r.sentiment,
                              )}
                            </span>
                          </td>
                          <td>
                            <div className="seed-inline">
                              <button
                                onClick={() =>
                                  run(async () =>
                                    open("detail", {
                                      row: (
                                        await api.get(
                                          `${base}/datasets/${ds}/${entity}/${r._id}`,
                                        )
                                      ).data,
                                    }),
                                  )
                                }
                              >
                                {tr("view", "View")}
                              </button>
                              <button
                                disabled={running || busy}
                                onClick={() => openRecord("edit", r)}
                              >
                                {tr("edit", "Edit")}
                              </button>
                              <button
                                disabled={running || busy}
                                onClick={() => {
                                  setDraft({
                                    action: "delete",
                                    cascade: false,
                                  });
                                  open("bulk", { selection: { ids: [r._id] } });
                                }}
                              >
                                {tr("delete", "Delete")}
                              </button>
                              {entity === "users" && (
                                <button
                                  disabled={running || busy}
                                  onClick={() => {
                                    setDraft({ password: "" });
                                    open("password", { row: r });
                                  }}
                                >
                                  {tr("password", "Password")}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}

                    </tbody>
                  </table>
                </div>
                ) : <div className="seed-card seed-empty" role="status" aria-busy={loading}>
                  {loading ? <p>Loading records…</p> : <>
                    <strong>{active.counts?.[entity] ? "No matching records" : `No ${labels[entity].toLowerCase()} yet`}</strong>
                    <p>{active.counts?.[entity] ? "Try a different search or clear the filters." : "Choose Generate data to fill this dataset, or Add more data to use a different recipe."}</p>
                    {Object.keys(filters).length > 0 && <button type="button" onClick={() => { setFilters({}); setPage(1); }}>Clear filters</button>}
                  </>}
                </div>}
                <div className="seed-toolbar">
                  <span>
                    {total} {tr("records", "records")} · {tr("page", "Page")}{" "}
                    {page}
                  </span>
                  <div className="seed-inline">
                    <button
                      disabled={page <= 1}
                      onClick={() => setPage(page - 1)}
                    >
                      {tr("previous", "Previous")}
                    </button>
                    <button
                      disabled={page * 25 >= total}
                      onClick={() => setPage(page + 1)}
                    >
                      {tr("next", "Next")}
                    </button>
                  </div>
                </div>
              </>
            )}
            {view === "jobs" && (
              <div className="seed-card" aria-live="polite">
                <p className="seed-muted">
                  {tr(
                    "workerHint",
                    "Jobs continue when you leave this page. Queued jobs need the seed worker to be running.",
                  )}
                </p>
                {datasetJobs.map((j) => (
                  <div className="seed-job" key={j._id}>
                    <div className="seed-job-title">
                      <strong>
                        {tr(j.kind, j.kind === "analyze_reviews" ? "Analyze reviews" : j.kind)} · {tr(j.state, j.state)}
                      </strong>
                      <span>
                        {j.cursor} / {j.total}
                      </span>
                    </div>
                    <progress max={j.total || 1} value={j.cursor} />
                    <small>
                      {j.succeeded} {tr("completed", "completed")}, {j.skipped}{" "}
                      {tr("skipped", "skipped")}
                    </small>
                    {j.error && <p className="seed-error">{j.error}</p>}
                    {j.report && (
                      <p>
                        {j.report.valid
                          ? tr("valid", "Validation passed")
                          : JSON.stringify(j.report.issues)}
                      </p>
                    )}
                    <div className="seed-inline">
                      <small>{new Date(j.createdAt).toLocaleString()}</small>
                      {["queued", "running"].includes(j.state) && (
                        <button
                          disabled={busy}
                          onClick={() =>
                            run(() => api.post(`${base}/jobs/${j._id}/cancel`))
                          }
                        >
                          {tr("cancel", "Cancel")}
                        </button>
                      )}
                      {["failed", "cancelled"].includes(j.state) && (
                        <button
                          disabled={busy || running}
                          onClick={() =>
                            run(() => api.post(`${base}/jobs/${j._id}/retry`))
                          }
                        >
                          {tr("retry", "Retry")}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {view === "history" && (
              <div className="seed-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{tr("time", "Time")}</th>
                      <th>{tr("action", "Action")}</th>
                      <th>{tr("record", "Record")}</th>
                      <th>{tr("actor", "Actor")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h) => (
                      <tr key={h._id}>
                        <td>{new Date(h.createdAt).toLocaleString()}</td>
                        <td>{h.action}</td>
                        <td>
                          {h.entity} {h.documentId}
                        </td>
                        <td>{h.actor}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
        {modal && (
          <Modal
            title={modal.type === "dataset" ? "Choose seed data" : modal.type === "generate" ? "Review and seed data" : tr(modal.type, { bulk: "Bulk action", detail: "Record details", password: "Reset demo password", edit: "Edit record", create: "Create record" }[modal.type])}
            onClose={close}
          >
            {error && (
              <p className="seed-error" role="alert">
                {error}
              </p>
            )}
            {modal.type === "dataset" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  run(async () => {
                    const r = await api.post(`${base}/datasets`, draft);
                    setDs(r.data._id);
                    setPage(1); setFilters({}); setView("records");
                    setEntity(r.data.recipe.properties ? "properties" : "users");
                    setDraft(r.data.recipe);
                    setModal({ type: "generate", kind: "generate", requestKey: crypto.randomUUID() });
                    const reviewed = await api.post(`${base}/datasets/${r.data._id}/preview`, { kind: "generate", recipe: r.data.recipe });
                    setPreview(reviewed.data);
                  });
                }}
              >
                <SeedSteps step={1} />
                <p className="seed-muted">Choose a preset, check the totals, then review examples. Records are generated only after you press Start generation.</p>
                <Field label={tr("name", "Name")}><input required maxLength={80} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></Field>
                {draft.recipe.propertySource === "pakistan_collected_v1" && cap.collectedCatalog?.available > 0 && <p className="seed-muted">
                  Collected catalog: {cap.collectedCatalog.available} of {cap.collectedCatalog.target} properties,
                  {" "}{cap.collectedCatalog.images} matching photos from {cap.collectedCatalog.sources.length} websites.
                </p>}
                <PresetPicker presets={cap.presets} descriptions={cap.presetDescriptions} initiallyExpanded={!modal.presetKey}
                  onSelect={(recipe, key) => setDraft({ ...draft,
                    name: cap.presetDescriptions?.[key] || key,
                    recipe: { ...recipe, referenceDate: new Date().toISOString().slice(0, 10) },
                  })} />
                <RecipeSummary recipe={draft.recipe} />
                <details>
                  <summary>Customize counts and settings (optional)</summary>
                <GenerationFields
                  presets={cap.presets}
                  value={draft.recipe}
                  onChange={(v) => setDraft({ ...draft, recipe: v })}
                />
                </details>
                <details className="seed-advanced"><summary>Advanced dataset identifier</summary>
                  <Field label={tr("namespace", "Unique dataset name")}><input required pattern="[a-z][a-z0-9_]{2,39}" value={draft.namespace} onChange={e => setDraft({ ...draft, namespace: e.target.value })} /></Field>
                  <p className="seed-muted">A unique identifier has already been generated for you.</p>
                </details>
                <div className="seed-actions seed-wizard-actions">
                  <button className="seed-primary" disabled={busy}>
                    Review seed data
                  </button>
                </div>
              </form>
            )}
            {modal.type === "generate" && (
              <>
                {modal.kind === "append" && (
                  <PresetPicker presets={cap.presets} descriptions={cap.presetDescriptions}
                    onSelect={(recipe) => {
                      setDraft({ ...recipe, referenceDate: new Date().toISOString().slice(0, 10) });
                      setPreview(null);
                    }} />
                )}
                <SeedSteps step={2} />
                <RecipeSummary recipe={draft} title={modal.kind === "append" ? "Records to add" : "Saved generation settings"} />
                {modal.kind === "append" && <details className="seed-advanced"><summary>Customize counts and settings (optional)</summary>
                  <GenerationFields presets={cap.presets} value={draft} onChange={v => { setDraft(v); setPreview(null); }} />
                </details>}
                {modal.kind === "generate" && <p className="seed-muted">These are the settings saved for this dataset. Add more data lets you choose a different recipe later.</p>}
                {draft.reviews > 0 && <label className="seed-analysis-choice">
                  <input type="checkbox" disabled={busy} checked={modal.analyzeReviews !== false} onChange={e => setModal({ ...modal, analyzeReviews: e.target.checked, requestKey: crypto.randomUUID() })} />
                  <span>Analyze reviews with my sentiment model after generation</span>
                </label>}
                {draft.reviews > 0 && <p className="seed-muted">The worker saves actual predictions, confidence and aspects. If the model is offline, analysis fails visibly and can be retried after starting it. Unchecked reviews keep fixture labels.</p>}
                {busy && !preview && <p role="status">Preparing your preview…</p>}
                {preview && <section className="seed-card seed-review" aria-label="Generation preview">
                  <strong>{preview.total} {tr("planned", "records planned")}</strong>
                  <p>Check these examples, then start generation. Your existing application records are preserved.</p>
                  <SeedExamples samples={preview.samples} />
                  <details className="seed-advanced"><summary>Technical preview details</summary><pre>{JSON.stringify({ counts: preview.counts, samples: preview.samples }, null, 2)}</pre></details>
                </section>}
                <div className="seed-actions seed-wizard-actions">
                  <button
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        setPreview(
                          (
                            await api.post(`${base}/datasets/${ds}/preview`, {
                              kind: modal.kind,
                              recipe: draft,
                            })
                          ).data,
                        );
                        setModal((current) => ({
                          ...current,
                          requestKey: crypto.randomUUID(),
                        }));
                      })
                    }
                  >
                    {tr("preview", "Preview")}
                  </button>
                  <button
                    className="seed-primary"
                    disabled={busy || !preview}
                    onClick={() =>
                      run(async () => {
                        await api.post(`${base}/datasets/${ds}/jobs`, {
                          kind: modal.kind,
                          recipe: preview.recipe,
                          confirmation: preview.confirmation,
                          requestKey: modal.requestKey,
                          analyzeReviews: modal.analyzeReviews !== false,
                        });
                        setModal(null);
                        setView("jobs");
                      })
                    }
                  >
                    {tr("start", "Start generation")}
                  </button>
                </div>
              </>
            )}
            {["create", "edit"].includes(modal.type) && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submitRecord();
                }}
              >
                <RecordFields
                  dataset={ds}
                  entity={entity}
                  value={draft}
                  onChange={setDraft}
                />
                <div className="seed-actions">
                  <button className="seed-primary" disabled={busy}>
                    {tr("save", "Save")}
                  </button>
                </div>
              </form>
            )}
            {modal.type === "detail" && (
              <SeedRecordDetails entity={entity} row={modal.row} />
            )}
            {modal.type === "password" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  run(async () => {
                    await api.post(
                      `${base}/datasets/${ds}/users/${modal.row._id}/password`,
                      {
                        password: draft.password,
                        revision: modal.row.seedRevision,
                      },
                    );
                    setModal(null);
                  });
                }}
              >
                <Field label={tr("newPassword", "New demo password")}>
                  <input
                    type="password"
                    autoComplete="new-password"
                    minLength={10}
                    maxLength={72}
                    required
                    value={draft.password}
                    onChange={(e) => setDraft({ password: e.target.value })}
                  />
                </Field>
                <div className="seed-actions">
                  <button className="seed-primary" disabled={busy}>
                    {tr("save", "Save")}
                  </button>
                </div>
              </form>
            )}
            {modal.type === "bulk" && (
              <>
                {!modal.datasetDelete && draft.action !== "create" && (
                  <Field label={tr("action", "Action")}>
                    <select
                      disabled={!!modal.selection}
                      value={draft.action}
                      onChange={(e) => {
                        setDraft({ ...draft, action: e.target.value });
                        setPreview(null);
                      }}
                    >
                      {[
                        "update",
                        "delete",
                        "regenerate",
                        ...(entity === "reviews" ? ["analyze"] : []),
                      ].map((a) => (
                        <option value={a} key={a}>
                          {tr(a, a)}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
                {draft.action === "update" && (
                  <div className="seed-form-grid">
                    <Field label={tr("field", "Field")}>
                      <select
                        value={draft.field}
                        onChange={(e) => {
                          setDraft({
                            ...draft,
                            field: e.target.value,
                            value: "",
                          });
                          setPreview(null);
                        }}
                      >
                        {[
                          ...bulkFields[entity],
                          ...(entity === "properties" ? ["pricePercent"] : []),
                        ].map((f) => (
                          <option value={f} key={f}>
                            {tr(f, f)}
                          </option>
                        ))}
                      </select>
                    </Field>
                    {draft.field === "owner" ? (
                      <Field label={tr("owner", "Owner")}>
                        <ReferenceSelect
                          dataset={ds}
                          entity="users"
                          role="owner"
                          value={draft.value}
                          onChange={(v) => {
                            setDraft({ ...draft, value: v });
                            setPreview(null);
                          }}
                        />
                      </Field>
                    ) : draft.field === "location" ? (
                      ["address", "city", "country"].map((k) => (
                        <Field key={k} label={tr(k, k)}>
                          <input
                            value={draft.location?.[k] || ""}
                            onChange={(e) => {
                              setDraft({
                                ...draft,
                                location: {
                                  ...draft.location,
                                  [k]: e.target.value,
                                },
                              });
                              setPreview(null);
                            }}
                          />
                        </Field>
                      ))
                    ) : (
                      <Field label={tr("value", "New value")}>
                        {[
                          "isVerified",
                          "role",
                          "status",
                          "sentiment",
                          "paymentStatus",
                          "languagePref",
                        ].includes(draft.field) ? (
                          <select
                            value={draft.value}
                            onChange={(e) => {
                              setDraft({ ...draft, value: e.target.value });
                              setPreview(null);
                            }}
                          >
                            <option value="">{tr("choose", "Choose")}</option>
                            {(draft.field === "isVerified"
                              ? ["true", "false"]
                              : draft.field === "role"
                                ? ["guest", "owner"]
                                : draft.field === "status"
                                  ? entity === "properties"
                                    ? ["pending", "approved", "rejected"]
                                    : ["pending", "confirmed", "cancelled"]
                                  : draft.field === "sentiment"
                                    ? [
                                        "positive",
                                        "negative",
                                        "neutral",
                                        "mixed",
                                      ]
                                    : draft.field === "paymentStatus"
                                      ? ["pending", "confirmed", "failed"]
                                      : ["en", "ur", "ar"]
                            ).map((v) => (
                              <option key={v} value={v}>
                                {tr(v, v)}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type={
                              draft.field.includes("Date")
                                ? "date"
                                : [
                                      "price",
                                      "rating",
                                      "guests",
                                      "pricePercent",
                                    ].includes(draft.field)
                                  ? "number"
                                  : "text"
                            }
                            value={draft.value}
                            onChange={(e) => {
                              setDraft({ ...draft, value: e.target.value });
                              setPreview(null);
                            }}
                          />
                        )}
                      </Field>
                    )}
                  </div>
                )}
                {draft.action === "create" && (
                  <>
                    {draft.records.map((r, i) => (
                      <fieldset key={i} style={{ marginTop: 16 }}>
                        <legend>
                          {tr("record", "Record")} {i + 1}
                        </legend>
                        <RecordFields
                          dataset={ds}
                          entity={entity}
                          value={r}
                          onChange={(v) => {
                            setDraft({
                              ...draft,
                              records: draft.records.map((x, j) =>
                                j === i ? v : x,
                              ),
                            });
                            setPreview(null);
                          }}
                        />
                        {draft.records.length > 1 && (
                          <button
                            onClick={() => {
                              setDraft({
                                ...draft,
                                records: draft.records.filter(
                                  (_, j) => j !== i,
                                ),
                              });
                              setPreview(null);
                            }}
                          >
                            {tr("remove", "Remove")}
                          </button>
                        )}
                      </fieldset>
                    ))}
                    <button
                      disabled={draft.records.length >= 100}
                      onClick={() => {
                        setDraft({
                          ...draft,
                          records: [...draft.records, defaults[entity]()],
                        });
                        setPreview(null);
                      }}
                    >
                      {tr("addAnother", "Add another record")}
                    </button>
                  </>
                )}
                {draft.action === "delete" && (
                  <>
                    <p>
                      {tr(
                        "permanent",
                        "Deletion permanently removes the selected application records. The preview includes any related seed records you choose to include.",
                      )}
                    </p>
                    {!modal.datasetDelete && (
                      <label className="seed-inline">
                        <input
                          type="checkbox"
                          checked={draft.cascade}
                          onChange={(e) => {
                            setDraft({ ...draft, cascade: e.target.checked });
                            setPreview(null);
                          }}
                        />
                        {tr("includeRelated", "Include related seed records")}
                      </label>
                    )}
                  </>
                )}
                {draft.action === "regenerate" && (
                  <>
                    <p>
                      {tr(
                        "regenerateHint",
                        "Regenerate descriptive fields while keeping account credentials, IDs, and relationships. Review the proposed values below.",
                      )}
                    </p>
                    <div className="seed-inline">
                      {regenerateFields[entity].map((field) => (
                        <label key={field} className="seed-inline">
                          <input
                            type="checkbox"
                            checked={(
                              draft.fields || regenerateFields[entity]
                            ).includes(field)}
                            onChange={(e) => {
                              const fields = new Set(
                                draft.fields || regenerateFields[entity],
                              );
                              if (e.target.checked) fields.add(field);
                              else fields.delete(field);
                              if (
                                entity === "reviews" &&
                                field === "text" &&
                                e.target.checked
                              )
                                fields.add("sentiment");
                              if (
                                entity === "reviews" &&
                                field === "sentiment" &&
                                !e.target.checked
                              )
                                fields.delete("text");
                              setDraft({ ...draft, fields: [...fields] });
                              setPreview(null);
                            }}
                          />
                          {tr(
                            field === "title" ? "propertyTitle" : field,
                            field,
                          )}
                        </label>
                      ))}
                    </div>
                  </>
                )}
                {preview && (
                  <div className="seed-card">
                    <strong>
                      {preview.count} {tr("affected", "records affected")}
                    </strong>
                    <pre>{JSON.stringify(preview.summary, null, 2)}</pre>
                    <details>
                      <summary>{tr("changes", "Proposed changes")}</summary>
                      <pre>{JSON.stringify(preview.samples, null, 2)}</pre>
                    </details>
                    {preview.action === "delete" && (
                      <Field
                        label={`${tr("typeName", "Type the dataset name")}: ${active.name}`}
                      >
                        <input
                          value={confirmName}
                          onChange={(e) => setConfirmName(e.target.value)}
                        />
                      </Field>
                    )}
                  </div>
                )}
                <div className="seed-actions">
                  <button disabled={busy} onClick={bulkPreview}>
                    {tr("preview", "Preview")}
                  </button>
                  <button
                    className={
                      draft.action === "delete" ? "seed-danger" : "seed-primary"
                    }
                    disabled={
                      busy ||
                      !preview ||
                      (preview.action === "delete" &&
                        confirmName !== active.name)
                    }
                    onClick={execute}
                  >
                    {tr("confirm", "Confirm action")}
                  </button>
                </div>
              </>
            )}
          </Modal>
        )}
      </div>
    </DashboardLayout>
  );
}
