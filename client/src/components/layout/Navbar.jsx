import { Link, useLocation, useNavigate } from "react-router-dom";
import { Building2, Loader2, LogOut, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import ThemeToggle from "./ThemeToggle";
import { cn } from "@/lib/utils";

const Navbar = ({ variant = "public" }) => {
  const { t } = useTranslation();
  const { isAuthenticated, user, logout, getDashboardPath, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    setMobileOpen(false);
    navigate("/login", { replace: true });
  };

  const dashboardPath = user ? getDashboardPath(user.role) : "/login";

  const desktopNavLinks = [
    { to: "/", label: t("nav.home"), key: "home" },
    { to: "/search", label: t("nav.search"), key: "search" },
  ];

  const mobileNavLinks = [
    { to: "/", label: t("nav.home"), key: "home" },
    { to: "/search", label: t("nav.search"), key: "search" },
    { to: "/login", label: t("nav.login"), key: "login", hideWhenAuth: true },
    {
      to: "/register",
      label: t("nav.register"),
      key: "register",
      hideWhenAuth: true,
    },
  ];

  const isActive = (path) =>
    path === "/"
      ? location.pathname === "/"
      : location.pathname === path || location.pathname.startsWith(`${path}/`);

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/95 shadow-sm backdrop-blur-md">
      <div className="site-container grid h-[4.25rem] grid-cols-[auto_1fr_auto] items-center gap-3 sm:gap-4">
        <Link
          to="/"
          className="flex min-w-0 shrink-0 items-center gap-2.5 transition-opacity hover:opacity-90"
          onClick={() => setMobileOpen(false)}
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Building2 className="size-5" />
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block text-base font-bold tracking-tight sm:text-lg">
              {t("common.appName")}
            </span>
            <span className="hidden max-w-[14rem] truncate text-[11px] font-medium text-muted-foreground sm:block">
              {t("common.appTagline")}
            </span>
          </span>
        </Link>

        <nav className="hidden items-center justify-center gap-1 md:flex">
          {desktopNavLinks.map((link) => (
            <Link
              key={link.key}
              to={link.to}
              className={cn(
                "rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
                isActive(link.to)
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {link.label}
            </Link>
          ))}

          {!loading && isAuthenticated && variant === "public" && (
            <Link
              to={dashboardPath}
              className={cn(
                "rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
                isActive(dashboardPath)
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {t("nav.dashboard")}
            </Link>
          )}
        </nav>

        <div className="flex shrink-0 items-center justify-end gap-1.5 sm:gap-2">
          <LanguageSwitcher compact className="hidden sm:flex" />
          <ThemeToggle />

          {loading ? (
            <div className="hidden items-center gap-2 sm:flex">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          ) : isAuthenticated ? (
            <div className="hidden items-center gap-2 sm:flex">
              <span className="hidden max-w-[8rem] truncate text-sm text-muted-foreground lg:inline xl:max-w-[11rem]">
                {user?.name}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="shrink-0 whitespace-nowrap"
              >
                <LogOut className="size-4" />
                <span className="hidden lg:inline">{t("nav.logout")}</span>
              </Button>
            </div>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <Link to="/login">
                <Button variant="ghost" size="sm" className="shrink-0 whitespace-nowrap">
                  {t("nav.login")}
                </Button>
              </Link>
              <Link to="/register">
                <Button size="sm" className="shrink-0 whitespace-nowrap">
                  {t("nav.register")}
                </Button>
              </Link>
            </div>
          )}

          <Button
            variant="outline"
            size="icon"
            className="shrink-0 md:hidden"
            onClick={() => setMobileOpen((open) => !open)}
            aria-expanded={mobileOpen}
            aria-label={t("common.toggleMenu")}
          >
            {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </Button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-border/60 bg-background px-4 py-4 md:hidden">
          <div className="mb-4 flex items-center gap-2 sm:hidden">
            <LanguageSwitcher className="flex-1" />
          </div>

          <nav className="flex flex-col gap-1">
            {mobileNavLinks.map((link) => {
              if (link.hideWhenAuth && isAuthenticated) return null;

              return (
                <Link
                  key={link.key}
                  to={link.to}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "rounded-lg px-3 py-2.5 text-sm font-medium text-start transition-colors",
                    isActive(link.to)
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted/60",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}

            {!loading && isAuthenticated && (
              <>
                <Link
                  to={dashboardPath}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium text-primary text-start"
                >
                  {t("nav.dashboard")}
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-lg px-3 py-2.5 text-start text-sm font-medium text-destructive hover:bg-destructive/10"
                >
                  {t("nav.logout")}
                </button>
              </>
            )}

            {!loading && !isAuthenticated && (
              <div className="mt-3 flex flex-col gap-2 border-t border-border/60 pt-3">
                <Link to="/login" onClick={() => setMobileOpen(false)}>
                  <Button variant="outline" className="w-full">
                    {t("nav.login")}
                  </Button>
                </Link>
                <Link to="/register" onClick={() => setMobileOpen(false)}>
                  <Button className="w-full">{t("nav.register")}</Button>
                </Link>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
};

export default Navbar;
