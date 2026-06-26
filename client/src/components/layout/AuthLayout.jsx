import { Link } from "react-router-dom";
import { Building2, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";

const AuthLayout = ({ title, subtitle, children }) => {
  const { t } = useTranslation();

  return (
    <div className="grid min-h-[calc(100vh-4rem)] lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-primary p-10 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <div className="relative z-10">
          <Link to="/" className="flex items-center gap-2 text-lg font-semibold">
            <Building2 className="size-6" />
            {t("common.appName")} Platform
          </Link>
        </div>

        <div className="relative z-10 space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-sm">
            <Sparkles className="size-4 shrink-0" />
            {t("auth.authSideTagline")}
          </div>
          <h1 className="max-w-md text-3xl font-bold leading-tight xl:text-4xl">
            {title}
          </h1>
          <p className="max-w-md text-primary-foreground/85">{subtitle}</p>
        </div>

        <p className="relative z-10 text-sm text-primary-foreground/70">
          {t("auth.authSideFooter")}
        </p>

        <div className="pointer-events-none absolute -end-20 -top-20 size-72 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -start-16 size-64 rounded-full bg-white/10 blur-3xl" />
      </div>

      <div className="flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
};

export default AuthLayout;
