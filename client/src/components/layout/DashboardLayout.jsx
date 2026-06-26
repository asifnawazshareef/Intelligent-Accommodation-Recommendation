import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Building2,
  ClipboardList,
  Home,
  ImageIcon,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Shield,
  Ticket,
  User,
  Users,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import ThemeToggle from "./ThemeToggle";
import { cn } from "@/lib/utils";

const DashboardLayout = ({ children }) => {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const roleConfig = useMemo(
    () => ({
      guest: {
        label: t("auth.guest"),
        dashboard: "/guest/dashboard",
        icon: User,
        nav: [
          {
            to: "/guest/dashboard",
            label: t("nav.dashboard"),
            icon: LayoutDashboard,
          },
          {
            to: "/guest/bookings",
            label: t("booking.myBookings"),
            icon: Ticket,
            matchPrefix: true,
          },
        ],
      },
      owner: {
        label: t("auth.owner"),
        dashboard: "/owner/dashboard",
        icon: Building2,
        nav: [
          {
            to: "/owner/dashboard",
            label: t("nav.dashboard"),
            icon: LayoutDashboard,
          },
          {
            to: "/owner/properties",
            label: t("property.properties"),
            icon: Building2,
            matchPrefix: true,
          },
          {
            to: "/owner/offline-requests",
            label: t("offlinePage.ownerTitle"),
            icon: MessageSquare,
          },
        ],
      },
      admin: {
        label: t("auth.admin"),
        dashboard: "/admin/dashboard",
        icon: Shield,
        nav: [
          {
            to: "/admin/dashboard",
            label: t("nav.dashboard"),
            icon: LayoutDashboard,
          },
          {
            to: "/admin/listings",
            label: t("admin.moderateListings"),
            icon: ClipboardList,
          },
          {
            to: "/admin/users",
            label: t("admin.manageUsers"),
            icon: Users,
          },
          {
            to: "/admin/image-audit",
            label: t("admin.imageAudit"),
            icon: ImageIcon,
          },
        ],
      },
    }),
    [t],
  );

  const config = roleConfig[user?.role] || roleConfig.guest;
  const RoleIcon = config.icon;

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const SidebarContent = () => (
    <>
      <div className="flex items-center gap-2 border-b border-sidebar-border px-4 py-5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
          <Building2 className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="font-semibold">{t("common.appName")}</p>
          <p className="truncate text-xs text-muted-foreground">
            {config.label} {t("dashboard.panel")}
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {config.nav.map((item) => {
          const Icon = item.icon;
          const active = item.matchPrefix
            ? location.pathname === item.to ||
              location.pathname.startsWith(`${item.to}/`)
            : location.pathname === item.to;

          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors whitespace-normal",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}

        <Link
          to="/"
          onClick={() => setSidebarOpen(false)}
          className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-foreground whitespace-normal"
        >
          <Home className="size-4 shrink-0" />
          {t("dashboard.backToHome")}
        </Link>
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <div className="mb-3 rounded-lg bg-muted/50 p-3">
          <div className="flex items-center gap-2">
            <RoleIcon className="size-4 shrink-0 text-primary" />
            <p className="truncate text-sm font-medium">{user?.name}</p>
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {user?.email}
          </p>
        </div>
        <Button
          variant="outline"
          className="w-full min-w-fit whitespace-normal"
          size="sm"
          onClick={handleLogout}
        >
          <LogOut className="size-4" />
          {t("nav.logout")}
        </Button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 flex-col border-e border-border bg-sidebar lg:flex">
        <SidebarContent />
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setSidebarOpen(false)}
            aria-label={t("common.closeSidebar")}
          />
          <aside className="relative flex h-full w-72 max-w-[85vw] flex-col bg-sidebar shadow-xl">
            <Button
              variant="ghost"
              size="icon"
              className="absolute end-2 top-2"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="size-4" />
            </Button>
            <SidebarContent />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-3 border-b border-border/60 bg-background/80 px-4 backdrop-blur-md sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              className="shrink-0 lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="size-4" />
            </Button>
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">
                {t("dashboard.welcomeBack")}
              </p>
              <p className="truncate font-semibold">{user?.name}</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <LanguageSwitcher compact />
            <Badge variant="secondary" className="whitespace-normal">
              {config.label}
            </Badge>
            <ThemeToggle />
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
};

export default DashboardLayout;
