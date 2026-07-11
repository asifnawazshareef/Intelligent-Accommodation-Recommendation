import { Link } from "react-router-dom";
import { Building2 } from "lucide-react";
import { useTranslation } from "react-i18next";

const AuthLayout = ({ title, subtitle, children }) => {
  const { t } = useTranslation();

  return (
    <div className="grid flex-1 lg:grid-cols-2">
      <div className="hidden bg-primary text-primary-foreground lg:flex lg:flex-col lg:justify-between lg:p-10">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-primary-foreground/90"
        >
          <Building2 className="size-5" />
          {t("common.appName")}
        </Link>

        <div className="max-w-md space-y-3">
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          {subtitle ? (
            <p className="text-base text-primary-foreground/85">{subtitle}</p>
          ) : null}
        </div>

        <p className="text-sm text-primary-foreground/70">
          {t("common.appTagline")}
        </p>
      </div>

      <div className="flex flex-1 items-center justify-center bg-muted/20 p-4 sm:p-8">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
};

export default AuthLayout;
