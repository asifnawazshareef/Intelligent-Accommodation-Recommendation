import { Link } from "react-router-dom";
import { Building2 } from "lucide-react";
import { useTranslation } from "react-i18next";

const Footer = () => {
  const { t } = useTranslation();
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-border/60 bg-muted/30">
      <div className="site-container flex flex-col gap-3 py-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="size-4 text-primary" />
          <p className="text-sm font-medium">
            {t("common.appName")} · {t("footer.tagline")}
          </p>
        </div>
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground">
            {t("nav.home")}
          </Link>
          <Link to="/search" className="hover:text-foreground">
            {t("nav.search")}
          </Link>
          <Link to="/login" className="hover:text-foreground">
            {t("nav.login")}
          </Link>
          <span>{t("footer.copyright", { year })}</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
