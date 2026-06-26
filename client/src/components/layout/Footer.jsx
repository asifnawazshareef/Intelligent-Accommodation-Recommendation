import { Link } from "react-router-dom";
import { Building2 } from "lucide-react";
import { useTranslation } from "react-i18next";

const Footer = () => {
  const { t } = useTranslation();

  return (
    <footer className="border-t border-border/60 bg-muted/30">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Building2 className="size-4" />
          </span>
          <div>
            <p className="font-semibold">{t("common.appName")}</p>
            <p className="text-sm text-muted-foreground">
              {t("common.appTagline")}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground">
            {t("nav.home")}
          </Link>
          <Link to="/login" className="hover:text-foreground">
            {t("nav.login")}
          </Link>
          <Link to="/register" className="hover:text-foreground">
            {t("nav.register")}
          </Link>
        </div>

        <p className="text-sm text-muted-foreground">{t("footer.tagline")}</p>
      </div>
    </footer>
  );
};

export default Footer;
