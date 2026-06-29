import {
  CheckCircle2,
  Loader2,
  RefreshCw,
  ShieldAlert,
  ShieldX,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import AiScoreMeter from "@/components/imageAudit/AiScoreMeter";
import ImageVerificationBadge from "@/components/imageAudit/ImageVerificationBadge";
import PropertyCoverImage from "@/components/properties/PropertyCoverImage";
import PropertyStatusBadge from "@/components/properties/PropertyStatusBadge";
import ActionLink from "@/components/ui/action-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ExternalLink, User } from "lucide-react";

const STATUS_OPTIONS = ["pending", "verified", "suspicious", "rejected"];

const QUICK_ACTIONS = [
  {
    key: "verify",
    labelKey: "verify",
    icon: CheckCircle2,
    activeClass: "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  },
  {
    key: "suspicious",
    labelKey: "markSuspicious",
    icon: ShieldAlert,
    activeClass: "border-orange-500/50 bg-orange-500/10 text-orange-700 dark:text-orange-400",
  },
  {
    key: "reject",
    labelKey: "reject",
    icon: ShieldX,
    activeClass: "border-destructive/50 bg-destructive/10 text-destructive",
  },
  {
    key: "pending",
    labelKey: "resetPending",
    icon: RefreshCw,
    activeClass: "border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-300",
  },
];

const AuditImagePanel = ({
  item,
  draft,
  isSaving,
  isDirty,
  isSaved,
  onDraftChange,
  onQuickAction,
  onSave,
}) => {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        "relative flex flex-col overflow-hidden rounded-xl border border-border/60 bg-background/80 transition-all",
        isDirty && "border-primary/40 shadow-sm ring-1 ring-primary/20",
        isSaved && !isDirty && "border-emerald-500/30",
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
          <ImageVerificationBadge status={draft.verificationStatus} />
          {isSaved && !isDirty && (
            <Badge className="bg-emerald-500/90 text-white hover:bg-emerald-500/90">
              <CheckCircle2 className="size-3" />
              {t("imageAudit.saved")}
            </Badge>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-3">
        <AiScoreMeter score={draft.aiScore} label={t("imageAudit.aiScore")} />

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">{t("imageAudit.statusLabel")}</Label>
            <Select
              value={draft.verificationStatus}
              onValueChange={(value) =>
                onDraftChange(item.id, "verificationStatus", value)
              }
              disabled={isSaving}
            >
              <SelectTrigger className="h-9 w-full text-xs">
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

          <div className="space-y-1.5">
            <Label htmlFor={`score-${item.id}`} className="text-xs">
              {t("imageAudit.scoreLabel")}
            </Label>
            <Input
              id={`score-${item.id}`}
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={draft.aiScore}
              onChange={(e) => onDraftChange(item.id, "aiScore", e.target.value)}
              disabled={isSaving}
              dir="ltr"
              className="h-9 text-xs"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {QUICK_ACTIONS.map(({ key, labelKey, icon: Icon, activeClass }) => {
            const isActive =
              (key === "verify" && draft.verificationStatus === "verified") ||
              (key === "suspicious" && draft.verificationStatus === "suspicious") ||
              (key === "reject" && draft.verificationStatus === "rejected") ||
              (key === "pending" && draft.verificationStatus === "pending");

            return (
              <Button
                key={key}
                type="button"
                size="sm"
                variant="outline"
                disabled={isSaving}
                onClick={() => onQuickAction(item, key)}
                className={cn(
                  "h-8 gap-1.5 px-2 text-xs whitespace-normal",
                  isActive && activeClass,
                )}
              >
                <Icon className="size-3.5 shrink-0" />
                {t(`imageAudit.${labelKey}`)}
              </Button>
            );
          })}
        </div>

        {isDirty && (
          <Button
            size="sm"
            className="h-9 w-full"
            disabled={isSaving}
            onClick={() => onSave(item)}
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
        )}
      </div>
    </div>
  );
};

const ImageAuditPropertyGroup = ({
  group,
  drafts,
  savingId,
  savedIds,
  isDraftDirty,
  buildDraft,
  onDraftChange,
  onQuickAction,
  onSave,
}) => {
  const { t } = useTranslation();
  const pendingInGroup = group.images.filter(
    (img) => img.verificationStatus === "pending",
  ).length;

  return (
    <section className="glass-card overflow-hidden rounded-xl border border-border/60">
      <header className="flex flex-col gap-3 border-b border-border/60 bg-muted/20 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
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
            {group.ownerEmail && (
              <span className="truncate text-xs" dir="ltr">
                {group.ownerEmail}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {t("imageAudit.imagesInProperty", { count: group.images.length })}
            {pendingInGroup > 0 &&
              ` · ${t("imageAudit.pendingInProperty", { count: pendingInGroup })}`}
          </p>
        </div>

        <ActionLink
          to="/admin/listings"
          variant="outline"
          size="sm"
          className="shrink-0 whitespace-normal"
        >
          {t("imageAudit.moderateProperty")}
          <ExternalLink className="size-3.5" />
        </ActionLink>
      </header>

      <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
        {group.images.map((item) => {
          const draft = drafts[item.id] || buildDraft(item);
          const isSaving = savingId === item.id;
          const isDirty = isDraftDirty(item, draft);
          const isSaved = savedIds[item.id] && !isDirty;

          return (
            <AuditImagePanel
              key={item.id}
              item={item}
              draft={draft}
              isSaving={isSaving}
              isDirty={isDirty}
              isSaved={isSaved}
              onDraftChange={onDraftChange}
              onQuickAction={onQuickAction}
              onSave={onSave}
            />
          );
        })}
      </div>
    </section>
  );
};

export default ImageAuditPropertyGroup;
