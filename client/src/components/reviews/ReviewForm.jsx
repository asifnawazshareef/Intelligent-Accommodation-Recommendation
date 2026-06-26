import { useEffect, useState } from "react";
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

const formatDate = (value) => {
  if (!value) return "—";
  return new Date(value).toLocaleDateString();
};

const ReviewForm = ({ propertyId, onReviewCreated }) => {
  const { t } = useTranslation();
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
          booking: bookings[0]?._id || "",
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

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const response = await createReview({
        property: propertyId,
        booking: form.booking,
        rating: Number(form.rating),
        text: form.text,
      });

      onReviewCreated?.(response.data.data);
      setSuccess(t("review.submitSuccess"));

      setEligibleBookings((prev) => {
        const remaining = prev.filter(
          (booking) => booking._id !== form.booking,
        );
        setForm((current) => ({
          ...current,
          text: "",
          booking: remaining[0]?._id || "",
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
                <SelectValue placeholder={t("review.selectBooking")} />
              </SelectTrigger>
              <SelectContent>
                {eligibleBookings.map((booking) => (
                  <SelectItem key={booking._id} value={booking._id}>
                    <span className="inline-flex items-center gap-2">
                      <CalendarRange className="size-3.5 shrink-0" />
                      {formatDate(booking.startDate)} –{" "}
                      {formatDate(booking.endDate)}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">{t("review.rating5")}</SelectItem>
                <SelectItem value="4">{t("review.rating4")}</SelectItem>
                <SelectItem value="3">{t("review.rating3")}</SelectItem>
                <SelectItem value="2">{t("review.rating2")}</SelectItem>
                <SelectItem value="1">{t("review.rating1")}</SelectItem>
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
