import { Link } from "react-router-dom";
import { Building2 } from "lucide-react";
import { useTranslation } from "react-i18next";

const Footer = () => {
  const { t } = useTranslation();
  const year = new Date().getFullYear();

  const links = [
    { to: "/", label: t("nav.home") },
    { to: "/search", label: t("nav.search") },
    { to: "/login", label: t("nav.login") },
    { to: "/register", label: t("nav.register") },
  ];

  return (
    <footer className="mt-auto border-t border-border/60 bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Building2 className="size-4" />
            </span>
            <div>
              <p className="font-semibold">{t("common.appName")}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("common.appTagline")}
              </p>
            </div>
          </div>

          <div>
            <p className="mb-3 text-sm font-medium">{t("footer.quickLinks")}</p>
            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
              {links.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="w-fit transition-colors hover:text-foreground"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="space-y-2 text-sm text-muted-foreground md:col-span-2 lg:col-span-1">
            <p>{t("footer.tagline")}</p>
            <p>{t("footer.copyright", { year })}</p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
