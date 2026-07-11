import { Link } from "react-router-dom";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Building2,
  Calendar,
  ClipboardList,
  ImageIcon,
  MessageSquare,
  Search,
  Shield,
  Ticket,
  User,
  Users,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import PageHeader from "@/components/ui/PageHeader";

const QuickLinkCard = ({ to, icon: Icon, title }) => (
  <Link to={to} className="group block h-full">
    <Card className="h-full transition-shadow hover:shadow-md">
      <CardHeader className="pb-4">
        <span className="mb-2 flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4" />
        </span>
        <CardTitle className="text-base group-hover:text-primary">
          {title}
        </CardTitle>
      </CardHeader>
    </Card>
  </Link>
);

const DashboardShell = ({ role, user }) => {
  const { t } = useTranslation();

  const roleMeta = useMemo(
    () => ({
      guest: {
        badge: t("auth.guest"),
        dashboardTitle: t("nav.guestDashboard"),
        icon: User,
        subtitle: t("dashboard.guestSubtitle"),
        quickLinks: [
          { to: "/search", icon: Search, title: t("nav.search") },
          { to: "/guest/bookings", icon: Ticket, title: t("booking.myBookings") },
          {
            to: "/guest/offline-requests",
            icon: MessageSquare,
            title: t("offlinePage.guestTitle"),
          },
          {
            to: "/offline-booking",
            icon: Calendar,
            title: t("offline.offlineBookingRequest"),
          },
        ],
      },
      owner: {
        badge: t("auth.owner"),
        dashboardTitle: t("nav.ownerDashboard"),
        icon: Building2,
        subtitle: t("dashboard.ownerSubtitle"),
        quickLinks: [
          {
            to: "/owner/properties",
            icon: Building2,
            title: t("property.properties"),
          },
          {
            to: "/owner/properties/new",
            icon: Calendar,
            title: t("property.createProperty"),
          },
          {
            to: "/owner/offline-requests",
            icon: MessageSquare,
            title: t("offlinePage.ownerTitle"),
          },
        ],
      },
      admin: {
        badge: t("auth.admin"),
        dashboardTitle: t("nav.adminDashboard"),
        icon: Shield,
        subtitle: t("dashboard.adminSubtitle"),
        quickLinks: [
          {
            to: "/admin/listings",
            icon: ClipboardList,
            title: t("admin.moderateListings"),
          },
          { to: "/admin/users", icon: Users, title: t("admin.manageUsers") },
          {
            to: "/admin/image-audit",
            icon: ImageIcon,
            title: t("admin.imageAudit"),
          },
        ],
      },
    }),
    [t],
  );

  const meta = roleMeta[role] || roleMeta.guest;
  const RoleIcon = meta.icon;

  return (
    <div className="w-full space-y-6">
      <PageHeader
        badge={
          <Badge variant="secondary" className="gap-1">
            <RoleIcon className="size-3.5 shrink-0" />
            {meta.badge}
          </Badge>
        }
        title={meta.dashboardTitle}
        description={meta.subtitle}
      />

      <p className="text-sm text-muted-foreground">
        {user?.name} · <span dir="ltr">{user?.email}</span>
      </p>

      <div className="dashboard-grid">
        {meta.quickLinks.map((link) => (
          <QuickLinkCard key={link.to} {...link} />
        ))}
      </div>
    </div>
  );
};

export default DashboardShell;
