import { Link, Outlet } from "react-router-dom";
import { ArrowLeft, Building2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import ThemeToggle from "./ThemeToggle";

const AuthShellLayout = () => {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/90 backdrop-blur-md">
        <div className="site-container flex h-14 items-center justify-between gap-3">
          <Link
            to="/"
            className="flex min-w-0 items-center gap-2 font-semibold tracking-tight transition-opacity hover:opacity-90"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Building2 className="size-4" />
            </span>
            <span className="truncate">{t("common.appName")}</span>
          </Link>

          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:inline-flex"
            >
              <ArrowLeft className="size-3.5 shrink-0" />
              {t("dashboard.backToHome")}
            </Link>
            <LanguageSwitcher compact />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        <Outlet />
      </main>
    </div>
  );
};

export default AuthShellLayout;
