import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import DashboardLayout from "@/components/layout/DashboardLayout";
import DashboardShell from "@/components/dashboard/DashboardShell";

const OwnerDashboard = () => {
  const { t } = useTranslation();
  const { user } = useAuth();

  return (
    <DashboardLayout>
      <DashboardShell role="owner" user={user}>
        <p>{t("dashboard.ownerInfo1")}</p>
        <p className="pt-2">{t("dashboard.ownerInfo2")}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link to="/owner/properties">
            <Button size="sm">{t("property.properties")}</Button>
          </Link>
          <Link to="/owner/offline-requests">
            <Button size="sm" variant="outline">
              {t("offlinePage.ownerTitle")}
            </Button>
          </Link>
        </div>
      </DashboardShell>
    </DashboardLayout>
  );
};

export default OwnerDashboard;
