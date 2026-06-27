import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarRange,
  CheckCircle2,
  Loader2,
  LogIn,
  MapPin,
  Phone,
  Send,
  User,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/context/AuthContext";
import { createOfflineRequest } from "@/services/offlineRequestService";
import { getApprovedProperties } from "@/services/propertyService";
import { formatPropertyOption } from "@/lib/formatters";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const FLOW_STEPS = ["submit", "ownerReview", "viewResponse"];

const OfflineBookingPage = () => {
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const preselectedPropertyId = searchParams.get("propertyId") || "";

  const isGuest = isAuthenticated && user?.role === "guest";
  const loginPath = `/login?from=${encodeURIComponent(
    `${location.pathname}${location.search}`,
  )}`;

  const [properties, setProperties] = useState([]);
  const [loadingProperties, setLoadingProperties] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [formData, setFormData] = useState({
    guestName: user?.name || "",
    phone: user?.phone || "",
    location: "",
    startDate: "",
    endDate: "",
    roomType: "",
    property: "",
  });

  useEffect(() => {
    const fetchProperties = async () => {
      setLoadingProperties(true);

      try {
        const response = await getApprovedProperties();
        const data = response.data.data || [];
        setProperties(data);

        if (preselectedPropertyId) {
          const match = data.find(
            (property) => String(property._id) === preselectedPropertyId,
          );
          setFormData((prev) => ({
            ...prev,
            property: match ? preselectedPropertyId : "",
          }));
        }
      } catch {
        setProperties([]);
      } finally {
        setLoadingProperties(false);
      }
    };

    fetchProperties();
  }, [preselectedPropertyId]);

  useEffect(() => {
    if (user?.name) {
      setFormData((prev) => ({ ...prev, guestName: user.name }));
    }
    if (user?.phone) {
      setFormData((prev) => ({ ...prev, phone: user.phone }));
    }
  }, [user]);

  const selectedProperty = useMemo(
    () =>
      properties.find(
        (property) => String(property._id) === String(formData.property),
      ) || null,
    [properties, formData.property],
  );

  const propertySelectValue = formData.property
    ? String(formData.property)
    : "none";

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError("");
    setSuccess("");
  };

  const handlePropertyChange = (value) => {
    setFormData((prev) => ({
      ...prev,
      property: value === "none" ? "" : value,
    }));
    setError("");
    setSuccess("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!isGuest) {
      setError(t("offlinePage.loginRequired"));
      return;
    }

    if (!formData.property) {
      setError(t("offlinePage.propertyRequired"));
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      await createOfflineRequest({
        guestName: formData.guestName.trim(),
        phone: formData.phone.trim(),
        location: formData.location.trim(),
        startDate: formData.startDate,
        endDate: formData.endDate,
        roomType: formData.roomType.trim(),
        property: formData.property,
      });

      setSuccess(t("offlinePage.submitSuccess"));
      setFormData({
        guestName: user?.name || "",
        phone: user?.phone || "",
        location: "",
        startDate: "",
        endDate: "",
        roomType: "",
        property: preselectedPropertyId || formData.property,
      });
    } catch (err) {
      setError(err.response?.data?.message || t("offlinePage.submitError"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <Link
        to={
          preselectedPropertyId
            ? `/properties/${preselectedPropertyId}`
            : "/search"
        }
      >
        <Button variant="ghost" size="sm" className="whitespace-normal">
          <ArrowLeft className="size-4" />
          {preselectedPropertyId
            ? t("offlinePage.backToProperty")
            : t("propertyDetail.backToSearch")}
        </Button>
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {t("offline.contactOwner")}
        </h1>
        <p className="mt-1 text-muted-foreground">{t("offlinePage.formHint")}</p>
      </div>

      <Card className="glass-card border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("offlinePage.flowTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="grid gap-3 sm:grid-cols-3">
            {FLOW_STEPS.map((step, index) => (
              <li
                key={step}
                className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/20 p-3 text-sm"
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {index + 1}
                </span>
                <span>{t(`offlinePage.flow.${step}`)}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {!isGuest && (
        <Alert>
          <LogIn className="size-4" />
          <AlertTitle>{t("offlinePage.loginRequiredTitle")}</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>{t("offlinePage.loginRequiredHint")}</p>
            <Button size="sm" asChild>
              <Link to={loginPath}>{t("common.signIn")}</Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTitle>{t("offlinePage.errorTitle")}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <CheckCircle2 className="size-4" />
          <AlertTitle>{t("offlinePage.successTitle")}</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>{success}</p>
            <Button variant="link" size="sm" className="h-auto p-0" asChild>
              <Link to="/guest/offline-requests">
                {t("offlinePage.trackRequests")}
              </Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {selectedProperty && (
        <Alert>
          <AlertDescription>
            {t("offlinePage.selectedPropertyHint", {
              property: formatPropertyOption(selectedProperty),
            })}
          </AlertDescription>
        </Alert>
      )}

      <Card className="glass-card border-border/60">
        <CardHeader>
          <CardTitle>{t("offlinePage.formTitle")}</CardTitle>
          <CardDescription>{t("offlinePage.formDescription")}</CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="guestName" className="flex items-center gap-1.5">
                  <User className="size-4" />
                  {t("offlinePage.guestName")}
                </Label>
                <Input
                  id="guestName"
                  name="guestName"
                  value={formData.guestName}
                  onChange={handleChange}
                  required
                  disabled={submitting || !isGuest}
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone" className="flex items-center gap-1.5">
                  <Phone className="size-4" />
                  {t("offlinePage.phone")}
                </Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                  disabled={submitting || !isGuest}
                  className="w-full"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location" className="flex items-center gap-1.5">
                <MapPin className="size-4" />
                {t("offlinePage.preferredLocation")}
              </Label>
              <Input
                id="location"
                name="location"
                value={formData.location}
                onChange={handleChange}
                placeholder={t("offlinePage.locationPlaceholder")}
                required
                disabled={submitting || !isGuest}
                className="w-full"
              />
            </div>

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
                  disabled={submitting || !isGuest}
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
                  disabled={submitting || !isGuest}
                  className="w-full"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="roomType">{t("offline.roomType")}</Label>
              <Input
                id="roomType"
                name="roomType"
                value={formData.roomType}
                onChange={handleChange}
                placeholder={t("offlinePage.roomTypePlaceholder")}
                required
                disabled={submitting || !isGuest}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label>{t("offlinePage.selectProperty")}</Label>
              <Select
                value={propertySelectValue}
                onValueChange={handlePropertyChange}
                disabled={submitting || loadingProperties || !isGuest}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("offlinePage.propertyOptional")}>
                    {loadingProperties ? (
                      t("common.loading")
                    ) : propertySelectValue === "none" ? (
                      t("offlinePage.noProperty")
                    ) : selectedProperty ? (
                      formatPropertyOption(selectedProperty)
                    ) : null}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    value="none"
                    label={t("offlinePage.noProperty")}
                  >
                    {t("offlinePage.noProperty")}
                  </SelectItem>
                  {properties.map((property) => {
                    const propertyId = String(property._id);
                    const label = formatPropertyOption(property);

                    return (
                      <SelectItem
                        key={propertyId}
                        value={propertyId}
                        label={label}
                      >
                        {label}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {t("offlinePage.propertyHint")}
              </p>
            </div>
          </CardContent>

          <CardFooter className="border-t border-border/60 pt-4">
            <Button
              type="submit"
              size="lg"
              disabled={submitting || loadingProperties || !isGuest}
              className="w-full whitespace-normal sm:w-auto"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {t("offlinePage.submitting")}
                </>
              ) : (
                <>
                  <Send className="size-4" />
                  {t("offline.submitRequest")}
                </>
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>

      <Card className="glass-card border-dashed border-border/60">
        <CardContent className="flex items-start gap-3 py-5 text-sm text-muted-foreground">
          <CalendarRange className="mt-0.5 size-4 shrink-0" />
          <p>{t("offlinePage.noSmsNote")}</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default OfflineBookingPage;
