import { useState } from "react";
import { ImageOff, Loader2, Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import ImageVerificationBadge from "@/components/imageAudit/ImageVerificationBadge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const emptyRange = () => ({ startDate: "", endDate: "" });

const ImageUrlPreview = ({ url }) => {
  const { t } = useTranslation();
  const [status, setStatus] = useState("loading");

  if (!url?.trim()) {
    return null;
  }

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-border/60 bg-muted/30">
      {status === "loading" && (
        <div className="flex h-full items-center justify-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      )}
      {status === "error" && (
        <div className="flex h-full flex-col items-center justify-center gap-1 p-3 text-center text-xs text-muted-foreground">
          <ImageOff className="size-5" />
          {t("property.imagePreviewError")}
        </div>
      )}
      <img
        src={url}
        alt={t("property.imagePreview")}
        className={`h-full w-full object-cover ${status === "loaded" ? "block" : "hidden"}`}
        onLoad={() => setStatus("loaded")}
        onError={() => setStatus("error")}
      />
    </div>
  );
};

const PropertyForm = ({
  initialValues,
  onSubmit,
  submitLabel,
  loading = false,
  error = "",
}) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    title: initialValues?.title || "",
    description: initialValues?.description || "",
    address: initialValues?.location?.address || "",
    city: initialValues?.location?.city || "",
    country: initialValues?.location?.country || "",
    price: initialValues?.price?.toString() || "",
    imageUrls:
      initialValues?.images?.length > 0
        ? initialValues.images.map((img) => img.url)
        : [""],
    availabilityRanges:
      initialValues?.availabilityCalendar?.length > 0
        ? initialValues.availabilityCalendar.map((range) => ({
            startDate: range.startDate || "",
            endDate: range.endDate || "",
          }))
        : [emptyRange()],
  });
  const [validationError, setValidationError] = useState("");

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setValidationError("");
  };

  const updateImageUrl = (index, value) => {
    setFormData((prev) => {
      const imageUrls = [...prev.imageUrls];
      imageUrls[index] = value;
      return { ...prev, imageUrls };
    });
    setValidationError("");
  };

  const addImageUrl = () => {
    setFormData((prev) => ({
      ...prev,
      imageUrls: [...prev.imageUrls, ""],
    }));
  };

  const removeImageUrl = (index) => {
    setFormData((prev) => ({
      ...prev,
      imageUrls: prev.imageUrls.filter((_, i) => i !== index),
    }));
  };

  const updateRange = (index, field, value) => {
    setFormData((prev) => {
      const availabilityRanges = [...prev.availabilityRanges];
      availabilityRanges[index] = {
        ...availabilityRanges[index],
        [field]: value,
      };
      return { ...prev, availabilityRanges };
    });
    setValidationError("");
  };

  const addRange = () => {
    setFormData((prev) => ({
      ...prev,
      availabilityRanges: [...prev.availabilityRanges, emptyRange()],
    }));
  };

  const removeRange = (index) => {
    setFormData((prev) => ({
      ...prev,
      availabilityRanges: prev.availabilityRanges.filter((_, i) => i !== index),
    }));
  };

  const validate = () => {
    if (!formData.title.trim()) return t("property.titleRequired");
    if (!formData.description.trim()) return t("property.descriptionRequired");
    if (!formData.address.trim()) return t("property.addressRequired");
    if (!formData.city.trim()) return t("property.cityRequired");
    if (!formData.country.trim()) return t("property.countryRequired");
    if (!formData.price || Number.isNaN(Number(formData.price))) {
      return t("property.priceRequired");
    }
    if (Number(formData.price) < 0) return t("property.priceInvalid");

    for (const range of formData.availabilityRanges) {
      if (
        (range.startDate && !range.endDate) ||
        (!range.startDate && range.endDate)
      ) {
        return t("property.dateRangeIncomplete");
      }
      if (
        range.startDate &&
        range.endDate &&
        range.startDate > range.endDate
      ) {
        return t("property.dateRangeInvalid");
      }
    }

    return "";
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const errorMessage = validate();

    if (errorMessage) {
      setValidationError(errorMessage);
      return;
    }

    const payload = {
      title: formData.title.trim(),
      description: formData.description.trim(),
      location: {
        address: formData.address.trim(),
        city: formData.city.trim(),
        country: formData.country.trim(),
      },
      price: Number(formData.price),
      images: formData.imageUrls
        .map((url) => url.trim())
        .filter(Boolean)
        .map((url) => ({ url })),
      availabilityCalendar: formData.availabilityRanges.filter(
        (range) => range.startDate && range.endDate,
      ),
    };

    await onSubmit(payload);
  };

  const displayError = validationError || error;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {displayError && (
        <Alert variant="destructive">
          <AlertTitle>{t("property.validationError")}</AlertTitle>
          <AlertDescription>{displayError}</AlertDescription>
        </Alert>
      )}

      <Card className="glass-card border-border/60">
        <CardHeader>
          <CardTitle>{t("property.basicInfo")}</CardTitle>
          <CardDescription>{t("property.basicInfoHint")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">{t("property.title")}</Label>
            <Input
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder={t("property.titlePlaceholder")}
              disabled={loading}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">{t("property.description")}</Label>
            <Textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder={t("property.descriptionPlaceholder")}
              disabled={loading}
              rows={4}
              className="w-full resize-y"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="price">{t("property.price")}</Label>
            <Input
              id="price"
              name="price"
              type="number"
              min="0"
              step="1"
              value={formData.price}
              onChange={handleChange}
              placeholder="12000"
              disabled={loading}
              className="w-full"
              dir="ltr"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card border-border/60">
        <CardHeader>
          <CardTitle>{t("property.locationSection")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="address">{t("property.address")}</Label>
            <Input
              id="address"
              name="address"
              value={formData.address}
              onChange={handleChange}
              disabled={loading}
              className="w-full"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">{t("property.city")}</Label>
            <Input
              id="city"
              name="city"
              value={formData.city}
              onChange={handleChange}
              disabled={loading}
              className="w-full"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="country">{t("property.country")}</Label>
            <Input
              id="country"
              name="country"
              value={formData.country}
              onChange={handleChange}
              disabled={loading}
              className="w-full"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card border-border/60">
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{t("property.availability")}</CardTitle>
            <CardDescription>{t("property.availabilityHint")}</CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addRange}
            disabled={loading}
            className="shrink-0 whitespace-normal"
          >
            <Plus className="size-4" />
            {t("property.addDateRange")}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {formData.availabilityRanges.map((range, index) => (
            <div
              key={`range-${index}`}
              className="grid gap-3 rounded-lg border border-border/60 bg-muted/20 p-4 sm:grid-cols-[1fr_1fr_auto]"
            >
              <div className="space-y-2">
                <Label htmlFor={`start-${index}`}>{t("booking.startDate")}</Label>
                <Input
                  id={`start-${index}`}
                  type="date"
                  value={range.startDate}
                  onChange={(e) =>
                    updateRange(index, "startDate", e.target.value)
                  }
                  disabled={loading}
                  className="w-full"
                  dir="ltr"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`end-${index}`}>{t("booking.endDate")}</Label>
                <Input
                  id={`end-${index}`}
                  type="date"
                  value={range.endDate}
                  onChange={(e) =>
                    updateRange(index, "endDate", e.target.value)
                  }
                  disabled={loading}
                  className="w-full"
                  dir="ltr"
                />
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeRange(index)}
                  disabled={loading || formData.availabilityRanges.length === 1}
                  aria-label={t("property.remove")}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="glass-card border-border/60">
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{t("property.images")}</CardTitle>
            <CardDescription>{t("property.imagesHint")}</CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addImageUrl}
            disabled={loading}
            className="shrink-0 whitespace-normal"
          >
            <Plus className="size-4" />
            {t("property.addImage")}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {formData.imageUrls.map((url, index) => {
            const imageMeta = initialValues?.images?.[index];

            return (
            <div
              key={`image-${index}`}
              className="grid gap-3 rounded-lg border border-border/60 bg-muted/20 p-4 lg:grid-cols-[1fr_220px]"
            >
              <div className="flex gap-2">
                <div className="min-w-0 flex-1 space-y-2">
                  <Label htmlFor={`image-${index}`}>
                    {t("property.imageUrl")} {index + 1}
                  </Label>
                  <Input
                    id={`image-${index}`}
                    value={url}
                    onChange={(e) => updateImageUrl(index, e.target.value)}
                    placeholder="https://example.com/image.jpg"
                    disabled={loading}
                    className="w-full"
                    dir="ltr"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeImageUrl(index)}
                    disabled={loading || formData.imageUrls.length === 1}
                    aria-label={t("property.remove")}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>
              <ImageUrlPreview url={url} />
              {imageMeta?.verificationStatus && (
                <div className="flex flex-wrap items-center gap-2 lg:col-span-2">
                  <ImageVerificationBadge status={imageMeta.verificationStatus} />
                  <span className="text-xs text-muted-foreground" dir="ltr">
                    {t("imageAudit.scoreLabel")}: {(imageMeta.aiScore ?? 0).toFixed(2)}
                  </span>
                </div>
              )}
            </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button
          type="submit"
          size="lg"
          disabled={loading}
          className="w-full min-w-fit whitespace-normal sm:w-auto"
        >
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              {t("common.loading")}
            </>
          ) : (
            submitLabel
          )}
        </Button>
      </div>
    </form>
  );
};

export default PropertyForm;
