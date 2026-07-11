import { Link } from "react-router-dom";
import {
  ClipboardList,
  ImageIcon,
  Shield,
  Users,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PageHeader from "@/components/ui/PageHeader";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const ADMIN_TASKS = [
  {
    to: "/admin/listings",
    icon: ClipboardList,
    titleKey: "admin.moderateListings",
    descKey: "dashboard.adminTaskModerate",
  },
  {
    to: "/admin/users",
    icon: Users,
    titleKey: "admin.manageUsers",
    descKey: "dashboard.adminTaskUsers",
  },
  {
    to: "/admin/image-audit",
    icon: ImageIcon,
    titleKey: "admin.imageAudit",
    descKey: "dashboard.adminTaskAudit",
  },
];

const AdminDashboard = () => {
  const { t } = useTranslation();

  return (
    <DashboardLayout>
      <div className="dashboard-page space-y-8">
        <PageHeader
          badge={
            <Badge variant="secondary" className="gap-1">
              <Shield className="size-3.5 shrink-0" />
              {t("auth.admin")}
            </Badge>
          }
          title={t("nav.adminDashboard")}
        />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {ADMIN_TASKS.map((task) => {
            const Icon = task.icon;

            return (
              <Link key={task.to} to={task.to} className="group block h-full">
                <Card className="glass-card h-full transition-shadow hover:shadow-md">
                  <CardHeader className="space-y-3">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="size-5" />
                    </span>
                    <CardTitle className="text-base group-hover:text-primary">
                      {t(task.titleKey)}
                    </CardTitle>
                    <CardDescription className="text-sm leading-relaxed">
                      {t(task.descKey)}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;
