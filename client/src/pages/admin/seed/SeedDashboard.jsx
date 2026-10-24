import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/context/AuthContext";
import DashboardLayout from "@/components/layout/DashboardLayout";
import api from "@/services/api";
import { resolveImageUrl } from "@/lib/imageUrl";
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
    [rows, setRows] = useState([]),
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
    [confirmName, setConfirmName] = useState("");
  const active = datasets.find((x) => x._id === ds);
  const running = jobs.some((j) =>
    ["queued", "running", "cancel_requested"].includes(j.state),
  );
  const refresh = useCallback(async () => {
    const [d, j] = await Promise.all([
      api.get(`${base}/datasets`),
      api.get(`${base}/jobs`, { params: ds ? { dataset: ds } : {} }),
    ]);
    setDatasets(d.data);
    setJobs(j.data);
  }, [ds]);
  const loadSequence = useRef(0);
  const loadRows = useCallback(async () => {
    const sequence = ++loadSequence.current;
    if (!ds) return;
    setLoading(true);
    try {
      const r = await api.get(`${base}/datasets/${ds}/${entity}`, {
        params: { ...filters, page, pageSize: 25 },
      });
      if (sequence !== loadSequence.current) return;
      setRows(r.data.records);
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
  const completedJobs = jobs.filter((j) => j.state === "completed").length;
  useEffect(() => {
    loadRows().catch((e) => setError(e.response?.data?.message || e.message));
  }, [loadRows, completedJobs]);
  useEffect(() => {
    setSelected([]);
    setAll(false);
    setPreview(null);
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
      await loadRows();
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
            onClick={() => {
              setDraft({
                name: "FYP demo",
                namespace: `demo_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`,
                recipe: { ...initialRecipe },
              });
              open("dataset");
            }}
          >
            {tr("newDataset", "New dataset")}
          </button>
        </div>
        {error && (
          <div className="seed-error" role="alert">
            {error}
          </div>
        )}
        {cap && !cap.transactions && (
          <div className="seed-notice">
            {tr(
              "replicaNeeded",
              "Enable a MongoDB replica set to generate or change seed data. See the setup guide.",
            )}
          </div>
        )}
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
                  {d.name}
                </option>
              ))}
            </select>
          </Field>
          <span className="seed-muted">{cap?.environment}</span>
        </div>
        {!active && (
          <div className="seed-card">
            <h2>{tr("startTitle", "Start with a small dataset")}</h2>
            <p>
              {tr(
                "startText",
                "Choose a dataset or create one. Preview the records before generating them, then use the tabs to edit and manage your demo.",
              )}
            </p>
          </div>
        )}
        {running && (
          <p className="seed-notice" role="status">
            {tr(
              "jobRunning",
              "A job is running. Editing will be available when it finishes.",
            )}
          </p>
        )}
        {active && (
          <>
            <div className="seed-stats">
              {entities.map((e) => (
                <div className="seed-stat" key={e}>
                  <strong>{(active.counts?.[e] || 0).toLocaleString()}</strong>
                  {tr(e, labels[e])}
                </div>
              ))}
            </div>
            <div className="seed-toolbar">
              <div className="seed-inline">
                <button
                  className="seed-primary"
                  disabled={running || busy || !cap?.transactions}
                  onClick={() => {
                    setDraft({ ...active.recipe });
                    open("generate", { kind: "generate" });
                  }}
                >
                  {tr("generate", "Generate data")}
                </button>
                <button
                  disabled={running || busy || !cap?.transactions}
                  onClick={() => {
                    setDraft({ ...initialRecipe });
                    open("generate", { kind: "append" });
                  }}
                >
                  {tr("append", "Add more data")}
                </button>
                <button
                  disabled={running || busy}
                  onClick={() =>
                    run(() =>
                      api.post(`${base}/datasets/${ds}/jobs`, {
                        kind: "validate",
                        requestKey: crypto.randomUUID(),
                      }),
                    )
                  }
                >
                  {tr("validate", "Validate")}
                </button>
                <button
                  disabled={running || busy}
                  onClick={() =>
                    run(() =>
                      api.post(`${base}/datasets/${ds}/jobs`, {
                        kind: "recalculate",
                        requestKey: crypto.randomUUID(),
                      }),
                    )
                  }
                >
                  {tr("recalculate", "Recalculate summaries")}
                </button>
              </div>
              <button
                className="seed-danger"
                disabled={running || busy}
                onClick={() => {
                  setDraft({ action: "delete", cascade: true });
                  open("bulk", { datasetDelete: true });
                }}
              >
                {tr("deleteDataset", "Delete dataset records")}
              </button>
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
                <p className="seed-muted seed-scroll-hint">
                  {tr(
                    "scrollTable",
                    "Swipe the table to see all columns and actions.",
                  )}
                </p>
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
                            {r.name ||
                              r.title ||
                              r.text?.slice(0, 100) ||
                              `${r.startDate} to ${r.endDate}`}
                            <small>{r._id}</small>
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
                      {!rows.length && (
                        <tr>
                          <td colSpan={5}>
                            {loading
                              ? tr("loading", "Loading…")
                              : tr(
                                  "noRecords",
                                  "No records match these filters.",
                                )}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
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
                {jobs.map((j) => (
                  <div className="seed-job" key={j._id}>
                    <div className="seed-job-title">
                      <strong>
                        {tr(j.kind, j.kind)} · {tr(j.state, j.state)}
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
            title={tr(
              modal.type,
              modal.type === "bulk"
                ? "Bulk action"
                : modal.type === "dataset"
                  ? "New dataset"
                  : modal.type === "generate"
                    ? "Generate data"
                    : modal.type === "detail"
                      ? "Record details"
                      : modal.type === "password"
                        ? "Reset demo password"
                        : modal.type === "edit"
                          ? "Edit record"
                          : "Create record",
            )}
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
                    setDraft(r.data.recipe);
                    setModal({
                      type: "generate",
                      kind: "generate",
                      requestKey: crypto.randomUUID(),
                    });
                  });
                }}
              >
                <div className="seed-form-grid">
                  <Field label={tr("name", "Name")}>
                    <input
                      required
                      maxLength={80}
                      value={draft.name}
                      onChange={(e) =>
                        setDraft({ ...draft, name: e.target.value })
                      }
                    />
                  </Field>
                  <Field label={tr("namespace", "Unique dataset name")}>
                    <input
                      required
                      pattern="[a-z][a-z0-9_]{2,39}"
                      placeholder="fyp_demo"
                      value={draft.namespace}
                      onChange={(e) =>
                        setDraft({ ...draft, namespace: e.target.value })
                      }
                    />
                  </Field>
                </div>
                {cap.collectedCatalog?.available > 0 && <p className="seed-muted">
                  Collected catalog: {cap.collectedCatalog.available} of {cap.collectedCatalog.target} properties,
                  {" "}{cap.collectedCatalog.images} matching photos from {cap.collectedCatalog.sources.length} websites.
                </p>}
                <PresetPicker presets={cap.presets} descriptions={cap.presetDescriptions}
                  onSelect={(recipe, key) => setDraft({ ...draft,
                    name: cap.presetDescriptions?.[key] || key,
                    recipe: { ...recipe, referenceDate: new Date().toISOString().slice(0, 10) },
                  })} />
                <details>
                  <summary>Customize counts and settings (optional)</summary>
                <GenerationFields
                  value={draft.recipe}
                  onChange={(v) => setDraft({ ...draft, recipe: v })}
                />
                </details>
                <div className="seed-actions">
                  <button className="seed-primary" disabled={busy}>
                    {tr("createDataset", "Create dataset")}
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
                <GenerationFields
                  value={draft}
                  onChange={(v) => {
                    setDraft(v);
                    setPreview(null);
                  }}
                />
                {modal.kind === "generate" && (
                  <p className="seed-muted">
                    {tr(
                      "initialRecipe",
                      "Initial generation uses the saved recipe. Use Add more data for a different recipe.",
                    )}
                  </p>
                )}
                {preview && (
                  <div className="seed-card">
                    <strong>
                      {preview.total} {tr("planned", "records planned")}
                    </strong>
                    <pre>{JSON.stringify(preview.counts, null, 2)}</pre>
                    {preview.samples.filter(x => x.entity === "properties" && x.payload.seedCatalog).map(x => (
                      <div key={x.key}>
                        <strong>{x.payload.title}</strong>
                        <p className="seed-muted">Real property reference with credited photos. Prices and reviews are demo data.</p>
                        <div className="seed-photo-preview">
                          {x.payload.images.map(photo => <figure key={photo.url}>
                            <img src={resolveImageUrl(photo.url)} alt={photo.caption} />
                            <figcaption>{photo.credit.author}{" · "}
                              <a href={photo.credit.sourceUrl} target="_blank" rel="noopener noreferrer">Source</a>{" · "}
                              <a href={photo.credit.licenseUrl} target="_blank" rel="noopener noreferrer">{photo.credit.license}</a>
                            </figcaption>
                          </figure>)}
                        </div>
                      </div>
                    ))}

                    <details>
                      <summary>{tr("samples", "Example records")}</summary>
                      <pre>
                        {JSON.stringify(
                          preview.samples.map((x) => ({
                            entity: x.entity,
                            ...x.payload,
                          })),
                          null,
                          2,
                        )}
                      </pre>
                    </details>
                  </div>
                )}
                <div className="seed-actions">
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
              <dl>
                {Object.entries(modal.row)
                  .filter(([k]) => !["__v", "seedRevision"].includes(k))
                  .map(([k, v]) => (
                    <div key={k} className="seed-span">
                      <dt>{tr(k, k)}</dt>
                      <dd>
                        {typeof v === "object" ? (
                          <pre>{JSON.stringify(v, null, 2)}</pre>
                        ) : (
                          String(v)
                        )}
                      </dd>
                    </div>
                  ))}
              </dl>
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
