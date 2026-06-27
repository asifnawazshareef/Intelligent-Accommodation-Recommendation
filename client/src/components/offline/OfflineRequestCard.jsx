import { Link } from "react-router-dom";
import {
  CalendarRange,
  Clock,
  ExternalLink,
  MapPin,
  Phone,
  Ticket,
  User,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import OfflineRequestStatusBadge from "@/components/offline/OfflineRequestStatusBadge";
import { buttonVariants } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";

const DetailItem = ({ label, children, className = "" }) => (
  <div className={cn("min-w-0", className)}>
    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {label}
    </dt>
    <dd className="mt-0.5 break-words font-medium text-foreground">{children}</dd>
  </div>
);

const CardActionLink = ({ to, variant = "default", className, children }) => (
  <Link
    to={to}
    className={cn(
      buttonVariants({ variant, size: "default" }),
      "inline-flex w-full flex-row items-center justify-center gap-2 no-underline",
      className,
    )}
  >
    {children}
  </Link>
);

const OfflineRequestCard = ({
  request,
  variant = "guest",
  footer = null,
  successMessage = null,
}) => {
  const { t, i18n } = useTranslation();
  const hasResponse =
    request.responseMessage?.trim() &&
    (request.status === "responded" || request.status === "closed");

  const canProceedToBooking =
    variant === "guest" &&
    request.status === "responded" &&
    request.property?._id;

  return (
    <Card className="glass-card flex flex-col overflow-hidden border-border/60">
      <CardHeader className="space-y-3 pb-3">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="line-clamp-2 min-w-0 flex-1 text-base leading-snug sm:text-lg">
            {request.property?.title || t("offlinePage.generalRequest")}
          </CardTitle>
          <OfflineRequestStatusBadge
            status={request.status}
            className="shrink-0"
          />
        </div>

        <div className="flex flex-col gap-1.5 text-sm text-muted-foreground">
          {request.property?.location && (
            <CardDescription className="flex items-start gap-1.5">
              <MapPin className="mt-0.5 size-3.5 shrink-0" />
              <span className="line-clamp-2">
                {request.property.location.city},{" "}
                {request.property.location.country}
              </span>
            </CardDescription>
          )}
          {request.createdAt && (
            <CardDescription dir="ltr" className="text-xs">
              {t("offlinePage.submittedAt", {
                date: formatDate(request.createdAt, i18n.language),
              })}
            </CardDescription>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4 pb-5 pt-0 text-sm">
        {variant === "owner" && (
          <div className="grid gap-3 rounded-lg border border-border/50 bg-muted/25 p-3 sm:grid-cols-2">
            <p className="flex min-w-0 items-center gap-2">
              <User className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate font-medium">{request.guestName}</span>
            </p>
            <p className="flex items-center gap-2" dir="ltr">
              <Phone className="size-4 shrink-0 text-muted-foreground" />
              <span className="font-medium">{request.phone}</span>
            </p>
          </div>
        )}

        <div className="space-y-3 rounded-lg border border-border/50 bg-muted/20 p-3 sm:p-4">
          <p className="flex items-start gap-2">
            <CalendarRange className="mt-0.5 size-4 shrink-0 text-primary" />
            <span dir="ltr" className="font-medium">
              {formatDate(request.startDate, i18n.language)} –{" "}
              {formatDate(request.endDate, i18n.language)}
            </span>
          </p>

          <dl className="grid gap-3 border-t border-border/40 pt-3 sm:grid-cols-2">
            <DetailItem label={t("offline.roomType")}>{request.roomType}</DetailItem>
            <DetailItem label={t("offlinePage.preferredLocation")}>
              {request.location}
            </DetailItem>
          </dl>
        </div>

        <div className="space-y-3">
          {variant === "guest" && request.status === "pending" && (
            <div className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
              <div className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-500/15">
                  <Clock className="size-4 text-amber-700 dark:text-amber-400" />
                </div>
                <div className="min-w-0 space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
                    {t("offlinePage.awaitingOwnerResponse")}
                  </p>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {t("offlinePage.guestPendingHint")}
                  </p>
                </div>
              </div>
              {request.property?._id && (
                <CardActionLink
                  to={`/properties/${request.property._id}`}
                  variant="outline"
                >
                  <ExternalLink className="size-4 shrink-0" />
                  <span>{t("offlinePage.viewProperty")}</span>
                </CardActionLink>
              )}
            </div>
          )}

          {hasResponse && (
            <div
              className={cn(
                "rounded-lg border p-3 sm:p-4",
                variant === "guest"
                  ? "border-emerald-500/30 bg-emerald-500/5"
                  : "border-border/60 bg-muted/20",
              )}
            >
              <p
                className={cn(
                  "text-xs font-semibold uppercase tracking-wide",
                  variant === "guest"
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-muted-foreground",
                )}
              >
                {t("offlinePage.ownerResponseTitle")}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-foreground">
                {request.responseMessage}
              </p>
            </div>
          )}

          {variant === "guest" &&
            request.status === "closed" &&
            !request.responseMessage?.trim() && (
              <p className="rounded-lg border border-border/50 bg-muted/20 p-3 text-sm text-muted-foreground">
                {t("offlinePage.guestClosedHint")}
              </p>
            )}

          {successMessage && (
            <Alert>
              <AlertDescription>{successMessage}</AlertDescription>
            </Alert>
          )}

          {canProceedToBooking && (
            <div className="space-y-3 rounded-lg border border-primary/25 bg-primary/5 p-4">
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t("offlinePage.proceedToBookingHint")}
              </p>
              <div className="flex flex-col gap-2">
                <CardActionLink to={`/bookings/new/${request.property._id}`}>
                  <Ticket className="size-4 shrink-0" />
                  <span>{t("offlinePage.proceedToBooking")}</span>
                </CardActionLink>
                <CardActionLink
                  to={`/properties/${request.property._id}`}
                  variant="outline"
                >
                  <ExternalLink className="size-4 shrink-0" />
                  <span>{t("offlinePage.viewProperty")}</span>
                </CardActionLink>
              </div>
            </div>
          )}

          {variant === "guest" &&
            request.property?._id &&
            !canProceedToBooking &&
            request.status !== "pending" && (
              <CardActionLink
                to={`/properties/${request.property._id}`}
                variant="outline"
                className="sm:w-auto"
              >
                <ExternalLink className="size-4 shrink-0" />
                <span>{t("offlinePage.viewProperty")}</span>
              </CardActionLink>
            )}
        </div>
      </CardContent>

      {footer ? (
        <div className="border-t border-border/60 bg-muted/10 p-4 sm:p-5">
          {footer}
        </div>
      ) : null}
    </Card>
  );
};

export default OfflineRequestCard;
