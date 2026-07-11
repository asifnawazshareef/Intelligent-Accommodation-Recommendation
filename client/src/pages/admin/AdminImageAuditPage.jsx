import { useCallback, useEffect, useMemo, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/layout/DashboardLayout";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import RefreshButton from "@/components/ui/RefreshButton";
import ImageAuditPropertyGroup from "@/components/imageAudit/ImageAuditPropertyGroup";
import ImageAuditStatsBar from "@/components/imageAudit/ImageAuditStatsBar";
import {
  getImageAuditList,
  updateImageAudit,
} from "@/services/imageAuditService";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import notify from "@/lib/notify";

const PRESETS = {
  verify: { verificationStatus: "verified", aiScore: "0.95" },
  suspicious: { verificationStatus: "suspicious", aiScore: "0.45" },
  reject: { verificationStatus: "rejected", aiScore: "0" },
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
  const [savingId, setSavingId] = useState("");
  const [savedIds, setSavedIds] = useState({});

  const fetchItems = useCallback(async () => {
    setLoading(true);

    try {
      const response = await getImageAuditList();
      setAllItems(response.data.data || []);
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
          images: [],
        });
      }

      groups.get(key).images.push(item);
    });

    return Array.from(groups.values()).sort((a, b) => {
      const aPending = a.images.filter(
        (img) => img.verificationStatus === "pending",
      ).length;
      const bPending = b.images.filter(
        (img) => img.verificationStatus === "pending",
      ).length;

      if (aPending !== bPending) {
        return bPending - aPending;
      }

      return a.propertyTitle.localeCompare(b.propertyTitle);
    });
  }, [items]);

  const applyQuickAction = async (item, action) => {
    const preset = PRESETS[action];
    if (!preset) return;

    setSavingId(item.id);

    try {
      const response = await updateImageAudit(
        {
          propertyId: item.propertyId,
          imageId: item.imageId,
        },
        {
          verificationStatus: preset.verificationStatus,
          aiScore: Number(preset.aiScore),
        },
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

      setSavedIds((prev) => ({ ...prev, [item.id]: true }));
      notify.success(
        t("imageAudit.saveSuccess", {
          property: item.propertyTitle,
        }),
      );
    } catch (err) {
      notify.error(err.response?.data?.message || t("imageAudit.saveError"));
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
      <div className="dashboard-page">
        <PageHeader
          title={t("admin.imageAudit")}
          description={t("imageAudit.pageHint")}
          actions={
            <RefreshButton
              onClick={fetchItems}
              loading={loading}
              label={t("imageAudit.refresh")}
              className="w-full sm:w-auto"
            />
          }
        />

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
          <EmptyState
            icon={ShieldCheck}
            title={t("imageAudit.emptyTitle")}
            description={t("imageAudit.emptyHint")}
          />
        )}

        {!loading && allItems.length > 0 && items.length === 0 && (
          <EmptyState
            compact
            title={t("imageAudit.noFilterResults", {
              status: filterLabel(filter),
            })}
          >
            <Button variant="outline" size="sm" onClick={() => setFilter("all")}>
              {t("imageAudit.filterAll")}
            </Button>
          </EmptyState>
        )}

        {!loading && propertyGroups.length > 0 && (
          <div className="space-y-5">
            {propertyGroups.map((group) => (
              <ImageAuditPropertyGroup
                key={group.propertyId}
                group={group}
                savingId={savingId}
                savedIds={savedIds}
                onQuickAction={applyQuickAction}
              />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminImageAuditPage;
