import {
  CheckCircle2,
  Loader2,
  ShieldAlert,
  ShieldX,
  User,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import AiScoreMeter from "@/components/imageAudit/AiScoreMeter";
import ImageVerificationBadge from "@/components/imageAudit/ImageVerificationBadge";
import PropertyCoverImage from "@/components/properties/PropertyCoverImage";
import PropertyStatusBadge from "@/components/properties/PropertyStatusBadge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const QUICK_ACTIONS = [
  {
    key: "verify",
    labelKey: "verify",
    icon: CheckCircle2,
    status: "verified",
    activeClass:
      "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  },
  {
    key: "suspicious",
    labelKey: "markSuspicious",
    icon: ShieldAlert,
    status: "suspicious",
    activeClass:
      "border-orange-500/50 bg-orange-500/10 text-orange-700 dark:text-orange-400",
  },
  {
    key: "reject",
    labelKey: "reject",
    icon: ShieldX,
    status: "rejected",
    activeClass: "border-destructive/50 bg-destructive/10 text-destructive",
  },
];

const AuditImagePanel = ({ item, isSaving, isSaved, onQuickAction }) => {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        "relative flex flex-col overflow-hidden rounded-xl border border-border/60 bg-background/80",
        isSaved && "border-emerald-500/30",
        isSaving && "opacity-80",
      )}
    >
      {isSaving && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[1px]">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      )}

      <div className="relative">
        <PropertyCoverImage
          src={item.url}
          alt={item.propertyTitle}
          className="aspect-[4/3] rounded-none border-0"
        />
        <div className="absolute start-2 top-2 flex flex-wrap gap-1.5">
          <ImageVerificationBadge status={item.verificationStatus} />
          {isSaved && (
            <Badge className="bg-emerald-500/90 text-white hover:bg-emerald-500/90">
              <CheckCircle2 className="size-3" />
              {t("imageAudit.saved")}
            </Badge>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-3">
        <AiScoreMeter score={item.aiScore} label={t("imageAudit.aiScore")} />

        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
          {QUICK_ACTIONS.map(({ key, labelKey, icon: Icon, status, activeClass }) => {
            const isActive = item.verificationStatus === status;

            return (
              <Button
                key={key}
                type="button"
                size="sm"
                variant="outline"
                disabled={isSaving}
                onClick={() => onQuickAction(item, key)}
                className={cn(
                  "h-9 gap-1.5 px-2 text-xs whitespace-normal",
                  isActive && activeClass,
                )}
              >
                <Icon className="size-3.5 shrink-0" />
                {t(`imageAudit.${labelKey}`)}
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const ImageAuditPropertyGroup = ({
  group,
  savingId,
  savedIds,
  onQuickAction,
}) => {
  const { t } = useTranslation();
  const pendingInGroup = group.images.filter(
    (img) => img.verificationStatus === "pending",
  ).length;

  return (
    <section className="glass-card overflow-hidden rounded-xl border border-border/60">
      <header className="space-y-2 border-b border-border/60 bg-muted/20 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold tracking-tight">
            {group.propertyTitle}
          </h2>
          <PropertyStatusBadge status={group.propertyStatus} />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <User className="size-3.5 shrink-0" />
            <span className="truncate">{group.ownerName}</span>
          </span>
          <span className="text-xs">
            {t("imageAudit.imagesInProperty", { count: group.images.length })}
            {pendingInGroup > 0 &&
              ` · ${t("imageAudit.pendingInProperty", { count: pendingInGroup })}`}
          </span>
        </div>
      </header>

      <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
        {group.images.map((item) => (
          <AuditImagePanel
            key={item.id}
            item={item}
            isSaving={savingId === item.id}
            isSaved={Boolean(savedIds[item.id])}
            onQuickAction={onQuickAction}
          />
        ))}
      </div>
    </section>
  );
};

export default ImageAuditPropertyGroup;
