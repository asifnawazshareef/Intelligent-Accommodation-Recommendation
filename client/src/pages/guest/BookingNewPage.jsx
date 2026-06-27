import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CalendarRange,
  Loader2,
  MapPin,
  Users,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PageLoader from "@/components/layout/PageLoader";
import PropertyCoverImage from "@/components/properties/PropertyCoverImage";
import { formatDate, formatPrice } from "@/lib/formatters";
import { getPropertyById } from "@/services/propertyService";
import { createBooking } from "@/services/bookingService";
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
import { cn } from "@/lib/utils";

const todayInputValue = () => new Date().toISOString().split("T")[0];

const countNights = (startDate, endDate) => {
  if (!startDate || !endDate) return 0;
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const nights = Math.round((end - start) / (1000 * 60 * 60 * 24));
  return nights > 0 ? nights : 0;
};

const BookingStepIndicator = ({ currentStep, t }) => {
  const steps = [
    { id: 1, label: t("bookingPage.stepDates") },
    { id: 2, label: t("bookingPage.stepPayment") },
  ];

  return (
    <ol className="flex flex-wrap items-center gap-2 sm:gap-3">
      {steps.map((step, index) => {
        const isActive = step.id === currentStep;
        const isComplete = step.id < currentStep;

        return (
          <li key={step.id} className="flex items-center gap-2 sm:gap-3">
            <span
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium sm:text-sm",
                isActive && "bg-primary/15 text-primary",
                isComplete && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
                !isActive && !isComplete && "bg-muted text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full text-[0.65rem] font-bold",
                  isActive && "bg-primary text-primary-foreground",
                  isComplete && "bg-emerald-600 text-white",
                  !isActive && !isComplete && "bg-muted-foreground/20 text-muted-foreground",
                )}
              >
                {step.id}
              </span>
              {step.label}
            </span>
            {index < steps.length - 1 && (
              <span
                className="hidden h-px w-6 bg-border sm:block"
                aria-hidden="true"
              />
            )}
          </li>
        );
      })}
    </ol>
  );
};

const BookingNewPage = () => {
  const { t, i18n } = useTranslation();
  const { propertyId } = useParams();
  const navigate = useNavigate();
  const minDate = todayInputValue();

  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    startDate: "",
    endDate: "",
    guests: "1",
  });

  useEffect(() => {
    const fetchProperty = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await getPropertyById(propertyId);
        const data = response.data.data;

        if (data.status !== "approved") {
          setError(t("bookingPage.propertyNotApproved"));
          setProperty(null);
          return;
        }

        setProperty(data);
      } catch (err) {
        setError(err.response?.data?.message || t("bookingPage.loadPropertyError"));
      } finally {
        setLoading(false);
      }
    };

    fetchProperty();
  }, [propertyId, t]);

  const nights = useMemo(
    () => countNights(formData.startDate, formData.endDate),
    [formData.startDate, formData.endDate],
  );

  const hasInvalidDates =
    formData.startDate &&
    formData.endDate &&
    nights === 0;

  const estimatedTotal =
    nights > 0 && property?.price != null ? property.price : null;

  const coverUrl = property?.images?.[0]?.url;

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => {
      const next = { ...prev, [name]: value };

      if (name === "startDate" && next.endDate && value >= next.endDate) {
        next.endDate = "";
      }

      return next;
    });
    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (hasInvalidDates) {
      setError(t("bookingPage.invalidDates"));
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const response = await createBooking({
        property: propertyId,
        startDate: formData.startDate,
        endDate: formData.endDate,
        guests: Number(formData.guests),
      });

      const bookingId = response.data.data._id;
      navigate(`/bookings/payment/${bookingId}`, { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || t("bookingPage.createError"));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <PageLoader message={t("bookingPage.loadingProperty")} />
      </DashboardLayout>
    );
  }

  if (!property) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-lg space-y-4 px-1 py-4 sm:px-0 sm:py-8">
          <Alert variant="destructive">
            <AlertTitle>{t("bookingPage.errorTitle")}</AlertTitle>
            <AlertDescription>{error || t("bookingPage.propertyNotFound")}</AlertDescription>
          </Alert>
          <Link
            to="/search"
            className={cn(
              "inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted",
            )}
          >
            <ArrowLeft className="size-4 shrink-0" />
            {t("propertyDetail.backToSearch")}
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-5xl space-y-5 px-1 sm:space-y-6 sm:px-0">
        <div className="space-y-4">
          <Link
            to={`/properties/${propertyId}`}
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4 shrink-0" />
            {t("bookingPage.backToProperty")}
          </Link>

          <div className="space-y-3">
            <BookingStepIndicator currentStep={1} t={t} />
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                {t("bookingPage.newTitle")}
              </h1>
              <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                {t("bookingPage.newHint")}
              </p>
            </div>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>{t("bookingPage.errorTitle")}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid items-start gap-6 lg:grid-cols-5 lg:gap-8">
          <Card className="glass-card border-border/60 lg:col-span-3">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <CalendarRange className="size-5 shrink-0 text-primary" />
                {t("bookingPage.tripDetails")}
              </CardTitle>
              <CardDescription>{t("bookingPage.tripDetailsHint")}</CardDescription>
            </CardHeader>

            <form onSubmit={handleSubmit} className="flex flex-col">
              <CardContent className="space-y-5 pt-0">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">{t("booking.startDate")}</Label>
                    <Input
                      id="startDate"
                      name="startDate"
                      type="date"
                      value={formData.startDate}
                      onChange={handleChange}
                      min={minDate}
                      required
                      disabled={submitting}
                      className="h-10 bg-background/80"
                      dir="ltr"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="endDate">{t("booking.endDate")}</Label>
                    <Input
                      id="endDate"
                      name="endDate"
                      type="date"
                      value={formData.endDate}
                      onChange={handleChange}
                      min={formData.startDate || minDate}
                      required
                      disabled={submitting || !formData.startDate}
                      className="h-10 bg-background/80"
                      dir="ltr"
                    />
                  </div>

                  <div className="space-y-2 sm:col-span-2 lg:col-span-1">
                    <Label htmlFor="guests">{t("booking.guests")}</Label>
                    <Input
                      id="guests"
                      name="guests"
                      type="number"
                      min="1"
                      max="20"
                      value={formData.guests}
                      onChange={handleChange}
                      required
                      disabled={submitting}
                      className="h-10 bg-background/80"
                      dir="ltr"
                    />
                  </div>
                </div>

                {hasInvalidDates && (
                  <p className="text-sm text-destructive" role="alert">
                    {t("bookingPage.invalidDates")}
                  </p>
                )}

                {formData.startDate && formData.endDate && nights > 0 && (
                  <div className="rounded-lg border border-border/50 bg-muted/20 p-4 lg:hidden">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {t("bookingPage.staySummary")}
                    </p>
                    <p className="mt-2 text-sm" dir="ltr">
                      {formatDate(formData.startDate, i18n.language)} –{" "}
                      {formatDate(formData.endDate, i18n.language)}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t("bookingPage.nightsCount", { count: nights })} ·{" "}
                      {t("bookingPage.guestCount", { count: Number(formData.guests) })}
                    </p>
                  </div>
                )}
              </CardContent>

              <CardFooter className="flex flex-col gap-3 border-t border-border/60 bg-muted/10 px-6 py-5">
                <Button
                  type="submit"
                  size="lg"
                  disabled={submitting || hasInvalidDates}
                  className="h-11 w-full gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="size-4 shrink-0 animate-spin" />
                      {t("bookingPage.submitting")}
                    </>
                  ) : (
                    <>
                      {t("bookingPage.submitBooking")}
                      <ArrowRight className="size-4 shrink-0" />
                    </>
                  )}
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  {t("bookingPage.submitFootnote")}
                </p>
              </CardFooter>
            </form>
          </Card>

          <div className="space-y-4 lg:col-span-2">
            <Card className="glass-card overflow-hidden border-border/60 lg:sticky lg:top-24">
              <PropertyCoverImage
                src={coverUrl}
                alt={property.title}
                className="aspect-[16/10] rounded-none border-0"
              />

              <CardHeader className="space-y-2 pb-3">
                <CardTitle className="line-clamp-2 text-lg leading-snug">
                  {property.title}
                </CardTitle>
                {property.location && (
                  <CardDescription className="flex items-start gap-1.5">
                    <MapPin className="mt-0.5 size-3.5 shrink-0" />
                    <span>
                      {property.location.city}, {property.location.country}
                    </span>
                  </CardDescription>
                )}
              </CardHeader>

              <CardContent className="space-y-4 pt-0">
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t("bookingPage.pricePerStay")}
                  </p>
                  <p className="mt-1 text-2xl font-bold text-primary" dir="ltr">
                    {formatPrice(property.price, t("common.currency"))}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("bookingPage.pricePerStay")}
                  </p>
                </div>

                <div className="space-y-3 rounded-lg border border-border/50 bg-muted/15 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t("bookingPage.staySummary")}
                  </p>

                  {formData.startDate && formData.endDate && nights > 0 ? (
                    <div className="space-y-2 text-sm">
                      <p dir="ltr">
                        {formatDate(formData.startDate, i18n.language)} –{" "}
                        {formatDate(formData.endDate, i18n.language)}
                      </p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarRange className="size-3.5 shrink-0" />
                          {t("bookingPage.nightsCount", { count: nights })}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Users className="size-3.5 shrink-0" />
                          {t("bookingPage.guestCount", {
                            count: Number(formData.guests),
                          })}
                        </span>
                      </div>
                      {estimatedTotal !== null && (
                        <div className="border-t border-border/40 pt-3">
                          <p className="text-xs text-muted-foreground">
                            {t("bookingPage.amountDue")}
                          </p>
                          <p className="text-lg font-semibold text-foreground" dir="ltr">
                            {formatPrice(estimatedTotal, t("common.currency"))}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {t("bookingPage.selectDatesHint")}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default BookingNewPage;
