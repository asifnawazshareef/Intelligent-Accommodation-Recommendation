import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Calendar,
  Mail,
  Phone,
  Shield,
  Sparkles,
  User,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const DashboardShell = ({ role, user, children }) => {
  const { t } = useTranslation();

  const roleMeta = useMemo(
    () => ({
      guest: {
        badge: t("auth.guest"),
        dashboardTitle: t("nav.guestDashboard"),
        icon: User,
        subtitle: t("dashboard.guestSubtitle"),
        stats: [
          {
            label: t("dashboard.statBookings"),
            value: "—",
            hint: t("dashboard.hintBookings"),
          },
          {
            label: t("dashboard.statReviews"),
            value: "—",
            hint: t("dashboard.hintReviews"),
          },
          {
            label: t("dashboard.statSaved"),
            value: "—",
            hint: t("dashboard.hintSaved"),
          },
        ],
      },
      owner: {
        badge: t("auth.owner"),
        dashboardTitle: t("nav.ownerDashboard"),
        icon: Sparkles,
        subtitle: t("dashboard.ownerSubtitle"),
        stats: [
          {
            label: t("dashboard.statListings"),
            value: "—",
            hint: t("dashboard.hintListings"),
          },
          {
            label: t("dashboard.statPending"),
            value: "—",
            hint: t("dashboard.hintPendingReview"),
          },
          {
            label: t("dashboard.statApproved"),
            value: "—",
            hint: t("dashboard.hintApproved"),
          },
        ],
      },
      admin: {
        badge: t("auth.admin"),
        dashboardTitle: t("nav.adminDashboard"),
        icon: Shield,
        subtitle: t("dashboard.adminSubtitle"),
        stats: [
          {
            label: t("dashboard.statUsers"),
            value: "—",
            hint: t("dashboard.hintUsers"),
          },
          {
            label: t("dashboard.statPending"),
            value: "—",
            hint: t("dashboard.hintPendingListings"),
          },
          {
            label: t("dashboard.statAudits"),
            value: "—",
            hint: t("dashboard.hintAudits"),
          },
        ],
      },
    }),
    [t],
  );

  const meta = roleMeta[role] || roleMeta.guest;
  const RoleIcon = meta.icon;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {meta.stats.map((stat) => (
          <Card key={stat.label} className="glass-card">
            <CardHeader className="pb-2">
              <CardDescription>{stat.label}</CardDescription>
              <CardTitle className="text-3xl">{stat.value}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{stat.hint}</p>
            </CardContent>
          </Card>
        ))}
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
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            {children}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardShell;
