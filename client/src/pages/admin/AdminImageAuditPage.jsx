import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  User,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/layout/DashboardLayout";
import ImageVerificationBadge from "@/components/imageAudit/ImageVerificationBadge";
import PropertyCoverImage from "@/components/properties/PropertyCoverImage";
import PropertyStatusBadge from "@/components/properties/PropertyStatusBadge";
import {
  getImageAuditList,
  updateImageAudit,
} from "@/services/imageAuditService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const FILTERS = ["all", "pending", "verified", "suspicious", "rejected"];
const STATUS_OPTIONS = FILTERS.filter((status) => status !== "all");

const QUICK_ACTIONS = [
  { key: "verify", labelKey: "verify", icon: CheckCircle2, iconClass: "text-emerald-600" },
  { key: "suspicious", labelKey: "markSuspicious", icon: ShieldAlert, iconClass: "text-orange-600" },
  { key: "reject", labelKey: "reject", icon: ShieldX, iconClass: "text-destructive" },
  { key: "pending", labelKey: "resetPending", icon: RefreshCw, iconClass: "" },
];

const PRESETS = {
  verify: { verificationStatus: "verified", aiScore: "0.95" },
  suspicious: { verificationStatus: "suspicious", aiScore: "0.45" },
  reject: { verificationStatus: "rejected", aiScore: "0" },
  pending: { verificationStatus: "pending", aiScore: "0.85" },
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

const AuditCardSkeleton = () => (
  <Card className="glass-card overflow-hidden">
    <Skeleton className="aspect-video w-full rounded-none" />
    <CardHeader className="space-y-2">
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
    </CardHeader>
    <CardContent className="space-y-3">
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-8 w-full" />
    </CardContent>
  </Card>
);

const AdminImageAuditPage = () => {
  const { t } = useTranslation();
  const [allItems, setAllItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [filter, setFilter] = useState("all");
  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState("");
  const [savedIds, setSavedIds] = useState({});

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError("");
    setSuccess("");

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
      setError(err.response?.data?.message || t("imageAudit.loadError"));
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

  const updateDraft = (id, field, value) => {
    setSuccess("");
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

    const parsedScore = parseAiScore(draft.aiScore);
    if (parsedScore === null) {
      setError(t("imageAudit.invalidScore"));
      return false;
    }

    if (
      parsedScore !== undefined &&
      (parsedScore < 0 || parsedScore > 1)
    ) {
      setError(t("imageAudit.invalidScore"));
      return false;
    }

    const payload = {
      verificationStatus: draft.verificationStatus,
    };

    if (parsedScore !== undefined) {
      payload.aiScore = parsedScore;
    }

    setSavingId(item.id);
    setError("");
    setSuccess("");

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
      setSuccess(
        t("imageAudit.saveSuccess", {
          property: item.propertyTitle,
        }),
      );

      return true;
    } catch (err) {
      setError(err.response?.data?.message || t("imageAudit.saveError"));
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
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {t("admin.imageAudit")}
            </h1>
            <p className="mt-1 max-w-2xl text-muted-foreground">
              {t("imageAudit.pageHint")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="whitespace-normal">
              {t("imageAudit.totalImages", { count: counts.all })}
            </Badge>
            {counts.pending > 0 && (
              <Badge className="whitespace-normal bg-amber-500/15 text-amber-800 hover:bg-amber-500/20 dark:text-amber-300">
                {t("imageAudit.pendingCount", { count: counts.pending })}
              </Badge>
            )}
            <Button
              variant="outline"
              onClick={fetchItems}
              disabled={loading}
              className="w-full min-w-fit whitespace-normal sm:w-auto"
            >
              <RefreshCw className={cn("size-4", loading && "animate-spin")} />
              {t("imageAudit.refresh")}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {FILTERS.map((value) => (
            <Button
              key={value}
              size="sm"
              variant={filter === value ? "default" : "outline"}
              onClick={() => setFilter(value)}
              className="whitespace-normal"
            >
              {filterLabel(value)}
              {!loading && (
                <span className="ms-1 rounded-full bg-background/20 px-1.5 text-xs">
                  {counts[value]}
                </span>
              )}
            </Button>
          ))}
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>{t("imageAudit.errorTitle")}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert>
            <AlertTitle>{t("imageAudit.successTitle")}</AlertTitle>
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {loading && (
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <AuditCardSkeleton key={item} />
            ))}
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

        {!loading && items.length > 0 && (
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => {
              const draft = drafts[item.id] || buildDraft(item);
              const isSaving = savingId === item.id;
              const isDirty = isDraftDirty(item, draft);
              const isSaved = savedIds[item.id] && !isDirty;

              return (
                <Card
                  key={item.id}
                  className={cn(
                    "glass-card flex flex-col overflow-hidden transition-shadow",
                    isDirty && "ring-1 ring-primary/30",
                    isSaved && "ring-1 ring-emerald-500/30",
                  )}
                >
                  <PropertyCoverImage
                    src={item.url}
                    alt={item.propertyTitle}
                    className="rounded-none border-b border-border/60"
                  />

                  <CardHeader className="space-y-3 pb-3">
                    <div className="space-y-2">
                      <CardTitle className="line-clamp-2 text-base">
                        {item.propertyTitle}
                      </CardTitle>
                      <CardDescription className="space-y-1">
                        <span className="flex items-center gap-1.5">
                          <User className="size-3.5 shrink-0" />
                          <span className="truncate">{item.ownerName}</span>
                        </span>
                        {item.ownerEmail && (
                          <span className="block truncate text-xs" dir="ltr">
                            {item.ownerEmail}
                          </span>
                        )}
                      </CardDescription>
                      <div className="flex flex-wrap gap-2">
                        <ImageVerificationBadge
                          status={item.verificationStatus}
                        />
                        <PropertyStatusBadge status={item.propertyStatus} />
                        {isSaved && (
                          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="size-3" />
                            {t("imageAudit.saved")}
                          </Badge>
                        )}
                      </div>
                      <p
                        className="line-clamp-2 break-all text-xs text-muted-foreground"
                        dir="ltr"
                        title={item.url}
                      >
                        {item.url}
                      </p>
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-xs"
                        asChild
                      >
                        <Link to={`/properties/${item.propertyId}`}>
                          {t("imageAudit.viewProperty")}
                          <ExternalLink className="size-3" />
                        </Link>
                      </Button>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>{t("imageAudit.statusLabel")}</Label>
                        <Select
                          value={draft.verificationStatus}
                          onValueChange={(value) =>
                            updateDraft(item.id, "verificationStatus", value)
                          }
                          disabled={isSaving}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((status) => (
                              <SelectItem key={status} value={status}>
                                {t(`imageAudit.status.${status}`, status)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`score-${item.id}`}>
                          {t("imageAudit.aiScore")}
                        </Label>
                        <Input
                          id={`score-${item.id}`}
                          type="number"
                          min="0"
                          max="1"
                          step="0.01"
                          value={draft.aiScore}
                          onChange={(e) =>
                            updateDraft(item.id, "aiScore", e.target.value)
                          }
                          disabled={isSaving}
                          dir="ltr"
                          className="w-full"
                        />
                        <p className="text-xs text-muted-foreground">
                          {t("imageAudit.scoreHint")}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {QUICK_ACTIONS.map(({ key, labelKey, icon: Icon, iconClass }) => (
                        <Button
                          key={key}
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={isSaving}
                          onClick={() => applyQuickAction(item, key)}
                          className="whitespace-normal"
                        >
                          <Icon className={cn("size-4", iconClass)} />
                          {t(`imageAudit.${labelKey}`)}
                        </Button>
                      ))}
                    </div>
                  </CardContent>

                  <CardFooter className="mt-auto border-t border-border/60 pt-4">
                    <Button
                      className="w-full whitespace-normal"
                      disabled={isSaving || !isDirty}
                      onClick={() => saveItem(item)}
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          {t("common.loading")}
                        </>
                      ) : isDirty ? (
                        t("imageAudit.saveDecision")
                      ) : (
                        t("imageAudit.noChanges")
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminImageAuditPage;
