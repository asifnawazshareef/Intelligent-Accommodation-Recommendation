import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarRange, Loader2, MessageSquarePlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createReview,
  getEligibleBookings,
} from "@/services/reviewService";
import { formatBookingLabel } from "@/lib/formatters";

const RATING_OPTIONS = ["5", "4", "3", "2", "1"];

const ReviewForm = ({ propertyId, onReviewCreated }) => {
  const { t, i18n } = useTranslation();
  const [eligibleBookings, setEligibleBookings] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [form, setForm] = useState({
    booking: "",
    rating: "5",
    text: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const getBookingLabel = (booking) =>
    formatBookingLabel(booking, i18n.language, t);

  useEffect(() => {
    const fetchEligible = async () => {
      setLoadingBookings(true);
      setError("");

      try {
        const response = await getEligibleBookings(propertyId);
        const bookings = response.data.data || [];
        setEligibleBookings(bookings);
        setForm((prev) => ({
          ...prev,
          booking: bookings[0]?._id ? String(bookings[0]._id) : "",
        }));
      } catch (err) {
        setEligibleBookings([]);
        setError(err.response?.data?.message || t("review.loadBookingsError"));
      } finally {
        setLoadingBookings(false);
      }
    };

    fetchEligible();
  }, [propertyId, t]);

  const selectedBooking = useMemo(
    () =>
      eligibleBookings.find(
        (booking) => String(booking._id) === String(form.booking),
      ) || null,
    [eligibleBookings, form.booking],
  );

  const selectedRatingLabel = t(`review.rating${form.rating}`);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!form.booking) {
      setError(t("review.selectBookingRequired"));
      return;
    }

    if (!form.text.trim()) {
      setError(t("review.textRequired"));
      return;
    }

    setLoading(true);

    try {
      await createReview({
        property: propertyId,
        booking: form.booking,
        rating: Number(form.rating),
        text: form.text.trim(),
      });

      setSuccess(t("review.submitSuccess"));
      await onReviewCreated?.();

      setEligibleBookings((prev) => {
        const remaining = prev.filter(
          (booking) => String(booking._id) !== String(form.booking),
        );
        setForm((current) => ({
          ...current,
          text: "",
          rating: "5",
          booking: remaining[0]?._id ? String(remaining[0]._id) : "",
        }));
        return remaining;
      });
    } catch (err) {
      setError(err.response?.data?.message || t("review.submitError"));
    } finally {
      setLoading(false);
    }
  };

  if (loadingBookings) {
    return (
      <Card className="glass-card border-border/60">
        <CardContent className="flex items-center justify-center gap-2 py-10">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {t("review.loadingBookings")}
          </span>
        </CardContent>
      </Card>
    );
  }

  if (!eligibleBookings.length) {
    return (
      <Card className="glass-card border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageSquarePlus className="size-5" />
            {t("review.leaveReview")}
          </CardTitle>
          <CardDescription>{t("review.noEligibleBookings")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" asChild>
            <Link to={`/bookings/new/${propertyId}`}>
              {t("property.makeBooking")}
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card border-border/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageSquarePlus className="size-5" />
          {t("review.leaveReview")}
        </CardTitle>
        <CardDescription>{t("review.formDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="booking">{t("review.selectBooking")}</Label>
            <Select
              value={form.booking}
              onValueChange={(value) =>
                setForm((prev) => ({ ...prev, booking: value }))
              }
            >
              <SelectTrigger id="booking" className="w-full">
                <SelectValue placeholder={t("review.selectBooking")}>
                  {selectedBooking ? getBookingLabel(selectedBooking) : null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {eligibleBookings.map((booking) => {
                  const bookingId = String(booking._id);
                  const label = getBookingLabel(booking);

                  return (
                    <SelectItem
                      key={bookingId}
                      value={bookingId}
                      label={label}
                    >
                      <span className="inline-flex items-center gap-2">
                        <CalendarRange className="size-3.5 shrink-0" />
                        <span>{label}</span>
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {selectedBooking ? (
              <p className="text-xs text-muted-foreground">
                {t("review.bookingHint", {
                  count: selectedBooking.guests ?? 1,
                })}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="rating">{t("review.rating")}</Label>
            <Select
              value={form.rating}
              onValueChange={(value) =>
                setForm((prev) => ({ ...prev, rating: value }))
              }
            >
              <SelectTrigger id="rating" className="w-full">
                <SelectValue>{selectedRatingLabel}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {RATING_OPTIONS.map((value) => (
                  <SelectItem
                    key={value}
                    value={value}
                    label={t(`review.rating${value}`)}
                  >
                    {t(`review.rating${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="text">{t("review.reviewText")}</Label>
            <Textarea
              id="text"
              name="text"
              value={form.text}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, text: event.target.value }))
              }
              rows={5}
              required
              maxLength={1000}
              placeholder={t("review.textPlaceholder")}
            />
            <p className="text-end text-xs text-muted-foreground" dir="ltr">
              {form.text.length}/1000
            </p>
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {success ? (
            <Alert>
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          ) : null}

          <Button
            type="submit"
            disabled={loading || !form.booking || !form.text.trim()}
            className="w-full whitespace-normal"
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {t("review.analyzing")}
              </>
            ) : (
              t("review.submitReview")
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default ReviewForm;
