import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CalendarRange, Loader2, MapPin, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PageLoader from "@/components/layout/PageLoader";
import { formatPrice } from "@/lib/formatters";
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

const BookingNewPage = () => {
  const { t } = useTranslation();
  const { propertyId } = useParams();
  const navigate = useNavigate();

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

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
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
        <div className="mx-auto max-w-lg space-y-4 px-4 py-8">
          <Alert variant="destructive">
            <AlertTitle>{t("bookingPage.errorTitle")}</AlertTitle>
            <AlertDescription>{error || t("bookingPage.propertyNotFound")}</AlertDescription>
          </Alert>
          <Link to="/search">
            <Button variant="outline">
              <ArrowLeft className="size-4" />
              {t("propertyDetail.backToSearch")}
            </Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-2xl space-y-6">
        <Link to={`/properties/${propertyId}`}>
          <Button variant="ghost" size="sm" className="whitespace-normal">
            <ArrowLeft className="size-4" />
            {t("bookingPage.backToProperty")}
          </Button>
        </Link>

        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {t("bookingPage.newTitle")}
          </h1>
          <p className="mt-1 text-muted-foreground">{t("bookingPage.newHint")}</p>
        </div>

        <Card className="glass-card border-border/60">
          <CardHeader>
            <CardTitle>{property.title}</CardTitle>
            <CardDescription className="flex items-center gap-1">
              <MapPin className="size-3.5 shrink-0" />
              {property.location?.city}, {property.location?.country}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary" dir="ltr">
              {formatPrice(property.price, t("common.currency"))}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("bookingPage.pricePerStay")}
            </p>
          </CardContent>
        </Card>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>{t("bookingPage.errorTitle")}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card className="glass-card border-border/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarRange className="size-5" />
              {t("bookingPage.tripDetails")}
            </CardTitle>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="startDate">{t("booking.startDate")}</Label>
                  <Input
                    id="startDate"
                    name="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={handleChange}
                    required
                    disabled={submitting}
                    className="w-full"
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
                    required
                    disabled={submitting}
                    className="w-full"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="guests" className="flex items-center gap-1.5">
                  <Users className="size-4" />
                  {t("booking.guests")}
                </Label>
                <Input
                  id="guests"
                  name="guests"
                  type="number"
                  min="1"
                  value={formData.guests}
                  onChange={handleChange}
                  required
                  disabled={submitting}
                  className="w-full max-w-xs"
                  dir="ltr"
                />
              </div>
            </CardContent>

            <CardFooter className="border-t border-border/60 pt-4">
              <Button
                type="submit"
                size="lg"
                disabled={submitting}
                className="w-full whitespace-normal sm:w-auto"
              >
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    {t("bookingPage.submitting")}
                  </>
                ) : (
                  t("bookingPage.submitBooking")
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default BookingNewPage;
