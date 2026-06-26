import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ImageOff,
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
import PropertyStatusBadge from "@/components/properties/PropertyStatusBadge";
import {
  getImageAuditList,
  updateImageAudit,
} from "@/services/imageAuditService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

const AuditImagePreview = ({ url, alt }) => {
  const { t } = useTranslation();
  const [status, setStatus] = useState("loading");

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-border/60 bg-muted/30 sm:aspect-[4/3] sm:max-w-[220px]">
      {status === "loading" && (
        <div className="flex h-full min-h-32 items-center justify-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      )}
      {status === "error" && (
        <div className="flex h-full min-h-32 flex-col items-center justify-center gap-1 p-3 text-center text-xs text-muted-foreground">
          <ImageOff className="size-5" />
          {t("imageAudit.previewError")}
        </div>
      )}
      <img
        src={url}
        alt={alt}
        className={cn(
          "h-full w-full object-cover",
          status === "loaded" ? "block" : "hidden",
        )}
        onLoad={() => setStatus("loaded")}
        onError={() => setStatus("error")}
      />
    </div>
  );
};

const AuditCardSkeleton = () => (
  <Card className="glass-card overflow-hidden">
    <Skeleton className="aspect-video w-full rounded-none sm:max-w-[220px]" />
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
  const [filter, setFilter] = useState("all");
  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState("");

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await getImageAuditList();
      const data = response.data.data || [];
      setAllItems(data);

      const nextDrafts = {};
      data.forEach((item) => {
        nextDrafts[item.id] = {
          verificationStatus: item.verificationStatus,
          aiScore: item.aiScore?.toString() ?? "0",
        };
      });
      setDrafts(nextDrafts);
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
    setDrafts((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value,
      },
    }));
  };

  const applyQuickAction = async (item, action) => {
    const presets = {
      verify: { verificationStatus: "verified", aiScore: "0.95" },
      suspicious: { verificationStatus: "suspicious", aiScore: "0.45" },
      reject: { verificationStatus: "rejected", aiScore: "0" },
      pending: { verificationStatus: "pending", aiScore: "0.85" },
    };

    const preset = presets[action];
    if (!preset) return;

    setDrafts((prev) => ({
      ...prev,
      [item.id]: { ...prev[item.id], ...preset },
    }));

    await saveItem(item.id, preset);
  };

  const saveItem = async (id, override) => {
    const draft = override || drafts[id];
    if (!draft) return;

    setSavingId(id);
    setError("");

    try {
      const response = await updateImageAudit(id, {
        verificationStatus: draft.verificationStatus,
        aiScore: Number(draft.aiScore),
      });

      const updated = response.data.data;
      setAllItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                verificationStatus: updated.verificationStatus,
                aiScore: updated.aiScore,
              }
            : item,
        ),
      );

      setDrafts((prev) => ({
        ...prev,
        [id]: {
          verificationStatus: updated.verificationStatus,
          aiScore: updated.aiScore?.toString() ?? "0",
        },
      }));
    } catch (err) {
      setError(err.response?.data?.message || t("imageAudit.saveError"));
    } finally {
      setSavingId("");
    }
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
              {!loading && value !== "all" && counts[value] > 0 && (
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
              const draft = drafts[item.id] || {};
              const isSaving = savingId === item.id;

              return (
                <Card key={item.id} className="glass-card flex flex-col overflow-hidden">
                  <CardHeader className="space-y-3 pb-3">
                    <div className="flex flex-col gap-4 sm:flex-row">
                      <AuditImagePreview
                        url={item.url}
                        alt={item.propertyTitle}
                      />
                      <div className="min-w-0 flex-1 space-y-2">
                        <CardTitle className="line-clamp-2 text-base">
                          {item.propertyTitle}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-1.5">
                          <User className="size-3.5 shrink-0" />
                          <span className="truncate">{item.ownerName}</span>
                        </CardDescription>
                        <div className="flex flex-wrap gap-2">
                          <ImageVerificationBadge
                            status={item.verificationStatus}
                          />
                          <PropertyStatusBadge status={item.propertyStatus} />
                        </div>
                        <p className="truncate text-xs text-muted-foreground" dir="ltr">
                          {item.url}
                        </p>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>{t("imageAudit.statusLabel")}</Label>
                        <Select
                          value={draft.verificationStatus || item.verificationStatus}
                          onValueChange={(value) =>
                            updateDraft(item.id, "verificationStatus", value)
                          }
                          disabled={isSaving}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {FILTERS.filter((s) => s !== "all").map((status) => (
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
                          value={draft.aiScore ?? ""}
                          onChange={(e) =>
                            updateDraft(item.id, "aiScore", e.target.value)
                          }
                          disabled={isSaving}
                          dir="ltr"
                          className="w-full"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={isSaving}
                        onClick={() => applyQuickAction(item, "verify")}
                        className="whitespace-normal"
                      >
                        <CheckCircle2 className="size-4 text-emerald-600" />
                        {t("imageAudit.verify")}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={isSaving}
                        onClick={() => applyQuickAction(item, "suspicious")}
                        className="whitespace-normal"
                      >
                        <ShieldAlert className="size-4 text-orange-600" />
                        {t("imageAudit.markSuspicious")}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={isSaving}
                        onClick={() => applyQuickAction(item, "reject")}
                        className="whitespace-normal"
                      >
                        <ShieldX className="size-4 text-destructive" />
                        {t("imageAudit.reject")}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={isSaving}
                        onClick={() => applyQuickAction(item, "pending")}
                        className="whitespace-normal"
                      >
                        <RefreshCw className="size-4" />
                        {t("imageAudit.resetPending")}
                      </Button>
                    </div>
                  </CardContent>

                  <CardFooter className="border-t border-border/60 pt-4">
                    <Button
                      className="w-full whitespace-normal"
                      disabled={isSaving}
                      onClick={() => saveItem(item.id)}
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          {t("common.loading")}
                        </>
                      ) : (
                        t("imageAudit.saveDecision")
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
