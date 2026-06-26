import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import DashboardLayout from "@/components/layout/DashboardLayout";
import DashboardShell from "@/components/dashboard/DashboardShell";

const GuestDashboard = () => {
  const { t } = useTranslation();
  const { user } = useAuth();

  return (
    <DashboardLayout>
      <DashboardShell role="guest" user={user}>
        <p>{t("dashboard.guestInfo1")}</p>
        <p className="pt-2">{t("dashboard.guestInfo2")}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link to="/search">
            <Button size="sm">{t("nav.search")}</Button>
          </Link>
          <Link to="/guest/bookings">
            <Button size="sm" variant="outline">
              {t("booking.myBookings")}
            </Button>
          </Link>
        </div>
      </DashboardShell>
    </DashboardLayout>
  );
};

export default GuestDashboard;
