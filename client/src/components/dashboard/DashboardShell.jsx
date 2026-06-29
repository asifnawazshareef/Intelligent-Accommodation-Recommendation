import { Link } from "react-router-dom";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Building2,
  Calendar,
  ChevronRight,
  ClipboardList,
  ImageIcon,
  Mail,
  MessageSquare,
  Phone,
  Search,
  Shield,
  Sparkles,
  Ticket,
  User,
  Users,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const QuickLinkCard = ({ to, icon: Icon, title, description }) => (
  <Link to={to} className="group block h-full">
    <Card className="glass-card h-full transition-shadow hover:shadow-md">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-4" />
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
        </div>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription className="line-clamp-2">{description}</CardDescription>
      </CardHeader>
    </Card>
  </Link>
);

const DashboardShell = ({ role, user, children }) => {
  const { t } = useTranslation();

  const roleMeta = useMemo(
    () => ({
      guest: {
        badge: t("auth.guest"),
        dashboardTitle: t("nav.guestDashboard"),
        icon: User,
        subtitle: t("dashboard.guestSubtitle"),
        quickLinks: [
          {
            to: "/search",
            icon: Search,
            title: t("nav.search"),
            description: t("dashboard.quickSearchDesc"),
          },
          {
            to: "/guest/bookings",
            icon: Ticket,
            title: t("booking.myBookings"),
            description: t("dashboard.quickBookingsDesc"),
          },
          {
            to: "/guest/offline-requests",
            icon: MessageSquare,
            title: t("offlinePage.guestTitle"),
            description: t("dashboard.quickOfflineGuestDesc"),
          },
          {
            to: "/offline-booking",
            icon: Calendar,
            title: t("offline.offlineBookingRequest"),
            description: t("dashboard.quickOfflineDesc"),
          },
        ],
      },
      owner: {
        badge: t("auth.owner"),
        dashboardTitle: t("nav.ownerDashboard"),
        icon: Sparkles,
        subtitle: t("dashboard.ownerSubtitle"),
        quickLinks: [
          {
            to: "/owner/properties",
            icon: Sparkles,
            title: t("property.properties"),
            description: t("dashboard.quickListingsDesc"),
          },
          {
            to: "/owner/properties/new",
            icon: Calendar,
            title: t("property.createProperty"),
            description: t("dashboard.quickAddListingDesc"),
          },
          {
            to: "/owner/offline-requests",
            icon: Mail,
            title: t("offlinePage.ownerTitle"),
            description: t("dashboard.quickOfflineOwnerDesc"),
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
            to: "/admin/users",
            icon: Users,
            title: t("admin.manageUsers"),
            description: t("dashboard.quickUsersDesc"),
          },
          {
            to: "/admin/listings",
            icon: ClipboardList,
            title: t("admin.moderateListings"),
            description: t("dashboard.quickModerateDesc"),
          },
          {
            to: "/admin/image-audit",
            icon: ImageIcon,
            title: t("admin.imageAudit"),
            description: t("dashboard.quickAuditDesc"),
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="gap-1 whitespace-normal">
              <RoleIcon className="size-3.5 shrink-0" />
              {meta.badge}
            </Badge>
          </div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {meta.dashboardTitle}
          </h1>
          <p className="mt-1 text-muted-foreground">{meta.subtitle}</p>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          {t("dashboard.quickActions")}
        </h2>
        <div className="dashboard-grid">
          {meta.quickLinks.map((link) => (
            <QuickLinkCard key={link.to} {...link} />
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="glass-card lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("dashboard.accountOverview")}</CardTitle>
            <CardDescription>{t("dashboard.profileInfo")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/30 p-4">
              <User className="mt-0.5 size-4 shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">
                  {t("dashboard.fullName")}
                </p>
                <p className="font-medium">{user?.name}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/30 p-4">
              <Mail className="mt-0.5 size-4 shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{t("auth.email")}</p>
                <p className="break-all font-medium" dir="ltr">
                  {user?.email}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/30 p-4">
              <Phone className="mt-0.5 size-4 shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{t("auth.phone")}</p>
                <p className="font-medium" dir="ltr">
                  {user?.phone || t("common.notProvided")}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/30 p-4">
              <Calendar className="mt-0.5 size-4 shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">
                  {t("auth.languagePreference")}
                </p>
                <p className="font-medium" dir="ltr">
                  {user?.languagePref || "en"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle>{t("dashboard.quickInfo")}</CardTitle>
            <CardDescription>{t("dashboard.platformStatus")}</CardDescription>
          </CardHeader>
          <CardContent className={cn("space-y-3 text-sm text-muted-foreground")}>
            {children}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardShell;
