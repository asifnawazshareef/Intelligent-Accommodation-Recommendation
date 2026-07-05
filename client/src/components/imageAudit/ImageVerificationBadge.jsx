import {
  AlertTriangle,
  BadgeCheck,
  Clock,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusConfig = {
  pending: {
    icon: Clock,
    labelKey: "imageAudit.statusPending",
    defaultStyle:
      "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/25",
    overlayStyle:
      "border-amber-400/35 bg-black/55 text-white backdrop-blur-md",
    iconWrap: "bg-amber-500 text-white",
  },
  verified: {
    icon: BadgeCheck,
    labelKey: "imageAudit.verifiedPhoto",
    shortLabelKey: "imageAudit.verifiedShort",
    defaultStyle:
      "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/25",
    overlayStyle:
      "border-emerald-400/45 bg-black/55 text-white shadow-lg shadow-black/20 backdrop-blur-md",
    iconWrap: "bg-emerald-500 text-white ring-2 ring-emerald-400/50",
  },
  suspicious: {
    icon: AlertTriangle,
    labelKey: "admin.suspicious",
    defaultStyle:
      "bg-orange-500/15 text-orange-800 dark:text-orange-300 border-orange-500/25",
    overlayStyle:
      "border-orange-400/35 bg-black/55 text-white backdrop-blur-md",
    iconWrap: "bg-orange-500 text-white",
  },
  rejected: {
    icon: XCircle,
    labelKey: "property.rejected",
    defaultStyle: "bg-destructive/15 text-destructive border-destructive/25",
    overlayStyle:
      "border-red-400/35 bg-black/55 text-white backdrop-blur-md",
    iconWrap: "bg-destructive text-white",
  },
};

const ImageVerificationBadge = ({
  status,
  className = "",
  variant = "default",
  compact = false,
  showLabel = true,
}) => {
  const { t } = useTranslation();
  const config = statusConfig[status];

  if (!config) {
    return null;
  }

  const Icon = config.icon;
  const label = compact
    ? t(config.shortLabelKey || config.labelKey, status)
    : t(config.labelKey, status);

  if (variant === "overlay") {
    const titleText =
      status === "verified" ? t("imageAudit.verifiedPhotoHint") : undefined;

    return (
      // <span
      //   className={cn(
      //     "inline-flex max-w-[calc(100%-0.5rem)] items-center gap-1.5 rounded-full border px-2 py-1",
      //     config.overlayStyle,
      //     className,
      //   )}
      //   title={titleText}
      // >
      //   <span
      //     className={cn(
      //       "flex size-5 shrink-0 items-center justify-center rounded-full",
      //       config.iconWrap,
      //     )}
      //   >
      //     <Icon className="size-3.5" strokeWidth={2.5} />
      //   </span>
      //   {showLabel && (
      //     <span className="truncate text-[11px] font-semibold leading-none tracking-wide sm:text-xs">
      //       {label}
      //     </span>
      //   )}
      // </span>
      <span></span>
    );
  }

  if (variant === "pill") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
          config.defaultStyle,
          className,
        )}
      >
        <Icon className="size-3.5 shrink-0" />
        {showLabel && <span>{label}</span>}
      </span>
    );
  }

  return (
    <Badge
      variant="secondary"
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-normal border capitalize",
        config.defaultStyle,
        className,
      )}
    >
      <Icon className="size-3.5 shrink-0" />
      {showLabel && t(config.labelKey, status)}
    </Badge>
  );
};

export default ImageVerificationBadge;
