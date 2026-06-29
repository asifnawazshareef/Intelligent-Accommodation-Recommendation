import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import DashboardLayout from "@/components/layout/DashboardLayout";
import DashboardShell from "@/components/dashboard/DashboardShell";

const AdminDashboard = () => {
  const { t } = useTranslation();
  const { user } = useAuth();

  return (
    <DashboardLayout>
      <div className="dashboard-page">
        <DashboardShell role="admin" user={user}>
        <p>{t("dashboard.adminInfo1")}</p>
        <p className="pt-2">
          {t("dashboard.adminVerified")}:{" "}
          <span className="font-medium text-foreground">
            {user?.isVerified ? t("common.yes") : t("common.no")}
          </span>
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link to="/admin/users">
            <Button size="sm">{t("admin.manageUsers")}</Button>
          </Link>
          <Link to="/admin/listings">
            <Button size="sm" variant="outline">
              {t("admin.moderateListings")}
            </Button>
          </Link>
          <Link to="/admin/image-audit">
            <Button size="sm" variant="outline">
              {t("admin.imageAudit")}
            </Button>
          </Link>
        </div>
        </DashboardShell>
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;
