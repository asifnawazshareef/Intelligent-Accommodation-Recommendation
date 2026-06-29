import { useEffect, useMemo, useState } from "react";
import { ImageOff, Loader2, Upload, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import ImageVerificationBadge from "@/components/imageAudit/ImageVerificationBadge";
import { resolveImageUrl } from "@/lib/imageUrl";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const MAX_IMAGES = 5;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

const emptyRange = () => ({ startDate: "", endDate: "" });

const ImagePreview = ({ src, alt, onRemove, disabled }) => {
  const { t } = useTranslation();
  const [status, setStatus] = useState("loading");

  return (
    <div className="relative overflow-hidden rounded-lg border border-border/60 bg-muted/30">
      <div className="relative aspect-video w-full">
        {status === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center">
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
          src={src}
          alt={alt}
          className={`h-full w-full object-cover ${status === "loaded" ? "block" : "hidden"}`}
          onLoad={() => setStatus("loaded")}
          onError={() => setStatus("error")}
        />
      </div>
      {onRemove ? (
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="absolute end-2 top-2 size-8 rounded-full shadow-sm"
          onClick={onRemove}
          disabled={disabled}
          aria-label={t("property.removeImage")}
        >
          <X className="size-4" />
        </Button>
      ) : null}
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
  const isEdit = Boolean(initialValues?._id);

  const [formData, setFormData] = useState({
    title: initialValues?.title || "",
    description: initialValues?.description || "",
    address: initialValues?.location?.address || "",
    city: initialValues?.location?.city || "",
    country: initialValues?.location?.country || "",
    price: initialValues?.price?.toString() || "",
    availabilityRanges:
      initialValues?.availabilityCalendar?.length > 0
        ? initialValues.availabilityCalendar.map((range) => ({
            startDate: range.startDate || "",
            endDate: range.endDate || "",
          }))
        : [emptyRange()],
  });

  const [existingImages, setExistingImages] = useState(
    initialValues?.images?.map((image) => ({
      _id: image._id,
      url: image.url,
      verificationStatus: image.verificationStatus,
      aiScore: image.aiScore,
    })) || [],
  );
  const [newFiles, setNewFiles] = useState([]);
  const [validationError, setValidationError] = useState("");

  const newPreviews = useMemo(
    () => newFiles.map((file) => URL.createObjectURL(file)),
    [newFiles],
  );

  useEffect(
    () => () => {
      newPreviews.forEach((preview) => URL.revokeObjectURL(preview));
    },
    [newPreviews],
  );

  const totalImages = existingImages.length + newFiles.length;

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setValidationError("");
  };

  const validateFiles = (files) => {
    if (totalImages + files.length > MAX_IMAGES) {
      return t("property.maxImagesError", { count: MAX_IMAGES });
    }

    for (const file of files) {
      if (!ALLOWED_TYPES.has(file.type)) {
        return t("property.invalidImageType");
      }

      if (file.size > MAX_FILE_SIZE) {
        return t("property.imageTooLarge");
      }
    }

    return "";
  };

  const handleFileSelect = (event) => {
    const selected = Array.from(event.target.files || []);
    event.target.value = "";

    if (!selected.length) {
      return;
    }

    const fileError = validateFiles(selected);
    if (fileError) {
      setValidationError(fileError);
      return;
    }

    setNewFiles((prev) => [...prev, ...selected]);
    setValidationError("");
  };

  const removeExistingImage = (imageId) => {
    setExistingImages((prev) =>
      prev.filter((image) => image._id !== imageId),
    );
    setValidationError("");
  };

  const removeNewFile = (index) => {
    setNewFiles((prev) => prev.filter((_, fileIndex) => fileIndex !== index));
    setValidationError("");
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

    if (totalImages > MAX_IMAGES) {
      return t("property.maxImagesError", { count: MAX_IMAGES });
    }

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

    const payload = new FormData();
    payload.append("title", formData.title.trim());
    payload.append("description", formData.description.trim());
    payload.append("address", formData.address.trim());
    payload.append("city", formData.city.trim());
    payload.append("country", formData.country.trim());
    payload.append("price", String(Number(formData.price)));
    payload.append(
      "availabilityCalendar",
      JSON.stringify(
        formData.availabilityRanges.filter(
          (range) => range.startDate && range.endDate,
        ),
      ),
    );

    if (isEdit) {
      payload.append(
        "retainedImageIds",
        JSON.stringify(existingImages.map((image) => image._id)),
      );
    }

    newFiles.forEach((file) => {
      payload.append("images", file);
    });

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
        <CardHeader>
          <CardTitle>{t("property.availability")}</CardTitle>
          <CardDescription>{t("property.availabilityHint")}</CardDescription>
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
                  <X className="size-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addRange}
            disabled={loading}
          >
            {t("property.addDateRange")}
          </Button>
        </CardContent>
      </Card>

      <Card className="glass-card border-border/60">
        <CardHeader>
          <CardTitle>{t("property.images")}</CardTitle>
          <CardDescription>{t("property.imagesHint")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="property-images">{t("property.uploadImages")}</Label>
            <Input
              id="property-images"
              type="file"
              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              multiple
              onChange={handleFileSelect}
              disabled={loading || totalImages >= MAX_IMAGES}
              className="w-full cursor-pointer"
            />
            <p className="text-xs text-muted-foreground">
              {t("property.uploadImagesHint", { count: MAX_IMAGES })}
            </p>
          </div>

          {totalImages > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {existingImages.map((image) => (
                <div key={image._id} className="space-y-2">
                  <ImagePreview
                    src={resolveImageUrl(image.url)}
                    alt={t("property.imagePreview")}
                    onRemove={() => removeExistingImage(image._id)}
                    disabled={loading}
                  />
                  {image.verificationStatus ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <ImageVerificationBadge status={image.verificationStatus} />
                      <span className="text-xs text-muted-foreground" dir="ltr">
                        {t("imageAudit.scoreLabel")}: {(image.aiScore ?? 0).toFixed(2)}
                      </span>
                    </div>
                  ) : null}
                </div>
              ))}

              {newFiles.map((file, index) => (
                <div key={`${file.name}-${index}`} className="space-y-2">
                  <ImagePreview
                    src={newPreviews[index]}
                    alt={file.name}
                    onRemove={() => removeNewFile(index)}
                    disabled={loading}
                  />
                  <p className="truncate text-xs text-muted-foreground">{file.name}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/60 bg-muted/20 px-4 py-10 text-center">
              <Upload className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {t("property.noImagesSelected")}
              </p>
            </div>
          )}
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
              {t("property.uploading")}
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
