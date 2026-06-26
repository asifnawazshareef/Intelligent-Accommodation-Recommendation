import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusStyles = {
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  confirmed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  cancelled: "bg-destructive/15 text-destructive",
  failed: "bg-destructive/15 text-destructive",
};

const statusLabelKeys = {
  pending: "property.pending",
  confirmed: "booking.bookingConfirmed",
  cancelled: "booking.cancelled",
  failed: "booking.paymentFailed",
};

const BookingStatusBadge = ({ status, type = "booking", className = "" }) => {
  const { t } = useTranslation();

  const labelKey =
    type === "payment" && status === "confirmed"
      ? "booking.paymentConfirmed"
      : type === "payment" && status === "pending"
        ? "booking.paymentPending"
        : statusLabelKeys[status] || status;

  return (
    <Badge
      variant="secondary"
      className={cn(
        "whitespace-normal capitalize",
        statusStyles[status] || "",
        className,
      )}
    >
      {t(labelKey, status)}
    </Badge>
  );
};

export default BookingStatusBadge;
