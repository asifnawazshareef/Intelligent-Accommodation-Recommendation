import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/layout/DashboardLayout";
import ActionLink from "@/components/ui/action-link";
import ImageAuditPropertyGroup from "@/components/imageAudit/ImageAuditPropertyGroup";
import ImageAuditStatsBar from "@/components/imageAudit/ImageAuditStatsBar";
import {
  getImageAuditList,
  updateImageAudit,
} from "@/services/imageAuditService";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import notify from "@/lib/notify";

const PRESETS = {
  verify: { verificationStatus: "verified", aiScore: "0.95" },
  suspicious: { verificationStatus: "suspicious", aiScore: "0.45" },
  reject: { verificationStatus: "rejected", aiScore: "0" },
  pending: { verificationStatus: "pending" },
};

const buildDraft = (item) => ({
  verificationStatus: item.verificationStatus,
  aiScore: item.aiScore?.toString() ?? "0",
});

const parseAiScore = (value) => {
  if (value === "" || value === null || value === undefined) {
    return undefined;
  }

  const score = Number(value);
  if (Number.isNaN(score)) {
    return null;
  }

  return score;
};

const isDraftDirty = (item, draft) => {
  if (!draft) return false;

  const statusChanged = draft.verificationStatus !== item.verificationStatus;
  const parsedScore = parseAiScore(draft.aiScore);
  const savedScore = item.aiScore ?? 0;
  const scoreChanged =
    parsedScore !== undefined &&
    Math.abs(parsedScore - savedScore) > 0.0001;

  return statusChanged || scoreChanged;
};

const GroupSkeleton = () => (
  <div className="glass-card space-y-4 rounded-xl border border-border/60 p-4">
    <Skeleton className="h-6 w-2/3" />
    <Skeleton className="h-4 w-1/2" />
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {[1, 2, 3].map((item) => (
        <Skeleton key={item} className="aspect-[4/3] w-full rounded-xl" />
      ))}
    </div>
  </div>
);

const AdminImageAuditPage = () => {
  const { t } = useTranslation();
  const [allItems, setAllItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState("");
  const [savedIds, setSavedIds] = useState({});

  const fetchItems = useCallback(async () => {
    setLoading(true);

    try {
      const response = await getImageAuditList();
      const data = response.data.data || [];
      setAllItems(data);

      const nextDrafts = {};
      data.forEach((item) => {
        nextDrafts[item.id] = buildDraft(item);
      });
      setDrafts(nextDrafts);
      setSavedIds({});
    } catch (err) {
      notify.error(err.response?.data?.message || t("imageAudit.loadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const items = useMemo(() => {
    if (filter === "all") return allItems;
    return allItems.filter((item) => item.verificationStatus === filter);
  }, [allItems, filter]);

  const counts = useMemo(() => {
    const tally = {
      all: allItems.length,
      pending: 0,
      verified: 0,
      suspicious: 0,
      rejected: 0,
    };

    allItems.forEach((item) => {
      if (tally[item.verificationStatus] !== undefined) {
        tally[item.verificationStatus] += 1;
      }
    });

    return tally;
  }, [allItems]);

  const propertyGroups = useMemo(() => {
    const groups = new Map();

    items.forEach((item) => {
      const key = item.propertyId;

      if (!groups.has(key)) {
        groups.set(key, {
          propertyId: item.propertyId,
          propertyTitle: item.propertyTitle,
          propertyStatus: item.propertyStatus,
          ownerName: item.ownerName,
          ownerEmail: item.ownerEmail,
          images: [],
        });
      }

      groups.get(key).images.push(item);
    });

    return Array.from(groups.values()).sort((a, b) => {
      const aPending = a.images.filter((img) => img.verificationStatus === "pending").length;
      const bPending = b.images.filter((img) => img.verificationStatus === "pending").length;

      if (aPending !== bPending) {
        return bPending - aPending;
      }

      return a.propertyTitle.localeCompare(b.propertyTitle);
    });
  }, [items]);

  const updateDraft = (id, field, value) => {
    setSavedIds((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setDrafts((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value,
      },
    }));
  };

  const persistItem = async (item, draftValues) => {
    const draft = draftValues || drafts[item.id];
    if (!draft) return false;

    const hasScoreField = Object.prototype.hasOwnProperty.call(draft, "aiScore");
    const parsedScore = hasScoreField ? parseAiScore(draft.aiScore) : undefined;

    if (parsedScore === null) {
      notify.error(t("imageAudit.invalidScore"));
      return false;
    }

    if (
      parsedScore !== undefined &&
      (parsedScore < 0 || parsedScore > 1)
    ) {
      notify.error(t("imageAudit.invalidScore"));
      return false;
    }

    const payload = {
      verificationStatus: draft.verificationStatus,
    };

    if (parsedScore !== undefined) {
      payload.aiScore = parsedScore;
    }

    setSavingId(item.id);

    try {
      const response = await updateImageAudit(
        {
          propertyId: item.propertyId,
          imageId: item.imageId,
        },
        payload,
      );

      const updated = response.data.data;

      setAllItems((prev) =>
        prev.map((entry) =>
          entry.id === item.id
            ? {
                ...entry,
                verificationStatus: updated.verificationStatus,
                aiScore: updated.aiScore,
              }
            : entry,
        ),
      );

      setDrafts((prev) => ({
        ...prev,
        [item.id]: {
          verificationStatus: updated.verificationStatus,
          aiScore: updated.aiScore?.toString() ?? "0",
        },
      }));

      setSavedIds((prev) => ({ ...prev, [item.id]: true }));
      notify.success(
        t("imageAudit.saveSuccess", {
          property: item.propertyTitle,
        }),
      );

      return true;
    } catch (err) {
      notify.error(err.response?.data?.message || t("imageAudit.saveError"));
      return false;
    } finally {
      setSavingId("");
    }
  };

  const applyQuickAction = async (item, action) => {
    const preset = PRESETS[action];
    if (!preset) return;

    setDrafts((prev) => ({
      ...prev,
      [item.id]: { ...prev[item.id], ...preset },
    }));

    await persistItem(item, preset);
  };

  const saveItem = async (item) => {
    await persistItem(item);
  };

  const filterLabel = (value) => {
    if (value === "all") return t("imageAudit.filterAll");
    return t(`imageAudit.status.${value}`, value);
  };

  return (
    <DashboardLayout>
      <div className="dashboard-page">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                {t("admin.imageAudit")}
              </h1>
              <p className="mt-1 max-w-2xl text-muted-foreground">
                {t("imageAudit.pageHint")}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-muted/15 p-3 text-sm">
              <ShieldCheck className="size-4 shrink-0 text-primary" />
              <span className="text-muted-foreground">{t("imageAudit.workflowStep1")}</span>
              <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="text-muted-foreground">{t("imageAudit.workflowStep2")}</span>
              <ActionLink
                to="/admin/listings"
                variant="link"
                className="ms-auto h-auto p-0 text-sm"
              >
                {t("imageAudit.goToModeration")}
                <ExternalLink className="size-3.5" />
              </ActionLink>
            </div>
          </div>

          <Button
            variant="outline"
            onClick={fetchItems}
            disabled={loading}
            className="w-full min-w-fit shrink-0 whitespace-normal sm:w-auto"
          >
            <RefreshCw className={cn("size-4", loading && "animate-spin")} />
            {t("imageAudit.refresh")}
          </Button>
        </div>

        <ImageAuditStatsBar
          counts={counts}
          activeFilter={filter}
          onFilterChange={setFilter}
          loading={loading}
        />

        {loading && (
          <div className="space-y-4">
            <GroupSkeleton />
          </div>
        )}

        {!loading && allItems.length === 0 && (
          <Card className="glass-card border-dashed">
            <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <ShieldCheck className="size-10 text-muted-foreground/50" />
              <div className="max-w-md space-y-1">
                <h2 className="text-lg font-semibold">
                  {t("imageAudit.emptyTitle")}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {t("imageAudit.emptyHint")}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {!loading && allItems.length > 0 && items.length === 0 && (
          <Card className="glass-card border-dashed">
            <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <p className="text-sm text-muted-foreground">
                {t("imageAudit.noFilterResults", {
                  status: filterLabel(filter),
                })}
              </p>
              <Button variant="outline" size="sm" onClick={() => setFilter("all")}>
                {t("imageAudit.filterAll")}
              </Button>
            </CardContent>
          </Card>
        )}

        {!loading && propertyGroups.length > 0 && (
          <div className="space-y-5">
            {propertyGroups.map((group) => (
              <ImageAuditPropertyGroup
                key={group.propertyId}
                group={group}
                drafts={drafts}
                savingId={savingId}
                savedIds={savedIds}
                isDraftDirty={isDraftDirty}
                buildDraft={buildDraft}
                onDraftChange={updateDraft}
                onQuickAction={applyQuickAction}
                onSave={saveItem}
              />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminImageAuditPage;
