import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2,
  CalendarRange,
  CheckCircle2,
  Eye,
  ImageOff,
  Loader2,
  MapPin,
  RefreshCw,
  User,
  XCircle,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/layout/DashboardLayout";
import ImageVerificationBadge from "@/components/imageAudit/ImageVerificationBadge";
import PropertyStatusBadge from "@/components/properties/PropertyStatusBadge";
import {
  approveListing,
  getPendingListings,
  rejectListing,
} from "@/services/listingModerationService";
import { Button } from "@/components/ui/button";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const formatDate = (value) => {
  if (!value) return "—";
  return new Date(value).toLocaleDateString();
};

const ListingImagePreview = ({ url, alt }) => {
  const { t } = useTranslation();
  const [status, setStatus] = useState("loading");

  return (
    <div className="relative aspect-video overflow-hidden rounded-lg border border-border/60 bg-muted/30">
      {status === "loading" && (
        <div className="flex h-full min-h-24 items-center justify-center">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </div>
      )}
      {status === "error" && (
        <div className="flex h-full min-h-24 flex-col items-center justify-center gap-1 p-2 text-center text-xs text-muted-foreground">
          <ImageOff className="size-4" />
          {t("listingModeration.previewError")}
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

const ListingDetailPanel = ({ listing, onApprove, onReject, actionId }) => {
  const { t } = useTranslation();
  const isBusy = actionId === listing._id;

  return (
    <Card className="glass-card h-fit lg:sticky lg:top-24">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CardTitle className="text-lg">{listing.title}</CardTitle>
          <PropertyStatusBadge status={listing.status} />
        </div>
        <CardDescription className="flex items-center gap-1.5">
          <User className="size-3.5 shrink-0" />
          {listing.owner?.name || t("listingModeration.unknownOwner")}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("property.description")}
          </p>
          <p className="text-sm leading-relaxed">{listing.description}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("property.locationSection")}
            </p>
            <p className="flex items-start gap-1.5 text-sm">
              <MapPin className="mt-0.5 size-3.5 shrink-0" />
              <span>
                {listing.location?.address}
                <br />
                {listing.location?.city}, {listing.location?.country}
              </span>
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("property.price")}
            </p>
            <p className="text-lg font-semibold text-primary" dir="ltr">
              {listing.price?.toLocaleString()} PKR
            </p>
          </div>
        </div>

        {listing.availabilityCalendar?.length > 0 && (
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <CalendarRange className="size-3.5" />
              {t("property.availability")}
            </p>
            <div className="flex flex-wrap gap-2">
              {listing.availabilityCalendar.map((range, index) => (
                <Badge key={`${range.startDate}-${index}`} variant="outline">
                  {formatDate(range.startDate)} – {formatDate(range.endDate)}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("listingModeration.imageVerification")}
          </p>
          {listing.images?.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {listing.images.map((image, index) => (
                <div key={image._id || index} className="space-y-2">
                  <ListingImagePreview
                    url={image.url}
                    alt={`${listing.title} ${index + 1}`}
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <ImageVerificationBadge status={image.verificationStatus} />
                    <span className="text-xs text-muted-foreground" dir="ltr">
                      {t("imageAudit.aiScore")}: {(image.aiScore ?? 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("listingModeration.noImages")}
            </p>
          )}
        </div>
      </CardContent>

      <CardFooter className="flex flex-col gap-2 border-t border-border/60 sm:flex-row">
        <Button
          className="w-full whitespace-normal sm:flex-1"
          disabled={isBusy}
          onClick={() => onApprove(listing._id)}
        >
          {isBusy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <CheckCircle2 className="size-4" />
          )}
          {t("admin.approveListing")}
        </Button>
        <Button
          variant="destructive"
          className="w-full whitespace-normal sm:flex-1"
          disabled={isBusy}
          onClick={() => onReject(listing._id)}
        >
          {isBusy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <XCircle className="size-4" />
          )}
          {t("admin.rejectListing")}
        </Button>
      </CardFooter>
    </Card>
  );
};

const TableSkeleton = () => (
  <div className="space-y-2">
    {[1, 2, 3].map((row) => (
      <Skeleton key={row} className="h-12 w-full" />
    ))}
  </div>
);

const AdminListingsPage = () => {
  const { t } = useTranslation();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [actionId, setActionId] = useState("");

  const fetchListings = useCallback(async () => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await getPendingListings();
      const data = response.data.data || [];
      setListings(data);
      setSelectedId((prev) => {
        if (prev && data.some((item) => item._id === prev)) return prev;
        return data[0]?._id || "";
      });
    } catch (err) {
      setError(err.response?.data?.message || t("listingModeration.loadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  const selectedListing = useMemo(
    () => listings.find((item) => item._id === selectedId) || null,
    [listings, selectedId],
  );

  const handleApprove = async (id) => {
    setActionId(id);
    setError("");
    setSuccess("");

    try {
      await approveListing(id);
      setListings((prev) => {
        const next = prev.filter((item) => item._id !== id);
        setSelectedId((current) =>
          current === id ? next[0]?._id || "" : current,
        );
        return next;
      });
      setSuccess(t("listingModeration.approveSuccess"));
    } catch (err) {
      setError(err.response?.data?.message || t("listingModeration.actionError"));
    } finally {
      setActionId("");
    }
  };

  const handleReject = async (id) => {
    setActionId(id);
    setError("");
    setSuccess("");

    try {
      await rejectListing(id);
      setListings((prev) => {
        const next = prev.filter((item) => item._id !== id);
        setSelectedId((current) =>
          current === id ? next[0]?._id || "" : current,
        );
        return next;
      });
      setSuccess(t("listingModeration.rejectSuccess"));
    } catch (err) {
      setError(err.response?.data?.message || t("listingModeration.actionError"));
    } finally {
      setActionId("");
    }
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {t("admin.moderateListings")}
            </h1>
            <p className="mt-1 max-w-2xl text-muted-foreground">
              {t("listingModeration.pageHint")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="whitespace-normal">
              {t("listingModeration.pendingCount", { count: listings.length })}
            </Badge>
            <Button
              variant="outline"
              onClick={fetchListings}
              disabled={loading}
              className="w-full min-w-fit whitespace-normal sm:w-auto"
            >
              <RefreshCw className={cn("size-4", loading && "animate-spin")} />
              {t("listingModeration.refresh")}
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>{t("listingModeration.errorTitle")}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert>
            <AlertTitle>{t("listingModeration.successTitle")}</AlertTitle>
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {loading && (
          <div className="space-y-4">
            <TableSkeleton />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        )}

        {!loading && listings.length === 0 && (
          <Card className="glass-card border-dashed">
            <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <Building2 className="size-10 text-muted-foreground/50" />
              <div className="max-w-md space-y-1">
                <h2 className="text-lg font-semibold">
                  {t("listingModeration.emptyTitle")}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {t("listingModeration.emptyHint")}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {!loading && listings.length > 0 && (
          <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
            <div className="space-y-4">
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("property.title")}</TableHead>
                      <TableHead>{t("listingModeration.owner")}</TableHead>
                      <TableHead>{t("property.city")}</TableHead>
                      <TableHead>{t("property.price")}</TableHead>
                      <TableHead>{t("property.images")}</TableHead>
                      <TableHead className="text-end">
                        {t("listingModeration.actions")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {listings.map((listing) => {
                      const isSelected = selectedId === listing._id;
                      const isBusy = actionId === listing._id;

                      return (
                        <TableRow
                          key={listing._id}
                          data-state={isSelected ? "selected" : undefined}
                          className="cursor-pointer"
                          onClick={() => setSelectedId(listing._id)}
                        >
                          <TableCell className="max-w-[180px] font-medium">
                            <span className="line-clamp-2 whitespace-normal">
                              {listing.title}
                            </span>
                          </TableCell>
                          <TableCell>{listing.owner?.name || "—"}</TableCell>
                          <TableCell>{listing.location?.city || "—"}</TableCell>
                          <TableCell dir="ltr">
                            {listing.price?.toLocaleString()} PKR
                          </TableCell>
                          <TableCell>{listing.images?.length || 0}</TableCell>
                          <TableCell>
                            <div
                              className="flex justify-end gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Button
                                size="icon-sm"
                                variant={isSelected ? "default" : "outline"}
                                onClick={() => setSelectedId(listing._id)}
                                aria-label={t("listingModeration.viewDetails")}
                              >
                                <Eye className="size-4" />
                              </Button>
                              <Button
                                size="icon-sm"
                                variant="outline"
                                disabled={isBusy}
                                onClick={() => handleApprove(listing._id)}
                                aria-label={t("admin.approveListing")}
                              >
                                {isBusy ? (
                                  <Loader2 className="size-4 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="size-4 text-emerald-600" />
                                )}
                              </Button>
                              <Button
                                size="icon-sm"
                                variant="outline"
                                disabled={isBusy}
                                onClick={() => handleReject(listing._id)}
                                aria-label={t("admin.rejectListing")}
                              >
                                <XCircle className="size-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="grid gap-3 md:hidden">
                {listings.map((listing) => {
                  const isSelected = selectedId === listing._id;
                  const isBusy = actionId === listing._id;
                  const coverUrl = listing.images?.[0]?.url;

                  return (
                    <Card
                      key={listing._id}
                      className={cn(
                        "glass-card cursor-pointer overflow-hidden transition-shadow",
                        isSelected && "ring-2 ring-primary/40",
                      )}
                      onClick={() => setSelectedId(listing._id)}
                    >
                      <div className="flex gap-3 p-3">
                        <div className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-muted/40">
                          {coverUrl ? (
                            <img
                              src={coverUrl}
                              alt={listing.title}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center">
                              <Building2 className="size-6 text-muted-foreground/40" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 font-medium">{listing.title}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {listing.owner?.name}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-primary" dir="ltr">
                            {listing.price?.toLocaleString()} PKR
                          </p>
                        </div>
                      </div>
                      <CardFooter
                        className="flex gap-2 border-t border-border/60 p-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          size="sm"
                          className="flex-1 whitespace-normal"
                          disabled={isBusy}
                          onClick={() => handleApprove(listing._id)}
                        >
                          <CheckCircle2 className="size-4" />
                          {t("admin.approveListing")}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="flex-1 whitespace-normal"
                          disabled={isBusy}
                          onClick={() => handleReject(listing._id)}
                        >
                          <XCircle className="size-4" />
                          {t("admin.rejectListing")}
                        </Button>
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>
            </div>

            {selectedListing ? (
              <ListingDetailPanel
                listing={selectedListing}
                onApprove={handleApprove}
                onReject={handleReject}
                actionId={actionId}
              />
            ) : (
              <Card className="glass-card border-dashed">
                <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                  <Eye className="size-8 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">
                    {t("listingModeration.selectListing")}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminListingsPage;
